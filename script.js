// File Version: v150
// Last Updated: 2025-07-02 (Fix ALL_SHARES_ID Typo)

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
let currentSelectedWatchlistIds = []; // Stores IDs of currently selected watchlists for display and filtering
let unsubscribeShares = null; // To store the unsubscribe function for the shares listener
let unsubscribeWatchlists = null; // To store the unsubscribe function for watchlists listener


// --- DOM ELEMENTS ---
const hamburgerBtn = document.getElementById('hamburgerBtn');
const appSidebar = document.getElementById('appSidebar');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const addShareHeaderBtn = document.getElementById('addShareHeaderBtn');
const newShareBtn = document.getElementById('newShareBtn');
const shareFormSection = document.getElementById('shareFormSection');
const shareForm = document.getElementById('shareForm');
const formTitle = document.getElementById('formTitle');
const shareNameInput = document.getElementById('shareName');
const entryDateInput = document.getElementById('entryDate');
const enteredPriceInput = document.getElementById('enteredPrice');
const currentPriceInput = document.getElementById('currentPrice');
const targetPriceInput = document.getElementById('targetPrice');
const dividendAmountInput = document.getElementById('dividendAmount');
const frankingCreditsInput = document.getElementById('frankingCredits');
const notesInput = document.getElementById('notes');
const saveShareBtn = document.getElementById('saveShareBtn');
const cancelFormBtn = document.getElementById('cancelFormBtn');
const deleteShareBtn = document.getElementById('deleteShareBtn');
const shareTableBody = document.querySelector('#shareTable tbody');
const mobileShareCardsContainer = document.getElementById('mobileShareCards');
const shareDetailModal = document.getElementById('shareDetailModal');
const modalShareName = document.getElementById('modalShareName');
const modalEntryDate = document.getElementById('modalEntryDate');
const modalEnteredPrice = document.getElementById('modalEnteredPrice');
const modalCurrentPrice = document.getElementById('modalCurrentPrice');
const modalTargetPrice = document.getElementById('modalTargetPrice');
const modalDividendAmount = document.getElementById('modalDividendAmount');
const modalFrankingCredits = document.getElementById('modalFrankingCredits');
const modalUnfrankedYield = document.getElementById('modalUnfrankedYield');
const modalFrankedYield = document.getElementById('modalFrankedYield');
const modalNotes = document.getElementById('modalNotes');
const modalCommentsContainer = document.getElementById('modalCommentsContainer');
const editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn');
const deleteShareFromDetailBtn = document.getElementById('deleteShareFromDetailBtn');
const modalNewsLink = document.getElementById('modalNewsLink');
const modalMarketIndexLink = document.getElementById('modalMarketIndexLink');
const modalFoolLink = document.getElementById('modalFoolLink');
const modalCommSecLink = document.getElementById('modalCommSecLink');
const commSecLoginMessage = document.getElementById('commSecLoginMessage');
const firebaseStatusText = document.getElementById('firebaseStatusText');
const firebaseStatusLight = document.getElementById('firebaseStatusLight');
const googleAuthBtn = document.getElementById('googleAuthBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const mainTitle = document.getElementById('mainTitle');
const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
const commentsFormContainer = document.getElementById('commentsFormContainer');
const addCommentSectionBtn = document.getElementById('addCommentSectionBtn');
const dividendCalcBtn = document.getElementById('dividendCalcBtn');
const dividendCalculatorModal = document.getElementById('dividendCalculatorModal');
const calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
const calcDividendAmountInput = document.getElementById('calcDividendAmount');
const calcFrankingCreditsInput = document.getElementById('calcFrankingCredits');
const calcUnfrankedYield = document.getElementById('calcUnfrankedYield');
const calcFrankedYield = document.getElementById('calcFrankedYield');
const investmentValueSelect = document.getElementById('investmentValueSelect');
const calcEstimatedDividend = document.getElementById('calcEstimatedDividend');
const standardCalcBtn = document.getElementById('standardCalcBtn');
const calculatorModal = document.getElementById('calculatorModal');
const calculatorResult = document.getElementById('calculatorResult');
const calculatorInput = document.getElementById('calculatorInput');
const calculatorButtons = document.querySelector('#calculatorModal .calculator-buttons');
const customDialogModal = document.getElementById('customDialogModal');
const customDialogMessage = document.getElementById('customDialogMessage');
const customDialogConfirmBtn = document.getElementById('customDialogConfirmBtn');
const customDialogCancelBtn = document.getElementById('customDialogCancelBtn');
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
const noSharesMessage = document.getElementById('noSharesMessage');
const sortSelect = document.getElementById('sortSelect');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const colorThemeSelect = document.getElementById('colorThemeSelect');
const revertToDefaultThemeBtn = document.getElementById('revertToDefaultThemeBtn');
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn');
const shareContextMenu = document.getElementById('shareContextMenu');
const contextEditShareBtn = document.getElementById('contextEditShareBtn');
const contextDeleteShareBtn = document.getElementById('contextDeleteShareBtn');
const scrollToTopBtn = document.getElementById('scrollToTopBtn');


// --- CONSTANTS ---
const ALL_SHARES_ID = 'all-shares-watchlist'; // Typo fixed from ALL_SHARE_ID
const ALL_SHARES_NAME = 'All Shares (System)';
const FIREBASE_STATUS_CONNECTED = 'Connected';
const FIREBASE_STATUS_DISCONNECTED = 'Disconnected';
const FIREBASE_STATUS_INITIALIZING = 'Initializing...';


// --- UTILITY FUNCTIONS ---

/**
 * Displays a custom dialog (modal) with a message and optional confirm/cancel buttons.
 * @param {string} message - The message to display.
 * @param {boolean} showCancel - Whether to show the cancel button.
 * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false if cancelled.
 */
function showCustomDialog(message, showCancel = false) {
    return new Promise((resolve) => {
        customDialogMessage.textContent = message;
        customDialogCancelBtn.style.display = showCancel ? 'inline-block' : 'none';
        customDialogModal.style.display = 'block';
        customDialogModal.classList.add('active'); // Add active class for animations

        currentDialogCallback = (result) => {
            customDialogModal.style.display = 'none';
            customDialogModal.classList.remove('active'); // Remove active class
            resolve(result);
            currentDialogCallback = null; // Clear the callback
        };
    });
}

/**
 * Closes all active modals.
 */
function closeModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
        modal.classList.remove('active'); // Remove active class
    });
    // Clear any pending dialog callbacks if a modal is closed externally
    if (currentDialogCallback) {
        currentDialogCallback(false); // Treat as cancelled
    }
    // Hide context menu if open
    hideContextMenu();
}

/**
 * Formats a number as currency (e.g., 1234.56 -> $1,234.56).
 * @param {number} value - The number to format.
 * @returns {string} Formatted currency string.
 */
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return '-';
    }
    return `$${parseFloat(value).toFixed(2)}`;
}

/**
 * Formats a number as a percentage (e.g., 0.123 -> 12.30%).
 * @param {number} value - The number to format.
 * @returns {string} Formatted percentage string.
 */
function formatPercentage(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return '-';
    }
    return `${parseFloat(value).toFixed(2)}%`;
}

/**
 * Calculates the unfranked yield.
 * @param {number} currentPrice
 * @param {number} dividendAmount
 * @returns {number} Unfranked yield percentage.
 */
function calculateUnfrankedYield(currentPrice, dividendAmount) {
    if (!currentPrice || currentPrice <= 0 || !dividendAmount || dividendAmount <= 0) {
        return 0;
    }
    return (dividendAmount / currentPrice) * 100;
}

/**
 * Calculates the franked yield.
 * @param {number} unfrankedYield
 * @param {number} frankingCredits
 * @returns {number} Franked yield percentage.
 */
function calculateFrankedYield(unfrankedYield, frankingCredits) {
    if (isNaN(unfrankedYield) || unfrankedYield <= 0) {
        return 0;
    }
    const frankingFactor = frankingCredits / 100;
    // The formula for grossed-up dividend yield (franked yield)
    // is Unfranked Yield * (1 + (Franking % * Tax Rate))
    // Assuming a company tax rate of 30% (0.30) for franking calculations in Australia.
    const companyTaxRate = 0.30;
    return unfrankedYield * (1 + (frankingFactor / (1 - companyTaxRate)));
}

/**
 * Sets the disabled state and visual style of action buttons.
 * @param {HTMLElement} buttonElement - The button or span element.
 * @param {boolean} isDisabled - True to disable, false to enable.
 */
function setIconDisabled(buttonElement, isDisabled) {
    if (!buttonElement) return;
    if (isDisabled) {
        buttonElement.classList.add('disabled');
        buttonElement.setAttribute('aria-disabled', 'true');
        buttonElement.style.pointerEvents = 'none'; // Disable click events
    } else {
        buttonElement.classList.remove('disabled');
        buttonElement.setAttribute('aria-disabled', 'false');
        buttonElement.style.pointerEvents = 'auto'; // Enable click events
    }
}

/**
 * Updates the state of main action buttons based on authentication status.
 * @param {boolean} isAuthenticated - True if user is authenticated, false otherwise.
 */
function updateMainButtonsState(isAuthenticated) {
    const buttonsToControl = [
        addShareHeaderBtn, newShareBtn, addWatchlistBtn, editWatchlistBtn,
        exportWatchlistBtn, themeToggleBtn, colorThemeSelect, revertToDefaultThemeBtn,
        watchlistSelect, sortSelect
    ];

    buttonsToControl.forEach(btn => setIconDisabled(btn, !isAuthenticated));

    // Specific handling for logout and Google Auth buttons
    setIconDisabled(logoutBtn, !isAuthenticated);
    setIconDisabled(googleAuthBtn, isAuthenticated);

    // Update visibility of "No Shares" message
    if (isAuthenticated) {
        noSharesMessage.style.display = allSharesData.length === 0 ? 'block' : 'none';
    } else {
        noSharesMessage.style.display = 'none'; // Hide if not authenticated
    }
}

/**
 * Updates the text and state of the Google Auth button.
 * @param {boolean} isAuthenticated - True if user is authenticated.
 */
function updateAuthButtonText(isAuthenticated) {
    if (googleAuthBtn) {
        googleAuthBtn.innerHTML = isAuthenticated ? '<i class="fab fa-google"></i> <span>Signed In</span>' : '<i class="fab fa-google"></i> <span>Sign In with Google</span>';
    }
}

/**
 * Updates the Firebase status indicator.
 * @param {string} status - The status message.
 * @param {string} lightColor - 'green', 'red', or 'grey'.
 */
function updateFirebaseStatus(status, lightColor) {
    firebaseStatusText.textContent = `Firebase Status: ${status}`;
    firebaseStatusLight.className = `status-light ${lightColor}`;
}

/**
 * Sets the current theme class on the body.
 * @param {string} themeName - The name of the theme ('system-default', 'dark', 'bold-1', etc.).
 */
function applyTheme(themeName) {
    const body = document.body;
    // Remove all existing theme classes
    body.className = '';
    // Add the new theme class if it's not 'system-default'
    if (themeName && themeName !== 'system-default') {
        body.classList.add(themeName);
    }
    // Save preference to localStorage
    localStorage.setItem('themePreference', themeName);
    console.log(`[Theme] Applied theme: ${themeName}`);
}

/**
 * Toggles between 'light-theme' and 'dark-theme' if no specific color theme is active.
 * If a specific color theme is active, it resets to system-default.
 */
function toggleTheme() {
    const currentTheme = localStorage.getItem('themePreference') || 'system-default';
    const body = document.body;

    // Check if any specific color theme is active (i.e., not 'system-default' or 'dark')
    const isCustomColorThemeActive = !body.classList.contains('dark-theme') && !body.classList.contains('light-theme') && currentTheme !== 'system-default';

    if (isCustomColorThemeActive) {
        // If a custom color theme is active, revert to system-default
        applyTheme('system-default');
        colorThemeSelect.value = 'none'; // Reset dropdown
    } else if (currentTheme === 'dark') {
        // If currently dark, switch to system-default
        applyTheme('system-default');
        colorThemeSelect.value = 'none'; // Reset dropdown
    } else {
        // If currently system-default or light, switch to dark
        applyTheme('dark');
        colorThemeSelect.value = 'none'; // Reset dropdown
    }
}


/**
 * Hides the context menu.
 */
function hideContextMenu() {
    shareContextMenu.style.display = 'none';
    shareContextMenu.dataset.shareDocId = ''; // Clear the stored ID
}

/**
 * Displays a loading indicator.
 */
function showLoadingIndicator() {
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
}

/**
 * Hides the loading indicator.
 */
function hideLoadingIndicator() {
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// --- FIREBASE & AUTHENTICATION ---

/**
 * Initializes Firebase and sets up authentication listeners.
 * This function should be called once the DOM is ready and global Firebase objects are available.
 */
async function initializeFirebaseAndAuth() {
    db = window.firestoreDb;
    auth = window.firebaseAuth;
    currentAppId = window.getFirebaseAppId();

    if (!db || !auth || !currentAppId || !window.firestore || !window.authFunctions) {
        console.error("[Firebase Init] Global Firebase objects are not available. Cannot proceed with app logic.");
        updateFirebaseStatus('Error', 'red');
        updateMainButtonsState(false);
        hideLoadingIndicator();
        return;
    }

    updateFirebaseStatus(FIREBASE_STATUS_INITIALIZING, 'grey');
    showLoadingIndicator();

    // Sign in anonymously if no custom token is provided by the environment
    // This ensures a user ID is always available for Firestore rules
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
            await window.authFunctions.signInWithCustomToken(auth, __initial_auth_token);
            console.log("[Auth] Signed in with custom token.");
        } catch (error) {
            console.error("[Auth] Custom token sign-in failed:", error);
            await window.authFunctions.signInAnonymously(auth);
            console.log("[Auth] Signed in anonymously as fallback.");
        }
    } else {
        await window.authFunctions.signInAnonymously(auth);
        console.log("[Auth] Signed in anonymously.");
    }

    // Set up auth state observer
    window.authFunctions.onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            console.log(`[Auth] User is signed in. UID: ${currentUserId}`);
            updateFirebaseStatus(FIREBASE_STATUS_CONNECTED, 'green');
            updateAuthButtonText(true);
            updateMainButtonsState(true);
            mainTitle.textContent = `Watchlist (${user.isAnonymous ? 'Guest' : 'Signed In'})`;
            
            // Only fetch data if Firebase is initialized and user is logged in
            if (window.firestoreDb) {
                await fetchUserWatchlists(); // Fetch watchlists first
                await fetchSharesForSelectedWatchlists(); // Then shares
            } else {
                console.warn("[Firebase] Firestore DB not available after auth state change.");
                hideLoadingIndicator();
            }
        } else {
            currentUserId = null;
            console.log("[Auth] User is signed out.");
            updateFirebaseStatus(FIREBASE_STATUS_DISCONNECTED, 'red');
            updateAuthButtonText(false);
            updateMainButtonsState(false);
            mainTitle.textContent = 'Share Watchlist'; // Reset title on logout
            clearShareList();
            clearWatchlistUI();
            hideLoadingIndicator();
            applyTheme('system-default'); // Reset theme on logout
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
        }
        // Ensure initializeAppLogic is only called once after initial auth state is determined
        if (!window._appLogicInitialized) {
            initializeAppLogic();
            window._appLogicInitialized = true;
        }
    });
}

/**
 * Handles Google Sign-In.
 */
async function handleGoogleSignIn() {
    if (!window.authFunctions || !window.authFunctions.GoogleAuthProviderInstance || !window.authFunctions.signInWithPopup) {
        console.error("[Auth] Google Auth functions not available.");
        await showCustomDialog("Google Sign-In is not available. Please check Firebase configuration.", false);
        return;
    }
    try {
        const provider = window.authFunctions.GoogleAuthProviderInstance;
        await window.authFunctions.signInWithPopup(auth, provider);
        console.log("[Auth] Google Sign-In successful.");
    } catch (error) {
        console.error("[Auth] Google Sign-In failed:", error);
        let errorMessage = "Google Sign-In failed. Please try again.";
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = "Google Sign-In cancelled.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = "Google Sign-In cancelled. Please try again.";
        }
        await showCustomDialog(errorMessage, false);
    }
}

/**
 * Handles user logout.
 */
async function handleLogout() {
    if (!currentUserId) {
        console.log("[Auth] No user to sign out.");
        return;
    }

    const confirmLogout = await showCustomDialog("Are you sure you want to log out?", true);
    if (confirmLogout) {
        try {
            await window.authFunctions.signOut(auth);
            console.log("[Auth] User signed out.");
            // onAuthStateChanged listener will handle UI updates
        } catch (error) {
            console.error("[Auth] Error signing out:", error);
            await showCustomDialog("Failed to log out. Please try again.", false);
        }
    }
}


// --- WATCHLIST MANAGEMENT ---

/**
 * Fetches user watchlists from Firestore.
 * Sets up a real-time listener using onSnapshot.
 */
async function fetchUserWatchlists() {
    if (!db || !currentUserId) {
        console.warn("[Firestore] DB or User ID not available for fetching watchlists.");
        return;
    }

    // Unsubscribe from previous listener if exists
    if (unsubscribeWatchlists) {
        unsubscribeWatchlists();
        console.log("[Firestore Listener] Unsubscribed from previous watchlists listener.");
    }

    const watchlistsCollectionRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`);
    const q = window.firestore.query(watchlistsCollectionRef);

    unsubscribeWatchlists = window.firestore.onSnapshot(q, (snapshot) => {
        userWatchlists = [];
        snapshot.forEach(doc => {
            userWatchlists.push({ id: doc.id, ...doc.data() });
        });
        
        // Ensure the default watchlist exists
        let defaultWatchlist = userWatchlists.find(w => w.id === DEFAULT_WATCHLIST_ID_SUFFIX);
        if (!defaultWatchlist) {
            // If default doesn't exist, add it
            userWatchlists.unshift({ id: DEFAULT_WATCHLIST_ID_SUFFIX, name: DEFAULT_WATCHLIST_NAME, isDefault: true });
            // And save it to Firestore
            saveWatchlist({ id: DEFAULT_WATCHLIST_ID_SUFFIX, name: DEFAULT_WATCHLIST_NAME, isDefault: true });
        } else {
            // Ensure default is always at the top
            userWatchlists = userWatchlists.filter(w => w.id !== DEFAULT_WATCHLIST_ID_SUFFIX);
            userWatchlists.unshift(defaultWatchlist);
        }

        populateWatchlistSelect();
        // If no watchlists are selected, default to the first one (which will be the default)
        if (currentSelectedWatchlistIds.length === 0 && userWatchlists.length > 0) {
            currentSelectedWatchlistIds = [userWatchlists[0].id];
            watchlistSelect.value = userWatchlists[0].id;
        } else if (currentSelectedWatchlistIds.length > 0) {
            // Ensure selected watchlists still exist
            currentSelectedWatchlistIds = currentSelectedWatchlistIds.filter(id => userWatchlists.some(w => w.id === id));
            if (currentSelectedWatchlistIds.length === 0 && userWatchlists.length > 0) {
                currentSelectedWatchlistIds = [userWatchlists[0].id];
                watchlistSelect.value = userWatchlists[0].id;
            }
        }
        
        console.log("[Firestore Listener] Watchlists updated:", userWatchlists.map(w => w.name));
        fetchSharesForSelectedWatchlists(); // Re-fetch shares when watchlists change
    }, (error) => {
        console.error("[Firestore Listener] Error listening to watchlists:", error);
        updateFirebaseStatus('Error', 'red');
        hideLoadingIndicator();
    });
}

/**
 * Populates the watchlist select dropdown.
 */
function populateWatchlistSelect() {
    watchlistSelect.innerHTML = ''; // Clear existing options

    // Add "All Shares" option
    const allSharesOption = document.createElement('option');
    allSharesOption.value = ALL_SHARES_ID;
    allSharesOption.textContent = ALL_SHARES_NAME;
    watchlistSelect.appendChild(allSharesOption);

    // Add user-defined watchlists
    userWatchlists.forEach(watchlist => {
        if (watchlist.id !== DEFAULT_WATCHLIST_ID_SUFFIX) { // Exclude default as it's handled
            const option = document.createElement('option');
            option.value = watchlist.id;
            option.textContent = watchlist.name;
            watchlistSelect.appendChild(option);
        }
    });

    // Re-select the currently active watchlist(s)
    if (currentSelectedWatchlistIds.length > 0) {
        if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
            watchlistSelect.value = ALL_SHARES_ID;
        } else if (currentSelectedWatchlistIds.length === 1) {
            watchlistSelect.value = currentSelectedWatchlistIds[0];
        }
    } else if (userWatchlists.length > 0) {
        // Default to the first watchlist if nothing is selected
        watchlistSelect.value = userWatchlists[0].id;
        currentSelectedWatchlistIds = [userWatchlists[0].id];
    }
}

/**
 * Handles adding a new watchlist.
 */
async function handleAddWatchlist() {
    closeModals(); // Close any other open modals first
    newWatchlistNameInput.value = ''; // Clear input
    addWatchlistModal.style.display = 'block';
    addWatchlistModal.classList.add('active');
}

/**
 * Saves a new watchlist to Firestore.
 * @param {object} watchlistData - The watchlist object to save.
 */
async function saveWatchlist(watchlistData) {
    if (!db || !currentUserId) {
        console.error("[Firestore] DB or User ID not available for saving watchlist.");
        await showCustomDialog("Error: Not logged in to save watchlist.", false);
        return;
    }

    showLoadingIndicator();
    try {
        const watchlistsCollectionRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`);
        if (watchlistData.id) {
            const docRef = window.firestore.doc(watchlistsCollectionRef, watchlistData.id);
            await window.firestore.setDoc(docRef, { name: watchlistData.name, isDefault: watchlistData.isDefault || false }, { merge: true });
            console.log(`[Firestore] Watchlist '${watchlistData.name}' saved/updated.`);
            await showCustomDialog(`Watchlist "${watchlistData.name}" saved!`, false);
        } else {
            await window.firestore.addDoc(watchlistsCollectionRef, { name: watchlistData.name, createdAt: new Date() });
            console.log(`[Firestore] Watchlist '${watchlistData.name}' added.`);
            await showCustomDialog(`Watchlist "${watchlistData.name}" added!`, false);
        }
        closeModals();
    } catch (error) {
        console.error("[Firestore] Error saving watchlist:", error);
        await showCustomDialog("Failed to save watchlist. Please try again.", false);
    } finally {
        hideLoadingIndicator();
    }
}

/**
 * Handles editing the currently selected watchlist.
 */
async function handleEditWatchlist() {
    closeModals(); // Close any other open modals first

    if (currentSelectedWatchlistIds.length !== 1 || currentSelectedWatchlistIds[0] === ALL_SHARES_ID) {
        await showCustomDialog("Please select a single watchlist to edit (not 'All Shares').", false);
        return;
    }

    const selectedWatchlistId = currentSelectedWatchlistIds[0];
    const watchlistToEdit = userWatchlists.find(w => w.id === selectedWatchlistId);

    if (!watchlistToEdit) {
        await showCustomDialog("Selected watchlist not found.", false);
        return;
    }

    editWatchlistNameInput.value = watchlistToEdit.name;
    manageWatchlistModal.dataset.watchlistId = selectedWatchlistId; // Store ID for saving/deleting

    // Disable delete button for the default watchlist
    if (watchlistToEdit.isDefault) {
        setIconDisabled(deleteWatchlistInModalBtn, true);
        deleteWatchlistInModalBtn.title = "Cannot delete default watchlist";
    } else {
        setIconDisabled(deleteWatchlistInModalBtn, false);
        deleteWatchlistInModalBtn.title = "Delete Watchlist";
    }

    manageWatchlistModal.style.display = 'block';
    manageWatchlistModal.classList.add('active');
}

/**
 * Updates the name of a watchlist in Firestore.
 */
async function updateWatchlistName() {
    if (!db || !currentUserId) {
        console.error("[Firestore] DB or User ID not available for updating watchlist.");
        await showCustomDialog("Error: Not logged in to update watchlist.", false);
        return;
    }

    const watchlistId = manageWatchlistModal.dataset.watchlistId;
    const newName = editWatchlistNameInput.value.trim();

    if (!watchlistId || !newName) {
        await showCustomDialog("Watchlist ID or name is missing.", false);
        return;
    }

    showLoadingIndicator();
    try {
        const watchlistDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`, watchlistId);
        await window.firestore.updateDoc(watchlistDocRef, { name: newName });
        console.log(`[Firestore] Watchlist '${watchlistId}' name updated to '${newName}'.`);
        await showCustomDialog(`Watchlist "${newName}" updated!`, false);
        closeModals();
    } catch (error) {
        console.error("[Firestore] Error updating watchlist name:", error);
        await showCustomDialog("Failed to update watchlist name. Please try again.", false);
    } finally {
        hideLoadingIndicator();
    }
}

/**
 * Deletes a watchlist from Firestore and reassigns its shares.
 */
async function deleteWatchlist() {
    if (!db || !currentUserId) {
        console.error("[Firestore] DB or User ID not available for deleting watchlist.");
        await showCustomDialog("Error: Not logged in to delete watchlist.", false);
        return;
    }

    const watchlistId = manageWatchlistModal.dataset.watchlistId;
    const watchlistToDelete = userWatchlists.find(w => w.id === watchlistId);

    if (!watchlistId || !watchlistToDelete) {
        await showCustomDialog("Watchlist not found for deletion.", false);
        return;
    }

    if (watchlistToDelete.isDefault) {
        await showCustomDialog("The default watchlist cannot be deleted.", false);
        return;
    }

    const confirmDelete = await showCustomDialog(`Are you sure you want to delete "${watchlistToDelete.name}"? All shares in this watchlist will be moved to "${DEFAULT_WATCHLIST_NAME}".`, true);
    if (!confirmDelete) {
        return;
    }

    showLoadingIndicator();
    try {
        const sharesCollectionRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
        const q = window.firestore.query(sharesCollectionRef, window.firestore.where('watchlistIds', 'array-contains', watchlistId));
        const sharesSnapshot = await window.firestore.getDocs(q);

        const batch = window.firestore.writeBatch(db);

        sharesSnapshot.forEach(shareDoc => {
            const currentWatchlistIds = shareDoc.data().watchlistIds || [];
            const updatedWatchlistIds = currentWatchlistIds.filter(id => id !== watchlistId);

            // If a share is only in this watchlist, move it to default
            if (updatedWatchlistIds.length === 0) {
                updatedWatchlistIds.push(DEFAULT_WATCHLIST_ID_SUFFIX);
            }
            const shareDocRef = window.firestore.doc(sharesCollectionRef, shareDoc.id);
            batch.update(shareDocRef, { watchlistIds: updatedWatchlistIds });
        });

        // Delete the watchlist document itself
        const watchlistDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`, watchlistId);
        batch.delete(watchlistDocRef);

        await batch.commit();
        console.log(`[Firestore] Watchlist '${watchlistToDelete.name}' deleted and shares re-assigned.`);
        await showCustomDialog(`Watchlist "${watchlistToDelete.name}" deleted. Shares moved to "${DEFAULT_WATCHLIST_NAME}".`, false);
        closeModals();
        // The onSnapshot listener for watchlists will trigger fetchSharesForSelectedWatchlists
    } catch (error) {
        console.error("[Firestore] Error deleting watchlist:", error);
        await showCustomDialog("Failed to delete watchlist. Please try again.", false);
    } finally {
        hideLoadingIndicator();
    }
}

/**
 * Clears the watchlist UI elements.
 */
function clearWatchlistUI() {
    watchlistSelect.innerHTML = '<option value="" disabled selected>No Watchlists</option>';
    userWatchlists = [];
    currentSelectedWatchlistIds = [];
}


// --- SHARE DATA MANAGEMENT ---

/**
 * Fetches shares for the currently selected watchlists from Firestore.
 * Sets up a real-time listener using onSnapshot.
 */
async function fetchSharesForSelectedWatchlists() {
    if (!db || !currentUserId) {
        console.warn("[Firestore] DB or User ID not available for fetching shares.");
        clearShareList();
        hideLoadingIndicator();
        return;
    }

    // Unsubscribe from previous listener if exists
    if (unsubscribeShares) {
        unsubscribeShares();
        console.log("[Firestore Listener] Unsubscribed from previous shares listener.");
    }

    showLoadingIndicator();
    clearShareList(); // Clear current display while loading

    const sharesCollectionRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
    let q;

    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        // If "All Shares" is selected, fetch all shares for the user
        q = window.firestore.query(sharesCollectionRef);
        console.log("[Firestore Listener] Fetching all shares for user.");
    } else if (currentSelectedWatchlistIds.length > 0) {
        // If specific watchlists are selected, filter by them
        q = window.firestore.query(sharesCollectionRef, window.firestore.where('watchlistIds', 'array-contains-any', currentSelectedWatchlistIds));
        console.log("[Firestore Listener] Fetching shares for watchlists:", currentSelectedWatchlistIds);
    } else {
        // No specific watchlists selected and not "All Shares"
        // This case should ideally not happen if default watchlist is handled correctly,
        // but as a fallback, show no shares.
        console.log("[Firestore Listener] No watchlists selected, showing no shares.");
        allSharesData = [];
        renderShares();
        hideLoadingIndicator();
        return;
    }

    unsubscribeShares = window.firestore.onSnapshot(q, (snapshot) => {
        allSharesData = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            allSharesData.push({ id: doc.id, ...data });
        });
        console.log("[Firestore Listener] Shares updated. Total:", allSharesData.length);
        renderShares(); // Re-render shares whenever data changes
        hideLoadingIndicator();
        noSharesMessage.style.display = allSharesData.length === 0 ? 'block' : 'none';
    }, (error) => {
        console.error("[Firestore Listener] Error listening to shares:", error);
        updateFirebaseStatus('Error', 'red');
        hideLoadingIndicator();
        noSharesMessage.style.display = 'block'; // Show message on error too
        noSharesMessage.textContent = "Error loading shares. Please try again.";
    });
}


/**
 * Renders the shares in the table (desktop) and cards (mobile).
 */
function renderShares() {
    // Sort shares based on current sort selection
    const sortBy = sortSelect.value.split('-')[0];
    const sortOrder = sortSelect.value.split('-')[1];

    const sortedShares = [...allSharesData].sort((a, b) => {
        let valA, valB;

        switch (sortBy) {
            case 'entryDate':
                valA = new Date(a.entryDate || '1970-01-01');
                valB = new Date(b.entryDate || '1970-01-01');
                break;
            case 'name':
                valA = a.shareName ? a.shareName.toLowerCase() : '';
                valB = b.shareName ? b.shareName.toLowerCase() : '';
                break;
            case 'enteredPrice':
            case 'currentPrice':
            case 'targetPrice':
            case 'dividendAmount':
            case 'unfrankedYield':
            case 'frankedYield':
                valA = parseFloat(a[sortBy] || 0);
                valB = parseFloat(b[sortBy] || 0);
                break;
            default:
                return 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    shareTableBody.innerHTML = ''; // Clear existing table rows
    mobileShareCardsContainer.innerHTML = ''; // Clear existing mobile cards

    if (sortedShares.length === 0) {
        noSharesMessage.style.display = 'block';
        return;
    } else {
        noSharesMessage.style.display = 'none';
    }

    sortedShares.forEach(share => {
        const unfrankedYield = calculateUnfrankedYield(share.currentPrice, share.dividendAmount);
        const frankedYield = calculateFrankedYield(unfrankedYield, share.frankingCredits);

        // Desktop Table Row
        const row = shareTableBody.insertRow();
        row.dataset.docId = share.id; // Store doc ID on the row
        row.innerHTML = `
            <td>${share.shareName || '-'}</td>
            <td>${share.entryDate || '-'}</td>
            <td>${formatCurrency(share.enteredPrice)}</td>
            <td>${formatCurrency(share.currentPrice)}</td>
            <td>${formatCurrency(share.targetPrice)}</td>
            <td>${formatCurrency(share.dividendAmount)}</td>
            <td>${formatPercentage(share.frankingCredits)}</td>
            <td>${formatPercentage(unfrankedYield)}</td>
            <td>${formatPercentage(frankedYield)}</td>
        `;
        row.addEventListener('click', (event) => handleShareRowClick(event, share.id));
        row.addEventListener('dblclick', (event) => handleShareRowDoubleClick(event, share.id));
        row.addEventListener('contextmenu', (event) => handleContextMenu(event, share.id));
        row.addEventListener('touchstart', (event) => handleTouchStart(event, row, share.id));
        row.addEventListener('touchmove', handleTouchMove);
        row.addEventListener('touchend', handleTouchEnd);


        // Mobile Card
        const card = document.createElement('div');
        card.classList.add('mobile-share-card');
        card.dataset.docId = share.id; // Store doc ID on the card
        card.innerHTML = `
            <h3>${share.shareName || '-'}</h3>
            <p><strong>Entry Date:</strong> ${share.entryDate || '-'}</p>
            <p><strong>Entered Price:</strong> ${formatCurrency(share.enteredPrice)}</p>
            <p><strong>Current Price:</strong> ${formatCurrency(share.currentPrice)}</p>
            <p><strong>Target Price:</strong> ${formatCurrency(share.targetPrice)}</p>
            <p><strong>Dividend Amt:</strong> ${formatCurrency(share.dividendAmount)}</p>
            <p><strong>Franking %:</strong> ${formatPercentage(share.frankingCredits)}</p>
            <p><strong>Unfranked Yield:</strong> ${formatPercentage(unfrankedYield)}</p>
            <p><strong>Franked Yield:</strong> ${formatPercentage(frankedYield)}</p>
        `;
        card.addEventListener('click', (event) => handleShareRowClick(event, share.id));
        card.addEventListener('dblclick', (event) => handleShareRowDoubleClick(event, share.id));
        card.addEventListener('contextmenu', (event) => handleContextMenu(event, share.id));
        card.addEventListener('touchstart', (event) => handleTouchStart(event, card, share.id));
        card.addEventListener('touchmove', handleTouchMove);
        card.addEventListener('touchend', handleTouchEnd);
        mobileShareCardsContainer.appendChild(card);
    });
}

/**
 * Clears all share data from the UI.
 */
function clearShareList() {
    shareTableBody.innerHTML = '';
    mobileShareCardsContainer.innerHTML = '';
    allSharesData = []; // Clear the in-memory data
    noSharesMessage.style.display = 'block'; // Show "No shares" message
}

/**
 * Handles clicks on share table rows or mobile cards.
 * @param {Event} event - The click event.
 * @param {string} docId - The Firestore document ID of the share.
 */
function handleShareRowClick(event, docId) {
    // Prevent context menu from showing if this was part of a long press
    if (event.detail === 0 && event.type === 'click' && event.button === 0) { // Check for synthetic click from touchend
        if (selectedElementForTap && selectedElementForTap.dataset.docId === docId) {
            // This click was likely a long press that triggered context menu,
            // so don't open detail modal.
            selectedElementForTap = null; // Reset
            return;
        }
    }
    // Handle single click (e.g., for selection or quick view if needed)
    console.log(`Clicked on share with ID: ${docId}`);
    // You might add a visual selection here, or do nothing for a single click
    // if double-click is the primary action for details.
}

/**
 * Handles double-clicks on share table rows or mobile cards.
 * @param {Event} event - The double-click event.
 * @param {string} docId - The Firestore document ID of the share.
 */
function handleShareRowDoubleClick(event, docId) {
    event.preventDefault(); // Prevent default double-click behavior (e.g., text selection)
    selectedShareDocId = docId;
    displayShareDetails(docId);
}

/**
 * Handles context menu (right-click) on share rows/cards.
 * @param {Event} event - The contextmenu event.
 * @param {string} docId - The Firestore document ID of the share.
 */
function handleContextMenu(event, docId) {
    event.preventDefault(); // Prevent default browser context menu
    selectedShareDocId = docId; // Store the ID of the share being acted upon

    // Position the custom context menu
    shareContextMenu.style.left = `${event.clientX}px`;
    shareContextMenu.style.top = `${event.clientY}px`;
    shareContextMenu.style.display = 'block';
    shareContextMenu.dataset.shareDocId = docId; // Store the doc ID on the context menu itself

    // Hide context menu if user clicks elsewhere
    document.addEventListener('click', hideContextMenu, { once: true });
}

/**
 * Handles touch start for long press detection.
 * @param {TouchEvent} event - The touchstart event.
 * @param {HTMLElement} element - The element being touched (row or card).
 * @param {string} docId - The Firestore document ID of the share.
 */
function handleTouchStart(event, element, docId) {
    event.stopPropagation(); // Prevent parent elements from also detecting touch
    lastTapTime = new Date().getTime();
    selectedElementForTap = element; // Store the element
    selectedShareDocId = docId; // Store the ID

    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;

    longPressTimer = setTimeout(() => {
        // Simulate right-click for context menu
        const touch = event.touches[0];
        const simulatedEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 2, // Right mouse button
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        element.dispatchEvent(simulatedEvent);
        selectedElementForTap = null; // Reset after long press
    }, LONG_PRESS_THRESHOLD);
}

/**
 * Handles touch move to cancel long press if finger moves too much.
 * @param {TouchEvent} event - The touchmove event.
 */
function handleTouchMove(event) {
    if (longPressTimer) {
        const touch = event.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartX);
        const deltaY = Math.abs(touch.clientY - touchStartY);

        if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            selectedElementForTap = null; // Reset
        }
    }
}

/**
 * Handles touch end for single tap vs double tap.
 * @param {TouchEvent} event - The touchend event.
 */
function handleTouchEnd(event) {
    clearTimeout(longPressTimer); // Clear long press timer if finger lifted before threshold

    if (selectedElementForTap) { // Only proceed if an element was selected for tap
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;

        if (tapLength < LONG_PRESS_THRESHOLD) { // This was a short tap, not a long press
            if (tapTimeout && selectedElementForTap.dataset.docId === selectedShareDocId) {
                // Double tap detected
                clearTimeout(tapTimeout);
                tapTimeout = null;
                handleShareRowDoubleClick(event, selectedShareDocId);
                selectedElementForTap = null; // Reset after double tap
            } else {
                // First tap in a potential double tap sequence
                tapTimeout = setTimeout(() => {
                    tapTimeout = null;
                    handleShareRowClick(event, selectedShareDocId); // Treat as single click if no second tap
                    selectedElementForTap = null; // Reset after single tap
                }, 300); // Time window for double tap
            }
        }
    }
}


/**
 * Displays the share details in a modal.
 * @param {string} docId - The Firestore document ID of the share.
 */
async function displayShareDetails(docId) {
    const share = allSharesData.find(s => s.id === docId);
    if (!share) {
        await showCustomDialog("Share details not found.", false);
        return;
    }

    modalShareName.textContent = share.shareName || 'N/A';
    modalEntryDate.textContent = share.entryDate || 'N/A';
    modalEnteredPrice.textContent = formatCurrency(share.enteredPrice);
    modalCurrentPrice.textContent = formatCurrency(share.currentPrice);
    modalTargetPrice.textContent = formatCurrency(share.targetPrice);
    modalDividendAmount.textContent = formatCurrency(share.dividendAmount);
    modalFrankingCredits.textContent = formatPercentage(share.frankingCredits);

    const unfrankedYield = calculateUnfrankedYield(share.currentPrice, share.dividendAmount);
    const frankedYield = calculateFrankedYield(unfrankedYield, share.frankingCredits);
    modalUnfrankedYield.textContent = formatPercentage(unfrankedYield);
    modalFrankedYield.textContent = formatPercentage(frankedYield);
    modalNotes.textContent = share.notes || 'No notes.';

    // Populate comments
    modalCommentsContainer.innerHTML = '';
    if (share.comments && share.comments.length > 0) {
        share.comments.forEach(comment => {
            const commentDiv = document.createElement('div');
            commentDiv.classList.add('comment-item');
            commentDiv.innerHTML = `
                <p class="comment-text">${comment.text}</p>
                <p class="comment-date">${new Date(comment.timestamp).toLocaleDateString()}</p>
            `;
            modalCommentsContainer.appendChild(commentDiv);
        });
    } else {
        modalCommentsContainer.innerHTML = '<p class="info-message">No comments for this share.</p>';
    }

    // Update external links
    const baseUrlNews = `https://www.google.com/search?q=${share.shareName}+ASX+news`;
    const baseUrlMarketIndex = `https://www.marketindex.com.au/asx/${share.shareName}`;
    const baseUrlFool = `https://www.fool.com.au/stock-centre/${share.shareName}/`;
    const baseUrlCommSec = `https://www.commsec.com.au/market-insights/company-research/ASX-${share.shareName}.html`;

    modalNewsLink.href = baseUrlNews;
    modalMarketIndexLink.href = baseUrlMarketIndex;
    modalFoolLink.href = baseUrlFool;
    modalCommSecLink.href = baseUrlCommSec;

    // Store the docId on the modal for editing/deleting from detail view
    shareDetailModal.dataset.docId = docId;
    selectedShareDocId = docId; // Ensure global selectedShareDocId is set

    closeModals(); // Close any other open modals first
    shareDetailModal.style.display = 'block';
    shareDetailModal.classList.add('active');
}

/**
 * Opens the share form for adding a new share or editing an existing one.
 * @param {string|null} docId - The Firestore document ID of the share to edit, or null for a new share.
 */
async function openShareForm(docId = null) {
    closeModals(); // Close any other open modals first
    shareForm.reset(); // Clear form fields
    commentsFormContainer.innerHTML = '<h3>Comments <span id="addCommentSectionBtn" class="add-section-icon"><i class="fas fa-plus"></i></span></h3>'; // Reset comments
    selectedShareDocId = docId; // Set the global selectedShareDocId

    if (docId) {
        formTitle.textContent = 'Edit Share';
        setIconDisabled(deleteShareBtn, false); // Enable delete button for existing shares
        const shareToEdit = allSharesData.find(s => s.id === docId);
        if (shareToEdit) {
            shareNameInput.value = shareToEdit.shareName || '';
            entryDateInput.value = shareToEdit.entryDate || '';
            enteredPriceInput.value = shareToEdit.enteredPrice || '';
            currentPriceInput.value = shareToEdit.currentPrice || '';
            targetPriceInput.value = shareToEdit.targetPrice || '';
            dividendAmountInput.value = shareToEdit.dividendAmount || '';
            frankingCreditsInput.value = shareToEdit.frankingCredits || '';
            notesInput.value = shareToEdit.notes || '';

            // Populate existing comments
            if (shareToEdit.comments && shareToEdit.comments.length > 0) {
                shareToEdit.comments.forEach(comment => addCommentField(comment.text, comment.timestamp));
            }
        }
    } else {
        formTitle.textContent = 'Add New Share';
        setIconDisabled(deleteShareBtn, true); // Disable delete button for new shares
        // Set default entry date to today
        entryDateInput.value = new Date().toISOString().split('T')[0];
    }

    shareFormSection.style.display = 'block';
    shareFormSection.classList.add('active');
    shareNameInput.focus(); // Focus on the first input field
}

/**
 * Adds a new comment input field to the share form.
 * @param {string} [commentText=''] - Pre-fill text for the comment.
 * @param {string} [timestamp=''] - Pre-fill timestamp for the comment.
 */
function addCommentField(commentText = '', timestamp = '') {
    const commentDiv = document.createElement('div');
    commentDiv.classList.add('comment-input-group');
    commentDiv.innerHTML = `
        <textarea class="comment-input" rows="3" placeholder="Enter your comment...">${commentText}</textarea>
        <span class="comment-date-display">${timestamp ? new Date(timestamp).toLocaleDateString() : 'New Comment'}</span>
        <button type="button" class="delete-comment-btn"><i class="fas fa-trash-alt"></i></button>
    `;
    commentsFormContainer.appendChild(commentDiv);

    // Add event listener to the new delete button
    commentDiv.querySelector('.delete-comment-btn').addEventListener('click', function() {
        commentDiv.remove();
    });
}

/**
 * Saves a share (new or updated) to Firestore.
 */
async function saveShare() {
    if (!db || !currentUserId) {
        await showCustomDialog("Error: Not logged in to save share.", false);
        return;
    }

    const shareName = shareNameInput.value.trim().toUpperCase(); // Convert to uppercase for consistency
    const entryDate = entryDateInput.value;
    const enteredPrice = parseFloat(enteredPriceInput.value);
    const currentPrice = parseFloat(currentPriceInput.value) || 0; // Default to 0 if empty
    const targetPrice = parseFloat(targetPriceInput.value) || 0; // Default to 0 if empty
    const dividendAmount = parseFloat(dividendAmountInput.value) || 0; // Default to 0 if empty
    const frankingCredits = parseFloat(frankingCreditsInput.value) || 0; // Default to 0 if empty
    const notes = notesInput.value.trim();

    if (!shareName || !entryDate || isNaN(enteredPrice)) {
        await showCustomDialog("Please fill in Share Name, Entry Date, and Entered Price.", false);
        return;
    }

    // Collect comments
    const comments = [];
    document.querySelectorAll('.comment-input-group').forEach(group => {
        const text = group.querySelector('.comment-input').value.trim();
        const dateDisplay = group.querySelector('.comment-date-display').textContent;
        // If it's a new comment, timestamp it now. Otherwise, keep existing.
        const timestamp = dateDisplay === 'New Comment' ? new Date().toISOString() : new Date(dateDisplay).toISOString();
        if (text) {
            comments.push({ text, timestamp });
        }
    });

    showLoadingIndicator();
    try {
        const sharesCollectionRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
        const shareData = {
            shareName,
            entryDate,
            enteredPrice,
            currentPrice,
            targetPrice,
            dividendAmount,
            frankingCredits,
            notes,
            comments,
            updatedAt: new Date(),
            // Ensure the share is added to the currently selected watchlist(s)
            // If no specific watchlist is selected (e.g., 'All Shares' is active), default to the user's default watchlist.
            watchlistIds: currentSelectedWatchlistIds.includes(ALL_SHARES_ID) || currentSelectedWatchlistIds.length === 0
                ? [DEFAULT_WATCHLIST_ID_SUFFIX]
                : currentSelectedWatchlistIds
        };

        if (selectedShareDocId) {
            // Update existing share
            const shareDocRef = window.firestore.doc(sharesCollectionRef, selectedShareDocId);
            await window.firestore.updateDoc(shareDocRef, shareData);
            console.log(`[Firestore] Share '${shareName}' updated.`);
            await showCustomDialog(`Share "${shareName}" updated!`, false);
        } else {
            // Add new share
            shareData.createdAt = new Date(); // Add creation timestamp for new shares
            await window.firestore.addDoc(sharesCollectionRef, shareData);
            console.log(`[Firestore] Share '${shareName}' added.`);
            await showCustomDialog(`Share "${shareName}" added!`, false);
        }
        closeModals();
    } catch (error) {
        console.error("[Firestore] Error saving share:", error);
        await showCustomDialog("Failed to save share. Please try again.", false);
    } finally {
        hideLoadingIndicator();
    }
}

/**
 * Deletes a share from Firestore.
 */
async function deleteShare() {
    if (!db || !currentUserId) {
        await showCustomDialog("Error: Not logged in to delete share.", false);
        return;
    }

    if (!selectedShareDocId) {
        await showCustomDialog("No share selected for deletion.", false);
        return;
    }

    const shareToDelete = allSharesData.find(s => s.id === selectedShareDocId);
    const confirmDelete = await showCustomDialog(`Are you sure you want to delete "${shareToDelete ? shareToDelete.shareName : 'this share'}"?`, true);

    if (confirmDelete) {
        showLoadingIndicator();
        try {
            const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, selectedShareDocId);
            await window.firestore.deleteDoc(shareDocRef);
            console.log(`[Firestore] Share '${selectedShareDocId}' deleted.`);
            await showCustomDialog("Share deleted successfully!", false);
            closeModals();
            selectedShareDocId = null; // Clear selected ID
            // The onSnapshot listener will automatically update the UI
        } catch (error) {
            console.error("[Firestore] Error deleting share:", error);
            await showCustomDialog("Failed to delete share. Please try again.", false);
        } finally {
            hideLoadingIndicator();
        }
    }
}


// --- CALCULATOR LOGIC ---

/**
 * Updates the display of the standard calculator.
 */
function updateCalculatorDisplay() {
    calculatorInput.textContent = currentCalculatorInput;
    calculatorResult.textContent = previousCalculatorInput || '0';
}

/**
 * Resets the standard calculator to its initial state.
 */
function resetCalculator() {
    currentCalculatorInput = '';
    operator = null;
    previousCalculatorInput = '';
    resultDisplayed = false;
    updateCalculatorDisplay();
}

/**
 * Handles number button clicks for the standard calculator.
 * @param {string} number - The number string.
 */
function handleNumberClick(number) {
    if (resultDisplayed) {
        currentCalculatorInput = number;
        resultDisplayed = false;
    } else {
        currentCalculatorInput += number;
    }
    updateCalculatorDisplay();
}

/**
 * Handles decimal point button click for the standard calculator.
 */
function handleDecimalClick() {
    if (resultDisplayed) {
        currentCalculatorInput = '0.';
        resultDisplayed = false;
    } else if (!currentCalculatorInput.includes('.')) {
        currentCalculatorInput += '.';
    }
    updateCalculatorDisplay();
}

/**
 * Handles operator button clicks for the standard calculator.
 * @param {string} op - The operator string.
 */
function handleOperatorClick(op) {
    if (currentCalculatorInput === '' && previousCalculatorInput === '') return;

    if (currentCalculatorInput !== '') {
        if (previousCalculatorInput !== '' && operator) {
            // If there's a previous result and an operator, calculate first
            calculateResult();
        }
        previousCalculatorInput = currentCalculatorInput;
        currentCalculatorInput = '';
    }
    operator = op;
    resultDisplayed = false; // Allow new input after operator
    updateCalculatorDisplay();
}

/**
 * Performs the calculation for the standard calculator.
 */
function calculateResult() {
    let result = 0;
    const prev = parseFloat(previousCalculatorInput);
    const current = parseFloat(currentCalculatorInput);

    if (isNaN(prev) || isNaN(current)) return;

    switch (operator) {
        case '+':
            result = prev + current;
            break;
        case '-':
            result = prev - current;
            break;
        case '*':
            result = prev * current;
            break;
        case '/':
            if (current === 0) {
                showCustomDialog("Cannot divide by zero!", false);
                result = 0; // Reset result
            } else {
                result = prev / current;
            }
            break;
        case '%': // Percentage of previous number
            result = prev * (current / 100);
            break;
        default:
            return;
    }

    currentCalculatorInput = result.toString();
    previousCalculatorInput = ''; // Clear previous for next operation
    operator = null;
    resultDisplayed = true;
    updateCalculatorDisplay();
}

/**
 * Handles backspace for the standard calculator.
 */
function handleBackspace() {
    currentCalculatorInput = currentCalculatorInput.slice(0, -1);
    if (currentCalculatorInput === '') {
        calculatorInput.textContent = ''; // Clear input display fully
    }
    updateCalculatorDisplay();
}

/**
 * Calculates and displays dividend yield values.
 */
function calculateDividendYields() {
    const currentPrice = parseFloat(calcCurrentPriceInput.value);
    const dividendAmount = parseFloat(calcDividendAmountInput.value);
    const frankingCredits = parseFloat(calcFrankingCreditsInput.value);

    if (isNaN(currentPrice) || isNaN(dividendAmount) || isNaN(frankingCredits)) {
        calcUnfrankedYield.textContent = '-';
        calcFrankedYield.textContent = '-';
        calcEstimatedDividend.textContent = '-';
        return;
    }

    const unfranked = calculateUnfrankedYield(currentPrice, dividendAmount);
    const franked = calculateFrankedYield(unfranked, frankingCredits);

    calcUnfrankedYield.textContent = formatPercentage(unfranked);
    calcFrankedYield.textContent = formatPercentage(franked);

    // Calculate estimated annual dividend based on selected investment value
    const investmentValue = parseFloat(investmentValueSelect.value);
    if (!isNaN(investmentValue) && currentPrice > 0) {
        const numberOfShares = investmentValue / currentPrice;
        const estimatedDividend = numberOfShares * dividendAmount;
        calcEstimatedDividend.textContent = formatCurrency(estimatedDividend);
    } else {
        calcEstimatedDividend.textContent = '-';
    }
}


// --- EVENT LISTENERS ---

// Sidebar / Hamburger Menu
hamburgerBtn.addEventListener('click', () => {
    appSidebar.classList.add('active');
    sidebarOverlay.classList.add('active');
});

closeMenuBtn.addEventListener('click', () => {
    appSidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
});

sidebarOverlay.addEventListener('click', () => {
    appSidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
});

// Close sidebar if a menu item that closes the menu is clicked
appSidebar.addEventListener('click', (event) => {
    const menuItem = event.target.closest('.menu-button-item, .menu-select-item');
    if (menuItem && menuItem.dataset.actionClosesMenu === 'true') {
        appSidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }
});


// Share Form
addShareHeaderBtn.addEventListener('click', () => openShareForm());
newShareBtn.addEventListener('click', () => openShareForm());
cancelFormBtn.addEventListener('click', closeModals);
saveShareBtn.addEventListener('click', saveShare);
deleteShareBtn.addEventListener('click', deleteShare);

// Share Detail Modal
editShareFromDetailBtn.addEventListener('click', () => openShareForm(selectedShareDocId));
deleteShareFromDetailBtn.addEventListener('click', deleteShare);

// Comments section
addCommentSectionBtn.addEventListener('click', () => addCommentField());

// Watchlist Management
addWatchlistBtn.addEventListener('click', handleAddWatchlist);
saveWatchlistBtn.addEventListener('click', async () => {
    const newName = newWatchlistNameInput.value.trim();
    if (newName) {
        await saveWatchlist({ name: newName });
    } else {
        await showCustomDialog("Watchlist name cannot be empty.", false);
    }
});
cancelAddWatchlistBtn.addEventListener('click', closeModals);

editWatchlistBtn.addEventListener('click', handleEditWatchlist);
saveWatchlistNameBtn.addEventListener('click', updateWatchlistName);
deleteWatchlistInModalBtn.addEventListener('click', deleteWatchlist);
cancelManageWatchlistBtn.addEventListener('click', closeModals);


// Watchlist and Sort Selects
watchlistSelect.addEventListener('change', (event) => {
    const selectedId = event.target.value;
    currentSelectedWatchlistIds = [selectedId]; // Only one can be selected in this dropdown
    fetchSharesForSelectedWatchlists();
});

sortSelect.addEventListener('change', renderShares); // Re-render shares when sort order changes


// ASX Code Suggestions (dynamic buttons)
shareNameInput.addEventListener('input', async () => {
    const input = shareNameInput.value.trim().toUpperCase();
    asxCodeButtonsContainer.innerHTML = ''; // Clear previous buttons

    if (input.length >= 2) {
        // Simple mock suggestions for demonstration
        const suggestions = ['BHP', 'CBA', 'ANZ', 'NAB', 'WBC', 'RIO', 'FMG', 'TLS', 'MQG', 'WES']
            .filter(code => code.startsWith(input))
            .slice(0, 5); // Limit to 5 suggestions

        suggestions.forEach(code => {
            const button = document.createElement('button');
            button.classList.add('asx-code-btn');
            button.textContent = code;
            button.addEventListener('click', () => {
                shareNameInput.value = code;
                asxCodeButtonsContainer.innerHTML = ''; // Clear buttons after selection
            });
            asxCodeButtonsContainer.appendChild(button);
        });
    }
});


// Dividend Calculator
dividendCalcBtn.addEventListener('click', () => {
    closeModals();
    dividendCalculatorModal.style.display = 'block';
    dividendCalculatorModal.classList.add('active');
    // Initial calculation on open if values exist
    calculateDividendYields();
});

calcCurrentPriceInput.addEventListener('input', calculateDividendYields);
calcDividendAmountInput.addEventListener('input', calculateDividendYields);
calcFrankingCreditsInput.addEventListener('input', calculateDividendYields);
investmentValueSelect.addEventListener('change', calculateDividendYields);


// Standard Calculator
standardCalcBtn.addEventListener('click', () => {
    closeModals();
    calculatorModal.style.display = 'block';
    calculatorModal.classList.add('active');
    resetCalculator(); // Reset calculator state on open
});

calculatorButtons.addEventListener('click', (event) => {
    const target = event.target;
    if (target.tagName === 'BUTTON') {
        const value = target.dataset.value;
        const action = target.dataset.action;

        if (value) {
            handleNumberClick(value);
        } else if (action === 'clear') {
            resetCalculator();
        } else if (action === 'backspace') {
            handleBackspace();
        } else if (action === 'calculate') {
            calculateResult();
        } else if (action) { // Operators
            handleOperatorClick(target.textContent);
        }
    }
});


// Custom Dialog Buttons
customDialogConfirmBtn.addEventListener('click', () => {
    if (currentDialogCallback) {
        currentDialogCallback(true);
    }
});

customDialogCancelBtn.addEventListener('click', () => {
    if (currentDialogCallback) {
        currentDialogCallback(false);
    }
});


// Theme Toggling
themeToggleBtn.addEventListener('click', toggleTheme);
colorThemeSelect.addEventListener('change', (event) => {
    applyTheme(event.target.value);
});
revertToDefaultThemeBtn.addEventListener('click', () => {
    applyTheme('system-default');
    colorThemeSelect.value = 'none'; // Reset dropdown
});

// Export Watchlist
exportWatchlistBtn.addEventListener('click', async () => {
    if (allSharesData.length === 0) {
        await showCustomDialog("No shares to export.", false);
        return;
    }

    const confirmExport = await showCustomDialog("Export current watchlist to CSV?", true);
    if (!confirmExport) {
        return;
    }

    const headers = [
        "Share Name", "Entry Date", "Entered Price", "Current Price", "Target Price",
        "Dividend Amount", "Franking Credits (%)", "Unfranked Yield (%)", "Franked Yield (%)", "Notes", "Comments"
    ];

    const csvRows = [];
    csvRows.push(headers.join(',')); // Add headers

    allSharesData.forEach(share => {
        const unfrankedYield = calculateUnfrankedYield(share.currentPrice, share.dividendAmount);
        const frankedYield = calculateFrankedYield(unfrankedYield, share.frankingCredits);

        const commentsText = (share.comments || []).map(c => `${new Date(c.timestamp).toLocaleDateString()}: ${c.text.replace(/"/g, '""')}`).join('; ');

        const row = [
            `"${share.shareName || ''}"`,
            `"${share.entryDate || ''}"`,
            `"${share.enteredPrice || ''}"`,
            `"${share.currentPrice || ''}"`,
            `"${share.targetPrice || ''}"`,
            `"${share.dividendAmount || ''}"`,
            `"${share.frankingCredits || ''}"`,
            `"${unfrankedYield.toFixed(2) || ''}"`,
            `"${frankedYield.toFixed(2) || ''}"`,
            `"${(share.notes || '').replace(/"/g, '""')}"`, // Escape double quotes
            `"${commentsText}"`
        ];
        csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `watchlist_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href); // Clean up
    await showCustomDialog("Watchlist exported to CSV!", false);
});


// Context Menu Actions
contextEditShareBtn.addEventListener('click', () => {
    if (shareContextMenu.dataset.shareDocId) {
        openShareForm(shareContextMenu.dataset.shareDocId);
    }
    hideContextMenu();
});

contextDeleteShareBtn.addEventListener('click', () => {
    if (shareContextMenu.dataset.shareDocId) {
        selectedShareDocId = shareContextMenu.dataset.shareDocId; // Ensure global ID is set
        deleteShare();
    }
    hideContextMenu();
});

// Scroll to Top Button
window.addEventListener('scroll', () => {
    if (window.scrollY > 200) { // Show button after scrolling 200px
        scrollToTopBtn.style.display = 'block';
    } else {
        scrollToTopBtn.style.display = 'none';
    }
});

scrollToTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth' // Smooth scrolling
    });
});


// --- INITIALIZATION ---

/**
 * Main application logic initialization.
 * This function is called once after the initial Firebase auth state is determined.
 */
function initializeAppLogic() {
    console.log("[App Logic] Initializing main application logic.");

    // Load theme preference
    const savedTheme = localStorage.getItem('themePreference');
    if (savedTheme) {
        applyTheme(savedTheme);
        colorThemeSelect.value = savedTheme;
    } else {
        applyTheme('system-default'); // Apply default if no preference
        colorThemeSelect.value = 'none';
    }

    // Initialize Firebase and Auth
    initializeFirebaseAndAuth();

    // Enable Google Auth button only after script is fully loaded
    if (googleAuthBtn) {
        googleAuthBtn.disabled = false;
        console.log("[Auth] Google Auth button enabled on DOMContentLoaded.");
    }
}


// Event listener for when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("[script.js] DOMContentLoaded fired.");

    // Check if Firebase global objects are available from index.html
    if (window.firestoreDb && window.firebaseAuth && window.getFirebaseAppId && window.firestore && window.authFunctions) {
        console.log("[Firebase] Global Firebase objects are available in script.js.");
        
        // Attach event listeners for auth buttons
        if (googleAuthBtn) {
            googleAuthBtn.addEventListener('click', handleGoogleSignIn);
        }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        // The rest of the app logic will be initialized once Firebase auth state is known
        // via the onAuthStateChanged listener in initializeFirebaseAndAuth().
        // We call initializeFirebaseAndAuth here, but it contains a flag
        // `window._appLogicInitialized` to prevent re-initialization.
        // This ensures it runs after DOM is ready.
        if (!window._appLogicInitialized) {
            initializeAppLogic();
            window._appLogicInitialized = true;
        }

    } else {
        console.error("[Firebase] Firebase objects (db, auth, appId, firestore, authFunctions) are not available on DOMContentLoaded. Firebase initialization likely failed in index.html.");
        const errorDiv = document.getElementById('firebaseInitError');
        if (errorDiv) {
            errorDiv.style.display = 'block';
        }
        updateAuthButtonText(false);
        updateMainButtonsState(false);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        applyTheme('system-default');
    }
});
