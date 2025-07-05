// File Version: v154
// Last Updated: 2025-07-05 (Firebase Initialization Fix - Removed redundant DOMContentLoaded)

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

// Flag to ensure app logic is initialized only once
window._appLogicInitialized = false;

// --- DOM ELEMENTS ---
// These are declared here, but their values will be assigned inside initializeAppLogic
// to ensure they are available after DOMContentLoaded.
let hamburgerBtn;
let appSidebar;
let closeMenuBtn;
let sidebarOverlay;
let addShareHeaderBtn;
let shareTableBody;
let mobileShareCardsContainer;
let googleAuthBtn;
let shareFormModal;
let shareFormTitle;
let shareNameInput;
let currentPriceInput;
let targetPriceInput;
let dividendAmountInput;
let frankingCreditsInput;
let saveShareBtn;
let cancelFormBtn;
let deleteShareBtn;
let shareDetailModal;
let modalShareName;
let modalEntryDate;
let modalEnteredPrice;
let modalTargetPrice;
let modalDividendAmount;
let modalFrankingCredits;
let modalUnfrankedYield;
let modalFrankedYield;
let modalMarketIndexLink;
let modalFoolLink;
let modalCommSecLink;
let modalNewsLink;
let deleteShareFromDetailBtn;
let editShareFromDetailBtn;
let commentsFormContainer;
let addCommentSectionBtn;
let modalCommentsContainer;
let newShareBtn;
let standardCalcBtn;
let dividendCalcBtn;
let calculatorModal;
let calculatorDisplayInput;
let calculatorDisplayResult;
let calculatorButtons;
let dividendCalculatorModal;
let calcCurrentPriceInput;
let calcDividendAmountInput;
let calcFrankingCreditsInput;
let calcUnfrankedYieldSpan;
let calcFrankedYieldSpan;
let investmentValueSelect;
let calcEstimatedDividendSpan;
let customDialogModal;
let customDialogMessage;
let customDialogConfirmBtn;
let customDialogCancelBtn;
let loadingIndicator;
let watchlistSelect;
let addWatchlistBtn;
let addWatchlistModal;
let newWatchlistNameInput;
let saveWatchlistBtn;
let cancelAddWatchlistBtn;
let editWatchlistBtn;
let manageWatchlistModal;
let editWatchlistNameInput;
let saveWatchlistNameBtn;
let deleteWatchlistInModalBtn;
let cancelManageWatchlistBtn;
let sortSelect;
let asxCodeButtonsContainer;
let themeToggleBtn;
let colorThemeSelect;
let revertToDefaultThemeBtn;
let logoutBtn;
let scrollToTopBtn;
let shareContextMenu;
let contextEditShareBtn;
let contextDeleteShareBtn;
let exportWatchlistBtn;
let mainTitle;


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
                createdAt: firestoreFunctions.serverTimestamp() // Use server timestamp
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
    // Assign DOM elements inside this function as well, as a fallback/safety,
    // though they should be assigned in initializeAppLogic.
    const shareFormTitle = document.getElementById('formTitle');
    const shareNameInput = document.getElementById('shareName');
    const currentPriceInput = document.getElementById('currentPrice');
    const targetPriceInput = document.getElementById('targetPrice');
    const dividendAmountInput = document.getElementById('dividendAmount');
    const frankingCreditsInput = document.getElementById('frankingCredits');
    const commentsFormContainer = document.getElementById('commentsFormContainer');
    const deleteShareBtn = document.getElementById('deleteShareBtn');

    if (!shareFormTitle || !shareNameInput || !currentPriceInput || !targetPriceInput || !dividendAmountInput || !frankingCreditsInput || !commentsFormContainer || !deleteShareBtn) {
        console.error("[UI] Share form elements not found in populateShareForm.");
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
    const commentsFormContainer = document.getElementById('commentsFormContainer');
    const addCommentSectionBtn = document.getElementById('addCommentSectionBtn');

    if (!commentsFormContainer || !addCommentSectionBtn) {
        console.error("[UI] Comments form container or add button not found in renderCommentsForm.");
        return;
    }

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
    const commentsFormContainer = document.getElementById('commentsFormContainer');
    if (!commentsFormContainer) {
        console.error("[UI] Comments form container not found in getCommentsFromForm.");
        return [];
    }
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
    // Assign DOM elements here for safety, similar to populateShareForm
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
    const modalCommentsContainer = document.getElementById('modalCommentsContainer');

    if (!modalShareName || !modalEntryDate || !modalEnteredPrice || !modalTargetPrice || !modalDividendAmount || !modalFrankingCredits || !modalUnfrankedYield || !modalFrankedYield || !modalMarketIndexLink || !modalFoolLink || !modalCommSecLink || !modalNewsLink || !modalCommentsContainer) {
        console.error("[UI] Share detail modal elements not found in displayShareDetails.");
        return;
    }

    selectedShareDocId = share.id; // Set the global selected ID

    // Highlight the selected row/card
    clearWatchlistUI();
    const selectedRow = document.querySelector(`#shareTable tbody tr[data-share-id="${share.id}"]`);
    if (selectedRow) selectedRow.classList.add('selected');
    const selectedCard = document.querySelector(`#mobileShareCards .mobile-card[data-share-id="${share.id}"]`);
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

    openModal(document.getElementById('shareDetailModal'));
}

/**
 * Populates the dividend calculator modal with share data if available.
 * @param {Object|null} share - The share object to pre-fill, or null to clear.
 */
function populateDividendCalculator(share = null) {
    const calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
    const calcDividendAmountInput = document.getElementById('calcDividendAmount');
    const calcFrankingCreditsInput = document.getElementById('frankingCredits');

    if (!calcCurrentPriceInput || !calcDividendAmountInput || !calcFrankingCreditsInput) {
        console.error("[UI] Dividend calculator input elements not found in populateDividendCalculator.");
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
    const editWatchlistNameInput = document.getElementById('editWatchlistName');
    const saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn');
    const deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn');

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
        openModal(document.getElementById('manageWatchlistModal'));
    } else {
        console.error("Watchlist not found for editing:", watchlistId);
        showCustomDialog("Watchlist not found.", "Error", null, true);
    }
}

/**
 * Generates and displays ASX code buttons based on the current shares data.
 */
function generateAsxCodeButtons() {
    const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
    if (!asxCodeButtonsContainer) {
        console.error("[UI] ASX code buttons container not found in generateAsxCodeButtons.");
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
    const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
    if (!asxCodeButtonsContainer) {
        console.error("[UI] ASX code buttons container not found in filterSharesByAsxCode.");
        return;
    }

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
        const shareTableBody = document.querySelector('#shareTable tbody');
        const mobileShareCardsContainer = document.getElementById('mobileShareCards');
        if (shareTableBody) shareTableBody.innerHTML = '<tr><td colspan="5" class="no-shares-message">No shares matching this filter.</td></tr>';
        if (mobileShareCardsContainer) mobileShareCardsContainer.innerHTML = '<div class="mobile-card no-shares-message">No shares matching this filter.</div>';
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

// --- INITIALIZATION ---

/**
 * Initializes all event listeners and fetches initial data.
 * This function should only be called once, after DOM is ready and Firebase globals are available.
 */
function initializeAppLogic() {
    if (window._appLogicInitialized) {
        console.warn("[App Logic] initializeAppLogic called multiple times. Skipping.");
        return;
    }
    window._appLogicInitialized = true;
    console.log("[App Logic] Initializing application logic.");

    // Assign DOM elements now that DOMContentLoaded has fired
    // (These were declared globally but assigned here to ensure they exist)
    hamburgerBtn = document.getElementById('hamburgerBtn');
    appSidebar = document.getElementById('appSidebar');
    closeMenuBtn = document.getElementById('closeMenuBtn');
    sidebarOverlay = document.getElementById('sidebarOverlay');
    addShareHeaderBtn = document.getElementById('addShareHeaderBtn');
    shareTableBody = document.querySelector('#shareTable tbody');
    mobileShareCardsContainer = document.getElementById('mobileShareCards');
    googleAuthBtn = document.getElementById('googleAuthBtn');
    shareFormModal = document.getElementById('shareFormSection');
    shareFormTitle = document.getElementById('formTitle');
    shareNameInput = document.getElementById('shareName');
    currentPriceInput = document.getElementById('currentPrice');
    targetPriceInput = document.getElementById('targetPrice');
    dividendAmountInput = document.getElementById('dividendAmount');
    frankingCreditsInput = document.getElementById('frankingCredits');
    saveShareBtn = document.getElementById('saveShareBtn');
    cancelFormBtn = document.getElementById('cancelFormBtn');
    deleteShareBtn = document.getElementById('deleteShareBtn');
    shareDetailModal = document.getElementById('shareDetailModal');
    modalShareName = document.getElementById('modalShareName');
    modalEntryDate = document.getElementById('modalEntryDate');
    modalEnteredPrice = document.getElementById('modalEnteredPrice');
    modalTargetPrice = document.getElementById('modalTargetPrice');
    modalDividendAmount = document.getElementById('modalDividendAmount');
    modalFrankingCredits = document.getElementById('modalFrankingCredits');
    modalUnfrankedYield = document.getElementById('modalUnfrankedYield');
    modalFrankedYield = document.getElementById('modalFrankedYield');
    modalMarketIndexLink = document.getElementById('modalMarketIndexLink');
    modalFoolLink = document.getElementById('modalFoolLink');
    modalCommSecLink = document.getElementById('modalCommSecLink');
    modalNewsLink = document.getElementById('modalNewsLink');
    deleteShareFromDetailBtn = document.getElementById('deleteShareFromDetailBtn');
    editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn');
    commentsFormContainer = document.getElementById('commentsFormContainer');
    addCommentSectionBtn = document.getElementById('addCommentSectionBtn');
    modalCommentsContainer = document.getElementById('modalCommentsContainer');
    newShareBtn = document.getElementById('newShareBtn');
    standardCalcBtn = document.getElementById('standardCalcBtn');
    dividendCalcBtn = document.getElementById('dividendCalcBtn');
    calculatorModal = document.getElementById('calculatorModal');
    calculatorDisplayInput = document.getElementById('calculatorInput');
    calculatorDisplayResult = document.getElementById('calculatorResult');
    calculatorButtons = document.querySelector('#calculatorModal .calculator-buttons');
    dividendCalculatorModal = document.getElementById('dividendCalculatorModal');
    calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
    calcDividendAmountInput = document.getElementById('calcDividendAmount');
    calcFrankingCreditsInput = document.getElementById('frankingCredits');
    calcUnfrankedYieldSpan = document.getElementById('calcUnfrankedYield');
    calcFrankedYieldSpan = document.getElementById('calcFrankedYield');
    investmentValueSelect = document.getElementById('investmentValueSelect');
    calcEstimatedDividendSpan = document.getElementById('calcEstimatedDividend');
    customDialogModal = document.getElementById('customDialogModal');
    customDialogMessage = document.getElementById('customDialogMessage');
    customDialogConfirmBtn = document.getElementById('customDialogConfirmBtn');
    customDialogCancelBtn = document.getElementById('customDialogCancelBtn');
    loadingIndicator = document.getElementById('loadingIndicator');
    watchlistSelect = document.getElementById('watchlistSelect');
    addWatchlistBtn = document.getElementById('addWatchlistBtn');
    addWatchlistModal = document.getElementById('addWatchlistModal');
    newWatchlistNameInput = document.getElementById('newWatchlistName');
    saveWatchlistBtn = document.getElementById('saveWatchlistBtn');
    cancelAddWatchlistBtn = document.getElementById('cancelAddWatchlistBtn');
    editWatchlistBtn = document.getElementById('editWatchlistBtn');
    manageWatchlistModal = document.getElementById('manageWatchlistModal');
    editWatchlistNameInput = document.getElementById('editWatchlistName');
    saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn');
    deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn');
    cancelManageWatchlistBtn = document.getElementById('cancelManageWatchlistBtn');
    sortSelect = document.getElementById('sortSelect');
    asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
    themeToggleBtn = document.getElementById('themeToggleBtn');
    colorThemeSelect = document.getElementById('colorThemeSelect');
    revertToDefaultThemeBtn = document.getElementById('revertToDefaultThemeBtn');
    logoutBtn = document.getElementById('logoutBtn');
    scrollToTopBtn = document.getElementById('scrollToTopBtn');
    shareContextMenu = document.getElementById('shareContextMenu');
    contextEditShareBtn = document.getElementById('contextEditShareBtn');
    contextDeleteShareBtn = document.getElementById('contextDeleteShareBtn');
    exportWatchlistBtn = document.getElementById('exportWatchlistBtn');
    mainTitle = document.getElementById('mainTitle');


    // --- SERVICE WORKER REGISTRATION ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => { // Use 'load' to ensure all resources are loaded before SW registration
            navigator.serviceWorker.register('/service-worker.js?v=48') // UPDATED: Service Worker version
                .then(registration => {
                    console.log('Service Worker registered! Scope:', registration.scope);
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                showCustomDialog('New content is available! Please refresh to update.', 'Info', null, true);
                            }
                        });
                    });
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }


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
                console.log("[Auth] User is signed in:", user.uid);
                updateAuthButtonText(true); // Pass true for signed in
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
// Listen for the custom event dispatched by index.html when Firebase globals are ready AND DOM is loaded.
document.addEventListener('firebaseGlobalsAndDOMReady', () => {
    console.log("script.js: 'firebaseGlobalsAndDOMReady' event received.");
    // Only initialize app logic if it hasn't been initialized by the event listener already
    if (!window._appLogicInitialized) {
        if (initializeFirebaseGlobals()) {
            initializeAppLogic();
        }
    }
});

console.log("script.js (v154) loaded.");
