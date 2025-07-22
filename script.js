//  This script interacts with Firebase Firestore for data storage.
// Firebase app, db, auth instances, and userId are made globally available
// via window.firestoreDb, window.firebaseAuth, window.getFirebaseAppId(), etc.,
// from the <script type="module"> block in index.html.

// --- GLOBAL VARIABLES ---
const DEBUG_MODE = true; // Set to 'false' to disable most console.log messages in production

// Custom logging function to control verbosity
function logDebug(message, ...optionalParams) {
    if (DEBUG_MODE) {
        // This line MUST call the native console.log, NOT logDebug itself.
        console.log(message, ...optionalParams); 
    }
}
// --- END DEBUG LOGGING SETUP ---
const ALL_SHARES_ID = 'all_shares_option'; // Special ID for the "Show All Shares" option
const CASH_BANK_WATCHLIST_ID = 'cashBank'; // NEW: Special ID for the "Cash & Assets" option
let currentWatchlistId = ALL_SHARES_ID; // Initialize with a default value

let db;
let auth = null;
let currentUserId = null;
let currentAppId;
let selectedShareDocId = null;
let allSharesData = []; // Kept in sync by the onSnapshot listener
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
const KANGA_EMAIL = 'iamkanga@gmail.com';
let operator = null;
let previousCalculatorInput = '';
let resultDisplayed = false;
const DEFAULT_WATCHLIST_NAME = 'My Watchlist (Default)';
const DEFAULT_WATCHLIST_ID_SUFFIX = 'default';
let userWatchlists = []; // Stores all watchlists for the user
let currentSelectedWatchlistIds = []; // Stores IDs of currently selected watchlists for display
let currentSortOrder = 'entryDate-desc'; // Default sort order
let contextMenuOpen = false; // To track if the custom context menu is open
let currentContextMenuShareId = null; // Stores the ID of the share that opened the context menu
let originalShareData = null; // Stores the original share data when editing for dirty state check
let originalWatchlistData = null; // Stores original watchlist data for dirty state check in watchlist modals


// Live Price Data
// IMPORTANT: This URL is the exact string provided in your initial script.js file.
// If CORS errors persist, the solution is to redeploy your Google Apps Script with "Anyone, even anonymous" access
// and then update this constant with the NEW URL provided by Google Apps Script.
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzp7OjZL3zqvJ9wPsV9M-afm2wKeQPbIgGVv_juVpkaRllADESLwj7F4-S7YWYerau-/exec'; // Replace with your actual deployment URL
let livePrices = {}; // Stores live price data: {ASX_CODE: {live: price, prevClose: price, PE: value, High52: value, Low52: value, targetHit: boolean, lastLivePrice: value, lastPrevClose: value}} 
let livePriceFetchInterval = null; // To hold the interval ID for live price updates
const LIVE_PRICE_FETCH_INTERVAL_MS = 5 * 60 * 1000; // Fetch every 5 minutes

// Theme related variables
const CUSTOM_THEMES = [
    'bold-1', 'bold-2', 'bold-3', 'bold-4', 'bold-5', 'bold-6', 'bold-7', 'bold-8', 'bold-9', 'bold-10',
    'subtle-1', 'subtle-2', 'subtle-3', 'subtle-4', 'subtle-5', 'subtle-6', 'subtle-7', 'subtle-8', 'subtle-9', 'subtle-10',
    'Muted Blue', 'Muted Brown', 'Muted Pink', 'Muted Green', 'Muted Purple', 'Muted Orange', 'Muted Cyan', 'Muted Magenta', 'Muted Gold', 'Muted Grey'
];
let currentCustomThemeIndex = -1; // To track the current theme in the cycle
let currentActiveTheme = 'system-default'; // Tracks the currently applied theme string
let savedSortOrder = null; // GLOBAL: Stores the sort order loaded from user settings
let savedTheme = null; // GLOBAL: Stores the theme loaded from user settings

let unsubscribeShares = null; // Holds the unsubscribe function for the Firestore shares listener
let unsubscribeCashCategories = null; // NEW: Holds the unsubscribe function for Firestore cash categories listener

// NEW: Global variable to store shares that have hit their target price
let sharesAtTargetPrice = [];

// NEW: Global variable to track the current mobile view mode ('default' or 'compact')
let currentMobileViewMode = 'default'; 

// NEW: Global variable to track if the target hit icon is dismissed for the current session
let targetHitIconDismissed = false;
let showLastLivePriceOnClosedMarket = false; // New global variable for the toggle state

// NEW: Global variable to store cash categories data
let userCashCategories = [];
let selectedCashAssetDocId = null; // NEW: To track which cash asset is selected for editing/details
let originalCashAssetData = null; // NEW: To store original cash asset data for dirty state check
// NEW: Global variable to store visibility state of cash assets (temporary, not persisted)
// This will now be managed directly by the 'isHidden' property on the cash asset object itself.
let cashAssetVisibility = {}; // This object will still track the *current session's* visibility.
// NEW: Reference for the hide/show checkbox in the cash asset form modal
const hideCashAssetCheckbox = document.getElementById('hideCashAssetCheckbox');


// --- UI Element References ---
const appHeader = document.getElementById('appHeader'); // Reference to the main header
const mainContainer = document.querySelector('main.container'); // Reference to the main content container
const mainTitle = document.getElementById('mainTitle');
const addShareHeaderBtn = document.getElementById('addShareHeaderBtn'); // This will become the contextual plus icon
const newShareBtn = document.getElementById('newShareBtn');
const standardCalcBtn = document.getElementById('standardCalcBtn');
const dividendCalcBtn = document.getElementById('dividendCalcBtn');
const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
const shareFormSection = document.getElementById('shareFormSection');
const formCloseButton = document.querySelector('.form-close-button');
const formTitle = document.getElementById('formTitle');
const saveShareBtn = document.getElementById('saveShareBtn');
const deleteShareBtn = document.getElementById('deleteShareBtn');
const shareNameInput = document.getElementById('shareName');
const currentPriceInput = document.getElementById('currentPrice');

const dividendAmountInput = document.getElementById('dividendAmount');
const frankingCreditsInput = document.getElementById('frankingCredits');
const shareRatingSelect = document.getElementById('shareRating');
const commentsFormContainer = document.getElementById('dynamicCommentsArea');
const modalStarRating = document.getElementById('modalStarRating'); 
const addCommentSectionBtn = document.getElementById('addCommentSectionBtn');
const shareTableBody = document.querySelector('#shareTable tbody');
const mobileShareCardsContainer = document.getElementById('mobileShareCards');
const tableContainer = document.querySelector('.table-container');
const loadingIndicator = document.getElementById('loadingIndicator');
const shareDetailModal = document.getElementById('shareDetailModal');
const modalShareName = document.getElementById('modalShareName');
const modalEnteredPrice = document.getElementById('modalEnteredPrice');
const modalTargetPrice = document.getElementById('modalTargetPrice');
const modalDividendAmount = document.getElementById('modalDividendAmount');
const modalFrankingCredits = document.getElementById('modalFrankingCredits');
const modalEntryDate = document.getElementById('modalEntryDate');
const modalCommentsContainer = document.getElementById('modalCommentsContainer');
const modalUnfrankedYieldSpan = document.getElementById('modalUnfrankedYield');
const modalFrankedYieldSpan = document.getElementById('modalFrankedYield');
const editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn');
const deleteShareFromDetailBtn = document.getElementById('deleteShareFromDetailBtn');
const modalNewsLink = document.getElementById('modalNewsLink');
const modalMarketIndexLink = document.getElementById('modalMarketIndexLink');
const modalFoolLink = document.getElementById('modalFoolLink');
const modalCommSecLink = document.getElementById('modalCommSecLink');
const commSecLoginMessage = document.getElementById('commSecLoginMessage');
const dividendCalculatorModal = document.getElementById('dividendCalculatorModal');
const calcCloseButton = document.querySelector('.calc-close-button');
const calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
const calcDividendAmountInput = document.getElementById('calcDividendAmount');
const calcFrankingCreditsInput = document.getElementById('calcFrankingCredits');
const calcUnfrankedYieldSpan = document.getElementById('calcUnfrankedYield');
const calcFrankedYieldSpan = document.getElementById('calcFrankedYield');
const investmentValueSelect = document.getElementById('investmentValueSelect');
const calcEstimatedDividend = document.getElementById('calcEstimatedDividend');
const sortSelect = document.getElementById('sortSelect');
const customDialogModal = document.getElementById('customDialogModal');
const customDialogMessage = document.getElementById('customDialogMessage');
const calculatorModal = document.getElementById('calculatorModal');
const calculatorInput = document.getElementById('calculatorInput');
const calculatorResult = document.getElementById('calculatorResult');
const calculatorButtons = document.querySelector('.calculator-buttons');
const watchlistSelect = document.getElementById('watchlistSelect');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const colorThemeSelect = document.getElementById('colorThemeSelect');
const revertToDefaultThemeBtn = document.getElementById('revertToDefaultThemeBtn');
const scrollToTopBtn = document.getElementById('scrollToTopBtn');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const appSidebar = document.getElementById('appSidebar');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const addWatchlistBtn = document.getElementById('addWatchlistBtn');
const editWatchlistBtn = document.getElementById('editWatchlistBtn');
const addWatchlistModal = document.getElementById('addWatchlistModal');
const newWatchlistNameInput = document.getElementById('newWatchlistName');
const saveWatchlistBtn = document.getElementById('saveWatchlistBtn');
const manageWatchlistModal = document.getElementById('manageWatchlistModal');
const editWatchlistNameInput = document.getElementById('editWatchlistName');
const saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn');
const deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn');
const shareContextMenu = document.getElementById('shareContextMenu');
const contextEditShareBtn = document.getElementById('contextEditShareBtn');
const contextDeleteShareBtn = document.getElementById('contextDeleteShareBtn');
const logoutBtn = document.getElementById('logoutBtn');
const deleteAllUserDataBtn = document.getElementById('deleteAllUserDataBtn');
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn');
const refreshLivePricesBtn = document.getElementById('refreshLivePricesBtn');
const shareWatchlistSelect = document.getElementById('shareWatchlistSelect');
const modalLivePriceDisplaySection = document.querySelector('.live-price-display-section'); 
const targetHitIconBtn = document.getElementById('targetHitIconBtn'); // NEW: Reference to the icon button
const targetHitIconCount = document.getElementById('targetHitIconCount'); // NEW: Reference to the count span
const toggleCompactViewBtn = document.getElementById('toggleCompactViewBtn');
const showLastLivePriceToggle = document.getElementById('showLastLivePriceToggle');
const splashScreen = document.getElementById('splashScreen');
const searchStockBtn = document.getElementById('searchStockBtn'); // NEW: Search Stock button
const stockSearchModal = document.getElementById('stockSearchModal'); // NEW: Stock Search Modal
const stockSearchTitle = document.getElementById('stockSearchTitle'); // NEW: Title for search modal
const asxSearchInput = document.getElementById('asxSearchInput'); // NEW: Search input field
const asxSuggestions = document.getElementById('asxSuggestions'); // NEW: Autocomplete suggestions container
const searchResultDisplay = document.getElementById('searchResultDisplay'); // NEW: Display area for search results
const searchModalActionButtons = document.querySelector('#stockSearchModal .modal-action-buttons-footer'); // NEW: Action buttons container
const searchModalCloseButton = document.querySelector('.search-close-button'); // NEW: Close button for search modal
// New Target Price Alert elements
const targetValueInput = document.getElementById('targetValueInput');
const targetTypeDollarBtn = document.getElementById('targetTypeDollar');
const targetTypePercentBtn = document.getElementById('targetTypePercent');
const targetCalculationDisplay = document.getElementById('targetCalculationDisplay');
const activeAlertsModal = document.getElementById('activeAlertsModal');
const activeAlertsList = document.getElementById('activeAlertsList');
const minimizeAlertsModalBtn = document.getElementById('minimizeAlertsModalBtn');
const dismissAllAlertsBtn = document.getElementById('dismissAllAlertsBtn');
const alertsCloseButton = activeAlertsModal ? activeAlertsModal.querySelector('.alerts-close-button') : null;
const noAlertsMessage = activeAlertsModal ? activeAlertsModal.querySelector('.no-alerts-message') : null;

// NEW: Global variable for storing loaded ASX code data from CSV
let allAsxCodes = []; // { code: 'BHP', name: 'BHP Group Ltd' }
let currentSelectedSuggestionIndex = -1; // For keyboard navigation in autocomplete
let currentSearchShareData = null; // Stores data of the currently displayed stock in search modal
const splashKangarooIcon = document.getElementById('splashKangarooIcon');
const splashSignInBtn = document.getElementById('splashSignInBtn');
// Global state for alert system
let activeShareAlerts = []; // Stores details of shares currently hitting a target
let dismissedAlertsSession = new Set(); // Stores share codes of alerts dismissed for the current session
let activeAlertsModalOpen = false; // To track if the alerts modal is open

// Utility function to format currency
function formatCurrency(value) {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

const alertPanel = document.getElementById('alertPanel'); // NEW: Reference to the alert panel (not in current HTML, but kept for consistency)
const alertList = document.getElementById('alertList'); // NEW: Reference to the alert list container (not in current HTML, but kept for consistency)
const closeAlertPanelBtn = document.getElementById('closeAlertPanelBtn'); // NEW: Reference to close alert panel button (not in current HTML, but kept for consistency)
const clearAllAlertsBtn = document.getElementById('clearAllAlertsBtn'); // NEW: Reference to clear all alerts button (not in current HTML, but kept for consistency)

// NEW: Cash & Assets UI Elements (1)
const stockWatchlistSection = document.getElementById('stockWatchlistSection');
const cashAssetsSection = document.getElementById('cashAssetsSection'); // UPDATED ID
const cashCategoriesContainer = document.getElementById('cashCategoriesContainer');
const addCashCategoryBtn = document.getElementById('addCashCategoryBtn'); // This will be removed or repurposed
const saveCashBalancesBtn = document.getElementById('saveCashBalancesBtn'); // This will be removed or repurposed
const totalCashDisplay = document.getElementById('totalCashDisplay');
const addCashAssetSidebarBtn = document.getElementById('addCashAssetSidebarBtn'); // NEW: Sidebar button for cash asset

// NEW: Cash Asset Modal Elements (2.1, 2.2)
const cashAssetFormModal = document.getElementById('cashAssetFormModal');
const cashFormTitle = document.getElementById('cashFormTitle');
const cashAssetNameInput = document.getElementById('cashAssetName');
const cashAssetBalanceInput = document.getElementById('cashAssetBalance');
const saveCashAssetBtn = document.getElementById('saveCashAssetBtn');
const deleteCashAssetBtn = document.getElementById('deleteCashAssetBtn');
const cashAssetFormCloseButton = document.querySelector('.cash-form-close-button'); // NEW: Specific close button for cash asset form
const cashAssetCommentsContainer = document.getElementById('cashAssetCommentsArea'); // NEW: Comments container for cash asset form
const addCashAssetCommentBtn = document.getElementById('addCashAssetCommentBtn'); // NEW: Add comment button for cash asset form

const cashAssetDetailModal = document.getElementById('cashAssetDetailModal');
const modalCashAssetName = document.getElementById('modalCashAssetName');
const detailCashAssetName = document.getElementById('detailCashAssetName');
const detailCashAssetBalance = document.getElementById('detailCashAssetBalance');
const detailCashAssetLastUpdated = document.getElementById('detailCashAssetLastUpdated');
const editCashAssetFromDetailBtn = document.getElementById('editCashAssetFromDetailBtn');
const deleteCashAssetFromDetailBtn = document.getElementById('deleteCashAssetFromDetailBtn');
const modalCashAssetCommentsContainer = document.getElementById('modalCashAssetCommentsContainer'); // NEW: Comments container for cash asset details


let sidebarOverlay = document.querySelector('.sidebar-overlay');
if (!sidebarOverlay) {
    sidebarOverlay = document.createElement('div');
    sidebarOverlay.classList.add('sidebar-overlay');
    document.body.appendChild(sidebarOverlay);
}

const formInputs = [
    shareNameInput, currentPriceInput, targetValueInput,
    dividendAmountInput, frankingCreditsInput, shareRatingSelect,
    shareWatchlistSelect // Ensure watchlist select is included for dirty state and navigation
];

// NEW: Form inputs for Cash Asset Modal
const cashFormInputs = [
    cashAssetNameInput, cashAssetBalanceInput
];


// --- GLOBAL HELPER FUNCTIONS ---

/**
 * Dynamically adjusts the top padding of the main content area
 * to prevent it from being hidden by the fixed header.
 * Uses scrollHeight to get the full rendered height, including wrapped content.
 */
function adjustMainContentPadding() {
    // Ensure both the header and main content container elements exist.
    if (appHeader && mainContainer) {
        // Get the current rendered height of the fixed header, including any wrapped content.
        // offsetHeight is usually sufficient, but scrollHeight can be more robust if content overflows.
        // For a fixed header, offsetHeight should reflect its full rendered height.
        const headerHeight = appHeader.offsetHeight; 
        
        // Apply this height as padding to the top of the main content container.
        mainContainer.style.paddingTop = `${headerHeight}px`;
        logDebug('Layout: Adjusted main content padding-top to: ' + headerHeight + 'px (Full Header Height).');
    } else {
        console.warn('Layout: Could not adjust main content padding-top: appHeader or mainContainer not found.');
    }
}

/**
 * Helper function to apply/remove a disabled visual state to non-button elements (like spans/icons).
 * This adds/removes the 'is-disabled-icon' class, which CSS then styles.
 * @param {HTMLElement} element The element to disable/enable.
 * @param {boolean} isDisabled True to disable, false to enable.
 */
function setIconDisabled(element, isDisabled) {
    if (!element) {
        console.warn('setIconDisabled: Element is null or undefined. Cannot set disabled state.');
        return;
    }
    if (isDisabled) {
        element.classList.add('is-disabled-icon');
    } else {
        element.classList.remove('is-disabled-icon');
    }
}

// Centralized Modal Closing Function
function closeModals() {
    // Auto-save logic for share form
    if (shareFormSection && shareFormSection.style.display !== 'none') {
        logDebug('Auto-Save: Share form modal is closing. Checking for unsaved changes.');
        const currentData = getCurrentFormData();
        const isShareNameValid = currentData.shareName.trim() !== '';
        
        // The cancel button fix means clearForm() is called before closeModals()
        // For auto-save on clicking outside or other non-cancel closes:
        if (selectedShareDocId) { // Existing share
            if (originalShareData && !areShareDataEqual(originalShareData, currentData)) { // Check if originalShareData exists and if form is dirty
                logDebug('Auto-Save: Unsaved changes detected for existing share. Attempting silent save.');
                saveShareData(true); // true indicates silent save
            } else {
                logDebug('Auto-Save: No changes detected for existing share.');
            }
        } else { // New share
            // Only attempt to save if a share name was entered AND a watchlist was selected (if applicable)
            const isWatchlistSelected = shareWatchlistSelect && shareWatchlistSelect.value !== '';
            const needsWatchlistSelection = currentSelectedWatchlistIds.includes(ALL_SHARES_ID);
            
            if (isShareNameValid && (!needsWatchlistSelection || isWatchlistSelected)) { 
                logDebug('Auto-Save: New share detected with valid name and watchlist. Attempting silent save.');
                saveShareData(true); // true indicates silent save
            } else {
                logDebug('Auto-Save: New share has no name or invalid watchlist. Discarding changes.');
            }
        }
    }

    // NEW: Auto-save logic for watchlist modals
    if (addWatchlistModal && addWatchlistModal.style.display !== 'none') {
        logDebug('Auto-Save: Add Watchlist modal is closing. Checking for unsaved changes.');
        const currentWatchlistData = getCurrentWatchlistFormData(true); // true for add modal
        if (currentWatchlistData.name.trim() !== '') {
            logDebug('Auto-Save: New watchlist detected with name. Attempting silent save.');
            saveWatchlistChanges(true, currentWatchlistData.name); // true indicates silent save, pass name
        } else {
            logDebug('Auto-Save: New watchlist has no name. Discarding changes.');
        }
    }

    if (manageWatchlistModal && manageWatchlistModal.style.display !== 'none') {
        logDebug('Auto-Save: Manage Watchlist modal is closing. Checking for unsaved changes.');
        const currentWatchlistData = getCurrentWatchlistFormData(false); // false for edit modal
        if (originalWatchlistData && !areWatchlistDataEqual(originalWatchlistData, currentWatchlistData)) {
            logDebug('Auto-Save: Unsaved changes detected for existing watchlist. Attempting silent save.');
            saveWatchlistChanges(true, currentWatchlistData.name, watchlistSelect.value); // true indicates silent save, pass name and ID
        } else {
            logDebug('Auto-Save: No changes detected for existing watchlist.');
        }
    }

    // NEW: Auto-save logic for cash asset form modal (2.1)
    if (cashAssetFormModal && cashAssetFormModal.style.display !== 'none') {
        logDebug('Auto-Save: Cash Asset form modal is closing. Checking for unsaved changes.');
        const currentCashData = getCurrentCashAssetFormData();
        const isCashAssetNameValid = currentCashData.name.trim() !== '';

        if (selectedCashAssetDocId) { // Existing cash asset
            if (originalCashAssetData && !areCashAssetDataEqual(originalCashAssetData, currentCashData)) {
                logDebug('Auto-Save: Unsaved changes detected for existing cash asset. Attempting silent save.');
                saveCashAsset(true); // true indicates silent save
            } else {
                logDebug('Auto-Save: No changes detected for existing cash asset.');
            }
        } else { // New cash asset
            if (isCashAssetNameValid) {
                logDebug('Auto-Save: New cash asset detected with valid name. Attempting silent save.');
                saveCashAsset(true); // true indicates silent save
            } else {
                logDebug('Auto-Save: New cash asset has no name. Discarding changes.');
            }
        }
    }


    document.querySelectorAll('.modal').forEach(modal => {
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
        }
    });
    resetCalculator();
    deselectCurrentShare();
    // NEW: Deselect current cash asset
    deselectCurrentCashAsset();
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); autoDismissTimeout = null; }
    hideContextMenu();
    // NEW: Close the alert panel if open (alertPanel is not in current HTML, but kept for consistency)
    if (activeAlertsModal) hideModal(activeAlertsModal); // Correctly hide the active alerts modal
    logDebug('Modal: All modals closed.');
}

// Custom Dialog (Alert) Function
function showCustomAlert(message, duration = 1000) {
    const confirmBtn = document.getElementById('customDialogConfirmBtn');
    const cancelBtn = document.getElementById('customDialogCancelBtn');
    const dialogButtonsContainer = document.querySelector('#customDialogModal .custom-dialog-buttons');

    logDebug('showCustomAlert: confirmBtn found: ' + !!confirmBtn + ', cancelBtn found: ' + !!cancelBtn + ', dialogButtonsContainer found: ' + !!dialogButtonsContainer);

    if (!customDialogModal || !customDialogMessage || !confirmBtn || !cancelBtn || !dialogButtonsContainer) {
        console.error('Custom dialog elements not found. Cannot show alert.');
        console.log('ALERT (fallback): ' + message);
        return;
    }
    customDialogMessage.textContent = message;

    dialogButtonsContainer.style.display = 'none'; // Explicitly hide the container
    logDebug('showCustomAlert: dialogButtonsContainer display set to: ' + dialogButtonsContainer.style.display);

    showModal(customDialogModal);
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); }
    autoDismissTimeout = setTimeout(() => { hideModal(customDialogModal); autoDismissTimeout = null; }, duration);
    logDebug('Alert: Showing alert: "' + message + '"');
}

// Date Formatting Helper Functions (Australian Style)
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// --- UI State Management Functions ---

/**
 * Adds a single share to the desktop table view.
 * @param {object} share The share object to add.
 */
function addShareToTable(share, livePriceData) {
    if (!shareTableBody) {
        console.error('addShareToTable: shareTableBody element not found.');
        return;
    }

    const row = document.createElement('tr');
    row.dataset.docId = share.id;

    // Determine target hit status and type from the share object (updated in updateShareDisplay)
    let alertClass = '';
    if (share.alertTriggered && !dismissedAlertsSession.has(share.shareName)) {
        alertClass = `alert-${share.alertType}`;
        // Add to active alerts list if not already there
        const existingAlertIndex = activeShareAlerts.findIndex(alert => alert.id === share.id);
        if (existingAlertIndex === -1) {
            // Retrieve company name from the livePrices object (if available) or fallback
            const companyName = livePrices[share.shareName.toUpperCase()]?.CompanyName || share.companyName || 'N/A';
            activeShareAlerts.push({
                id: share.id,
                shareName: share.shareName,
                companyName: companyName, 
                alertType: share.alertType,
                calculatedTargetPrice: share.calculatedTargetPrice,
                currentLivePrice: livePrices[share.shareName.toUpperCase()] ? livePrices[share.shareName.toUpperCase()].live : null
            });
        }
    } else {
        // Remove from active alerts list if no longer triggered or has been dismissed
        activeShareAlerts = activeShareAlerts.filter(alert => alert.id !== share.id);
    }
    // Apply alert class
    if (alertClass) {
        row.classList.add(alertClass);
    }

    // Declare these variables once at the top of the function
    const isMarketOpen = isAsxMarketOpen();
    let displayLivePrice = 'N/A';
    let displayPriceChange = '';
    let priceClass = '';

    // Logic to determine display values
    // livePriceData is now passed as an argument
    if (livePriceData) {
        const currentLivePrice = livePriceData.live; // This comes from the Apps Script, might be null
        const previousClosePrice = livePriceData.prevClose; // This comes from the Apps Script, might be null
        const lastFetchedLive = share.lastFetchedPrice; // This comes from YOUR Firestore data
        const lastFetchedPrevClose = share.previousFetchedPrice; // This comes from YOUR Firestore data

        if (isMarketOpen) {
            // If market is open, always try to show current live price
            if (currentLivePrice !== null && !isNaN(currentLivePrice)) {
                displayLivePrice = '$' + currentLivePrice.toFixed(2);
                if (previousClosePrice !== null && !isNaN(previousClosePrice)) {
                    const change = currentLivePrice - previousClosePrice;
                    const percentageChange = (previousClosePrice !== 0 ? (change / previousClosePrice) * 100 : 0);
                    displayPriceChange = `${change.toFixed(2)} (${percentageChange.toFixed(2)}%)`;
                    priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                }
            } else {
                // Market is open but livePrice is null, show N/A
                displayLivePrice = 'N/A';
                displayPriceChange = '';
                priceClass = 'neutral';
            }
        } else { // Market is closed
            if (showLastLivePriceOnClosedMarket) {
                // If toggle is ON, show last fetched price from Firestore
                if (lastFetchedLive !== null && !isNaN(lastFetchedLive)) {
                    displayLivePrice = '$' + lastFetchedLive.toFixed(2);
                    if (lastFetchedPrevClose !== null && !isNaN(lastFetchedPrevClose)) {
                        const change = lastFetchedLive - lastFetchedPrevClose;
                        const percentageChange = (lastFetchedPrevClose !== 0 ? (change / lastFetchedPrevClose) * 100 : 0);
                        displayPriceChange = `${change.toFixed(2)} (${percentageChange.toFixed(2)}%)`;
                        priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                    } else {
                        displayPriceChange = '0.00 (0.00%)'; // If no prevClose, assume no change
                        priceClass = 'neutral';
                    }
                } else {
                    displayLivePrice = 'N/A';
                    displayPriceChange = '';
                    priceClass = 'neutral';
                }
            } else {
                // If toggle is OFF, show zero change for closed market
                displayLivePrice = lastFetchedLive !== null && !isNaN(lastFetchedLive) ? '$' + lastFetchedLive.toFixed(2) : 'N/A';
                displayPriceChange = '0.00 (0.00%)';
                priceClass = 'neutral';
            }
        }
    }

    row.innerHTML = `
        <td><span class="share-code-display ${priceClass}">${share.shareName || ''}</span></td>
        <td class="live-price-cell">
            <span class="live-price-value ${priceClass}">${displayLivePrice}</span>
            <span class="price-change ${priceClass}">${displayPriceChange}</span>
        </td>
        <td>${Number(share.currentPrice) !== null && !isNaN(Number(share.currentPrice)) ? '$' + Number(share.currentPrice).toFixed(2) : 'N/A'}</td>
        <td>${Number(share.targetPrice) !== null && !isNaN(Number(share.targetPrice)) ? '$' + Number(share.targetPrice).toFixed(2) : 'N/A'}</td>
    <td>
        ${
            // Determine the effective yield for display in the table
            // Prioritize franked yield if franking credits are present and yield is valid, otherwise use unfranked yield
            // Default to N/A if no valid yield can be calculated
            (() => {
                const dividendAmount = Number(share.dividendAmount) || 0;
                const frankingCredits = Number(share.frankingCredits) || 0;
                const enteredPrice = Number(share.currentPrice) || 0; // Fallback for entered price if live not available

                // Use the price that is actually displayed for yield calculation if possible
                // If displayLivePrice is 'N/A', use enteredPrice from share object
                const priceForYield = (displayLivePrice !== 'N/A' && displayLivePrice.startsWith('$'))
                                    ? parseFloat(displayLivePrice.substring(1))
                                    : (enteredPrice > 0 ? enteredPrice : 0);

                if (priceForYield === 0) return 'N/A'; // Cannot calculate yield if price is zero

                const frankedYield = calculateFrankedYield(dividendAmount, priceForYield, frankingCredits);
                const unfrankedYield = calculateUnfrankedYield(dividendAmount, priceForYield);

                if (frankingCredits > 0 && frankedYield > 0) {
                    return frankedYield.toFixed(2) + '% (F)'; // Display franked yield with (F)
                } else if (unfrankedYield > 0) {
                    return unfrankedYield.toFixed(2) + '% (U)'; // Display unfranked yield with (U)
                }
                return 'N/A'; // No valid yield
            })()
        }
    </td>
    <td class="star-rating-cell">
        ${share.starRating > 0 ? '⭐ ' + share.starRating : 'N/A'}
    </td>
`;

    row.addEventListener('click', () => {
        logDebug('Table Row Click: Share ID: ' + share.id);
        selectShare(share.id);
        showShareDetails();
    });

    // Add long press / context menu for desktop
    let touchStartTime = 0;
    row.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();
        selectedElementForTap = row; // Store the element that started the touch
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;

        longPressTimer = setTimeout(() => {
            if (Date.now() - touchStartTime >= LONG_PRESS_THRESHOLD) {
                selectShare(share.id); // Select the share first
                showContextMenu(e, share.id);
                e.preventDefault(); // Prevent default browser context menu
            }
        }, LONG_PRESS_THRESHOLD);
    }, { passive: false });

    row.addEventListener('touchmove', (e) => {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const dist = Math.sqrt(Math.pow(currentX - touchStartX, 2) + Math.pow(currentY - touchStartY, 2));
        if (dist > TOUCH_MOVE_THRESHOLD) {
            clearTimeout(longPressTimer);
            touchStartTime = 0; // Reset
        }
    });

    row.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
        if (Date.now() - touchStartTime < LONG_PRESS_THRESHOLD && selectedElementForTap === row) {
            // This is a short tap, let the click event handler fire naturally if it hasn't been prevented.
            // No explicit click() call needed here as a short tap naturally dispatches click.
        }
        touchStartTime = 0;
        selectedElementForTap = null;
    });


    // Right-click / Context menu for desktop
    row.addEventListener('contextmenu', (e) => {
        if (window.innerWidth > 768) { // Only enable on desktop
            e.preventDefault();
            selectShare(share.id);
            showContextMenu(e, share.id);
        }
    });

    shareTableBody.appendChild(row);
    logDebug('Table: Added share ' + share.shareName + ' to table.');
}

function addShareToMobileCards(share, livePriceData) {
    if (!mobileShareCardsContainer) {
        console.error('addShareToMobileCards: mobileShareCardsContainer element not found.');
        return;
    }

    const card = document.createElement('div');
    card.classList.add('mobile-card');
    card.dataset.docId = share.id;

    // Determine alert class based on share object (updated in updateShareDisplay)
    let alertClass = '';
    if (share.alertTriggered && !dismissedAlertsSession.has(share.shareName)) {
        alertClass = `alert-${share.alertType}`;
        // (No need to add to activeShareAlerts here, done in addShareToTable)
    }
    // Apply alert class
    if (alertClass) {
        card.classList.add(alertClass);
    }

    // Declare these variables once at the top of the function
    const isMarketOpen = isAsxMarketOpen();
    let displayLivePrice = 'N/A';
    let displayPriceChange = '';
    let priceClass = '';

    // Logic to determine display values
    if (livePriceData) {
        const currentLivePrice = livePriceData.live; // This comes from the Apps Script, might be null
        const previousClosePrice = livePriceData.prevClose; // This comes from the Apps Script, might be null
        const lastFetchedLive = share.lastFetchedPrice; // This comes from YOUR Firestore data
        const lastFetchedPrevClose = share.previousFetchedPrice; // This comes from YOUR Firestore data

        if (isMarketOpen) {
            // If market is open, always try to show current live price
            if (currentLivePrice !== null && !isNaN(currentLivePrice)) {
                displayLivePrice = '$' + currentLivePrice.toFixed(2);
                if (previousClosePrice !== null && !isNaN(previousClosePrice)) {
                    const change = currentLivePrice - previousClosePrice;
                    const percentageChange = (previousClosePrice !== 0 ? (change / previousClosePrice) * 100 : 0);
                    displayPriceChange = `${change.toFixed(2)} (${percentageChange.toFixed(2)}%)`;
                    priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                }
            } else {
                // Market is open but livePrice is null, show N/A
                displayLivePrice = 'N/A';
                displayPriceChange = '';
                priceClass = 'neutral';
            }
        } else { // Market is closed
            if (showLastLivePriceOnClosedMarket) {
                // If toggle is ON, show last fetched price from Firestore
                if (lastFetchedLive !== null && !isNaN(lastFetchedLive)) {
                    displayLivePrice = '$' + lastFetchedLive.toFixed(2);
                    if (lastFetchedPrevClose !== null && !isNaN(lastFetchedPrevClose)) {
                        const change = lastFetchedLive - lastFetchedPrevClose;
                        const percentageChange = (lastFetchedPrevClose !== 0 ? (change / lastFetchedPrevClose) * 100 : 0);
                        displayPriceChange = `${change.toFixed(2)} (${percentageChange.toFixed(2)}%)`;
                        priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
                    } else {
                        displayPriceChange = '0.00 (0.00%)'; // If no prevClose, assume no change
                        priceClass = 'neutral';
                    }
                } else {
                    displayLivePrice = 'N/A';
                    displayPriceChange = '';
                    priceClass = 'neutral';
                }
            } else {
                // If toggle is OFF, show zero change for closed market
                displayLivePrice = lastFetchedLive !== null && !isNaN(lastFetchedLive) ? '$' + lastFetchedLive.toFixed(2) : 'N/A';
                displayPriceChange = '0.00 (0.00%)';
                priceClass = 'neutral';
            }
        }
    }

    card.innerHTML = `
        <h3 class="${priceClass}">${share.shareName || ''}</h3>
        <div class="live-price-display-section">
            <div class="fifty-two-week-row">
                <span class="fifty-two-week-value low">Low: ${livePriceData && livePriceData.Low52 !== null && !isNaN(livePriceData.Low52) ? '$' + livePriceData.Low52.toFixed(2) : 'N/A'}</span>
                <span class="fifty-two-week-value high">High: ${livePriceData && livePriceData.High52 !== null && !isNaN(livePriceData.High52) ? '$' + livePriceData.High52.toFixed(2) : 'N/A'}</span>
            </div>
            <div class="live-price-main-row">
                <span class="live-price-large ${priceClass}">${displayLivePrice}</span>
                <span class="price-change-large ${priceClass}">${displayPriceChange}</span>
            </div>
            <div class="pe-ratio-row">
                <span class="pe-ratio-value">P/E: ${livePriceData && livePriceData.PE !== null && !isNaN(livePriceData.PE) ? livePriceData.PE.toFixed(2) : 'N/A'}</span>
            </div>
        </div>
        <p><strong>Entered Price:</strong> $${Number(share.currentPrice) !== null && !isNaN(Number(share.currentPrice)) ? Number(share.currentPrice).toFixed(2) : 'N/A'}</p>
        <p><strong>Target Price:</strong> $${Number(share.targetPrice) !== null && !isNaN(Number(share.targetPrice)) ? Number(share.targetPrice).toFixed(2) : 'N/A'}</p>
        <p>
        <strong>Dividend Yield:</strong>
        ${
            // Determine the effective yield for display in mobile cards
            // Prioritize franked yield if franking credits are present and yield is valid, otherwise use unfranked yield
            // Default to N/A if no valid yield can be calculated
            (() => {
                const dividendAmount = Number(share.dividendAmount) || 0;
                const frankingCredits = Number(share.frankingCredits) || 0;
                const enteredPrice = Number(share.currentPrice) || 0; // Fallback for entered price if live not available

                // Use the price that is actually displayed for yield calculation if possible
                // If displayLivePrice is 'N/A', use enteredPrice from share object
                const priceForYield = (displayLivePrice !== 'N/A' && displayLivePrice.startsWith('$'))
                                    ? parseFloat(displayLivePrice.substring(1))
                                    : (enteredPrice > 0 ? enteredPrice : 0);

                if (priceForYield === 0) return 'N/A'; // Cannot calculate yield if price is zero

                const frankedYield = calculateFrankedYield(dividendAmount, priceForYield, frankingCredits);
                const unfrankedYield = calculateUnfrankedYield(dividendAmount, priceForYield);

                if (frankingCredits > 0 && frankedYield > 0) {
                    return frankedYield.toFixed(2) + '% (Franked)'; // Display franked yield with (Franked)
                } else if (unfrankedYield > 0) {
                    return unfrankedYield.toFixed(2) + '% (Unfranked)'; // Display unfranked yield with (Unfranked)
                }
                return 'N/A'; // No valid yield
            })()
        }
    </p>
    <p><strong>Star Rating:</strong> ${share.starRating > 0 ? '⭐ ' + share.starRating : 'No Rating'}</p>
`;

    card.addEventListener('click', () => {
        logDebug('Mobile Card Click: Share ID: ' + share.id);
        selectShare(share.id);
        showShareDetails();
    });

    // Add long press / context menu for mobile
    let touchStartTime = 0;
    card.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();
        selectedElementForTap = card; // Store the element that started the touch
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;

        longPressTimer = setTimeout(() => {
            if (Date.now() - touchStartTime >= LONG_PRESS_THRESHOLD) {
                selectShare(share.id); // Select the share first
                showContextMenu(e, share.id);
                e.preventDefault(); // Prevent default browser context menu
            }
        }, LONG_PRESS_THRESHOLD);
    }, { passive: false });

    card.addEventListener('touchmove', (e) => {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const dist = Math.sqrt(Math.pow(currentX - touchStartX, 2) + Math.pow(currentY - touchStartY, 2));
        if (dist > TOUCH_MOVE_THRESHOLD) {
            clearTimeout(longPressTimer);
            touchStartTime = 0; // Reset
        }
    });

    card.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
        if (Date.now() - touchStartTime < LONG_PRESS_THRESHOLD && selectedElementForTap === card) {
            // This is a short tap, let the click event handler fire naturally if it hasn't been prevented.
            // No explicit click() call needed here as a short tap naturally dispatches click.
        }
        touchStartTime = 0;
        selectedElementForTap = null;
    });

    mobileShareCardsContainer.appendChild(card);
    logDebug('Mobile Cards: Added share ' + share.shareName + ' to mobile cards.');
}

function updateMainButtonsState(enable) {
    logDebug('UI State: Setting main buttons state to: ' + (enable ? 'ENABLED' : 'DISABLED'));
    if (newShareBtn) newShareBtn.disabled = !enable;
    if (standardCalcBtn) standardCalcBtn.disabled = !enable;
    if (dividendCalcBtn) dividendCalcBtn.disabled = !enable;
    if (exportWatchlistBtn) exportWatchlistBtn.disabled = !enable;
    if (addWatchlistBtn) addWatchlistBtn.disabled = !enable;
    if (editWatchlistBtn) editWatchlistBtn.disabled = !enable || userWatchlists.length === 0; 
    // addShareHeaderBtn is now contextual, its disabled state is managed by updateAddHeaderButton
    if (logoutBtn) setIconDisabled(logoutBtn, !enable); 
    if (themeToggleBtn) themeToggleBtn.disabled = !enable;
    if (colorThemeSelect) colorThemeSelect.disabled = !enable;
    if (revertToDefaultThemeBtn) revertToDefaultThemeBtn.disabled = !enable;
    // sortSelect and watchlistSelect disabled state is managed by render functions
    if (refreshLivePricesBtn) refreshLivePricesBtn.disabled = !enable;
    if (toggleCompactViewBtn) toggleCompactViewBtn.disabled = !enable; // NEW: Disable compact view toggle
    
    // NEW: Disable/enable buttons specific to cash section
    // addCashCategoryBtn and saveCashBalancesBtn are removed from HTML/functionality is moved
    if (addCashAssetSidebarBtn) addCashAssetSidebarBtn.disabled = !enable;

    logDebug('UI State: Sort Select Disabled: ' + (sortSelect ? sortSelect.disabled : 'N/A'));
    logDebug('UI State: Watchlist Select Disabled: ' + (watchlistSelect ? watchlistSelect.disabled : 'N/A'));
}

function showModal(modalElement) {
    if (modalElement) {
        modalElement.style.setProperty('display', 'flex', 'important');
        modalElement.scrollTop = 0;
        const scrollableContent = modalElement.querySelector('.modal-body-scrollable');
        if (scrollableContent) {
            scrollableContent.scrollTop = 0;
        }
        logDebug('Modal: Showing modal: ' + modalElement.id);
    }
}

function hideModal(modalElement) {
    if (modalElement) {
        modalElement.style.setProperty('display', 'none', 'important');
        logDebug('Modal: Hiding modal: ' + modalElement.id);
    }
}

function clearWatchlistUI() {
    if (!watchlistSelect) { console.error('clearWatchlistUI: watchlistSelect element not found.'); return; }
    watchlistSelect.innerHTML = '<option value="" disabled selected>Watch List</option>'; // Updated placeholder
    userWatchlists = [];
    currentSelectedWatchlistIds = [];
    logDebug('UI: Watchlist UI cleared.');
}

function clearShareListUI() {
    if (!shareTableBody) { console.error('clearShareListUI: shareTableBody element not found.'); return; }
    if (!mobileShareCardsContainer) { console.error('clearShareListUI: mobileShareCardsContainer element not found.'); return; }
    shareTableBody.innerHTML = '';
    mobileShareCardsContainer.innerHTML = '';
    logDebug('UI: Share list UI cleared.');
}

function clearShareList() {
    clearShareListUI();
    if (asxCodeButtonsContainer) asxCodeButtonsContainer.innerHTML = '';
    deselectCurrentShare();
    logDebug('UI: Full share list cleared (UI + buttons).');
}

function selectShare(shareId) {
    logDebug('Selection: Attempting to select share with ID: ' + shareId);
    deselectCurrentShare();

    const tableRow = document.querySelector('#shareTable tbody tr[data-doc-id="' + shareId + '"]');
    const mobileCard = document.querySelector('.mobile-card[data-doc-id="' + shareId + '"]');

    if (tableRow) {
        tableRow.classList.add('selected');
        logDebug('Selection: Selected table row for ID: ' + shareId);
    }
    if (mobileCard) {
        mobileCard.classList.add('selected');
        logDebug('Selection: Selected mobile card for ID: ' + shareId);
    }
    selectedShareDocId = shareId;
}

function deselectCurrentShare() {
    const currentlySelected = document.querySelectorAll('.share-list-section tr.selected, .mobile-card.selected');
    logDebug('Selection: Attempting to deselect ' + currentlySelected.length + ' elements.');
    currentlySelected.forEach(el => {
        el.classList.remove('selected');
    });
    selectedShareDocId = null;
    logDebug('Selection: Share deselected. selectedShareDocId is now null.');
}

// NEW: Select/Deselect for Cash Assets (3.1)
function selectCashAsset(assetId) {
    logDebug('Selection: Attempting to select cash asset with ID: ' + assetId);
    deselectCurrentCashAsset();

    const assetCard = document.querySelector('.cash-category-item[data-id="' + assetId + '"]');
    if (assetCard) {
        assetCard.classList.add('selected');
        logDebug('Selection: Selected cash asset card for ID: ' + assetId);
    }
    selectedCashAssetDocId = assetId;
}

function deselectCurrentCashAsset() {
    const currentlySelected = document.querySelectorAll('.cash-category-item.selected');
    logDebug('Selection: Attempting to deselect ' + currentlySelected.length + ' cash asset elements.');
    currentlySelected.forEach(el => {
        el.classList.remove('selected');
    });
    selectedCashAssetDocId = null;
    logDebug('Selection: Cash asset deselected. selectedCashAssetDocId is now null.');
}


function addCommentSection(container, title = '', text = '', isCashAssetComment = false) {
    if (!container) { console.error('addCommentSection: comments container not found.'); return; }
    const commentSectionDiv = document.createElement('div');
    commentSectionDiv.className = 'comment-section';
    commentSectionDiv.innerHTML = `
        <div class="comment-section-header">
            <input type="text" class="comment-title-input" placeholder="Comment Title" value="${title}">
            <button type="button" class="comment-delete-btn">&times;</button>
        </div>
        <textarea class="comment-text-input" placeholder="Your comments here...">${text}</textarea>
    `;
    container.appendChild(commentSectionDiv);
    
    const commentTitleInput = commentSectionDiv.querySelector('.comment-title-input');
    const commentTextInput = commentSectionDiv.querySelector('.comment-text-input');
    
    if (commentTitleInput) {
        commentTitleInput.addEventListener('input', isCashAssetComment ? checkCashAssetFormDirtyState : checkFormDirtyState);
    }
    if (commentTextInput) {
        commentTextInput.addEventListener('input', isCashAssetComment ? checkCashAssetFormDirtyState : checkFormDirtyState);
    }

    commentSectionDiv.querySelector('.comment-delete-btn').addEventListener('click', (event) => {
        logDebug('Comments: Delete comment button clicked.');
        event.target.closest('.comment-section').remove();
        isCashAssetComment ? checkCashAssetFormDirtyState() : checkFormDirtyState();
    });
    logDebug('Comments: Added new comment section.');
}

function clearForm() {
    // Clear the form fields
    if (shareNameInput) shareNameInput.value = '';
    if (currentPriceInput) currentPriceInput.value = '';
    // NEW: Clear and reset target fields
    if (targetValueInput) targetValueInput.value = '';
    if (targetTypeDollarBtn) targetTypeDollarBtn.classList.add('active'); // Default to dollar on clear
    if (targetTypePercentBtn) targetTypePercentBtn.classList.remove('active');
    if (targetCalculationDisplay) targetCalculationDisplay.textContent = ''; // Clear dynamic display
    
    if (dividendAmountInput) dividendAmountInput.value = '';
    if (frankingCreditsInput) frankingCreditsInput.value = '0'; // Default to 0, not empty
    if (shareRatingSelect) shareRatingSelect.value = '0';
    if (shareWatchlistSelect) shareWatchlistSelect.value = getDefaultWatchlistId(currentUserId); // Set default watchlist

    if (commentsFormContainer) { // This now refers to #dynamicCommentsArea
        commentsFormContainer.innerHTML = ''; // Clears ONLY the dynamically added comments
    }
    selectedShareDocId = null;
    originalShareData = null; // IMPORTANT: Reset original data to prevent auto-save of cancelled edits
    if (deleteShareBtn) {
        deleteShareBtn.classList.add('hidden');
        logDebug('clearForm: deleteShareBtn hidden.');
    }
    // Reset shareWatchlistSelect to its default placeholder
    if (shareWatchlistSelect) {
        shareWatchlistSelect.disabled = false; // Ensure it's enabled for new share entry
    }
    setIconDisabled(saveShareBtn, true); // Save button disabled on clear
    logDebug('Form: Form fields cleared and selectedShareDocId reset. saveShareBtn disabled.');
}

/**
 * Populates the 'Assign to Watchlist' dropdown in the share form modal.
 * Sets the default selection based on current view or existing share.
 * @param {string|null} currentShareWatchlistId The ID of the watchlist the share is currently in (for editing).
 * @param {boolean} isNewShare True if adding a new share, false if editing.
*/
function populateShareWatchlistSelect(currentShareWatchlistId = null, isNewShare = true) {
    logDebug('populateShareWatchlistSelect called. isNewShare: ' + isNewShare + ', currentShareWatchlistId: ' + currentShareWatchlistId);
    logDebug('Current currentSelectedWatchlistIds: ' + currentSelectedWatchlistIds.join(', '));
    logDebug('User watchlists available: ' + userWatchlists.map(wl => wl.name + ' (' + wl.id + ')').join(', '));

    if (!shareWatchlistSelect) {
        console.error('populateShareWatchlistSelect: shareWatchlistSelect element not found.');
        return;
    }

    shareWatchlistSelect.innerHTML = '<option value="" disabled selected>Select a Watchlist</option>'; // Always start with placeholder

    // Filter out the "Cash & Assets" option from the share watchlist dropdown
    const stockWatchlists = userWatchlists.filter(wl => wl.id !== CASH_BANK_WATCHLIST_ID);

    stockWatchlists.forEach(watchlist => {
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        shareWatchlistSelect.appendChild(option);
    });

    let selectedOptionId = ''; // Variable to hold the ID of the option we want to select
    let disableDropdown = false; // Variable to control if dropdown should be disabled

    if (isNewShare) {
        const defaultWatchlistForNewShare = userWatchlists.find(wl => wl.id === getDefaultWatchlistId(currentUserId));

        // Priority 1: If currently viewing a specific stock watchlist, pre-select and disable
        if (currentSelectedWatchlistIds.length === 1 && 
            currentSelectedWatchlistIds[0] !== ALL_SHARES_ID &&
            currentSelectedWatchlistIds[0] !== CASH_BANK_WATCHLIST_ID &&
            stockWatchlists.some(wl => wl.id === currentSelectedWatchlistIds[0])) { 

            selectedOptionId = currentSelectedWatchlistIds[0];
            disableDropdown = true;
            logDebug('Share Form: New share: Pre-selected and disabled to current view: ' + selectedOptionId);
        } 
        // Priority 2: If a default watchlist exists AND it's a stock watchlist, pre-select it (and keep enabled)
        else if (defaultWatchlistForNewShare && stockWatchlists.some(wl => wl.id === defaultWatchlistForNewShare.id)) { 
            selectedOptionId = defaultWatchlistForNewShare.id;
            disableDropdown = false; // Keep enabled for user to change
            logDebug('Share Form: New share: Pre-selected default watchlist: ' + selectedOptionId);
        } 
        // Priority 3: If no specific view or default, but other stock watchlists exist, select the first one
        else if (stockWatchlists.length > 0) {
            selectedOptionId = stockWatchlists[0].id;
            disableDropdown = false;
            logDebug('Share Form: New share: No specific view or default, pre-selected first available: ' + selectedOptionId);
        } 
        // Priority 4: No stock watchlists at all, leave on placeholder
        else {
            selectedOptionId = ''; // Keep placeholder selected
            disableDropdown = false;
            logDebug('Share Form: New share: User must select a watchlist (no stock watchlists available).');
        }
    } else { // Editing an existing share
        if (currentShareWatchlistId && stockWatchlists.some(wl => wl.id === currentShareWatchlistId)) {
            selectedOptionId = currentShareWatchlistId;
            logDebug('Share Form: Editing share: Pre-selected to existing share\'s watchlist: ' + selectedOptionId);
        } else if (stockWatchlists.length > 0) {
            selectedOptionId = stockWatchlists[0].id;
            console.warn('Share Form: Editing share: Original watchlist not found, defaulted to first available stock watchlist.');
        } else {
            selectedOptionId = ''; // No watchlists available
            console.warn('Share Form: Editing share: No stock watchlists available to select.');
        }
        disableDropdown = false; // Always allow changing watchlist when editing
    }

    // Apply the determined selection and disabled state
    shareWatchlistSelect.value = selectedOptionId;
    shareWatchlistSelect.disabled = disableDropdown;

    // Explicitly set the 'selected' attribute on the option for visual update reliability
    // This loop is crucial to ensure the visual selection is correctly applied.
    Array.from(shareWatchlistSelect.options).forEach(option => {
        if (option.value === selectedOptionId) {
            option.selected = true;
        } else {
            option.selected = false;
        }
    });

    // Add event listener for dirty state checking on this dropdown
    shareWatchlistSelect.addEventListener('change', checkFormDirtyState);
}

function showEditFormForSelectedShare(shareIdToEdit = null) {
    const targetShareId = shareIdToEdit || selectedShareDocId;

    if (!targetShareId) {
        showCustomAlert('Please select a share to edit.');
        return;
    }
    const shareToEdit = allSharesData.find(share => share.id === targetShareId);
    if (!shareToEdit) {
        showCustomAlert('Selected share not found.');
        return;
    }
    selectedShareDocId = targetShareId; 

    formTitle.textContent = 'Edit Share';
    shareNameInput.value = shareToEdit.shareName || '';
    // Ensure currentPrice is a number and format for display
    currentPriceInput.value = (typeof shareToEdit.currentPrice === 'number' && !isNaN(shareToEdit.currentPrice)) ? shareToEdit.currentPrice.toFixed(2) : '';
    // NEW: Populate Target Value and Type
    if (targetValueInput) {
        targetValueInput.value = (typeof shareToEdit.targetValue === 'number' && !isNaN(shareToEdit.targetValue)) ? shareToEdit.targetValue : '';
    }
    if (targetTypeDollarBtn && targetTypePercentBtn) {
        // Set the active class based on the share's targetType
        if (shareToEdit.targetType === '%') {
            targetTypePercentBtn.classList.add('active');
            targetTypeDollarBtn.classList.remove('active');
        } else { // Default to '$' if targetType is not '%' or is undefined/null
            targetTypeDollarBtn.classList.add('active');
            targetTypePercentBtn.classList.remove('active');
        }
    }
    // Manually trigger update for initial display after values are set.
    updateTargetCalculationDisplay(); 
    
    dividendAmountInput.value = Number(shareToEdit.dividendAmount) !== null && !isNaN(Number(shareToEdit.dividendAmount)) ? Number(shareToEdit.dividendAmount).toFixed(3) : '';
    frankingCreditsInput.value = Number(shareToEdit.frankingCredits) !== null && !isNaN(Number(shareToEdit.frankingCredits)) ? Number(shareToEdit.frankingCredits).toFixed(1) : '';

    // Set the star rating dropdown
    if (shareRatingSelect) {
        shareRatingSelect.value = shareToEdit.starRating !== undefined && shareToEdit.starRating !== null ? shareToEdit.starRating.toString() : '0';
    }

    // Populate and set selection for the watchlist dropdown
    populateShareWatchlistSelect(shareToEdit.watchlistId, false); // false indicates not a new share

    if (commentsFormContainer) { // This now refers to #dynamicCommentsArea
        commentsFormContainer.innerHTML = ''; // Clear existing dynamic comment sections
        if (shareToEdit.comments && Array.isArray(shareToEdit.comments) && shareToEdit.comments.length > 0) {
            shareToEdit.comments.forEach(comment => addCommentSection(commentsFormContainer, comment.title, comment.text));
        } else {
            // Add one empty comment section if no existing comments
            addCommentSection(commentsFormContainer); 
        }
    }
    if (deleteShareBtn) {
        deleteShareBtn.classList.add('hidden');
        setIconDisabled(deleteShareBtn, false);
        logDebug('showEditFormForSelectedShare: deleteShareBtn shown and enabled.');
    }

    originalShareData = getCurrentFormData();
    setIconDisabled(saveShareBtn, true); // Save button disabled initially for editing
    logDebug('showEditFormForSelectedShare: saveShareBtn initially disabled for dirty check.');

    showModal(shareFormSection);
    shareNameInput.focus();
    logDebug('Form: Opened edit form for share: ' + shareToEdit.shareName + ' (ID: ' + selectedShareDocId + ')');
}

/**
 * Gathers all current data from the share form inputs.
 * @returns {object} An object representing the current state of the form.
 */
function getCurrentFormData() {
    const comments = [];
    if (commentsFormContainer) { // This now refers to #dynamicCommentsArea
        commentsFormContainer.querySelectorAll('.comment-section').forEach(section => {
            const titleInput = section.querySelector('.comment-title-input');
            const textInput = section.querySelector('.comment-text-input');
            const title = titleInput ? titleInput.value.trim() : '';
            const text = textInput ? textInput.value.trim() : '';
            if (title || text) {
                comments.push({ title: title, text: text });
            }
        });
    }

    return {
        shareName: shareNameInput.value.trim().toUpperCase(),
        currentPrice: parseFloat(currentPriceInput.value),
        // NEW: Capture targetValue and targetType
        targetValue: parseFloat(targetValueInput.value) || null, // Capture value
        targetType: targetTypePercentBtn.classList.contains('active') ? '%' : '$', // Capture type
        dividendAmount: parseFloat(dividendAmountInput.value),
        frankingCredits: parseFloat(frankingCreditsInput.value),
        // Get the selected star rating as a number
        starRating: shareRatingSelect ? parseInt(shareRatingSelect.value) : 0,
        comments: comments,
        // Include the selected watchlist ID from the new dropdown
        watchlistId: shareWatchlistSelect ? shareWatchlistSelect.value : null
    };
}

/**
 * Compares two share data objects (original vs. current form data) to check for equality.
 * Handles null/NaN for numbers and deep comparison for comments array.
 * @param {object} data1
 * @param {object} data2
 * @returns {boolean} True if data is identical, false otherwise.
 */
function areShareDataEqual(data1, data2) {
    if (!data1 || !data2) return false;

    const fields = ['shareName', 'currentPrice', 'dividendAmount', 'frankingCredits', 'watchlistId', 'starRating'];
    // NEW: Add targetValue and targetType to fields for comparison
    // const newTargetFields = ['targetValue', 'targetType']; // This variable is not used directly in the loop below

    for (const field of fields) {
        let val1 = data1[field];
        let val2 = data2[field];

        if (typeof val1 === 'number' && isNaN(val1)) val1 = null;
        if (typeof val2 === 'number' && isNaN(val2)) val2 = null;

        if (val1 !== val2) {
            return false;
        }
    }

    if (data1.comments.length !== data2.comments.length) {
        return false;
    }
    for (let i = 0; i < data1.comments.length; i++) {
        const comment1 = data1.comments[i];
        const comment2 = data2.comments[i];
        if (comment1.title !== comment2.title || comment1.text !== comment2.text) {
            return false;
        }
    }

// NEW: Compare new target fields (targetValue, targetType)
    if (data1.targetValue !== data2.targetValue || data1.targetType !== data2.targetType) {
        return false;
    }

    return true;
}

/**
 * Checks the current state of the form against the original data (if editing)
 * and the share name validity, then enables/disables the save button accordingly.
 */
function checkFormDirtyState() {
    const currentData = getCurrentFormData();
    const isShareNameValid = currentData.shareName.trim() !== '';
    const isWatchlistSelected = shareWatchlistSelect && shareWatchlistSelect.value !== '';

    let canSave = isShareNameValid;

    // Additional condition for new shares when in "All Shares" view
    if (!selectedShareDocId && currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        canSave = canSave && isWatchlistSelected;
        if (!isWatchlistSelected) {
            logDebug('Dirty State: New share from All Shares: Watchlist not selected, save disabled.');
        }
    }

    if (selectedShareDocId && originalShareData) {
        const isDirty = !areShareDataEqual(originalShareData, currentData);
        canSave = canSave && isDirty;
        if (!isDirty) {
            logDebug('Dirty State: Existing share: No changes detected, save disabled.');
        }
    } else if (!selectedShareDocId) {
        // For new shares, enable if name is valid and (if from All Shares) watchlist is selected
        // No additional 'isDirty' check needed for new shares beyond initial validity
    }

    setIconDisabled(saveShareBtn, !canSave);
    logDebug('Dirty State: Save button enabled: ' + canSave);
}

/**
 * Saves share data to Firestore. Can be called silently for auto-save.
 * @param {boolean} isSilent If true, no alert messages are shown on success.
 */
async function saveShareData(isSilent = false) {
    logDebug('Share Form: saveShareData called.');
    // Check if the save button would normally be disabled (no valid name or no changes)
    // This prevents saving blank new shares or unchanged existing shares on auto-save.
    if (saveShareBtn.classList.contains('is-disabled-icon') && isSilent) {
        logDebug('Auto-Save: Save button is disabled (no changes or no valid name). Skipping silent save.');
        return;
    }

    const shareName = shareNameInput.value.trim().toUpperCase();
    if (!shareName) { 
        if (!isSilent) showCustomAlert('Code is required!'); 
        console.warn('Save Share: Code is required. Skipping save.');
        return; 
    }

    const selectedWatchlistIdForSave = shareWatchlistSelect ? shareWatchlistSelect.value : null;
    // For new shares from 'All Shares' view, force watchlist selection
    if (!selectedShareDocId && currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        if (!selectedWatchlistIdForSave || selectedWatchlistIdForSave === '') { // Check for empty string too
            if (!isSilent) showCustomAlert('Please select a watchlist to assign the new share to.');
            console.warn('Save Share: New share from All Shares: Watchlist not selected. Skipping save.');
            return;
        }
    } else if (!selectedShareDocId && !selectedWatchlistIdForSave) { // New share not from All Shares, but no watchlist selected (shouldn't happen if default exists)
         if (!isSilent) showCustomAlert('Please select a watchlist to assign the new share to.');
         console.warn('Save Share: New share: No watchlist selected. Skipping save.');
         return;
    }


    // NEW: Get targetValue and targetType from inputs, handling potential empty string for value
    const targetValueRaw = targetValueInput.value.trim();
    const targetValue = targetValueRaw === '' ? null : parseFloat(targetValueRaw);
    const targetType = targetTypePercentBtn.classList.contains('active') ? '%' : '$';
    
    const dividendAmount = parseFloat(dividendAmountInput.value);
    const frankingCredits = parseFloat(frankingCreditsInput.value);

    const comments = [];
    if (commentsFormContainer) { // This now refers to #dynamicCommentsArea
        commentsFormContainer.querySelectorAll('.comment-section').forEach(section => {
            const titleInput = section.querySelector('.comment-title-input');
            const textInput = section.querySelector('.comment-text-input');
            const title = titleInput ? titleInput.value.trim() : '';
            const text = textInput ? textInput.value.trim() : '';
            if (title || text) {
                comments.push({ title: title, text: text });
            }
        });
    }

    const currentPriceValue = parseFloat(currentPriceInput.value); // Get value directly from input
    const shareData = {
        shareName: shareName,
        currentPrice: isNaN(currentPriceValue) ? null : currentPriceValue, // Use the parsed value
        // NEW: Store targetValue and targetType instead of targetPrice
        targetValue: isNaN(targetValue) ? null : targetValue,
        targetType: targetType,
        dividendAmount: isNaN(dividendAmount) ? null : dividendAmount,
        frankingCredits: isNaN(frankingCredits) ? null : frankingCredits,
        comments: comments,
        // Use the selected watchlist from the modal dropdown
        watchlistId: selectedWatchlistIdForSave,
        lastPriceUpdateTime: new Date().toISOString(),
        starRating: shareRatingSelect ? parseInt(shareRatingSelect.value) : 0 // Ensure rating is saved as a number
    };

    if (selectedShareDocId) {
        const existingShare = allSharesData.find(s => s.id === selectedShareDocId);
        if (shareData.currentPrice !== null && existingShare && existingShare.currentPrice !== shareData.currentPrice) {
            shareData.previousFetchedPrice = existingShare.lastFetchedPrice;
            shareData.lastFetchedPrice = shareData.currentPrice;
        } else if (!existingShare || existingShare.lastFetchedPrice === undefined) {
            shareData.previousFetchedPrice = shareData.currentPrice;
            shareData.lastFetchedPrice = shareData.currentPrice;
        } else {
            shareData.previousFetchedPrice = existingShare.previousFetchedPrice;
            shareData.lastFetchedPrice = existingShare.lastFetchedPrice;
        }

        try {
            const shareDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', selectedShareDocId);
            await window.firestore.updateDoc(shareDocRef, shareData);
            if (!isSilent) showCustomAlert('Share \'' + shareName + '\' updated successfully!', 1500);
            logDebug('Firestore: Share \'' + shareName + '\' (ID: ' + selectedShareDocId + ') updated.');
            originalShareData = getCurrentFormData(); // Update original data after successful save
            setIconDisabled(saveShareBtn, true); // Disable save button after saving
        } catch (error) {
            console.error('Firestore: Error updating share:', error);
            if (!isSilent) showCustomAlert('Error updating share: ' + error.message);
        }
    } else {
        shareData.entryDate = new Date().toISOString();
        shareData.lastFetchedPrice = shareData.currentPrice;
        shareData.previousFetchedPrice = shareData.currentPrice;

        try {
            const sharesColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
            const newDocRef = await window.firestore.addDoc(sharesColRef, shareData);
            selectedShareDocId = newDocRef.id; // Set selectedShareDocId for the newly added share
            if (!isSilent) showCustomAlert('Share \'' + shareName + '\' added successfully!', 1500);
            logDebug('Firestore: Share \'' + shareName + '\' added with ID: ' + newDocRef.id);
            originalShareData = getCurrentFormData(); // Update original data after successful save
            setIconDisabled(saveShareBtn, true); // Disable save button after saving
        } catch (error) {
            console.error('Firestore: Error adding share:', error);
            if (!isSilent) showCustomAlert('Error adding share: ' + error.message);
        }
    }
    if (!isSilent) closeModals(); // Only close if not a silent save
}


function showShareDetails() {
    if (!selectedShareDocId) {
        showCustomAlert('Please select a share to view details.');
        return;
    }
    const share = allSharesData.find(s => s.id === selectedShareDocId);
    if (!share) {
        showCustomAlert('Selected share not found.');
        return;
    }
    // Determine price change class for modalShareName
    let modalShareNamePriceChangeClass = 'neutral';
    const livePriceDataForName = livePrices[share.shareName.toUpperCase()];
    if (livePriceDataForName && livePriceDataForName.live !== null && livePriceDataForName.prevClose !== null && !isNaN(livePriceDataForName.live) && !isNaN(livePriceDataForName.prevClose)) {
        const change = livePriceDataForName.live - livePriceDataForName.prevClose;
        if (change > 0) {
            modalShareNamePriceChangeClass = 'positive';
        } else if (change < 0) {
            modalShareNamePriceChangeClass = 'negative';
        } else {
            modalShareNamePriceChangeClass = 'neutral';
        }
    }
    modalShareName.textContent = share.shareName || 'N/A';
    modalShareName.className = 'modal-share-name ' + modalShareNamePriceChangeClass; // Apply class to modalShareName

    const enteredPriceNum = Number(share.currentPrice);

    // Get live price data from the global livePrices object
    const livePriceData = livePrices[share.shareName.toUpperCase()];
    const livePrice = livePriceData ? livePriceData.live : undefined;
    const prevClosePrice = livePriceData ? livePriceData.prevClose : undefined;
    // Get PE, High52, Low52
    const peRatio = livePriceData ? livePriceData.PE : undefined;
    const high52Week = livePriceData ? livePriceData.High52 : undefined;
    const low52Week = livePriceData ? livePriceData.Low52 : undefined;


    // Display large live price and change in the dedicated section
    // The modalLivePriceDisplaySection is already referenced globally
    if (modalLivePriceDisplaySection) {
        modalLivePriceDisplaySection.classList.remove('positive-change-section', 'negative-change-section'); // Clear previous states

        // Determine price change class for modal live price section
        let priceChangeClass = 'neutral'; // Default to neutral
        if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice) && 
            prevClosePrice !== undefined && prevClosePrice !== null && !isNaN(prevClosePrice)) {
            const change = livePrice - prevClosePrice;
            if (change > 0) {
                priceChangeClass = 'positive';
            } else if (change < 0) {
                priceChangeClass = 'negative';
            } else {
                priceChangeClass = 'neutral';
            }
        }

        // Clear previous dynamic content in the section
        modalLivePriceDisplaySection.innerHTML = ''; 

        // 1. Add 52-Week Low and High at the top
        const fiftyTwoWeekRow = document.createElement('div');
        fiftyTwoWeekRow.classList.add('fifty-two-week-row'); // New class for styling

        const lowSpan = document.createElement('span');
        lowSpan.classList.add('fifty-two-week-value', 'low'); // New classes
        lowSpan.textContent = 'Low: ' + (low52Week !== undefined && low52Week !== null && !isNaN(low52Week) ? '$' + low52Week.toFixed(2) : 'N/A');
        fiftyTwoWeekRow.appendChild(lowSpan);

        const highSpan = document.createElement('span');
        highSpan.classList.add('fifty-two-week-value', 'high'); // New classes
        highSpan.textContent = 'High: ' + (high52Week !== undefined && high52Week !== null && !isNaN(high52Week) ? '$' + high52Week.toFixed(2) : 'N/A');
        fiftyTwoWeekRow.appendChild(highSpan);

        modalLivePriceDisplaySection.appendChild(fiftyTwoWeekRow);

        // 2. Add Live Price and Change (Dynamically create these elements now)
        const currentModalLivePriceLarge = document.createElement('span');
        currentModalLivePriceLarge.classList.add('live-price-large', priceChangeClass); // Apply color class
        const currentModalPriceChangeLarge = document.createElement('span');
        currentModalPriceChangeLarge.classList.add('price-change-large', priceChangeClass); // Apply color class

        const livePriceRow = document.createElement('div');
        livePriceRow.classList.add('live-price-main-row'); // New class for styling
        livePriceRow.appendChild(currentModalLivePriceLarge);
        livePriceRow.appendChild(currentModalPriceChangeLarge);
        modalLivePriceDisplaySection.appendChild(livePriceRow);

        if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) {
            currentModalLivePriceLarge.textContent = '$' + livePrice.toFixed(2);
            currentModalLivePriceLarge.style.display = 'inline';
        } else {
            currentModalLivePriceLarge.textContent = 'N/A';
            currentModalLivePriceLarge.style.display = 'inline';
        }

        if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice) && 
            prevClosePrice !== undefined && prevClosePrice !== null && !isNaN(prevClosePrice)) {
            const change = livePrice - prevClosePrice;
            const percentageChange = (prevClosePrice !== 0 && !isNaN(prevClosePrice)) ? (change / prevClosePrice) * 100 : 0; // Handle division by zero

            currentModalPriceChangeLarge.textContent = ''; // Clear previous content
            const priceChangeSpan = document.createElement('span');
            priceChangeSpan.classList.add('price-change'); // Keep base class for coloring, color already applied to parent
            if (change > 0) {
                priceChangeSpan.textContent = '(+$' + change.toFixed(2) + ' / +' + percentageChange.toFixed(2) + '%)';
            } else if (change < 0) {
                priceChangeSpan.textContent = '(-$' + Math.abs(change).toFixed(2) + ' / ' + percentageChange.toFixed(2) + '%)'; // percentageChange is already negative
            } else {
                priceChangeSpan.textContent = '($0.00 / 0.00%)';
            }
            currentModalPriceChangeLarge.appendChild(priceChangeSpan);
            currentModalPriceChangeLarge.style.display = 'inline';
        } else {
            currentModalPriceChangeLarge.textContent = '';
            currentModalPriceChangeLarge.style.display = 'none';
        }

        // 3. Add P/E Ratio below live price
        const peRow = document.createElement('div');
        peRow.classList.add('pe-ratio-row'); // New class for styling
        const peSpan = document.createElement('span');
        peSpan.classList.add('pe-ratio-value'); // New class
        peSpan.textContent = 'P/E: ' + (peRatio !== undefined && peRatio !== null && !isNaN(peRatio) ? peRatio.toFixed(2) : 'N/A');
        peRow.appendChild(peSpan);
        modalLivePriceDisplaySection.appendChild(peRow);
    }

    modalEnteredPrice.textContent = (enteredPriceNum !== null && !isNaN(enteredPriceNum)) ? '$' + enteredPriceNum.toFixed(2) : 'N/A';
    // Display the calculated target price, which is now stored on the share object
    let targetPriceDisplay = 'N/A';
    if (share.calculatedTargetPrice !== null && !isNaN(share.calculatedTargetPrice)) {
        let explanation = '';
        const enteredPrice = Number(share.currentPrice); // Ensure enteredPrice is a number

        if (share.targetType === '%') {
            const sign = share.targetValue >= 0 ? '+' : '';
            const absTargetValue = Math.abs(share.targetValue);
            explanation = ` (Entered ${formatCurrency(enteredPrice)} ${sign}${absTargetValue}% = ${formatCurrency(share.calculatedTargetPrice)})`;
        } else { // Dollar amount
            explanation = ` (Set at ${formatCurrency(share.calculatedTargetPrice)})`;
        }
        targetPriceDisplay = formatCurrency(share.calculatedTargetPrice) + explanation;
    }
    modalTargetPrice.textContent = targetPriceDisplay;

    // Ensure dividendAmount and frankingCredits are numbers before formatting
    const displayDividendAmount = Number(share.dividendAmount);
    const displayFrankingCredits = Number(share.frankingCredits);

    modalDividendAmount.textContent = (displayDividendAmount !== null && !isNaN(displayDividendAmount)) ? '$' + displayDividendAmount.toFixed(3) : 'N/A';
    modalFrankingCredits.textContent = (displayFrankingCredits !== null && !isNaN(displayFrankingCredits)) ? displayFrankingCredits.toFixed(1) + '%' : 'N/A';

    const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;
    const unfrankedYield = calculateUnfrankedYield(displayDividendAmount, priceForYield); 
    modalUnfrankedYieldSpan.textContent = unfrankedYield !== null && !isNaN(unfrankedYield) ? unfrankedYield.toFixed(2) + '%' : '0.00%';

    const frankedYield = calculateFrankedYield(displayDividendAmount, priceForYield, displayFrankingCredits);
    modalFrankedYieldSpan.textContent = frankedYield !== null && !isNaN(frankedYield) ? frankedYield.toFixed(2) + '%' : '0.00%';

    // Populate Entry Date after Franked Yield
    modalEntryDate.textContent = formatDate(share.entryDate) || 'N/A';
    modalStarRating.textContent = share.starRating > 0 ? '⭐ ' + share.starRating : 'No Rating';

    if (modalCommentsContainer) {
        modalCommentsContainer.innerHTML = '';
        if (share.comments && Array.isArray(share.comments) && share.comments.length > 0) {
            share.comments.forEach(comment => {
                if (comment.title || comment.text) {
                    const commentDiv = document.createElement('div');
                    commentDiv.className = 'modal-comment-item';

                    // Conditional Title Bar
                    if (comment.title && comment.title.trim() !== '') {
                        const titleBar = document.createElement('div');
                        titleBar.classList.add('comment-title-bar'); // New class for styling
                        titleBar.textContent = comment.title;
                        commentDiv.appendChild(titleBar);
                    }

                    const commentTextP = document.createElement('p');
                    commentTextP.textContent = comment.text || '';
                    commentDiv.appendChild(commentTextP);

                    modalCommentsContainer.appendChild(commentDiv);
                }
            });
        } else {
            modalCommentsContainer.innerHTML = '<p style="text-align: center; color: var(--label-color);">No comments for this share.</p>';
        }
    }

    // External Links
    if (modalNewsLink && share.shareName) {
        const newsUrl = 'https://news.google.com/search?q=' + encodeURIComponent(share.shareName) + '%20ASX&hl=en-AU&gl=AU&ceid=AU%3Aen';
        modalNewsLink.href = newsUrl;
        modalNewsLink.textContent = 'View ' + share.shareName.toUpperCase() + ' News';
        modalNewsLink.style.display = 'inline-flex';
        setIconDisabled(modalNewsLink, false);
    } else if (modalNewsLink) {
        modalNewsLink.style.display = 'none';
        setIconDisabled(modalNewsLink, true);
    }

    if (modalMarketIndexLink && share.shareName) {
        const marketIndexUrl = 'https://www.marketindex.com.au/asx/' + share.shareName.toLowerCase();
        modalMarketIndexLink.href = marketIndexUrl;
        modalMarketIndexLink.textContent = 'View ' + share.shareName.toUpperCase() + ' on MarketIndex.com.au';
        modalMarketIndexLink.style.display = 'inline-flex';
        setIconDisabled(modalMarketIndexLink, false);
    } else if (modalMarketIndexLink) {
        modalMarketIndexLink.style.display = 'none';
        setIconDisabled(modalMarketIndexLink, true);
    }

    if (commSecLoginMessage) {
        commSecLoginMessage.style.display = 'block'; 
    }

    showModal(shareDetailModal);
    logDebug('Details: Displayed details for share: ' + share.shareName + ' (ID: ' + selectedShareDocId + ')');
}

function sortShares() {
    const sortValue = currentSortOrder;
    if (!sortValue || sortValue === '') {
        logDebug('Sort: Sort placeholder selected, no explicit sorting applied.');
        renderWatchlist(); 
        return;
    }
    const [field, order] = sortValue.split('-');
    allSharesData.sort((a, b) => {
        // Handle sorting by percentage change
        if (field === 'percentageChange') {
            const livePriceDataA = livePrices[a.shareName.toUpperCase()];
            const livePriceA = livePriceDataA ? livePriceDataA.live : undefined;
            const prevCloseA = livePriceDataA ? livePriceDataA.prevClose : undefined;

            const livePriceDataB = livePrices[b.shareName.toUpperCase()];
            const livePriceB = livePriceDataB ? livePriceDataB.live : undefined;
            const prevCloseB = livePriceDataB ? livePriceDataB.prevClose : undefined; // Corrected variable name

            let percentageChangeA = null;
            // Only calculate if both livePriceA and prevCloseA are valid numbers and prevCloseA is not zero
            if (livePriceA !== undefined && livePriceA !== null && !isNaN(livePriceA) &&
                prevCloseA !== undefined && prevCloseA !== null && !isNaN(prevCloseA) && prevCloseA !== 0) {
                percentageChangeA = ((livePriceA - prevCloseA) / prevCloseA) * 100;
            }

            let percentageChangeB = null;
            // Only calculate if both livePriceB and prevCloseB are valid numbers and prevCloseB is not zero
            if (livePriceB !== undefined && livePriceB !== null && !isNaN(livePriceB) &&
                prevCloseB !== undefined && prevCloseB !== null && !isNaN(prevCloseB) && prevCloseB !== 0) { // Corrected variable name here
                percentageChangeB = ((livePriceB - prevCloseB) / prevCloseB) * 100;
            }

            // Debugging log for percentage sort
            logDebug('Sort Debug - Percentage: Comparing ' + a.shareName + ' (Change: ' + percentageChangeA + ') vs ' + b.shareName + ' (Change: ' + percentageChangeB + ')');


            // Handle null/NaN percentage changes to push them to the bottom
            // If both are null, their relative order doesn't matter (return 0)
            if (percentageChangeA === null && percentageChangeB === null) return 0;
            // If A is null but B is a number, A goes to the bottom
            if (percentageChangeA === null) return 1; 
            // If B is null but A is a number, B goes to the bottom
            if (percentageChangeB === null) return -1; 

            // Now perform numerical comparison for non-null values
            return order === 'asc' ? percentageChangeA - percentageChangeB : percentageChangeB - percentageChangeA;
        }

        let valA = a[field];
        let valB = b[field];

        if (field === 'currentPrice' || field === 'targetPrice' || field === 'frankingCredits') {
            valA = (typeof valA === 'string' && valA.trim() !== '') ? parseFloat(valA) : valA;
            valB = (typeof valB === 'string' && valB.trim() !== '') ? parseFloat(valB) : valB;
            valA = (valA === null || valA === undefined || isNaN(valA)) ? (order === 'asc' ? Infinity : -Infinity) : valA;
            valB = (valB === null || valB === undefined || isNaN(valB)) ? (order === 'asc' ? Infinity : -Infinity) : valB;
            return order === 'asc' ? valA - valB : valB - valA;
        } else if (field === 'dividendAmount') { // Dedicated logic for dividendAmount (yield)
            // Get live price data for share A
            const livePriceDataA = livePrices[a.shareName.toUpperCase()];
            const livePriceA = livePriceDataA ? livePriceDataA.live : undefined;
            // Price for yield calculation: prefer live price, fall back to entered price
            // Default to 0 if price is invalid or zero to avoid division issues in yield functions
            const priceForYieldA = (livePriceA !== undefined && livePriceA !== null && !isNaN(livePriceA) && livePriceA > 0) ? livePriceA : (Number(a.currentPrice) > 0 ? Number(a.currentPrice) : 0);

            // Get live price data for share B
            const livePriceDataB = livePrices[b.shareName.toUpperCase()];
            const livePriceB = livePriceDataB ? livePriceDataB.live : undefined;
            // Price for yield calculation: prefer live price, fall back to entered price
            // Default to 0 if price is invalid or zero to avoid division issues in yield functions
            const priceForYieldB = (livePriceB !== undefined && livePriceB !== null && !isNaN(livePriceB) && livePriceB > 0) ? livePriceB : (Number(b.currentPrice) > 0 ? Number(b.currentPrice) : 0);

            const dividendAmountA = Number(a.dividendAmount) || 0; // Default to 0 if not a number
            const frankingCreditsA = Number(a.frankingCredits) || 0; // Default to 0 if not a number

            const dividendAmountB = Number(b.dividendAmount) || 0; // Default to 0 if not a number
            const frankingCreditsB = Number(b.frankingCredits) || 0; // Default to 0 if not a number

            // Calculate yields for share A using the determined priceForYieldA
            const frankedYieldA = calculateFrankedYield(dividendAmountA, priceForYieldA, frankingCreditsA);
            const unfrankedYieldA = calculateUnfrankedYield(dividendAmountA, priceForYieldA);

            // Calculate yields for share B using the determined priceForYieldB
            const frankedYieldB = calculateFrankedYield(dividendAmountB, priceForYieldB, frankingCreditsB);
            const unfrankedYieldB = calculateUnfrankedYield(dividendAmountB, priceForYieldB);

            // Determine the effective yield for sorting for A (prioritize franked if > 0, then unfranked)
            let effectiveYieldA = 0; // Default to 0, not null
            if (frankingCreditsA > 0 && frankedYieldA > 0) { // Only use franked if franking > 0 AND yield > 0
                effectiveYieldA = frankedYieldA;
            } else if (unfrankedYieldA > 0) { // Only use unfranked if yield > 0
                effectiveYieldA = unfrankedYieldA;
            }
            // If both are 0 or less, effectiveYieldA remains 0

            // Determine the effective yield for sorting for B (prioritize franked if > 0, then unfranked)
            let effectiveYieldB = 0; // Default to 0, not null
            if (frankingCreditsB > 0 && frankedYieldB > 0) { // Only use franked if franking > 0 AND yield > 0
                effectiveYieldB = frankedYieldB;
            } else if (unfrankedYieldB > 0) { // Only use unfranked if yield > 0
                effectiveYieldB = unfrankedYieldB;
            }
            // If both are 0 or less, effectiveYieldB remains 0

            logDebug(`Sort Debug - Dividend: Comparing ${a.shareName} (Effective Yield A: ${effectiveYieldA}) vs ${b.shareName} (Effective Yield B: ${effectiveYieldB})`);

            // Perform numerical comparison. Since effectiveYieldA/B are now always numbers (0 or positive),
            // we don't need the Infinity/1e10 logic here.
            return order === 'asc' ? effectiveYieldA - effectiveYieldB : effectiveYieldB - effectiveYieldA;
        } else if (field === 'shareName') {
            const nameA = (a.shareName || '').toUpperCase().trim();
            const nameB = (b.shareName || '').toUpperCase().trim();
            if (nameA === '' && nameB === '') return 0;
            // If A is empty, it comes after B (push to bottom)
            if (nameA === '') return 1; 
            // If B is empty, it comes after A (push to bottom)
            if (nameB === '') return -1; 

            return order === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        } else if (field === 'starRating') {
            const ratingA = a.starRating !== undefined && a.starRating !== null && !isNaN(parseInt(a.starRating)) ? parseInt(a.starRating) : 0;
            const ratingB = b.starRating !== undefined && b.starRating !== null && !isNaN(parseInt(b.starRating)) ? parseInt(b.starRating) : 0;
            return order === 'asc' ? ratingA - ratingB : ratingB - ratingA;
        } else if (field === 'entryDate') {
            // UPDATED: Robust date parsing for sorting
            const dateA = new Date(valA);
            const dateB = new Date(valB);
            
            // Handle invalid dates by pushing them to the end of the list (Infinity for asc, -Infinity for desc)
            const timeA = isNaN(dateA.getTime()) ? (order === 'asc' ? Infinity : -Infinity) : dateA.getTime();
            const timeB = isNaN(dateB.getTime()) ? (order === 'asc' ? Infinity : -Infinity) : dateB.getTime();

            return order === 'asc' ? timeA - timeB : timeB - timeA;
        } else {
            if (order === 'asc') {
                if (valA < valB) return -1;
                if (valA > valB) return 1;
                return 0;
            } else {
                if (valA > valB) return -1;
                if (valA < valB) return 1;
                return 0;
            }
        }
    });
    logDebug('Sort: Shares sorted. Rendering watchlist.');
    renderWatchlist(); 
}

/**
 * Sorts the cash categories based on the currentSortOrder.
 * @returns {Array} The sorted array of cash categories.
 */
function sortCashCategories() {
    const sortValue = currentSortOrder;
    if (!sortValue || sortValue === '') {
        logDebug('Sort: Cash sort placeholder selected, no explicit sorting applied.');
        return [...userCashCategories]; // Return a copy to avoid direct mutation
    }

    const [field, order] = sortValue.split('-');

    // Ensure we're only sorting by relevant fields for cash assets
    if (field !== 'name' && field !== 'balance') {
        logDebug('Sort: Invalid sort field for cash assets: ' + field + '. Defaulting to name-asc.');
        return [...userCashCategories].sort((a, b) => a.name.localeCompare(b.name));
    }

    const sortedCategories = [...userCashCategories].sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

        if (field === 'balance') {
            valA = (typeof valA === 'number' && !isNaN(valA)) ? valA : (order === 'asc' ? Infinity : -Infinity);
            valB = (typeof valB === 'number' && !isNaN(valB)) ? valB : (order === 'asc' ? Infinity : -Infinity);
            return order === 'asc' ? valA - valB : valB - valA;
        } else if (field === 'name') {
            const nameA = (a.name || '').toUpperCase().trim();
            const nameB = (b.name || '').toUpperCase().trim();
            return order === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        }
        return 0; // Should not reach here
    });

    logDebug('Sort: Cash categories sorted by ' + field + ' ' + order + '.');
    return sortedCategories;
}

function renderWatchlistSelect() {
    if (!watchlistSelect) { console.error('renderWatchlistSelect: watchlistSelect element not found.'); return; }
    // Store the currently selected value before clearing
    const currentSelectedValue = watchlistSelect.value;
    
    // Set the initial placeholder text to "Watch List"
    watchlistSelect.innerHTML = '<option value="" disabled selected>Watch List</option>';

    const allSharesOption = document.createElement('option');
    allSharesOption.value = ALL_SHARES_ID;
    allSharesOption.textContent = 'All Shares';
    watchlistSelect.appendChild(allSharesOption);

    userWatchlists.forEach(watchlist => {
        // Skip adding "Cash & Assets" if it's already a hardcoded option in HTML
        if (watchlist.id === CASH_BANK_WATCHLIST_ID) {
            return; 
        }
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        watchlistSelect.appendChild(option);
    });

    // Add the "Cash & Assets" option explicitly if it's not already in the HTML
    // This assumes it's added in HTML, but as a fallback, we ensure it's there.
    if (!watchlistSelect.querySelector(`option[value="${CASH_BANK_WATCHLIST_ID}"]`)) {
        const cashBankOption = document.createElement('option');
        cashBankOption.value = CASH_BANK_WATCHLIST_ID;
        cashBankOption.textContent = 'Cash & Assets'; // UPDATED TEXT
        watchlistSelect.appendChild(cashBankOption);
    }

    // Re-select the previously selected value if it still exists
    if (currentSelectedValue && (Array.from(watchlistSelect.options).some(opt => opt.value === currentSelectedValue))) {
        watchlistSelect.value = currentSelectedValue;
        currentSelectedWatchlistIds = [currentSelectedValue]; // Ensure currentSelectedWatchlistIds reflects this
    } else if (currentSelectedWatchlistIds.length === 1 && 
                Array.from(watchlistSelect.options).some(opt => opt.value === currentSelectedWatchlistIds[0])) {
        watchlistSelect.value = currentSelectedWatchlistIds[0];
    } else {
        // If the previously selected value is no longer valid, default to the first available option (All Shares or first custom)
        if (watchlistSelect.querySelector('option[value="' + ALL_SHARES_ID + '"]')) {
            watchlistSelect.value = ALL_SHARES_ID;
            currentSelectedWatchlistIds = [ALL_SHARES_ID];
        } else if (userWatchlists.length > 0) {
            // Default to the first actual watchlist (which could be Cash & Assets if no others)
            currentSelectedWatchlistIds = [userWatchlists[0].id];
        } else {
            watchlistSelect.value = ''; // Fallback to placeholder if no options
            currentSelectedWatchlistIds = [];
        }
    }
    logDebug('UI Update: Watchlist select dropdown rendered. Selected value: ' + watchlistSelect.value);
    updateMainTitle(); // Update main title based on newly selected watchlist
    updateAddHeaderButton(); // Update the plus button context (and sidebar button context)
}

function renderSortSelect() {
        if (!sortSelect) { console.error('renderSortSelect: sortSelect element not found.'); return; }
        // Store the currently selected value before clearing
        const currentSelectedSortValue = sortSelect.value;

        // Set the initial placeholder text to "Sort List"
        sortSelect.innerHTML = '<option value="" disabled selected>Sort List</option>';

        const stockOptions = [
            { value: 'entryDate-desc', text: 'Date Added (Newest)' },
            { value: 'entryDate-asc', text: 'Date Added (Oldest)' },
            { value: 'shareName-asc', text: 'Code (A-Z)' },
            { value: 'shareName-desc', text: 'Code (Z-A)' },
            { value: 'dividendAmount-desc', text: 'Dividend Yield % (High-Low)' }, // Changed text
            { value: 'dividendAmount-asc', text: 'Dividend Yield % (Low-High)' },  // Changed text
            { value: 'percentageChange-desc', text: 'Percentage Change (High-Low)' },
            { value: 'percentageChange-asc', text: 'Percentage Change (Low-High)' },
            { value: 'starRating-desc', text: 'Star Rating (High-Low)' },
            { value: 'starRating-asc', text: 'Star Rating (Low-High)' }
        ];

        const cashOptions = [
            { value: 'name-asc', text: 'Asset Name (A-Z)' },
            { value: 'name-desc', text: 'Asset Name (Z-A)' },
            { value: 'balance-desc', text: 'Balance (High-Low)' },
            { value: 'balance-asc', text: 'Balance (Low-High)' }
        ];

        // Determine which set of options to display
        if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
            cashOptions.forEach(opt => {
                const optionElement = document.createElement('option');
                optionElement.value = opt.value;
                optionElement.textContent = opt.text;
                sortSelect.appendChild(optionElement);
            });
            logDebug('Sort Select: Populated with Cash Asset options.');
        } else {
            stockOptions.forEach(opt => {
                const optionElement = document.createElement('option');
                optionElement.value = opt.value;
                optionElement.textContent = opt.text;
                sortSelect.appendChild(optionElement);
            });
            logDebug('Sort Select: Populated with Stock options.');
        }

        let defaultSortValue = 'entryDate-desc'; // Default for stocks
        if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
            defaultSortValue = 'name-asc'; // Default for cash
        }

        // Try to re-select the previously selected value if it's still valid for the current view
        if (currentSelectedSortValue && Array.from(sortSelect.options).some(option => option.value === currentSelectedSortValue)) {
            sortSelect.value = currentSelectedSortValue;
            currentSortOrder = currentSelectedSortValue;
            logDebug('Sort: Applied previously selected sort order: ' + currentSortOrder);
        } else {
            // If not valid or no previous, apply the default for the current view type
            sortSelect.value = defaultSortValue;
            currentSortOrder = defaultSortValue;
            logDebug('Sort: No valid saved sort order or not applicable, defaulting to: ' + defaultSortValue);
        }

        logDebug('UI Update: Sort select rendered. Sort select disabled: ' + sortSelect.disabled);
    }

/**
 * Renders the watchlist based on the currentSelectedWatchlistIds. (1)
 */
function renderWatchlist() {
    logDebug('DEBUG: renderWatchlist called. Current selected watchlist ID: ' + currentSelectedWatchlistIds[0]);
    
    const selectedWatchlistId = currentSelectedWatchlistIds[0];

    // Hide both sections initially
    stockWatchlistSection.classList.add('app-hidden');
    cashAssetsSection.classList.add('app-hidden'); // UPDATED ID
    
    // Clear previous content
    clearShareListUI(); // Clears stock table and mobile cards
    if (cashCategoriesContainer) cashCategoriesContainer.innerHTML = ''; // Clear cash categories

    // Update sort dropdown options based on selected watchlist type
    renderSortSelect();

    if (selectedWatchlistId === CASH_BANK_WATCHLIST_ID) {
        // Show Cash & Assets section (1)
        cashAssetsSection.classList.remove('app-hidden');
        mainTitle.textContent = 'Cash & Assets';
        renderCashCategories();
        sortSelect.classList.remove('app-hidden');
        refreshLivePricesBtn.classList.add('app-hidden');
        toggleCompactViewBtn.classList.add('app-hidden');
        asxCodeButtonsContainer.classList.add('app-hidden');
        targetHitIconBtn.classList.add('app-hidden');
        exportWatchlistBtn.classList.add('app-hidden');
        stopLivePriceUpdates();
        updateAddHeaderButton();
        // Clear active alerts as we are in cash view
        activeShareAlerts = [];
        dismissedAlertsSession.clear();
        updateAlertIconStatus();
        renderActiveAlertsList();
    } else {
        // Show Stock Watchlist section
        stockWatchlistSection.classList.remove('app-hidden');
        const selectedWatchlist = userWatchlists.find(wl => wl.id === selectedWatchlistId);
        if (selectedWatchlistId === ALL_SHARES_ID) {
            mainTitle.textContent = 'All Shares';
        } else if (selectedWatchlist) {
            mainTitle.textContent = selectedWatchlist.name;
        } else {
            mainTitle.textContent = 'Share Watchlist';
        }

        // Show stock-specific UI elements
        sortSelect.classList.remove('app-hidden');
        refreshLivePricesBtn.classList.remove('app-hidden');
        toggleCompactViewBtn.classList.remove('app-hidden');
        targetHitIconBtn.classList.remove('app-hidden'); // Ensure icon becomes visible if needed
        exportWatchlistBtn.classList.remove('app-hidden');
        startLivePriceUpdates();
        updateAddHeaderButton();

        // --- Core Fix for Desktop Compact View ---
        const isMobileView = window.innerWidth <= 768; // Define what constitutes "mobile"

        if (isMobileView) {
            // On actual mobile devices, always hide table and show mobile cards
            if (tableContainer) tableContainer.style.display = 'none';
            if (mobileShareCardsContainer) mobileShareCardsContainer.style.display = 'flex';
            if (mobileShareCardsContainer && currentMobileViewMode === 'compact') {
                mobileShareCardsContainer.classList.add('compact-view');
            } else if (mobileShareCardsContainer) {
                mobileShareCardsContainer.classList.remove('compact-view');
            }
            // ASX buttons are hidden on mobile compact via CSS, but ensure JS doesn't override
            if (asxCodeButtonsContainer) asxCodeButtonsContainer.style.display = 'flex'; // Default to flex, CSS will hide if compact
        } else { // Desktop view
            if (currentMobileViewMode === 'compact') {
                // On desktop, if compact mode is active, hide table and show mobile cards
                if (tableContainer) tableContainer.style.display = 'none';
                if (mobileShareCardsContainer) {
                    mobileShareCardsContainer.style.display = 'grid'; // Use grid for desktop compact for better layout
                    mobileShareCardsContainer.classList.add('compact-view');
                }
                if (asxCodeButtonsContainer) asxCodeButtonsContainer.style.display = 'none'; // Hide ASX buttons in desktop compact
            } else {
                // On desktop, if default mode, show table and hide mobile cards
                if (tableContainer) tableContainer.style.display = 'block'; // Or 'table' if it was a table element directly
                if (mobileShareCardsContainer) {
                    mobileShareCardsContainer.style.display = 'none';
                    mobileShareCardsContainer.classList.remove('compact-view');
                }
                if (asxCodeButtonsContainer) asxCodeButtonsContainer.style.display = 'flex'; // Show ASX buttons in desktop default
            }
        }
        // --- End Core Fix ---

        let sharesToRender = [];
        if (selectedWatchlistId === ALL_SHARES_ID) {
            sharesToRender = [...allSharesData];
            logDebug('Render: Displaying all shares (from ALL_SHARES_ID in currentSelectedWatchlistIds).');
        } else if (currentSelectedWatchlistIds.length === 1) {
            sharesToRender = allSharesData.filter(share => currentSelectedWatchlistIds.includes(share.watchlistId));
            logDebug('Render: Displaying shares from watchlist: ' + selectedWatchlistId);
        } else {
            logDebug('Render: No specific stock watchlists selected or multiple selected, showing empty state.');
        }

        if (sharesToRender.length === 0) {
            const emptyWatchlistMessage = document.createElement('p');
            emptyWatchlistMessage.textContent = 'No shares found for the selected watchlists. Add a new share to get started!';
            emptyWatchlistMessage.style.textAlign = 'center';
            emptyWatchlistMessage.style.padding = '20px';
            emptyWatchlistMessage.style.color = 'var(--ghosted-text)';
            const td = document.createElement('td');
            td.colSpan = 6; // Updated colspan to 6 for the new Rating column
            td.appendChild(emptyWatchlistMessage);
            const tr = document.createElement('tr');
            tr.appendChild(td);
            // Only append to table if table is visible, otherwise to mobile cards
            if (tableContainer && tableContainer.style.display !== 'none') {
                shareTableBody.appendChild(tr);
            }
            if (mobileShareCardsContainer && mobileShareCardsContainer.style.display !== 'none') {
                mobileShareCardsContainer.appendChild(emptyWatchlistMessage.cloneNode(true));
            }
        }

        sharesToRender.forEach((share) => {
            // Only add to table if table is visible
            if (tableContainer && tableContainer.style.display !== 'none') {
                addShareToTable(share);
            }
            // Only add to mobile cards if mobile cards are visible
            if (mobileShareCardsContainer && mobileShareCardsContainer.style.display !== 'none') {
                addShareToMobileCards(share); 
            }
        });

        if (selectedShareDocId) {
            const stillExists = sharesToRender.some(share => share.id === selectedShareDocId);
            if (stillExists) {
                selectShare(selectedShareDocId);
            } else {
                deselectCurrentShare();
            }
        }
        logDebug('Render: Stock watchlist rendering complete.');
        updateAlertIconStatus(); 
        renderAsxCodeButtons();
    }
    adjustMainContentPadding();
}

function renderAsxCodeButtons() {
    if (!asxCodeButtonsContainer) { console.error('renderAsxCodeButtons: asxCodeButtonsContainer element not found.'); return; }
    asxCodeButtonsContainer.innerHTML = '';
    const uniqueAsxCodes = new Set();
    
    let sharesForButtons = [];
    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) { 
        sharesForButtons = [...allSharesData];
    } else {
        sharesForButtons = allSharesData.filter(share => currentSelectedWatchlistIds.includes(share.watchlistId));
    }

    sharesForButtons.forEach(share => {
        if (share.shareName && typeof share.shareName === 'string' && share.shareName.trim() !== '') {
                uniqueAsxCodes.add(share.shareName.trim().toUpperCase());
        }
    });

    if (uniqueAsxCodes.size === 0) {
        asxCodeButtonsContainer.style.display = 'none';
        logDebug('UI: No unique ASX codes found for current view. Hiding ASX buttons container.');
    } else {
        // Only show if not in compact view mode
        if (currentMobileViewMode !== 'compact') {
            asxCodeButtonsContainer.style.display = 'flex';
        } else {
            asxCodeButtonsContainer.style.display = 'none';
        }
    }
    const sortedAsxCodes = Array.from(uniqueAsxCodes).sort();
    sortedAsxCodes.forEach(asxCode => {
        const button = document.createElement('button');
        button.className = 'asx-code-btn';
        button.textContent = asxCode;
        button.dataset.asxCode = asxCode;

        // Determine price change class for the button
        let buttonPriceChangeClass = '';
        const livePriceData = livePrices[asxCode.toUpperCase()];
        if (livePriceData && livePriceData.live !== null && livePriceData.prevClose !== null && !isNaN(livePriceData.live) && !isNaN(livePriceData.prevClose)) {
            const change = livePriceData.live - livePriceData.prevClose;
            if (change > 0) {
                buttonPriceChangeClass = 'positive';
            } else if (change < 0) {
                buttonPriceChangeClass = 'negative';
            } else {
                buttonPriceChangeClass = 'neutral';
            }
        }
        // Only add the class if it's not empty
        if (buttonPriceChangeClass) {
            button.classList.add(buttonPriceChangeClass); // Apply the color class
        }

        asxCodeButtonsContainer.appendChild(button);
        button.addEventListener('click', (event) => {
            logDebug('ASX Button Click: Button for ' + asxCode + ' clicked.');
            const clickedCode = event.target.dataset.asxCode;
            scrollToShare(clickedCode);
        });
    });
    logDebug('UI: Rendered ' + sortedAsxCodes.length + ' code buttons.');
    // NEW: Adjust padding after rendering buttons, as their presence affects header height
    adjustMainContentPadding();
}

function scrollToShare(asxCode) {
    logDebug('UI: Attempting to scroll to/highlight share with Code: ' + asxCode);
    const targetShare = allSharesData.find(s => s.shareName && s.shareName.toUpperCase() === asxCode.toUpperCase());
    if (targetShare) {
        selectShare(targetShare.id);
        let elementToScrollTo = document.querySelector('#shareTable tbody tr[data-doc-id="' + targetShare.id + '"]');
        if (!elementToScrollTo || window.matchMedia('(max-width: 768px)').matches) {
            elementToScrollTo = document.querySelector('.mobile-card[data-doc-id="' + targetShare.id + '"]');
        }
        if (elementToScrollTo) {
            // Get the height of the fixed header only, as banner is now at bottom
            const fixedHeaderHeight = appHeader ? appHeader.offsetHeight : 0;
            const elementRect = elementToScrollTo.getBoundingClientRect();
            // Calculate scroll position, accounting for the fixed header
            const scrollY = elementRect.top + window.scrollY - fixedHeaderHeight - 10; // 10px buffer for a little space
            window.scrollTo({ top: scrollY, behavior: 'smooth' });
            logDebug('UI: Scrolled to element for share ID: ' + targetShare.id);
        } else {
            console.warn('UI: Element for share ID: ' + targetShare.id + ' not found for scrolling.');
        }
        showShareDetails(); 
    } else {
        showCustomAlert('Share \'' + asxCode + '\' not found.');
        console.warn('UI: Share \'' + asxCode + '\' not found in allSharesData.');
    }
}

const COMPANY_TAX_RATE = 0.30;
function calculateUnfrankedYield(dividendAmount, currentPrice) {
    // Ensure inputs are valid numbers and currentPrice is not zero
    if (typeof dividendAmount !== 'number' || isNaN(dividendAmount) || dividendAmount < 0) { return 0; } // Yield can't be negative, default to 0
    if (typeof currentPrice !== 'number' || isNaN(currentPrice) || currentPrice <= 0) { return 0; } // Price must be positive for yield calculation
    return (dividendAmount / currentPrice) * 100;
}

/**
 * Displays detailed stock information in the search modal,
 * and renders action buttons (Add to Watchlist / Edit Existing Share).
 * @param {string} asxCode The ASX code to display.
 */
async function displayStockDetailsInSearchModal(asxCode) {
    if (!searchResultDisplay) {
        console.error('displayStockDetailsInSearchModal: searchResultDisplay element not found.');
        return;
    }

    searchResultDisplay.innerHTML = '<div class="loader"></div><p>Fetching stock data...</p>'; // Show loading spinner
    searchModalActionButtons.innerHTML = ''; // Clear existing buttons
    currentSearchShareData = null; // Reset previous data

    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?stockCode=${asxCode}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        logDebug(`Search: Fetched details for ${asxCode}:`, data);

        if (data.length === 0 || !data[0] || !data[0].ASXCode) {
            // Check if the stock code actually exists in our allAsxCodes list.
            // This helps differentiate between "no data from script" and "invalid ASX code".
            const isValidAsxCode = allAsxCodes.some(s => s.code === asxCode.toUpperCase());
            if (!isValidAsxCode) {
                searchResultDisplay.innerHTML = `<p class="initial-message">ASX code "${asxCode}" not found in our database. Please check spelling.</p>`;
            } else {
                searchResultDisplay.innerHTML = `<p class="initial-message">No live data available for ${asxCode} from source. It might be delisted or the market is closed.</p>`;
            }
            return;
        }

        const stockData = data[0]; // Assuming the first item is the relevant one
        // Ensure CompanyName defaults to an empty string if not provided by the Apps Script
        stockData.CompanyName = stockData.CompanyName || "";

        // Check if the stock is already in the user's watchlist
        const existingShare = allSharesData.find(s => s.shareName.toUpperCase() === asxCode.toUpperCase());

        // Prepare the data to be displayed in the modal
        const currentLivePrice = parseFloat(stockData.LivePrice);
        const previousClosePrice = parseFloat(stockData.PrevClose);
        const peRatio = parseFloat(stockData.PE);
        const high52Week = parseFloat(stockData.High52);
        const low52Week = parseFloat(stockData.Low52);

        // Determine price change class
        let priceClass = '';
        let priceChangeText = 'N/A';
        let displayPrice = 'N/A';

        if (!isNaN(currentLivePrice) && currentLivePrice !== null) {
            displayPrice = `$${currentLivePrice.toFixed(2)}`;
            if (!isNaN(previousClosePrice) && previousClosePrice !== null) {
                const change = currentLivePrice - previousClosePrice;
                const percentageChange = (previousClosePrice !== 0 ? (change / previousClosePrice) * 100 : 0);
                priceChangeText = `${change.toFixed(2)} (${percentageChange.toFixed(2)}%)`;
                priceClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');
            }
        }

        // Construct the display HTML
        searchResultDisplay.innerHTML = `
            <div class="text-center mb-4">
                <h3 class="${priceClass}">${stockData.ASXCode || 'N/A'} ${stockData.CompanyName ? '- ' + stockData.CompanyName : ''}</h3>
                <span class="text-sm text-gray-500">${stockData.CompanyName ? '' : '(Company Name N/A)'}</span>
            </div>
            <div class="live-price-display-section">
                <div class="fifty-two-week-row">
                    <span class="fifty-two-week-value low">Low: ${!isNaN(low52Week) ? '$' + low52Week.toFixed(2) : 'N/A'}</span>
                    <span class="fifty-two-week-value high">High: ${!isNaN(high52Week) ? '$' + high52Week.toFixed(2) : 'N/A'}</span>
                </div>
                <div class="live-price-main-row">
                    <span class="live-price-large ${priceClass}">${displayPrice}</span>
                    <span class="price-change-large ${priceClass}">${priceChangeText}</span>
                </div>
                <div class="pe-ratio-row">
                    <span class="pe-ratio-value">P/E: ${!isNaN(peRatio) ? peRatio.toFixed(2) : 'N/A'}</span>
                </div>
            </div>
            <div class="external-links-section">
                <h3>External Links</h3>
                <div class="external-link-item">
                    <a id="searchModalNewsLink" href="#" target="_blank" class="external-link">View News <i class="fas fa-external-link-alt"></i></a>
                </div>
                <div class="external-link-item">
                    <a id="searchModalMarketIndexLink" href="#" target="_blank" class="external-link">View on MarketIndex.com.au <i class="fas fa-external-link-alt"></i></a>
                </div>
                <div class="external-link-item">
                    <a id="searchModalFoolLink" href="#" target="_blank" class="external-link">View on Fool.com.au <i class="fas fa-external-link-alt"></i></a>
                </div>
                <div class="external-link-item">
                    <a id="searchModalListcorpLink" href="#" target="_blank" class="external-link">View on Listcorp.com <i class="fas fa-external-link-alt"></i></a>
                </div>
                <div class="external-link-item">
                    <a id="searchModalCommSecLink" href="#" target="_blank" class="external-link">View on CommSec.com.au <i class="fas fa-external-link-alt"></i></a>
                </div>
                <p class="ghosted-text commsec-message">Requires single CommSec login per session</p>
            </div>
        `;

        // Populate external links
        const encodedAsxCode = encodeURIComponent(asxCode);
        const searchModalNewsLink = document.getElementById('searchModalNewsLink');
        const searchModalMarketIndexLink = document.getElementById('searchModalMarketIndexLink');
        const searchModalFoolLink = document.getElementById('searchModalFoolLink');
        const searchModalListcorpLink = document.getElementById('searchModalListcorpLink');
        const searchModalCommSecLink = document.getElementById('searchModalCommSecLink');

        if (searchModalNewsLink) searchModalNewsLink.href = `https://news.google.com/search?q=${encodedAsxCode}%20ASX&hl=en-AU&gl=AU&ceid=AU%3Aen`;
        if (searchModalMarketIndexLink) searchModalMarketIndexLink.href = `https://www.marketindex.com.au/asx/${asxCode.toLowerCase()}`;
        if (searchModalFoolLink) searchModalFoolLink.href = `https://www.fool.com.au/quote/${asxCode}/`; // Assuming Fool URL structure
        if (searchModalListcorpLink) searchModalListcorpLink.href = `https://www.listcorp.com/asx/${asxCode.toLowerCase()}`;
        if (searchModalCommSecLink) searchModalCommSecLink.href = `https://www.commsec.com.au/markets/company-details.html?code=${asxCode}`;

        // Store the fetched data for potential adding/editing
        currentSearchShareData = {
            shareName: stockData.ASXCode,
            companyName: stockData.CompanyName,
            currentPrice: currentLivePrice, // Use current live price as initial entered price
            targetPrice: null, // Default null
            dividendAmount: null, // Default null
            frankingCredits: null, // Default null
            starRating: 0, // Default 0
            comments: [], // Default empty array
            watchlistId: null // To be selected when adding
        };

        // Render action buttons
        const actionButton = document.createElement('button');
        actionButton.classList.add('button', 'primary-button'); // Apply base button styles
        
        if (existingShare) {
            actionButton.textContent = 'Add Share to ASX Tracker'; // Changed text
            actionButton.addEventListener('click', () => {
                hideModal(stockSearchModal); // Close search modal
                // If the user clicks "Add Share to ASX Tracker" for an existing share,
                // we should open the edit form for that existing share.
                showEditFormForSelectedShare(existingShare.id);
            });
        } else {
            actionButton.textContent = 'Add Share to ASX Tracker'; // Changed text to be consistent for new shares
            actionButton.addEventListener('click', () => {
                hideModal(stockSearchModal); // Close search modal
                clearForm(); // Clear share form
                formTitle.textContent = 'Add New Share'; // Set title for new share
                shareNameInput.value = currentSearchShareData.shareName; // Pre-fill code
                currentPriceInput.value = !isNaN(currentSearchShareData.currentPrice) ? currentSearchShareData.currentPrice.toFixed(2) : ''; // Pre-fill live price
                populateShareWatchlistSelect(null, true); // Populate and enable watchlist select for new share
                addCommentSection(commentsFormContainer); // Add initial empty comment section
                showModal(shareFormSection); // Show add/edit modal
                checkFormDirtyState(); // Check dirty state for the new share form
            });
        }
        searchModalActionButtons.appendChild(actionButton);
        logDebug(`Search: Displayed details and action button for ${asxCode}.`);

    } catch (error) {
        console.error('Search: Error fetching stock details:', error);
        searchResultDisplay.innerHTML = `<p class="initial-message">Error fetching data for ${asxCode}: ${error.message}.</p>`;
        searchModalActionButtons.innerHTML = '';
    }
}

/**
 * Loads ASX company codes and names from a local CSV file.
 * Assumes CSV has headers 'ASX Code' and 'Company Name'.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of stock objects.
 */
async function loadAsxCodesFromCSV() {
    try {
        const response = await fetch('./asx_codes.csv'); // Assuming the CSV is named asx_codes.csv and is in the root
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        logDebug('CSV: ASX codes CSV loaded successfully. Parsing...');

        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) {
            console.warn('CSV: ASX codes CSV is empty.');
            return [];
        }

        const headers = lines[0].split(',').map(header => header.trim());
        const asxCodeIndex = headers.indexOf('ASX Code');
        const companyNameIndex = headers.indexOf('Company Name');

        if (asxCodeIndex === -1 || companyNameIndex === -1) {
            throw new Error('CSV: Required headers "ASX Code" or "Company Name" not found in CSV.');
        }

        const parsedCodes = lines.slice(1).map(line => {
            const values = line.split(',');
            // Handle cases where lines might not have enough columns or contain extra commas within quoted fields
            // For simple CSV, splitting by comma is usually sufficient. More robust parsing might use a library.
            const code = values[asxCodeIndex] ? values[asxCodeIndex].trim().toUpperCase() : '';
            const name = values[companyNameIndex] ? values[companyNameIndex].trim() : '';
            return { code: code, name: name };
        }).filter(item => item.code !== ''); // Filter out any entries without a code

        logDebug(`CSV: Successfully parsed ${parsedCodes.length} ASX codes from CSV.`);
        return parsedCodes;

    } catch (error) {
        console.error('CSV: Error loading or parsing ASX codes CSV:', error);
        showCustomAlert('Error loading stock search data: ' + error.message, 3000);
        return [];
    }
}
/**
 * Checks if the Australian Securities Exchange (ASX) is currently open.
 * Considers standard trading hours and public holidays observed in Sydney.
 * @returns {boolean} True if the ASX is open, false otherwise.
 */
function isAsxMarketOpen() {
    const now = new Date();
    // Get current time in Sydney (Australia/Sydney)
    // Using 'en-AU' locale and 'Australia/Sydney' timezone for accurate comparison
    const options = {
        hour: 'numeric',
        minute: 'numeric',
        hour12: false, // 24-hour format
        timeZone: 'Australia/Sydney',
        weekday: 'short', // To check for weekends
        year: 'numeric', // For holidays
        month: 'numeric', // For holidays
        day: 'numeric' // For holidays
    };

    const sydneyTimeStr = new Intl.DateTimeFormat('en-AU', options).format(now);
    const [dayOfWeekStr, dateStr, timeStr] = sydneyTimeStr.split(', ');
    const [day, month, year] = dateStr.split('/').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    // Reconstruct date in Sydney time to use for holiday checks
    const sydneyDate = new Date(year, month - 1, day, hours, minutes);
    const dayOfWeek = sydneyDate.getDay(); // Sunday - Saturday : 0 - 6

    // Check for weekends (Saturday = 6, Sunday = 0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        logDebug('Market Status: Market is closed (weekend).');
        return false;
    }

    // Standard ASX trading hours: 10:00 AM to 4:00 PM (Sydney time)
    const marketOpenHours = 10;
    const marketCloseHours = 16; // 4:00 PM

    if (hours < marketOpenHours || hours >= marketCloseHours) {
        logDebug('Market Status: Market is closed (outside trading hours: ' + timeStr + ').');
        return false;
    }

    // Basic check for major Sydney public holidays (non-exhaustive)
    // This list should be updated annually for accuracy or fetched from an external API.
    // Format: 'MM/DD'
    const sydneyPublicHolidays = [
        '01/01', // New Year's Day
        '01/26', // Australia Day (observed)
        '03/28', // Good Friday (example for 2025 - changes annually)
        '03/31', // Easter Monday (example for 2025 - changes annually)
        '04/25', // Anzac Day
        '06/09', // King's Birthday (NSW)
        '08/04', // Bank Holiday (NSW - First Monday in August)
        '10/06', // Labour Day (NSW - First Monday in October)
        '12/25', // Christmas Day
        '12/26' // Boxing Day
    ];

    const todayMonthDay = `${(month < 10 ? '0' : '') + month}/${(day < 10 ? '0' : '') + day}`;
    if (sydneyPublicHolidays.includes(todayMonthDay)) {
        logDebug('Market Status: Market is closed (public holiday: ' + todayMonthDay + ').');
        return false;
    }

    logDebug('Market Status: Market is likely open (' + timeStr + ').');
    return true;
}

// NEW: Function to calculate and update target calculation display in share form
function updateTargetCalculationDisplay() {
    const targetValue = parseFloat(targetValueInput.value);
    const enteredPrice = parseFloat(document.getElementById('currentPrice').value);
    const isPercent = targetTypePercentBtn.classList.contains('active');
    
    let displayHtml = '';

    if (!isNaN(targetValue) && !isNaN(enteredPrice)) {
        let calculatedTarget = 0;
        let typeText = '';
        let targetRelation = ''; // "Buy Target" or "Sell Target"

        if (isPercent) {
            calculatedTarget = enteredPrice * (1 + targetValue / 100);
            typeText = `${targetValue >= 0 ? '+' : ''}${targetValue}%`;
            targetRelation = targetValue >= 0 ? 'Sell Target' : 'Buy Target';
        } else { // Dollar amount
            calculatedTarget = targetValue;
            typeText = ''; // No percentage display for dollar amount
            targetRelation = calculatedTarget < enteredPrice ? 'Buy Target' : 'Sell Target';
        }

        displayHtml = `Target: Entered ${formatCurrency(enteredPrice)} ${typeText} = ${formatCurrency(calculatedTarget)} (${targetRelation})`;
    } else if (!isNaN(targetValue)) {
        displayHtml = `Input Entered Price to calculate target.`;
    } else {
        displayHtml = `Enter Target Value.`;
    }
    
    if (targetCalculationDisplay) { // Safety check
        targetCalculationDisplay.textContent = displayHtml;
    }
}

// NEW: Function to refresh and update the global alert icon status
function updateAlertIconStatus() {
    // Only show alerts if not in cash & assets view
    if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
        if (targetHitIconBtn) targetHitIconBtn.style.display = 'none';
        if (targetHitIconCount) targetHitIconCount.textContent = '0';
        logDebug('Target Alert: In Cash & Assets view, hiding alert icon.');
        return;
    }

    // Filter active alerts based on dismissal for the current session
    const relevantAlerts = activeShareAlerts.filter(alert => !dismissedAlertsSession.has(alert.shareName));
    const totalAlerts = relevantAlerts.length;

    if (targetHitIconCount) targetHitIconCount.textContent = totalAlerts;

    // Remove all color classes first
    if (targetHitIconBtn) targetHitIconBtn.classList.remove('buy-alert', 'sell-alert', 'mixed-alert');

    if (totalAlerts > 0) {
        if (targetHitIconBtn) targetHitIconBtn.style.display = 'flex'; // Show the button

        const hasBuyAlerts = relevantAlerts.some(alert => alert.alertType === 'buy');
        const hasSellAlerts = relevantAlerts.some(alert => alert.alertType === 'sell');

        if (targetHitIconBtn) { // Safety check before adding classes
            if (hasBuyAlerts && hasSellAlerts) {
                targetHitIconBtn.classList.add('mixed-alert');
            } else if (hasBuyAlerts) {
                targetHitIconBtn.classList.add('buy-alert');
            } else if (hasSellAlerts) {
                targetHitIconBtn.classList.add('sell-alert');
            }
        }
        logDebug(`Target Alert: Showing icon with ${totalAlerts} alerts. Buy: ${hasBuyAlerts}, Sell: ${hasSellAlerts}.`);
    } else {
        if (targetHitIconBtn) targetHitIconBtn.style.display = 'none'; // Hide the button
        logDebug('Target Alert: No active alerts to display. Hiding icon.');
    }
}

// NEW: Function to open the active alerts modal
function openActiveAlertsModal() {
    if (!activeAlertsModal) return; // Safety check
    activeAlertsModal.style.display = 'flex'; // Use flex to position content
    // Request an animation frame to ensure display:flex is applied before transform
    requestAnimationFrame(() => {
        activeAlertsModal.classList.add('open');
    });
    activeAlertsModalOpen = true;
    renderActiveAlertsList(); // Populate the list when opening
    logDebug('Alerts Modal: Opened.');
}

// NEW: Function to close (minimize) the active alerts modal
function closeActiveAlertsModal() {
    if (!activeAlertsModal) return; // Safety check
    activeAlertsModal.classList.remove('open');
    setTimeout(() => { // Delay hiding until animation completes
        activeAlertsModal.style.display = 'none';
    }, 300); // Match CSS transition duration
    activeAlertsModalOpen = false;
    logDebug('Alerts Modal: Closed (minimized).');
}

// NEW: Function to render alerts in the modal list
function renderActiveAlertsList() {
    if (!activeAlertsList || !noAlertsMessage) return; // Safety check

    activeAlertsList.innerHTML = ''; // Clear existing list
    const relevantAlerts = activeShareAlerts.filter(alert => !dismissedAlertsSession.has(alert.shareName));

    if (relevantAlerts.length === 0) {
        noAlertsMessage.style.display = 'block';
        return;
    } else {
        noAlertsMessage.style.display = 'none';
    }

    // Sort alphabetically by share name
    relevantAlerts.sort((a, b) => a.shareName.localeCompare(b.shareName));

    relevantAlerts.forEach(alert => {
        const alertItem = document.createElement('div');
        alertItem.className = 'alert-item';

        const alertTypeText = alert.alertType === 'buy' ? 'Buy Target' : 'Sell Target';
        let alertDetails = '';
        if (alert.calculatedTargetPrice !== null && alert.calculatedTargetPrice !== undefined && !isNaN(alert.calculatedTargetPrice) && 
            alert.currentLivePrice !== null && alert.currentLivePrice !== undefined && !isNaN(alert.currentLivePrice)) {
            alertDetails = `Target ${alert.alertType === 'buy' ? 'below' : 'above'} ${formatCurrency(alert.calculatedTargetPrice)} (Current: ${formatCurrency(alert.currentLivePrice)})`;
        } else {
            alertDetails = `Target hit for ${alert.alertType} alert.`;
        }

        alertItem.innerHTML = `
            <div class="alert-item-header">${alert.shareName} (${alert.companyName})</div>
            <div class="alert-item-body">${alertTypeText}: ${alertDetails}</div>
        `;
        activeAlertsList.appendChild(alertItem);
    });
    logDebug(`Alerts Modal: Rendered ${relevantAlerts.length} active alerts.`);
}

// NEW: Function to dismiss all active alerts for the session
function dismissAllActiveAlerts() {
    const alertsToDismiss = activeShareAlerts.filter(alert => !dismissedAlertsSession.has(alert.shareName));
    alertsToDismiss.forEach(alert => dismissedAlertsSession.add(alert.shareName));
    
    // Update UI immediately
    renderActiveAlertsList();
    updateAlertIconStatus();
    // Re-render shares to remove highlighting
    renderWatchlist(); // Call renderWatchlist which will refresh all share displays with new alert states
    
    // Show a confirmation message
    showCustomAlert('All active alerts dismissed for this session.', () => {
        // Callback after dismissal confirmation (if needed)
    }, null, 'OK', 'Information'); // Use OK button, not Yes/No
    logDebug('Alerts: All active alerts dismissed for current session.');
}

function calculateFrankedYield(dividendAmount, currentPrice, frankingCreditsPercentage) {
    // Ensure inputs are valid numbers and currentPrice is not zero
    if (typeof dividendAmount !== 'number' || isNaN(dividendAmount) || dividendAmount < 0) { return 0; }
    if (typeof currentPrice !== 'number' || isNaN(currentPrice) || currentPrice <= 0) { return 0; }
    if (typeof frankingCreditsPercentage !== 'number' || isNaN(frankingCreditsPercentage) || frankingCreditsPercentage < 0 || frankingCreditsPercentage > 100) { return 0; }

    const unfrankedYield = calculateUnfrankedYield(dividendAmount, currentPrice);
    if (unfrankedYield === 0) return 0; // If unfranked is 0, franked is also 0

    const frankingRatio = frankingCreditsPercentage / 100;
    const frankingCreditPerShare = dividendAmount * (COMPANY_TAX_RATE / (1 - COMPANY_TAX_RATE)) * frankingRatio;
    const grossedUpDividend = dividendAmount + frankingCreditPerShare;

    return (grossedUpDividend / currentPrice) * 100;
}

function estimateDividendIncome(investmentValue, dividendAmountPerShare, currentPricePerShare) {
    if (typeof investmentValue !== 'number' || isNaN(investmentValue) || investmentValue <= 0) { return null; }
    if (typeof dividendAmountPerShare !== 'number' || isNaN(dividendAmountPerShare) || dividendAmountPerShare <= 0) { return null; }
    if (typeof currentPricePerShare !== 'number' || isNaN(currentPricePerShare) || currentPricePerShare <= 0) { return null; }
    const numberOfShares = investmentValue / currentPricePerShare;
    return numberOfShares * dividendAmountPerShare;
}

function updateCalculatorDisplay() {
    calculatorInput.textContent = previousCalculatorInput + (operator ? ' ' + getOperatorSymbol(operator) + ' ' : '') + currentCalculatorInput;
    if (resultDisplayed) { /* nothing */ }
    else { calculatorResult.textContent = currentCalculatorInput === '' ? '0' : currentCalculatorInput; }
}

function calculateResult() {
    let prev = parseFloat(previousCalculatorInput);
    let current = parseFloat(currentCalculatorInput);
    if (isNaN(prev) || isNaN(current)) return;
    let res;
    switch (operator) {
        case 'add': res = prev + current; break;
        case 'subtract': res = prev - current; break;
        case 'multiply': res = prev * current; break;
        case 'divide':
            if (current === 0) { showCustomAlert('Cannot divide by zero!'); res = 'Error'; }
            else { res = prev / current; }
            break;
        default: return;
    }
    if (typeof res === 'number' && !isNaN(res)) { res = parseFloat(res.toFixed(10)); }
    calculatorResult.textContent = res;
    previousCalculatorInput = res.toString();
    currentCalculatorInput = '';
}

function getOperatorSymbol(op) {
    switch (op) {
        case 'add': return '+'; case 'subtract': return '-';
        case 'multiply': return '×'; case 'divide': return '÷';
        default: return '';
    }
}

function resetCalculator() {
    currentCalculatorInput = ''; operator = null; previousCalculatorInput = '';
    resultDisplayed = false; calculatorInput.textContent = ''; calculatorResult.textContent = '0';
    logDebug('Calculator: Calculator state reset.');
}

async function applyTheme(themeName) {
    const body = document.body;
    // Remove all existing theme classes
    body.className = body.className.split(' ').filter(c => !c.endsWith('-theme') && !c.startsWith('theme-')).join(' ');

    logDebug('Theme Debug: Attempting to apply theme: ' + themeName);
    currentActiveTheme = themeName;

    if (themeName === 'system-default') {
        body.removeAttribute('data-theme');
        localStorage.removeItem('selectedTheme');
        localStorage.removeItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
            body.classList.add('dark-theme');
        }
        logDebug('Theme Debug: Reverted to system default theme.');
        // When reverting to system-default, ensure currentCustomThemeIndex is reset to -1
        currentCustomThemeIndex = -1; 
    } else if (themeName === 'light' || themeName === 'dark') {
        body.removeAttribute('data-theme');
        localStorage.removeItem('selectedTheme');
        localStorage.setItem('theme', themeName);
        if (themeName === 'dark') {
            body.classList.add('dark-theme');
        }
        logDebug('Theme Debug: Applied explicit default theme: ' + themeName);
        // When applying explicit light/dark, ensure currentCustomThemeIndex is reset to -1
        currentCustomThemeIndex = -1; 
    } else {
        // For custom themes, apply the class and set data-theme attribute
        // The class name is 'theme-' followed by the themeName (e.g., 'theme-bold-1', 'theme-muted-blue')
        body.classList.add('theme-' + themeName.toLowerCase().replace(/\s/g, '-')); // Convert "Muted Blue" to "muted-blue" for class
        body.setAttribute('data-theme', themeName); // Keep the full name in data-theme
        localStorage.setItem('selectedTheme', themeName);
        localStorage.removeItem('theme');
        logDebug('Theme Debug: Applied custom theme: ' + themeName);
        // When applying a custom theme, set currentCustomThemeIndex to its position
        currentCustomThemeIndex = CUSTOM_THEMES.indexOf(themeName); 
    }
    
    logDebug('Theme Debug: Body classes after applying: ' + body.className);
    logDebug('Theme Debug: currentCustomThemeIndex after applying: ' + currentCustomThemeIndex);

    if (currentUserId && db && window.firestore) {
        const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');
        try {
            await window.firestore.setDoc(userProfileDocRef, { lastTheme: themeName }, { merge: true });
            logDebug('Theme: Saved theme preference to Firestore: ' + themeName);
        } catch (error) {
            console.error('Theme: Error saving theme preference to Firestore:', error);
        }
    }
    updateThemeToggleAndSelector();
}

function updateThemeToggleAndSelector() {
    if (colorThemeSelect) {
        // Set the dropdown value to the current active theme if it's a custom theme
        if (CUSTOM_THEMES.includes(currentActiveTheme)) {
            colorThemeSelect.value = currentActiveTheme;
        } else {
            // If not a custom theme (system-default, light, dark), set dropdown to 'none' (No Custom Theme)
            colorThemeSelect.value = 'none';
        }
        logDebug('Theme UI: Color theme select updated to: ' + colorThemeSelect.value);
    }

    // This part ensures currentCustomThemeIndex is correctly set based on the currentActiveTheme
    // regardless of whether it was set by toggle or dropdown/load.
    // This is crucial for the toggle button to know where it is in the cycle.
    if (CUSTOM_THEMES.includes(currentActiveTheme)) {
        currentCustomThemeIndex = CUSTOM_THEMES.indexOf(currentActiveTheme);
    } else {
        currentCustomThemeIndex = -1; // Not a custom theme, so reset index
    }
    logDebug('Theme UI: currentCustomThemeIndex after updateThemeToggleAndSelector: ' + currentCustomThemeIndex);
}

function getDefaultWatchlistId(userId) {
    return userId + '_' + DEFAULT_WATCHLIST_ID_SUFFIX;
}

async function saveLastSelectedWatchlistIds(watchlistIds) {
    if (!db || !currentUserId || !window.firestore) {
        console.warn('Watchlist: Cannot save last selected watchlists: DB, User ID, or Firestore functions not available.');
        return;
    }
    const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');
    try {
        await window.firestore.setDoc(userProfileDocRef, { lastSelectedWatchlistIds: watchlistIds }, { merge: true });
        logDebug('Watchlist: Saved last selected watchlist IDs: ' + watchlistIds.join(', '));
    }
    catch (error) {
        console.error('Watchlist: Error saving last selected watchlist IDs:', error);
    }
}

async function saveSortOrderPreference(sortOrder) {
    logDebug('Sort Debug: Attempting to save sort order: ' + sortOrder);
    logDebug('Sort Debug: db: ' + (db ? 'Available' : 'Not Available'));
    logDebug('Sort Debug: currentUserId: ' + currentUserId);
    logDebug('Sort Debug: window.firestore: ' + (window.firestore ? 'Available' : 'Not Available'));

    if (!db || !currentUserId || !window.firestore) {
        console.warn('Sort: Cannot save sort order preference: DB, User ID, or Firestore functions not available. Skipping save.');
        return;
    }
    const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');
    try {
            // Ensure the sortOrder is not an empty string or null before saving
            const dataToSave = sortOrder ? { lastSortOrder: sortOrder } : { lastSortOrder: window.firestore.deleteField() };
            await window.firestore.setDoc(userProfileDocRef, dataToSave, { merge: true });
            logDebug('Sort: Saved sort order preference to Firestore: ' + sortOrder);
        } catch (error) {
            console.error('Sort: Error saving sort order preference to Firestore:', error);
        }
}

async function loadUserWatchlistsAndSettings() {
    logDebug('loadUserWatchlistsAndSettings called.'); // Added log for function entry

    if (!db || !currentUserId) {
        console.warn('User Settings: Firestore DB or User ID not available for loading settings. Skipping.');
        window._appDataLoaded = false;
        hideSplashScreenIfReady();
        return;
    }
    userWatchlists = [];
    const watchlistsColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists');
    const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');

    try {
        logDebug('User Settings: Fetching user watchlists and profile settings...');
        const querySnapshot = await window.firestore.getDocs(window.firestore.query(watchlistsColRef));
        querySnapshot.forEach(doc => { userWatchlists.push({ id: doc.id, name: doc.data().name }); });
        logDebug('User Settings: Found ' + userWatchlists.length + ' existing watchlists (before default check).');

        // Ensure "Cash & Assets" is always an option in `userWatchlists` for internal logic
        if (!userWatchlists.some(wl => wl.id === CASH_BANK_WATCHLIST_ID)) {
            userWatchlists.push({ id: CASH_BANK_WATCHLIST_ID, name: 'Cash & Assets' });
            logDebug('User Settings: Added "Cash & Assets" to internal watchlists array.');
        }

        // If no user-defined watchlists (excluding Cash & Assets), create a default one
        const userDefinedStockWatchlists = userWatchlists.filter(wl => wl.id !== CASH_BANK_WATCHLIST_ID && wl.id !== ALL_SHARES_ID);
        if (userDefinedStockWatchlists.length === 0) {
            const defaultWatchlistId = getDefaultWatchlistId(currentUserId);
            const defaultWatchlistRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists/' + defaultWatchlistId);
            await window.firestore.setDoc(defaultWatchlistRef, { name: DEFAULT_WATCHLIST_NAME, createdAt: new Date().toISOString() });
            userWatchlists.push({ id: defaultWatchlistId, name: DEFAULT_WATCHLIST_NAME });
            // Ensure currentSelectedWatchlistIds points to the newly created default watchlist
            currentSelectedWatchlistIds = [defaultWatchlistId]; 
            logDebug('User Settings: Created default watchlist and set it as current selection.');
        }

        // Sort watchlists (excluding Cash & Assets for sorting, then re-add it if needed)
        userWatchlists.sort((a, b) => {
            if (a.id === CASH_BANK_WATCHLIST_ID) return 1;
            if (b.id === CASH_BANK_WATCHLIST_ID) return -1;
            return a.name.localeCompare(b.name);
        });
        logDebug('User Settings: Watchlists after sorting: ' + userWatchlists.map(wl => wl.name).join(', '));

        const userProfileSnap = await window.firestore.getDoc(userProfileDocRef);
        savedSortOrder = null;
        savedTheme = null;
        let savedShowLastLivePricePreference = null;

        if (userProfileSnap.exists()) {
            savedSortOrder = userProfileSnap.data().lastSortOrder;
            savedTheme = userProfileSnap.data().lastTheme;
            savedShowLastLivePricePreference = userProfileSnap.data().showLastLivePriceOnClosedMarket; // Load the new preference
            const loadedSelectedWatchlistIds = userProfileSnap.data().lastSelectedWatchlistIds;
            showLastLivePriceOnClosedMarket = userProfileSnap.data().showLastLivePriceOnClosedMarket || false; // Load preference
            logDebug('User Settings: Loaded showLastLivePriceOnClosedMarket: ' + showLastLivePriceOnClosedMarket);

            if (loadedSelectedWatchlistIds && Array.isArray(loadedSelectedWatchlistIds) && loadedSelectedWatchlistIds.length > 0) {
                // Filter out invalid or non-existent watchlists from loaded preferences
                currentSelectedWatchlistIds = loadedSelectedWatchlistIds.filter(id => 
                    id === ALL_SHARES_ID || id === CASH_BANK_WATCHLIST_ID || userWatchlists.some(wl => wl.id === id)
                );
                logDebug('User Settings: Loaded last selected watchlists from profile: ' + currentSelectedWatchlistIds.join(', '));
            } else {
                logDebug('User Settings: No valid last selected watchlists in profile. Will determine default.');
            }
        } else {
            logDebug('User Settings: User profile settings not found. Will determine default watchlist selection.');
        }

        // Determine final currentSelectedWatchlistIds if not set or invalid after loading/filtering
        if (!currentSelectedWatchlistIds || currentSelectedWatchlistIds.length === 0) {
            const firstAvailableStockWatchlist = userWatchlists.find(wl => wl.id !== CASH_BANK_WATCHLIST_ID);
            if (firstAvailableStockWatchlist) {
                currentSelectedWatchlistIds = [firstAvailableStockWatchlist.id];
                logDebug('User Settings: Defaulting currentSelectedWatchlistIds to first available stock watchlist: ' + firstAvailableStockWatchlist.name);
            } else {
                currentSelectedWatchlistIds = [CASH_BANK_WATCHLIST_ID];
                logDebug('User Settings: No stock watchlists found, defaulting to Cash & Assets.');
            }
        }
        logDebug('User Settings: Final currentSelectedWatchlistIds before renderWatchlistSelect: ' + currentSelectedWatchlistIds.join(', '));

        renderWatchlistSelect(); // Populate and select in the header dropdown

        // Apply saved sort order or default
        if (currentUserId && savedSortOrder && Array.from(sortSelect.options).some(option => option.value === savedSortOrder)) {
            sortSelect.value = savedSortOrder;
            currentSortOrder = savedSortOrder;
            logDebug('Sort: Applied saved sort order: ' + currentSortOrder);
        } else {
            // Set to default sort for the current view type
            let defaultSortValue = 'entryDate-desc';
            if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
                defaultSortValue = 'name-asc';
            }
            sortSelect.value = defaultSortValue; 
            currentSortOrder = defaultSortValue;
            logDebug('Sort: No valid saved sort order or not applicable, defaulting to: ' + defaultSortValue);
        }
        renderSortSelect(); // Re-render sort options based on selected watchlist type

        // Apply saved theme or default
        if (savedTheme) {
            applyTheme(savedTheme);
        } else {
            const localStorageSelectedTheme = localStorage.getItem('selectedTheme');
            const localStorageTheme = localStorage.getItem('theme');

            if (localStorageSelectedTheme) {
                applyTheme(localStorageSelectedTheme);
            } else if (localStorageTheme) {
                applyTheme(localStorageTheme);
            } else {
                applyTheme('system-default');
            }
        }
        updateThemeToggleAndSelector();

        updateMainButtonsState(true);
        // Apply saved 'show last live price' preference
    if (typeof savedShowLastLivePricePreference === 'boolean') {
        showLastLivePriceOnClosedMarket = savedShowLastLivePricePreference;
        if (showLastLivePriceToggle) {
            showLastLivePriceToggle.checked = showLastLivePriceOnClosedMarket;
        }
        logDebug('Toggle: Applied saved "Show Last Live Price" preference: ' + showLastLivePriceOnClosedMarket);
    } else {
        // Default to false if not set
        showLastLivePriceOnClosedMarket = false;
        if (showLastLivePriceToggle) {
            showLastLivePriceToggle.checked = false;
        }
        logDebug('Toggle: No saved "Show Last Live Price" preference, defaulting to false.');
    } 

        const migratedSomething = await migrateOldSharesToWatchlist();
        if (!migratedSomething) {
            logDebug('Migration: No old shares to migrate/update, directly setting up shares listener for current watchlist.');
        }

        // Load shares listener and cash categories listener once here
        await loadShares(); // Sets up the listener for shares
        await loadCashCategories(); // Sets up the listener for cash categories

        // Initial render based on selected watchlist (stock or cash)
        renderWatchlist(); // This will now correctly display based on the initial currentSelectedWatchlistIds

        window._appDataLoaded = true;
        hideSplashScreenIfReady();

    } catch (error) {
        // Set the initial state of the toggle switch based on loaded preference
        if (showLastLivePriceToggle) {
            showLastLivePriceToggle.checked = showLastLivePriceOnClosedMarket;
        }
        console.error('User Settings: Error loading user watchlists and settings:', error);
        showCustomAlert('Error loading user settings: ' + error.message);
        hideSplashScreen();
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Fetches live price data from the Google Apps Script Web App.
 * Updates the `livePrices` global object.
 */
async function fetchLivePrices() {
    console.log('Live Price: Attempting to fetch live prices...');
    // Only fetch live prices if a stock-related watchlist is selected
    if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
        console.log('Live Price: Skipping live price fetch because "Cash & Assets" is selected.'); // UPDATED TEXT
        window._livePricesLoaded = true; // Mark as loaded even if skipped for splash screen
        hideSplashScreenIfReady();
        return;
    }

    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL); 
        if (!response.ok) {
            throw new Error('HTTP error! status: ' + response.status);
        }
        const data = await response.json();
        console.log('Live Price: Raw data received:', data); 

        const newLivePrices = {};
        data.forEach(item => {
            const asxCode = String(item.ASXCode).toUpperCase();
            const livePrice = parseFloat(item.LivePrice);
            const prevClose = parseFloat(item.PrevClose); 
            const pe = parseFloat(item.PE);
            const high52 = parseFloat(item.High52);
            const low52 = parseFloat(item.Low52);

            if (asxCode && !isNaN(livePrice)) {
                // Find the corresponding share in allSharesData to get its targetValue and targetType
                const shareIndex = allSharesData.findIndex(s => s.shareName.toUpperCase() === asxCode);
                const shareData = shareIndex !== -1 ? allSharesData[shareIndex] : null;

                let isTargetHit = false;
                let alertType = ''; // 'buy' or 'sell'
                let calculatedTargetPrice = null;

                if (shareData && shareData.targetValue !== null && shareData.targetValue !== undefined && !isNaN(shareData.targetValue) && shareData.currentPrice !== null && shareData.currentPrice !== undefined && !isNaN(shareData.currentPrice)) {
                    if (shareData.targetType === '%') {
                        calculatedTargetPrice = shareData.currentPrice * (1 + shareData.targetValue / 100);
                        if (shareData.targetValue > 0) { // Positive percentage is a sell target
                            alertType = 'sell';
                            if (livePrice >= calculatedTargetPrice) {
                                isTargetHit = true;
                            }
                        } else { // Negative percentage is a buy target
                            alertType = 'buy';
                            if (livePrice <= calculatedTargetPrice) {
                                isTargetHit = true;
                            }
                        }
                    } else { // '$' type
                        calculatedTargetPrice = shareData.targetValue;
                        if (calculatedTargetPrice < shareData.currentPrice) { // Dollar target below entered price is a buy target
                            alertType = 'buy';
                            if (livePrice <= calculatedTargetPrice) {
                                isTargetHit = true;
                            }
                        } else { // Dollar target above entered price is a sell target
                            alertType = 'sell';
                            if (livePrice >= calculatedTargetPrice) {
                                isTargetHit = true;
                            }
                        }
                    }

                    // Update the actual share object in allSharesData with calculated properties
                    if (shareIndex !== -1) {
                        allSharesData[shareIndex].calculatedTargetPrice = calculatedTargetPrice;
                        allSharesData[shareIndex].alertTriggered = isTargetHit;
                        allSharesData[shareIndex].alertType = alertType;
                        // Store company name from live data if available and not already set
                        if (item.CompanyName) {
                            allSharesData[shareIndex].companyName = item.CompanyName;
                        }
                    }
                }
                newLivePrices[asxCode] = {
                    live: livePrice,
                    prevClose: isNaN(prevClose) ? null : prevClose,
                    PE: isNaN(pe) ? null : pe,
                    High52: isNaN(high52) ? null : high52,
                    Low52: isNaN(low52) ? null : low52,
                    targetHit: isTargetHit, // Keep this for now for existing logic reference
                    lastLivePrice: livePrice,
                    lastPrevClose: isNaN(prevClose) ? null : prevClose,
                    CompanyName: item.CompanyName || 'N/A' // Store company name here too
                };
            } else {
                console.warn('Live Price: Skipping item due to missing ASX code or invalid price:', item);
            }
        });
        livePrices = newLivePrices;
        console.log('Live Price: Live prices updated:', livePrices); 
        
        // renderWatchlist is called from the onSnapshot for shares, which will then trigger this.
        // We need to ensure adjustMainContentPadding is called here as well, as per user's instruction.
        adjustMainContentPadding(); 
        
        // NEW: Indicate that live prices are loaded for splash screen
        window._livePricesLoaded = true;
        hideSplashScreenIfReady();
        
        updateAlertIconStatus(); // Explicitly update alert icon after prices are fresh
    } catch (error) {
        console.error('Live Price: Error fetching live prices:', error);
        // NEW: Hide splash screen on error
        hideSplashScreen();
    }
}

/**
 * Starts the periodic fetching of live prices.
 */
function startLivePriceUpdates() {
    if (livePriceFetchInterval) {
        clearInterval(livePriceFetchInterval);
        logDebug('Live Price: Cleared existing live price interval.');
    }
    // Only start fetching if not in cash view
    if (!currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
        fetchLivePrices(); 
        livePriceFetchInterval = setInterval(fetchLivePrices, LIVE_PRICE_FETCH_INTERVAL_MS);
        logDebug('Live Price: Started live price updates every ' + (LIVE_PRICE_FETCH_INTERVAL_MS / 1000 / 60) + ' minutes.');
    } else {
        logDebug('Live Price: Not starting live price updates because "Cash & Assets" is selected.'); // UPDATED TEXT
    }
}

/**
 * Stops the periodic fetching of live prices.
 */
function stopLivePriceUpdates() {
    if (livePriceFetchInterval) {
        clearInterval(livePriceFetchInterval);
        livePriceFetchInterval = null;
        logDebug('Live Price: Stopped live price updates.');
    }
}

// This function is removed as its logic is now replaced by updateAlertIconStatus.
// Keep this empty placeholder if it's called elsewhere and removing it completely causes issues.
// Ideally, all calls to updateTargetHitBanner should be replaced with updateAlertsIconStatus.
function updateTargetHitBanner() {
    logDebug('Target Alert: updateTargetHitBanner is deprecated. Its functionality is now handled by updateAlertIconStatus().');
}

// NEW: Function to render alerts in the alert panel (currently empty, but planned for future)
function renderAlertsInPanel() {
    // alertList and closeAlertPanelBtn, clearAllAlertsBtn are currently not in index.html, so this function is a placeholder
    // If you add the alert panel back, ensure these elements exist.
    if (!alertPanel) {
        console.warn('Alert Panel: Alert panel elements not found. Skipping renderAlertsInPanel.');
        return;
    }

    // Placeholder for alert rendering logic if you re-introduce the alert panel
    logDebug('Alert Panel: Rendering alerts in panel (placeholder).');
}


/**
 * Toggles the mobile view mode between default (single column) and compact (two columns).
 * Updates the UI to reflect the new mode and saves preference to local storage.
 */
function toggleMobileViewMode() {
    if (!mobileShareCardsContainer) {
        console.error('toggleMobileViewMode: mobileShareCardsContainer not found.');
        return;
    }

    if (currentMobileViewMode === 'default') {
        currentMobileViewMode = 'compact';
        mobileShareCardsContainer.classList.add('compact-view');
        showCustomAlert('Switched to Compact View!', 1000);
        logDebug('View Mode: Switched to Compact View.');
    } else {
        currentMobileViewMode = 'default';
        mobileShareCardsContainer.classList.remove('compact-view');
        showCustomAlert('Switched to Default View!', 1000);
        logDebug('View Mode: Switched to Default View.');
    }
    
    localStorage.setItem('currentMobileViewMode', currentMobileViewMode); // Save preference
    renderWatchlist(); // Re-render to apply new card styling and layout
}

// NEW: Splash Screen Functions
let splashScreenReady = false; // Flag to ensure splash screen is ready before hiding

/**
 * Hides the splash screen with a fade-out effect.
 */
function hideSplashScreen() {
    if (splashScreen) {
        splashScreen.classList.add('hidden'); // Start fade-out
        if (splashKangarooIcon) {
            splashKangarooIcon.classList.remove('pulsing'); // Stop animation
        }
        // Show main app content
        if (mainContainer) {
            mainContainer.classList.remove('app-hidden');
        }
        if (appHeader) { // Assuming header is part of the main app content that needs to be revealed
            appHeader.classList.remove('app-hidden');
        }
        // Temporarily remove overflow hidden from body
        document.body.style.overflow = ''; 

        // REMOVED: splashScreen.addEventListener('transitionend', () => { if (splashScreen.parentNode) { splashScreen.parentNode.removeChild(splashScreen); } }, { once: true });
        logDebug('Splash Screen: Hiding.');
    }
}

/**
 * Checks if all necessary app data is loaded and hides the splash screen if ready.
 * This function is called after each major data loading step.
 */
function hideSplashScreenIfReady() {
    // Only hide if Firebase is initialized, user is authenticated, and all data flags are true
    if (window._firebaseInitialized && window._userAuthenticated && window._appDataLoaded && window._livePricesLoaded) {
        if (splashScreenReady) { // Ensure splash screen itself is ready to be hidden
            logDebug('Splash Screen: All data loaded and ready. Hiding splash screen.');
            hideSplashScreen();
        } else {
            logDebug('Splash Screen: Data loaded, but splash screen not yet marked as ready. Will hide when ready.');
        }
    } else {
        logDebug('Splash Screen: Not all data loaded yet. Current state: ' +
            'Firebase Init: ' + window._firebaseInitialized +
            ', User Auth: ' + window._userAuthenticated +
            ', App Data: ' + window._appDataLoaded +
            ', Live Prices: ' + window._livePricesLoaded);
    }
}

/**
 * Sets up a real-time Firestore listener for shares.
 * Updates `allSharesData` and triggers UI re-render via `renderWatchlist` (indirectly through `fetchLivePrices` or `sortShares`).
 */
async function loadShares() {
    if (unsubscribeShares) {
        unsubscribeShares();
        unsubscribeShares = null;
        logDebug('Firestore Listener: Unsubscribed from previous shares listener.');
    }

    if (!db || !currentUserId || !window.firestore) {
        console.warn('Shares: Firestore DB, User ID, or Firestore functions not available for loading shares. Clearing list.');
        allSharesData = []; // Clear data if services aren't available
        // renderWatchlist(); // No need to call here, onAuthStateChanged will handle initial render
        window._appDataLoaded = false;
        hideSplashScreen(); 
        return;
    }
    
    try {
        const sharesCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
        let q = window.firestore.query(sharesCol); // Listener for all shares, filtering for display done in renderWatchlist

        // NEW: Unsubscribe from the previous listener if it exists to prevent multiple listeners
        if (unsubscribeShares) {
            unsubscribeShares();
            logDebug('Firestore Listener: Unsubscribed from previous shares listener before re-attaching.');
        }

        unsubscribeShares = window.firestore.onSnapshot(q, async (querySnapshot) => { 
            logDebug('Firestore Listener: Shares snapshot received. Processing changes.');
            let fetchedShares = [];
            querySnapshot.forEach((doc) => {
                const share = { id: doc.id, ...doc.data() };
                fetchedShares.push(share);
            });

            allSharesData = fetchedShares;
            logDebug('Shares: Shares data updated from snapshot. Total shares: ' + allSharesData.length);
            
            sortShares(); // Sorts allSharesData and calls renderWatchlist
            renderAsxCodeButtons(); // Re-renders ASX buttons based on allSharesData
            
            // REMOVED this line as it's now handled by the fetchLivePrices() call in onAuthStateChanged
            // await fetchLivePrices(); 
            
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            window._appDataLoaded = true;
            hideSplashScreenIfReady();

        }, (error) => {
            console.error('Firestore Listener: Error listening to shares:', error);
            showCustomAlert('Error loading shares in real-time: ' + error.message);
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            window._appDataLoaded = false;
            hideSplashScreen(); 
        });

    } catch (error) {
        console.error('Shares: Error setting up shares listener:', error);
        showCustomAlert('Error setting up real-time share updates: ' + error.message);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        window._appDataLoaded = false;
        hideSplashScreen(); 
    }
}

// NEW: Cash & Assets Functions (3.1)

/**
 * Sets up a real-time Firestore listener for cash categories.
 * Updates `userCashCategories` and triggers UI re-render via `renderWatchlist`.
 */
async function loadCashCategories() {
    if (unsubscribeCashCategories) {
        unsubscribeCashCategories();
        unsubscribeCashCategories = null;
        logDebug('Firestore Listener: Unsubscribed from previous cash categories listener.');
    }

    if (!db || !currentUserId || !window.firestore) {
        console.warn('Cash Categories: Firestore DB, User ID, or Firestore functions not available for loading cash categories. Clearing list.');
        userCashCategories = [];
        renderCashCategories(); // Render with empty data
        return;
    }

    try {
        const cashCategoriesCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories');
        const q = window.firestore.query(cashCategoriesCol);

        unsubscribeCashCategories = window.firestore.onSnapshot(q, (querySnapshot) => {
            logDebug('Firestore Listener: Cash categories snapshot received. Processing changes.');
            let fetchedCategories = [];
            querySnapshot.forEach((doc) => {
                const category = { id: doc.id, ...doc.data() };
                fetchedCategories.push(category);
            });

            userCashCategories = fetchedCategories; // Sort will be applied in renderCashCategories
            logDebug('Cash Categories: Data updated from snapshot. Total categories: ' + userCashCategories.length);
            
            // Trigger a re-render of the overall watchlist, which will then call renderCashCategories if needed
            renderWatchlist(); 
            calculateTotalCash(); // Ensure total is updated whenever categories change

        }, (error) => {
            console.error('Firestore Listener: Error listening to cash categories:', error);
            showCustomAlert('Error loading cash categories in real-time: ' + error.message);
        });

    } catch (error) {
        console.error('Cash Categories: Error setting up cash categories listener:', error);
        showCustomAlert('Error setting up real-time cash category updates: ' + error.message);
    }
}

/**
 * Renders the cash categories in the UI. (1)
 */
function renderCashCategories() {
    if (!cashCategoriesContainer) {
        console.error('renderCashCategories: cashCategoriesContainer element not found.');
        return;
    }
    cashCategoriesContainer.innerHTML = ''; // Clear existing content

    // Sort cash categories before rendering
    const sortedCashCategories = sortCashCategories();

    if (sortedCashCategories.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.classList.add('empty-message');
        emptyMessage.textContent = 'No cash categories added yet. Click "Add Category" to get started!';
        cashCategoriesContainer.appendChild(emptyMessage);
        return;
    }

    sortedCashCategories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.classList.add('cash-category-item');
        categoryItem.dataset.id = category.id;
        // Apply 'hidden' class if asset is marked as hidden in its data
        if (category.isHidden) {
            categoryItem.classList.add('hidden');
        }

        // Header for name and icons (3.1)
        const categoryHeader = document.createElement('div');
        categoryHeader.classList.add('category-header');

        const nameDisplay = document.createElement('span'); // Use span for display
        nameDisplay.classList.add('category-name-display');
        nameDisplay.textContent = category.name || 'Unnamed Asset';
        categoryHeader.appendChild(nameDisplay);

        // No eye icon button creation here anymore, as visibility is controlled by checkbox in modal.
        // Edit and Delete buttons are now only in the modal, so they are not added here.

        categoryItem.appendChild(categoryHeader); // Attach header directly

        // Balance Display (3.1)
        const balanceDisplay = document.createElement('span');
        balanceDisplay.classList.add('category-balance-display');
        balanceDisplay.textContent = '$' + (Number(category.balance) !== null && !isNaN(Number(category.balance)) ? Number(category.balance).toFixed(2) : '0.00');
        categoryItem.appendChild(balanceDisplay);

        // Add click listener for details modal (2.2)
        categoryItem.addEventListener('click', () => {
            logDebug('Cash Categories: Card clicked for category ID: ' + category.id);
            selectCashAsset(category.id);
            showCashCategoryDetailsModal(category.id);
        });

        cashCategoriesContainer.appendChild(categoryItem);
    });
    logDebug('Cash Categories: UI rendered.');
    calculateTotalCash(); // Calculate total after rendering
}

/**
 * Adds a new empty cash category to the UI and `userCashCategories` array.
 * This function is now primarily for triggering the modal for a new entry.
 */
function addCashCategoryUI() {
    logDebug('Cash Categories: Add new category UI triggered.');
    // This function now directly opens the modal for a new cash asset.
    showAddEditCashCategoryModal(null); // Pass null to indicate a new asset
}

/**
 * This function is no longer used for saving from the main view,
 * as saving now occurs via the modal.
 * Kept as a placeholder in case its logic is needed elsewhere.
 */
async function saveCashCategories() {
    logDebug('saveCashCategories: This function is deprecated. Saving now handled via modal save.');
    // No longer iterates through UI inputs.
    // The onSnapshot listener handles updates from modal saves.
}

/**
 * Deletes a specific cash category from Firestore.
 * @param {string} categoryId The ID of the category to delete.
 */
async function deleteCashCategory(categoryId) {
    if (!db || !currentUserId || !window.firestore) {
        showCustomAlert('Firestore not available. Cannot delete cash category.');
        return;
    }

    // NEW: Direct deletion without confirmation modal
    try {
        const categoryDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories', categoryId);
        await window.firestore.deleteDoc(categoryDocRef);
        showCustomAlert('Category deleted successfully!', 1500);
        logDebug('Firestore: Cash category (ID: ' + categoryId + ') deleted.');
    } catch (error) {
        console.error('Firestore: Error deleting cash category:', error);
        showCustomAlert('Error deleting category: ' + error.message);
    }
}

/**
 * Calculates and displays the total cash balance. (1)
 */
function calculateTotalCash() {
    let total = 0;
    userCashCategories.forEach(category => {
        // Only include assets that are NOT hidden in the total
        if (!category.isHidden) { // Check the 'isHidden' property directly
            if (typeof category.balance === 'number' && !isNaN(category.balance)) {
                total += category.balance;
            }
        }
    });
    if (totalCashDisplay) {
        totalCashDisplay.textContent = '$' + total.toFixed(2);
    }
    logDebug('Cash Categories: Total cash calculated: $' + total.toFixed(2));
}

// NEW: Cash Asset Form Modal Functions (2.1)
function showAddEditCashCategoryModal(assetIdToEdit = null) {
    clearCashAssetForm(); // Clear form for new entry or before populating for edit
    selectedCashAssetDocId = assetIdToEdit;

    if (assetIdToEdit) {
        const assetToEdit = userCashCategories.find(asset => asset.id === assetIdToEdit);
        if (!assetToEdit) {
            showCustomAlert('Cash asset not found.');
            return;
        }
        cashFormTitle.textContent = 'Edit Cash Asset';
        cashAssetNameInput.value = assetToEdit.name || '';
        cashAssetBalanceInput.value = Number(assetToEdit.balance) !== null && !isNaN(Number(assetToEdit.balance)) ? Number(assetToEdit.balance).toFixed(2) : '';
        setIconDisabled(deleteCashAssetBtn, false); // Enable delete button for existing asset
        
        // Populate comments for editing
        if (cashAssetCommentsContainer) {
            cashAssetCommentsContainer.innerHTML = ''; // Clear existing dynamic comment sections
            if (assetToEdit.comments && Array.isArray(assetToEdit.comments) && assetToEdit.comments.length > 0) {
                assetToEdit.comments.forEach(comment => addCommentSection(cashAssetCommentsContainer, comment.title, comment.text, true));
            } else {
                addCommentSection(cashAssetCommentsContainer, '', '', true); // Add one empty comment section
            }
        }
        // Ensure addCashAssetCommentBtn exists before trying to modify its classList
        if (addCashAssetCommentBtn) {
            addCashAssetCommentBtn.classList.remove('hidden'); // Show add comment button
        }
        // Set checkbox state based on existing asset's isHidden property
        if (hideCashAssetCheckbox) {
            hideCashAssetCheckbox.checked = !!assetToEdit.isHidden; // Convert to boolean
        }
        originalCashAssetData = getCurrentCashAssetFormData(); // Store original data for dirty check
        logDebug('Cash Form: Opened edit form for cash asset: ' + assetToEdit.name + ' (ID: ' + assetIdToEdit + ')');
    } else {
        cashFormTitle.textContent = 'Add New Cash Asset';
        setIconDisabled(deleteCashAssetBtn, true); // Hide delete button for new asset
        if (cashAssetCommentsContainer) {
            cashAssetCommentsContainer.innerHTML = ''; // Clear any previous comments
            addCommentSection(cashAssetCommentsContainer, '', '', true); // Add initial empty comment section for new cash asset
        }
        // Ensure addCashAssetCommentBtn exists before trying to modify its classList
        if (addCashAssetCommentBtn) {
            addCashAssetCommentBtn.classList.remove('hidden'); // Show add comment button
        }
        // For new assets, checkbox should be unchecked by default
        if (hideCashAssetCheckbox) {
            hideCashAssetCheckbox.checked = false;
        }
        originalCashAssetData = null; // No original data for new asset
        logDebug('Cash Form: Opened add new cash asset form.');
    }
    setIconDisabled(saveCashAssetBtn, true); // Save button disabled initially
    showModal(cashAssetFormModal);
    cashAssetNameInput.focus();
    checkCashAssetFormDirtyState(); // Initial dirty state check
}

function clearCashAssetForm() {
    if (cashAssetNameInput) cashAssetNameInput.value = '';
    if (cashAssetBalanceInput) cashAssetBalanceInput.value = '';
    if (cashAssetCommentsContainer) cashAssetCommentsContainer.innerHTML = ''; // Clear comments
    selectedCashAssetDocId = null;
    originalCashAssetData = null; // Reset original data
    setIconDisabled(saveCashAssetBtn, true); // Disable save button
    logDebug('Cash Form: Cash asset form cleared.');
}

function getCurrentCashAssetFormData() {
    const comments = [];
    if (cashAssetCommentsContainer) {
        cashAssetCommentsContainer.querySelectorAll('.comment-section').forEach(section => {
            const titleInput = section.querySelector('.comment-title-input');
            const textInput = section.querySelector('.comment-text-input');
            const title = titleInput ? titleInput.value.trim() : '';
            const text = textInput ? textInput.value.trim() : '';
            if (title || text) {
                comments.push({ title: title, text: text });
            }
        });
    }

    return {
        name: cashAssetNameInput ? cashAssetNameInput.value.trim() : '',
        balance: cashAssetBalanceInput ? parseFloat(cashAssetBalanceInput.value) : null,
        comments: comments,
        // NEW: Include the isHidden state from the checkbox
        isHidden: hideCashAssetCheckbox ? hideCashAssetCheckbox.checked : false
    };
}

function areCashAssetDataEqual(data1, data2) {
    if (!data1 || !data2) return false;
    let balance1 = typeof data1.balance === 'number' && !isNaN(data1.balance) ? data1.balance : null;
    let balance2 = typeof data2.balance === 'number' && !isNaN(data2.balance) ? data2.balance : null;
    
    // NEW: Compare isHidden state
    if (data1.name !== data2.name || balance1 !== balance2 || data1.isHidden !== data2.isHidden) {
        return false;
    }

    // Deep compare comments
    if (data1.comments.length !== data2.comments.length) {
        return false;
    }
    for (let i = 0; i < data1.comments.length; i++) {
        const comment1 = data1.comments[i];
        const comment2 = data2.comments[i];
        if (comment1.title !== comment2.title || comment1.text !== comment2.text) {
            return false;
        }
    }
    return true;
}

function checkCashAssetFormDirtyState() {
    const currentData = getCurrentCashAssetFormData();
    const isNameValid = currentData.name.trim() !== '';
    let canSave = isNameValid;

    if (selectedCashAssetDocId && originalCashAssetData) {
        // For existing assets, enable save if data is dirty (including checkbox state)
        const isDirty = !areCashAssetDataEqual(originalCashAssetData, currentData);
        canSave = canSave && isDirty;
        if (!isDirty) {
            logDebug('Dirty State: Existing cash asset: No changes detected, save disabled.');
        }
    } else if (!selectedCashAssetDocId) {
        // For new cash assets, enable if name is valid (no original data to compare against)
        // 'canSave' is already 'isNameValid' here.
    }

    setIconDisabled(saveCashAssetBtn, !canSave);
    logDebug('Dirty State: Cash asset save button enabled: ' + canSave);
}

async function saveCashAsset(isSilent = false) {
    logDebug('Cash Form: saveCashAsset called.');
    if (saveCashAssetBtn.classList.contains('is-disabled-icon') && isSilent) {
        logDebug('Auto-Save: Save button is disabled (no changes or no valid name). Skipping silent save.');
        return;
    }

    const assetName = cashAssetNameInput.value.trim();
    if (!assetName) {
        if (!isSilent) showCustomAlert('Asset name is required!');
        console.warn('Save Cash Asset: Asset name is required. Skipping save.');
        return;
    }

    const assetBalance = parseFloat(cashAssetBalanceInput.value);

    const comments = [];
    if (cashAssetCommentsContainer) {
        cashAssetCommentsContainer.querySelectorAll('.comment-section').forEach(section => {
            const titleInput = section.querySelector('.comment-title-input');
            const textInput = section.querySelector('.comment-text-input');
            const title = titleInput ? titleInput.value.trim() : '';
            const text = textInput ? textInput.value.trim() : '';
            if (title || text) {
                comments.push({ title: title, text: text });
            }
        });
    }

    const cashAssetData = {
        name: assetName,
        balance: isNaN(assetBalance) ? 0 : assetBalance, // Default to 0 if NaN
        comments: comments, // NEW: Include comments
        userId: currentUserId,
        lastUpdated: new Date().toISOString(),
        // NEW: Save the isHidden state from the checkbox
        isHidden: hideCashAssetCheckbox ? hideCashAssetCheckbox.checked : false
    };

    try {
        if (selectedCashAssetDocId) {
            const assetDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories', selectedCashAssetDocId);
            await window.firestore.updateDoc(assetDocRef, cashAssetData);
            if (!isSilent) showCustomAlert('Cash asset \'' + assetName + '\' updated successfully!', 1500);
            logDebug('Firestore: Cash asset \'' + assetName + '\' (ID: ' + selectedCashAssetDocId + ') updated.');
        } else {
            const cashCategoriesColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories');
            const newDocRef = await window.firestore.addDoc(cashCategoriesColRef, cashAssetData);
            selectedCashAssetDocId = newDocRef.id; // Set selected ID for newly added
            if (!isSilent) showCustomAlert('Cash asset \'' + assetName + '\' added successfully!', 1500);
            logDebug('Firestore: Cash asset \'' + assetName + '\' added with ID: ' + newDocRef.id);
        }
        originalCashAssetData = getCurrentCashAssetFormData(); // Update original data after save
        setIconDisabled(saveCashAssetBtn, true); // Disable save button after saving
        if (!isSilent) closeModals();
    } catch (error) {
        console.error('Firestore: Error saving cash asset:', error);
        if (!isSilent) showCustomAlert('Error saving cash asset: ' + error.message);
    }
}

// NEW: Cash Asset Details Modal Functions (2.2)
function showCashCategoryDetailsModal(assetId) {
    if (!assetId) {
        showCustomAlert('Please select a cash asset to view details.');
        return;
    }
    const asset = userCashCategories.find(a => a.id === assetId);
    if (!asset) {
        showCustomAlert('Selected cash asset not found.');
        return;
    }
    selectedCashAssetDocId = assetId; // Set for potential edit/delete from details modal

    modalCashAssetName.textContent = asset.name || 'N/A';
    detailCashAssetName.textContent = asset.name || 'N/A';
    detailCashAssetBalance.textContent = '$' + (Number(asset.balance) !== null && !isNaN(Number(asset.balance)) ? Number(asset.balance).toFixed(2) : '0.00');
    detailCashAssetLastUpdated.textContent = formatDate(asset.lastUpdated) || 'N/A';

    // Display comments in details modal
    if (modalCashAssetCommentsContainer) {
        modalCashAssetCommentsContainer.innerHTML = ''; // Clear existing content
        if (asset.comments && Array.isArray(asset.comments) && asset.comments.length > 0) {
            asset.comments.forEach(comment => {
                if (comment.title || comment.text) {
                    const commentDiv = document.createElement('div');
                    commentDiv.className = 'modal-comment-item';
                    
                    if (comment.title && comment.title.trim() !== '') {
                        const titleBar = document.createElement('div');
                        titleBar.classList.add('comment-title-bar');
                        titleBar.textContent = comment.title;
                        commentDiv.appendChild(titleBar);
                    }
                    
                    const commentTextP = document.createElement('p');
                    commentTextP.textContent = comment.text || '';
                    commentDiv.appendChild(commentTextP);

                    modalCashAssetCommentsContainer.appendChild(commentDiv);
                }
            });
        } else {
            modalCashAssetCommentsContainer.innerHTML = '<p style="text-align: center; color: var(--label-color);">No comments for this asset.</p>';
        }
    }

    showModal(cashAssetDetailModal);
    logDebug('Details: Displayed details for cash asset: ' + asset.name + ' (ID: ' + assetId + ')');
}

// Custom Confirm Dialog Function (Now unused for deletions, but kept for potential future use)
function showCustomConfirm(message, callback) {
    const confirmBtn = document.getElementById('customDialogConfirmBtn');
    const cancelBtn = document.getElementById('customDialogCancelBtn');
    const dialogButtonsContainer = document.querySelector('#customDialogModal .custom-dialog-buttons');

    logDebug('showCustomConfirm: confirmBtn found: ' + !!confirmBtn + ', cancelBtn found: ' + !!cancelBtn + ', dialogButtonsContainer found: ' + !!dialogButtonsContainer);

    if (!customDialogModal || !customDialogMessage || !confirmBtn || !cancelBtn || !dialogButtonsContainer) {
        console.error('Custom dialog elements not found. Cannot show confirm.');
        console.log('CONFIRM (fallback): ' + message);
        callback(window.confirm(message)); // Fallback to native confirm
        return;
    }
    customDialogMessage.textContent = message;

    dialogButtonsContainer.style.display = 'flex'; // Explicitly show the container
    logDebug('showCustomConfirm: dialogButtonsContainer display set to: ' + dialogButtonsContainer.style.display);

    setIconDisabled(confirmBtn, false); // Enable the confirm button
    setIconDisabled(cancelBtn, false); // Enable the cancel button

    showModal(customDialogModal);

    // Remove any existing 'click' listeners to prevent multiple firings
    const oldConfirmListener = confirmBtn._currentClickListener;
    if (oldConfirmListener) {
        confirmBtn.removeEventListener('click', oldConfirmListener);
    }
    const oldCancelListener = cancelBtn._currentClickListener;
    if (oldCancelListener) {
        cancelBtn.removeEventListener('click', oldCancelListener);
    }

    const onConfirm = () => {
        hideModal(customDialogModal);
        callback(true);
        logDebug('Confirm: User confirmed.');
    };

    const onCancel = () => {
        hideModal(customDialogModal);
        callback(false);
        logDebug('Confirm: User cancelled.');
    };

    confirmBtn.addEventListener('click', onConfirm);
    confirmBtn._currentClickListener = onConfirm; // Store reference

    cancelBtn.addEventListener('click', onCancel);
    cancelBtn._currentClickListener = onCancel; // Store reference

    logDebug('Confirm: Showing confirm: "' + message + '"');
}

/**
 * Updates the main title of the app based on the currently selected watchlist.
 */
function updateMainTitle() {
    if (!mainTitle || !watchlistSelect) return;

    const selectedValue = watchlistSelect.value;
    const selectedText = watchlistSelect.options[watchlistSelect.selectedIndex].textContent;

    if (selectedValue === ALL_SHARES_ID) {
        mainTitle.textContent = 'All Shares';
    } else if (selectedValue === CASH_BANK_WATCHLIST_ID) {
        mainTitle.textContent = 'Cash & Assets'; // UPDATED TEXT
    } else {
        mainTitle.textContent = selectedText;
    }
    logDebug('UI: Main title updated to: ' + mainTitle.textContent);
}

/**
 * Updates the behavior of the main header's plus button and sidebar's "Add New Share" button
 * based on the selected watchlist.
 * If 'Cash & Assets' is selected, they open the cash asset form. Otherwise, they open the share form.
 */
function updateAddHeaderButton() {
    logDebug('DEBUG: updateAddHeaderButton called. Current selected watchlist IDs: ' + currentSelectedWatchlistIds.join(', '));
    if (!addShareHeaderBtn) {
        console.warn('updateAddHeaderButton: addShareHeaderBtn not found.');
        return;
    }

    // Remove existing event listeners from header button to prevent multiple bindings
    addShareHeaderBtn.removeEventListener('click', handleAddShareClick);
    addShareHeaderBtn.removeEventListener('click', handleAddCashAssetClick);

    // Set the appropriate event listener for the header button
    if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
        addShareHeaderBtn.addEventListener('click', handleAddCashAssetClick);
        logDebug('DEBUG: Header Plus Button (addShareHeaderBtn) now opens Add Cash Asset modal.');
    } else {
        addShareHeaderBtn.addEventListener('click', handleAddShareClick);
        logDebug('DEBUG: Header Plus Button (addShareHeaderBtn) now opens Add Share modal.');
    }
    // Ensure the button is enabled as its functionality is now contextual
    addShareHeaderBtn.disabled = false; 

    // Also update the sidebar's "Add New Share" button context
    updateSidebarAddButtonContext();
}

/**
 * Handles click for adding a new share.
 */
function handleAddShareClick() {
    logDebug('UI: Add Share button clicked (contextual).');
    clearForm();
    formTitle.textContent = 'Add New Share';
    if (deleteShareBtn) { deleteShareBtn.classList.add('hidden'); }
    populateShareWatchlistSelect(null, true); // true indicates new share
    showModal(shareFormSection);
    shareNameInput.focus();
    addCommentSection(commentsFormContainer); // Add an initial empty comment section for new shares
    checkFormDirtyState(); // Check dirty state immediately after opening for new share
}

/**
 * Handles click for adding a new cash asset.
 */
function handleAddCashAssetClick() {
    logDebug('UI: Add Cash Asset button clicked (contextual).');
    // Ensure this specific handleAddCashAssetClick (the standalone one) calls addCashCategoryUI correctly.
    // The previous instructions already ensured addCashCategoryUI calls showAddEditCashCategoryModal(null).
    addCashCategoryUI();
}

/**
 * Updates the sidebar's "Add New Share" button to be contextual.
 * It will open the Share Form or Cash Asset Form based on the selected watchlist.
 */
function updateSidebarAddButtonContext() {
    logDebug('DEBUG: updateSidebarAddButtonContext called. Current selected watchlist IDs: ' + currentSelectedWatchlistIds.join(', '));
    if (!newShareBtn) {
        console.warn('updateSidebarAddButtonContext: newShareBtn not found.');
        return;
    }

    // Remove existing event listeners from sidebar button
    newShareBtn.removeEventListener('click', handleAddShareClick);
    newShareBtn.removeEventListener('click', handleAddCashAssetClick);

    // Set the appropriate event listener for the sidebar button
    if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
        newShareBtn.addEventListener('click', handleAddCashAssetClick);
        // Update the text/icon if needed (optional, but good for clarity)
        const sidebarSpan = newShareBtn.querySelector('span');
        const sidebarIcon = newShareBtn.querySelector('i');
        if (sidebarSpan) sidebarSpan.textContent = 'Add New Cash Asset';
        if (sidebarIcon) sidebarIcon.className = 'fas fa-money-bill-wave'; // Example icon change
        logDebug('DEBUG: Sidebar "Add New Share" button (newShareBtn) now opens Add Cash Asset modal.');
    } else {
        newShareBtn.addEventListener('click', handleAddShareClick);
        // Revert text/icon to original for stock view
        const sidebarSpan = newShareBtn.querySelector('span');
        const sidebarIcon = newShareBtn.querySelector('i');
        if (sidebarSpan) sidebarSpan.textContent = 'Add New Share';
        if (sidebarIcon) sidebarIcon.className = 'fas fa-plus-circle'; // Original icon
        logDebug('DEBUG: Sidebar "Add New Share" button (newShareBtn) now opens Add Share modal.');
    }
}

async function migrateOldSharesToWatchlist() {
    if (!db || !currentUserId || !window.firestore) {
        console.warn('Migration: Firestore DB, User ID, or Firestore functions not available for migration.');
        return false;
    }
    const sharesCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
    const q = window.firestore.query(sharesCol);
    let sharesToUpdate = [];
    let anyMigrationPerformed = false;
    try {
        logDebug('Migration: Checking for old shares to migrate/update schema and data types.');
        const querySnapshot = await window.firestore.getDocs(q);
        querySnapshot.forEach(doc => {
            const shareData = doc.data();
            let updatePayload = {};
            let needsUpdate = false;
            if (!shareData.hasOwnProperty('watchlistId')) {
                needsUpdate = true;
                updatePayload.watchlistId = getDefaultWatchlistId(currentUserId);
                logDebug('Migration: Share \'' + doc.id + '\' missing watchlistId. Assigning to default.');
            }
            if ((!shareData.shareName || String(shareData.shareName).trim() === '') && shareData.hasOwnProperty('name') && String(shareData.name).trim() !== '') {
                needsUpdate = true;
                updatePayload.shareName = String(shareData.name).trim();
                updatePayload.name = window.firestore.deleteField();
                logDebug('Migration: Share \'' + doc.id + '\' missing \'shareName\' but has \'name\' (\'' + shareData.name + '\'). Migrating \'name\' to \'shareName\'.');
            }
            const fieldsToConvert = ['currentPrice', 'targetPrice', 'dividendAmount', 'frankingCredits', 'entryPrice', 'lastFetchedPrice', 'previousFetchedPrice'];
            fieldsToConvert.forEach(field => {
                const value = shareData[field];
                const originalValueType = typeof value;
                let parsedValue = value;
                if (originalValueType === 'string' && value.trim() !== '') {
                    parsedValue = parseFloat(value);
                    if (!isNaN(parsedValue)) {
                        if (originalValueType !== typeof parsedValue || value !== String(parsedValue)) {
                            needsUpdate = true;
                            updatePayload[field] = parsedValue;
                            logDebug('Migration: Share \'' + doc.id + '\': Converted ' + field + ' from string \'' + value + '\' (type ' + originalValueType + ') to number ' + parsedValue + '.');
                        }
                    } else {
                        needsUpdate = true;
                        updatePayload[field] = null;
                        console.warn('Migration: Share \'' + doc.id + '\': Field \'' + field + '\' was invalid string \'' + value + '\', setting to null.');
                    }
                } else if (originalValueType === 'number' && isNaN(value)) {
                    needsUpdate = true;
                    updatePayload[field] = null;
                    console.warn('Migration: Share \'' + doc.id + '\': Field \'' + field + '\' was NaN number, setting to null.');
                }
                if (field === 'frankingCredits' && typeof parsedValue === 'number' && !isNaN(parsedValue)) {
                    if (parsedValue > 0 && parsedValue < 1) {
                        needsUpdate = true;
                        updatePayload.frankingCredits = parsedValue * 100;
                        logDebug('Migration: Share \'' + doc.id + '\': Converted frankingCredits from decimal ' + parsedValue + ' to percentage ' + (parsedValue * 100) + '.');
                    }
                }
            });
            const effectiveCurrentPrice = (typeof updatePayload.currentPrice === 'number' && !isNaN(updatePayload.currentPrice)) ? updatePayload.currentPrice :
                                           ((typeof shareData.currentPrice === 'string' ? parseFloat(shareData.currentPrice) : shareData.currentPrice) || null);
            if (!shareData.hasOwnProperty('lastFetchedPrice') || (typeof shareData.lastFetchedPrice === 'string' && isNaN(parseFloat(shareData.lastFetchedPrice)))) {
                needsUpdate = true;
                updatePayload.lastFetchedPrice = effectiveCurrentPrice;
                logDebug('Migration: Share \'' + doc.id + '\': Setting missing lastFetchedPrice to ' + effectiveCurrentPrice + '.');
            }
            if (!shareData.hasOwnProperty('previousFetchedPrice') || (typeof shareData.previousFetchedPrice === 'string' && isNaN(parseFloat(shareData.previousFetchedPrice)))) {
                needsUpdate = true;
                updatePayload.previousFetchedPrice = effectiveCurrentPrice;
                logDebug('Migration: Share \'' + doc.id + '\': Setting missing previousFetchedPrice to ' + effectiveCurrentPrice + '.');
            }
            if (!shareData.hasOwnProperty('lastPriceUpdateTime')) {
                needsUpdate = true;
                updatePayload.lastPriceUpdateTime = new Date().toISOString();
                logDebug('Migration: Share \'' + doc.id + '\': Setting missing lastPriceUpdateTime.');
            }
            if (needsUpdate) { sharesToUpdate.push({ ref: doc.ref, data: updatePayload }); }
        });
        if (sharesToUpdate.length > 0) {
            logDebug('Migration: Performing consolidated update for ' + sharesToUpdate.length + ' shares.');
            for (const item of sharesToUpdate) { await window.firestore.updateDoc(item.ref, item.data); }
            showCustomAlert('Migrated/Updated ' + sharesToUpdate.length + ' old shares.', 2000);
            logDebug('Migration: Migration complete. Setting up shares listener.');
            // No need to call loadShares here, the onSnapshot listener will handle updates automatically
            anyMigrationPerformed = true;
        } else {
            logDebug('Migration: No old shares found requiring migration or schema update.');
        }
        return anyMigrationPerformed;
    } catch (error) {
        console.error('Migration: Error during data migration: ' + error.message);
        showCustomAlert('Error during data migration: ' + error.message);
        // NEW: Hide splash screen on error
        hideSplashScreen();
        return false;
    }
}

function showContextMenu(event, shareId) {
    if (!shareContextMenu) return;
    
    currentContextMenuShareId = shareId;
    
    let x = event.clientX;
    let y = event.clientY;

    if (event.touches && event.touches.length > 0) {
        x = event.touches[0].clientX;
        y = event.touches[0].clientY;
    }

    const menuWidth = shareContextMenu.offsetWidth;
    const menuHeight = shareContextMenu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10;
    }
    if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10;
    }
    if (x < 10) x = 10;
    if (y < 10) y = 10;

    shareContextMenu.style.left = `${x}px`;
    shareContextMenu.style.top = `${y}px`;
    shareContextMenu.style.display = 'block';
    contextMenuOpen = true;
    logDebug('Context Menu: Opened for share ID: ' + shareId + ' at (' + x + ', ' + y + ')');
}

function hideContextMenu() {
    if (shareContextMenu) {
        shareContextMenu.style.display = 'none';
        contextMenuOpen = false;
        currentContextMenuShareId = null;
        deselectCurrentShare();
        logDebug('Context Menu: Hidden.');
    }
}

function toggleAppSidebar(forceState = null) {
    logDebug('Sidebar: toggleAppSidebar called. Current open state: ' + appSidebar.classList.contains('open') + ', Force state: ' + forceState);
    const isDesktop = window.innerWidth > 768;
    const isOpen = appSidebar.classList.contains('open');

    if (forceState === true || (forceState === null && !isOpen)) {
        appSidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
        // Reset sidebar scroll position to top when opening
        if (appSidebar) {
            appSidebar.scrollTop = 0;
        }
        // Prevent scrolling of main content when sidebar is open on mobile
        if (!isDesktop) {
            document.body.style.overflow = 'hidden';
            logDebug('Sidebar: Mobile: Body overflow hidden.');
        }
        if (isDesktop) {
            document.body.classList.add('sidebar-active');
            sidebarOverlay.style.pointerEvents = 'none';
            logDebug('Sidebar: Desktop: Sidebar opened, body shifted, overlay pointer-events: none.');
        } else {
            document.body.classList.remove('sidebar-active');
            sidebarOverlay.style.pointerEvents = 'auto'; // Ensure overlay is clickable on mobile
            logDebug('Sidebar: Mobile: Sidebar opened, body NOT shifted, overlay pointer-events: auto.');
        }
        logDebug('Sidebar: Sidebar opened.');
    } else if (forceState === false || (forceState === null && isOpen)) {
        appSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
        document.body.classList.remove('sidebar-active');
        document.body.style.overflow = ''; // Restore scrolling
        sidebarOverlay.style.pointerEvents = 'none'; // Reset pointer-events when closed
        // Reset sidebar scroll position to top when closing
        if (appSidebar) {
            appSidebar.scrollTop = 0;
        }
        logDebug('Sidebar: Sidebar closed.');
    }
}

/**
 * Escapes a string for CSV by enclosing it in double quotes and doubling any existing double quotes.
 * @param {any} value The value to escape.
 * @returns {string} The CSV-escaped string.
 */
function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    let stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
        stringValue = stringValue.replace(/"/g, '""');
        return `"${stringValue}"`;
    }
    return stringValue;
}

/**
 * Exports the current watchlist data to a CSV file.
 */
function exportWatchlistToCSV() {
    if (!currentUserId || currentSelectedWatchlistIds.length === 0) {
        showCustomAlert('Please sign in and select watchlists to export.');
        return;
    }
    
    // Do not export cash data via this function
    if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
        showCustomAlert('Cash & Assets data cannot be exported via this function. Please switch to a stock watchlist.', 3000); // UPDATED TEXT
        return;
    }

    let sharesToExport = [];
    let exportFileNamePrefix = 'selected_watchlists';

    if (currentSelectedWatchlistIds.length === 1) {
        const selectedWatchlistId = currentSelectedWatchlistIds[0];
        if (selectedWatchlistId === ALL_SHARES_ID) {
            sharesToExport = [...allSharesData];
            exportFileNamePrefix = 'all_shares';
        } else {
            sharesToExport = allSharesData.filter(share => share.watchlistId === selectedWatchlistId);
            const wl = userWatchlists.find(w => w.id === selectedWatchlistId);
            if (wl) { exportFileNamePrefix = wl.name; }
        }
    } else {
        // If multiple stock watchlists are selected, export all shares
        sharesToExport = [...allSharesData];
        exportFileNamePrefix = 'all_shares';
    }

    if (sharesToExport.length === 0) {
        showCustomAlert('No shares in the current selection to export.', 2000);
        return;
    }

    const headers = [
        'Code', 'Entered Price', 'Live Price', 'Price Change', 'Target Value', 'Target Type', 'Calculated Target Price', 'Dividend Amount', 'Franking Credits (%)',
        'Unfranked Yield (%)', 'Franked Yield (%)', 'Entry Date'
    ];

    const csvRows = [];
    csvRows.push(headers.map(escapeCsvValue).join(','));

    sharesToExport.forEach(share => {
        const enteredPriceNum = Number(share.currentPrice);
        const dividendAmountNum = Number(share.dividendAmount);
        const frankingCreditsNum = Number(share.frankingCredits);
        const targetValueNum = Number(share.targetValue); // New: Get targetValue
        const targetTypeStr = share.targetType || '$'; // New: Get targetType
        const calculatedTargetPriceNum = Number(share.calculatedTargetPrice); // New: Get calculated target price

        // Get live price data from the global livePrices object
        const livePriceData = livePrices[share.shareName.toUpperCase()];
        const livePrice = livePriceData ? livePriceData.live : undefined;
        const prevClosePrice = livePriceData ? livePriceData.prevClose : undefined;

        let priceChange = '';
        if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice) && 
            prevClosePrice !== undefined && prevClosePrice !== null && !isNaN(prevClosePrice)) {
            const change = livePrice - prevClosePrice;
            const percentageChange = (prevClosePrice !== 0 && !isNaN(prevClosePrice)) ? (change / prevClosePrice) * 100 : 0;
            priceChange = change.toFixed(2) + ' (' + percentageChange.toFixed(2) + '%)'; // Include percentage in CSV
        }

        const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;

        const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, priceForYield);
        const frankedYield = calculateFrankedYield(dividendAmountNum, priceForYield, frankingCreditsNum);

        const row = [
            share.shareName || '',
            (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? enteredPriceNum.toFixed(2) : '',
            (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice.toFixed(2) : '',
            priceChange, // Now includes the calculated price change
            (!isNaN(targetValueNum) && targetValueNum !== null) ? targetValueNum.toFixed(2) : '', // Target Value
            targetTypeStr, // Target Type
            (!isNaN(calculatedTargetPriceNum) && calculatedTargetPriceNum !== null) ? calculatedTargetPriceNum.toFixed(2) : '', // Calculated Target Price
            (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? dividendAmountNum.toFixed(3) : '',
            (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? frankingCreditsNum.toFixed(1) : '',
            unfrankedYield !== null && !isNaN(unfrankedYield) ? unfrankedYield.toFixed(2) : '0.00', // Ensure numerical output
            frankedYield !== null && !isNaN(frankedYield) ? frankedYield.toFixed(2) : '0.00', // Ensure numerical output
            formatDate(share.entryDate) || ''
        ];
        csvRows.push(row.map(escapeCsvValue).join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const formattedDate = new Date().toISOString().slice(0, 10);
    const safeFileNamePrefix = exportFileNamePrefix.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = safeFileNamePrefix + '_watchlist_' + formattedDate + '.csv';
    
    link.href = URL.createObjectURL(blob);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    showCustomAlert('Exported shares to CSV!', 2000);
    logDebug('Export: Shares exported to CSV with prefix: \'' + exportFileNamePrefix + '\'.');
}

/**
 * Gathers current data from the Add/Manage Watchlist form inputs.
 * @param {boolean} isAddModal True if gathering data from the Add Watchlist modal, false for Manage Watchlist.
 * @returns {object} An object representing the current state of the watchlist form.
 */
function getCurrentWatchlistFormData(isAddModal) {
    if (isAddModal) {
        return {
            name: newWatchlistNameInput ? newWatchlistNameInput.value.trim() : ''
        };
    } else {
        return {
            name: editWatchlistNameInput ? editWatchlistNameInput.value.trim() : ''
        };
    }
}

/**
 * Compares two watchlist data objects to check for equality.
 * @param {object} data1
 * @param {object} data2
 * @returns {boolean} True if data is identical, false otherwise.
 */
function areWatchlistDataEqual(data1, data2) {
    if (!data1 || !data2) return false;
    return data1.name === data2.name;
}

/**
 * Checks the current state of the watchlist form against the original data (if editing)
 * and enables/disables the save button accordingly.
 * @param {boolean} isAddModal True if checking the Add Watchlist modal, false for Manage Watchlist.
 */
function checkWatchlistFormDirtyState(isAddModal) {
    const currentData = getCurrentWatchlistFormData(isAddModal);
    const isNameValid = currentData.name.trim() !== '';
    let canSave = isNameValid;

    if (!isAddModal && originalWatchlistData) { // Only for editing existing watchlists
        const isDirty = !areWatchlistDataEqual(originalWatchlistData, currentData);
        canSave = canSave && isDirty;
        if (!isDirty) {
            logDebug('Dirty State: Existing watchlist: No changes detected, save disabled.');
        }
    } else if (isAddModal) {
        // For new watchlists, enable if name is valid
    }

    const targetSaveBtn = isAddModal ? saveWatchlistBtn : saveWatchlistNameBtn;
    setIconDisabled(targetSaveBtn, !canSave);
    logDebug('Dirty State: Watchlist save button enabled: ' + canSave + ' (Modal: ' + (isAddModal ? 'Add' : 'Edit') + ')');
}

/**
 * Saves or updates watchlist data to Firestore. Can be called silently for auto-save.
 * @param {boolean} isSilent If true, no alert messages are shown on success.
 * @param {string} newName The new name for the watchlist.
 * @param {string|null} watchlistId The ID of the watchlist to update, or null if adding new.
 */
async function saveWatchlistChanges(isSilent = false, newName, watchlistId = null) {
    logDebug('Watchlist Form: saveWatchlistChanges called.');

    if (!newName || newName.trim() === '') {
        if (!isSilent) showCustomAlert('Watchlist name is required!');
        console.warn('Save Watchlist: Watchlist name is empty. Skipping save.');
        return;
    }

    // Check for duplicate name (case-insensitive, excluding current watchlist if editing)
    const isDuplicate = userWatchlists.some(w => 
        w.name.toLowerCase() === newName.toLowerCase() && w.id !== watchlistId
    );
    if (isDuplicate) {
        if (!isSilent) showCustomAlert('A watchlist with this name already exists!');
        console.warn('Save Watchlist: Duplicate watchlist name. Skipping save.');
        return;
    }

    try {
        if (watchlistId) { // Editing existing watchlist
            const watchlistDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists', watchlistId);
            await window.firestore.updateDoc(watchlistDocRef, { name: newName });
            if (!isSilent) showCustomAlert('Watchlist renamed to \'' + newName + '\'!', 1500);
            logDebug('Firestore: Watchlist (ID: ' + watchlistId + ') renamed to \'' + newName + '\'.');
        } else { // Adding new watchlist
            const watchlistsColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists');
            const newDocRef = await window.firestore.addDoc(watchlistsColRef, {
                name: newName,
                createdAt: new Date().toISOString(),
                userId: currentUserId
            });
            if (!isSilent) showCustomAlert('Watchlist \'' + newName + '\' added!', 1500);
            logDebug('Firestore: Watchlist \'' + newName + '\' added with ID: ' + newDocRef.id);
            // If new watchlist added, set it as current selection and save preference
            currentSelectedWatchlistIds = [newDocRef.id];
            await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds);
        }
        
        await loadUserWatchlistsAndSettings(); // Re-load to update UI and internal state
        if (!isSilent) closeModals(); // Only close if not a silent save
        originalWatchlistData = getCurrentWatchlistFormData(watchlistId === null); // Update original data after successful save
        checkWatchlistFormDirtyState(watchlistId === null); // Disable save button after saving
    } catch (error) {
        console.error('Firestore: Error saving watchlist:', error);
        if (!isSilent) showCustomAlert('Error saving watchlist: ' + error.message);
    }
}


/**
 * Deletes all user-specific data from Firestore for the current user.
 * This is a destructive and irreversible action.
 */
async function deleteAllUserData() {
    if (!db || !currentUserId || !window.firestore) {
        showCustomAlert('Firestore not available. Cannot delete data.');
        return;
    }

    showCustomConfirm('Are you absolutely sure you want to delete ALL your data? This action is irreversible and will permanently remove all shares, watchlists, cash assets, and settings associated with your account.', async (confirmed) => {
        if (!confirmed) {
            showCustomAlert('Data deletion cancelled.', 1000);
            return;
        }

        showCustomAlert('Deleting all data...', 999999); // Show persistent alert during deletion
        if (loadingIndicator) loadingIndicator.style.display = 'flex'; // Show loading spinner

        try {
            const collectionsToDelete = ['shares', 'watchlists', 'cashCategories'];
            const batch = window.firestore.writeBatch(db);

            // 1. Delete documents from collections
            for (const collectionName of collectionsToDelete) {
                const collectionRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/${collectionName}`);
                const querySnapshot = await window.firestore.getDocs(window.firestore.query(collectionRef));
                querySnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                logDebug(`Firestore: Added ${querySnapshot.docs.length} documents from '${collectionName}' to batch for deletion.`);
            }

            // 2. Delete the user's profile/settings document (if it exists)
            const userProfileDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`);
            const profileDocSnap = await window.firestore.getDoc(userProfileDocRef);
            if (profileDocSnap.exists()) {
                batch.delete(userProfileDocRef);
                logDebug('Firestore: Added user profile settings to batch for deletion.');
            }

            // Commit the batch
            await batch.commit();
            logDebug('Firestore: All user data batch committed successfully.');

            // 3. Sign out the user after data deletion
            if (window.firebaseAuth && window.authFunctions) {
                await window.authFunctions.signOut(window.firebaseAuth);
                showCustomAlert('All your data has been permanently deleted. You have been logged out.', 3000);
                logDebug('Auth: User signed out after data deletion.');
            } else {
                showCustomAlert('All your data has been permanently deleted. Please log out manually.', 3000);
                console.warn('Auth: Could not sign out user automatically after data deletion.');
            }

        } catch (error) {
            console.error('Firestore: Error deleting all user data:', error);
            showCustomAlert('Error deleting all data: ' + error.message, 3000);
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            closeModals(); // Close any open modals
        }
    });
}

async function initializeAppLogic() {
    // DEBUG: Log when initializeAppLogic starts
    logDebug('initializeAppLogic: Firebase is ready. Starting app logic.');

    // Initial modal hiding
    if (shareFormSection) shareFormSection.style.setProperty('display', 'none', 'important');
    if (dividendCalculatorModal) dividendCalculatorModal.style.setProperty('display', 'none', 'important');
    if (shareDetailModal) shareDetailModal.style.setProperty('display', 'none', 'important');
    if (addWatchlistModal) addWatchlistModal.style.setProperty('display', 'none', 'important');
    if (manageWatchlistModal) manageWatchlistModal.style.setProperty('display', 'none', 'important');
    if (customDialogModal) customDialogModal.style.setProperty('display', 'none', 'important');
    if (calculatorModal) calculatorModal.style.setProperty('display', 'none', 'important');
    if (shareContextMenu) shareContextMenu.style.setProperty('display', 'none', 'important');
    if (targetHitIconBtn) targetHitIconBtn.style.display = 'none'; // Ensure icon is hidden initially
    if (activeAlertsModal) activeAlertsModal.style.setProperty('display', 'none', 'important'); // Ensure active alerts modal is hidden initially
    // NEW: Hide cash asset modals initially
    if (cashAssetFormModal) cashAssetFormModal.style.setProperty('display', 'none', 'important');
    if (cashAssetDetailModal) cashAssetDetailModal.style.setProperty('display', 'none', 'important');
    if (stockSearchModal) stockSearchModal.style.setProperty('display', 'none', 'important'); // NEW: Hide stock search modal


    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js', { scope: './' }) 
                .then(registration => {
                    logDebug('Service Worker: Registered with scope:', registration.scope); 
                })
                .catch(error => {
                    console.error('Service Worker: Registration failed:', error);
                });
        });
    }

    // NEW: Load saved mobile view mode preference
    const savedMobileViewMode = localStorage.getItem('currentMobileViewMode');
    if (savedMobileViewMode && (savedMobileViewMode === 'default' || savedMobileViewMode === 'compact')) {
        currentMobileViewMode = savedMobileViewMode;
        if (mobileShareCardsContainer) { // Check if element exists before adding class
            if (currentMobileViewMode === 'compact') {
                mobileShareCardsContainer.classList.add('compact-view');
            } else {
                mobileShareCardsContainer.classList.remove('compact-view');
            }
        }
        logDebug('View Mode: Loaded saved preference: ' + currentMobileViewMode + ' view.');
    } else {
        logDebug('View Mode: No saved mobile view preference, defaulting to \'default\'.');
        currentMobileViewMode = 'default'; // Ensure it's explicitly set if nothing saved
        if (mobileShareCardsContainer) { // Check if element exists before removing class
             mobileShareCardsContainer.classList.remove('compact-view'); // Corrected class name
        }
    }


    // Share Name Input to uppercase
    if (shareNameInput) {
        shareNameInput.addEventListener('input', function() { 
            this.value = this.value.toUpperCase(); 
            checkFormDirtyState();
        });
    }

    if (currentPriceInput) {
        currentPriceInput.addEventListener('input', () => {
            checkFormDirtyState();
            updateTargetCalculationDisplay();
        });
    }

    
    // NEW: Autocomplete Search Input Listeners for Stock Search Modal (Consolidated & Corrected)
    if (asxSearchInput) {
        let currentSuggestions = []; // Stores the current filtered suggestions

        asxSearchInput.addEventListener('input', () => {
            const query = asxSearchInput.value.trim().toUpperCase();
            asxSuggestions.innerHTML = ''; // Clear previous suggestions
            currentSelectedSuggestionIndex = -1; // Reset selection

            if (query.length < 2) { // Only show suggestions if query is at least 2 characters
                asxSuggestions.classList.remove('active');
                searchResultDisplay.innerHTML = '<p class="initial-message">Start typing an ASX code to search.</p>'; // Reset display
                searchModalActionButtons.innerHTML = ''; // Clear action buttons
                currentSearchShareData = null;
                return;
            }

            // Filter suggestions by code or company name
            currentSuggestions = allAsxCodes.filter(stock => 
                stock.code.includes(query) || stock.name.toUpperCase().includes(query)
            ).slice(0, 10); // Limit to top 10 suggestions

            if (currentSuggestions.length > 0) {
                currentSuggestions.forEach((stock, index) => {
                    const div = document.createElement('div');
                    div.classList.add('suggestion-item');
                    div.textContent = `${stock.code} - ${stock.name}`;
                    div.dataset.code = stock.code; // Store the code for easy access
                    div.dataset.name = stock.name; // Store the company name
                    div.addEventListener('click', () => {
                        asxSearchInput.value = stock.code; // Set input to selected code
                        asxSuggestions.classList.remove('active'); // Hide suggestions
                        displayStockDetailsInSearchModal(stock.code); // Display details for selected stock
                    });
                    asxSuggestions.appendChild(div);
                });
                asxSuggestions.classList.add('active'); // Show suggestions
            } else {
                asxSuggestions.classList.remove('active'); // Hide suggestions if no matches
                searchResultDisplay.innerHTML = '<p class="initial-message">No matching stocks found.</p>';
                searchModalActionButtons.innerHTML = '';
                currentSearchShareData = null;
            }
        });

        // Keyboard navigation for suggestions
        asxSearchInput.addEventListener('keydown', (e) => {
            const items = asxSuggestions.querySelectorAll('.suggestion-item');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault(); // Prevent cursor movement in input
                currentSelectedSuggestionIndex = (currentSelectedSuggestionIndex + 1) % items.length;
                updateSelectedSuggestion(items);
                items[currentSelectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault(); // Prevent cursor movement in input
                currentSelectedSuggestionIndex = (currentSelectedSuggestionIndex - 1 + items.length) % items.length;
                updateSelectedSuggestion(items);
                items[currentSelectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission
                if (currentSelectedSuggestionIndex > -1) {
                    // Use the code from the selected suggestion's dataset
                    const selectedCode = items[currentSelectedSuggestionIndex].dataset.code;
                    asxSearchInput.value = selectedCode; // Update input field with the selected code
                    asxSuggestions.classList.remove('active'); // Hide suggestions
                    displayStockDetailsInSearchModal(selectedCode); // Display details for the *selected* stock
                } else if (asxSearchInput.value.trim() !== '') {
                    // If no suggestion selected but input has value, search directly
                    displayStockDetailsInSearchModal(asxSearchInput.value.trim().toUpperCase());
                    asxSuggestions.classList.remove('active'); // Hide suggestions
                }
            } else if (e.key === 'Escape') {
                asxSuggestions.classList.remove('active'); // Hide suggestions
                asxSearchInput.value = ''; // Clear input
                searchResultDisplay.innerHTML = '<p class="initial-message">Start typing an ASX code to search.</p>';
                searchModalActionButtons.innerHTML = '';
                currentSearchShareData = null;
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (asxSuggestions && !asxSuggestions.contains(e.target) && e.target !== asxSearchInput) {
                asxSuggestions.classList.remove('active');
            }
        });

        function updateSelectedSuggestion(items) {
            items.forEach((item, index) => {
                if (index === currentSelectedSuggestionIndex) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
            // Update input value to selected suggestion for better UX
            if (currentSelectedSuggestionIndex > -1) {
                asxSearchInput.value = items[currentSelectedSuggestionIndex].dataset.code;
            }
        }
    }

    // Add event listeners to all form inputs for dirty state checking
    formInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', checkFormDirtyState);
            input.addEventListener('change', checkFormDirtyState);
            input.addEventListener('focus', function() {
                this.select();
            });
        }
    });

    // NEW: Add event listener for the shareWatchlistSelect for dirty state checking
    if (shareWatchlistSelect) {
        shareWatchlistSelect.addEventListener('change', checkFormDirtyState);
    }

    // NEW: Add event listeners for cash asset form inputs for dirty state checking (2.1)
    if (cashAssetNameInput) cashAssetNameInput.addEventListener('input', checkCashAssetFormDirtyState);
    if (cashAssetBalanceInput) cashAssetBalanceInput.addEventListener('input', checkCashAssetFormDirtyState);
    // NEW: Add event listener for the hideCashAssetCheckbox for dirty state checking
    if (hideCashAssetCheckbox) hideCashAssetCheckbox.addEventListener('change', checkCashAssetFormDirtyState);

    formInputs.forEach((input, index) => {
        if (input) {
            input.addEventListener('keydown', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    // Determine the next focusable element
                    let nextElement = null;
                    if (input === targetValueInput) {
                        // If current input is targetValueInput, check which toggle is active or default to dollar
                        if (targetTypeDollarBtn.classList.contains('active') && targetTypePercentBtn) {
                            nextElement = targetTypePercentBtn; // Focus on the other toggle to allow user to easily switch
                        } else if (targetTypePercentBtn.classList.contains('active') && targetTypeDollarBtn) {
                            nextElement = targetTypeDollarBtn;
                        } else {
                            // Default to dollar button if neither is active (shouldn't happen if default is set)
                            nextElement = targetTypeDollarBtn;
                        }
                    } else if (input === targetTypeDollarBtn || input === targetTypePercentBtn) {
                        // If current input is a toggle button, move to dividendAmountInput
                        nextElement = dividendAmountInput;
                    } else if (index < formInputs.length - 1) {
                        nextElement = formInputs[index + 1];
                    }

                    if (nextElement) {
                        nextElement.focus();
                        // For text inputs, select content for easier editing
                        if (nextElement.tagName === 'INPUT' && (nextElement.type === 'text' || nextElement.type === 'number')) {
                            nextElement.select();
                        }
                    } else {
                        // If no more inputs in the formInputs array, try to add a comment or save
                        if (addCommentSectionBtn && addCommentSectionBtn.offsetParent !== null && !addCommentSectionBtn.classList.contains('is-disabled-icon')) {
                            addCommentSectionBtn.click();
                            const newCommentTitleInput = commentsFormContainer.lastElementChild?.querySelector('.comment-title-input');
                            if (newCommentTitleInput) {
                                newCommentTitleInput.focus();
                            }
                        } else if (saveShareBtn && !saveShareBtn.classList.contains('is-disabled-icon')) {
                            saveShareBtn.click();
                        }
                    }
                }
            });
        }
    });

    // Add Comment Section Button for Shares
    if (addCommentSectionBtn) {
        setIconDisabled(addCommentSectionBtn, false);
        addCommentSectionBtn.addEventListener('click', () => {
            addCommentSection(commentsFormContainer);
            checkFormDirtyState();
        });
    }

    // NEW: Add Comment Section Button for Cash Assets
    if (addCashAssetCommentBtn) {
        setIconDisabled(addCashAssetCommentBtn, false);
        addCashAssetCommentBtn.addEventListener('click', () => {
            addCommentSection(cashAssetCommentsContainer, '', '', true); // true for cash asset comment
            checkCashAssetFormDirtyState();
        });
    }

    // Close buttons for modals
    document.querySelectorAll('.close-button').forEach(button => {
        if (button.classList.contains('form-close-button')) { // Specific for the share form's 'X' (Cancel button)
            button.addEventListener('click', () => {
                logDebug('Form: Share form close button (X) clicked. Clearing form before closing to cancel edits.');
                clearForm(); // This will reset originalShareData and selectedShareDocId, preventing auto-save
                closeModals(); // Now closeModals won't trigger auto-save for this form
            });
        } else if (button.classList.contains('cash-form-close-button')) { // NEW: Specific for cash asset form's 'X' (Cancel button)
            button.addEventListener('click', () => {
                logDebug('Cash Form: Cash asset form close button (X) clicked. Clearing form before closing to cancel edits.');
                clearCashAssetForm(); // Reset originalCashAssetData and selectedCashAssetDocId
                closeModals();
            });
        }
        else {
            button.addEventListener('click', closeModals); // Other modals still close normally
        }
    });

    // NEW: Close button for stock search modal
    if (searchModalCloseButton) {
        searchModalCloseButton.addEventListener('click', () => {
            logDebug('Search Modal: Close button clicked.');
            asxSearchInput.value = ''; // Clear input on close
            searchResultDisplay.innerHTML = '<p class="initial-message">Start typing an ASX code to search.</p>'; // Reset display
            searchModalActionButtons.innerHTML = ''; // Clear action buttons
            asxSuggestions.classList.remove('active'); // Hide suggestions
            currentSelectedSuggestionIndex = -1; // Reset selection
            currentSearchShareData = null; // Clear current search data
            hideModal(stockSearchModal);
        });
    }

    // Global click listener to close modals/context menu if clicked outside
    window.addEventListener('click', (event) => {
        if (event.target === shareDetailModal || event.target === dividendCalculatorModal ||
            event.target === shareFormSection || event.target === customDialogModal ||
            event.target === calculatorModal || event.target === addWatchlistModal ||
            event.target === manageWatchlistModal || event.target === alertPanel ||
            event.target === cashAssetFormModal || event.target === cashAssetDetailModal) { // NEW: Include cash asset modals here
            closeModals();
        }

        if (contextMenuOpen && shareContextMenu && !shareContextMenu.contains(event.target)) {
            hideContextMenu();
        }
    });

    // Google Auth Button (Sign In/Out) - This button is removed from index.html.
    // Its functionality is now handled by splashSignInBtn.

    // NEW: Splash Screen Sign-In Button
    if (splashSignInBtn) {
        splashSignInBtn.addEventListener('click', async () => {
            logDebug('Auth: Splash Screen Sign-In Button Clicked.');
            const currentAuth = window.firebaseAuth;
            if (!currentAuth || !window.authFunctions) {
                console.warn('Auth: Auth service not ready or functions not loaded. Cannot process splash sign-in.');
                showCustomAlert('Authentication service not ready. Please try again in a moment.');
                return;
            }
            try {
                // Start pulsing animation immediately on click
                if (splashKangarooIcon) {
                    splashKangarooIcon.classList.add('pulsing');
                    logDebug('Splash Screen: Started pulsing animation on sign-in click.');
                }
                splashSignInBtn.disabled = true; // Disable button to prevent multiple clicks
                
                const provider = window.authFunctions.GoogleAuthProviderInstance;
                if (!provider) {
                    console.error('Auth: GoogleAuthProvider instance not found. Is Firebase module script loaded?');
                    showCustomAlert('Authentication service not ready. Please ensure Firebase module script is loaded.');
                    splashSignInBtn.disabled = false; // Re-enable on error
                    if (splashKangarooIcon) splashKangarooIcon.classList.remove('pulsing'); // Stop animation on error
                    return;
                }
                await window.authFunctions.signInWithPopup(currentAuth, provider);
                logDebug('Auth: Google Sign-In successful from splash screen.');
                // The onAuthStateChanged listener will handle hiding the splash screen
            }
            catch (error) {
                console.error('Auth: Google Sign-In failed from splash screen: ' + error.message);
                showCustomAlert('Google Sign-In failed: ' + error.message);
                splashSignInBtn.disabled = false; // Re-enable on error
                if (splashKangarooIcon) splashKangarooIcon.classList.remove('pulsing'); // Stop animation on error
            }
        });
    }

    // NEW: Target hit icon button listener to open active alerts modal
    if (targetHitIconBtn) {
        targetHitIconBtn.addEventListener('click', () => {
            logDebug('Target Alert: Icon button clicked. Opening active alerts modal.');
            openActiveAlertsModal(); // Call the function to open the active alerts modal
        });
    }

    // Logout Button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            logDebug('Auth: Logout Button Clicked (No Confirmation).');
            const currentAuth = window.firebaseAuth;
            if (!currentAuth || !window.authFunctions) {
                console.warn('Auth: Auth service not ready or functions not loaded. Cannot process logout.');
                showCustomAlert('Authentication service not ready. Please try again in a moment.');
                return;
            }
            try {
                await window.authFunctions.signOut(currentAuth);
                showCustomAlert('Logged out successfully!', 1500);
                logDebug('Auth: User successfully logged out.');
                toggleAppSidebar(false);

                // NEW: Explicitly ensure splash screen is visible for re-authentication
                if (splashScreen) {
                    splashScreen.style.display = 'flex'; // Ensure splash screen is visible
                    splashScreen.classList.remove('hidden'); // Ensure it's not hidden
                    document.body.style.overflow = 'hidden'; // Re-apply overflow hidden
                    if (splashKangarooIcon) {
                        splashKangarooIcon.classList.remove('pulsing'); // Stop animation if signed out
                    }
                    if (splashSignInBtn) {
                        splashSignInBtn.disabled = false; // Enable sign-in button
                        splashSignInBtn.textContent = 'Google Sign In'; // Reset button text
                    }
                    // Hide main app content
                    if (mainContainer) {
                        mainContainer.classList.add('app-hidden');
                    }
                    if (appHeader) {
                        appHeader.classList.add('app-hidden');
                    }
                    logDebug('Splash Screen: User signed out, splash screen remains visible for sign-in.');
                } else {
                    console.warn('Splash Screen: User signed out, but splash screen element not found. App content might be visible.');
                }
                // NEW: Clear dismissed alerts session on logout for a fresh start on next login
                dismissedAlertsSession.clear();

            }
            catch (error) {
                console.error('Auth: Logout failed:', error);
                showCustomAlert('Logout failed: ' + error.message);
            }
        });
    }

// Delete All User Data Button
if (deleteAllUserDataBtn) {
    deleteAllUserDataBtn.addEventListener('click', () => {
        logDebug('UI: Delete All User Data button clicked.');
        deleteAllUserData();
        toggleAppSidebar(false); // Close sidebar after action
    });
}

    // Watchlist Select Change Listener
    if (watchlistSelect) {
        watchlistSelect.addEventListener('change', async (event) => {
            logDebug('Watchlist Select: Change event fired. New value: ' + event.target.value);
            currentSelectedWatchlistIds = [event.target.value];
            await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds);
            // Just render the watchlist. The listeners for shares/cash are already active.
            renderWatchlist();
        });
    }

    // Sort Select Change Listener
if (sortSelect) {
    sortSelect.addEventListener('change', async (event) => {
        logDebug('Sort Select: Change event fired. New value: ' + event.target.value);
        currentSortOrder = sortSelect.value;
        // Determine whether to sort shares or cash assets
        if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
            renderCashCategories(); // Re-render cash categories with new sort order
        } else {
            sortShares(); // Sorts allSharesData and calls renderWatchlist
        }
        await saveSortOrderPreference(currentSortOrder);

        // NEW: Scroll to the top of the page after sorting/rendering
        window.scrollTo({ top: 0, behavior: 'smooth' });
        logDebug('Sort: Scrolled to top after sorting.');
    });
}

    // New Share Button (from sidebar) - Now contextual, handled by updateSidebarAddButtonContext
    // The event listener will be set dynamically by updateSidebarAddButtonContext()
    // No direct event listener here anymore.

    // NEW: Add New Cash Asset Button (from sidebar)
    if (addCashAssetSidebarBtn) {
        addCashAssetSidebarBtn.addEventListener('click', () => {
            logDebug('UI: Add New Cash Asset button (sidebar) clicked.');
            addCashCategoryUI(); // This function now directly opens the modal for adding a new cash asset
            toggleAppSidebar(false);
        });
    }

    // Add Share Header Button (from header) - now contextual, handled by updateAddHeaderButton
    // Its click listener is set dynamically in updateAddHeaderButton()

    // Event listener for shareNameInput to toggle saveShareBtn
    if (shareNameInput && saveShareBtn) {
        shareNameInput.addEventListener('input', () => {
            checkFormDirtyState(); 
        });
    }

    // Save Share Button
    if (saveShareBtn) {
        saveShareBtn.addEventListener('click', async () => {
            logDebug('Share Form: Save Share button clicked.');
            // Call the shared save function, not silent
            saveShareData(false);
        });
    }

    // Delete Share Button
    if (deleteShareBtn) {
        deleteShareBtn.addEventListener('click', async () => {
            logDebug('Share Form: Delete Share button clicked (Direct Delete).');
            if (deleteShareBtn.classList.contains('is-disabled-icon')) {
                console.warn('Delete Share: Delete button was disabled, preventing action.');
                return;
            }
            if (selectedShareDocId) {
                try {
                    const shareDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', selectedShareDocId);
                    await window.firestore.deleteDoc(shareDocRef);
                    showCustomAlert('Share deleted successfully!', 1500);
                    logDebug('Firestore: Share (ID: ' + selectedShareDocId + ') deleted.');
                    closeModals();
                } catch (error) {
                    console.error('Firestore: Error deleting share:', error);
                    showCustomAlert('Error deleting share: ' + error.message);
                }
            } else { showCustomAlert('No share selected for deletion.'); }
        });
    }

    // Edit Share From Detail Button
    if (editShareFromDetailBtn) {
        editShareFromDetailBtn.addEventListener('click', () => {
            logDebug('Share Details: Edit Share button clicked.');
            if (editShareFromDetailBtn.classList.contains('is-disabled-icon')) {
                console.warn('Edit Share From Detail: Edit button was disabled, preventing action.');
                return;
            }
            hideModal(shareDetailModal);
            showEditFormForSelectedShare();
        });
    }

    // Delete Share From Detail Button
    if (deleteShareFromDetailBtn) {
        deleteShareFromDetailBtn.addEventListener('click', async () => {
            logDebug('Share Details: Delete Share button clicked (Direct Delete).');
            if (deleteShareFromDetailBtn.classList.contains('is-disabled-icon')) {
                console.warn('Delete Share From Detail: Delete button was disabled, preventing action.');
                return;
            }
            if (selectedShareDocId) {
                try {
                    const shareDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', selectedShareDocId);
                    await window.firestore.deleteDoc(shareDocRef);
                    showCustomAlert('Share deleted successfully!', 1500);
                    logDebug('Firestore: Share (ID: ' + selectedShareDocId + ') deleted.');
                    closeModals();
                } catch (error) {
                    console.error('Firestore: Error deleting share:', error);
                    showCustomAlert('Error deleting share: ' + error.message);
                }
            } else { showCustomAlert('No share selected for deletion.'); }
        });
    }

    // Context Menu Edit Share Button
    if (contextEditShareBtn) {
        contextEditShareBtn.addEventListener('click', () => {
            logDebug('Context Menu: Edit Share button clicked.');
            if (currentContextMenuShareId) {
                const shareIdToEdit = currentContextMenuShareId;
                hideContextMenu();
                showEditFormForSelectedShare(shareIdToEdit);
            } else {
                console.warn('Context Menu: No share ID found for editing.');
            }
        });
    }

    // Context Menu Delete Share Button
    if (contextDeleteShareBtn) {
        contextDeleteShareBtn.addEventListener('click', async () => {
            logDebug('Context Menu: Delete Share button clicked (Direct Delete).');
            if (currentContextMenuShareId) {
                const shareToDeleteId = currentContextMenuShareId;
                hideContextMenu();
                try {
                    const shareDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', shareToDeleteId);
                    await window.firestore.deleteDoc(shareDocRef);
                    showCustomAlert('Share deleted successfully!', 1500);
                    logDebug('Firestore: Share (ID: ' + shareToDeleteId + ') deleted.');
                } catch (error) {
                    console.error('Firestore: Error deleting share:', error);
                    showCustomAlert('Error deleting share: ' + error.message);
                }
            } else {
                showCustomAlert('No share selected for deletion from context menu.');
                console.warn('Context Menu: No share ID found for deletion.');
            }
        });
    }

    // Add Watchlist Button
    if (addWatchlistBtn) {
        addWatchlistBtn.addEventListener('click', () => {
            logDebug('UI: Add Watchlist button clicked.');
            if (newWatchlistNameInput) newWatchlistNameInput.value = '';
            setIconDisabled(saveWatchlistBtn, true); // Disable save button initially
            logDebug('Add Watchlist: saveWatchlistBtn disabled initially.');
            originalWatchlistData = getCurrentWatchlistFormData(true); // Store initial state for dirty check
            showModal(addWatchlistModal);
            newWatchlistNameInput.focus();
            toggleAppSidebar(false);
            checkWatchlistFormDirtyState(true); // Check dirty state immediately after opening
        });
    }

    // Event listener for newWatchlistNameInput to toggle saveWatchlistBtn (for Add Watchlist Modal)
    if (newWatchlistNameInput && saveWatchlistBtn) {
        newWatchlistNameInput.addEventListener('input', () => {
            checkWatchlistFormDirtyState(true);
        });
    }

    // Save Watchlist Button (for Add Watchlist Modal)
    if (saveWatchlistBtn) {
        saveWatchlistBtn.addEventListener('click', async () => {
            logDebug('Watchlist Form: Save Watchlist button clicked.');
            if (saveWatchlistBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert('Please enter a watchlist name.');
                console.warn('Save Watchlist: Save button was disabled, preventing action.');
                return;
            }
            const watchlistName = newWatchlistNameInput.value.trim();
            await saveWatchlistChanges(false, watchlistName); // false indicates not silent
        });
    }

    // Edit Watchlist Button
    if (editWatchlistBtn) {
        editWatchlistBtn.addEventListener('click', () => {
            logDebug('UI: Edit Watchlist button clicked.');
            let watchlistToEditId = watchlistSelect.value;

            // Prevent editing "All Shares" or "Cash & Assets"
            if (watchlistToEditId === ALL_SHARES_ID || watchlistToEditId === CASH_BANK_WATCHLIST_ID) {
                showCustomAlert('Cannot edit this special watchlist.', 2000);
                return;
            }

            if (!watchlistToEditId || !userWatchlists.some(w => w.id === watchlistToEditId)) {
                showCustomAlert('Please select a watchlist to edit.');
                return;
            }
            const selectedWatchlistObj = userWatchlists.find(w => w.id === watchlistToEditId);
            const watchlistToEditName = selectedWatchlistObj ? selectedWatchlistObj.name : '';

            logDebug('Edit Watchlist Button Click: Watchlist to edit ID: ' + watchlistToEditId + ', Name: ' + watchlistToEditName);

            editWatchlistNameInput.value = watchlistToEditName;
            // Keep at least one real watchlist + Cash & Assets
            const actualWatchlists = userWatchlists.filter(wl => wl.id !== ALL_SHARES_ID && wl.id !== CASH_BANK_WATCHLIST_ID);
            const isDisabledDelete = actualWatchlists.length <= 1; 
            setIconDisabled(deleteWatchlistInModalBtn, isDisabledDelete); 
            logDebug('Edit Watchlist: deleteWatchlistInModalBtn disabled: ' + isDisabledDelete);
            setIconDisabled(saveWatchlistNameBtn, true); // Disable save button initially
            logDebug('Edit Watchlist: saveWatchlistNameBtn disabled initially.');
            originalWatchlistData = getCurrentWatchlistFormData(false); // Store initial state for dirty check
            showModal(manageWatchlistModal);
            editWatchlistNameInput.focus();
            toggleAppSidebar(false);
            checkWatchlistFormDirtyState(false); // Check dirty state immediately after opening
        });
    }

    // Event listener for editWatchlistNameInput to toggle saveWatchlistNameBtn
    if (editWatchlistNameInput && saveWatchlistNameBtn) {
        editWatchlistNameInput.addEventListener('input', () => {
            checkWatchlistFormDirtyState(false);
        });
    }

    // Save Watchlist Name Button (for Manage Watchlist Modal)
    if (saveWatchlistNameBtn) {
        saveWatchlistNameBtn.addEventListener('click', async () => {
            logDebug('Manage Watchlist Form: Save Watchlist Name button clicked.');
            if (saveWatchlistNameBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert('Watchlist name cannot be empty or unchanged.');
                console.warn('Save Watchlist Name: Save button was disabled, preventing action.');
                return;
            }
            const newName = editWatchlistNameInput.value.trim();
            const watchlistToEditId = watchlistSelect.value;
            await saveWatchlistChanges(false, newName, watchlistToEditId); // false indicates not silent
        });
    }

    // Delete Watchlist In Modal Button (for Manage Watchlist Modal)
    if (deleteWatchlistInModalBtn) {
        deleteWatchlistInModalBtn.addEventListener('click', async () => {
            logDebug('Manage Watchlist Form: Delete Watchlist button clicked (Direct Delete).');
            if (deleteWatchlistInModalBtn.classList.contains('is-disabled-icon')) {
                console.warn('Delete Watchlist In Modal: Delete button was disabled, preventing action.');
                return;
            }

            let watchlistToDeleteId = watchlistSelect.value;

            // Prevent deleting "All Shares" or "Cash & Assets"
            if (watchlistToDeleteId === ALL_SHARES_ID || watchlistToDeleteId === CASH_BANK_WATCHLIST_ID) {
                showCustomAlert('Cannot delete this special watchlist.', 2000);
                return;
            }

            // Ensure at least one actual watchlist remains (excluding Cash & Assets)
            const actualWatchlists = userWatchlists.filter(wl => wl.id !== ALL_SHARES_ID && wl.id !== CASH_BANK_WATCHLIST_ID);
            if (actualWatchlists.length <= 1) {
                showCustomAlert('Cannot delete the last stock watchlist. Please create another stock watchlist first.', 3000);
                return;
            }

            const watchlistToDeleteName = userWatchlists.find(w => w.id === watchlistToDeleteId)?.name || 'Unknown Watchlist';
            
            try {
                const sharesColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
                const q = window.firestore.query(sharesColRef, window.firestore.where('watchlistId', '==', watchlistToDeleteId));
                const querySnapshot = await window.firestore.getDocs(q);

                const batch = window.firestore.writeBatch(db);
                querySnapshot.forEach(doc => {
                    const shareRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares', doc.id);
                    batch.delete(shareRef);
                });
                await batch.commit();
                logDebug('Firestore: Deleted ' + querySnapshot.docs.length + ' shares from watchlist \'' + watchlistToDeleteName + '\'.');

                const watchlistDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists', watchlistToDeleteId);
                await window.firestore.deleteDoc(watchlistDocRef);
                logDebug('Firestore: Watchlist \'' + watchlistToDeleteName + '\' (ID: ' + watchlistToDeleteId + ') deleted.');

                showCustomAlert('Watchlist \'' + watchlistToDeleteName + '\' and its shares deleted successfully!', 2000);
                closeModals();

                // After deleting a watchlist, switch the current view to "All Shares"
                currentSelectedWatchlistIds = [ALL_SHARES_ID];
                await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds); // Save this preference

                await loadUserWatchlistsAndSettings(); // This will re-render everything correctly
            } catch (error) {
                console.error('Firestore: Error deleting watchlist:', error);
                showCustomAlert('Error deleting watchlist: ' + error.message);
            }
        });
    }

    // Dividend Calculator Button
    if (dividendCalcBtn) {
        dividendCalcBtn.addEventListener('click', () => {
            logDebug('UI: Dividend button clicked. Attempting to open modal.');
            // Corrected references to use unique IDs for dividend calculator inputs
            if (calcDividendAmountInput) calcDividendAmountInput.value = ''; 
            if (calcCurrentPriceInput) calcCurrentPriceInput.value = ''; 
            if (calcFrankingCreditsInput) calcFrankingCreditsInput.value = ''; 
            if (calcUnfrankedYieldSpan) calcUnfrankedYieldSpan.textContent = '-'; 
            if (calcFrankedYieldSpan) calcFrankedYieldSpan.textContent = '-'; 
            if (calcEstimatedDividend) calcEstimatedDividend.textContent = '-'; 
            if (investmentValueSelect) investmentValueSelect.value = '10000'; // Reset dropdown
            showModal(dividendCalculatorModal);
            if (calcCurrentPriceInput) calcCurrentPriceInput.focus(); 
            logDebug('UI: Dividend Calculator modal opened.');
            toggleAppSidebar(false);
        });
    }

    // Dividend Calculator Input Listeners
    [calcDividendAmountInput, calcCurrentPriceInput, calcFrankingCreditsInput, investmentValueSelect].forEach(input => {
        if (input) {
            input.addEventListener('input', updateDividendCalculations);
            input.addEventListener('change', updateDividendCalculations);
        }
    });

    function updateDividendCalculations() {
        const currentPrice = parseFloat(calcCurrentPriceInput.value);
        const dividendAmount = parseFloat(calcDividendAmountInput.value);
        const frankingCredits = parseFloat(calcFrankingCreditsInput.value);
        const investmentValue = parseFloat(investmentValueSelect.value);
        
        const unfrankedYield = calculateUnfrankedYield(dividendAmount, currentPrice);
        const frankedYield = calculateFrankedYield(dividendAmount, currentPrice, frankingCredits);
        const estimatedDividend = estimateDividendIncome(investmentValue, dividendAmount, currentPrice);
        
        calcUnfrankedYieldSpan.textContent = unfrankedYield !== null ? unfrankedYield.toFixed(2) + '%' : '-';
        calcFrankedYieldSpan.textContent = frankedYield !== null ? frankedYield.toFixed(2) + '%' : '-';
        calcEstimatedDividend.textContent = estimatedDividend !== null ? '$' + estimatedDividend.toFixed(2) : '-';
    }

    // Standard Calculator Button
    if (standardCalcBtn) {
        standardCalcBtn.addEventListener('click', () => {
            logDebug('UI: Standard Calculator button clicked.');
            resetCalculator();
            showModal(calculatorModal);
            logDebug('UI: Standard Calculator modal opened.');
            toggleAppSidebar(false);
        });
    }

    // Calculator Buttons
    if (calculatorButtons) {
        calculatorButtons.addEventListener('click', (event) => {
            const target = event.target;
            if (!target.classList.contains('calc-btn') || target.classList.contains('is-disabled-icon')) { return; }
            const value = target.dataset.value;
            const action = target.dataset.action;
            if (value) { appendNumber(value); }
            else if (action) { handleAction(action); }
        });
    }

    function appendNumber(num) {
        if (resultDisplayed) { currentCalculatorInput = num; resultDisplayed = false; }
        else { if (num === '.' && currentCalculatorInput.includes('.')) return; currentCalculatorInput += num; }
        updateCalculatorDisplay();
    }

    function handleAction(action) {
        if (action === 'clear') { resetCalculator(); return; }
        if (action === 'percentage') { 
            if (currentCalculatorInput === '' && previousCalculatorInput === '') return;
            let val;
            if (currentCalculatorInput !== '') {
                val = parseFloat(currentCalculatorInput);
            } else if (previousCalculatorInput !== '') {
                val = parseFloat(previousCalculatorInput);
            } else {
                return;
            }

            if (isNaN(val)) return;

            if (operator && previousCalculatorInput !== '') {
                const prevNum = parseFloat(previousCalculatorInput);
                if (isNaN(prevNum)) return;
                currentCalculatorInput = (prevNum * (val / 100)).toString();
            } else {
                currentCalculatorInput = (val / 100).toString();
            }
            resultDisplayed = false;
            updateCalculatorDisplay();
            return; 
        }
        if (['add', 'subtract', 'multiply', 'divide'].includes(action)) {
            if (currentCalculatorInput === '' && previousCalculatorInput === '') return;
            if (currentCalculatorInput !== '') {
                if (previousCalculatorInput !== '') { calculateResult(); previousCalculatorInput = calculatorResult.textContent; }
                else { previousCalculatorInput = currentCalculatorInput; }
            }
            operator = action; currentCalculatorInput = ''; resultDisplayed = false; updateCalculatorDisplay(); return;
        }
        if (action === 'calculate') {
            if (previousCalculatorInput === '' || currentCalculatorInput === '' || operator === null) { return; }
            calculateResult(); operator = null; resultDisplayed = true;
        }
    }

    // Theme Toggle Button (Random Selection)
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            logDebug('Theme Debug: Random Theme Toggle button clicked.');
            if (CUSTOM_THEMES.length > 0) {
                let randomIndex;
                let newThemeName;
                do {
                    randomIndex = Math.floor(Math.random() * CUSTOM_THEMES.length);
                    newThemeName = CUSTOM_THEMES[randomIndex];
                } while (newThemeName === currentActiveTheme && CUSTOM_THEMES.length > 1); // Ensure a different theme if possible

                logDebug('Theme Debug: Selected random nextThemeName: ' + newThemeName);
                applyTheme(newThemeName);
            } else {
                logDebug('Theme Debug: No custom themes defined. Defaulting to system-default.');
                applyTheme('system-default'); // Fallback if no custom themes defined
            }
        });
    }

    // Color Theme Select Dropdown
    if (colorThemeSelect) {
        colorThemeSelect.addEventListener('change', (event) => {
            logDebug('Theme: Color theme select changed to: ' + event.target.value);
            const selectedTheme = event.target.value;
            // If "No Custom Theme" is selected, apply system-default
            if (selectedTheme === 'none') {
                applyTheme('system-default');
            } else {
                applyTheme(selectedTheme);
            }
        });
    }

    // Revert to Default Theme Button (Toggle Light/Dark)
    if (revertToDefaultThemeBtn) {
        revertToDefaultThemeBtn.addEventListener('click', async (event) => {
            logDebug('Theme Debug: Revert to Default Theme button clicked (now toggling Light/Dark).');
            event.preventDefault(); // Prevent default button behavior

            const body = document.body;
            let targetTheme;

            // Remove all custom theme classes and the data-theme attribute
            body.className = body.className.split(' ').filter(c => !c.startsWith('theme-')).join(' ');
            body.removeAttribute('data-theme');
            localStorage.removeItem('selectedTheme'); // Clear custom theme preference

            // Determine target theme based on current state (only considering light/dark classes)
            if (currentActiveTheme === 'light') {
                targetTheme = 'dark';
                body.classList.add('dark-theme');
                logDebug('Theme: Toggled from Light to Dark theme.');
            } else if (currentActiveTheme === 'dark') {
                targetTheme = 'light';
                body.classList.remove('dark-theme');
                logDebug('Theme: Toggled from Dark to Light theme.');
            } else { // This handles the very first click, or when currentActiveTheme is 'system-default' or any custom theme
                const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (systemPrefersDark) {
                    targetTheme = 'light';
                    body.classList.remove('dark-theme');
                    logDebug('Theme: First click from system-default/custom: Toggled from System Dark to Light.');
                } else {
                    targetTheme = 'dark';
                    body.classList.add('dark-theme');
                    logDebug('Theme: First click from system-default/custom: Toggled from System Light to Dark.');
                }
            }
            
            currentActiveTheme = targetTheme; // Update global tracking variable
            localStorage.setItem('theme', targetTheme); // Save preference for light/dark
            
            // Save preference to Firestore
            if (currentUserId && db && window.firestore) {
                const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');
                try {
                    await window.firestore.setDoc(userProfileDocRef, { lastTheme: targetTheme }, { merge: true });
                    logDebug('Theme: Saved explicit Light/Dark theme preference to Firestore: ' + targetTheme);
                } catch (error) { // Added missing catch block
                    console.error('Theme: Error saving explicit Light/Dark theme preference to Firestore:', error);
                }
            }
            updateThemeToggleAndSelector(); // Update dropdown (it should now show "No Custom Theme")
        });
    }

    // System Dark Mode Preference Listener (Keep this as is)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (currentActiveTheme === 'system-default') {
            if (event.matches) {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
            logDebug('Theme: System theme preference changed and applied (system-default mode).');
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
        if (window.innerWidth > 768) {
            scrollToTopBtn.style.display = 'none';
        } else {
            window.dispatchEvent(new Event('scroll'));
        }
        scrollToTopBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); logDebug('UI: Scrolled to top.'); });
    }

    // Hamburger Menu and Sidebar Interactions
    if (hamburgerBtn && appSidebar && closeMenuBtn && sidebarOverlay) {
        logDebug('Sidebar Setup: Initializing sidebar event listeners. Elements found:', {
            hamburgerBtn: !!hamburgerBtn,
            appSidebar: !!appSidebar,
            closeMenuBtn: !!closeMenuBtn,
            sidebarOverlay: !!sidebarOverlay
        });
        hamburgerBtn.addEventListener('click', (event) => {
            logDebug('UI: Hamburger button CLICKED. Event:', event);
            event.stopPropagation();
            toggleAppSidebar();
        });
        closeMenuBtn.addEventListener('click', () => {
            logDebug('UI: Close Menu button CLICKED.');
            toggleAppSidebar(false);
        });
        
        // Corrected sidebar overlay dismissal logic for mobile
        sidebarOverlay.addEventListener('click', (event) => {
            logDebug('Sidebar Overlay: Clicked overlay. Attempting to close sidebar.');
            // Ensure the click is actually on the overlay and not bubbling from inside the sidebar
            if (appSidebar.classList.contains('open') && event.target === sidebarOverlay) {
                toggleAppSidebar(false);
            }
        });

        document.addEventListener('click', (event) => {
            const isDesktop = window.innerWidth > 768;
            // Only close sidebar on clicks outside if it's desktop and the click isn't on the sidebar or hamburger button
            if (appSidebar.classList.contains('open') && isDesktop &&
                !appSidebar.contains(event.target) && !hamburgerBtn.contains(event.target)) {
                logDebug('Global Click: Clicked outside sidebar on desktop. Closing sidebar.');
                toggleAppSidebar(false);
            }
            // For mobile, the sidebarOverlay handles clicks outside, and its pointer-events are managed.
            // No additional document click listener needed for mobile sidebar dismissal.
        });

        window.addEventListener('resize', () => {
            logDebug('Window Resize: Resizing window. Closing sidebar if open.');
            const isDesktop = window.innerWidth > 768;
            if (appSidebar.classList.contains('open')) {
                toggleAppSidebar(false);
            }
            if (scrollToTopBtn) {
                if (window.innerWidth > 768) {
                    scrollToTopBtn.style.display = 'none';
                } else {
                    window.dispatchEvent(new Event('scroll'));
                }
            }
            // NEW: Recalculate header height on resize
            adjustMainContentPadding();
        });

        const menuButtons = appSidebar.querySelectorAll('.menu-button-item');
        menuButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                logDebug('Sidebar Menu Item Click: Button \'' + event.currentTarget.textContent.trim() + '\' clicked.');
                const closesMenu = event.currentTarget.dataset.actionClosesMenu !== 'false';
                if (closesMenu) {
                    toggleAppSidebar(false);
                }
            });
        });
    } else {
        console.warn('Sidebar Setup: Missing one or more sidebar elements (hamburgerBtn, appSidebar, closeMenuBtn, sidebarOverlay). Sidebar functionality might be impaired.');
    }

    // Export Watchlist Button Event Listener
    if (exportWatchlistBtn) {
        exportWatchlistBtn.addEventListener('click', () => {
            logDebug('UI: Export Watchlist button clicked.');
            exportWatchlistToCSV();
            toggleAppSidebar(false);
        });
    }

    // Refresh Live Prices Button Event Listener
    if (refreshLivePricesBtn) {
        refreshLivePricesBtn.addEventListener('click', () => {
            logDebug('UI: Refresh Live Prices button clicked.');
            fetchLivePrices();
            showCustomAlert('Refreshing live prices...', 1000);
            toggleAppSidebar(false); // NEW: Close sidebar on refresh
        });
    }

    // NEW: Toggle Compact View Button Listener
    if (toggleCompactViewBtn) {
        // DEBUG: Log that the event listener is being attached
        logDebug('DEBUG: Attaching click listener to toggleCompactViewBtn.');
        toggleCompactViewBtn.addEventListener('click', () => {
            logDebug('UI: Toggle Compact View button clicked.');
            toggleMobileViewMode();
            toggleAppSidebar(false); // Close sidebar after action
        });
    }

    // NEW: Search Stock Button Listener
    if (searchStockBtn) {
        searchStockBtn.addEventListener('click', () => {
            logDebug('UI: Search Stock button clicked. Opening search modal.');
            // Clear and reset the modal content when opening
            asxSearchInput.value = '';
            searchResultDisplay.innerHTML = '<p class="initial-message">Start typing an ASX code to search.</p>';
            searchModalActionButtons.innerHTML = '';
            asxSuggestions.classList.remove('active');
            currentSelectedSuggestionIndex = -1;
            currentSearchShareData = null;
            showModal(stockSearchModal);
            asxSearchInput.focus();
            toggleAppSidebar(false); // Close sidebar
        });
    }
    
    // NEW: Show Last Live Price Toggle Listener
if (showLastLivePriceToggle) {
    showLastLivePriceToggle.addEventListener('change', async (event) => {
        showLastLivePriceOnClosedMarket = event.target.checked;
        logDebug('Toggle: "Show Last Live Price" toggled to: ' + showLastLivePriceOnClosedMarket);
    // Event listeners for new target price input and type buttons
    if (targetValueInput) {
        targetValueInput.addEventListener('input', updateTargetCalculationDisplay);
        targetValueInput.addEventListener('change', updateTargetCalculationDisplay); // Listen for change to catch blur
    }

    if (targetTypeDollarBtn) {
        targetTypeDollarBtn.addEventListener('click', () => {
            if (!targetTypeDollarBtn.classList.contains('active')) {
                targetTypeDollarBtn.classList.add('active');
                targetTypePercentBtn.classList.remove('active');
                updateTargetCalculationDisplay();
                checkFormDirtyState(); // Check dirty state when toggle changes
            }
        });
    }

    if (targetTypePercentBtn) {
        targetTypePercentBtn.addEventListener('click', () => {
            if (!targetTypePercentBtn.classList.contains('active')) {
                targetTypePercentBtn.classList.add('active');
                targetTypeDollarBtn.classList.remove('active');
                updateTargetCalculationDisplay();
                checkFormDirtyState(); // Check dirty state when toggle changes
            }
        });
    }

    if (targetTypeDollarBtn) targetTypeDollarBtn.addEventListener('click', () => {
        targetTypeDollarBtn.classList.add('active');
        targetTypePercentBtn.classList.remove('active');
        updateTargetCalculationDisplay();
    });
    if (targetTypePercentBtn) targetTypePercentBtn.addEventListener('click', () => {
        targetTypePercentBtn.classList.add('active');
        targetTypeDollarBtn.classList.remove('active');
        updateTargetCalculationDisplay();
    });

    // Event listeners for the Active Alerts Modal
    if (targetHitIconBtn) targetHitIconBtn.addEventListener('click', openActiveAlertsModal);

    // Correctly handle the close button for the active alerts modal
    if (alertsCloseButton) { // Use the direct reference 'alertsCloseButton'
        // Remove any previous listeners to prevent duplicates
        alertsCloseButton.removeEventListener('click', closeModals); // Remove global close if present
        alertsCloseButton.removeEventListener('click', closeActiveAlertsModal); // Remove previous specific close
        alertsCloseButton.addEventListener('click', closeActiveAlertsModal); // Add correct specific close
    }

    if (minimizeAlertsModalBtn) {
        minimizeAlertsModalBtn.removeEventListener('click', closeActiveAlertsModal); // Remove previous
        minimizeAlertsModalBtn.addEventListener('click', closeActiveAlertsModal); // Re-add to ensure it's active
    }
    if (dismissAllAlertsBtn) {
        dismissAllAlertsBtn.removeEventListener('click', dismissAllActiveAlerts); // Remove previous
        dismissAllAlertsBtn.addEventListener('click', dismissAllActiveAlerts); // Re-add to ensure it's active
    }
    // Click outside alerts modal to minimize it
    if (activeAlertsModal) {
        activeAlertsModal.addEventListener('click', (event) => {
            const modalContent = activeAlertsModal.querySelector('.modal-content');
            // Ensure click is on the backdrop, not bubbling from inside the modal content
            if (modalContent && !modalContent.contains(event.target) && event.target === activeAlertsModal) {
                closeActiveAlertsModal();
            }
        });
    }

        // Save preference to Firestore
        if (currentUserId && db && window.firestore) {
            const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');
            try {
                await window.firestore.setDoc(userProfileDocRef, { showLastLivePriceOnClosedMarket: showLastLivePriceOnClosedMarket }, { merge: true });
                logDebug('Toggle: Saved "Show Last Live Price" preference to Firestore: ' + showLastLivePriceOnClosedMarket);
            } catch (error) {
                console.error('Toggle: Error saving "Show Last Live Price" preference to Firestore:', error);
                showCustomAlert('Error saving preference: ' + error.message);
            }
        }
        renderWatchlist(); // Re-render to apply the new display logic immediately
        showCustomAlert('Last Price Display set to: ' + (showLastLivePriceOnClosedMarket ? 'On (Market Closed)' : 'Off (Market Closed)'), 1500);
        toggleAppSidebar(false); // Close sidebar after action
    });
}

    // NEW: Cash Asset Form Modal Save/Delete/Edit Buttons (2.1, 2.2)
    if (saveCashAssetBtn) {
        saveCashAssetBtn.addEventListener('click', async () => {
            logDebug('Cash Form: Save Cash Asset button clicked.');
            if (saveCashAssetBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert('Asset name and balance are required, or no changes made.');
                console.warn('Save Cash Asset: Save button was disabled, preventing action.');
                return;
            }
            await saveCashAsset(false); // Not silent save
        });
    }

    if (deleteCashAssetBtn) {
        deleteCashAssetBtn.addEventListener('click', async () => {
            logDebug('Cash Form: Delete Cash Asset button clicked.');
            if (deleteCashAssetBtn.classList.contains('is-disabled-icon')) {
                console.warn('Delete Cash Asset: Delete button was disabled, preventing action.');
                return;
            }
            if (selectedCashAssetDocId) {
                await deleteCashCategory(selectedCashAssetDocId); // Use existing delete function
                closeModals();
            } else {
                showCustomAlert('No cash asset selected for deletion.');
            }
        });
    }

    if (editCashAssetFromDetailBtn) {
        editCashAssetFromDetailBtn.addEventListener('click', () => {
            logDebug('Cash Details: Edit Cash Asset button clicked.');
            if (selectedCashAssetDocId) {
                hideModal(cashAssetDetailModal);
                showAddEditCashCategoryModal(selectedCashAssetDocId);
            } else {
                showCustomAlert('No cash asset selected for editing.');
            }
        });
    }

    if (deleteCashAssetFromDetailBtn) {
        deleteCashAssetFromDetailBtn.addEventListener('click', async () => {
            logDebug('Cash Details: Delete Cash Asset button clicked.');
            if (selectedCashAssetDocId) {
                await deleteCashCategory(selectedCashAssetDocId);
                closeModals();
            } else {
                showCustomAlert('No cash asset selected for deletion.');
            }
        });
    }


    // Call adjustMainContentPadding initially and on window load/resize
    // Removed: window.addEventListener('load', adjustMainContentPadding); // Removed, handled by onAuthStateChanged
    // Already added to window.addEventListener('resize') in sidebar section
}

document.addEventListener('DOMContentLoaded', function() {
    logDebug('script.js DOMContentLoaded fired.');

    // NEW: Initialize splash screen related flags
    window._firebaseInitialized = false;
    window._userAuthenticated = false;
    window._appDataLoaded = false;
    window._livePricesLoaded = false;

    // Show splash screen immediately on DOMContentLoaded
    if (splashScreen) {
        splashScreen.style.display = 'flex'; // Ensure it's visible
        splashScreen.classList.remove('hidden'); // Ensure it's not hidden
        splashScreenReady = true; // Mark splash screen as ready
        document.body.style.overflow = 'hidden'; // Prevent scrolling of underlying content
        logDebug('Splash Screen: Displayed on DOMContentLoaded, body overflow hidden.');
    } else {
        console.warn('Splash Screen: Splash screen element not found. App will start without it.');
        // If splash screen isn't found, assume everything is "loaded" to proceed
        window._firebaseInitialized = true;
        window._userAuthenticated = false; // Will be set by onAuthStateChanged
        window._appDataLoaded = true;
        window._livePricesLoaded = true;
    }

    // Initially hide main app content and header
    if (mainContainer) {
        mainContainer.classList.add('app-hidden');
    }
    if (appHeader) {
        appHeader.classList.add('app-hidden');
    }


    if (window.firestoreDb && window.firebaseAuth && window.getFirebaseAppId && window.firestore && window.authFunctions) {
        db = window.firestoreDb;
        auth = window.firebaseAuth;
        currentAppId = window.getFirebaseAppId();
        window._firebaseInitialized = true; // Mark Firebase as initialized
        logDebug('Firebase Ready: DB, Auth, and AppId assigned from window. Setting up auth state listener.');
        
        window.authFunctions.onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                logDebug('AuthState: User signed in: ' + user.uid);
                logDebug('AuthState: User email: ' + user.email);
                // Always set the main title to "ASX Tracker" regardless of user email
            mainTitle.textContent = 'ASX Tracker';
            logDebug('AuthState: Main title set to ASX Tracker.');
                updateMainButtonsState(true);
                window._userAuthenticated = true; // Mark user as authenticated
                
                // Show main app content and header here
                if (mainContainer) {
                    mainContainer.classList.remove('app-hidden');
                }
                if (appHeader) {
                    appHeader.classList.remove('app-hidden');
                }
                // Adjust padding immediately after showing header
                adjustMainContentPadding();

                // Start pulsing animation on icon after successful sign-in
                if (splashKangarooIcon) {
                    splashKangarooIcon.classList.add('pulsing');
                    logDebug('Splash Screen: Started pulsing animation after sign-in.');
                }
                
                // On successful login, clear the session dismissal for alerts to re-evaluate all
                dismissedAlertsSession.clear();

                // Load data and then hide splash screen
                await loadUserWatchlistsAndSettings(); // This now sets _appDataLoaded and calls hideSplashScreenIfReady
                await fetchLivePrices(); // Ensure live prices are fetched after settings and current watchlist are loaded
                // NEW: Load ASX codes for autocomplete
                allAsxCodes = await loadAsxCodesFromCSV();
                logDebug(`ASX Autocomplete: Loaded ${allAsxCodes.length} codes for search.`);

                // Removed: startLivePriceUpdates(); // This is now called by renderWatchlist based on selected type
                
            } else {
                currentUserId = null;
                mainTitle.textContent = 'Share Watchlist';
                logDebug('AuthState: User signed out.');
                updateMainButtonsState(false);
                clearShareList();
                clearWatchlistUI();
                userCashCategories = []; // Clear cash data on logout
                if (cashCategoriesContainer) cashCategoriesContainer.innerHTML = ''; // Clear cash UI
                if (totalCashDisplay) totalCashDisplay.textContent = '$0.00'; // Reset total cash
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                applyTheme('system-default');
                if (unsubscribeShares) {
                    unsubscribeShares();
                    unsubscribeShares = null;
                    logDebug('Firestore Listener: Unsubscribed from shares listener on logout.');
                }
                if (unsubscribeCashCategories) { // NEW: Unsubscribe from cash categories
                    unsubscribeCashCategories();
                    unsubscribeCashCategories = null;
                    logDebug('Firestore Listener: Unsubscribed from cash categories listener on logout.');
                }
                stopLivePriceUpdates();
                
                window._userAuthenticated = false; // Mark user as not authenticated
                // If signed out, ensure splash screen is visible for sign-in
                if (splashScreen) {
                    splashScreen.style.display = 'flex'; // Ensure splash screen is visible
                    splashScreen.classList.remove('hidden'); // Ensure it's not hidden
                    document.body.style.overflow = 'hidden'; // Re-apply overflow hidden
                    if (splashKangarooIcon) {
                        splashKangarooIcon.classList.remove('pulsing'); // Stop animation if signed out
                    }
                    if (splashSignInBtn) {
                        splashSignInBtn.disabled = false; // Enable sign-in button
                        splashSignInBtn.textContent = 'Google Sign In'; // Reset button text
                    }
                    // Hide main app content
                    if (mainContainer) {
                        mainContainer.classList.add('app-hidden');
                    }
                    if (appHeader) {
                        appHeader.classList.add('app-hidden');
                    }
                    logDebug('Splash Screen: User signed out, splash screen remains visible for sign-in.');
                } else {
                    console.warn('Splash Screen: User signed out, but splash screen element not found. App content might be visible.');
                }
                // NEW: Reset targetHitIconDismissed and clear localStorage entry on logout for a fresh start on next login
                targetHitIconDismissed = false; 
                localStorage.removeItem('targetHitIconDismissed');

            }
            if (!window._appLogicInitialized) {
                initializeAppLogic();
                window._appLogicInitialized = true;
            } else {
                // If app logic already initialized, ensure view mode is applied after auth.
                // This handles cases where user signs out and then signs back in,
                // and we need to re-apply the correct mobile view class.
                if (currentMobileViewMode === 'compact' && mobileShareCardsContainer) {
                    mobileShareCardsContainer.classList.add('compact-view');
                } else if (mobileShareCardsContainer) {
                    mobileShareCardsContainer.classList.remove('compact-view');
                }
            }
            // Call renderWatchlist here to ensure correct mobile card rendering after auth state is set
            renderWatchlist();
            // Removed: adjustMainContentPadding(); // Removed duplicate call, now handled inside if (user) block
        });
    } else {
        console.error('Firebase: Firebase objects (db, auth, appId, firestore, authFunctions) are not available on DOMContentLoaded. Firebase initialization likely failed in index.html.');
        const errorDiv = document.getElementById('firebaseInitError');
        if (errorDiv) {
                errorDiv.style.display = 'block';
        }
        updateMainButtonsState(false);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        applyTheme('system-default');
        // NEW: Call adjustMainContentPadding even if Firebase fails, to ensure some basic layout
        adjustMainContentPadding();
        // NEW: Hide splash screen if Firebase fails to initialize
        hideSplashScreen();
    }
});
