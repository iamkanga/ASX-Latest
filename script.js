// File Version: v165
// Last Updated: 2025-07-03 (Corrected Waiting and Diagnostic Logs)

// Wrap the entire script in an IIFE to create a private scope for its variables.
// This prevents "Identifier 'autoDismissTimeout' has already been declared" errors
// if the script is somehow loaded multiple times in the global scope.
(function() {

// This script interacts with Firebase Firestore for data storage.
// Firebase app, db, auth instances, and userId are made globally available
// via window.firestoreDb, window.firebaseAuth, window.getFirebaseAppId(), etc.,
// from the <script type="module"> block in index.html.

// Global Firebase instances (will be populated on DOMContentLoaded)
let db;
let auth;

// --- GLOBAL VARIABLES (Accessible throughout the script) ---
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
let currentSelectedWatchlistIds = []; // Stores IDs of currently selected watchlists for display
let unsubscribeShares = null; // Holds the unsubscribe function for the shares listener
let unsubscribeWatchlists = null; // Holds the unsubscribe function for the watchlists listener
let currentSortOrder = 'entryDate-desc'; // Default sort order
let currentWatchlistName = ''; // Tracks the currently displayed watchlist name


// --- DOM ELEMENT REFERENCES ---
// Using `const` for elements that are guaranteed to exist in the HTML on load.
// Using `let` for elements that might be null initially (e.g., inside modals that are hidden).
const appSidebar = document.getElementById('appSidebar');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const addShareHeaderBtn = document.getElementById('addShareHeaderBtn');
const shareFormSection = document.getElementById('shareFormSection');
const formTitle = document.getElementById('formTitle');
const shareNameInput = document.getElementById('shareName');
const currentPriceInput = document.getElementById('currentPrice');
const targetPriceInput = document.getElementById('targetPrice');
const dividendAmountInput = document.getElementById('dividendAmount');
const frankingCreditsInput = document.getElementById('frankingCredits');
const commentsFormContainer = document.getElementById('commentsFormContainer');
const addCommentSectionBtn = document.getElementById('addCommentSectionBtn');
const saveShareBtn = document.getElementById('saveShareBtn');
const cancelFormBtn = document.getElementById('cancelFormBtn');
const deleteShareBtn = document.getElementById('deleteShareBtn');
const shareTableBody = document.querySelector('#shareTable tbody');
const mobileShareCardsContainer = document.getElementById('mobileShareCards');
const shareDetailModal = document.getElementById('shareDetailModal');
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
const modalCommentsContainer = document.getElementById('modalCommentsContainer');
const deleteShareFromDetailBtn = document.getElementById('deleteShareFromDetailBtn');
const editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn');
const googleAuthBtn = document.getElementById('googleAuthBtn');
const mainTitle = document.getElementById('mainTitle');
const loadingIndicator = document.getElementById('loadingIndicator');
const customDialogModal = document.getElementById('customDialogModal');
const customDialogMessage = document.getElementById('customDialogMessage');
const customDialogConfirmBtn = document.getElementById('customDialogConfirmBtn');
const customDialogCancelBtn = document.getElementById('customDialogCancelBtn');
const newShareBtn = document.getElementById('newShareBtn');
const watchlistSelect = document.getElementById('watchlistSelect');
const addWatchlistBtn = document.getElementById('addWatchlistBtn');
const addWatchlistModal = document.getElementById('addWatchlistModal');
const newWatchlistNameInput = document.getElementById('newWatchlistName');
const saveWatchlistBtn = document.getElementById('saveWatchlistBtn');
const cancelAddWatchlistBtn = document.getElementById('cancelAddWatchlistBtn');
const editWatchlistBtn = document.getElementById('editWatchlistBtn');
const manageWatchlistModal = document.getElementById('manageWatchlistModal');
const editWatchlistNameInput = document.getElementById('editWatchlistName');
const deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn');
const saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn');
const cancelManageWatchlistBtn = document.getElementById('cancelManageWatchlistBtn');
const sortSelect = document.getElementById('sortSelect');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const colorThemeSelect = document.getElementById('colorThemeSelect');
const revertToDefaultThemeBtn = document.getElementById('revertToDefaultThemeBtn');
const logoutBtn = document.getElementById('logoutBtn');
const standardCalcBtn = document.getElementById('standardCalcBtn');
const dividendCalcBtn = document.getElementById('dividendCalcBtn');
const calculatorModal = document.getElementById('calculatorModal');
const calculatorInputDisplay = document.getElementById('calculatorInput');
const calculatorResultDisplay = document.getElementById('calculatorResult');
const calculatorButtons = document.querySelector('#calculatorModal .calculator-buttons');
const dividendCalculatorModal = document.getElementById('dividendCalculatorModal');
const calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
const calcDividendAmountInput = document.getElementById('calcDividendAmount');
const calcFrankingCreditsInput = document.getElementById('frankingCredits'); // This ID is reused, careful!
const calcUnfrankedYieldSpan = document.getElementById('calcUnfrankedYield');
const calcFrankedYieldSpan = document.getElementById('calcFrankedYield');
const investmentValueSelect = document.getElementById('investmentValueSelect');
const calcEstimatedDividendSpan = document.getElementById('calcEstimatedDividend');
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn');

// NEW: Share Research Feature DOM elements
const shareResearchInput = document.getElementById('shareResearchInput');
const shareResearchBtn = document.getElementById('shareResearchBtn');
const shareResearchModal = document.getElementById('shareResearchModal');
const researchShareCodeDisplay = document.getElementById('researchShareCodeDisplay');
const researchNewsLink = document.getElementById('researchNewsLink');
const researchMarketIndexLink = document.getElementById('researchMarketIndexLink');
const researchFoolLink = document.getElementById('researchFoolLink');
const researchCommSecLink = document.getElementById('researchCommSecLink');
const researchCommSecLoginMessage = document.getElementById('researchCommSecLoginMessage');
const researchCalcCurrentPrice = document.getElementById('researchCalcCurrentPrice');
const researchCalcDividendAmount = document.getElementById('researchCalcDividendAmount');
const researchFrankingCredits = document.getElementById('researchFrankingCredits');
const researchCalcUnfrankedYield = document.getElementById('researchCalcUnfrankedYield');
const researchCalcFrankedYield = document.getElementById('researchCalcFrankedYield');
const researchInvestmentValueSelect = document.getElementById('researchInvestmentValueSelect');
const researchCalcEstimatedDividend = document.getElementById('researchCalcEstimatedDividend');
const researchWatchlistSelect = document.getElementById('researchWatchlistSelect');
const researchTargetPrice = document.getElementById('researchTargetPrice');
const researchComments = document.getElementById('researchComments');
const cancelResearchBtn = document.getElementById('cancelResearchBtn');
const saveResearchShareBtn = document.getElementById('saveResearchShareBtn');


// --- UTILITY FUNCTIONS ---

/**
 * Displays a modal.
 * @param {HTMLElement} modalElement - The modal DOM element to display.
 */
function showModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'block';
        // Add a class to body to prevent scrolling
        document.body.classList.add('modal-open');
    } else {
        console.warn("Attempted to show a null modal element.");
    }
}

/**
 * Hides a modal.
 * @param {HTMLElement} modalElement - The modal DOM element to hide.
 */
function hideModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
        // Remove the class from body
        document.body.classList.remove('modal-open');
    } else {
        console.warn("Attempted to hide a null modal element.");
    }
}

/**
 * Shows a custom dialog message to the user.
 * @param {string} message - The message to display.
 * @param {boolean} isConfirm - If true, shows Yes/No buttons. Otherwise, just an OK button.
 * @returns {Promise<boolean>} - Resolves true for Confirm/Yes, false for Cancel/No, or true for OK.
 */
function showCustomDialog(message, isConfirm = false) {
    return new Promise((resolve) => {
        if (!customDialogModal || !customDialogMessage || !customDialogConfirmBtn || !customDialogCancelBtn) {
            console.error("Custom dialog elements not found. Falling back to native alert/confirm.");
            // Fallback to native alert if dialog elements are missing
            if (isConfirm) {
                resolve(confirm(message));
            } else {
                alert(message);
                resolve(true);
            }
            return;
        }

        customDialogMessage.textContent = message;
        customDialogCancelBtn.style.display = isConfirm ? 'inline-flex' : 'none'; // Show Cancel only for confirms
        customDialogConfirmBtn.innerHTML = isConfirm ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-check-circle"></i>'; // Change icon for OK/Yes
        customDialogConfirmBtn.title = isConfirm ? 'Yes' : 'OK';

        const confirmHandler = () => {
            hideModal(customDialogModal);
            customDialogConfirmBtn.removeEventListener('click', confirmHandler);
            customDialogCancelBtn.removeEventListener('click', cancelHandler);
            resolve(true);
        };

        const cancelHandler = () => {
            hideModal(customDialogModal);
            customDialogConfirmBtn.removeEventListener('click', confirmHandler);
            customDialogCancelBtn.removeEventListener('click', cancelHandler);
            resolve(false);
        };

        customDialogConfirmBtn.addEventListener('click', confirmHandler);
        customDialogCancelBtn.addEventListener('click', cancelHandler);

        showModal(customDialogModal);
    });
}

/**
 * Formats a number as currency (e.g., $25.50).
 * @param {number} value - The number to format.
 * @returns {string} - The formatted currency string.
 */
function formatCurrency(value) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '-';
    }
    return `$${value.toFixed(2)}`;
}

/**
 * Formats a number as a percentage (e.g., 5.00%).
 * @param {number} value - The number to format.
 * @returns {string} - The formatted percentage string.
 */
function formatPercentage(value) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '-';
    }
    return `${value.toFixed(2)}%`;
}

/**
 * Formats a number as a date string.
 * @param {number} timestamp - The Firestore timestamp seconds.
 * @returns {string} - The formatted date string.
 */
function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
    return date.toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Calculates unfranked and franked dividend yields.
 * @param {number} price - Current share price.
 * @param {number} dividend - Annual dividend amount per share.
 * @param {number} franking - Franking credits percentage (0-100).
 * @returns {{unfrankedYield: number, frankedYield: number}} - Calculated yields.
 */
function calculateYields(price, dividend, franking) {
    let unfrankedYield = 0;
    let frankedYield = 0;

    if (price > 0 && dividend > 0) {
        unfrankedYield = (dividend / price) * 100;
        // Franked yield calculation: dividend / price * (1 + (franking / 100) * (30 / 70)) * 100
        // Assuming company tax rate is 30% for franking credit calculation
        frankedYield = unfrankedYield * (1 + (franking / 100) * (30 / 70));
    }
    return {
        unfrankedYield: parseFloat(unfrankedYield.toFixed(2)),
        frankedYield: parseFloat(frankedYield.toFixed(2))
    };
}

/**
 * Calculates estimated annual dividend based on investment value.
 * @param {number} price - Current share price.
 * @param {number} dividend - Annual dividend amount per share.
 * @param {number} investmentValue - Total investment value.
 * @returns {number} - Estimated annual dividend.
 */
function calculateEstimatedAnnualDividend(price, dividend, investmentValue) {
    if (price > 0 && dividend > 0 && investmentValue > 0) {
        const numberOfShares = investmentValue / price;
        return numberOfShares * dividend;
    }
    return 0;
}

/**
 * Generates external link URLs for a given share code.
 * @param {string} shareCode - The ASX share code.
 * @returns {{marketIndex: string, fool: string, commSec: string, news: string}} - URLs for various financial sites.
 */
function generateExternalLinks(shareCode) {
    const encodedCode = encodeURIComponent(shareCode.toUpperCase());
    return {
        marketIndex: `https://www.marketindex.com.au/asx/${encodedCode}`,
        fool: `https://www.fool.com.au/quote/${encodedCode}/`,
        commSec: `https://www.commsec.com.au/market-insights/company-research/ASX-${encodedCode}.html`,
        news: `https://www.google.com/search?q=${encodedCode}+ASX+news`
    };
}

/**
 * Applies the selected theme to the body.
 * @param {string} themeName - The name of the theme (e.g., 'dark-theme', 'bold-1').
 */
function applyTheme(themeName) {
    document.body.className = ''; // Clear existing themes
    if (themeName && themeName !== 'system-default' && themeName !== 'none') {
        document.body.classList.add(`theme-${themeName}`);
    }
    // Also update the theme toggle button icon based on the current theme
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (themeName === 'system-default') {
        if (systemPrefersDark) {
            document.body.classList.add('dark-theme');
            if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i> <span>Light Mode</span>';
        } else {
            document.body.classList.remove('dark-theme');
            if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i> <span>Dark Mode</span>';
        }
    } else if (document.body.classList.contains('dark-theme')) {
        if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i> <span>Light Mode</span>';
    } else {
        if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i> <span>Dark Mode</span>';
    }

    // Save the selected theme to local storage
    localStorage.setItem('selectedTheme', themeName);
}

/**
 * Populates the theme selection dropdown.
 */
function populateThemeSelect() {
    const savedTheme = localStorage.getItem('selectedTheme') || 'system-default';
    if (colorThemeSelect) {
        colorThemeSelect.value = savedTheme;
        applyTheme(savedTheme); // Apply immediately on load
    }
}


// --- FIREBASE & DATA HANDLING ---

/**
 * Gets the base path for user-specific data in Firestore.
 * @returns {string} The Firestore collection path.
 */
function getUserDataPath() {
    if (!currentUserId) {
        console.error("User ID is not available. Cannot construct Firestore path.");
        return null;
    }
    const appId = currentAppId; // Use the globally assigned currentAppId
    // For private user data, use /artifacts/{appId}/users/{userId}/{collectionName}
    return `artifacts/${appId}/users/${currentUserId}`;
}

/**
 * Subscribes to real-time updates for the user's watchlists from Firestore.
 */
async function subscribeToWatchlists() {
    if (unsubscribeWatchlists) {
        unsubscribeWatchlists(); // Unsubscribe from previous listener if exists
        console.log("[Firestore Listener] Unsubscribed from watchlists listener.");
    }

    const userPath = getUserDataPath();
    // Now directly accessing window.firestoreFunctions
    if (!userPath || !db || !window.firestoreFunctions || !window.firestoreFunctions.collection || !window.firestoreFunctions.doc || !window.firestoreFunctions.setDoc || !window.firestoreFunctions.onSnapshot || !window.firestoreFunctions.serverTimestamp) {
        console.warn("Watchlists subscription skipped: Firestore functions not fully available.");
        return;
    }

    const watchlistsColRef = window.firestoreFunctions.collection(db, userPath, 'watchlists');
    unsubscribeWatchlists = window.firestoreFunctions.onSnapshot(watchlistsColRef, (snapshot) => {
        userWatchlists = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        // Ensure the default watchlist always exists for the current user
        const defaultWatchlistExists = userWatchlists.some(wl => wl.id === DEFAULT_WATCHLIST_ID_SUFFIX);
        if (!defaultWatchlistExists) {
            // Add default watchlist if it doesn't exist
            const defaultWatchlistRef = window.firestoreFunctions.doc(watchlistsColRef, DEFAULT_WATCHLIST_ID_SUFFIX);
            window.firestoreFunctions.setDoc(defaultWatchlistRef, { name: DEFAULT_WATCHLIST_NAME, createdAt: window.firestoreFunctions.serverTimestamp() }, { merge: true })
                .then(() => {
                    console.log("Default watchlist created/ensured.");
                })
                .catch(error => {
                    console.error("Error ensuring default watchlist:", error);
                });
        }
        populateWatchlistSelects(); // Update all watchlist dropdowns
        updateMainTitle(); // Update main title to show current watchlist
        console.log("[Firestore] Watchlists updated:", userWatchlists);
    }, (error) => {
        console.error("Error listening to watchlists:", error);
        showCustomDialog("Error loading watchlists. Please try again later.");
    });
    console.log("[Firestore Listener] Subscribed to watchlists.");
}

/**
 * Populates the watchlist dropdowns (`watchlistSelect` and `researchWatchlistSelect`).
 */
function populateWatchlistSelects() {
    const selects = [watchlistSelect, researchWatchlistSelect];
    selects.forEach(selectElement => {
        if (!selectElement) return; // Ensure the element exists

        // Store current selection to try and restore it
        const currentSelectedId = selectElement.value;

        selectElement.innerHTML = ''; // Clear existing options

        // Add a default "Select Watchlist" option for the research modal
        if (selectElement.id === 'researchWatchlistSelect') {
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "Select Watchlist";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            selectElement.appendChild(defaultOption);
        } else {
            // For the main watchlist select, ensure "All Shares" is always first
            const allSharesOption = document.createElement('option');
            allSharesOption.value = "ALL_SHARES_ID"; // Special ID for "All Shares"
            allSharesOption.textContent = "All Shares";
            selectElement.appendChild(allSharesOption);
        }
        

        // Sort watchlists alphabetically by name, but keep "My Watchlist (Default)" at the top
        const sortedWatchlists = [...userWatchlists].sort((a, b) => {
            if (a.id === DEFAULT_WATCHLIST_ID_SUFFIX) return -1;
            if (b.id === DEFAULT_WATCHLIST_ID_SUFFIX) return 1;
            return a.name.localeCompare(b.name);
        });

        sortedWatchlists.forEach(watchlist => {
            const option = document.createElement('option');
            option.value = watchlist.id;
            option.textContent = watchlist.name;
            selectElement.appendChild(option);
        });

        // Attempt to restore selection
        if (selectElement.id === 'watchlistSelect') {
            // For the main watchlist select, prioritize the stored currentSelectedWatchlistIds
            // If nothing is selected, default to "All Shares"
            if (currentSelectedWatchlistIds.length > 0 && selectElement.querySelector(`option[value="${currentSelectedWatchlistIds[0]}"]`)) {
                selectElement.value = currentSelectedWatchlistIds[0];
            } else {
                selectElement.value = "ALL_SHARES_ID";
                currentSelectedWatchlistIds = ["ALL_SHARES_ID"];
            }
            // Update currentWatchlistName based on the actual selected option
            currentWatchlistName = selectElement.options[selectElement.selectedIndex]?.textContent || "Watchlist";
        } else if (selectElement.id === 'researchWatchlistSelect') {
            // For research modal, try to restore previous selection or keep default
            if (currentSelectedId && selectElement.querySelector(`option[value="${currentSelectedId}"]`)) {
                selectElement.value = currentSelectedId;
            } else {
                // Default to the user's "My Watchlist (Default)" if it exists
                const defaultWatchlistOption = selectElement.querySelector(`option[value="${DEFAULT_WATCHLIST_ID_SUFFIX}"]`);
                if (defaultWatchlistOption) {
                    selectElement.value = DEFAULT_WATCHLIST_ID_SUFFIX;
                } else {
                    selectElement.value = ""; // Keep "Select Watchlist" if no default
                }
            }
        }
    });
    updateMainTitle(); // Ensure title reflects current watchlist
}


/**
 * Subscribes to real-time updates for shares based on the currently selected watchlists.
 */
async function subscribeToShares() {
    if (unsubscribeShares) {
        unsubscribeShares(); // Unsubscribe from previous listener
        console.log("[Firestore Listener] Unsubscribed from shares listener.");
    }

    const userPath = getUserDataPath();
    // Now directly accessing window.firestoreFunctions
    if (!userPath || !db || !window.firestoreFunctions || !window.firestoreFunctions.collection || !window.firestoreFunctions.query || !window.firestoreFunctions.where || !window.firestoreFunctions.onSnapshot) {
        console.warn("Shares subscription skipped: Firestore functions not fully available.");
        return;
    }

    if (loadingIndicator) loadingIndicator.style.display = 'block'; // Show loading indicator

    let q;
    const sharesCollectionRef = window.firestoreFunctions.collection(db, userPath, 'shares');

    if (currentSelectedWatchlistIds.includes("ALL_SHARES_ID")) {
        // Query all shares for the user
        q = window.firestoreFunctions.query(sharesCollectionRef);
        console.log("[Firestore Query] Fetching all shares.");
    } else if (currentSelectedWatchlistIds.length > 0) {
        // Query shares belonging to the selected watchlists
        q = window.firestoreFunctions.query(sharesCollectionRef, window.firestoreFunctions.where('watchlists', 'array-contains-any', currentSelectedWatchlistIds));
        console.log("[Firestore Query] Fetching shares for watchlists:", currentSelectedWatchlistIds);
    } else {
        // No watchlists selected, show empty list
        allSharesData = [];
        renderShareList();
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        console.log("[Firestore Query] No watchlists selected, displaying empty share list.");
        return;
    }

    unsubscribeShares = window.firestoreFunctions.onSnapshot(q, (snapshot) => {
        allSharesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderShareList();
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        console.log("[Firestore] Shares updated:", allSharesData);
    }, (error) => {
        console.error("Error listening to shares:", error);
        showCustomDialog("Error loading shares. Please try again later.");
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    });
    console.log("[Firestore Listener] Subscribed to shares.");
}


/**
 * Renders the share list in both table and mobile card formats.
 */
function renderShareList() {
    // Sort the shares before rendering
    const sortedShares = [...allSharesData].sort((a, b) => {
        let valA, valB;
        switch (currentSortOrder) {
            case 'entryDate-desc':
                valA = a.entryDate ? a.entryDate.seconds : 0;
                valB = b.entryDate ? b.entryDate.seconds : 0;
                return valB - valA; // Newest first
            case 'entryDate-asc':
                valA = a.entryDate ? a.entryDate.seconds : 0;
                valB = b.entryDate ? b.entryDate.seconds : 0;
                return valA - valB; // Oldest first
            case 'shareName-asc':
                valA = a.shareName.toLowerCase();
                valB = b.shareName.toLowerCase();
                return valA.localeCompare(valB);
            case 'shareName-desc':
                valA = a.shareName.toLowerCase();
                valB = b.shareName.toLowerCase();
                return valB.localeCompare(valA);
            case 'dividendAmount-desc':
                valA = parseFloat(a.dividendAmount || 0);
                valB = parseFloat(b.dividendAmount || 0);
                return valB - valA; // High to Low
            case 'dividendAmount-asc':
                valA = parseFloat(a.dividendAmount || 0);
                valB = parseFloat(b.dividendAmount || 0);
                return valA - valB; // Low to High
            default:
                return 0; // No sort
        }
    });

    if (shareTableBody) shareTableBody.innerHTML = '';
    if (mobileShareCardsContainer) mobileShareCardsContainer.innerHTML = '';

    if (sortedShares.length === 0) {
        if (shareTableBody) shareTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No shares added to this watchlist yet.</td></tr>';
        if (mobileShareCardsContainer) mobileShareCardsContainer.innerHTML = '<p style="text-align: center; padding: 15px;">No shares added to this watchlist yet.</p>';
        return;
    }

    sortedShares.forEach(share => {
        const { unfrankedYield, frankedYield } = calculateYields(
            parseFloat(share.enteredPrice),
            parseFloat(share.dividendAmount),
            parseFloat(share.frankingCredits)
        );

        // Render for desktop table
        if (shareTableBody) {
            const row = shareTableBody.insertRow();
            row.dataset.id = share.id;
            row.dataset.share = JSON.stringify(share); // Store full share data
            row.innerHTML = `
                <td>${share.shareName.toUpperCase()}</td>
                <td>${formatCurrency(share.enteredPrice)}</td>
                <td>${formatCurrency(share.targetPrice)}</td>
                <td>${formatCurrency(share.dividendAmount)} (${formatPercentage(unfrankedYield)} Unfranked, ${formatPercentage(frankedYield)} Franked)</td>
                <td>${share.comments && share.comments.length > 0 ? share.comments.length : '0'}</td>
            `;
            row.addEventListener('click', (event) => {
                // Deselect any previously selected row/card
                document.querySelectorAll('.share-list-section .selected').forEach(el => el.classList.remove('selected'));
                row.classList.add('selected');
                openShareDetailModal(share);
            });
            row.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                showContextMenu(event, share);
            });
            row.addEventListener('touchstart', (event) => handleTouchStart(event, share));
            row.addEventListener('touchmove', handleTouchMove);
            row.addEventListener('touchend', handleTouchEnd);
        }


        // Render for mobile cards
        if (mobileShareCardsContainer) {
            const card = document.createElement('div');
            card.classList.add('mobile-card');
            card.dataset.id = share.id;
            card.dataset.share = JSON.stringify(share); // Store full share data
            card.innerHTML = `
                <h3>${share.shareName.toUpperCase()}</h3>
                <p><strong>Entered Price:</strong> ${formatCurrency(share.enteredPrice)}</p>
                <p><strong>Target Price:</strong> ${formatCurrency(share.targetPrice)}</p>
                <p><strong>Dividends:</strong> ${formatCurrency(share.dividendAmount)} (${formatPercentage(unfrankedYield)} Unfranked, ${formatPercentage(frankedYield)} Franked)</p>
                <p><strong>Comments:</strong> ${share.comments ? share.comments.length : '0'}</p>
            `;
            card.addEventListener('click', (event) => {
                // Deselect any previously selected row/card
                document.querySelectorAll('.share-list-section .selected').forEach(el => el.classList.remove('selected'));
                card.classList.add('selected');
                openShareDetailModal(share);
            });
            card.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                showContextMenu(event, share);
            });
            card.addEventListener('touchstart', (event) => handleTouchStart(event, share));
            card.addEventListener('touchmove', handleTouchMove);
            card.addEventListener('touchend', handleTouchEnd);
            mobileShareCardsContainer.appendChild(card);
        }
    });
}

/**
 * Clears the share list UI.
 */
function clearShareList() {
    if (shareTableBody) shareTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No shares loaded.</td></tr>';
    if (mobileShareCardsContainer) mobileShareCardsContainer.innerHTML = '<p style="text-align: center; padding: 15px;">No shares loaded.</p>';
}

/**
 * Clears the watchlist UI elements.
 */
function clearWatchlistUI() {
    if (watchlistSelect) watchlistSelect.innerHTML = '';
    if (researchWatchlistSelect) researchWatchlistSelect.innerHTML = '';
    currentSelectedWatchlistIds = [];
    currentWatchlistName = '';
    updateMainTitle();
}


/**
 * Opens the share form modal for adding or editing a share.
 * @param {Object|null} share - The share object to edit, or null for a new share.
 */
function openShareFormModal(share = null) {
    if (!shareFormSection || !formTitle || !shareNameInput || !currentPriceInput || !targetPriceInput || !dividendAmountInput || !frankingCreditsInput || !commentsFormContainer || !deleteShareBtn) {
        console.error("Missing DOM elements for share form modal.");
        showCustomDialog("Application error: Share form elements not found.");
        return;
    }

    selectedShareDocId = share ? share.id : null;
    formTitle.textContent = share ? 'Edit Share' : 'Add New Share';
    deleteShareBtn.classList.toggle('hidden', !share); // Show delete button only for existing shares

    shareNameInput.value = share ? share.shareName : '';
    currentPriceInput.value = share ? share.enteredPrice : '';
    targetPriceInput.value = share ? share.targetPrice : '';
    dividendAmountInput.value = share ? share.dividendAmount : '';
    frankingCreditsInput.value = share ? share.frankingCredits : '';

    // Clear existing comments and add new ones
    commentsFormContainer.querySelectorAll('.comment-section').forEach(c => c.remove());
    if (share && share.comments && share.comments.length > 0) {
        share.comments.forEach(comment => addCommentSection(comment.title, comment.text));
    } else {
        // Add an initial empty comment section for new shares or shares without comments
        addCommentSection('', '');
    }

    showModal(shareFormSection);
    shareNameInput.focus();
}

/**
 * Adds a new comment section to the share form.
 * @param {string} title - The initial title for the comment.
 * @param {string} text - The initial text for the comment.
 */
function addCommentSection(title = '', text = '') {
    if (!commentsFormContainer) {
        console.error("Comments form container not found.");
        return;
    }
    const commentSection = document.createElement('div');
    commentSection.classList.add('comment-section');
    commentSection.innerHTML = `
        <div class="comment-section-header">
            <input type="text" class="comment-title-input" placeholder="Comment Title" value="${title}">
            <span class="comment-delete-btn"><i class="fas fa-times-circle"></i></span>
        </div>
        <textarea class="comment-text-input" placeholder="Your comments here...">${text}</textarea>
    `;
    commentsFormContainer.appendChild(commentSection);

    // Add event listener for delete button
    const deleteButton = commentSection.querySelector('.comment-delete-btn');
    if (deleteButton) {
        deleteButton.addEventListener('click', function() {
            commentSection.remove();
        });
    }
}

/**
 * Saves a new share or updates an existing one to Firestore.
 */
async function saveShare() {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to save shares.");
        return;
    }
    // Ensure all necessary Firestore functions are available
    if (!db || !window.firestoreFunctions || !window.firestoreFunctions.collection || !window.firestoreFunctions.doc || !window.firestoreFunctions.addDoc || !window.firestoreFunctions.updateDoc || !window.firestoreFunctions.serverTimestamp) {
        showCustomDialog("Firestore is not fully initialized. Please try again later.");
        console.error("Firestore functions missing for saveShare.");
        return;
    }

    const shareName = shareNameInput.value.trim();
    const enteredPrice = parseFloat(currentPriceInput.value);
    const targetPrice = parseFloat(targetPriceInput.value);
    const dividendAmount = parseFloat(dividendAmountInput.value);
    const frankingCredits = parseFloat(frankingCreditsInput.value);

    // Validate inputs
    if (!shareName) {
        showCustomDialog("Share Code is required.");
        return;
    }
    if (isNaN(enteredPrice) || enteredPrice <= 0) {
        showCustomDialog("Entered Price must be a positive number.");
        return;
    }
    if (isNaN(dividendAmount) || dividendAmount < 0) {
        showCustomDialog("Dividend Amount must be a non-negative number.");
        return;
    }
    if (isNaN(frankingCredits) || frankingCredits < 0 || frankingCredits > 100) {
        showCustomDialog("Franking Credits must be a number between 0 and 100.");
        return;
    }

    // Get comments
    const comments = [];
    if (commentsFormContainer) {
        commentsFormContainer.querySelectorAll('.comment-section').forEach(section => {
            const titleInput = section.querySelector('.comment-title-input');
            const textInput = section.querySelector('.comment-text-input');
            const title = titleInput ? titleInput.value.trim() : '';
            const text = textInput ? textInput.value.trim() : '';
            if (title || text) { // Only save if there's content
                comments.push({ title, text });
            }
        });
    }


    // Ensure at least one watchlist is selected for new shares
    let targetWatchlistIds = [...currentSelectedWatchlistIds];
    if (selectedShareDocId === null && (targetWatchlistIds.length === 0 || targetWatchlistIds.includes("ALL_SHARES_ID"))) {
        // If adding a new share and "All Shares" or no watchlist is selected,
        // default to "My Watchlist (Default)"
        const defaultWatchlist = userWatchlists.find(wl => wl.id === DEFAULT_WATCHLIST_ID_SUFFIX);
        if (defaultWatchlist) {
            targetWatchlistIds = [DEFAULT_WATCHLIST_ID_SUFFIX];
            showCustomDialog(`New share will be added to "${DEFAULT_WATCHLIST_NAME}".`);
        } else {
            showCustomDialog("Please select a watchlist to save the share to.");
            return;
        }
    } else if (targetWatchlistIds.includes("ALL_SHARES_ID")) {
        // If editing an existing share and "All Shares" is selected,
        // it means we're viewing all shares, but the share itself belongs to specific watchlists.
        // We need to preserve its existing watchlists.
        const existingShare = allSharesData.find(s => s.id === selectedShareDocId);
        if (existingShare && existingShare.watchlists) {
            targetWatchlistIds = existingShare.watchlists;
        } else {
            // Fallback if existing share has no watchlists, add to default
            const defaultWatchlist = userWatchlists.find(wl => wl.id === DEFAULT_WATCHLIST_ID_SUFFIX);
            if (defaultWatchlist) {
                targetWatchlistIds = [DEFAULT_WATCHLIST_ID_SUFFIX];
            } else {
                showCustomDialog("Could not determine target watchlist. Please select one.");
                return;
            }
        }
    }


    const shareData = {
        shareName: shareName.toUpperCase(),
        enteredPrice: enteredPrice,
        targetPrice: isNaN(targetPrice) ? null : targetPrice, // Store null if not a valid number
        dividendAmount: dividendAmount,
        frankingCredits: frankingCredits,
        comments: comments,
        watchlists: targetWatchlistIds // Link share to selected watchlists
    };

    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        const userPath = getUserDataPath();
        if (!userPath) return;
        const sharesCollectionRef = window.firestoreFunctions.collection(db, userPath, 'shares');

        if (selectedShareDocId) {
            // Update existing share
            const shareDocRef = window.firestoreFunctions.doc(sharesCollectionRef, selectedShareDocId);
            await window.firestoreFunctions.updateDoc(shareDocRef, shareData);
            showCustomDialog("Share updated successfully!");
            console.log("Share updated:", selectedShareDocId, shareData);
        } else {
            // Add new share
            shareData.entryDate = window.firestoreFunctions.serverTimestamp(); // Set entry date only for new shares
            const docRef = await window.firestoreFunctions.addDoc(sharesCollectionRef, shareData);
            showCustomDialog("Share added successfully!");
            console.log("Share added with ID:", docRef.id, shareData);
        }
        hideModal(shareFormSection);
    } catch (error) {
        console.error("Error saving share:", error);
        showCustomDialog("Error saving share. Please try again.");
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Deletes a share from Firestore.
 * @param {string} shareId - The ID of the share document to delete.
 */
async function deleteShare(shareId) {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to delete shares.");
        return;
    }
    // Ensure all necessary Firestore functions are available
    if (!db || !window.firestoreFunctions || !window.firestoreFunctions.collection || !window.firestoreFunctions.doc || !window.firestoreFunctions.deleteDoc) {
        showCustomDialog("Firestore is not fully initialized. Please try again later.");
        console.error("Firestore functions missing for deleteShare.");
        return;
    }

    const confirm = await showCustomDialog("Are you sure you want to delete this share?", true);
    if (!confirm) {
        return;
    }

    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        const userPath = getUserDataPath();
        if (!userPath) return;
        const shareDocRef = window.firestoreFunctions.doc(window.firestoreFunctions.collection(db, userPath, 'shares'), shareId);
        await window.firestoreFunctions.deleteDoc(shareDocRef);
        showCustomDialog("Share deleted successfully!");
        console.log("Share deleted:", shareId);
        hideModal(shareFormSection); // Close the form if open
        hideModal(shareDetailModal); // Close the detail modal if open
    } catch (error) {
        console.error("Error deleting share:", error);
        showCustomDialog("Error deleting share. Please try again.");
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Opens the share detail modal and populates it with data.
 * @param {Object} share - The share object to display.
 */
function openShareDetailModal(share) {
    if (!shareDetailModal || !modalShareName || !modalEntryDate || !modalEnteredPrice || !modalTargetPrice || !modalDividendAmount || !modalFrankingCredits || !modalUnfrankedYield || !modalFrankedYield || !modalNewsLink || !modalMarketIndexLink || !modalFoolLink || !modalCommSecLink || !modalCommentsContainer) {
        console.error("Missing DOM elements for share detail modal.");
        showCustomDialog("Application error: Share detail elements not found.");
        return;
    }

    selectedShareDocId = share.id; // Set selected share ID for edit/delete from detail modal
    modalShareName.textContent = share.shareName.toUpperCase();
    modalEntryDate.textContent = formatDate(share.entryDate ? share.entryDate.seconds : null);
    modalEnteredPrice.textContent = formatCurrency(share.enteredPrice);
    modalTargetPrice.textContent = formatCurrency(share.targetPrice);
    modalDividendAmount.textContent = formatCurrency(share.dividendAmount);
    modalFrankingCredits.textContent = formatPercentage(share.frankingCredits);

    const { unfrankedYield, frankedYield } = calculateYields(
        parseFloat(share.enteredPrice),
        parseFloat(share.dividendAmount),
        parseFloat(share.frankingCredits)
    );
    modalUnfrankedYield.textContent = formatPercentage(unfrankedYield);
    modalFrankedYield.textContent = formatPercentage(frankedYield);

    // Set external links
    const links = generateExternalLinks(share.shareName);
    modalNewsLink.href = links.news;
    modalMarketIndexLink.href = links.marketIndex;
    modalFoolLink.href = links.fool;
    modalCommSecLink.href = links.commSec;

    // Populate comments section
    modalCommentsContainer.innerHTML = '<h3>Comments</h3>'; // Clear previous comments
    if (share.comments && share.comments.length > 0) {
        share.comments.forEach(comment => {
            const commentItem = document.createElement('div');
            commentItem.classList.add('modal-comment-item');
            commentItem.innerHTML = `
                <strong>${comment.title || 'Untitled Comment'}</strong>
                <p>${comment.text || 'No comment text.'}</p>
            `;
            modalCommentsContainer.appendChild(commentItem);
        });
    } else {
        modalCommentsContainer.innerHTML += '<p>No comments for this share.</p>';
    }

    showModal(shareDetailModal);
}

/**
 * Adds a new watchlist to Firestore.
 */
async function addWatchlist() {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to add watchlists.");
        return;
    }
    // Ensure all necessary Firestore functions are available
    if (!db || !window.firestoreFunctions || !window.firestoreFunctions.collection || !window.firestoreFunctions.addDoc || !window.firestoreFunctions.serverTimestamp) {
        showCustomDialog("Firestore is not fully initialized. Please try again later.");
        console.error("Firestore functions missing for addWatchlist.");
        return;
    }
    if (!newWatchlistNameInput) {
        console.error("New watchlist name input not found.");
        showCustomDialog("Application error: Watchlist input element not found.");
        return;
    }

    const watchlistName = newWatchlistNameInput.value.trim();
    if (!watchlistName) {
        showCustomDialog("Watchlist name cannot be empty.");
        return;
    }

    // Check for duplicate names (case-insensitive)
    const isDuplicate = userWatchlists.some(wl => wl.name.toLowerCase() === watchlistName.toLowerCase());
    if (isDuplicate) {
        showCustomDialog("A watchlist with this name already exists. Please choose a different name.");
        return;
    }

    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        const userPath = getUserDataPath();
        if (!userPath) return;
        await window.firestoreFunctions.addDoc(window.firestoreFunctions.collection(db, userPath, 'watchlists'), {
            name: watchlistName,
            createdAt: window.firestoreFunctions.serverTimestamp()
        });
        showCustomDialog("Watchlist added successfully!");
        newWatchlistNameInput.value = ''; // Clear input
        hideModal(addWatchlistModal);
    } catch (error) {
        console.error("Error adding watchlist:", error);
        showCustomDialog("Error adding watchlist. Please try again.");
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Opens the manage watchlist modal, populating it with the currently selected watchlist's data.
 */
function openManageWatchlistModal() {
    if (!manageWatchlistModal || !editWatchlistNameInput || !deleteWatchlistInModalBtn) {
        console.error("Missing DOM elements for manage watchlist modal.");
        showCustomDialog("Application error: Manage watchlist elements not found.");
        return;
    }

    if (currentSelectedWatchlistIds.length !== 1 || currentSelectedWatchlistIds[0] === "ALL_SHARES_ID") {
        showCustomDialog("Please select a single watchlist to edit from the dropdown.");
        return;
    }

    const selectedWatchlistId = currentSelectedWatchlistIds[0];
    const watchlistToEdit = userWatchlists.find(wl => wl.id === selectedWatchlistId);

    if (!watchlistToEdit) {
        showCustomDialog("Selected watchlist not found.");
        return;
    }

    // Disable delete button for the default watchlist
    if (selectedWatchlistId === DEFAULT_WATCHLIST_ID_SUFFIX) {
        deleteWatchlistInModalBtn.classList.add('is-disabled-icon');
        deleteWatchlistInModalBtn.title = "Cannot delete default watchlist";
    } else {
        deleteWatchlistInModalBtn.classList.remove('is-disabled-icon');
        deleteWatchlistInModalBtn.title = "Delete Watchlist";
    }

    editWatchlistNameInput.value = watchlistToEdit.name;
    showModal(manageWatchlistModal);
}

/**
 * Saves changes to the currently managed watchlist.
 */
async function saveWatchlistName() {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to save watchlists.");
        return;
    }
    // Ensure all necessary Firestore functions are available
    if (!db || !window.firestoreFunctions || !window.firestoreFunctions.collection || !window.firestoreFunctions.doc || !window.firestoreFunctions.updateDoc) {
        showCustomDialog("Firestore is not fully initialized. Please try again later.");
        console.error("Firestore functions missing for saveWatchlistName.");
        return;
    }
    if (!editWatchlistNameInput) {
        console.error("Edit watchlist name input not found.");
        showCustomDialog("Application error: Edit watchlist input element not found.");
        return;
    }

    const selectedWatchlistId = currentSelectedWatchlistIds[0];
    const newName = editWatchlistNameInput.value.trim();

    if (!newName) {
        showCustomDialog("Watchlist name cannot be empty.");
        return;
    }

    // Check for duplicate names (excluding the current watchlist's original name)
    const originalWatchlist = userWatchlists.find(wl => wl.id === selectedWatchlistId);
    const isDuplicate = userWatchlists.some(wl =>
        wl.id !== selectedWatchlistId && wl.name.toLowerCase() === newName.toLowerCase()
    );

    if (isDuplicate) {
        showCustomDialog("A watchlist with this name already exists. Please choose a different name.");
        return;
    }

    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        const userPath = getUserDataPath();
        if (!userPath) return;
        const watchlistDocRef = window.firestoreFunctions.doc(window.firestoreFunctions.collection(db, userPath, 'watchlists'), selectedWatchlistId);
        await window.firestoreFunctions.updateDoc(watchlistDocRef, { name: newName });
        showCustomDialog("Watchlist name updated successfully!");
        hideModal(manageWatchlistModal);
    } catch (error) {
        console.error("Error updating watchlist name:", error);
        showCustomDialog("Error updating watchlist name. Please try again.");
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Deletes the currently managed watchlist from Firestore.
 */
async function deleteWatchlist() {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to delete watchlists.");
        return;
    }
    // Ensure all necessary Firestore functions are available
    if (!db || !window.firestoreFunctions || !window.firestoreFunctions.collection || !window.firestoreFunctions.doc || !window.firestoreFunctions.deleteDoc || !window.firestoreFunctions.query || !window.firestoreFunctions.where || !window.firestoreFunctions.getDocs || !window.firestoreFunctions.serverTimestamp || !window.firestoreFunctions.writeBatch) {
        showCustomDialog("Firestore is not fully initialized. Please try again later.");
        console.error("Firestore functions missing for deleteWatchlist.");
        return;
    }

    const selectedWatchlistId = currentSelectedWatchlistIds[0];

    // Prevent deletion of the default watchlist
    if (selectedWatchlistId === DEFAULT_WATCHLIST_ID_SUFFIX) {
        showCustomDialog("The default watchlist cannot be deleted.");
        return;
    }

    const confirm = await showCustomDialog("Are you sure you want to delete this watchlist and remove all shares from it?", true);
    if (!confirm) {
        return;
    }

    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        const userPath = getUserDataPath();
        if (!userPath) return;
        
        const batch = window.firestoreFunctions.writeBatch(db);

        // 1. Delete the watchlist document itself
        const watchlistDocRef = window.firestoreFunctions.doc(window.firestoreFunctions.collection(db, userPath, 'watchlists'), selectedWatchlistId);
        batch.delete(watchlistDocRef);

        // 2. Remove this watchlist from any shares that belong to it
        const sharesCollectionRef = window.firestoreFunctions.collection(db, userPath, 'shares');
        const q = window.firestoreFunctions.query(sharesCollectionRef, window.firestoreFunctions.where('watchlists', 'array-contains', selectedWatchlistId));
        const querySnapshot = await window.firestoreFunctions.getDocs(q);

        querySnapshot.forEach(shareDoc => {
            const currentWatchlists = shareDoc.data().watchlists || [];
            const updatedWatchlists = currentWatchlists.filter(wlId => wlId !== selectedWatchlistId);

            // If a share is no longer in any watchlist, move it to the default watchlist
            if (updatedWatchlists.length === 0) {
                updatedWatchlists.push(DEFAULT_WATCHLIST_ID_SUFFIX);
            }

            const shareRef = window.firestoreFunctions.doc(sharesCollectionRef, shareDoc.id);
            batch.update(shareRef, { watchlists: updatedWatchlists });
        });

        await batch.commit();

        // After successful deletion, reset current selection to "All Shares"
        if (watchlistSelect) watchlistSelect.value = "ALL_SHARES_ID";
        currentSelectedWatchlistIds = ["ALL_SHARES_ID"];
        subscribeToShares(); // Re-subscribe to update the main list
        updateMainTitle(); // Update the main title

        showCustomDialog("Watchlist and associated shares updated successfully!");
        hideModal(manageWatchlistModal);
    } catch (error) {
        console.error("Error deleting watchlist:", error);
        showCustomDialog("Error deleting watchlist. Please try again.");
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}


/**
 * Updates the main title to reflect the current watchlist name.
 */
function updateMainTitle() {
    if (!mainTitle || !watchlistSelect) return;

    if (watchlistSelect.value === "ALL_SHARES_ID") {
        mainTitle.textContent = "All Shares";
    } else {
        const selectedOption = watchlistSelect.options[watchlistSelect.selectedIndex];
        if (selectedOption) {
            currentWatchlistName = selectedOption.textContent;
            mainTitle.textContent = currentWatchlistName;
        } else {
            mainTitle.textContent = "Share Watchlist"; // Fallback
        }
    }
}

/**
 * Updates the state of main action buttons (Add Share, Watchlist controls).
 * @param {boolean} enable - True to enable, false to disable.
 */
function updateMainButtonsState(enable) {
    const buttons = [
        addShareHeaderBtn,
        newShareBtn,
        addWatchlistBtn,
        editWatchlistBtn,
        watchlistSelect,
        sortSelect,
        exportWatchlistBtn,
        shareResearchBtn,
        shareResearchInput
    ];
    buttons.forEach(btn => {
        if (btn) { // Check if element exists before trying to access properties
            btn.disabled = !enable;
            // For icon-only spans acting as buttons, toggle a class
            if (btn.tagName === 'SPAN' || btn.tagName === 'I') {
                btn.classList.toggle('is-disabled-icon', !enable);
            }
        }
    });
}

/**
 * Handles user authentication state changes.
 * @param {Object} user - The Firebase user object, or null if logged out.
 */
function handleAuthStateChanged(user) {
    if (user) {
        currentUserId = user.uid;
        if (googleAuthBtn) googleAuthBtn.textContent = "Signed In";
        if (googleAuthBtn) googleAuthBtn.disabled = true; // Disable button once signed in
        if (logoutBtn) logoutBtn.classList.remove('is-disabled-icon'); // Enable logout button
        updateMainButtonsState(true);
        if (mainTitle) mainTitle.textContent = "Loading Watchlists...";
        
        // Directly call subscriptions here. The outer DOMContentLoaded wait ensures Firebase is ready.
        console.log("[Auth State] window.firestoreFunctions:", window.firestoreFunctions);
        console.log("[Auth State] typeof window.firestoreFunctions.serverTimestamp:", typeof window.firestoreFunctions.serverTimestamp);

        if (window.firestoreFunctions && typeof window.firestoreFunctions.serverTimestamp === 'function') {
            console.log("[Auth State] Firebase functions are available. Initiating subscriptions.");
            subscribeToWatchlists();
            subscribeToShares();
        } else {
            // This fallback should ideally not be hit if index.html and the DOMContentLoaded wait work correctly
            console.error("[Auth State] Firebase functions not available after auth state change. Subscriptions failed.");
            showCustomDialog("Error: Failed to load data. Please refresh the page.");
        }
        
        populateThemeSelect(); // Load and apply theme
        console.log("Auth State: User signed in:", user.uid);
    } else {
        currentUserId = null;
        if (googleAuthBtn) googleAuthBtn.textContent = "Sign In";
        if (googleAuthBtn) googleAuthBtn.disabled = false; // Enable sign-in button
        if (logoutBtn) logoutBtn.classList.add('is-disabled-icon'); // Disable logout button
        updateMainButtonsState(false);
        if (mainTitle) mainTitle.textContent = "Share Watchlist"; // Reset title
        clearShareList();
        clearWatchlistUI();
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        applyTheme('system-default'); // Revert to default theme on logout
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
        console.log("Auth State: User signed out.");
    }
}

// --- CALCULATOR LOGIC (Standard) ---
function updateCalculatorDisplay() {
    if (calculatorInputDisplay) calculatorInputDisplay.textContent = previousCalculatorInput + (operator || '') + currentCalculatorInput;
    if (calculatorResultDisplay) calculatorResultDisplay.textContent = currentCalculatorInput || '0';
}

function clearCalculator() {
    currentCalculatorInput = '';
    operator = null;
    previousCalculatorInput = '';
    resultDisplayed = false;
    updateCalculatorDisplay();
}

function appendNumber(number) {
    if (resultDisplayed) {
        currentCalculatorInput = '';
        resultDisplayed = false;
    }
    if (number === '.' && currentCalculatorInput.includes('.')) return;
    currentCalculatorInput += number;
    updateCalculatorDisplay();
}

function chooseOperator(nextOperator) {
    if (currentCalculatorInput === '' && previousCalculatorInput === '') return;

    if (currentCalculatorInput !== '') {
        if (previousCalculatorInput !== '') {
            calculateResult();
        }
        previousCalculatorInput = currentCalculatorInput;
    }
    operator = nextOperator;
    currentCalculatorInput = '';
    resultDisplayed = false;
    updateCalculatorDisplay();
}

function calculateResult() {
    let calculation;
    const prev = parseFloat(previousCalculatorInput);
    const current = parseFloat(currentCalculatorInput);

    if (isNaN(prev) || isNaN(current) || !operator) return;

    switch (operator) {
        case '+':
            calculation = prev + current;
            break;
        case '-':
            calculation = prev - current;
            break;
        case '×':
            calculation = prev * current;
            break;
        case '÷':
            calculation = current !== 0 ? prev / current : 'Error';
            break;
        case '%':
            calculation = (prev / 100) * current;
            break;
        default:
            return;
    }

    currentCalculatorInput = calculation.toString();
    operator = null;
    previousCalculatorInput = '';
    resultDisplayed = true;
    updateCalculatorDisplay();
}

// --- DIVIDEND CALCULATOR LOGIC ---
function calculateDividendYieldsAndEstimatedDividend(
    priceInput, dividendInput, frankingInput,
    unfrankedYieldSpan, frankedYieldSpan,
    investmentValueSelect, estimatedDividendSpan
) {
    if (!priceInput || !dividendInput || !frankingInput || !unfrankedYieldSpan || !frankedYieldSpan || !investmentValueSelect || !estimatedDividendSpan) {
        console.warn("Missing elements for dividend calculation. Skipping.");
        return;
    }

    const price = parseFloat(priceInput.value);
    const dividend = parseFloat(dividendInput.value);
    const franking = parseFloat(frankingInput.value);
    const investmentValue = parseFloat(investmentValueSelect.value);

    if (isNaN(price) || isNaN(dividend) || isNaN(franking)) {
        unfrankedYieldSpan.textContent = '-';
        frankedYieldSpan.textContent = '-';
        estimatedDividendSpan.textContent = '-';
        return;
    }

    const { unfrankedYield, frankedYield } = calculateYields(price, dividend, franking);
    unfrankedYieldSpan.textContent = formatPercentage(unfrankedYield);
    frankedYieldSpan.textContent = formatPercentage(frankedYield);

    const estimatedDividend = calculateEstimatedAnnualDividend(price, dividend, investmentValue);
    estimatedDividendSpan.textContent = formatCurrency(estimatedDividend);
}

// --- SHARE RESEARCH MODAL LOGIC (NEW) ---

/**
 * Opens the Share Research Modal and populates it.
 * @param {string} shareCode - The share code to research.
 */
async function openShareResearchModal(shareCode) {
    if (!shareResearchModal || !researchShareCodeDisplay || !researchNewsLink || !researchMarketIndexLink || !researchFoolLink || !researchCommSecLink || !researchCalcCurrentPrice || !researchCalcDividendAmount || !researchFrankingCredits || !researchCalcUnfrankedYield || !researchCalcFrankedYield || !researchInvestmentValueSelect || !researchCalcEstimatedDividend || !researchWatchlistSelect || !researchTargetPrice || !researchComments) {
        console.error("Missing DOM elements for share research modal.");
        showCustomDialog("Application error: Share research elements not found.");
        return;
    }

    if (!shareCode) {
        showCustomDialog("Please enter a share code to research.");
        return;
    }

    researchShareCodeDisplay.textContent = shareCode.toUpperCase();

    // Populate external links
    const links = generateExternalLinks(shareCode);
    researchNewsLink.href = links.news;
    researchMarketIndexLink.href = links.marketIndex;
    researchFoolLink.href = links.fool;
    researchCommSecLink.href = links.commSec;

    // Reset and populate the dividend calculator within the research modal
    researchCalcCurrentPrice.value = '';
    researchCalcDividendAmount.value = '';
    researchFrankingCredits.value = '';
    researchCalcUnfrankedYield.textContent = '-';
    researchCalcFrankedYield.textContent = '-';
    researchInvestmentValueSelect.value = '10000'; // Default to $10,000
    researchCalcEstimatedDividend.textContent = '-';

    // Populate the watchlist select dropdown
    populateWatchlistSelects(); // This function already handles both main and research selects

    // Reset target price and comments
    researchTargetPrice.value = '';
    researchComments.value = '';

    showModal(shareResearchModal);
}

/**
 * Calculates dividend yields and estimated dividend for the research modal.
 */
function calculateResearchDividendYields() {
    calculateDividendYieldsAndEstimatedDividend(
        researchCalcCurrentPrice,
        researchCalcDividendAmount,
        researchFrankingCredits,
        researchCalcUnfrankedYield,
        researchCalcFrankedYield,
        researchInvestmentValueSelect,
        researchCalcEstimatedDividend
    );
}

/**
 * Saves the researched share to the selected watchlist.
 */
async function saveResearchedShareToWatchlist() {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to save shares.");
        return;
    }
    // Ensure all necessary Firestore functions are available
    if (!db || !window.firestoreFunctions || !window.firestoreFunctions.collection || !window.firestoreFunctions.doc || !window.firestoreFunctions.addDoc || !window.firestoreFunctions.updateDoc || !window.firestoreFunctions.query || !window.firestoreFunctions.where || !window.firestoreFunctions.getDocs || !window.firestoreFunctions.serverTimestamp) {
        showCustomDialog("Firestore is not fully initialized. Please try again later.");
        console.error("Firestore functions missing for saveResearchedShareToWatchlist.");
        return;
    }
    if (!researchShareCodeDisplay || !researchCalcCurrentPrice || !researchCalcDividendAmount || !researchFrankingCredits || !researchWatchlistSelect || !researchTargetPrice || !researchComments) {
        console.error("Missing DOM elements for saving researched share.");
        showCustomDialog("Application error: Research save elements not found.");
        return;
    }


    const shareName = researchShareCodeDisplay.textContent.trim();
    const enteredPrice = parseFloat(researchCalcCurrentPrice.value);
    const dividendAmount = parseFloat(researchCalcDividendAmount.value);
    const frankingCredits = parseFloat(researchFrankingCredits.value);
    const targetPrice = parseFloat(researchTargetPrice.value);
    const commentsText = researchComments.value.trim();
    const selectedWatchlistId = researchWatchlistSelect.value;

    // Basic validation
    if (!shareName || shareName === 'N/A') {
        showCustomDialog("Share Code is missing from research. Please search for a valid share.");
        return;
    }
    if (isNaN(enteredPrice) || enteredPrice <= 0) {
        showCustomDialog("Share Price (Entered Price) is required and must be a positive number.");
        return;
    }
    if (isNaN(dividendAmount) || dividendAmount < 0) {
        showCustomDialog("Dividend Amount is required and must be a non-negative number.");
        return;
    }
    if (isNaN(frankingCredits) || frankingCredits < 0 || frankingCredits > 100) {
        showCustomDialog("Franking Credits must be a number between 0 and 100.");
        return;
    }
    if (!selectedWatchlistId) {
        showCustomDialog("Please select a watchlist to save this share to.");
        return;
    }

    // Prepare comments array
    const comments = [];
    if (commentsText) {
        comments.push({
            title: 'Research Notes', // Default title for research comments
            text: commentsText
        });
    }

    const shareData = {
        shareName: shareName,
        enteredPrice: enteredPrice,
        targetPrice: isNaN(targetPrice) ? null : targetPrice, // Store null if not a valid number
        dividendAmount: dividendAmount,
        frankingCredits: frankingCredits,
        comments: comments,
        watchlists: [selectedWatchlistId], // Link to the single selected watchlist
        entryDate: window.firestoreFunctions.serverTimestamp() // New entry
    };

    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        const userPath = getUserDataPath();
        if (!userPath) return;
        const sharesCollectionRef = window.firestoreFunctions.collection(db, userPath, 'shares');

        // Check if a share with this code already exists in the selected watchlist
        const existingShareQuery = window.firestoreFunctions.query(
            sharesCollectionRef,
            window.firestoreFunctions.where('shareName', '==', shareName),
            window.firestoreFunctions.where('watchlists', 'array-contains', selectedWatchlistId)
        );
        const existingShareSnapshot = await window.firestoreFunctions.getDocs(existingShareQuery);

        if (!existingShareSnapshot.empty) {
            const existingShareDoc = existingShareSnapshot.docs[0];
            const confirmUpdate = await showCustomDialog(`Share "${shareName}" already exists in "${researchWatchlistSelect.options[researchWatchlistSelect.selectedIndex].textContent}". Do you want to update it?`, true);
            if (confirmUpdate) {
                // Update existing share
                await window.firestoreFunctions.updateDoc(existingShareDoc.ref, shareData);
                showCustomDialog("Share updated successfully in selected watchlist!");
            } else {
                showCustomDialog("Save operation cancelled.");
                return;
            }
        } else {
            // Add new share
            await window.firestoreFunctions.addDoc(sharesCollectionRef, shareData);
            showCustomDialog("Share added to watchlist successfully!");
        }

        hideModal(shareResearchModal);
        // No need to manually refresh, onSnapshot listener will handle it
    } catch (error) {
        console.error("Error saving researched share:", error);
        showCustomDialog("Error saving researched share. Please try again.");
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}


// --- CONTEXT MENU LOGIC ---
const shareContextMenu = document.getElementById('shareContextMenu');
const contextEditShareBtn = document.getElementById('contextEditShareBtn');
const contextDeleteShareBtn = document.getElementById('contextDeleteShareBtn');
let activeShareForContext = null; // Stores the share object for the context menu

/**
 * Shows the custom context menu.
 * @param {Event} event - The event that triggered the context menu.
 * @param {Object} share - The share object associated with the context.
 */
function showContextMenu(event, share) {
    if (!shareContextMenu) {
        console.error("Context menu element not found.");
        return;
    }
    activeShareForContext = share;
    shareContextMenu.style.display = 'block';
    
    // Position the context menu
    // Prioritize mouse position on desktop, tap position on mobile
    let x = event.clientX;
    let y = event.clientY;

    // Adjust for menu size and screen boundaries
    const menuWidth = shareContextMenu.offsetWidth;
    const menuHeight = shareContextMenu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10; // 10px margin
    }
    if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10; // 10px margin
    }

    shareContextMenu.style.left = `${x}px`;
    shareContextMenu.style.top = `${y}px`;

    // Add a click listener to the document to hide the menu
    document.addEventListener('click', hideContextMenu);
}

/**
 * Hides the custom context menu.
 */
function hideContextMenu() {
    if (shareContextMenu) shareContextMenu.style.display = 'none';
    document.removeEventListener('click', hideContextMenu);
    activeShareForContext = null;
}

// --- TOUCH EVENT HANDLING FOR LONG PRESS (Context Menu) ---
function handleTouchStart(event, share) {
    // Prevent default context menu
    // event.preventDefault(); // Do not prevent default here, as it can block scrolling

    // Store initial touch position
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;

    // Clear any existing timer
    if (longPressTimer) {
        clearTimeout(longPressTimer);
    }

    // Set a timer for long press
    longPressTimer = setTimeout(() => {
        // If touch has moved significantly, it's a scroll, not a long press
        if (Math.abs(event.touches[0].clientX - touchStartX) > TOUCH_MOVE_THRESHOLD ||
            Math.abs(event.touches[0].clientY - touchStartY) > TOUCH_MOVE_THRESHOLD) {
            return; // It was a scroll, not a long press
        }
        
        // This is a long press, show context menu
        showContextMenu(event, share);
        longPressTimer = null; // Reset timer
    }, LONG_PRESS_THRESHOLD);
}

function handleTouchMove(event) {
    // If touch moves significantly, cancel the long press timer
    if (longPressTimer) {
        const currentX = event.touches[0].clientX;
        const currentY = event.touches[0].clientY;
        const deltaX = Math.abs(currentX - touchStartX);
        const deltaY = Math.abs(currentY - touchStartY);

        if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }
}

function handleTouchEnd() {
    // If the timer is still running, it means it was a short tap, not a long press
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}


/**
 * Exports the current shares in the selected watchlist to a CSV file.
 */
async function exportWatchlistToCSV() {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to export data.");
        return;
    }

    if (allSharesData.length === 0) {
        showCustomDialog("No shares to export in the current view.");
        return;
    }

    const confirmExport = await showCustomDialog("Export current shares to CSV?", true);
    if (!confirmExport) {
        return;
    }

    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';

        // Define CSV headers
        const headers = [
            "Share Code", "Entry Date", "Entered Price", "Target Price",
            "Dividend Amount", "Franking Credits (%)", "Unfranked Yield (%)",
            "Franked Yield (%)", "Comments"
        ];

        // Map share data to CSV rows
        const csvRows = allSharesData.map(share => {
            const { unfrankedYield, frankedYield } = calculateYields(
                parseFloat(share.enteredPrice),
                parseFloat(share.dividendAmount),
                parseFloat(share.frankingCredits)
            );

            // Flatten comments into a single string, handling multiple comments
            const commentsString = share.comments && share.comments.length > 0
                ? share.comments.map(c => `${c.title}: ${c.text}`).join('; ')
                : '';

            return [
                `"${share.shareName.toUpperCase()}"`,
                `"${formatDate(share.entryDate ? share.entryDate.seconds : null)}"`,
                `"${share.enteredPrice || ''}"`,
                `"${share.targetPrice || ''}"`,
                `"${share.dividendAmount || ''}"`,
                `"${share.frankingCredits || ''}"`, // Use frankingCredits directly from the variable
                `"${unfrankedYield || ''}"`,
                `"${frankedYield || ''}"`,
                `"${commentsString.replace(/"/g, '""')}"` // Escape double quotes for CSV
            ].join(',');
        });

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...csvRows
        ].join('\n');

        // Create a Blob and download it
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const fileName = currentWatchlistName === "All Shares" ? "all_shares_export.csv" : `${currentWatchlistName.toLowerCase().replace(/\s/g, '_')}_export.csv`;
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showCustomDialog("Watchlist exported successfully!");

    } catch (error) {
        console.error("Error exporting watchlist:", error);
        showCustomDialog("Error exporting watchlist. Please try again.");
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}


// --- INITIALIZATION ---

/**
 * Initializes the application logic (event listeners, etc.).
 * This function should NOT set up the onAuthStateChanged listener,
 * as that is handled in the DOMContentLoaded block.
 */
function initializeAppLogic() {
    // --- EVENT LISTENERS ---

    // Sidebar and Modals
    if (hamburgerBtn) hamburgerBtn.addEventListener('click', () => {
        if (appSidebar) appSidebar.classList.add('open');
        if (sidebarOverlay) sidebarOverlay.classList.add('open');
    });

    if (closeMenuBtn) closeMenuBtn.addEventListener('click', () => {
        if (appSidebar) appSidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('open');
    });

    if (sidebarOverlay) sidebarOverlay.addEventListener('click', (event) => {
        // Only close if clicking directly on the overlay, not its children
        if (event.target === sidebarOverlay) {
            if (appSidebar) appSidebar.classList.remove('open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('open');
        }
    });

    // Close modals when clicking outside content
    document.querySelectorAll('.modal').forEach(modal => {
        if (modal) { // Ensure modal exists
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    hideModal(modal);
                }
            });
        }
    });

    // Close buttons for modals
    document.querySelectorAll('.modal .close-button').forEach(button => {
        if (button) { // Ensure button exists
            button.addEventListener('click', (event) => {
                hideModal(event.target.closest('.modal'));
            });
        }
    });

    // Share Form Modal Buttons
    if (addShareHeaderBtn) addShareHeaderBtn.addEventListener('click', () => openShareFormModal());
    if (newShareBtn) newShareBtn.addEventListener('click', () => openShareFormModal());
    if (cancelFormBtn) cancelFormBtn.addEventListener('click', () => hideModal(shareFormSection));
    if (saveShareBtn) saveShareBtn.addEventListener('click', saveShare);
    if (deleteShareBtn) deleteShareBtn.addEventListener('click', () => {
        if (selectedShareDocId) {
            deleteShare(selectedShareDocId);
        }
    });

    // Share Details Modal Buttons
    if (editShareFromDetailBtn) editShareFromDetailBtn.addEventListener('click', () => {
        const shareData = JSON.parse(document.querySelector('#shareTable tbody tr.selected')?.dataset.share || document.querySelector('#mobileShareCards .mobile-card.selected')?.dataset.share);
        if (shareData) {
            hideModal(shareDetailModal);
            openShareFormModal(shareData);
        } else {
            showCustomDialog("No share selected to edit.");
        }
    });
    if (deleteShareFromDetailBtn) deleteShareFromDetailBtn.addEventListener('click', () => {
        if (selectedShareDocId) {
            deleteShare(selectedShareDocId);
        }
    });

    // Comments section in Share Form
    if (addCommentSectionBtn) addCommentSectionBtn.addEventListener('click', () => addCommentSection());

    // Watchlist Management
    if (addWatchlistBtn) addWatchlistBtn.addEventListener('click', () => showModal(addWatchlistModal));
    if (cancelAddWatchlistBtn) cancelAddWatchlistBtn.addEventListener('click', () => hideModal(addWatchlistModal));
    if (saveWatchlistBtn) saveWatchlistBtn.addEventListener('click', addWatchlist);
    if (editWatchlistBtn) editWatchlistBtn.addEventListener('click', openManageWatchlistModal);
    if (cancelManageWatchlistBtn) cancelManageWatchlistBtn.addEventListener('click', () => hideModal(manageWatchlistModal));
    if (saveWatchlistNameBtn) saveWatchlistNameBtn.addEventListener('click', saveWatchlistName);
    if (deleteWatchlistInModalBtn) deleteWatchlistInModalBtn.addEventListener('click', deleteWatchlist);

    // Main Watchlist Select Change
    if (watchlistSelect) watchlistSelect.addEventListener('change', (event) => {
        currentSelectedWatchlistIds = [event.target.value];
        subscribeToShares(); // Re-subscribe to shares based on new selection
        updateMainTitle(); // Update main title
    });

    // Sort Select Change
    if (sortSelect) sortSelect.addEventListener('change', (event) => {
        currentSortOrder = event.target.value;
        renderShareList(); // Re-render with new sort order
    });

    // Theme Toggling
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('selectedTheme') || 'system-default';
        if (currentTheme === 'dark-theme') {
            applyTheme('system-default');
        } else {
            applyTheme('dark-theme');
        }
    });
    if (colorThemeSelect) colorThemeSelect.addEventListener('change', (event) => {
        applyTheme(event.target.value);
    });
    if (revertToDefaultThemeBtn) revertToDefaultThemeBtn.addEventListener('click', () => {
        applyTheme('system-default');
        if (colorThemeSelect) colorThemeSelect.value = 'none'; // Reset dropdown
    });

    // Standard Calculator
    if (standardCalcBtn) standardCalcBtn.addEventListener('click', () => {
        clearCalculator();
        showModal(calculatorModal);
    });
    if (calculatorButtons) calculatorButtons.addEventListener('click', (event) => {
        const target = event.target;
        if (target.tagName !== 'BUTTON') return;

        const value = target.dataset.value;
        const action = target.dataset.action;

        if (value) {
            appendNumber(value);
        } else if (action) {
            if (action === 'clear') {
                clearCalculator();
            } else if (action === 'calculate') {
                calculateResult();
            } else {
                chooseOperator(target.textContent);
            }
        }
    });

    // Dividend Calculator (Standalone)
    if (dividendCalcBtn) dividendCalcBtn.addEventListener('click', () => {
        // Reset fields when opening standalone dividend calculator
        if (calcCurrentPriceInput) calcCurrentPriceInput.value = '';
        if (calcDividendAmountInput) calcDividendAmountInput.value = '';
        // Note: frankingCreditsInput is shared, ensure correct one is targeted if there are multiple
        // For standalone dividend calculator, we should use the one inside that modal if it had its own.
        // Assuming calcFrankingCreditsInput is the one inside dividendCalculatorModal from HTML
        const dividendModalFrankingInput = document.querySelector('#dividendCalculatorModal #frankingCredits');
        if (dividendModalFrankingInput) dividendModalFrankingInput.value = ''; 

        if (calcUnfrankedYieldSpan) calcUnfrankedYieldSpan.textContent = '-';
        if (calcFrankedYieldSpan) calcFrankedYieldSpan.textContent = '-';
        if (investmentValueSelect) investmentValueSelect.value = '10000';
        if (calcEstimatedDividendSpan) calcEstimatedDividendSpan.textContent = '-';
        showModal(dividendCalculatorModal);
    });
    // Event listeners for dividend calculator inputs
    // Ensure elements exist before adding listeners
    const dividendModalFrankingInput = document.querySelector('#dividendCalculatorModal #frankingCredits'); // Get the specific input for this modal
    const dividendCalcInputs = [calcCurrentPriceInput, calcDividendAmountInput, dividendModalFrankingInput, investmentValueSelect];
    dividendCalcInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                calculateDividendYieldsAndEstimatedDividend(
                    calcCurrentPriceInput, calcDividendAmountInput, dividendModalFrankingInput, // Use specific input
                    calcUnfrankedYieldSpan, calcFrankedYieldSpan,
                    investmentValueSelect, calcEstimatedDividendSpan
                );
            });
        }
    });

    // Export Watchlist
    if (exportWatchlistBtn) exportWatchlistBtn.addEventListener('click', exportWatchlistToCSV);

    // NEW: Share Research Feature Event Listeners
    if (shareResearchBtn) shareResearchBtn.addEventListener('click', () => {
        if (shareResearchInput) {
            const shareCode = shareResearchInput.value.trim();
            openShareResearchModal(shareCode);
        }
    });
    if (shareResearchInput) shareResearchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            const shareCode = shareResearchInput.value.trim();
            openShareResearchModal(shareCode);
        }
    });
    if (cancelResearchBtn) cancelResearchBtn.addEventListener('click', () => hideModal(shareResearchModal));
    if (saveResearchShareBtn) saveResearchShareBtn.addEventListener('click', saveResearchedShareToWatchlist);

    // Event listeners for research modal's dividend calculator inputs
    // Ensure elements exist before adding listeners
    const researchCalcInputs = [researchCalcCurrentPrice, researchCalcDividendAmount, researchFrankingCredits, researchInvestmentValueSelect];
    researchCalcInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', calculateResearchDividendYields);
        }
    });


    // Context Menu Event Listeners
    if (contextEditShareBtn) contextEditShareBtn.addEventListener('click', () => {
        if (activeShareForContext) {
            hideContextMenu();
            openShareFormModal(activeShareForContext);
        }
    });
    if (contextDeleteShareBtn) contextDeleteShareBtn.addEventListener('click', () => {
        if (activeShareForContext) {
            hideContextMenu();
            deleteShare(activeShareForContext.id);
        }
    });
    // Hide context menu if clicked anywhere else on the document
    document.addEventListener('click', (event) => {
        if (shareContextMenu && shareContextMenu.style.display === 'block' && !shareContextMenu.contains(event.target)) {
            hideContextMenu();
        }
    });
    // Prevent default context menu on document right-click
    document.addEventListener('contextmenu', (event) => {
        // Only prevent if it's not on an input or textarea
        if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
            // event.preventDefault(); // Re-enable if we want to completely override browser context menu
        }
    });


    // Scroll to Top Button
    const scrollToTopBtn = document.getElementById("scrollToTopBtn");
    if (scrollToTopBtn) {
        window.onscroll = function() {
            if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
                scrollToTopBtn.style.display = "flex"; // Use flex to center icon
            } else {
                scrollToTopBtn.style.display = "none";
            }
        };
        scrollToTopBtn.addEventListener("click", function() {
            document.body.scrollTop = 0; // For Safari
            document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
        });
    }

    // Ensure initial state of main buttons is disabled until auth
    updateMainButtonsState(false);
}

// --- DOMContentLoaded and Firebase Availability Check ---
document.addEventListener('DOMContentLoaded', async function() {
    console.log("script.js (v165) DOMContentLoaded fired."); // Updated version number

    // Assign global Firebase instances to local variables
    // These are expected to be set by index.html's module script
    db = window.firestoreDb;
    auth = window.firebaseAuth;
    currentAppId = window.getFirebaseAppId();

    // Function to wait for Firebase globals and then proceed
    const waitForFirebaseGlobalsAndInit = (attempts = 0) => {
        const maxAttempts = 50; // Max attempts, roughly 50 * 16ms = 800ms
        if (window.firebaseGlobalsReady && window.firestoreFunctions && window.authFunctions) {
            console.log("[script.js Init] window.firebaseGlobalsReady is TRUE. Proceeding with Firebase setup.");
            
            // Set up the Auth State Observer
            if (auth && window.authFunctions.onAuthStateChanged) {
                window.authFunctions.onAuthStateChanged(auth, handleAuthStateChanged);
            } else {
                console.error("Firebase Auth not available. Cannot set up auth state listener.");
                handleAuthStateChanged(null); // Treat as logged out
            }

            // Attempt initial sign-in if not already authenticated (e.g., first load)
            // This will trigger the onAuthStateChanged listener.
            // We only attempt this if there's no current user, to avoid redundant sign-ins.
            if (!auth.currentUser) { 
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    window.authFunctions.signInWithCustomToken(auth, __initial_auth_token)
                        .then(() => console.log("[Auth] Signed in with custom token."))
                        .catch(error => {
                            console.error("[Auth] Error signing in with custom token:", error);
                            window.authFunctions.signInAnonymously(auth)
                                .then(() => console.log("[Auth] Signed in anonymously as fallback."))
                                .catch(anonError => {
                                    console.error("[Auth] Error signing in anonymously:", anonError);
                                    showCustomDialog("Authentication failed. Please refresh the page.");
                                });
                        });
                } else {
                    window.authFunctions.signInAnonymously(auth)
                        .then(() => console.log("[Auth] Signed in anonymously (no custom token provided)."))
                        .catch(anonError => {
                            console.error("[Auth] Error signing in anonymously:", anonError);
                            showCustomDialog("Authentication failed. Please refresh the page.");
                        });
                }
            }
            
            // Initialize other app logic (event listeners for buttons, etc.)
            if (!window._appLogicInitialized) {
                initializeAppLogic();
                window._appLogicInitialized = true;
            }
            
            if (googleAuthBtn) {
                googleAuthBtn.disabled = false;
                console.log("[Auth] Google Auth button enabled on DOMContentLoaded.");
            }

        } else if (attempts < maxAttempts) {
            // If not ready, try again on the next animation frame
            requestAnimationFrame(() => waitForFirebaseGlobalsAndInit(attempts + 1));
        } else {
            console.error("[script.js Init] Max attempts reached. Firebase globals not available. Application will not function.");
            const errorDiv = document.getElementById('firebaseInitError');
            if (errorDiv) {
                errorDiv.style.display = 'block';
            }
            updateMainButtonsState(false);
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            applyTheme('system-default');
            showCustomDialog("Application failed to initialize Firebase. Please ensure your Firebase configuration is correct and try refreshing.");
        }
    };

    // Start waiting for Firebase globals
    waitForFirebaseGlobalsAndInit();
});

})(); // End of IIFE
