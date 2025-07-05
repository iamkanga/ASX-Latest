// File Version: v151
// Last Updated: 2025-07-05 (Firebase Global Access Fix)

// This script interacts with Firebase Firestore for data storage.
// Firebase app, db, auth instances, and userId are made globally available
// via window.firestoreDb, window.firebaseAuth, window.getFirebaseAppId(), etc.,
// from the <script type="module"> block in index.html.

// --- GLOBAL VARIABLES (Accessible throughout the script) ---
let db;
let auth = null;
let currentUserId = null;
let currentAppId;
let selectedShareDocId = null;
let allSharesData = []; // This will now be kept in sync by the onSnapshot listener
let unsubscribeShares = null; // To store the unsubscribe function for the Firestore listener
let currentDialogCallback = null;
let autoDismissTimeout = null;
let lastTapTime = 0;
let tapTimeout;
let selectedElementForTap = null;
let longPressTimer;
const LONG_PRESS_THRESHOLD = 500; // Time in ms for long press detection
let touchStartX = 0;
let touchStartY = 0;
const TOUCH_MOVE_THRESHOLD = 10; // Pixels for touch movement to cancel long press
const KANGA_EMAIL = 'iamkanga@gmail.com'; // CORRECTED EMAIL ADDRESS
let currentCalculatorInput = '';
let operator = null;
let previousCalculatorInput = '';
let resultDisplayed = false;
const DEFAULT_WATCHLIST_NAME = 'My Watchlist (Default)';
const DEFAULT_WATCHLIST_ID_SUFFIX = 'default';
let userWatchlists = []; // Stores all watchlists for the user
let currentSelectedWatchlistIds = []; // Stores IDs of currently selected watchlists for display
let unsubscribeWatchlists = null; // To store the unsubscribe function for the watchlists listener
let currentSortOrder = 'entryDate-desc'; // Default sort order
const ALL_SHARES_ID = 'ALL_SHARES'; // Typo fix: ALL_SHARES_ID

// --- DOM ELEMENTS ---
const hamburgerBtn = document.getElementById('hamburgerBtn');
const appSidebar = document.getElementById('appSidebar');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const addShareHeaderBtn = document.getElementById('addShareHeaderBtn');
const shareTableBody = document.querySelector('#shareTable tbody');
const mobileShareCardsContainer = document.getElementById('mobileShareCards');
const googleAuthBtn = document.getElementById('googleAuthBtn');
const shareFormModal = document.getElementById('shareFormSection');
const shareFormTitle = document.getElementById('formTitle');
const shareNameInput = document.getElementById('shareName');
const currentPriceInput = document.getElementById('currentPrice');
const targetPriceInput = document.getElementById('targetPrice');
const dividendAmountInput = document.getElementById('dividendAmount');
const frankingCreditsInput = document.getElementById('frankingCredits');
const saveShareBtn = document.getElementById('saveShareBtn');
const cancelFormBtn = document.getElementById('cancelFormBtn');
const deleteShareBtn = document.getElementById('deleteShareBtn');
const shareDetailModal = document.getElementById('shareDetailModal');
const modalShareName = document.getElementById('modalShareName');
const modalEntryDate = document.getElementById('modalEntryDate');
const modalEnteredPrice = document.getElementById('modalEnteredPrice');
const modalTargetPrice = document.getElementById('modalTargetPrice');
const modalDividendAmount = document.getElementById('modalDividendAmount');
const modalFrankingCredits = document.getElementById('modalFrankingCredits');
const modalUnfrankedYield = document.getElementById('modalUnfrankedYield');
const modalFrankedYield = document.getElementById('modalFrankedYield');
const modalMarketIndexLink = document.getElementById('modalMarketIndexLink');
const modalFoolLink = document.getElementById('modalFoolLink');
const modalCommSecLink = document.getElementById('modalCommSecLink');
const modalNewsLink = document.getElementById('modalNewsLink');
const deleteShareFromDetailBtn = document.getElementById('deleteShareFromDetailBtn');
const editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn');
const commentsFormContainer = document.getElementById('commentsFormContainer');
const addCommentSectionBtn = document.getElementById('addCommentSectionBtn');
const modalCommentsContainer = document.getElementById('modalCommentsContainer');
const newShareBtn = document.getElementById('newShareBtn');
const standardCalcBtn = document.getElementById('standardCalcBtn');
const dividendCalcBtn = document.getElementById('dividendCalcBtn');
const calculatorModal = document.getElementById('calculatorModal');
const calculatorDisplayInput = document.getElementById('calculatorInput');
const calculatorDisplayResult = document.getElementById('calculatorResult');
const calculatorButtons = document.querySelector('#calculatorModal .calculator-buttons');
const dividendCalculatorModal = document.getElementById('dividendCalculatorModal');
const calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
const calcDividendAmountInput = document.getElementById('calcDividendAmount');
const calcFrankingCreditsInput = document.getElementById('frankingCredits'); // Re-using ID, ensure it's distinct for this modal if needed
const calcUnfrankedYieldSpan = document.getElementById('calcUnfrankedYield');
const calcFrankedYieldSpan = document.getElementById('calcFrankedYield');
const investmentValueSelect = document.getElementById('investmentValueSelect');
const calcEstimatedDividendSpan = document.getElementById('calcEstimatedDividend');
const customDialogModal = document.getElementById('customDialogModal');
const customDialogMessage = document.getElementById('customDialogMessage');
const customDialogConfirmBtn = document.getElementById('customDialogConfirmBtn');
const customDialogCancelBtn = document.getElementById('customDialogCancelBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const watchlistSelect = document.getElementById('watchlistSelect');
const addWatchlistBtn = document.getElementById('addWatchlistBtn');
const addWatchlistModal = document.getElementById('addWatchlistModal');
const newWatchlistNameInput = document.getElementById('newWatchlistName');
const saveWatchlistBtn = document.getElementById('saveWatchlistBtn');
const cancelAddWatchlistBtn = document.getElementById('cancelAddWatchlistBtn');
const editWatchlistBtn = document.getElementById('editWatchlistBtn');
const manageWatchlistModal = document.getElementById('manageWatchlistModal');
const editWatchlistNameInput = document.getElementById('editWatchlistName');
const saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn');
const deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn');
const cancelManageWatchlistBtn = document.getElementById('cancelManageWatchlistBtn');
const sortSelect = document.getElementById('sortSelect');
const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const colorThemeSelect = document.getElementById('colorThemeSelect');
const revertToDefaultThemeBtn = document.getElementById('revertToDefaultThemeBtn');
const logoutBtn = document.getElementById('logoutBtn');
const scrollToTopBtn = document.getElementById('scrollToTopBtn');
const shareContextMenu = document.getElementById('shareContextMenu');
const contextEditShareBtn = document.getElementById('contextEditShareBtn');
const contextDeleteShareBtn = document.getElementById('contextDeleteShareBtn');
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn');
const mainTitle = document.getElementById('mainTitle');

// --- FIREBASE GLOBALS ACCESS (from index.html module script) ---
// These are accessed directly from the window object.
// We assume index.html has already populated these.
let firestoreFunctions;
let authFunctions;

// Function to initialize Firebase objects from window globals
function initializeFirebaseGlobals() {
    db = window.firestoreDb;
    auth = window.firebaseAuth;
    currentAppId = window.getFirebaseAppId();
    firestoreFunctions = window.firestoreFunctions;
    authFunctions = window.authFunctions;

    if (!db || !auth || !firestoreFunctions || !authFunctions) {
        console.error("[Firebase] Firebase objects (db, auth, firestoreFunctions, authFunctions) are not available. Firebase initialization likely failed in index.html.");
        const errorDiv = document.getElementById('firebaseInitError');
        if (errorDiv) {
            errorDiv.style.display = 'block';
        }
        updateAuthButtonText(false);
        updateMainButtonsState(false);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        applyTheme('system-default'); // Revert to default theme on error
        return false;
    }
    console.log("[Firebase] Firebase globals successfully accessed in script.js.");
    console.log("script.js: typeof firestoreFunctions.serverTimestamp:", typeof firestoreFunctions.serverTimestamp);
    return true;
}

// --- AUTHENTICATION FUNCTIONS ---

/**
 * Updates the text and state of the Google authentication button.
 * @param {boolean} isSignedIn - True if the user is signed in, false otherwise.
 */
function updateAuthButtonText(isSignedIn) {
    if (googleAuthBtn) {
        if (isSignedIn) {
            googleAuthBtn.textContent = 'Sign Out';
            googleAuthBtn.removeEventListener('click', handleSignIn);
            googleAuthBtn.addEventListener('click', handleSignOut);
            googleAuthBtn.disabled = false; // Enable sign out button
            googleAuthBtn.classList.remove('secondary-button-bg', 'secondary-button-hover-bg'); // Remove disabled styling
            googleAuthBtn.classList.add('google-auth-btn'); // Ensure correct styling
            console.log("[Auth UI] Auth button text updated to: Sign Out");
        } else {
            googleAuthBtn.textContent = 'Sign In';
            googleAuthBtn.removeEventListener('click', handleSignOut);
            googleAuthBtn.addEventListener('click', handleSignIn);
            googleAuthBtn.disabled = false; // Enable sign in button
            googleAuthBtn.classList.add('google-auth-btn'); // Ensure correct styling
            console.log("[Auth UI] Auth button text updated to: Sign In");
        }
    } else {
        console.warn("[Auth UI] Google Auth Button not found.");
    }
}

/**
 * Updates the state (enabled/disabled) of main interactive buttons in the UI.
 * @param {boolean} enable - True to enable buttons, false to disable.
 */
function updateMainButtonsState(enable) {
    const buttonsToControl = [
        addShareHeaderBtn, newShareBtn, standardCalcBtn, dividendCalcBtn,
        addWatchlistBtn, editWatchlistBtn, exportWatchlistBtn
    ];

    buttonsToControl.forEach(button => {
        if (button) {
            button.disabled = !enable;
            if (enable) {
                button.classList.remove('is-disabled-icon');
            } else {
                button.classList.add('is-disabled-icon');
            }
        }
    });

    if (sortSelect) {
        sortSelect.disabled = !enable;
        console.log("[UI State] Sort Select Disabled:", !enable);
    }
    if (watchlistSelect) {
        watchlistSelect.disabled = !enable;
        console.log("[UI State] Watchlist Select Disabled:", !enable);
    }
    // Logout button is enabled only when signed in, handled by auth state listener
    if (logoutBtn) {
        logoutBtn.classList.toggle('is-disabled-icon', !enable);
    }

    console.log("[UI State] Setting main buttons state to:", enable ? "ENABLED" : "DISABLED");
}

/**
 * Handles Google Sign-In using a popup.
 */
async function handleSignIn() {
    if (!authFunctions || !authFunctions.GoogleAuthProviderInstance || !authFunctions.signInWithPopup) {
        console.error("[Auth] Firebase Auth functions not available for sign-in.");
        showCustomDialog("Authentication services are not available. Please try again later.", "Error", null, true);
        return;
    }
    try {
        // Show loading indicator before starting sign-in process
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        googleAuthBtn.disabled = true; // Disable button during sign-in

        const provider = authFunctions.GoogleAuthProviderInstance;
        await authFunctions.signInWithPopup(auth, provider);
        // onAuthStateChanged listener will handle UI updates
        console.log("[Auth] Google Sign-In initiated.");
    } catch (error) {
        console.error("Error during Google Sign-In:", error);
        let errorMessage = "Failed to sign in with Google. Please try again.";
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = "Sign-in cancelled. The pop-up window was closed.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = "Sign-in cancelled. A pop-up was already open or blocked.";
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = "Network error. Please check your internet connection.";
        }
        showCustomDialog(errorMessage, "Sign-In Error", null, true);
    } finally {
        // Hide loading indicator after sign-in attempt
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        googleAuthBtn.disabled = false; // Re-enable button
    }
}

/**
 * Handles user sign-out.
 */
async function handleSignOut() {
    if (!authFunctions || !authFunctions.signOut) {
        console.error("[Auth] Firebase Auth functions not available for sign-out.");
        showCustomDialog("Authentication services are not available. Cannot sign out.", "Error", null, true);
        return;
    }
    try {
        await authFunctions.signOut(auth);
        // onAuthStateChanged listener will handle UI updates
        console.log("[Auth] User signed out.");
    } catch (error) {
        console.error("Error during sign out:", error);
        showCustomDialog("Failed to sign out. Please try again.", "Sign-Out Error", null, true);
    }
}

// --- FIREBASE DATA OPERATIONS ---

/**
 * Authenticates the user anonymously or with a custom token if available.
 * This is crucial for Firestore security rules to work.
 */
async function authenticateUser() {
    if (!authFunctions || !auth) {
        console.error("[Auth] Firebase Auth object or functions not available for authentication.");
        return;
    }

    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
            await authFunctions.signInWithCustomToken(auth, __initial_auth_token);
            console.log("[Auth] Signed in with custom token.");
        } catch (error) {
            console.error("[Auth] Error signing in with custom token:", error);
            // Fallback to anonymous sign-in if custom token fails
            await authFunctions.signInAnonymously(auth);
            console.log("[Auth] Signed in anonymously as fallback.");
        }
    } else {
        await authFunctions.signInAnonymously(auth);
        console.log("[Auth] Signed in anonymously (no custom token provided).");
    }
}

/**
 * Fetches and displays shares from Firestore for the current user and selected watchlists.
 * Sets up a real-time listener using onSnapshot.
 */
function listenForShares() {
    if (!db || !firestoreFunctions || !currentUserId) {
        console.error("[Firestore] Firestore DB, functions, or userId not available. Cannot listen for shares.");
        return;
    }

    // Unsubscribe from previous listener if it exists
    if (unsubscribeShares) {
        unsubscribeShares();
        unsubscribeShares = null;
        console.log("[Firestore Listener] Unsubscribed from previous shares listener.");
    }

    console.log(`[Firestore Listener] Setting up listener for user: ${currentUserId}, watchlists: ${currentSelectedWatchlistIds.join(', ')}`);

    // Base collection reference for public shares
    let sharesCollectionRef = firestoreFunctions.collection(db, `artifacts/${currentAppId}/public/data/shares`);

    // Build the query based on selected watchlists
    let q;
    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        // If "All Shares" is selected, fetch all shares for the user
        q = firestoreFunctions.query(sharesCollectionRef, firestoreFunctions.where("userId", "==", currentUserId));
    } else if (currentSelectedWatchlistIds.length > 0) {
        // If specific watchlists are selected, filter by those watchlist IDs
        q = firestoreFunctions.query(sharesCollectionRef,
            firestoreFunctions.where("userId", "==", currentUserId),
            firestoreFunctions.where("watchlistIds", "array-contains-any", currentSelectedWatchlistIds)
        );
    } else {
        // If no watchlists are selected (e.g., after deleting the last one),
        // we should display an empty list. No query needed, just clear.
        clearShareList();
        clearWatchlistUI();
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        return;
    }

    // Show loading indicator before fetching
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    unsubscribeShares = firestoreFunctions.onSnapshot(q, (snapshot) => {
        allSharesData = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            allSharesData.push({ id: doc.id, ...data });
        });
        console.log("[Firestore Listener] Shares data updated.");
        renderShares(); // Re-render shares whenever data changes
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }, (error) => {
        console.error("[Firestore Listener] Error fetching shares:", error);
        showCustomDialog("Failed to load shares. Please check your internet connection or try again.", "Data Error", null, true);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    });
}

/**
 * Fetches and displays watchlists from Firestore for the current user.
 * Sets up a real-time listener using onSnapshot.
 */
function listenForWatchlists() {
    if (!db || !firestoreFunctions || !currentUserId) {
        console.error("[Firestore] Firestore DB, functions, or userId not available. Cannot listen for watchlists.");
        return;
    }

    // Unsubscribe from previous listener if it exists
    if (unsubscribeWatchlists) {
        unsubscribeWatchlists();
        unsubscribeWatchlists = null;
        console.log("[Firestore Listener] Unsubscribed from previous watchlists listener.");
    }

    console.log(`[Firestore Listener] Setting up listener for watchlists for user: ${currentUserId}`);

    const q = firestoreFunctions.query(
        firestoreFunctions.collection(db, `artifacts/${currentAppId}/public/data/watchlists`),
        firestoreFunctions.where("userId", "==", currentUserId)
    );

    unsubscribeWatchlists = firestoreFunctions.onSnapshot(q, (snapshot) => {
        userWatchlists = [];
        snapshot.forEach((doc) => {
            userWatchlists.push({ id: doc.id, ...doc.data() });
        });
        console.log("[Firestore Listener] Watchlists data updated.");
        // Ensure the default watchlist exists for new users or if it was deleted
        ensureDefaultWatchlistExists();
        populateWatchlistSelect(); // Re-populate dropdown whenever watchlists change
        // Re-evaluate currentSelectedWatchlistIds based on updated userWatchlists
        const defaultWatchlist = userWatchlists.find(wl => wl.name === DEFAULT_WATCHLIST_NAME);
        if (defaultWatchlist && currentSelectedWatchlistIds.length === 0) {
            // If no watchlists were selected previously, default to the default watchlist
            currentSelectedWatchlistIds = [defaultWatchlist.id];
            watchlistSelect.value = defaultWatchlist.id;
        } else if (currentSelectedWatchlistIds.length > 0) {
            // Filter out any selected watchlist IDs that no longer exist
            currentSelectedWatchlistIds = currentSelectedWatchlistIds.filter(id =>
                id === ALL_SHARES_ID || userWatchlists.some(wl => wl.id === id)
            );
            if (currentSelectedWatchlistIds.length === 0 && defaultWatchlist) {
                currentSelectedWatchlistIds = [defaultWatchlist.id];
                watchlistSelect.value = defaultWatchlist.id;
            } else if (currentSelectedWatchlistIds.length === 0 && !defaultWatchlist) {
                // If no default and no other watchlists, clear selection
                watchlistSelect.value = '';
            } else if (!currentSelectedWatchlistIds.includes(watchlistSelect.value) && watchlistSelect.value !== ALL_SHARES_ID) {
                // If the previously selected watchlist is no longer in the list,
                // try to select the first available watchlist or 'All Shares'
                if (watchlistSelect.options.length > 0) {
                    watchlistSelect.value = watchlistSelect.options[0].value;
                    if (watchlistSelect.value !== ALL_SHARES_ID && !userWatchlists.some(wl => wl.id === watchlistSelect.value)) {
                         watchlistSelect.value = userWatchlists.length > 0 ? userWatchlists[0].id : ALL_SHARES_ID;
                    }
                } else {
                    watchlistSelect.value = ''; // No options left
                }
            }
        } else if (defaultWatchlist && !currentSelectedWatchlistIds.includes(defaultWatchlist.id)) {
             // If default watchlist exists but isn't selected, select it
             currentSelectedWatchlistIds = [defaultWatchlist.id];
             watchlistSelect.value = defaultWatchlist.id;
        }

        listenForShares(); // Re-fetch shares based on potentially updated watchlist selection
    }, (error) => {
        console.error("[Firestore Listener] Error fetching watchlists:", error);
        showCustomDialog("Failed to load watchlists. Please check your internet connection or try again.", "Data Error", null, true);
    });
}

/**
 * Ensures a default watchlist exists for the current user. Creates one if it doesn't.
 */
async function ensureDefaultWatchlistExists() {
    if (!currentUserId || !firestoreFunctions || !db) {
        console.error("[Firestore] Cannot ensure default watchlist: missing userId or Firestore functions.");
        return;
    }

    const defaultWatchlist = userWatchlists.find(wl => wl.name === DEFAULT_WATCHLIST_NAME);

    if (!defaultWatchlist) {
        console.log("[Firestore] Default watchlist not found. Creating a new one...");
        try {
            const newDocRef = await firestoreFunctions.addDoc(
                firestoreFunctions.collection(db, `artifacts/${currentAppId}/public/data/watchlists`),
                {
                    name: DEFAULT_WATCHLIST_NAME,
                    userId: currentUserId,
                    createdAt: firestoreFunctions.serverTimestamp() // Use server timestamp
                }
            );
            console.log("[Firestore] Default watchlist created with ID:", newDocRef.id);
            // The onSnapshot listener will automatically update userWatchlists and re-render
        } catch (error) {
            console.error("[Firestore] Error creating default watchlist:", error);
            showCustomDialog("Failed to create default watchlist.", "Error", null, true);
        }
    } else {
        console.log("[Firestore] Default watchlist exists.");
    }
}

/**
 * Adds a new share or updates an existing one in Firestore.
 * @param {string|null} docId - The ID of the document to update, or null for a new document.
 * @param {Object} shareData - The data for the share.
 */
async function saveShare(docId, shareData) {
    if (!db || !firestoreFunctions || !currentUserId) {
        console.error("[Firestore] Firestore DB, functions, or userId not available. Cannot save share.");
        showCustomDialog("Cannot save share: authentication or database not ready.", "Error", null, true);
        return;
    }

    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        shareData.userId = currentUserId; // Ensure userId is always attached

        // Ensure watchlistIds array is present and valid
        if (!Array.isArray(shareData.watchlistIds) || shareData.watchlistIds.length === 0) {
            // Default to the user's default watchlist if none specified
            const defaultWatchlist = userWatchlists.find(wl => wl.name === DEFAULT_WATCHLIST_NAME);
            if (defaultWatchlist) {
                shareData.watchlistIds = [defaultWatchlist.id];
            } else {
                console.warn("[Firestore] No watchlist specified and default watchlist not found. Share will be saved without a watchlist association.");
                shareData.watchlistIds = []; // Ensure it's an empty array if no default
            }
        }

        if (docId) {
            // Update existing document
            const shareRef = firestoreFunctions.doc(db, `artifacts/${currentAppId}/public/data/shares`, docId);
            await firestoreFunctions.setDoc(shareRef, {
                ...shareData,
                updatedAt: firestoreFunctions.serverTimestamp() // Update timestamp
            }, { merge: true }); // Use merge to only update specified fields
            console.log("[Firestore] Share updated successfully:", docId);
            showCustomDialog("Share updated successfully!", "Success", 2000);
        } else {
            // Add new document
            const newDocRef = await firestoreFunctions.addDoc(
                firestoreFunctions.collection(db, `artifacts/${currentAppId}/public/data/shares`),
                {
                    ...shareData,
                    entryDate: firestoreFunctions.serverTimestamp(), // Set entry date for new shares
                    createdAt: firestoreFunctions.serverTimestamp() // Set creation timestamp
                }
            );
            console.log("[Firestore] Share added successfully with ID:", newDocRef.id);
            showCustomDialog("Share added successfully!", "Success", 2000);
        }
        closeModal(shareFormModal);
    } catch (error) {
        console.error("Error saving share:", error);
        showCustomDialog("Failed to save share. Please try again.", "Error", null, true);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Deletes a share from Firestore.
 * @param {string} docId - The ID of the document to delete.
 */
async function deleteShare(docId) {
    if (!db || !firestoreFunctions) {
        console.error("[Firestore] Firestore DB or functions not available. Cannot delete share.");
        showCustomDialog("Cannot delete share: database not ready.", "Error", null, true);
        return;
    }

    // Confirm deletion with the user
    const confirmed = await showCustomDialog("Are you sure you want to delete this share?", "Confirm Deletion", true);
    if (!confirmed) {
        console.log("[Firestore] Share deletion cancelled by user.");
        return;
    }

    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        const shareRef = firestoreFunctions.doc(db, `artifacts/${currentAppId}/public/data/shares`, docId);
        await firestoreFunctions.deleteDoc(shareRef);
        console.log("[Firestore] Share deleted successfully:", docId);
        showCustomDialog("Share deleted successfully!", "Success", 2000);
        closeModal(shareFormModal); // Close form if open
        closeModal(shareDetailModal); // Close detail if open
        selectedShareDocId = null; // Clear selected share
    } catch (error) {
        console.error("Error deleting share:", error);
        showCustomDialog("Failed to delete share. Please try again.", "Error", null, true);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Adds a new watchlist to Firestore.
 * @param {string} watchlistName - The name of the new watchlist.
 */
async function addWatchlist(watchlistName) {
    if (!db || !firestoreFunctions || !currentUserId) {
        console.error("[Firestore] Firestore DB, functions, or userId not available. Cannot add watchlist.");
        showCustomDialog("Cannot add watchlist: authentication or database not ready.", "Error", null, true);
        return;
    }

    if (!watchlistName.trim()) {
        showCustomDialog("Watchlist name cannot be empty.", "Input Error", null, true);
        return;
    }

    // Check for duplicate watchlist names
    const isDuplicate = userWatchlists.some(wl => wl.name.toLowerCase() === watchlistName.trim().toLowerCase());
    if (isDuplicate) {
        showCustomDialog(`A watchlist named "${watchlistName.trim()}" already exists.`, "Duplicate Name", null, true);
        return;
    }

    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        const newDocRef = await firestoreFunctions.addDoc(
            firestoreFunctions.collection(db, `artifacts/${currentAppId}/public/data/watchlists`),
            {
                name: watchlistName.trim(),
                userId: currentUserId,
                createdAt: firestoreFunctions.serverTimestamp()
            }
        );
        console.log("[Firestore] Watchlist added successfully with ID:", newDocRef.id);
        showCustomDialog("Watchlist added successfully!", "Success", 2000);
        closeModal(addWatchlistModal);
        newWatchlistNameInput.value = ''; // Clear input
        // The onSnapshot listener will automatically update userWatchlists and re-render
    } catch (error) {
        console.error("Error adding watchlist:", error);
        showCustomDialog("Failed to add watchlist. Please try again.", "Error", null, true);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Updates an existing watchlist's name in Firestore.
 * @param {string} watchlistId - The ID of the watchlist to update.
 * @param {string} newName - The new name for the watchlist.
 */
async function updateWatchlistName(watchlistId, newName) {
    if (!db || !firestoreFunctions || !currentUserId) {
        console.error("[Firestore] Firestore DB, functions, or userId not available. Cannot update watchlist.");
        showCustomDialog("Cannot update watchlist: authentication or database not ready.", "Error", null, true);
        return;
    }

    if (!newName.trim()) {
        showCustomDialog("Watchlist name cannot be empty.", "Input Error", null, true);
        return;
    }

    // Prevent renaming the default watchlist
    const currentWatchlist = userWatchlists.find(wl => wl.id === watchlistId);
    if (currentWatchlist && currentWatchlist.name === DEFAULT_WATCHLIST_NAME) {
        showCustomDialog("The default watchlist cannot be renamed.", "Action Not Allowed", null, true);
        return;
    }

    // Check for duplicate watchlist names (excluding the current watchlist itself)
    const isDuplicate = userWatchlists.some(wl =>
        wl.id !== watchlistId && wl.name.toLowerCase() === newName.trim().toLowerCase()
    );
    if (isDuplicate) {
        showCustomDialog(`A watchlist named "${newName.trim()}" already exists.`, "Duplicate Name", null, true);
        return;
    }

    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        const watchlistRef = firestoreFunctions.doc(db, `artifacts/${currentAppId}/public/data/watchlists`, watchlistId);
        await firestoreFunctions.updateDoc(watchlistRef, {
            name: newName.trim(),
            updatedAt: firestoreFunctions.serverTimestamp()
        });
        console.log("[Firestore] Watchlist updated successfully:", watchlistId);
        showCustomDialog("Watchlist updated successfully!", "Success", 2000);
        closeModal(manageWatchlistModal);
        // The onSnapshot listener will automatically update userWatchlists and re-render
    } catch (error) {
        console.error("Error updating watchlist:", error);
        showCustomDialog("Failed to update watchlist. Please try again.", "Error", null, true);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Deletes a watchlist from Firestore and reassigns its shares to the default watchlist.
 * @param {string} watchlistId - The ID of the watchlist to delete.
 */
async function deleteWatchlist(watchlistId) {
    if (!db || !firestoreFunctions || !currentUserId) {
        console.error("[Firestore] Firestore DB, functions, or userId not available. Cannot delete watchlist.");
        showCustomDialog("Cannot delete watchlist: authentication or database not ready.", "Error", null, true);
        return;
    }

    const watchlistToDelete = userWatchlists.find(wl => wl.id === watchlistId);
    if (!watchlistToDelete) {
        console.error("[Firestore] Watchlist not found for deletion:", watchlistId);
        showCustomDialog("Watchlist not found.", "Error", null, true);
        return;
    }

    // Prevent deleting the default watchlist
    if (watchlistToDelete.name === DEFAULT_WATCHLIST_NAME) {
        showCustomDialog("The default watchlist cannot be deleted.", "Action Not Allowed", null, true);
        return;
    }

    const confirmed = await showCustomDialog(`Are you sure you want to delete the watchlist "${watchlistToDelete.name}"? Shares in this watchlist will be moved to "${DEFAULT_WATCHLIST_NAME}".`, "Confirm Deletion", true);
    if (!confirmed) {
        console.log("[Firestore] Watchlist deletion cancelled by user.");
        return;
    }

    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        const batch = firestoreFunctions.writeBatch(db);

        // 1. Find the default watchlist ID
        const defaultWatchlist = userWatchlists.find(wl => wl.name === DEFAULT_WATCHLIST_NAME);
        if (!defaultWatchlist) {
            showCustomDialog("Default watchlist not found. Cannot reassign shares.", "Error", null, true);
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            return;
        }
        const defaultWatchlistId = defaultWatchlist.id;

        // 2. Find all shares associated with the watchlist being deleted
        const sharesQuery = firestoreFunctions.query(
            firestoreFunctions.collection(db, `artifacts/${currentAppId}/public/data/shares`),
            firestoreFunctions.where("userId", "==", currentUserId),
            firestoreFunctions.where("watchlistIds", "array-contains", watchlistId)
        );
        const sharesSnapshot = await firestoreFunctions.getDocs(sharesQuery);

        // 3. Update shares to remove the deleted watchlist ID and add default watchlist ID
        sharesSnapshot.forEach((shareDoc) => {
            const currentWatchlistIds = shareDoc.data().watchlistIds || [];
            const updatedWatchlistIds = currentWatchlistIds.filter(id => id !== watchlistId);

            // Ensure the share is added to the default watchlist if it's not already there
            if (!updatedWatchlistIds.includes(defaultWatchlistId)) {
                updatedWatchlistIds.push(defaultWatchlistId);
            }

            batch.update(shareDoc.ref, { watchlistIds: updatedWatchlistIds });
        });

        // 4. Delete the watchlist document
        const watchlistRef = firestoreFunctions.doc(db, `artifacts/${currentAppId}/public/data/watchlists`, watchlistId);
        batch.delete(watchlistRef);

        // Commit the batch
        await batch.commit();
        console.log("[Firestore] Watchlist and associated shares updated successfully.");
        showCustomDialog(`Watchlist "${watchlistToDelete.name}" deleted. Shares moved to "${DEFAULT_WATCHLIST_NAME}".`, "Success", 3000);
        closeModal(manageWatchlistModal);
        // The onSnapshot listeners will automatically update UI
    } catch (error) {
        console.error("Error deleting watchlist and reassigning shares:", error);
        showCustomDialog("Failed to delete watchlist. Please try again.", "Error", null, true);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// --- UI RENDERING FUNCTIONS ---

/**
 * Populates the watchlist select dropdown with user's watchlists.
 */
function populateWatchlistSelect() {
    if (!watchlistSelect) {
        console.error("[UI] Watchlist select element not found.");
        return;
    }

    watchlistSelect.innerHTML = ''; // Clear existing options

    // Add "All Shares" option
    const allSharesOption = document.createElement('option');
    allSharesOption.value = ALL_SHARES_ID;
    allSharesOption.textContent = 'All Shares';
    watchlistSelect.appendChild(allSharesOption);

    // Add user-defined watchlists
    userWatchlists.forEach(watchlist => {
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        watchlistSelect.appendChild(option);
    });

    // Set the selected value based on currentSelectedWatchlistIds
    // If 'All Shares' is selected or no specific watchlist is active
    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID) || currentSelectedWatchlistIds.length === 0) {
        watchlistSelect.value = ALL_SHARES_ID;
    } else if (currentSelectedWatchlistIds.length === 1) {
        // If only one specific watchlist is selected, try to set it
        const selectedId = currentSelectedWatchlistIds[0];
        const optionExists = Array.from(watchlistSelect.options).some(option => option.value === selectedId);
        if (optionExists) {
            watchlistSelect.value = selectedId;
        } else {
            // Fallback if the selected watchlist no longer exists (e.g., deleted by another device)
            watchlistSelect.value = ALL_SHARES_ID;
            currentSelectedWatchlistIds = [ALL_SHARES_ID];
            listenForShares(); // Re-trigger share fetch for 'All Shares'
        }
    } else {
        // If multiple watchlists are theoretically selected, default to 'All Shares' for display
        // (as the dropdown only supports single selection)
        watchlistSelect.value = ALL_SHARES_ID;
        currentSelectedWatchlistIds = [ALL_SHARES_ID];
        listenForShares(); // Re-trigger share fetch for 'All Shares'
    }
    console.log("[UI] Watchlist select populated. Current selection:", watchlistSelect.value);
}

/**
 * Renders the shares data into the table and mobile cards.
 */
function renderShares() {
    clearShareList(); // Clear existing UI before rendering

    // Sort the data based on currentSortOrder
    const [sortBy, sortDirection] = currentSortOrder.split('-');
    const sortedShares = [...allSharesData].sort((a, b) => {
        let valA, valB;

        if (sortBy === 'shareName') {
            valA = a.shareName ? a.shareName.toLowerCase() : '';
            valB = b.shareName ? b.shareName.toLowerCase() : '';
        } else if (sortBy === 'dividendAmount') {
            valA = parseFloat(a.dividendAmount || 0);
            valB = parseFloat(b.dividendAmount || 0);
        } else if (sortBy === 'entryDate') {
            // Convert Firestore Timestamps to milliseconds for comparison
            valA = a.entryDate ? a.entryDate.toMillis() : 0;
            valB = b.entryDate ? b.entryDate.toMillis() : 0;
        } else {
            return 0; // No sorting
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    if (sortedShares.length === 0) {
        shareTableBody.innerHTML = '<tr><td colspan="5" class="no-shares-message">No shares to display. Add a new share to get started!</td></tr>';
        mobileShareCardsContainer.innerHTML = '<div class="mobile-card no-shares-message">No shares to display. Add a new share to get started!</div>';
        return;
    }

    sortedShares.forEach(share => {
        const unfrankedYield = calculateUnfrankedYield(share.currentPrice, share.dividendAmount);
        const frankedYield = calculateFrankedYield(share.currentPrice, share.dividendAmount, share.frankingCredits);

        // Render for table (desktop)
        const row = shareTableBody.insertRow();
        row.dataset.shareId = share.id; // Store share ID on the row
        row.innerHTML = `
            <td>${share.shareName || 'N/A'}</td>
            <td>${formatCurrency(share.currentPrice)}</td>
            <td>${formatCurrency(share.targetPrice)}</td>
            <td>${formatCurrency(share.dividendAmount)} (${formatPercentage(unfrankedYield)} Unfranked, ${formatPercentage(frankedYield)} Franked)</td>
            <td>${share.comments && share.comments.length > 0 ? share.comments.length + ' comments' : 'No comments'}</td>
        `;
        row.addEventListener('click', () => handleShareRowClick(share.id));
        row.addEventListener('contextmenu', (e) => handleContextMenu(e, share.id));
        row.addEventListener('touchstart', (e) => handleTouchStart(e, share.id));
        row.addEventListener('touchmove', handleTouchMove);
        row.addEventListener('touchend', handleTouchEnd);


        // Render for mobile cards
        const mobileCard = document.createElement('div');
        mobileCard.classList.add('mobile-card');
        mobileCard.dataset.shareId = share.id; // Store share ID on the card
        mobileCard.innerHTML = `
            <h3>${share.shareName || 'N/A'}</h3>
            <p><strong>Entered Price:</strong> ${formatCurrency(share.currentPrice)}</p>
            <p><strong>Target Price:</strong> ${formatCurrency(share.targetPrice)}</p>
            <p><strong>Dividends:</strong> ${formatCurrency(share.dividendAmount)} (${formatPercentage(unfrankedYield)} Unfranked, ${formatPercentage(frankedYield)} Franked)</p>
            <p><strong>Comments:</strong> ${share.comments && share.comments.length > 0 ? share.comments.length + ' comments' : 'No comments'}</p>
        `;
        mobileCard.addEventListener('click', () => handleShareRowClick(share.id));
        mobileCard.addEventListener('contextmenu', (e) => handleContextMenu(e, share.id));
        mobileCard.addEventListener('touchstart', (e) => handleTouchStart(e, share.id));
        mobileCard.addEventListener('touchmove', handleTouchMove);
        mobileCard.addEventListener('touchend', handleTouchEnd);
        mobileShareCardsContainer.appendChild(mobileCard);
    });

    // Highlight the selected row/card if one exists
    if (selectedShareDocId) {
        const selectedRow = shareTableBody.querySelector(`tr[data-share-id="${selectedShareDocId}"]`);
        if (selectedRow) selectedRow.classList.add('selected');
        const selectedCard = mobileShareCardsContainer.querySelector(`.mobile-card[data-share-id="${selectedShareDocId}"]`);
        if (selectedCard) selectedCard.classList.add('selected');
    }
}

/**
 * Clears all rows from the share table body and mobile cards.
 */
function clearShareList() {
    if (shareTableBody) shareTableBody.innerHTML = '';
    if (mobileShareCardsContainer) mobileShareCardsContainer.innerHTML = '';
}

/**
 * Clears any selected state from share table rows and mobile cards.
 */
function clearWatchlistUI() {
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
}

/**
 * Populates the share form modal with data for editing, or clears it for a new share.
 * @param {Object|null} share - The share object to edit, or null for a new share.
 */
function populateShareForm(share = null) {
    if (!shareFormTitle || !shareNameInput || !currentPriceInput || !targetPriceInput || !dividendAmountInput || !frankingCreditsInput || !commentsFormContainer || !deleteShareBtn) {
        console.error("[UI] Share form elements not found.");
        return;
    }

    selectedShareDocId = share ? share.id : null; // Set the global selected ID

    if (share) {
        shareFormTitle.textContent = 'Edit Share';
        shareNameInput.value = share.shareName || '';
        currentPriceInput.value = share.currentPrice || '';
        targetPriceInput.value = share.targetPrice || '';
        dividendAmountInput.value = share.dividendAmount || '';
        frankingCreditsInput.value = share.frankingCredits || '';
        deleteShareBtn.classList.remove('hidden'); // Show delete button for existing shares
        renderCommentsForm(share.comments || []); // Populate comments
    } else {
        shareFormTitle.textContent = 'Add New Share';
        shareNameInput.value = '';
        currentPriceInput.value = '';
        targetPriceInput.value = '';
        dividendAmountInput.value = '';
        frankingCreditsInput.value = '';
        deleteShareBtn.classList.add('hidden'); // Hide delete button for new shares
        renderCommentsForm([]); // Start with one empty comment section for new shares
    }
}

/**
 * Renders the comments section in the share form.
 * @param {Array} comments - An array of comment objects {title, text}.
 */
function renderCommentsForm(comments) {
    commentsFormContainer.querySelectorAll('.comment-section').forEach(section => section.remove()); // Clear existing
    const addCommentButton = commentsFormContainer.querySelector('#addCommentSectionBtn'); // Get the plus icon
    if (addCommentButton) {
        addCommentButton.closest('h3').insertAdjacentHTML('afterend', '<div id="commentsContainerPlaceholder"></div>'); // Insert a placeholder div
    } else {
        commentsFormContainer.innerHTML += '<div id="commentsContainerPlaceholder"></div>'; // Fallback if h3 not found
    }
    const placeholder = commentsFormContainer.querySelector('#commentsContainerPlaceholder');

    if (comments.length === 0) {
        comments.push({ title: '', text: '' }); // Add one empty comment section if none exist
    }

    comments.forEach((comment, index) => {
        const commentSection = document.createElement('div');
        commentSection.classList.add('comment-section');
        commentSection.innerHTML = `
            <div class="comment-section-header">
                <input type="text" class="comment-title-input" placeholder="Comment Title" value="${escapeHTML(comment.title || '')}">
                <span class="comment-delete-btn" data-index="${index}"><i class="fas fa-times-circle"></i></span>
            </div>
            <textarea class="comment-text-input" placeholder="Your comment...">${escapeHTML(comment.text || '')}</textarea>
        `;
        placeholder.appendChild(commentSection);
    });

    // Add event listeners for delete buttons
    commentsFormContainer.querySelectorAll('.comment-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sectionToRemove = e.target.closest('.comment-section');
            if (sectionToRemove) {
                sectionToRemove.remove();
            }
        });
    });
}

/**
 * Gathers comment data from the form.
 * @returns {Array} An array of comment objects {title, text}.
 */
function getCommentsFromForm() {
    const comments = [];
    commentsFormContainer.querySelectorAll('.comment-section').forEach(section => {
        const titleInput = section.querySelector('.comment-title-input');
        const textInput = section.querySelector('.comment-text-input');
        if (titleInput && textInput) {
            const title = titleInput.value.trim();
            const text = textInput.value.trim();
            if (title || text) { // Only add if either title or text is present
                comments.push({ title, text });
            }
        }
    });
    return comments;
}

/**
 * Displays share details in the modal.
 * @param {Object} share - The share object to display.
 */
function displayShareDetails(share) {
    if (!modalShareName || !modalEntryDate || !modalEnteredPrice || !modalTargetPrice || !modalDividendAmount || !modalFrankingCredits || !modalUnfrankedYield || !modalFrankedYield || !modalMarketIndexLink || !modalFoolLink || !modalCommSecLink || !modalNewsLink || !modalCommentsContainer) {
        console.error("[UI] Share detail modal elements not found.");
        return;
    }

    selectedShareDocId = share.id; // Set the global selected ID

    // Highlight the selected row/card
    clearWatchlistUI();
    const selectedRow = shareTableBody.querySelector(`tr[data-share-id="${share.id}"]`);
    if (selectedRow) selectedRow.classList.add('selected');
    const selectedCard = mobileShareCardsContainer.querySelector(`.mobile-card[data-share-id="${share.id}"]`);
    if (selectedCard) selectedCard.classList.add('selected');

    modalShareName.textContent = share.shareName || 'N/A';
    modalEntryDate.textContent = share.entryDate ? formatDate(share.entryDate) : 'N/A';
    modalEnteredPrice.textContent = formatCurrency(share.currentPrice);
    modalTargetPrice.textContent = formatCurrency(share.targetPrice);
    modalDividendAmount.textContent = formatCurrency(share.dividendAmount);
    modalFrankingCredits.textContent = formatPercentage(share.frankingCredits);

    const unfrankedYield = calculateUnfrankedYield(share.currentPrice, share.dividendAmount);
    const frankedYield = calculateFrankedYield(share.currentPrice, share.dividendAmount, share.frankingCredits);
    modalUnfrankedYield.textContent = formatPercentage(unfrankedYield);
    modalFrankedYield.textContent = formatPercentage(frankedYield);

    // Set external links
    const encodedShareName = encodeURIComponent(share.shareName);
    modalNewsLink.href = `https://www.google.com/search?q=${encodedShareName}+ASX+news`;
    modalMarketIndexLink.href = `https://www.marketindex.com.au/asx/${encodedShareName}`;
    modalFoolLink.href = `https://www.fool.com.au/quote/${encodedShareName}`;
    modalCommSecLink.href = `https://www.commsec.com.au/market-insights/company/${encodedShareName}`;

    // Display comments
    modalCommentsContainer.innerHTML = ''; // Clear previous comments
    if (share.comments && share.comments.length > 0) {
        share.comments.forEach(comment => {
            const commentItem = document.createElement('div');
            commentItem.classList.add('modal-comment-item');
            commentItem.innerHTML = `
                <strong>${escapeHTML(comment.title || 'No Title')}</strong>
                <p>${escapeHTML(comment.text || 'No content.')}</p>
            `;
            modalCommentsContainer.appendChild(commentItem);
        });
    } else {
        modalCommentsContainer.innerHTML = '<p class="ghosted-text">No comments for this share.</p>';
    }

    openModal(shareDetailModal);
}

/**
 * Populates the dividend calculator modal with share data if available.
 * @param {Object|null} share - The share object to pre-fill, or null to clear.
 */
function populateDividendCalculator(share = null) {
    if (!calcCurrentPriceInput || !calcDividendAmountInput || !calcFrankingCreditsInput) {
        console.error("[UI] Dividend calculator input elements not found.");
        return;
    }

    if (share) {
        calcCurrentPriceInput.value = share.currentPrice || '';
        calcDividendAmountInput.value = share.dividendAmount || '';
        calcFrankingCreditsInput.value = share.frankingCredits || '';
    } else {
        calcCurrentPriceInput.value = '';
        calcDividendAmountInput.value = '';
        calcFrankingCreditsInput.value = '';
    }
    updateDividendCalculatorResults(); // Calculate initial results
}

/**
 * Populates the manage watchlist modal with the selected watchlist's data.
 * @param {string} watchlistId - The ID of the watchlist to manage.
 */
function populateManageWatchlistModal(watchlistId) {
    const watchlist = userWatchlists.find(wl => wl.id === watchlistId);
    if (watchlist) {
        editWatchlistNameInput.value = watchlist.name;
        // Disable editing and deleting for the default watchlist
        const isDefault = (watchlist.name === DEFAULT_WATCHLIST_NAME);
        editWatchlistNameInput.disabled = isDefault;
        saveWatchlistNameBtn.classList.toggle('is-disabled-icon', isDefault);
        deleteWatchlistInModalBtn.classList.toggle('is-disabled-icon', isDefault);
        deleteWatchlistInModalBtn.dataset.watchlistId = watchlistId; // Store ID for deletion
        saveWatchlistNameBtn.dataset.watchlistId = watchlistId; // Store ID for saving
        openModal(manageWatchlistModal);
    } else {
        console.error("Watchlist not found for editing:", watchlistId);
        showCustomDialog("Watchlist not found.", "Error", null, true);
    }
}

/**
 * Generates and displays ASX code buttons based on the current shares data.
 */
function generateAsxCodeButtons() {
    if (!asxCodeButtonsContainer) {
        console.error("[UI] ASX code buttons container not found.");
        return;
    }

    asxCodeButtonsContainer.innerHTML = ''; // Clear existing buttons

    // Get unique ASX codes from all shares
    const uniqueAsxCodes = [...new Set(allSharesData.map(share => share.shareName).filter(name => name))].sort();

    // Add an "ALL" button
    const allButton = document.createElement('button');
    allButton.classList.add('asx-code-button');
    allButton.textContent = 'ALL';
    allButton.dataset.asxCode = 'ALL';
    allButton.addEventListener('click', () => filterSharesByAsxCode('ALL'));
    asxCodeButtonsContainer.appendChild(allButton);

    uniqueAsxCodes.forEach(code => {
        const button = document.createElement('button');
        button.classList.add('asx-code-button');
        button.textContent = code;
        button.dataset.asxCode = code;
        button.addEventListener('click', () => filterSharesByAsxCode(code));
        asxCodeButtonsContainer.appendChild(button);
    });

    // Ensure the 'ALL' button is active by default or the last selected one
    const activeAsxCode = asxCodeButtonsContainer.dataset.activeAsxCode || 'ALL';
    const currentActiveButton = asxCodeButtonsContainer.querySelector(`.asx-code-button[data-asx-code="${activeAsxCode}"]`);
    if (currentActiveButton) {
        currentActiveButton.classList.add('active');
    } else {
        // Fallback to 'ALL' if the previously active code no longer exists
        allButton.classList.add('active');
        asxCodeButtonsContainer.dataset.activeAsxCode = 'ALL';
    }
}

/**
 * Filters the displayed shares by the given ASX code.
 * @param {string} asxCode - The ASX code to filter by, or 'ALL'.
 */
function filterSharesByAsxCode(asxCode) {
    // Update active button state
    asxCodeButtonsContainer.querySelectorAll('.asx-code-button').forEach(button => {
        button.classList.remove('active');
    });
    const clickedButton = asxCodeButtonsContainer.querySelector(`.asx-code-button[data-asx-code="${asxCode}"]`);
    if (clickedButton) {
        clickedButton.classList.add('active');
        asxCodeButtonsContainer.dataset.activeAsxCode = asxCode; // Store active code
    }

    // Filter and re-render
    const filteredShares = asxCode === 'ALL' ? allSharesData :
        allSharesData.filter(share => share.shareName === asxCode);

    renderFilteredShares(filteredShares);
}

/**
 * Renders a filtered subset of shares into the table and mobile cards.
 * This is used by the ASX code buttons.
 * @param {Array} sharesToRender - The array of share objects to display.
 */
function renderFilteredShares(sharesToRender) {
    clearShareList(); // Clear existing UI before rendering

    // Sort the data based on currentSortOrder
    const [sortBy, sortDirection] = currentSortOrder.split('-');
    const sortedShares = [...sharesToRender].sort((a, b) => {
        let valA, valB;

        if (sortBy === 'shareName') {
            valA = a.shareName ? a.shareName.toLowerCase() : '' ;
            valB = b.shareName ? b.shareName.toLowerCase() : '' ;
        } else if (sortBy === 'dividendAmount') {
            valA = parseFloat(a.dividendAmount || 0);
            valB = parseFloat(b.dividendAmount || 0);
        } else if (sortBy === 'entryDate') {
            valA = a.entryDate ? a.entryDate.toMillis() : 0;
            valB = b.entryDate ? b.entryDate.toMillis() : 0;
        } else {
            return 0; // No sorting
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    if (sortedShares.length === 0) {
        shareTableBody.innerHTML = '<tr><td colspan="5" class="no-shares-message">No shares matching this filter.</td></tr>';
        mobileShareCardsContainer.innerHTML = '<div class="mobile-card no-shares-message">No shares matching this filter.</div>';
        return;
    }

    sortedShares.forEach(share => {
        const unfrankedYield = calculateUnfrankedYield(share.currentPrice, share.dividendAmount);
        const frankedYield = calculateFrankedYield(share.currentPrice, share.dividendAmount, share.frankingCredits);

        // Render for table (desktop)
        const row = shareTableBody.insertRow();
        row.dataset.shareId = share.id; // Store share ID on the row
        row.innerHTML = `
            <td>${share.shareName || 'N/A'}</td>
            <td>${formatCurrency(share.currentPrice)}</td>
            <td>${formatCurrency(share.targetPrice)}</td>
            <td>${formatCurrency(share.dividendAmount)} (${formatPercentage(unfrankedYield)} Unfranked, ${formatPercentage(frankedYield)} Franked)</td>
            <td>${share.comments && share.comments.length > 0 ? share.comments.length + ' comments' : 'No comments'}</td>
        `;
        row.addEventListener('click', () => handleShareRowClick(share.id));
        row.addEventListener('contextmenu', (e) => handleContextMenu(e, share.id));
        row.addEventListener('touchstart', (e) => handleTouchStart(e, share.id));
        row.addEventListener('touchmove', handleTouchMove);
        row.addEventListener('touchend', handleTouchEnd);


        // Render for mobile cards
        const mobileCard = document.createElement('div');
        mobileCard.classList.add('mobile-card');
        mobileCard.dataset.shareId = share.id; // Store share ID on the card
        mobileCard.innerHTML = `
            <h3>${share.shareName || 'N/A'}</h3>
            <p><strong>Entered Price:</strong> ${formatCurrency(share.currentPrice)}</p>
            <p><strong>Target Price:</strong> ${formatCurrency(share.targetPrice)}</p>
            <p><strong>Dividends:</strong> ${formatCurrency(share.dividendAmount)} (${formatPercentage(unfrankedYield)} Unfranked, ${formatPercentage(frankedYield)} Franked)</p>
            <p><strong>Comments:</strong> ${share.comments && share.comments.length > 0 ? share.comments.length + ' comments' : 'No comments'}</p>
        `;
        mobileCard.addEventListener('click', () => handleShareRowClick(share.id));
        mobileCard.addEventListener('contextmenu', (e) => handleContextMenu(e, share.id));
        mobileCard.addEventListener('touchstart', (e) => handleTouchStart(e, share.id));
        mobileCard.addEventListener('touchmove', handleTouchMove);
        mobileCard.addEventListener('touchend', handleTouchEnd);
        mobileShareCardsContainer.appendChild(mobileCard);
    });

    // Highlight the selected row/card if one exists
    if (selectedShareDocId) {
        const selectedRow = shareTableBody.querySelector(`tr[data-share-id="${selectedShareDocId}"]`);
        if (selectedRow) selectedRow.classList.add('selected');
        const selectedCard = mobileShareCardsContainer.querySelector(`.mobile-card[data-share-id="${selectedShareDocId}"]`);
        if (selectedCard) selectedCard.classList.add('selected');
    }
}


// --- MODAL & DIALOG FUNCTIONS ---

/**
 * Opens a given modal element.
 * @param {HTMLElement} modalElement - The modal DOM element to open.
 */
function openModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'flex'; // Use flex to center
        // Add a class to the body to prevent scrolling
        document.body.style.overflow = 'hidden';
        console.log(`[Modal] Opened: ${modalElement.id}`);
    }
}

/**
 * Closes a given modal element.
 * @param {HTMLElement} modalElement - The modal DOM element to close.
 */
function closeModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
        // Remove the class from the body to re-enable scrolling
        document.body.style.overflow = '';
        console.log(`[Modal] Closed: ${modalElement.id}`);
        // Clear selected share ID if the share detail/form modal is closed
        if (modalElement === shareDetailModal || modalElement === shareFormModal) {
            selectedShareDocId = null;
            clearWatchlistUI(); // Clear any highlighted rows/cards
        }
    }
}

/**
 * Displays a custom dialog message to the user.
 * @param {string} message - The message to display.
 * @param {string} type - 'Success', 'Error', 'Confirm', 'Info'. Affects behavior (auto-dismiss, buttons).
 * @param {number|null} [autoDismissTime=null] - Time in ms to auto-dismiss for 'Success'/'Info'.
 * @returns {Promise<boolean>} - Resolves with true for 'Confirm' if confirmed, false if cancelled.
 */
function showCustomDialog(message, type = 'Info', autoDismissTime = null, isError = false) {
    return new Promise((resolve) => {
        if (!customDialogModal || !customDialogMessage || !customDialogConfirmBtn || !customDialogCancelBtn) {
            console.error("[Dialog] Custom dialog elements not found. Falling back to alert/confirm.");
            if (type === 'Confirm') {
                resolve(confirm(message));
            } else {
                alert(message);
                resolve(false); // For non-confirm, just resolve false
            }
            return;
        }

        customDialogMessage.textContent = message;

        // Clear any previous auto-dismiss timeout
        if (autoDismissTimeout) {
            clearTimeout(autoDismissTimeout);
            autoDismissTimeout = null;
        }

        // Reset button visibility and event listeners
        customDialogConfirmBtn.style.display = 'inline-flex'; // Always show confirm for now
        customDialogCancelBtn.style.display = 'inline-flex'; // Always show cancel for now
        customDialogConfirmBtn.classList.remove('hidden');
        customDialogCancelBtn.classList.remove('hidden');

        customDialogConfirmBtn.removeEventListener('click', currentDialogCallback);
        customDialogCancelBtn.removeEventListener('click', currentDialogCallback);

        // Define callback based on type
        if (type === 'Confirm') {
            currentDialogCallback = (event) => {
                closeModal(customDialogModal);
                resolve(event.target.id === 'customDialogConfirmBtn');
            };
            customDialogConfirmBtn.addEventListener('click', currentDialogCallback);
            customDialogCancelBtn.addEventListener('click', currentDialogCallback);
        } else {
            // For 'Success', 'Error', 'Info'
            customDialogCancelBtn.classList.add('hidden'); // Hide cancel button
            if (type === 'Success' || !isError) { // Auto-dismiss for success and non-error info
                customDialogConfirmBtn.classList.remove('danger'); // Ensure not red
                currentDialogCallback = () => {
                    closeModal(customDialogModal);
                    resolve(true); // Resolve true as it's an acknowledgement
                };
                customDialogConfirmBtn.addEventListener('click', currentDialogCallback);
                if (autoDismissTime) {
                    autoDismissTimeout = setTimeout(currentDialogCallback, autoDismissTime);
                }
            } else { // It's an 'Error'
                customDialogConfirmBtn.classList.add('danger'); // Make button red for errors
                currentDialogCallback = () => {
                    closeModal(customDialogModal);
                    resolve(false); // Resolve false for errors, indicating a problem
                };
                customDialogConfirmBtn.addEventListener('click', currentDialogCallback);
            }
        }
        openModal(customDialogModal);
    });
}

// --- UTILITY FUNCTIONS ---

/**
 * Formats a number as currency (e.g., $25.50).
 * @param {number} value - The numeric value.
 * @returns {string} Formatted currency string.
 */
function formatCurrency(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return 'N/A';
    return num.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

/**
 * Formats a number as a percentage (e.g., 5.25%).
 * @param {number} value - The numeric value.
 * @returns {string} Formatted percentage string.
 */
function formatPercentage(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return 'N/A';
    return (num * 100).toFixed(2) + '%';
}

/**
 * Formats a Firestore Timestamp object or Date object into a readable date string.
 * @param {Object} timestamp - Firestore Timestamp object or Date object.
 * @returns {string} Formatted date string.
 */
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    let date;
    if (typeof timestamp.toDate === 'function') {
        // It's a Firestore Timestamp
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        // It's a JavaScript Date object
        date = timestamp;
    } else {
        // Try to parse if it's a string or number (less reliable)
        date = new Date(timestamp);
    }

    if (isNaN(date.getTime())) return 'Invalid Date'; // Check if date is valid

    return date.toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Calculates the unfranked dividend yield.
 * @param {number} currentPrice - The current share price.
 * @param {number} dividendAmount - The annual dividend amount per share.
 * @returns {number} The unfranked yield as a decimal.
 */
function calculateUnfrankedYield(currentPrice, dividendAmount) {
    const price = parseFloat(currentPrice);
    const dividend = parseFloat(dividendAmount);
    if (isNaN(price) || isNaN(dividend) || price <= 0) return 0;
    return (dividend / price);
}

/**
 * Calculates the franked dividend yield, considering franking credits.
 * @param {number} currentPrice - The current share price.
 * @param {number} dividendAmount - The annual dividend amount per share.
 * @param {number} frankingCredits - The percentage of franking credits (e.g., 70 for 70%).
 * @returns {number} The franked yield as a decimal.
 */
function calculateFrankedYield(currentPrice, dividendAmount, frankingCredits) {
    const unfranked = calculateUnfrankedYield(currentPrice, dividendAmount);
    const franking = parseFloat(frankingCredits) / 100; // Convert percentage to decimal
    if (isNaN(franking) || franking < 0 || franking > 1) return unfranked; // If invalid franking, return unfranked
    const taxRate = 0.30; // Assuming 30% company tax rate for franking calculation
    const grossedUpDividend = unfranked * (1 + (franking * (taxRate / (1 - taxRate))));
    return grossedUpDividend;
}

/**
 * Escapes HTML characters in a string to prevent XSS.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/**
 * Applies the selected theme to the body.
 * @param {string} themeName - The name of the theme (e.g., 'dark-theme', 'bold-1', 'system-default').
 */
function applyTheme(themeName) {
    const body = document.body;
    // Remove all existing theme classes
    body.className = ''; // Resets all classes
    body.classList.add('system-default'); // Always start with system-default as a base

    if (themeName === 'dark-theme') {
        body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark-theme');
        if (themeToggleBtn) themeToggleBtn.querySelector('span').textContent = 'Light Theme';
    } else if (themeName.startsWith('bold-') || themeName.startsWith('subtle-')) {
        body.classList.add(themeName);
        localStorage.setItem('theme', themeName);
        if (themeToggleBtn) themeToggleBtn.querySelector('span').textContent = 'Toggle Theme'; // Generic text
    } else {
        // 'system-default' or any other invalid theme
        localStorage.removeItem('theme'); // Clear stored theme
        if (themeToggleBtn) themeToggleBtn.querySelector('span').textContent = 'Dark Theme';
    }
    console.log("[Theme] Applied theme:", themeName);
    // Update the dropdown to reflect the current theme
    if (colorThemeSelect) {
        colorThemeSelect.value = themeName.replace('dark-theme', 'none'); // 'dark-theme' maps to 'none' in dropdown for simplicity
    }
}

/**
 * Toggles between light and dark theme.
 */
function toggleTheme() {
    const currentTheme = localStorage.getItem('theme');
    if (document.body.classList.contains('dark-theme')) {
        applyTheme('system-default'); // Revert to system default (light)
    } else {
        applyTheme('dark-theme'); // Apply dark theme
    }
    // Reset dropdown to "No Custom Theme" if toggling light/dark via button
    if (colorThemeSelect) {
        colorThemeSelect.value = 'none';
    }
}

/**
 * Exports the current shares data to a CSV file.
 */
function exportSharesToCsv() {
    if (allSharesData.length === 0) {
        showCustomDialog("No shares to export.", "Info", 2000);
        return;
    }

    const headers = [
        "Code", "Entered Price", "Target Price", "Dividend Amount",
        "Franking Credits (%)", "Unfranked Yield (%)", "Franked Yield (%)",
        "Entry Date", "Comments"
    ];

    const csvRows = [];
    csvRows.push(headers.join(',')); // Add headers as the first row

    allSharesData.forEach(share => {
        const unfrankedYield = calculateUnfrankedYield(share.currentPrice, share.dividendAmount) * 100;
        const frankedYield = calculateFrankedYield(share.currentPrice, share.dividendAmount, share.frankingCredits) * 100;

        const commentsText = (share.comments || []).map(c => {
            // Escape double quotes within title/text and wrap in double quotes
            const title = (c.title || '').replace(/"/g, '""');
            const text = (c.text || '').replace(/"/g, '""');
            return `"${title}: ${text}"`;
        }).join('; '); // Join multiple comments with a semicolon and space

        const row = [
            `"${(share.shareName || '').replace(/"/g, '""')}"`, // Escape quotes and wrap in quotes
            share.currentPrice || '',
            share.targetPrice || '',
            share.dividendAmount || '',
            share.frankingCredits || '',
            unfrankedYield.toFixed(2),
            frankedYield.toFixed(2),
            share.entryDate ? formatDate(share.entryDate) : '',
            `"${commentsText}"`
        ];
        csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'share_watchlist.csv');
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link); // Clean up
    showCustomDialog("Watchlist exported to CSV!", "Success", 2000);
    console.log("[Export] Shares exported to CSV.");
}


// --- EVENT HANDLERS ---

/**
 * Handles clicks on a share row or mobile card to open the detail modal.
 * @param {string} shareId - The ID of the clicked share.
 */
function handleShareRowClick(shareId) {
    const share = allSharesData.find(s => s.id === shareId);
    if (share) {
        displayShareDetails(share);
    } else {
        console.error("Share not found for ID:", shareId);
        showCustomDialog("Share details not found.", "Error", null, true);
    }
}

/**
 * Handles the click of the "Add Share" button in the header.
 */
function handleAddShareHeaderClick() {
    populateShareForm(null); // Open form for new share
    openModal(shareFormModal);
}

/**
 * Handles the click of the "New Share" button in the sidebar.
 */
function handleNewShareClick() {
    populateShareForm(null); // Open form for new share
    openModal(shareFormModal);
}

/**
 * Handles saving a share from the form.
 */
async function handleSaveShare() {
    const shareName = shareNameInput.value.trim();
    const currentPrice = parseFloat(currentPriceInput.value);
    const targetPrice = parseFloat(targetPriceInput.value);
    const dividendAmount = parseFloat(dividendAmountInput.value);
    const frankingCredits = parseFloat(frankingCreditsInput.value);
    const comments = getCommentsFromForm();

    if (!shareName) {
        showCustomDialog("Share Code is required.", "Input Error", null, true);
        return;
    }

    const shareData = {
        shareName: shareName,
        currentPrice: isNaN(currentPrice) ? null : currentPrice,
        targetPrice: isNaN(targetPrice) ? null : targetPrice,
        dividendAmount: isNaN(dividendAmount) ? null : dividendAmount,
        frankingCredits: isNaN(frankingCredits) ? null : frankingCredits,
        comments: comments,
        // When editing, preserve existing watchlistIds. When adding, it will be handled by saveShare.
        watchlistIds: selectedShareDocId ? allSharesData.find(s => s.id === selectedShareDocId)?.watchlistIds : []
    };

    await saveShare(selectedShareDocId, shareData);
}

/**
 * Handles opening the add watchlist modal.
 */
function handleAddWatchlistClick() {
    newWatchlistNameInput.value = ''; // Clear input
    openModal(addWatchlistModal);
}

/**
 * Handles saving a new watchlist.
 */
async function handleSaveNewWatchlist() {
    const watchlistName = newWatchlistNameInput.value.trim();
    await addWatchlist(watchlistName);
}

/**
 * Handles opening the manage watchlist modal for the currently selected watchlist.
 */
function handleEditWatchlistClick() {
    const selectedWatchlistId = watchlistSelect.value;
    if (!selectedWatchlistId || selectedWatchlistId === ALL_SHARES_ID) {
        showCustomDialog("Please select a specific watchlist to edit.", "Info", 2000);
        return;
    }
    populateManageWatchlistModal(selectedWatchlistId);
}

/**
 * Handles saving changes to an existing watchlist name.
 */
async function handleSaveWatchlistName() {
    const watchlistId = saveWatchlistNameBtn.dataset.watchlistId;
    const newName = editWatchlistNameInput.value.trim();
    if (watchlistId) {
        await updateWatchlistName(watchlistId, newName);
    } else {
        console.error("No watchlist ID found for saving name.");
        showCustomDialog("Error: No watchlist selected for update.", "Error", null, true);
    }
}

/**
 * Handles deleting a watchlist from the manage modal.
 */
async function handleDeleteWatchlistInModal() {
    const watchlistId = deleteWatchlistInModalBtn.dataset.watchlistId;
    if (watchlistId) {
        await deleteWatchlist(watchlistId);
    } else {
        console.error("No watchlist ID found for deletion.");
        showCustomDialog("Error: No watchlist selected for deletion.", "Error", null, true);
    }
}


/**
 * Handles changes to the watchlist select dropdown.
 */
function handleWatchlistSelectChange() {
    const selectedId = watchlistSelect.value;
    if (selectedId === ALL_SHARES_ID) {
        currentSelectedWatchlistIds = [ALL_SHARES_ID];
        mainTitle.textContent = "All Shares";
    } else {
        currentSelectedWatchlistIds = [selectedId];
        const selectedWatchlist = userWatchlists.find(wl => wl.id === selectedId);
        mainTitle.textContent = selectedWatchlist ? selectedWatchlist.name : "Share Watchlist";
    }
    console.log("[UI] Watchlist selection changed to:", currentSelectedWatchlistIds);
    listenForShares(); // Re-fetch shares based on new selection
    generateAsxCodeButtons(); // Re-generate ASX buttons for the new set of shares
}

/**
 * Handles changes to the sort select dropdown.
 */
function handleSortSelectChange() {
    currentSortOrder = sortSelect.value;
    console.log("[UI] Sort order changed to:", currentSortOrder);
    renderShares(); // Re-render shares with the new sort order
}

/**
 * Handles clicks on the standard calculator buttons.
 * @param {Event} event - The click event.
 */
function handleCalculatorButtonClick(event) {
    const button = event.target.closest('.calc-btn');
    if (!button) return;

    const value = button.dataset.value;
    const action = button.dataset.action;

    if (value) {
        // Number or decimal point
        if (resultDisplayed && action !== '.') { // If a result is displayed, start a new calculation unless it's a decimal
            currentCalculatorInput = value;
            resultDisplayed = false;
        } else {
            if (value === '.' && currentCalculatorInput.includes('.')) return; // Prevent multiple decimals
            currentCalculatorInput += value;
        }
    } else if (action) {
        if (action === 'clear') {
            currentCalculatorInput = '';
            operator = null;
            previousCalculatorInput = '';
            resultDisplayed = false;
        } else if (action === 'percentage') {
            if (currentCalculatorInput) {
                currentCalculatorInput = (parseFloat(currentCalculatorInput) / 100).toString();
            }
        } else if (action === 'calculate') {
            if (operator && previousCalculatorInput && currentCalculatorInput) {
                try {
                    let result;
                    const prev = parseFloat(previousCalculatorInput);
                    const curr = parseFloat(currentCalculatorInput);
                    switch (operator) {
                        case 'add':
                            result = prev + curr;
                            break;
                        case 'subtract':
                            result = prev - curr;
                            break;
                        case 'multiply':
                            result = prev * curr;
                            break;
                        case 'divide':
                            result = curr !== 0 ? prev / curr : 'Error';
                            break;
                        default:
                            result = 'Error';
                    }
                    currentCalculatorInput = result.toString();
                    previousCalculatorInput = '';
                    operator = null;
                    resultDisplayed = true;
                } catch (e) {
                    currentCalculatorInput = 'Error';
                    previousCalculatorInput = '';
                    operator = null;
                    resultDisplayed = true;
                }
            }
        } else { // Operator (+, -, ×, ÷)
            if (currentCalculatorInput) {
                if (previousCalculatorInput && operator) {
                    // Chain operations: calculate previous result first
                    const calculateEvent = { target: { closest: () => ({ dataset: { action: 'calculate' } }) } };
                    handleCalculatorButtonClick(calculateEvent);
                    previousCalculatorInput = calculatorDisplayResult.textContent; // Use the calculated result as new previous
                } else {
                    previousCalculatorInput = currentCalculatorInput;
                }
                currentCalculatorInput = '';
                operator = action;
                resultDisplayed = false;
            } else if (previousCalculatorInput && !currentCalculatorInput) {
                // If only previous input exists, just change the operator
                operator = action;
            }
        }
    }
    updateCalculatorDisplay();
}

/**
 * Updates the display of the standard calculator.
 */
function updateCalculatorDisplay() {
    if (calculatorDisplayInput) {
        let inputStr = previousCalculatorInput;
        if (operator) {
            inputStr += ` ${getOperatorSymbol(operator)} `;
        }
        inputStr += currentCalculatorInput;
        calculatorDisplayInput.textContent = inputStr || '0';
    }
    if (calculatorDisplayResult) {
        // Show current input if no result displayed, otherwise show result
        calculatorDisplayResult.textContent = resultDisplayed ? currentCalculatorInput : (currentCalculatorInput || '0');
    }
}

/**
 * Gets the symbol for a given operator action.
 * @param {string} action - The operator action (e.g., 'add').
 * @returns {string} The corresponding symbol (e.g., '+').
 */
function getOperatorSymbol(action) {
    switch (action) {
        case 'add': return '+';
        case 'subtract': return '-';
        case 'multiply': return '×';
        case 'divide': return '÷';
        default: return '';
    }
}

/**
 * Updates the results in the dividend calculator based on current inputs.
 */
function updateDividendCalculatorResults() {
    const price = parseFloat(calcCurrentPriceInput.value);
    const dividend = parseFloat(calcDividendAmountInput.value);
    const franking = parseFloat(calcFrankingCreditsInput.value);
    const investmentValue = parseFloat(investmentValueSelect.value);

    const unfrankedYield = calculateUnfrankedYield(price, dividend);
    const frankedYield = calculateFrankedYield(price, dividend, franking);
    const estimatedDividend = (investmentValue / price) * dividend;

    calcUnfrankedYieldSpan.textContent = formatPercentage(unfrankedYield);
    calcFrankedYieldSpan.textContent = formatPercentage(frankedYield);
    calcEstimatedDividendSpan.textContent = isNaN(estimatedDividend) || !isFinite(estimatedDividend) ? 'N/A' : formatCurrency(estimatedDividend);
}

/**
 * Handles the context menu display for right-click/long-press.
 * @param {Event} e - The event object.
 * @param {string} shareId - The ID of the share.
 */
function handleContextMenu(e, shareId) {
    e.preventDefault(); // Prevent default browser context menu
    selectedShareDocId = shareId; // Set the globally selected share ID

    // Position the custom context menu
    shareContextMenu.style.left = `${e.clientX}px`;
    shareContextMenu.style.top = `${e.clientY}px`;
    shareContextMenu.style.display = 'block';

    // Hide the menu if clicked anywhere else
    const hideMenu = () => {
        shareContextMenu.style.display = 'none';
        document.removeEventListener('click', hideMenu);
        document.removeEventListener('contextmenu', hideMenu); // Also hide if another right-click occurs
    };
    document.addEventListener('click', hideMenu);
    document.addEventListener('contextmenu', hideMenu); // In case another right-click is outside
}

/**
 * Handles touch start for long press detection.
 * @param {Event} e - The touchstart event.
 * @param {string} shareId - The ID of the share.
 */
function handleTouchStart(e, shareId) {
    if (e.touches.length === 1) {
        selectedElementForTap = e.currentTarget; // Store the element being touched
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;

        longPressTimer = setTimeout(() => {
            // Simulate right-click event at the touch position
            const touch = e.touches[0];
            const simulatedEvent = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            e.currentTarget.dispatchEvent(simulatedEvent);
            longPressTimer = null; // Clear the timer once triggered
            e.preventDefault(); // Prevent default touch behavior (e.g., scrolling)
        }, LONG_PRESS_THRESHOLD);
    }
}

/**
 * Handles touch move to cancel long press if significant movement occurs.
 * @param {Event} e - The touchmove event.
 */
function handleTouchMove(e) {
    if (longPressTimer) {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartX);
        const deltaY = Math.abs(touch.clientY - touchStartY);
        if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }
}

/**
 * Handles touch end to trigger click or clear long press timer.
 * @param {Event} e - The touchend event.
 */
function handleTouchEnd(e) {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        // If long press didn't trigger, it's a tap.
        // Prevent default double-tap zoom on some browsers
        const now = new Date().getTime();
        if (now - lastTapTime < 300) { // Double tap
            e.preventDefault();
        }
        lastTapTime = now;
    }
}

// --- INITIALIZATION ---

/**
 * Initializes all event listeners and fetches initial data.
 */
function initializeAppLogic() {
    console.log("[App Logic] Initializing application logic.");

    // --- EVENT LISTENERS ---
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => appSidebar.classList.add('open'));
    }
    if (closeMenuBtn) {
        closeMenuBtn.addEventListener('click', () => appSidebar.classList.remove('open'));
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => appSidebar.classList.remove('open'));
    }
    // Close sidebar if any menu item with data-action-closes-menu="true" is clicked
    document.querySelectorAll('.menu-button-item[data-action-closes-menu="true"]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (appSidebar.classList.contains('open')) {
                appSidebar.classList.remove('open');
            }
        });
    });

    if (addShareHeaderBtn) addShareHeaderBtn.addEventListener('click', handleAddShareHeaderClick);
    if (newShareBtn) newShareBtn.addEventListener('click', handleNewShareClick);
    if (saveShareBtn) saveShareBtn.addEventListener('click', handleSaveShare);
    if (cancelFormBtn) cancelFormBtn.addEventListener('click', () => closeModal(shareFormModal));
    if (deleteShareBtn) deleteShareBtn.addEventListener('click', () => deleteShare(selectedShareDocId));
    if (shareDetailModal) {
        shareDetailModal.querySelector('.close-button').addEventListener('click', () => closeModal(shareDetailModal));
    }
    if (editShareFromDetailBtn) {
        editShareFromDetailBtn.addEventListener('click', () => {
            const share = allSharesData.find(s => s.id === selectedShareDocId);
            if (share) {
                closeModal(shareDetailModal);
                populateShareForm(share);
                openModal(shareFormModal);
            }
        });
    }
    if (deleteShareFromDetailBtn) {
        deleteShareFromDetailBtn.addEventListener('click', () => deleteShare(selectedShareDocId));
    }

    if (addCommentSectionBtn) {
        addCommentSectionBtn.addEventListener('click', () => {
            renderCommentsForm(getCommentsFromForm().concat([{ title: '', text: '' }]));
        });
    }

    // Calculator event listeners
    if (standardCalcBtn) standardCalcBtn.addEventListener('click', () => {
        currentCalculatorInput = '';
        operator = null;
        previousCalculatorInput = '';
        resultDisplayed = false;
        updateCalculatorDisplay();
        openModal(calculatorModal);
    });
    if (calculatorModal) {
        calculatorModal.querySelector('.close-button').addEventListener('click', () => closeModal(calculatorModal));
    }
    if (calculatorButtons) {
        calculatorButtons.addEventListener('click', handleCalculatorButtonClick);
    }

    // Dividend Calculator event listeners
    if (dividendCalcBtn) dividendCalcBtn.addEventListener('click', () => {
        populateDividendCalculator(selectedShareDocId ? allSharesData.find(s => s.id === selectedShareDocId) : null);
        openModal(dividendCalculatorModal);
    });
    if (dividendCalculatorModal) {
        dividendCalculatorModal.querySelector('.close-button').addEventListener('click', () => closeModal(dividendCalculatorModal));
        calcCurrentPriceInput.addEventListener('input', updateDividendCalculatorResults);
        calcDividendAmountInput.addEventListener('input', updateDividendCalculatorResults);
        calcFrankingCreditsInput.addEventListener('input', updateDividendCalculatorResults);
        investmentValueSelect.addEventListener('change', updateDividendCalculatorResults);
    }

    // Custom Dialog listeners
    if (customDialogModal) {
        customDialogModal.querySelector('.close-button').addEventListener('click', () => {
            if (currentDialogCallback) {
                currentDialogCallback({ target: { id: 'customDialogCancelBtn' } }); // Simulate cancel
            }
        });
    }

    // Watchlist Management
    if (addWatchlistBtn) addWatchlistBtn.addEventListener('click', handleAddWatchlistClick);
    if (addWatchlistModal) {
        addWatchlistModal.querySelector('.close-button').addEventListener('click', () => closeModal(addWatchlistModal));
    }
    if (saveWatchlistBtn) saveWatchlistBtn.addEventListener('click', handleSaveNewWatchlist);
    if (cancelAddWatchlistBtn) cancelAddWatchlistBtn.addEventListener('click', () => closeModal(addWatchlistModal));
    if (editWatchlistBtn) editWatchlistBtn.addEventListener('click', handleEditWatchlistClick);
    if (manageWatchlistModal) {
        manageWatchlistModal.querySelector('.close-button').addEventListener('click', () => closeModal(manageWatchlistModal));
    }
    if (saveWatchlistNameBtn) saveWatchlistNameBtn.addEventListener('click', handleSaveWatchlistName);
    if (deleteWatchlistInModalBtn) deleteWatchlistInModalBtn.addEventListener('click', handleDeleteWatchlistInModal);
    if (cancelManageWatchlistBtn) cancelManageWatchlistBtn.addEventListener('click', () => closeModal(manageWatchlistModal));

    if (watchlistSelect) watchlistSelect.addEventListener('change', handleWatchlistSelectChange);
    if (sortSelect) sortSelect.addEventListener('change', handleSortSelectChange);

    // Theme controls
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    if (colorThemeSelect) {
        colorThemeSelect.addEventListener('change', (e) => {
            const selectedTheme = e.target.value;
            if (selectedTheme === 'none') {
                applyTheme('system-default');
            } else {
                applyTheme(selectedTheme);
            }
        });
    }
    if (revertToDefaultThemeBtn) revertToDefaultThemeBtn.addEventListener('click', () => applyTheme('system-default'));

    // Logout button
    if (logoutBtn) logoutBtn.addEventListener('click', handleSignOut);

    // Scroll-to-top button
    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 200) { // Show button after scrolling down 200px
                scrollToTopBtn.style.display = 'flex';
            } else {
                scrollToTopBtn.style.display = 'none';
            }
        });
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Context Menu listeners
    if (contextEditShareBtn) {
        contextEditShareBtn.addEventListener('click', () => {
            const share = allSharesData.find(s => s.id === selectedShareDocId);
            if (share) {
                populateShareForm(share);
                openModal(shareFormModal);
            }
        });
    }
    if (contextDeleteShareBtn) {
        contextDeleteShareBtn.addEventListener('click', () => deleteShare(selectedShareDocId));
    }

    // Export button
    if (exportWatchlistBtn) {
        exportWatchlistBtn.addEventListener('click', exportSharesToCsv);
    }

    // --- INITIAL AUTH STATE CHECK & DATA LOAD ---
    // This listener will fire when the auth state changes (sign-in, sign-out, initial load)
    if (authFunctions && auth) {
        authFunctions.onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                console.log("[Auth] User is signed in:", currentUserId);
                updateAuthButtonText(true);
                updateMainButtonsState(true);
                // Listen for watchlists first, which will then trigger listenForShares
                listenForWatchlists();
                generateAsxCodeButtons(); // Generate buttons based on initial data
            } else {
                currentUserId = null;
                console.log("[Auth] No user is signed in. Attempting anonymous sign-in.");
                updateAuthButtonText(false);
                updateMainButtonsState(false);
                clearShareList();
                clearWatchlistUI();
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                applyTheme('system-default');
                if (unsubscribeShares) { // Ensure listener is cleaned up on logout
                    unsubscribeShares();
                    unsubscribeShares = null;
                    console.log("[Firestore Listener] Unsubscribed from shares listener on logout.");
                }
                if (unsubscribeWatchlists) { // Ensure listener is cleaned up on logout
                    unsubscribeWatchlists();
                    unsubscribeWatchlists = null;
                    console.log("[Firestore Listener] Unsubscribed from watchlists listener on logout.");
                }
                await authenticateUser(); // Attempt anonymous sign-in
            }
        });
    } else {
        console.error("[Firebase] Auth object or functions not available. Cannot set up auth state listener.");
        updateAuthButtonText(false);
        updateMainButtonsState(false);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        applyTheme('system-default');
    }

    // Apply theme from local storage or system default on initial load
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme('system-default');
    }
}

// --- Main execution flow ---
// Wait for the custom event dispatched by index.html when Firebase globals are ready.
document.addEventListener('firebaseGlobalsReady', () => {
    console.log("script.js: 'firebaseGlobalsReady' event received.");
    if (initializeFirebaseGlobals()) {
        initializeAppLogic();
    }
});

// Fallback for cases where the event might be missed (e.g., if script.js loads very late)
// Or if the initial check is sufficient.
// This check runs immediately if the event has already fired or if the globals are already there.
if (window.firebaseGlobalsReady) {
    console.log("script.js: window.firebaseGlobalsReady is true on immediate check.");
    if (initializeFirebaseGlobals()) {
        // Only initialize app logic if it hasn't been initialized by the event listener already
        // Use a flag to prevent double initialization, though the event listener should be primary.
        if (!window._appLogicInitialized) {
            initializeAppLogic();
            window._appLogicInitialized = true;
        }
    }
} else {
    // If globals are not ready immediately and event hasn't fired yet,
    // ensure the loading indicator is shown until Firebase is ready.
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    console.log("script.js: Firebase globals not immediately ready. Waiting for 'firebaseGlobalsReady' event.");
}

console.log("script.js (v151) loaded.");
