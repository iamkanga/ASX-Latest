// This script interacts with Firebase Firestore for data storage.
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
const targetTypeDollar = document.getElementById('targetTypeDollar'); // Reference to the hidden radio input for Dollar
const targetTypePercent = document.getElementById('targetTypePercent'); // Reference to the hidden radio input for Percent
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

    // First, clear form and deselect current items
    resetCalculator();
    deselectCurrentShare();
    deselectCurrentCashAsset();
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); autoDismissTimeout = null; }
    hideContextMenu();

    // Explicitly hide each *type* of modal if it's currently open
    // This allows modals with complex transitions (like activeAlertsModal) to manage their own hiding process
    if (shareFormSection.style.display !== 'none') hideModal(shareFormSection);
    if (dividendCalculatorModal.style.display !== 'none') hideModal(dividendCalculatorModal);
    if (shareDetailModal.style.display !== 'none') hideModal(shareDetailModal);
    if (addWatchlistModal.style.display !== 'none') hideModal(addWatchlistModal);
    if (manageWatchlistModal.style.display !== 'none') hideModal(manageWatchlistModal);
    if (customDialogModal.style.display !== 'none') hideModal(customDialogModal);
    if (calculatorModal.style.display !== 'none') hideModal(calculatorModal);
    if (cashAssetFormModal.style.display !== 'none') hideModal(cashAssetFormModal);
    if (cashAssetDetailModal.style.display !== 'none') hideModal(cashAssetDetailModal);
    if (stockSearchModal.style.display !== 'none') hideModal(stockSearchModal);

    // activeAlertsModal has its own close function with transition
    if (activeAlertsModalOpen) closeActiveAlertsModal(); // Call its specific close function if open
    
    logDebug('Modal: All modals closed.');
}

// Custom Dialog (Alert) Function
// Allows for a duration or a custom button type (e.g., 'OK')
function showCustomAlert(message, durationOrButtonType = 1000, callback = null, buttonText = 'OK') {
    const confirmBtn = document.getElementById('customDialogConfirmBtn');
    const cancelBtn = document.getElementById('customDialogCancelBtn');
    const dialogButtonsContainer = document.querySelector('#customDialogModal .custom-dialog-buttons');

    if (!customDialogModal || !customDialogMessage || !confirmBtn || !cancelBtn || !dialogButtonsContainer) {
        console.error('Custom dialog elements not found. Cannot show alert.');
        console.log('ALERT (fallback): ' + message);
        return;
    }

    customDialogMessage.textContent = message;

    // Ensure buttons are visible for custom button types, hidden for auto-dismiss
    dialogButtonsContainer.style.display = 'flex'; // Default to flex
    confirmBtn.style.display = 'inline-flex'; // Show confirm button
    cancelBtn.style.display = 'none'; // Hide cancel button by default for alerts

    confirmBtn.textContent = buttonText; // Set custom button text (e.g., "OK")
    setIconDisabled(confirmBtn, false); // Ensure confirm button is enabled

    // Remove any previous listeners
    const oldConfirmListener = confirmBtn._currentClickListener;
    if (oldConfirmListener) {
        confirmBtn.removeEventListener('click', oldConfirmListener);
    }

    const onClose = () => {
        hideModal(customDialogModal);
        if (callback) {
            callback();
        }
        logDebug('Alert: Custom alert closed.');
    };

    confirmBtn.addEventListener('click', onClose);
    confirmBtn._currentClickListener = onClose; // Store reference

    showModal(customDialogModal);
    logDebug('Alert: Showing alert: "' + message + '"');

    // Handle auto-dismissal
    if (typeof durationOrButtonType === 'number' && durationOrButtonType > 0) {
        if (autoDismissTimeout) {
            clearTimeout(autoDismissTimeout);
        }
        autoDismissTimeout = setTimeout(() => {
            hideModal(customDialogModal);
            autoDismissTimeout = null;
        }, durationOrButtonType);
    } else {
        // If duration is not a number, or it's a string (like 'OK'), no auto-dismiss
        if (autoDismissTimeout) {
            clearTimeout(autoDismissTimeout);
            autoDismissTimeout = null;
        }
    }
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
                    const change = currentLivePrice - previousPrice; // Corrected variable name
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
    // Use the new `targetTypeDollar` and `targetTypePercent` references (which are for the radio inputs)
    if (targetTypeDollar && targetTypePercent) {
        // Set the 'checked' property of the hidden radio inputs directly
        if (shareToEdit.targetType === '%') {
            targetTypePercent.checked = true;
            targetTypeDollar.checked = false;
        } else { // Default to '$' if targetType is not '%' or is undefined/null
            targetTypeDollar.checked = true;
            targetTypePercent.checked = false;
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
        targetType: targetTypePercent.checked ? '%' : '$', // Capture type from CHECKED state of radio
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
    // These fields are compared in the loop below. targetValue and targetType are compared separately.

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
    const targetType = targetTypePercent.checked ? '%' : '$'; // Capture type from CHECKED state of radio
    
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
            explanation = `Entered ${formatCurrency(enteredPrice)} ${sign}${absTargetValue}% = ${formatCurrency(share.calculatedTargetPrice)}`;
        } else { // Dollar amount
            explanation = `Set at ${formatCurrency(share.calculatedTargetPrice)}`;
        }
        targetPriceDisplay = `${formatCurrency(share.calculatedTargetPrice)} (${explanation})`; // Format: Price (Explanation)
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
            { value: 'dividendAmount-asc', text: 'Dividend Yield % (Low-High)' }, // Changed text
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
                optionElement.selected = (opt.value === currentSortOrder); // Pre-select current sort order
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
            // Get the live price data for the current share
            const shareLivePriceData = livePrices[share.shareName.toUpperCase()] || {};

            // Only add to table if table is visible
            if (tableContainer && tableContainer.style.display !== 'none') {
                addShareToTable(share, shareLivePriceData); // Pass livePriceData
            }
            // Only add to mobile cards if mobile cards are visible
            if (mobileShareCardsContainer && mobileShareCardsContainer.style.display !== 'none') {
                addShareToMobileCards(share, shareLivePriceData); // Pass livePriceData
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
    // Get current time in Sydney (Australia/Sydney) using a more robust method
    // This directly creates a Date object in the target timezone without string parsing
    const sydneyDate = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));

    const dayOfWeek = sydneyDate.getDay(); // Sunday - Saturday : 0 - 6
    const hours = sydneyDate.getHours();
    const minutes = sydneyDate.getMinutes();

    // Check for weekends (Saturday = 6, Sunday = 0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        logDebug('Market Status: Market is closed (weekend).');
        return false;
    }

    // Standard ASX trading hours: 10:00 AM to 4:00 PM (Sydney time)
    const marketOpenHours = 10;
    const marketCloseHours = 16; // 4:00 PM

    if (hours < marketOpenHours || hours >= marketCloseHours) {
        logDebug(`Market Status: Market is closed (outside trading hours: ${hours}:${minutes < 10 ? '0' : ''}${minutes}).`);
        return false;
    }

    // Basic check for major Sydney public holidays (non-exhaustive)
    // This list should be updated annually for accuracy or fetched from an external API.
    // Format: 'MM-DD' for direct comparison with new Date(year, month-1, day)
    const sydneyPublicHolidays = [
        '01-01', // New Year's Day
        '01-26', // Australia Day (observed)
        '03-29', // Good Friday (example for 2024 - changes annually)
        '04-01', // Easter Monday (example for 2024 - changes annually)
        '04-25', // Anzac Day
        '06-10', // King's Birthday (NSW - example for 2024)
        // Add more holidays for the current year as needed
    ];

    const currentMonthDay = `${(sydneyDate.getMonth() + 1).toString().padStart(2, '0')}-${sydneyDate.getDate().toString().padStart(2, '0')}`;
    if (sydneyPublicHolidays.includes(currentMonthDay)) {
        logDebug(`Market Status: Market is closed (public holiday: ${currentMonthDay}).`);
        return false;
    }

    logDebug(`Market Status: Market is likely open (${hours}:${minutes < 10 ? '0' : ''}${minutes}).`);
    return true;
}

// NEW: Function to calculate and update target calculation display in share form
function updateTargetCalculationDisplay() {
    const targetValue = parseFloat(targetValueInput.value);
    const enteredPrice = parseFloat(currentPriceInput.value); // Ensure it reads from the correct input
    const isPercent = targetTypePercent.checked; // Check the 'checked' property of the radio input
    
    let displayHtml = '';

    // Adjust opacity and hidden class based on input validity
    if (!isNaN(targetValue) && !isNaN(enteredPrice) && enteredPrice > 0) {
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
        if (targetCalculationDisplay) {
            targetCalculationDisplay.textContent = displayHtml;
            targetCalculationDisplay.classList.remove('text-red-500', 'opacity-0', 'hidden');
            targetCalculationDisplay.classList.add('text-gray-500', 'italic', 'opacity-100', 'block');
        }
    } else if (targetValueInput.value.length > 0 || currentPriceInput.value.length > 0) {
        // Show error if user has started typing but input is invalid
        displayHtml = `Enter valid price and target.`;
        if (targetCalculationDisplay) {
            targetCalculationDisplay.textContent = displayHtml;
            targetCalculationDisplay.classList.remove('text-gray-500', 'italic', 'opacity-0', 'hidden');
            targetCalculationDisplay.classList.add('text-red-500', 'opacity-100', 'block');
        }
    } else {
        // Hide completely if no input
        if (targetCalculationDisplay) {
            targetCalculationDisplay.textContent = '';
            targetCalculationDisplay.classList.add('opacity-0', 'hidden');
            targetCalculationDisplay.classList.remove('text-red-500', 'text-gray-500', 'italic', 'block');
        }
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

    activeAlertsModal.style.display = 'flex'; // Set display to flex to make it visible
    activeAlertsModal.style.visibility = 'visible'; // Ensure visibility is set

    // Request an animation frame to ensure display/visibility is applied before transform
    requestAnimationFrame(() => {
        activeAlertsModal.classList.add('open'); // Add 'open' class to trigger CSS transition
    });

    activeAlertsModalOpen = true;
    renderActiveAlertsList(); // Populate the list when opening
    logDebug('Alerts Modal: Opened.');

    // Attach the "click outside" listener ONLY when the modal is opened
    // Store the listener function so it can be correctly removed later.
    const outsideClickListener = (event) => {
        const modalContent = activeAlertsModal.querySelector('.modal-content');
        // Ensure click is on the backdrop, not bubbling from inside the modal content
        if (modalContent && !modalContent.contains(event.target) && event.target === activeAlertsModal) {
            closeActiveAlertsModal();
        }
    };

    // Remove any existing listener first to prevent duplicates
    if (activeAlertsModal._currentOutsideClickListener) {
        activeAlertsModal.removeEventListener('click', activeAlertsModal._currentOutsideClickListener);
    }
    activeAlertsModal.addEventListener('click', outsideClickListener);
    activeAlertsModal._currentOutsideClickListener = outsideClickListener; // Store reference to the listener
}

// NEW: Function to close (minimize) the active alerts modal
function closeActiveAlertsModal() {
    if (!activeAlertsModal) return; // Safety check

    // Ensure the 'open' class is removed to trigger CSS transition
    activeAlertsModal.classList.remove('open');

    // Remove the event listener for clicking outside the modal when closing
    // This prevents multiple listeners from accumulating and causing odd behavior.
    const currentOutsideClickListener = activeAlertsModal._currentOutsideClickListener;
    if (currentOutsideClickListener) {
        activeAlertsModal.removeEventListener('click', currentOutsideClickListener);
        activeAlertsModal._currentOutsideClickListener = null;
    }

    // Delay setting display: 'none' until after the CSS transition completes
    // This ensures the fade-out and slide animation finishes visually.
    setTimeout(() => {
        activeAlertsModal.style.display = 'none';
        // Also ensure visibility is hidden, in case display:none is overridden elsewhere
        activeAlertsModal.style.visibility = 'hidden';
    }, 300); // Match the CSS transition duration (0.3s)

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
                await loadUserWatchlistsAndSettings(); // This loads watchlists and user settings
                // Load ASX codes for autocomplete (can happen in parallel or before live prices)
                allAsxCodes = await loadAsxCodesFromCSV();
                logDebug(`ASX Autocomplete: Loaded ${allAsxCodes.length} codes for search.`);
                
                // Now fetch live prices. This must happen AFTER loadUserWatchlistsAndSettings
                // because fetchLivePrices needs share.lastFetchedPrice from allSharesData,
                // which is populated by the shares onSnapshot listener initiated by loadShares(),
                // which is called by loadUserWatchlistsAndSettings().
                await fetchLivePrices();

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
