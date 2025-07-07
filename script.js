// File Version: v157 (Fixed watchlist.watchlist.shares typo, fixed add watchlist ID generation)
// Last Updated: 2025-07-07

// This script interacts with Firebase Firestore for data storage.
// Firebase app, db, auth instances, and userId are made globally available
// via window.firestoreDb, window.firebaseAuth, window.getFirebaseAppId(), etc.,
// from the <script type="module"> block in index.html.

// --- GLOBAL VARIABLES (Accessible throughout the script) ---
let db;
let auth = null;
let currentUserId = null;
let currentAppId; // This will store the resolved appId
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
const KANGA_EMAIL = 'iamkanga@gmail.0com'; // CORRECTED EMAIL ADDRESS
let currentCalculatorInput = '';
let operator = null;
let previousCalculatorInput = '';
let resultDisplayed = false;
const DEFAULT_WATCHLIST_NAME = 'My Watchlist (Default)';
const DEFAULT_WATCHLIST_ID_SUFFIX = 'default';
let userWatchlists = []; // Stores all watchlists for the user
let currentSelectedWatchlistIds = []; // Stores IDs of currently selected watchlists for display
let unsubscribeShares = null; // To store the unsubscribe function for the Firestore listener

// --- DOM ELEMENTS (Cached for performance) ---
const mainTitle = document.getElementById('mainTitle');
const addShareHeaderBtn = document.getElementById('addShareHeaderBtn');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const appSidebar = document.getElementById('appSidebar');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const newShareBtn = document.getElementById('newShareBtn');
const addWatchlistBtn = document.getElementById('addWatchlistBtn');
const editWatchlistBtn = document.getElementById('editWatchlistBtn');
const standardCalcBtn = document.getElementById('standardCalcBtn');
const dividendCalcBtn = document.getElementById('dividendCalcBtn');
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const colorThemeSelect = document.getElementById('colorThemeSelect');
const revertToDefaultThemeBtn = document.getElementById('revertToDefaultThemeBtn');
const logoutBtn = document.getElementById('logoutBtn');
const watchlistSelect = document.getElementById('watchlistSelect');
const sortSelect = document.getElementById('sortSelect');
const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const shareTableBody = document.querySelector('#shareTable tbody');
const mobileShareCardsContainer = document.getElementById('mobileShareCards');
const googleAuthBtn = document.getElementById('googleAuthBtn');
const scrollToTopBtn = document.getElementById('scrollToTopBtn');

// Share Form Modal Elements
const shareFormSection = document.getElementById('shareFormSection');
const shareFormCloseBtn = shareFormSection ? shareFormSection.querySelector('.form-close-button') : null;
const formTitle = document.getElementById('formTitle');
const shareNameInput = document.getElementById('shareName');
const currentPriceInput = document.getElementById('currentPrice');
const targetPriceInput = document.getElementById('targetPrice');
const dividendAmountInput = document.getElementById('dividendAmount');
const frankingCreditsInput = document.getElementById('frankingCredits');
const commentsFormContainer = document.getElementById('commentsFormContainer');
const addCommentSectionBtn = document.getElementById('addCommentSectionBtn');
const deleteShareBtn = document.getElementById('deleteShareBtn');
const cancelFormBtn = document.getElementById('cancelFormBtn');
const saveShareBtn = document.getElementById('saveShareBtn');

// Share Detail Modal Elements
const shareDetailModal = document.getElementById('shareDetailModal');
const shareDetailCloseBtn = shareDetailModal ? shareDetailModal.querySelector('.close-button') : null;
const modalShareName = document.getElementById('modalShareName');
const modalEntryDate = document.getElementById('modalEntryDate');
const modalEnteredPrice = document.getElementById('modalEnteredPrice');
const modalTargetPrice = document.getElementById('modalTargetPrice');
const modalDividendAmount = document.getElementById('modalDividendAmount');
const modalFrankingCredits = document.getElementById('modalFrankingCredits');
const modalUnfrankedYield = document.getElementById('modalUnfrankedYield');
const modalFrankedYield = document.getElementById('modalFrankedYield');
const modalNewsLink = document.getElementById('modalNewsLink');
const modalMarketIndexLink = document.getElementById('modalMarketIndexLink');
const modalFoolLink = document.getElementById('modalFoolLink');
const modalCommSecLink = document.getElementById('modalCommSecLink');
const commSecLoginMessage = document.getElementById('commSecLoginMessage');
const modalCommentsContainer = document.getElementById('modalCommentsContainer');
const deleteShareFromDetailBtn = document.getElementById('deleteShareFromDetailBtn');
const editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn');

// Add Watchlist Modal Elements
const addWatchlistModal = document.getElementById('addWatchlistModal');
const addWatchlistCloseBtn = addWatchlistModal ? addWatchlistModal.querySelector('.close-button') : null;
const newWatchlistNameInput = document.getElementById('newWatchlistName');
const cancelAddWatchlistBtn = document.getElementById('cancelAddWatchlistBtn');
const saveWatchlistBtn = document.getElementById('saveWatchlistBtn');

// Manage Watchlist Modal Elements
const manageWatchlistModal = document.getElementById('manageWatchlistModal');
const manageWatchlistCloseBtn = manageWatchlistModal ? manageWatchlistModal.querySelector('.close-button') : null;
const editWatchlistNameInput = document.getElementById('editWatchlistName');
const deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn');
const cancelManageWatchlistBtn = document.getElementById('cancelManageWatchlistBtn');
const saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn');

// Dividend Calculator Modal Elements
const dividendCalculatorModal = document.getElementById('dividendCalculatorModal');
const dividendCalcCloseBtn = dividendCalculatorModal ? dividendCalculatorModal.querySelector('.calc-close-button') : null;
const calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
const calcDividendAmountInput = document.getElementById('calcDividendAmount');
const calcFrankingCreditsInput = document.getElementById('calcFrankingCredits');
const calcUnfrankedYieldSpan = document.getElementById('calcUnfrankedYield');
const calcFrankedYieldSpan = document.getElementById('calcFrankedYield');
const investmentValueSelect = document.getElementById('investmentValueSelect');
const calcEstimatedDividendSpan = document.getElementById('calcEstimatedDividend');

// Standard Calculator Modal Elements
const calculatorModal = document.getElementById('calculatorModal');
const calculatorCloseBtn = calculatorModal ? calculatorModal.querySelector('.close-button') : null;
const calculatorInputDisplay = document.getElementById('calculatorInput');
const calculatorResultDisplay = document.getElementById('calculatorResult');
const calculatorButtons = document.querySelector('.calculator-buttons');

// Custom Dialog Modal Elements
const customDialogModal = document.getElementById('customDialogModal');
const customDialogMessage = document.getElementById('customDialogMessage');
const customDialogConfirmBtn = document.getElementById('customDialogConfirmBtn');
const customDialogCancelBtn = document.getElementById('customDialogCancelBtn');

// Context Menu Elements
const shareContextMenu = document.getElementById('shareContextMenu');
const contextEditShareBtn = document.getElementById('contextEditShareBtn');
const contextDeleteShareBtn = document.getElementById('contextDeleteShareBtn');

// --- CONSTANTS ---
const ALL_SHARES_ID = 'all_shares';
const CUSTOM_THEMES = [
    'bold-1', 'bold-2', 'bold-3', 'bold-4', 'bold-5',
    'bold-6', 'bold-7', 'bold-8', 'bold-9', 'bold-10',
    'subtle-1', 'subtle-2', 'subtle-3', 'subtle-4', 'subtle-5',
    'subtle-6', 'subtle-7', 'subtle-8', 'subtle-9', 'subtle-10'
];
let currentCustomThemeIndex = -1; // -1 for system-default, 0+ for custom themes
let currentActiveTheme = 'system-default'; // Tracks the currently applied theme

// --- UTILITY FUNCTIONS ---

/**
 * Formats a number as Australian Dollars (AUD).
 * @param {number} amount - The number to format.
 * @returns {string} The formatted currency string.
 */
function formatCurrency(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return '$0.00';
    }
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Formats a number as a percentage.
 * @param {number} value - The number to format (e.g., 0.75 for 75%).
 * @param {number} [decimals=0] - Number of decimal places.
 * @returns {string} The formatted percentage string.
 */
function formatPercentage(value, decimals = 0) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '0%';
    }
    return new Intl.NumberFormat('en-AU', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value / 100); // Divide by 100 as input is 0-100
}

/**
 * Formats a date string into a readable format.
 * @param {string | Date} dateInput - The date string or Date object.
 * @returns {string} Formatted date string (e.g., "Jan 1, 2023").
 */
function formatDate(dateInput) {
    if (!dateInput) return 'N/A';
    let date;
    if (dateInput instanceof Date) {
        date = dateInput;
    } else {
        date = new Date(dateInput);
    }
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    return date.toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Calculates unfranked and franked dividend yield.
 * @param {number} dividendAmount - Annual dividend amount per share.
 * @param {number} currentPrice - Current share price.
 * @param {number} frankingCredits - Franking credits percentage (0-100).
 * @returns {{unfrankedYield: number, frankedYield: number}} Calculated yields.
 */
function calculateYields(dividendAmount, currentPrice, frankingCredits) {
    let unfrankedYield = 0;
    let frankedYield = 0;

    if (currentPrice > 0 && dividendAmount >= 0) {
        unfrankedYield = (dividendAmount / currentPrice) * 100;

        // Franked yield calculation for Australian shares
        const taxRateFactor = 0.30; // Australian company tax rate
        const grossUpFactor = 1 / (1 - taxRateFactor); // Approx 1.42857
        const frankingFactor = frankingCredits / 100;

        frankedYield = (dividendAmount / currentPrice) * (1 + (frankingFactor * grossUpFactor)) * 100;
    }
    return { unfrankedYield, frankedYield };
}

/**
 * Displays a custom dialog message (alert/confirm replacement).
 * @param {string} message - The message to display.
 * @param {boolean} isConfirm - If true, shows Yes/No buttons; otherwise, only an OK button (which is the Confirm button acting as OK).
 * @returns {Promise<boolean>} Resolves true for "Yes"/"OK", false for "No".
 */
function showCustomDialog(message, isConfirm = false) {
    return new Promise(resolve => {
        customDialogMessage.textContent = message;
        customDialogModal.style.display = 'block';
        customDialogConfirmBtn.style.display = 'flex'; // Always show confirm as 'OK' or 'Yes'

        if (isConfirm) {
            customDialogCancelBtn.style.display = 'flex'; // Show cancel for 'No'
        } else {
            customDialogCancelBtn.style.display = 'none'; // Hide cancel for 'OK'
        }

        // Clear previous listeners
        const confirmClone = customDialogConfirmBtn.cloneNode(true);
        customDialogConfirmBtn.parentNode.replaceChild(confirmClone, customDialogConfirmBtn);
        const cancelClone = customDialogCancelBtn.cloneNode(true);
        customDialogCancelBtn.parentNode.replaceChild(cancelClone, customDialogCancelBtn);

        // Add new listeners
        confirmClone.addEventListener('click', () => {
            customDialogModal.style.display = 'none';
            resolve(true);
        }, { once: true });

        if (isConfirm) {
            cancelClone.addEventListener('click', () => {
                customDialogModal.style.display = 'none';
                resolve(false);
            }, { once: true });
        }
        currentDialogCallback = resolve; // Store resolve for external dismissal if needed
    });
}

/**
 * Shows a temporary auto-dismissing message.
 * @param {string} message - The message to display.
 * @param {number} duration - Duration in milliseconds before dismissal.
 */
function showToastMessage(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Force reflow to ensure transition plays
    void toast.offsetWidth;

    toast.classList.add('show');

    if (autoDismissTimeout) {
        clearTimeout(autoDismissTimeout);
    }
    autoDismissTimeout = setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        }, { once: true });
        autoDismissTimeout = null;
    }, duration);
}


// --- UI STATE MANAGEMENT ---

/**
 * Updates the text and state of the Google authentication button.
 * @param {boolean} isSignedIn - True if user is signed in, false otherwise.
 * @param {string} [email] - User's email to display if signed in.
 */
function updateAuthButtonText(isSignedIn, email = '') {
    if (googleAuthBtn) {
        if (isSignedIn) {
            googleAuthBtn.textContent = `Signed in as ${email || 'User'}`;
            googleAuthBtn.classList.add('signed-in');
            googleAuthBtn.disabled = true; // Disable after sign-in
        } else {
            googleAuthBtn.textContent = 'Sign In with Google';
            googleAuthBtn.classList.remove('signed-in');
            googleAuthBtn.disabled = false; // Enable for sign-in
        }
    }
}

/**
 * Updates the enabled/disabled state of main action buttons based on login status.
 * @param {boolean} enable - True to enable, false to disable.
 */
function updateMainButtonsState(enable) {
    const buttonsToControl = [
        addShareHeaderBtn, newShareBtn, addWatchlistBtn, editWatchlistBtn,
        standardCalcBtn, dividendCalcBtn, exportWatchlistBtn, sortSelect,
        watchlistSelect
    ];

    buttonsToControl.forEach(btn => {
        if (btn) {
            btn.disabled = !enable;
            if (btn.classList.contains('is-disabled-icon')) {
                // For span/i elements acting as buttons, toggle a class
                if (enable) {
                    btn.classList.remove('is-disabled-icon');
                } else {
                    btn.classList.add('is-disabled-icon');
                }
            }
        }
    });

    // Handle ASX code buttons separately, as they are dynamic
    if (asxCodeButtonsContainer) {
        const asxButtons = asxCodeButtonsContainer.querySelectorAll('.asx-code-btn');
        asxButtons.forEach(btn => {
            btn.disabled = !enable;
        });
    }

    // Also control the theme toggle and revert buttons
    if (themeToggleBtn) themeToggleBtn.disabled = !enable;
    if (colorThemeSelect) colorThemeSelect.disabled = !enable;
    if (revertToDefaultThemeBtn) revertToDefaultThemeBtn.disabled = !enable;
}


/**
 * Toggles the visibility of the app sidebar.
 * @param {boolean} [forceOpen] - Optional. If true, forces sidebar open. If false, forces sidebar closed.
 */
function toggleAppSidebar(forceOpen) {
    if (!appSidebar || !sidebarOverlay) {
        console.warn("[Sidebar] Sidebar elements not found. Cannot toggle.");
        return;
    }

    const isOpen = appSidebar.classList.contains('open');
    let shouldOpen;

    if (typeof forceOpen === 'boolean') {
        shouldOpen = forceOpen;
    } else {
        shouldOpen = !isOpen;
    }

    if (shouldOpen) {
        appSidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
        document.body.classList.add('sidebar-active');
        console.log("[Sidebar] Sidebar opened.");
    } else {
        appSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
        document.body.classList.remove('sidebar-active');
        console.log("[Sidebar] Sidebar closed.");
    }
}


/**
 * Clears all share entries from the table and mobile cards.
 */
function clearShareList() {
    if (shareTableBody) {
        shareTableBody.innerHTML = '';
    }
    if (mobileShareCardsContainer) {
        mobileShareCardsContainer.innerHTML = '';
    }
    allSharesData = []; // Clear the in-memory array
    console.log("[UI] Share list cleared.");
}

/**
 * Clears watchlist UI elements (select dropdown and ASX buttons).
 */
function clearWatchlistUI() {
    if (watchlistSelect) {
        watchlistSelect.innerHTML = '<option value="" disabled selected>Select Watchlist</option>';
    }
    if (asxCodeButtonsContainer) {
        asxCodeButtonsContainer.innerHTML = '';
    }
    userWatchlists = [];
    currentSelectedWatchlistIds = [];
    console.log("[UI] Watchlist UI cleared.");
}

/**
 * Updates the theme toggle button and color theme selector to reflect the current theme.
 */
function updateThemeToggleAndSelector() {
    if (themeToggleBtn) {
        // Update theme toggle button icon and text based on current theme
        const isDark = document.body.classList.contains('dark-theme');
        const icon = themeToggleBtn.querySelector('i');
        const textSpan = themeToggleBtn.querySelector('span');
        if (icon) {
            icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
        }
        if (textSpan) {
            textSpan.textContent = isDark ? 'Dark Theme' : 'Light Theme';
        }
    }

    if (colorThemeSelect) {
        // Update the dropdown to show the currently active custom theme or 'none'
        if (currentActiveTheme === 'system-default') {
            colorThemeSelect.value = 'none';
        } else {
            colorThemeSelect.value = currentActiveTheme;
        }
    }
    console.log(`[Theme] UI updated. Current active theme: ${currentActiveTheme}`);
}

/**
 * Applies the selected theme to the body.
 * @param {string} themeName - The name of the theme to apply (e.g., 'system-default', 'bold-1').
 */
function applyTheme(themeName) {
    // Remove all existing theme classes
    document.body.className = '';

    if (themeName === 'system-default') {
        currentActiveTheme = 'system-default';
        // Check system preference for initial dark/light mode
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-theme');
        }
        currentCustomThemeIndex = -1;
        console.log("[Theme] Applied system-default theme.");
    } else {
        // Apply the specific custom theme
        document.body.classList.add(`theme-${themeName}`);
        currentActiveTheme = themeName;
        currentCustomThemeIndex = CUSTOM_THEMES.indexOf(themeName);
        console.log(`[Theme] Applied custom theme: ${themeName}`);
    }
    updateThemeToggleAndSelector(); // Update UI elements to reflect new theme
}

// --- FIRESTORE PATH HELPERS ---

/**
 * Gets the document reference for a specific user's root data.
 * Path: `artifacts/{appId}/users/{userId}`
 * @param {string} userId - The user's ID.
 * @returns {string} The document path string for the user's root.
 */
function getUserRootDocPath(userId) {
    // currentAppId is set by window.getFirebaseAppId() in the DOMContentLoaded listener
    // which gets it from the firebaseConfig.projectId embedded in index.html.
    return `artifacts/${currentAppId}/users/${userId}`;
}

/**
 * Gets the collection reference for shares under a specific user.
 * Path: `artifacts/{appId}/users/{userId}/shares`
 * @param {string} userId - The user's ID.
 * @returns {CollectionReference} The Firestore CollectionReference for shares.
 */
function getUserSharesCollectionRef(userId) {
    return window.firestore.collection(db, getUserRootDocPath(userId), 'shares');
}

/**
 * Gets the document reference for a specific share under a user.
 * Path: `artifacts/{appId}/users/{userId}/shares/{shareId}`
 * @param {string} userId - The user's ID.
 * @param {string} shareId - The share's ID.
 * @returns {DocumentReference} The Firestore DocumentReference for the share.
 */
function getUserShareDocRef(userId, shareId) {
    return window.firestore.doc(db, getUserRootDocPath(userId), 'shares', shareId);
}

/**
 * Gets the document reference for user settings.
 * Path: `artifacts/{appId}/users/{userId}/user_settings/main_settings`
 * @param {string} userId - The user's ID.
 * @returns {DocumentReference} The Firestore DocumentReference for user settings.
 */
function getUserSettingsDocRef(userId) {
    return window.firestore.doc(db, getUserRootDocPath(userId), 'user_settings', 'main_settings');
}

/**
 * Gets the collection reference for the *old* watchlist structure.
 * Path: `artifacts/{appId}/users/{userId}/watchlists`
 * @param {string} userId - The user's ID.
 * @returns {CollectionReference} The Firestore CollectionReference for old watchlists.
 */
function getOldWatchlistsCollectionRef(userId) {
    return window.firestore.collection(db, getUserRootDocPath(userId), 'watchlists');
}


// --- FIREBASE AUTHENTICATION ---

/**
 * Handles Google Sign-in.
 */
async function handleGoogleSignIn() {
    if (!auth || !window.authFunctions) {
        console.error("[Auth] Firebase Auth not initialized.");
        showToastMessage("Authentication service not available.", 3000);
        return;
    }
    if (googleAuthBtn) {
        googleAuthBtn.disabled = true; // Disable button immediately
        googleAuthBtn.textContent = 'Signing In...';
    }

    const provider = window.authFunctions.GoogleAuthProviderInstance;
    try {
        const result = await window.authFunctions.signInWithPopup(auth, provider);
        // User signed in successfully. onAuthStateChanged listener handles UI updates.
        console.log("[Auth] Google Sign-in successful:", result.user.uid);
        showToastMessage(`Welcome, ${result.user.displayName || result.user.email}!`, 3000);
    } catch (error) {
        console.error("[Auth] Google Sign-in error:", error);
        let errorMessage = "Sign-in failed. Please try again.";
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = "Sign-in cancelled.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = "Sign-in cancelled (popup already open).";
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = "Network error. Please check your connection.";
        }
        showCustomDialog(errorMessage); // Use custom dialog for errors
        updateAuthButtonText(false); // Re-enable button on failure
    } finally {
        if (googleAuthBtn && !auth.currentUser) { // Only re-enable if still not signed in
            googleAuthBtn.disabled = false;
            googleAuthBtn.textContent = 'Sign In with Google';
        }
    }
}

/**
 * Handles user logout.
 */
async function handleLogout() {
    if (!auth || !window.authFunctions) {
        console.error("[Auth] Firebase Auth not initialized.");
        showToastMessage("Authentication service not available.", 3000);
        return;
    }

    const confirmLogout = await showCustomDialog("Are you sure you want to log out?", true);
    if (!confirmLogout) {
        console.log("[Auth] Logout cancelled by user.");
        return;
    }

    try {
        await window.authFunctions.signOut(auth);
        // User signed out successfully. onAuthStateChanged listener handles UI updates.
        console.log("[Auth] User logged out.");
        showToastMessage("You have been logged out.", 3000);
    } catch (error) {
        console.error("[Auth] Logout error:", error);
        showCustomDialog("Logout failed. Please try again.");
    }
}

// --- FIRESTORE DATA OPERATIONS ---

/**
 * Loads user-specific watchlists and settings from Firestore, including migration logic.
 * This function is called after the user is authenticated.
 */
async function loadUserWatchlistsAndSettings() {
    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Firestore] Firestore or User ID not available for loading watchlists.");
        return;
    }
    loadingIndicator.style.display = 'block';
    console.log("[Firestore] Loading user watchlists and settings...");

    const userSettingsDocRef = getUserSettingsDocRef(currentUserId);
    const oldWatchlistsCollectionRef = getOldWatchlistsCollectionRef(currentUserId);

    let settingsFromFirestore = null;
    let oldWatchlistsFromFirestore = [];

    try {
        // 1. Try to load current settings (which should contain the primary watchlists array)
        const settingsDocSnap = await window.firestore.getDoc(userSettingsDocRef);
        if (settingsDocSnap.exists()) {
            settingsFromFirestore = settingsDocSnap.data();
            console.log("[Firestore] User settings loaded from main_settings:", settingsFromFirestore);
            userWatchlists = settingsFromFirestore.watchlists || [];
        } else {
            console.log("[Firestore] No user settings found in main_settings.");
            userWatchlists = [];
        }

        // 2. Try to load watchlists from the old separate 'watchlists' collection
        const oldWatchlistsQuerySnapshot = await window.firestore.getDocs(oldWatchlistsCollectionRef);
        oldWatchlistsQuerySnapshot.forEach(doc => {
            const oldWatchlist = { id: doc.id, ...doc.data() };
            // Ensure old watchlists have the 'shares' property for compatibility
            if (!oldWatchlist.shares) {
                oldWatchlist.shares = {};
            }
            oldWatchlistsFromFirestore.push(oldWatchlist);
        });
        console.log(`[Firestore] Found ${oldWatchlistsFromFirestore.length} watchlists in old collection.`);

        // 3. Merge and deduplicate watchlists
        let combinedWatchlists = [...userWatchlists]; // Start with watchlists from main_settings

        oldWatchlistsFromFirestore.forEach(oldWl => {
            // Check if a watchlist with the same ID already exists in combinedWatchlists
            const exists = combinedWatchlists.some(currentWl => currentWl.id === oldWl.id);
            if (!exists) {
                combinedWatchlists.push(oldWl); // Add if it's a new ID
            } else {
                // If ID exists, merge properties, prioritizing existing (e.g., if 'shares' was added later)
                const existingWl = combinedWatchlists.find(currentWl => currentWl.id === oldWl.id);
                Object.assign(existingWl, oldWl); // Merge old data into existing
                if (!existingWl.shares) { // Ensure shares object is present after merge
                    existingWl.shares = {};
                }
            }
        });

        // Ensure default watchlist exists and is correctly structured
        const defaultWlExists = combinedWatchlists.some(wl => wl.id === DEFAULT_WATCHLIST_ID_SUFFIX);
        if (!defaultWlExists) {
            combinedWatchlists.unshift({ // Add to the beginning
                id: DEFAULT_WATCHLIST_ID_SUFFIX,
                name: DEFAULT_WATCHLIST_NAME,
                shares: {}
            });
            console.log("[Firestore] Ensured default watchlist exists.");
        }

        userWatchlists = combinedWatchlists; // Update the global array

        // 4. Update currentSelectedWatchlistIds and theme based on settings or defaults
        currentSelectedWatchlistIds = settingsFromFirestore?.currentSelectedWatchlistIds || [ALL_SHARES_ID];
        const savedTheme = settingsFromFirestore?.theme || 'system-default';
        applyTheme(savedTheme);

        // 5. Save the combined watchlists back to main_settings (MIGRATION STEP)
        await window.firestore.setDoc(userSettingsDocRef, {
            watchlists: userWatchlists,
            currentSelectedWatchlistIds: currentSelectedWatchlistIds,
            theme: currentActiveTheme
        }, { merge: true });
        console.log("[Firestore] Watchlists and settings (including old data migration) saved to main_settings.");

        populateWatchlistDropdown();
        await loadShares(); // Load shares after watchlists are fully processed
    } catch (error) {
        console.error("[Firestore] Error loading user watchlists and settings:", error);
        showCustomDialog("Error loading your data. Please try refreshing the page.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Saves user-specific settings to Firestore.
 */
async function saveUserSettings() {
    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Firestore] Firestore or User ID not available for saving settings.");
        return;
    }
    console.log("[Firestore] Saving user settings...");
    const userSettingsDocRef = getUserSettingsDocRef(currentUserId);

    try {
        await window.firestore.setDoc(userSettingsDocRef, {
            watchlists: userWatchlists,
            currentSelectedWatchlistIds: currentSelectedWatchlistIds,
            theme: currentActiveTheme
        }, { merge: true });
        console.log("[Firestore] User settings saved successfully.");
    } catch (error) {
        console.error("[Firestore] Error saving user settings:", error);
        showToastMessage("Error saving settings.", 3000);
    }
}

/**
 * Adds a new share or updates an existing one in Firestore.
 * @param {object} shareData - The share data to save.
 * @param {string} [docId] - The ID of the document to update. If null, a new document is created.
 */
async function saveShare(shareData, docId = null) {
    if (!db || !currentUserId || !window.firestore) {
        showCustomDialog("Error: Not authenticated or Firestore not available.");
        return;
    }

    loadingIndicator.style.display = 'block';
    try {
        const shareCollectionRef = getUserSharesCollectionRef(currentUserId);
        let shareDocRef;

        if (docId) {
            // Update existing share
            shareDocRef = getUserShareDocRef(currentUserId, docId);
            await window.firestore.setDoc(shareDocRef, shareData, { merge: true });
            console.log(`[Firestore] Share updated with ID: ${docId}`);
            showToastMessage("Share updated successfully!", 2000);
        } else {
            // Add new share
            shareDocRef = await window.firestore.addDoc(shareCollectionRef, shareData);
            console.log(`[Firestore] New share added with ID: ${shareDocRef.id}`);
            showToastMessage("Share added successfully!", 2000);

            // --- NEW LOGIC: Associate new share with the currently selected watchlist ---
            const activeWatchlistId = currentSelectedWatchlistIds[0];
            const activeWatchlist = userWatchlists.find(wl => wl.id === activeWatchlistId);

            if (activeWatchlist) {
                if (!activeWatchlist.shares) {
                    activeWatchlist.shares = {};
                }
                activeWatchlist.shares[shareDocRef.id] = true; // Mark presence of the new share
                await saveUserSettings(); // Persist the updated watchlists array
                console.log(`[Firestore] New share ${shareDocRef.id} added to watchlist ${activeWatchlistId}.`);
            } else {
                console.warn(`[Firestore] Could not find active watchlist ${activeWatchlistId} to add new share to.`);
            }
            // --- END NEW LOGIC ---
        }
        hideModal(shareFormSection);
    } catch (error) {
        console.error("[Firestore] Error saving share:", error);
        showCustomDialog("Error saving share. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Deletes a share from Firestore.
 * @param {string} docId - The ID of the share document to delete.
 */
async function deleteShare(docId) {
    if (!db || !currentUserId || !window.firestore) {
        showCustomDialog("Error: Not authenticated or Firestore not available.");
        return;
    }

    const confirmDelete = await showCustomDialog("Are you sure you want to delete this share?", true);
    if (!confirmDelete) {
        console.log("[Firestore] Share deletion cancelled by user.");
        return;
    }

    loadingIndicator.style.display = 'block';
    try {
        const shareDocRef = getUserShareDocRef(currentUserId, docId);

        // Remove share from all watchlists it belongs to
        const batch = window.firestore.writeBatch(db);
        const userSettingsDocRef = getUserSettingsDocRef(currentUserId); // Get settings doc ref
        const settingsSnap = await window.firestore.getDoc(userSettingsDocRef);
        if (settingsSnap.exists()) {
            const settings = settingsSnap.data();
            const currentWatchlists = settings.watchlists || [];
            currentWatchlists.forEach(watchlist => {
                if (watchlist.shares && watchlist.shares[docId]) {
                    // Update the shares map within the watchlist object in the user settings document
                    // This requires updating the entire watchlists array or using a more complex field path
                    // For simplicity and to avoid deep nesting issues, we'll update the array in memory
                    // and then save the whole array back.
                    delete watchlist.shares[docId];
                }
            });
            // Update the entire watchlists array in the settings document
            batch.update(userSettingsDocRef, { watchlists: currentWatchlists });
        }
        
        // Delete the share document itself
        batch.delete(shareDocRef);
        
        await batch.commit();

        console.log(`[Firestore] Share deleted with ID: ${docId}`);
        showToastMessage("Share deleted successfully!", 2000);
        hideModal(shareDetailModal); // Hide detail modal if open
        hideModal(shareFormSection); // Hide form modal if open
        // The onSnapshot listener for shares will automatically update the UI
    } catch (error) {
        console.error("[Firestore] Error deleting share:", error);
        showCustomDialog("Error deleting share. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Sets up a real-time listener for shares in the currently selected watchlists.
 * This function replaces `loadShares` for real-time updates.
 */
function setupSharesListener() {
    if (unsubscribeShares) {
        unsubscribeShares(); // Unsubscribe from previous listener if exists
        unsubscribeShares = null;
        console.log("[Firestore Listener] Unsubscribed from previous shares listener.");
    }

    if (!db || !currentUserId || !window.firestore || currentSelectedWatchlistIds.length === 0) {
        console.warn("[Firestore Listener] Cannot set up shares listener: missing DB, User ID, Firestore, or no watchlists selected.");
        clearShareList(); // Clear UI if no valid listener can be set up
        return;
    }

    loadingIndicator.style.display = 'block';
    console.log(`[Firestore Listener] Setting up shares listener for watchlists: ${currentSelectedWatchlistIds.join(', ')}`);

    const sharesCollectionRef = getUserSharesCollectionRef(currentUserId);
    const q = window.firestore.query(sharesCollectionRef);

    unsubscribeShares = window.firestore.onSnapshot(q, (querySnapshot) => {
        const sharesFromFirestore = [];
        querySnapshot.forEach((doc) => {
            const share = { id: doc.id, ...doc.data() };
            sharesFromFirestore.push(share);
        });

        // Filter shares based on currentSelectedWatchlistIds
        let filteredShares = [];
        if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
            filteredShares = sharesFromFirestore; // Show all shares
        } else {
            // Corrected: watchlist.shares[share.id] instead of watchlist.watchlist.shares[share.id]
            filteredShares = sharesFromFirestore.filter(share =>
                currentSelectedWatchlistIds.some(watchlistId => {
                    const watchlist = userWatchlists.find(wl => wl.id === watchlistId);
                    return watchlist && watchlist.shares && watchlist.shares[share.id];
                })
            );
        }

        allSharesData = filteredShares; // Update the global in-memory array
        renderShareList(); // Re-render the UI with the filtered data
        loadingIndicator.style.display = 'none';
        console.log(`[Firestore Listener] Shares updated. Total shares: ${allSharesData.length}`);
    }, (error) => {
        console.error("[Firestore Listener] Error listening to shares:", error);
        showCustomDialog("Error loading shares in real-time. Please refresh.");
        loadingIndicator.style.display = 'none';
    });
}

/**
 * Loads shares based on the currently selected watchlist(s) and sorting preference.
 * This function is now primarily a wrapper to trigger `setupSharesListener`.
 */
async function loadShares() {
    if (!currentUserId) {
        console.log("[Load Shares] No user logged in. Clearing share list.");
        clearShareList();
        return;
    }
    setupSharesListener(); // This will handle loading and real-time updates
}

/**
 * Adds a new watchlist to Firestore.
 * @param {string} watchlistName - The name of the new watchlist.
 */
async function addWatchlist(watchlistName) {
    if (!db || !currentUserId || !window.firestore) {
        showCustomDialog("Error: Not authenticated or Firestore not available.");
        return;
    }

    if (!watchlistName.trim()) {
        showCustomDialog("Watchlist name cannot be empty.");
        return;
    }

    // Check for duplicate names
    if (userWatchlists.some(wl => wl.name.toLowerCase() === watchlistName.toLowerCase())) {
        showCustomDialog("A watchlist with this name already exists.");
        return;
    }

    loadingIndicator.style.display = 'block';
    try {
        // Corrected: Generate a unique ID using doc() on a dummy collection reference
        const newWatchlistId = window.firestore.doc(window.firestore.collection(db, 'dummy_collection')).id; 
        const newWatchlist = {
            id: newWatchlistId,
            name: watchlistName,
            shares: {} // Initialize with an empty shares object
        };
        userWatchlists.push(newWatchlist);
        await saveUserSettings(); // Save updated watchlists array (which now includes the new one)
        
        populateWatchlistDropdown();
        watchlistSelect.value = newWatchlist.id; // Select the newly added watchlist
        currentSelectedWatchlistIds = [newWatchlist.id]; // Make it the only selected one
        await saveUserSettings(); // Save updated selected watchlist preference
        loadShares(); // Reload shares for the new watchlist
        hideModal(addWatchlistModal);
        showToastMessage(`Watchlist "${watchlistName}" added!`, 2000);
    } catch (error) {
        console.error("[Firestore] Error adding watchlist:", error);
        showCustomDialog("Error adding watchlist. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Updates an existing watchlist's name.
 * @param {string} watchlistId - The ID of the watchlist to update.
 * @param {string} newName - The new name for the watchlist.
 */
async function updateWatchlistName(watchlistId, newName) {
    if (!db || !currentUserId || !window.firestore) {
        showCustomDialog("Error: Not authenticated or Firestore not available.");
        return;
    }

    if (!newName.trim()) {
        showCustomDialog("Watchlist name cannot be empty.");
        return;
    }

    // Check for duplicate names, excluding the current watchlist being edited
    if (userWatchlists.some(wl => wl.id !== watchlistId && wl.name.toLowerCase() === newName.toLowerCase())) {
        showCustomDialog("A watchlist with this name already exists.");
        return;
    }

    loadingIndicator.style.display = 'block';
    try {
        const watchlistIndex = userWatchlists.findIndex(wl => wl.id === watchlistId);
        if (watchlistIndex > -1) {
            const oldName = userWatchlists[watchlistIndex].name;
            userWatchlists[watchlistIndex].name = newName;
            await saveUserSettings(); // Save updated watchlists array
            populateWatchlistDropdown();
            watchlistSelect.value = watchlistId; // Keep the watchlist selected
            showToastMessage(`Watchlist "${oldName}" renamed to "${newName}"!`, 2000);
        }
        hideModal(manageWatchlistModal);
    } catch (error) {
        console.error("[Firestore] Error updating watchlist name:", error);
        showCustomDialog("Error updating watchlist name. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Deletes a watchlist from Firestore.
 * @param {string} watchlistId - The ID of the watchlist to delete.
 */
async function deleteWatchlist(watchlistId) {
    if (!db || !currentUserId || !window.firestore) {
        showCustomDialog("Error: Not authenticated or Firestore not available.");
        return;
    }

    if (watchlistId === DEFAULT_WATCHLIST_ID_SUFFIX) {
        showCustomDialog("The default watchlist cannot be deleted.");
        console.log("[Firestore] Attempted to delete default watchlist. Action blocked.");
        return; // Prevent deletion of default watchlist
    }

    const confirm = await showCustomDialog("Are you sure you want to delete this watchlist? Shares within it will NOT be deleted, but will be unassigned from this watchlist.", true);
    if (!confirm) {
        console.log("[Firestore] Watchlist deletion cancelled by user.");
        return;
    }

    loadingIndicator.style.display = 'block';
    try {
        userWatchlists = userWatchlists.filter(wl => wl.id !== watchlistId);
        // If the deleted watchlist was selected, default to 'All Shares' or the default watchlist
        if (currentSelectedWatchlistIds.includes(watchlistId)) {
            currentSelectedWatchlistIds = [ALL_SHARES_ID];
        }

        await saveUserSettings(); // Save updated watchlists array and selected IDs
        populateWatchlistDropdown();
        watchlistSelect.value = currentSelectedWatchlistIds[0]; // Select the new active watchlist
        loadShares(); // Reload shares based on new selection
        hideModal(manageWatchlistModal);
        showToastMessage("Watchlist deleted successfully!", 2000);
    } catch (error) {
        console.error("[Firestore] Error deleting watchlist:", error);
        showCustomDialog("Error deleting watchlist. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Adds or removes a share from a watchlist.
 * @param {string} shareId - The ID of the share.
 * @param {string} watchlistId - The ID of the watchlist.
 * @param {boolean} add - True to add, false to remove.
 */
async function toggleShareInWatchlist(shareId, watchlistId, add) {
    if (!db || !currentUserId || !window.firestore) {
        showCustomDialog("Error: Not authenticated or Firestore not available.");
        return;
    }

    loadingIndicator.style.display = 'block';
    try {
        const watchlistIndex = userWatchlists.findIndex(wl => wl.id === watchlistId);

        if (watchlistIndex > -1) {
            if (!userWatchlists[watchlistIndex].shares) {
                userWatchlists[watchlistIndex].shares = {};
            }

            if (add) {
                userWatchlists[watchlistIndex].shares[shareId] = true; // Mark presence
                showToastMessage(`Share added to "${userWatchlists[watchlistIndex].name}"`, 1500);
            } else {
                delete userWatchlists[watchlistIndex].shares[shareId];
                showToastMessage(`Share removed from "${userWatchlists[watchlistIndex].name}"`, 1500);
            }
            await saveUserSettings(); // Save updated watchlists array
            // No need to reload shares here, as the onSnapshot listener will handle it.
        }
    } catch (error) {
        console.error("[Firestore] Error toggling share in watchlist:", error);
        showToastMessage("Error updating watchlist.", 2000);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Exports the currently displayed shares to a CSV file.
 */
function exportWatchlistToCSV() {
    if (allSharesData.length === 0) {
        showCustomDialog("No shares to export.");
        return;
    }

    const headers = [
        "Code", "Entry Date", "Entered Price", "Target Price",
        "Dividend Amount", "Franking Credits (%)", "Unfranked Yield (%)",
        "Franked Yield (%)", "Comments"
    ];

    const rows = allSharesData.map(share => {
        const commentsText = share.comments ? share.comments.map(c => `${c.title}: ${c.text}`).join(' | ') : '';
        const yields = calculateYields(share.dividendAmount, share.currentPrice, share.frankingCredits);

        return [
            `"${share.shareName}"`,
            `"${formatDate(share.entryDate)}"` || '""',
            `"${share.currentPrice || ''}"`,
            `"${share.targetPrice || ''}"`,
            `"${share.dividendAmount || ''}"`,
            `"${share.frankingCredits || ''}"`,
            `"${yields.unfrankedYield.toFixed(2)}"` || '""',
            `"${yields.frankedYield.toFixed(2)}"` || '""',
            `"${commentsText.replace(/"/g, '""')}"` // Escape double quotes within comments
        ].join(',');
    });

    const csvContent = [
        headers.join(','),
        ...rows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'shares_watchlist.csv');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToastMessage("Watchlist exported to CSV!", 2000);
    console.log("[Export] Watchlist exported to CSV.");
}


// --- UI RENDERING FUNCTIONS ---

/**
 * Renders the list of shares in both table and mobile card formats.
 */
function renderShareList() {
    if (!shareTableBody || !mobileShareCardsContainer) {
        console.warn("[Render] Share table or mobile cards container not found.");
        return;
    }

    shareTableBody.innerHTML = '';
    mobileShareCardsContainer.innerHTML = '';

    // Apply sorting
    const sortBy = sortSelect.value;
    let sortedShares = [...allSharesData]; // Create a shallow copy to avoid modifying original

    if (sortBy) {
        sortedShares.sort((a, b) => {
            let valA, valB;

            switch (sortBy) {
                case 'entryDate-asc':
                case 'entryDate-desc':
                    valA = a.entryDate ? new Date(a.entryDate).getTime() : 0;
                    valB = b.entryDate ? new Date(b.entryDate).getTime() : 0;
                    break;
                case 'shareName-asc':
                case 'shareName-desc':
                    valA = a.shareName ? a.shareName.toLowerCase() : '';
                    valB = b.shareName ? b.shareName.toLowerCase() : '';
                    break;
                case 'dividendAmount-asc':
                case 'dividendAmount-desc':
                    valA = a.dividendAmount || 0;
                    valB = b.dividendAmount || 0;
                    break;
                default:
                    return 0;
            }

            if (valA < valB) return sortBy.endsWith('-asc') ? -1 : 1;
            if (valA > valB) return sortBy.endsWith('-asc') ? 1 : -1;
            return 0;
        });
    }

    if (sortedShares.length === 0) {
        shareTableBody.innerHTML = '<tr><td colspan="5" class="no-shares-message">No shares added yet. Click the "+" button to add one!</td></tr>';
        mobileShareCardsContainer.innerHTML = '<div class="no-shares-message">No shares added yet. Click the "+" button to add one!</div>';
        return;
    }

    sortedShares.forEach(share => {
        const yields = calculateYields(share.dividendAmount, share.currentPrice, share.frankingCredits);

        // Desktop Table Row
        const row = shareTableBody.insertRow();
        row.dataset.id = share.id;
        row.innerHTML = `
            <td>${share.shareName || 'N/A'}</td>
            <td>${formatCurrency(share.currentPrice)}</td>
            <td>${formatCurrency(share.targetPrice)}</td>
            <td>${formatCurrency(share.dividendAmount)} (${formatPercentage(yields.unfrankedYield, 2)})</td>
            <td>${share.comments && share.comments.length > 0 ? share.comments[0].text : 'No comments'}</td>
        `;
        row.addEventListener('click', (event) => handleShareClick(event, share.id));
        row.addEventListener('contextmenu', (event) => handleContextMenu(event, share.id));
        row.addEventListener('touchstart', (event) => handleTouchStart(event, share.id), { passive: true });
        row.addEventListener('touchmove', handleTouchMove, { passive: true });
        row.addEventListener('touchend', (event) => handleTouchEnd(event, share.id));

        // Mobile Card
        const card = document.createElement('div');
        card.className = 'mobile-card';
        card.dataset.id = share.id;
        card.innerHTML = `
            <h3>${share.shareName || 'N/A'}</h3>
            <p><strong>Entered Price:</strong> ${formatCurrency(share.currentPrice)}</p>
            <p><strong>Target Price:</strong> ${formatCurrency(share.targetPrice)}</p>
            <p><strong>Dividends:</strong> ${formatCurrency(yields.unfrankedYield, 2)})</p>
            <p><strong>Comments:</strong> ${share.comments && share.comments.length > 0 ? share.comments[0].text : 'No comments'}</p>
        `;
        card.addEventListener('click', (event) => handleShareClick(event, share.id));
        card.addEventListener('contextmenu', (event) => handleContextMenu(event, share.id));
        card.addEventListener('touchstart', (event) => handleTouchStart(event, share.id), { passive: true });
        card.addEventListener('touchmove', handleTouchMove, { passive: true });
        card.addEventListener('touchend', (event) => handleTouchEnd(event, share.id));
        mobileShareCardsContainer.appendChild(card);
    });

    console.log("[UI] Share list rendered.");
    updateAsxCodeButtons(); // Update ASX code buttons based on rendered shares
}

/**
 * Populates the watchlist dropdown with user's watchlists.
 */
function populateWatchlistDropdown() {
    if (!watchlistSelect) {
        console.warn("[Populate Watchlist] Watchlist select element not found.");
        return;
    }

    watchlistSelect.innerHTML = ''; // Clear existing options

    // Add "All Shares" option
    const allSharesOption = document.createElement('option');
    allSharesOption.value = ALL_SHARES_ID;
    allSharesOption.textContent = 'All Shares';
    watchlistSelect.appendChild(allSharesOption);

    // Add user-defined watchlists
    // Sort watchlists alphabetically by name, but keep 'My Watchlist (Default)' first
    const sortedUserWatchlists = [...userWatchlists].sort((a, b) => {
        if (a.id === DEFAULT_WATCHLIST_ID_SUFFIX) return -1;
        if (b.id === DEFAULT_WATCHLIST_ID_SUFFIX) return 1;
        return a.name.localeCompare(b.name);
    });


    sortedUserWatchlists.forEach(watchlist => {
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        watchlistSelect.appendChild(option);
    });

    // Set the selected value based on currentSelectedWatchlistIds
    // If multiple are selected (not yet supported by single dropdown), default to 'All Shares'
    if (currentSelectedWatchlistIds.length > 0) {
        const selectedId = currentSelectedWatchlistIds[0];
        if (watchlistSelect.querySelector(`option[value="${selectedId}"]`)) {
            watchlistSelect.value = selectedId;
        } else {
            watchlistSelect.value = ALL_SHARES_ID; // Fallback if selected ID is no longer valid
            currentSelectedWatchlistIds = [ALL_SHARES_ID];
            saveUserSettings(); // Save updated preference
        }
    } else {
        watchlistSelect.value = ALL_SHARES_ID; // Default if nothing selected
        currentSelectedWatchlistIds = [ALL_SHARES_ID];
        saveUserSettings(); // Save updated preference
    }
    console.log("[UI] Watchlist dropdown populated.");
}

/**
 * Updates the ASX code buttons based on the currently displayed shares.
 */
function updateAsxCodeButtons() {
    if (!asxCodeButtonsContainer) {
        console.warn("[Update ASX Buttons] ASX code buttons container not found.");
        return;
    }

    asxCodeButtonsContainer.innerHTML = ''; // Clear existing buttons

    const uniqueAsxCodes = new Set(allSharesData.map(share => share.shareName).filter(Boolean)); // Get unique codes from currently displayed shares

    // Add an "All" button
    const allButton = document.createElement('button');
    allButton.className = 'asx-code-btn active'; // Initially active
    allButton.textContent = 'All';
    allButton.dataset.code = 'ALL';
    asxCodeButtonsContainer.appendChild(allButton);

    allButton.addEventListener('click', () => {
        // Remove active from all others
        asxCodeButtonsContainer.querySelectorAll('.asx-code-btn').forEach(btn => btn.classList.remove('active'));
        allButton.classList.add('active');
        filterSharesByAsxCode('ALL'); // Explicitly filter by 'ALL'
        console.log("[ASX Buttons] 'All' button clicked.");
    });


    Array.from(uniqueAsxCodes).sort().forEach(code => {
        const button = document.createElement('button');
        button.className = 'asx-code-btn';
        button.textContent = code;
        button.dataset.code = code;
        asxCodeButtonsContainer.appendChild(button);

        button.addEventListener('click', () => {
            // Remove active from all others
            asxCodeButtonsContainer.querySelectorAll('.asx-code-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            filterSharesByAsxCode(code);
            console.log(`[ASX Buttons] Button for code '${code}' clicked.`);
        });
    });
    console.log("[UI] ASX code buttons updated.");
}

/**
 * Filters and re-renders shares based on the selected ASX code button.
 * @param {string} code - The ASX code to filter by.
 */
function filterSharesByAsxCode(code) {
    if (code === 'ALL') {
        renderShareList(); // Re-render all shares
    } else {
        const filtered = allSharesData.filter(share => share.shareName === code);
        // Temporarily override allSharesData for rendering, then restore
        const originalAllSharesData = allSharesData;
        allSharesData = filtered;
        renderShareList();
        allSharesData = originalAllSharesData; // Restore original
    }
    console.log(`[Filter] Shares filtered by ASX code: ${code}`);
}


// --- MODAL MANAGEMENT ---

/**
 * Shows a modal by setting its display style to 'block'.
 * @param {HTMLElement} modalElement - The modal element to show.
 */
function showModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'block';
        // Add a slight delay for the fade-in effect to be visible
        setTimeout(() => modalElement.classList.add('show'), 10);
        console.log(`[Modal] Showing modal: ${modalElement.id}`);
    }
}

/**
 * Hides a modal by setting its display style to 'none' after a fade-out.
 * @param {HTMLElement} modalElement - The modal element to hide.
 */
function hideModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('show');
        modalElement.addEventListener('transitionend', function handler() {
            modalElement.style.display = 'none';
            modalElement.removeEventListener('transitionend', handler);
            console.log(`[Modal] Hidden modal: ${modalElement.id}`);
        }, { once: true });
    }
}

/**
 * Populates the share form for editing an existing share.
 * @param {string} shareId - The ID of the share to edit.
 */
function populateShareFormForEdit(shareId) {
    const shareToEdit = allSharesData.find(share => share.id === shareId);
    if (!shareToEdit) {
        console.error("[Form] Share not found for editing:", shareId);
        showCustomDialog("Share not found.");
        return;
    }

    selectedShareDocId = shareId;
    formTitle.textContent = 'Edit Share';
    shareNameInput.value = shareToEdit.shareName || '';
    currentPriceInput.value = shareToEdit.currentPrice || '';
    targetPriceInput.value = shareToEdit.targetPrice || '';
    dividendAmountInput.value = shareToEdit.dividendAmount || '';
    frankingCreditsInput.value = shareToEdit.frankingCredits || '';

    // Clear existing comments and add new ones
    commentsFormContainer.querySelectorAll('.comment-section').forEach(section => section.remove());
    if (shareToEdit.comments && shareToEdit.comments.length > 0) {
        shareToEdit.comments.forEach(comment => addCommentSection(comment.title, comment.text));
    } else {
        addCommentSection(); // Add one empty comment section if none exist
    }

    // Show delete button for existing shares
    if (deleteShareBtn) {
        deleteShareBtn.classList.remove('hidden');
        deleteShareBtn.onclick = () => deleteShare(shareId);
    }
    showModal(shareFormSection);
    console.log(`[Form] Populated form for editing share: ${shareId}`);
}

/**
 * Clears the share form for adding a new share.
 */
function clearShareFormForNew() {
    selectedShareDocId = null;
    formTitle.textContent = 'Add New Share';
    shareNameInput.value = '';
    currentPriceInput.value = '';
    targetPriceInput.value = '';
    dividendAmountInput.value = '';
    frankingCreditsInput.value = '';

    // Clear all existing comment sections
    commentsFormContainer.querySelectorAll('.comment-section').forEach(section => section.remove());
    addCommentSection(); // Add one empty comment section for new entry

    // Hide delete button for new shares
    if (deleteShareBtn) {
        deleteShareBtn.classList.add('hidden');
        deleteShareBtn.onclick = null;
    }
    showModal(shareFormSection);
    console.log("[Form] Cleared form for new share.");
}

/**
 * Adds a new comment section to the share form.
 * @param {string} [title=''] - Initial title for the comment.
 * @param {string} [text=''] - Initial text for the comment.
 */
function addCommentSection(title = '', text = '') {
    const commentSection = document.createElement('div');
    commentSection.className = 'comment-section';
    commentSection.innerHTML = `
        <div class="comment-section-header">
            <input type="text" class="comment-title-input" placeholder="Comment Title" value="${title}">
            <span class="comment-delete-btn"><i class="fas fa-trash-alt"></i></span>
        </div>
        <textarea class="comment-text-input" placeholder="Your comment here...">${text}</textarea>
    `;
    commentsFormContainer.appendChild(commentSection);

    // Add event listener for the delete button within this new section
    const deleteBtn = commentSection.querySelector('.comment-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (commentsFormContainer.querySelectorAll('.comment-section').length > 1) {
                commentSection.remove();
                console.log("[Form] Comment section removed.");
            } else {
                showToastMessage("At least one comment section is required.", 2000);
            }
        });
    }
    console.log("[Form] Added new comment section.");
}

/**
 * Populates and displays the share detail modal.
 * @param {string} shareId - The ID of the share to display.
 */
function showShareDetails(shareId) {
    const share = allSharesData.find(s => s.id === shareId);
    if (!share) {
        console.error("[Details] Share not found:", shareId);
        showCustomDialog("Share details not found.");
        return;
    }

    modalShareName.textContent = share.shareName || 'N/A';
    modalEntryDate.textContent = formatDate(share.entryDate);
    modalEnteredPrice.textContent = formatCurrency(share.currentPrice);
    modalTargetPrice.textContent = formatCurrency(share.targetPrice);
    modalDividendAmount.textContent = `${formatCurrency(share.dividendAmount)} (Franking: ${formatPercentage(share.frankingCredits)})`;

    const yields = calculateYields(share.dividendAmount, share.currentPrice, share.frankingCredits);
    modalUnfrankedYield.textContent = formatPercentage(yields.unfrankedYield, 2);
    modalFrankedYield.textContent = formatPercentage(yields.frankedYield, 2);

    // External Links
    const encodedShareName = encodeURIComponent(share.shareName);
    modalNewsLink.href = `https://www.google.com/search?q=${encodedShareName}+ASX+news`;
    modalMarketIndexLink.href = `https://www.marketindex.com.au/asx/${encodedShareName}`;
    modalFoolLink.href = `https://www.fool.com.au/quote/${encodedShareName}/`;
    modalCommSecLink.href = `https://www.commsec.com.au/market-insights/company-research/${encodedShareName}`;

    // Comments
    modalCommentsContainer.innerHTML = '<h3>Comments</h3>'; // Clear existing
    if (share.comments && share.comments.length > 0) {
        share.comments.forEach(comment => {
            const commentItem = document.createElement('div');
            commentItem.className = 'modal-comment-item';
            commentItem.innerHTML = `
                <strong>${comment.title || 'Untitled Comment'}</strong>
                <p>${comment.text || 'No text provided.'}</p>
            `;
            modalCommentsContainer.appendChild(commentItem);
        });
    } else {
        modalCommentsContainer.innerHTML += '<p class="ghosted-text">No comments for this share.</p>';
    }

    // Set up edit and delete buttons for this specific share
    editShareFromDetailBtn.onclick = () => {
        hideModal(shareDetailModal);
        populateShareFormForEdit(share.id);
    };
    deleteShareFromDetailBtn.onclick = () => deleteShare(share.id);

    showModal(shareDetailModal);
    console.log(`[Details] Displaying details for share: ${shareId}`);
}

/**
 * Populates the manage watchlist modal for editing.
 * @param {string} watchlistId - The ID of the watchlist to manage.
 */
function populateManageWatchlistModal(watchlistId) {
    const watchlistToEdit = userWatchlists.find(wl => wl.id === watchlistId);
    if (!watchlistToEdit) {
        showCustomDialog("Watchlist not found.");
        return;
    }

    editWatchlistNameInput.value = watchlistToEdit.name;

    // Disable delete button for default watchlist
    if (deleteWatchlistInModalBtn) {
        if (watchlistId === DEFAULT_WATCHLIST_ID_SUFFIX) {
            deleteWatchlistInModalBtn.classList.add('is-disabled-icon');
        } else {
            deleteWatchlistInModalBtn.classList.remove('is-disabled-icon');
        }
    }

    // Set initial state of save button based on current input value
    updateSaveWatchlistNameButtonState();

    // Set up event listeners for the specific watchlist
    saveWatchlistNameBtn.onclick = () => updateWatchlistName(watchlistId, editWatchlistNameInput.value);
    deleteWatchlistInModalBtn.onclick = () => deleteWatchlist(watchlistId);

    showModal(manageWatchlistModal);
    console.log(`[Watchlist] Populated manage watchlist modal for: ${watchlistId}`);
}

/**
 * Updates the enabled state of the saveWatchlistNameBtn based on the input field's value.
 */
function updateSaveWatchlistNameButtonState() {
    if (saveWatchlistNameBtn && editWatchlistNameInput) {
        const isInputEmpty = editWatchlistNameInput.value.trim() === '';
        // Enable if input is NOT empty, disable if empty
        saveWatchlistNameBtn.classList.toggle('is-disabled-icon', isInputEmpty);
    }
}


// --- EVENT HANDLERS ---

/**
 * Handles clicks on share rows/cards to show details.
 * @param {Event} event - The click event.
 * @param {string} shareId - The ID of the clicked share.
 */
function handleShareClick(event, shareId) {
    // Prevent context menu from showing if this was a long press that triggered it
    if (event.detail === 0 && event.type === 'click') { // event.detail is 0 for synthetic clicks (e.g., from touchend after long press)
        return;
    }

    // Remove selected class from all rows/cards first
    document.querySelectorAll('.share-row.selected, .mobile-card.selected').forEach(el => el.classList.remove('selected'));

    // Add selected class to the clicked element
    const clickedElement = event.currentTarget;
    clickedElement.classList.add('selected');

    showShareDetails(shareId);
    console.log(`[Click] Share clicked: ${shareId}`);
}

/**
 * Handles the context menu (right-click on desktop, long-press on mobile).
 * @param {Event} event - The event (contextmenu or synthetic click from touchend).
 * @param {string} shareId - The ID of the share.
 */
function handleContextMenu(event, shareId) {
    event.preventDefault(); // Prevent default browser context menu

    // Hide any currently open context menu
    shareContextMenu.style.display = 'none';

    // Set the share ID for the context menu buttons
    shareContextMenu.dataset.shareId = shareId;

    // Position the context menu
    let x = event.clientX;
    let y = event.clientY;

    // Adjust position to keep it within viewport
    const menuWidth = shareContextMenu.offsetWidth;
    const menuHeight = shareContextMenu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10; // 10px margin from right
    }
    if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10; // 10px margin from bottom
    }

    shareContextMenu.style.left = `${x}px`;
    shareContextMenu.style.top = `${y}px`;
    shareContextMenu.style.display = 'block';

    // Set up context menu button actions
    contextEditShareBtn.onclick = () => {
        hideContextMenu();
        populateShareFormForEdit(shareId);
    };
    contextDeleteShareBtn.onclick = () => {
        hideContextMenu();
        deleteShare(shareId);
    };

    console.log(`[Context Menu] Displayed for share: ${shareId}`);
}

/**
 * Hides the context menu.
 */
function hideContextMenu() {
    if (shareContextMenu) {
        shareContextMenu.style.display = 'none';
        console.log("[Context Menu] Hidden.");
    }
}

/**
 * Handles touch start for long press detection.
 * @param {TouchEvent} event - The touchstart event.
 * @param {string} shareId - The ID of the touched share.
 */
function handleTouchStart(event, shareId) {
    // Only consider the first touch for long press
    if (event.touches.length === 1) {
        selectedElementForTap = event.currentTarget;
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;

        longPressTimer = setTimeout(() => {
            // Simulate a right-click (contextmenu event) for long press
            const simulatedEvent = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 2, // Right-click button
                clientX: touchStartX,
                clientY: touchStartY
            });
            selectedElementForTap.dispatchEvent(simulatedEvent);
            console.log("[Touch] Long press detected, simulating contextmenu.");
            selectedElementForTap = null; // Reset to prevent click after long press
        }, LONG_PRESS_THRESHOLD);
    }
}

/**
 * Handles touch move to cancel long press if significant movement occurs.
 * @param {TouchEvent} event - The touchmove event.
 */
function handleTouchMove(event) {
    if (longPressTimer && selectedElementForTap) {
        const currentX = event.touches[0].clientX;
        const currentY = event.touches[0].clientY;
        const deltaX = Math.abs(currentX - touchStartX);
        const deltaY = Math.abs(currentY - touchStartY);

        if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            console.log("[Touch] Long press cancelled due to movement.");
        }
    }
}

/**
 * Handles touch end for normal tap or after a cancelled long press.
 * @param {TouchEvent} event - The touchend event.
 * @param {string} shareId - The ID of the touched share.
 */
function handleTouchEnd(event, shareId) {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;

        // If long press was not triggered, this is a normal tap.
        // Simulate a click event, but set event.detail to 0 to differentiate from actual clicks.
        const simulatedClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            detail: 0 // Indicate this is a synthetic click from touch
        });
        if (selectedElementForTap) {
            selectedElementForTap.dispatchEvent(simulatedClick);
            console.log("[Touch] Normal tap detected, simulating click.");
        }
    }
    selectedElementForTap = null; // Reset for next interaction
}


// --- CALCULATOR LOGIC (Standard) ---

/**
 * Handles standard calculator button clicks.
 * @param {Event} event - The click event.
 */
function handleCalculatorButtonClick(event) {
    const button = event.target.closest('.calc-btn');
    if (!button) return;

    const value = button.dataset.value;
    const action = button.dataset.action;

    if (resultDisplayed && (value || action === 'clear' || action === 'percentage')) {
        // If a result is displayed and a number/clear/percentage is pressed, start a new calculation
        currentCalculatorInput = '';
        previousCalculatorInput = '';
        operator = null;
        resultDisplayed = false;
        calculatorResultDisplay.textContent = '0';
    }

    if (value) {
        // Handle number or decimal input
        if (value === '.' && currentCalculatorInput.includes('.')) return; // Prevent multiple decimals
        currentCalculatorInput += value;
        calculatorInputDisplay.textContent = currentCalculatorInput;
    } else if (action) {
        // Handle operator or clear actions
        if (action === 'clear') {
            currentCalculatorInput = '';
            previousCalculatorInput = '';
            operator = null;
            calculatorInputDisplay.textContent = '';
            calculatorResultDisplay.textContent = '0';
            resultDisplayed = false;
        } else if (action === 'percentage') {
            if (currentCalculatorInput) {
                currentCalculatorInput = (parseFloat(currentCalculatorInput) / 100).toString();
                calculatorInputDisplay.textContent = currentCalculatorInput;
                calculatorResultDisplay.textContent = currentCalculatorInput;
                resultDisplayed = true;
            }
        } else if (action === 'calculate') {
            if (currentCalculatorInput && previousCalculatorInput && operator) {
                const num1 = parseFloat(previousCalculatorInput);
                const num2 = parseFloat(currentCalculatorInput);
                let result;
                switch (operator) {
                    case 'add':
                        result = num1 + num2;
                        break;
                    case 'subtract':
                        result = num1 - num2;
                        break;
                    case 'multiply':
                        result = num1 * num2;
                        break;
                    case 'divide':
                        result = num2 !== 0 ? num1 / num2 : 'Error';
                        break;
                }
                calculatorResultDisplay.textContent = result.toString();
                currentCalculatorInput = result.toString();
                previousCalculatorInput = '';
                operator = null;
                resultDisplayed = true;
            }
        } else { // Operator (+, -, ×, ÷)
            if (currentCalculatorInput) {
                if (previousCalculatorInput && operator) {
                    // If there's a pending operation, calculate it first
                    const num1 = parseFloat(previousCalculatorInput);
                    const num2 = parseFloat(currentCalculatorInput);
                    let interimResult;
                    switch (operator) {
                        case 'add':
                            interimResult = num1 + num2;
                            break;
                        case 'subtract':
                            interimResult = num1 - num2;
                            break;
                        case 'multiply':
                            interimResult = num1 * num2;
                            break;
                            case 'divide':
                                interimResult = num2 !== 0 ? num1 / num2 : 'Error';
                                break;
                    }
                    previousCalculatorInput = interimResult.toString();
                } else {
                    previousCalculatorInput = currentCalculatorInput;
                }
                currentCalculatorInput = '';
                operator = action;
                calculatorInputDisplay.textContent = `${previousCalculatorInput} ${getOperatorSymbol(action)}`;
                resultDisplayed = false;
            } else if (previousCalculatorInput) {
                // If only previous input exists, change the operator
                operator = action;
                calculatorInputDisplay.textContent = `${previousCalculatorInput} ${getOperatorSymbol(action)}`;
            }
        }
    }
}

/**
 * Helper to get the display symbol for calculator operators.
 * @param {string} action - The operator action string.
 * @returns {string} The display symbol.
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

// --- CALCULATOR LOGIC (Dividend) ---

/**
 * Calculates and displays dividend yields and estimated annual dividend.
 */
function calculateAndDisplayDividends() {
    const price = parseFloat(calcCurrentPriceInput.value);
    const dividend = parseFloat(calcDividendAmountInput.value);
    const franking = parseFloat(calcFrankingCreditsInput.value);
    const investmentValue = parseFloat(investmentValueSelect.value);

    if (isNaN(price) || isNaN(dividend) || price <= 0 || dividend < 0) {
        calcUnfrankedYieldSpan.textContent = '-';
        calcFrankedYieldSpan.textContent = '-';
        calcEstimatedDividendSpan.textContent = '-';
        return;
    }

    const { unfrankedYield, frankedYield } = calculateYields(dividend, price, franking);

    calcUnfrankedYieldSpan.textContent = formatPercentage(unfrankedYield, 2);
    calcFrankedYieldSpan.textContent = formatPercentage(frankedYield, 2);

    if (!isNaN(investmentValue) && investmentValue > 0) {
        const estimatedDividend = (investmentValue / price) * dividend;
        calcEstimatedDividendSpan.textContent = formatCurrency(estimatedDividend);
    } else {
        calcEstimatedDividendSpan.textContent = '-';
    }
}

// --- INITIALIZATION ---

/**
 * Initializes all event listeners and fetches initial data.
 * This function is called once after the initial Firebase auth state is determined.
 */
function initializeAppLogic() {
    console.log("Initializing app logic...");

    // Global click listener to hide context menu
    document.addEventListener('click', (event) => {
        if (shareContextMenu && shareContextMenu.style.display === 'block' && !shareContextMenu.contains(event.target)) {
            hideContextMenu();
        }
    });

    // Header Buttons
    if (addShareHeaderBtn) {
        addShareHeaderBtn.addEventListener('click', () => {
            console.log("[UI] Add Share Header button clicked.");
            clearShareFormForNew();
        });
    }

    // Share Form Modal Buttons
    if (shareFormCloseBtn) {
        shareFormCloseBtn.addEventListener('click', () => { hideModal(shareFormSection); console.log("[UI] Share form close button clicked."); });
    }
    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', () => { hideModal(shareFormSection); console.log("[UI] Share form cancel button clicked."); });
    }
    if (saveShareBtn) {
        saveShareBtn.addEventListener('click', async () => {
            console.log("[UI] Save Share button clicked.");
            const shareName = shareNameInput.value.trim();
            const currentPrice = parseFloat(currentPriceInput.value);
            const targetPrice = parseFloat(targetPriceInput.value);
            const dividendAmount = parseFloat(dividendAmountInput.value);
            const frankingCredits = parseFloat(frankingCreditsInput.value);

            if (!shareName) {
                showCustomDialog("Share Code is required.");
                return;
            }

            // Collect all comments
            const comments = [];
            commentsFormContainer.querySelectorAll('.comment-section').forEach(section => {
                const titleInput = section.querySelector('.comment-title-input');
                const textInput = section.querySelector('.comment-text-input');
                if (titleInput && textInput && (titleInput.value.trim() || textInput.value.trim())) {
                    comments.push({
                        title: titleInput.value.trim(),
                        text: textInput.value.trim()
                    });
                }
            });

            const shareData = {
                shareName: shareName,
                currentPrice: isNaN(currentPrice) ? null : currentPrice,
                targetPrice: isNaN(targetPrice) ? null : targetPrice,
                dividendAmount: isNaN(dividendAmount) ? null : dividendAmount,
                frankingCredits: isNaN(frankingCredits) ? null : frankingCredits,
                comments: comments,
                entryDate: selectedShareDocId ? allSharesData.find(s => s.id === selectedShareDocId)?.entryDate : new Date().toISOString() // Preserve date for edits
            };

            await saveShare(shareData, selectedShareDocId);
        });
    }
    if (addCommentSectionBtn) {
        addCommentSectionBtn.addEventListener('click', () => {
            console.log("[UI] Add Comment Section button clicked.");
            addCommentSection();
        });
    }

    // Share Detail Modal Buttons
    if (shareDetailCloseBtn) {
        shareDetailCloseBtn.addEventListener('click', () => { hideModal(shareDetailModal); console.log("[UI] Share detail close button clicked."); });
    }

    // Add Watchlist Modal Buttons
    if (addWatchlistBtn) {
        addWatchlistBtn.addEventListener('click', () => {
            console.log("[UI] Add Watchlist button clicked.");
            newWatchlistNameInput.value = ''; // Clear input
            showModal(addWatchlistModal);
        });
    }
    if (addWatchlistCloseBtn) {
        addWatchlistCloseBtn.addEventListener('click', () => { hideModal(addWatchlistModal); console.log("[UI] Add Watchlist close button clicked."); });
    }
    if (cancelAddWatchlistBtn) {
        cancelAddWatchlistBtn.addEventListener('click', () => { hideModal(addWatchlistModal); console.log("[UI] Add Watchlist cancel button clicked."); });
    }
    if (saveWatchlistBtn) {
        saveWatchlistBtn.addEventListener('click', () => {
            console.log("[UI] Save Watchlist button clicked.");
            addWatchlist(newWatchlistNameInput.value);
        });
    }

    // Manage Watchlist Modal Buttons
    if (editWatchlistBtn) {
        editWatchlistBtn.addEventListener('click', () => {
            console.log("[UI] Edit Watchlist button clicked.");
            const selectedWatchlistId = watchlistSelect.value;
            if (selectedWatchlistId) {
                populateManageWatchlistModal(selectedWatchlistId);
            } else {
                showCustomDialog("Please select a watchlist to edit.");
            }
        });
    }
    if (manageWatchlistCloseBtn) {
        manageWatchlistCloseBtn.addEventListener('click', () => { hideModal(manageWatchlistModal); console.log("[UI] Manage Watchlist close button clicked."); });
    }
    if (cancelManageWatchlistBtn) {
        cancelManageWatchlistBtn.addEventListener('click', () => { hideModal(manageWatchlistModal); console.log("[UI] Manage Watchlist cancel button clicked."); });
    }
    if (saveWatchlistNameBtn) {
        saveWatchlistNameBtn.addEventListener('click', () => {
            console.log("[UI] Save Watchlist Name button clicked.");
            const currentWatchlistId = watchlistSelect.value; // Get ID from currently selected dropdown value
            updateWatchlistName(currentWatchlistId, editWatchlistNameInput.value);
        });
    }

    // NEW: Add input listener for editWatchlistNameInput to enable/disable save button
    if (editWatchlistNameInput) {
        editWatchlistNameInput.addEventListener('input', updateSaveWatchlistNameButtonState);
    }


    // Watchlist Select Change
    if (watchlistSelect) {
        watchlistSelect.addEventListener('change', async (event) => {
            console.log("[UI] Watchlist selection changed.");
            currentSelectedWatchlistIds = [event.target.value]; // Update selected ID
            await saveUserSettings(); // Save preference
            loadShares(); // Reload shares based on new selection
        });
    }

    // Sort Select Change
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            console.log("[UI] Sort selection changed.");
            renderShareList(); // Re-render with new sort order
        });
    }

    // Google Auth Button
    if (googleAuthBtn) {
        googleAuthBtn.addEventListener('click', handleGoogleSignIn);
    }

    // Logout Button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Dividend Calculator Modal Buttons/Inputs
    if (dividendCalcBtn) {
        dividendCalcBtn.addEventListener('click', () => {
            console.log("[UI] Dividend Calculator button clicked.");
            // Reset inputs
            calcCurrentPriceInput.value = '';
            calcDividendAmountInput.value = '';
            calcFrankingCreditsInput.value = '';
            investmentValueSelect.value = '10000'; // Default investment value
            calculateAndDisplayDividends(); // Calculate with empty inputs to show '-'
            showModal(dividendCalculatorModal);
        });
    }
    if (dividendCalcCloseBtn) {
        dividendCalcCloseBtn.addEventListener('click', () => { hideModal(dividendCalculatorModal); console.log("[UI] Dividend Calculator close button clicked."); });
    }
    if (calcCurrentPriceInput) {
        calcCurrentPriceInput.addEventListener('input', calculateAndDisplayDividends);
    }
    if (calcDividendAmountInput) {
        calcDividendAmountInput.addEventListener('input', calculateAndDisplayDividends);
    }
    if (calcFrankingCreditsInput) {
        calcFrankingCreditsInput.addEventListener('input', calculateAndDisplayDividends);
    }
    if (investmentValueSelect) {
        investmentValueSelect.addEventListener('change', calculateAndDisplayDividends);
    }

    // Standard Calculator Modal Buttons
    if (standardCalcBtn) {
        standardCalcBtn.addEventListener('click', () => {
            console.log("[UI] Standard Calculator button clicked.");
            // Reset calculator state
            currentCalculatorInput = '';
            operator = null;
            previousCalculatorInput = '';
            resultDisplayed = false;
            calculatorInputDisplay.textContent = '';
            calculatorResultDisplay.textContent = '0';
            showModal(calculatorModal);
        });
    }
    if (calculatorCloseBtn) {
        calculatorCloseBtn.addEventListener('click', () => { hideModal(calculatorModal); console.log("[UI] Standard Calculator close button clicked."); });
    }
    if (calculatorButtons) {
        calculatorButtons.addEventListener('click', handleCalculatorButtonClick);
    }

    // Theme Toggle Button
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            console.log("[Theme] Theme toggle button clicked.");
            if (currentActiveTheme === 'system-default') {
                // If currently system-default, cycle to the first custom theme
                currentCustomThemeIndex = 0;
                applyTheme(CUSTOM_THEMES[currentCustomThemeIndex]);
            } else {
                // If a custom theme is active, cycle to the next custom theme
                currentCustomThemeIndex = (currentCustomThemeIndex + 1) % CUSTOM_THEMES.length;
                const nextTheme = CUSTOM_THEMES[currentCustomThemeIndex];
                applyTheme(nextTheme);
            }
            console.log(`[Theme] Cycled to next theme. Current index: ${currentCustomThemeIndex}`);
        });
    }

    // Color Theme Select Dropdown
    if (colorThemeSelect) {
        colorThemeSelect.addEventListener('change', (event) => {
            console.log(`[Theme] Color theme select changed to: ${event.target.value}`);
            const selectedTheme = event.target.value;
            if (selectedTheme === 'none') {
                applyTheme('system-default');
            } else {
                applyTheme(selectedTheme);
            }
        });
    }

    // Revert to Default Theme Button
    if (revertToDefaultThemeBtn) {
        revertToDefaultThemeBtn.addEventListener('click', (event) => {
            console.log("[Theme] Revert to default theme button clicked.");
            event.preventDefault();
            applyTheme('system-default');
            console.log("[Theme] Reverted to default light/dark theme via button.");
        });
    }

    // System Dark Mode Preference Listener
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (currentActiveTheme === 'system-default') {
            if (event.matches) {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
            console.log("[Theme] System theme preference changed and applied (system-default mode).");
            updateThemeToggleAndSelector();
        }
    });

    // Scroll to Top Button
    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.innerWidth <= 768) {
                if (window.scrollY > 200) {
                    scrollToTopBtn.style.display = 'flex';
                    scrollToTopBtn.style.opacity = '1';
                } else {
                    scrollToTopBtn.style.opacity = '0';
                    setTimeout(() => {
                        scrollToTopBtn.style.display = 'none';
                    }, 300);
                }
            } else {
                scrollToTopBtn.style.display = 'none';
            }
        });
        // Initial check for scroll button visibility on load
        if (window.innerWidth > 768) {
            scrollToTopBtn.style.display = 'none';
        } else {
            window.dispatchEvent(new Event('scroll')); // Trigger initial check on mobile
        }
        scrollToTopBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); console.log("[UI] Scrolled to top."); });
    }

    // Hamburger Menu and Sidebar Interactions
    if (hamburgerBtn && appSidebar && closeMenuBtn && sidebarOverlay) {
        console.log("[Sidebar Setup] Initializing sidebar event listeners. Elements found:", {
            hamburgerBtn: !!hamburgerBtn,
            appSidebar: !!appSidebar,
            closeMenuBtn: !!closeMenuBtn,
            sidebarOverlay: !!sidebarOverlay
        });
        hamburgerBtn.addEventListener('click', (event) => {
            console.log("[UI] Hamburger button CLICKED. Event:", event);
            event.stopPropagation(); // Prevent this click from immediately closing the sidebar via global listener
            toggleAppSidebar();
        });
        closeMenuBtn.addEventListener('click', () => {
            console.log("[UI] Close Menu button CLICKED.");
            toggleAppSidebar(false);
        });
        
        sidebarOverlay.addEventListener('click', (event) => {
            console.log("[Sidebar Overlay] Clicked overlay. Attempting to close sidebar.");
            if (appSidebar.classList.contains('open')) {
                toggleAppSidebar(false);
            }
        });

        // This global click listener is for desktop, where overlay pointer-events are none
        document.addEventListener('click', (event) => {
            const isDesktop = window.innerWidth > 768;
            if (appSidebar.classList.contains('open') && isDesktop &&
                !appSidebar.contains(event.target) && !hamburgerBtn.contains(event.target)) {
                console.log("[Global Click] Clicked outside sidebar on desktop. Closing sidebar.");
                toggleAppSidebar(false);
            }
        });

        // Menu buttons that should close the sidebar
        const menuButtons = appSidebar.querySelectorAll('.menu-button-item');
        menuButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                console.log(`[Sidebar Menu Item Click] Button '${event.currentTarget.textContent.trim()}' clicked.`);
                // Check if the data-action-closes-menu attribute is explicitly set to "false"
                const closesMenu = event.currentTarget.dataset.actionClosesMenu !== 'false';
                // console.log(`[Sidebar Menu Item Click] data-action-closes-menu: ${event.currentTarget.dataset.actionClosesMenu}, closesMenu: ${closesMenu}`);
                if (closesMenu) {
                    toggleAppSidebar(false);
                }
            });
        });
    } else {
        console.warn("[Sidebar Setup] Missing one or more sidebar elements (hamburgerBtn, appSidebar, closeMenuBtn, sidebarOverlay). Sidebar functionality might be impaired.");
    }

    // Export Watchlist Button Event Listener
    if (exportWatchlistBtn) {
        exportWatchlistBtn.addEventListener('click', () => {
            console.log("[UI] Export Watchlist button clicked.");
            exportWatchlistToCSV();
            toggleAppSidebar(false); // Close sidebar after clicking export
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("script.js (v157) DOMContentLoaded fired."); // Updated version number

    if (window.firestoreDb && window.firebaseAuth && window.getFirebaseAppId && window.firestore && window.authFunctions) {
        db = window.firestoreDb;
        auth = window.firebaseAuth;
        currentAppId = window.getFirebaseAppId(); // Get the appId from index.html
        console.log("[Firebase Ready] DB, Auth, and AppId assigned from window. Setting up auth state listener.");
        
        window.authFunctions.onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                updateAuthButtonText(true, user.email || user.displayName);
                console.log("[AuthState] User signed in:", user.uid);
                console.log("[AuthState] User email:", user.email); // Log user email for debugging title
                if (user.email && user.email.toLowerCase() === KANGA_EMAIL) {
                    mainTitle.textContent = "Kanga's Share Watchlist";
                    console.log("[AuthState] Main title set to Kanga's Share Watchlist.");
                } else {
                    mainTitle.textContent = "My Share Watchlist";
                    console.log("[AuthState] Main title set to My Share Watchlist.");
                }
                updateMainButtonsState(true);
                await loadUserWatchlistsAndSettings(); // This will trigger the new migration logic
            } else {
                currentUserId = null;
                updateAuthButtonText(false);
                mainTitle.textContent = "Share Watchlist";
                console.log("[AuthState] User signed out.");
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
            }
            // Ensure initializeAppLogic is only called once after initial auth state is determined
            if (!window._appLogicInitialized) {
                initializeAppLogic();
                window._appLogicInitialized = true;
            }
        });
        
        if (googleAuthBtn) {
            googleAuthBtn.disabled = false;
            console.log("[Auth] Google Auth button enabled on DOMContentLoaded.");
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
