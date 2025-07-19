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
let currentCalculatorInput = '';
let operator = null;
let previousCalculatorInput = '';
let resultDisplayed = false;
const DEFAULT_WATCHLIST_NAME = 'My Watchlist (Default)';
const DEFAULT_WATCHLIST_ID_SUFFIX = 'default';
let userWatchlists = []; // Stores all watchlists for the user
let currentSelectedWatchlistIds = []; // Stores IDs of currently selected watchlists for display
const ALL_SHARES_ID = 'all_shares_option'; // Special ID for the "Show All Shares" option
const CASH_BANK_WATCHLIST_ID = 'cashBank'; // Special ID for the "Cash & Assets" option
let currentSortOrder = 'entryDate-desc'; // Default sort order for shares
let contextMenuOpen = false; // To track if the custom context menu is open
let currentContextMenuShareId = null; // Stores the ID of the share that opened the context menu
let originalShareData = null; // Stores the original share data when editing for dirty state check
let originalWatchlistData = null; // Stores original watchlist data for dirty state check in watchlist modals

// Live Price Data
// IMPORTANT: This URL is the exact string provided in your initial script.js file.
// If CORS errors persist, the solution is to redeploy your Google Apps Script with "Anyone, even anonymous" access
// and then update this constant with the NEW URL provided by Google Apps Script.
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzp7OjZL3zqvJ9wPsV9M-afm2wKeQPbIgGVv_juVpkaRllADESLwj7F4-S7YWYerau-/exec';
let livePrices = {}; // Stores live price data: {ASX_CODE: {live: price, prevClose: price, PE: value, High52: value, Low52: value, targetHit: boolean}}
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
let unsubscribeCashCategories = null; // Holds the unsubscribe function for Firestore cash categories listener

// Global variable to store shares that have hit their target price
let sharesAtTargetPrice = [];

// Global variable to track the current mobile view mode ('default' or 'compact')
let currentMobileViewMode = 'default';

// Global variable to track if the target hit icon is dismissed for the current session
let targetHitIconDismissed = false;

// Global variable to store cash categories data
let userCashCategories = [];
let selectedCashAssetDocId = null; // To track which cash asset is selected for editing/details
let originalCashAssetData = null; // To store original cash asset data for dirty state check
// Global variable to store visibility state of cash assets (temporary, not persisted)
let cashAssetVisibility = {}; // {assetId: true/false (visible/hidden)}


// --- UI Element References ---
const appHeader = document.getElementById('appHeader'); // Reference to the main header
const mainContainer = document.querySelector('main.container'); // Reference to the main content container
const mainTitle = document.getElementById('mainTitle');
const addShareHeaderBtn = document.getElementById('addShareHeaderBtn');
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
const targetPriceInput = document.getElementById('targetPrice');
const dividendAmountInput = document.getElementById('dividendAmount');
const frankingCreditsInput = document.getElementById('frankingCredits');
const commentsFormContainer = document.getElementById('dynamicCommentsArea');
const addCommentSectionBtn = document.getElementById('addCommentSectionBtn');
const shareTableBody = document.querySelector('#shareTable tbody');
const mobileShareCardsContainer = document.getElementById('mobileShareCards');
const loadingIndicator = document.getElementById('loadingIndicator');
const shareDetailModal = document.getElementById('shareDetailModal');
const modalShareName = document.getElementById('modalShareName');
const modalEntryDate = document.getElementById('modalEntryDate');
const modalTargetPrice = document.getElementById('modalTargetPrice');
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
const customDialogConfirmBtn = document.getElementById('customDialogConfirmBtn');
const customDialogCancelBtn = document.getElementById('customDialogCancelBtn');
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
const editWatchlistBtn = document = document.getElementById('editWatchlistBtn');
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
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn');
const refreshLivePricesBtn = document.getElementById('refreshLivePricesBtn');
const shareWatchlistSelect = document.getElementById('shareWatchlistSelect');
const modalLivePriceDisplaySection = document.querySelector('.live-price-display-section');
const targetHitIconBtn = document.getElementById('targetHitIconBtn');
const targetHitIconCount = document.getElementById('targetHitIconCount');
const toggleCompactViewBtn = document.getElementById('toggleCompactViewBtn');
const splashScreen = document.getElementById('splashScreen');
const splashKangarooIcon = document.getElementById('splashKangarooIcon');
const splashSignInBtn = document.getElementById('splashSignInBtn');
const alertPanel = document.getElementById('alertPanel');
const alertList = document.getElementById('alertList');
const closeAlertPanelBtn = document.getElementById('closeAlertPanelBtn');
const clearAllAlertsBtn = document.getElementById('clearAllAlertsBtn');

// Cash & Assets UI Elements
const stockWatchlistSection = document.getElementById('stockWatchlistSection');
const cashAssetsSection = document.getElementById('cashAssetsSection');
const cashCategoriesContainer = document.getElementById('cashCategoriesContainer');
const addCashCategoryBtn = document.getElementById('addCashCategoryBtn'); // This button is removed from HTML, but kept for reference if needed
const saveCashBalancesBtn = document.getElementById('saveCashBalancesBtn'); // This button is removed from HTML, but kept for reference if needed
const totalCashDisplay = document.getElementById('totalCashDisplay');
const newCashAssetBtn = document.getElementById('newCashAssetBtn'); // New button in sidebar

// Cash Asset Modal Elements
const cashAssetFormModal = document.getElementById('cashAssetFormModal');
const cashFormTitle = document.getElementById('cashFormTitle');
const cashAssetNameInput = document.getElementById('cashAssetName');
const cashAssetBalanceInput = document.getElementById('cashAssetBalance');
const saveCashAssetBtn = document.getElementById('saveCashAssetBtn');
const deleteCashAssetBtn = document.getElementById('deleteCashAssetBtn');
const cashAssetDetailModal = document.getElementById('cashAssetDetailModal');
const modalCashAssetName = document.getElementById('modalCashAssetName');
const detailCashAssetName = document.getElementById('detailCashAssetName');
const detailCashAssetBalance = document.getElementById('detailCashAssetBalance');
const detailCashAssetLastUpdated = document.getElementById('detailCashAssetLastUpdated');
const editCashAssetFromDetailBtn = document.getElementById('editCashAssetFromDetailBtn');
const deleteCashAssetFromDetailBtn = document.getElementById('deleteCashAssetFromDetailBtn');
const addCashCommentSectionBtn = document.getElementById('addCashCommentSectionBtn');
const dynamicCashCommentsArea = document.getElementById('dynamicCashCommentsArea');
const detailCashCommentsContainer = document.getElementById('detailCashCommentsContainer');


let sidebarOverlay = document.querySelector('.sidebar-overlay');
if (!sidebarOverlay) {
    sidebarOverlay = document.createElement('div');
    sidebarOverlay.classList.add('sidebar-overlay');
    document.body.appendChild(sidebarOverlay);
}

const formInputs = [
    shareNameInput, currentPriceInput, targetPriceInput,
    dividendAmountInput, frankingCreditsInput
];

// Form inputs for Cash Asset Modal
const cashFormInputs = [
    cashAssetNameInput, cashAssetBalanceInput
];


// --- GLOBAL HELPER FUNCTIONS (Defined early to prevent ReferenceErrors) ---

/**
 * Dynamically adjusts the top padding of the main content area
 * to prevent it from being hidden by the fixed header.
 */
function adjustMainContentPadding() {
    if (appHeader && mainContainer) {
        const headerHeight = appHeader.offsetHeight;
        mainContainer.style.paddingTop = `${headerHeight}px`;
        logDebug('Layout: Adjusted main content padding-top to: ' + headerHeight + 'px (Header only).');
    } else {
        console.warn('Layout: Could not adjust main content padding-top: appHeader or mainContainer not found.');
    }
}

/**
 * Helper function to apply/remove a disabled visual state to non-button elements (like spans/icons).
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

/**
 * Shows a modal by setting its display to flex.
 * @param {HTMLElement} modalElement The modal DOM element to show.
 */
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

/**
 * Hides a modal by setting its display to none.
 * @param {HTMLElement} modalElement The modal DOM element to hide.
 */
function hideModal(modalElement) {
    if (modalElement) {
        modalElement.style.setProperty('display', 'none', 'important');
        logDebug('Modal: Hiding modal: ' + modalElement.id);
    }
}

/**
 * Clears the watchlist dropdown UI.
 */
function clearWatchlistUI() {
    if (!watchlistSelect) { console.error('clearWatchlistUI: watchlistSelect element not found.'); return; }
    watchlistSelect.innerHTML = '<option value="" disabled selected>Watch List</option>';
    userWatchlists = [];
    currentSelectedWatchlistIds = [];
    logDebug('UI: Watchlist UI cleared.');
}

/**
 * Clears the share list UI (table and mobile cards).
 */
function clearShareListUI() {
    if (!shareTableBody) { console.error('clearShareListUI: shareTableBody element not found.'); return; }
    if (!mobileShareCardsContainer) { console.error('clearShareListUI: mobileShareCardsContainer element not found.'); return; }
    shareTableBody.innerHTML = '';
    mobileShareCardsContainer.innerHTML = '';
    logDebug('UI: Share list UI cleared.');
}

/**
 * Clears all share-related UI elements.
 */
function clearShareList() {
    clearShareListUI();
    if (asxCodeButtonsContainer) asxCodeButtonsContainer.innerHTML = '';
    deselectCurrentShare();
    logDebug('UI: Full share list cleared (UI + buttons).');
}

/**
 * Selects a share in the UI (adds 'selected' class).
 * @param {string} shareId The ID of the share to select.
 */
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

/**
 * Deselects the currently selected share in the UI.
 */
function deselectCurrentShare() {
    const currentlySelected = document.querySelectorAll('.share-list-section tr.selected, .mobile-card.selected');
    logDebug('Selection: Attempting to deselect ' + currentlySelected.length + ' elements.');
    currentlySelected.forEach(el => {
        el.classList.remove('selected');
    });
    selectedShareDocId = null;
    logDebug('Selection: Share deselected. selectedShareDocId is now null.');
}

/**
 * Selects a cash asset in the UI (adds 'selected' class).
 * @param {string} assetId The ID of the cash asset to select.
 */
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

/**
 * Deselects the currently selected cash asset in the UI.
 */
function deselectCurrentCashAsset() {
    const currentlySelected = document.querySelectorAll('.cash-category-item.selected');
    logDebug('Selection: Attempting to deselect ' + currentlySelected.length + ' cash asset elements.');
    currentlySelected.forEach(el => {
        el.classList.remove('selected');
    });
    selectedCashAssetDocId = null;
    logDebug('Selection: Cash asset deselected. selectedCashAssetDocId is now null.');
}

/**
 * Renders the sort options in the sort dropdown based on the currently selected watchlist type (shares or cash).
 */
function renderSortSelect() {
    if (!sortSelect) { console.error('renderSortSelect: sortSelect element not found.'); return; }
    const currentSortSelectValue = sortSelect.value; // Store current value to try and re-select
    sortSelect.innerHTML = '<option value="" disabled selected>Sort List</option>';

    const selectedWatchlistId = currentSelectedWatchlistIds[0];
    let options = [];

    if (selectedWatchlistId === CASH_BANK_WATCHLIST_ID) {
        options = [
            { value: 'name-asc', text: 'Asset Name (A-Z)' },
            { value: 'name-desc', text: 'Asset Name (Z-A)' },
            { value: 'balance-desc', text: 'Balance (High-Low)' },
            { value: 'balance-asc', text: 'Balance (Low-High)' },
            { value: 'lastUpdated-desc', text: 'Last Updated (Newest)' },
            { value: 'lastUpdated-asc', text: 'Last Updated (Oldest)' }
        ];
    } else {
        options = [
            { value: 'entryDate-desc', text: 'Date Added (Newest)' },
            { value: 'entryDate-asc', text: 'Date Added (Oldest)' },
            { value: 'shareName-asc', text: 'Code (A-Z)' },
            { value: 'shareName-desc', text: 'Code (Z-A)' },
            { value: 'dividendAmount-desc', text: 'Dividend (High-Low)' },
            { value: 'dividendAmount-asc', text: 'Dividend (Low-High)' },
            { value: 'percentageChange-desc', text: 'Percentage Change (High-Low)' },
            { value: 'percentageChange-asc', text: 'Percentage Change (Low-High)' }
        ];
    }

    options.forEach(opt => {
        const optionElement = document.createElement('option');
        optionElement.value = opt.value;
        optionElement.textContent = opt.text;
        sortSelect.appendChild(optionElement);
    });

    // Attempt to re-select the current sort order, or default to the first valid option
    const isValidSortOption = options.some(option => option.value === currentSortOrder);
    if (isValidSortOption) {
        sortSelect.value = currentSortOrder;
    } else {
        if (options.length > 0) {
            sortSelect.value = options[0].value;
            currentSortOrder = options[0].value; // Update global currentSortOrder
            logDebug('Sort: Defaulting sort order to first available option for current view: ' + currentSortOrder);
        } else {
            sortSelect.value = ''; // Fallback to placeholder if no options
            currentSortOrder = '';
        }
    }
    logDebug('UI Update: Sort select dropdown rendered. Selected value: ' + sortSelect.value);
}

/**
 * Populates the watchlist dropdown in the header.
 */
function renderWatchlistSelect() {
    if (!watchlistSelect) { console.error('renderWatchlistSelect: watchlistSelect element not found.'); return; }
    const currentSelectedValue = watchlistSelect.value;
    
    watchlistSelect.innerHTML = '<option value="" disabled selected>Watch List</option>';

    const allSharesOption = document.createElement('option');
    allSharesOption.value = ALL_SHARES_ID;
    allSharesOption.textContent = 'All Shares';
    watchlistSelect.appendChild(allSharesOption);

    userWatchlists.forEach(watchlist => {
        if (watchlist.id === CASH_BANK_WATCHLIST_ID) {
            return; 
        }
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        watchlistSelect.appendChild(option);
    });

    // Ensure "Cash & Assets" is always an option if not already present from HTML
    if (!watchlistSelect.querySelector(`option[value="${CASH_BANK_WATCHLIST_ID}"]`)) {
        const cashBankOption = document.createElement('option');
        cashBankOption.value = CASH_BANK_WATCHLIST_ID;
        cashBankOption.textContent = 'Cash & Assets';
        watchlistSelect.appendChild(cashBankOption);
    }

    // Re-select the previously selected value if it still exists
    if (currentSelectedValue && (Array.from(watchlistSelect.options).some(opt => opt.value === currentSelectedValue))) {
        watchlistSelect.value = currentSelectedValue;
        currentSelectedWatchlistIds = [currentSelectedValue];
    } else if (currentSelectedWatchlistIds.length === 1 && 
                Array.from(watchlistSelect.options).some(opt => opt.value === currentSelectedWatchlistIds[0])) {
        watchlistSelect.value = currentSelectedWatchlistIds[0];
    } else {
        // If the previously selected value is no longer valid, default to the first available option
        if (watchlistSelect.querySelector('option[value="' + ALL_SHARES_ID + '"]')) {
            watchlistSelect.value = ALL_SHARES_ID;
            currentSelectedWatchlistIds = [ALL_SHARES_ID];
        } else if (userWatchlists.length > 0) {
            currentSelectedWatchlistIds = [userWatchlists[0].id];
        } else {
            watchlistSelect.value = '';
            currentSelectedWatchlistIds = [];
        }
    }
    logDebug('UI Update: Watchlist select dropdown rendered. Selected value: ' + watchlistSelect.value);
    updateMainTitle();
}


/**
 * Adds a new comment section to a form (for shares or cash assets).
 * @param {HTMLElement} container The container element where comment sections will be added.
 * @param {Function} dirtyCheckCallback The callback function to check form dirty state.
 * @param {string} title Initial title for the comment.
 * @param {string} text Initial text for the comment.
 */
function addCommentSection(container, dirtyCheckCallback, title = '', text = '') {
    if (!container) {
        console.error('addCommentSection: Container element not found.');
        return;
    }
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
    if (commentTitleInput) commentTitleInput.addEventListener('input', dirtyCheckCallback);
    if (commentTextInput) commentTextInput.addEventListener('input', dirtyCheckCallback);

    commentSectionDiv.querySelector('.comment-delete-btn').addEventListener('click', (event) => {
        logDebug('Comments: Delete comment button clicked.');
        event.target.closest('.comment-section').remove();
        dirtyCheckCallback();
    });
    logDebug('Comments: Added new comment section to form.');
}

/**
 * Adds a share to the main table display.
 * @param {object} share The share data object.
 */
function addShareToTable(share) {
    if (!shareTableBody) { console.error('addShareToTable: shareTableBody element not found.'); return; }
    const row = shareTableBody.insertRow();
    row.dataset.docId = share.id;
    
    let priceChangeClass = 'neutral';
    const livePriceData = livePrices[share.shareName.toUpperCase()];
    const livePrice = livePriceData ? livePriceData.live : undefined;
    const prevClosePrice = livePriceData ? livePriceData.prevClose : undefined;

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

    const isTargetHit = livePriceData ? livePriceData.targetHit : false;
    if (isTargetHit && !targetHitIconDismissed) { 
        row.classList.add('target-hit-alert');
    } else {
        row.classList.remove('target-hit-alert');
    }

    let lastClickTime = 0;
    row.addEventListener('click', (event) => { 
        logDebug('Table Row Click: Share ID: ' + share.id);
        if (!contextMenuOpen) {
            const currentTime = new Date().getTime();
            const clickDelay = 300;
            if (currentTime - lastClickTime < clickDelay) {
                logDebug('Table Row Double Click: Share ID: ' + share.id);
                selectShare(share.id); 
                showShareDetails();
            }
            lastClickTime = currentTime;
            selectShare(share.id);
        }
    });

    row.addEventListener('contextmenu', (event) => {
        logDebug('Table Row ContextMenu: Share ID: ' + share.id);
        event.preventDefault();
        selectShare(share.id);
        showContextMenu(event, share.id);
    });

    let touchStartTime;
    row.addEventListener('touchstart', (event) => {
        logDebug('Table Row TouchStart: Share ID: ' + share.id);
        if (event.touches.length === 1) {
            touchStartTime = new Date().getTime();
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
            longPressTimer = setTimeout(() => {
                event.preventDefault();
                selectShare(share.id);
                showContextMenu(event, share.id);
            }, LONG_PRESS_THRESHOLD);
        }
    });

    row.addEventListener('touchmove', (event) => {
        if (longPressTimer) {
            const currentX = event.touches[0].clientX;
            const currentY = event.touches[0].clientY;
            const distance = Math.sqrt(Math.pow(currentX - touchStartX, 2) + Math.pow(currentY - touchStartY, 2));
            if (distance > TOUCH_MOVE_THRESHOLD) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                logDebug('Table Row TouchMove: Long press cancelled due to movement.');
            }
        }
    });

    row.addEventListener('touchend', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            logDebug('Table Row TouchEnd: Long press timer cleared.');
        }
    });

    const codeCell = row.insertCell();
    const displayShareName = (share.shareName && String(share.shareName).trim() !== '') ? share.shareName : '(No Code)';
    const shareCodeSpan = document.createElement('span');
    shareCodeSpan.classList.add('share-code-display', priceChangeClass);
    shareCodeSpan.textContent = displayShareName;
    codeCell.appendChild(shareCodeSpan);

    const livePriceCell = row.insertCell();
    if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) {
        const priceValueSpan = document.createElement('span');
        priceValueSpan.classList.add('live-price-value', priceChangeClass);
        priceValueSpan.textContent = '$' + livePrice.toFixed(2);
        livePriceCell.appendChild(priceValueSpan);
        
        if (prevClosePrice !== undefined && prevClosePrice !== null && !isNaN(prevClosePrice)) {
            const change = livePrice - prevClosePrice;
            const percentageChange = (prevClosePrice !== 0 && !isNaN(prevClosePrice)) ? (change / prevClosePrice) * 100 : 0;
            const priceChangeSpan = document.createElement('span');
            priceChangeSpan.classList.add('price-change', priceChangeClass);
            if (change > 0) {
                priceChangeSpan.textContent = '(+$' + change.toFixed(2) + ' / +' + percentageChange.toFixed(2) + '%)';
            } else if (change < 0) {
                priceChangeSpan.textContent = '(-$' + Math.abs(change).toFixed(2) + ' / ' + percentageChange.toFixed(2) + '%)';
            } else {
                priceChangeSpan.textContent = '($0.00 / 0.00%)';
            }
            livePriceCell.appendChild(priceChangeSpan);
        }
    } else {
        livePriceCell.textContent = 'N/A';
        livePriceCell.classList.add('neutral');
    }

    const enteredPriceCell = row.insertCell();
    const enteredPriceNum = Number(share.currentPrice);
    const displayEnteredPrice = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? '$' + enteredPriceNum.toFixed(2) : '-';
    enteredPriceCell.textContent = displayEnteredPrice;

    const targetPriceNum = Number(share.targetPrice);
    const displayTargetPrice = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? '$' + targetPriceNum.toFixed(2) : '-';
    row.insertCell().textContent = displayTargetPrice;

    const dividendCell = row.insertCell();
    const dividendAmountNum = Number(share.dividendAmount);
    const frankingCreditsNum = Number(share.frankingCredits);
    const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;

    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, priceForYield);
    const displayUnfrankedYield = unfrankedYield !== null && !isNaN(unfrankedYield) ? unfrankedYield.toFixed(2) + '%' : '0.00%';
    
    const frankedYield = calculateFrankedYield(dividendAmountNum, priceForYield, frankingCreditsNum);
    const displayFrankedYield = frankedYield !== null && !isNaN(frankedYield) ? frankedYield.toFixed(2) + '%' : '0.00%';

    dividendCell.innerHTML = `
        <div class="dividend-yield-cell-content">
            <span>Dividend:</span> <span class="value">${(Number(share.dividendAmount) !== null && !isNaN(Number(share.dividendAmount))) ? '$' + Number(share.dividendAmount).toFixed(2) : '-'}</span>
        </div>
        <div class="dividend-yield-cell-content">
            <span>Unfranked Yield:</span> <span class="value">${displayUnfrankedYield}&#xFE0E;</span>
        </div>
        <div class="dividend-yield-cell-content">
            <span>Franked Yield:</span> <span class="value">${displayFrankedYield}&#xFE0E;</span>
        </div>
    `;

    logDebug('Render: Added share ' + displayShareName + ' to table.');
}

/**
 * Adds a share to the mobile cards display.
 * @param {object} share The share data object.
 */
function addShareToMobileCards(share) {
    if (!mobileShareCardsContainer) { console.error('addShareToMobileCards: mobileShareCardsContainer element not found.'); return; }
    if (!window.matchMedia('(max-width: 768px)').matches) { return; }

    const card = document.createElement('div');
    card.className = 'mobile-card';
    card.dataset.docId = share.id;

    let priceChangeClass = 'neutral';
    const livePriceData = livePrices[share.shareName.toUpperCase()];
    const livePrice = livePriceData ? livePriceData.live : undefined;
    const prevClosePrice = livePriceData ? livePriceData.prevClose : undefined;

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

    if (currentMobileViewMode === 'compact') {
        card.classList.add('compact-view-item');
    } else {
        card.classList.remove('compact-view-item');
    }

    const isTargetHit = livePriceData ? livePriceData.targetHit : false;
    if (isTargetHit && !targetHitIconDismissed) { 
        card.classList.add('target-hit-alert');
    } else {
        card.classList.remove('target-hit-alert');
    }

    const enteredPriceNum = Number(share.currentPrice);
    const dividendAmountNum = Number(share.dividendAmount);
    const frankingCreditsNum = Number(share.frankingCredits);
    const targetPriceNum = Number(share.targetPrice);
    
    const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;

    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, priceForYield);
    const frankedYield = calculateFrankedYield(dividendAmountNum, priceForYield, frankingCreditsNum);

    const displayTargetPrice = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? targetPriceNum.toFixed(2) : '-';
    const displayDividendAmount = (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? dividendAmountNum.toFixed(2) : '-';
    const displayFrankingCredits = (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? frankingCreditsNum + '%' : '-';
    const displayShareName = (share.shareName && String(share.shareName).trim() !== '') ? share.shareName : '(No Code)';
    const displayEnteredPrice = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? enteredPriceNum.toFixed(2) : '-';

    let priceChangeText = '';

    if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) {
        if (prevClosePrice !== undefined && prevClosePrice !== null && !isNaN(prevClosePrice)) {
            const change = livePrice - prevClosePrice;
            const percentageChange = (prevClosePrice !== 0 && !isNaN(prevClosePrice)) ? (change / prevClosePrice) * 100 : 0;
            if (change > 0) {
                priceChangeText = '(+$' + change.toFixed(2) + ' / +' + percentageChange.toFixed(2) + '%)';
            } else if (change < 0) {
                priceChangeText = '(-$' + Math.abs(change).toFixed(2) + ' / ' + percentageChange.toFixed(2) + '%)';
            } else {
                priceChangeText = '($0.00 / 0.00%)';
            }
        }

        if (currentMobileViewMode === 'compact') {
            card.innerHTML = `
                <h3 class="${priceChangeClass}">${displayShareName}</h3>
                <div class="live-price-display-section">
                    <span class="live-price-large ${priceChangeClass}">$${livePrice.toFixed(2)}</span>
                    <span class="price-change-large ${priceChangeClass}">${priceChangeText}</span>
                    <div class="fifty-two-week-row"></div>
                    <div class="pe-ratio-row"></div>
                </div>
                <p><strong>Entered Price:</strong> $${displayEnteredPrice}</p>
                <p><strong>Target:</strong> $${displayTargetPrice}</p>
                <p><strong>Dividend:</strong> $${displayDividendAmount}</p>
                <p><strong>Franking:</strong> ${displayFrankingCredits}</p>
                <p><strong>Unfranked Yield:</strong> ${unfrankedYield !== null && !isNaN(unfrankedYield) ? unfrankedYield.toFixed(2) + '%' : '0.00%'}&#xFE0E;</p>
                <p><strong>Franked Yield:</strong> ${frankedYield !== null && !isNaN(frankedYield) ? frankedYield.toFixed(2) + '%' : '0.00%'}&#xFE0E;</p>
            `;
        } else {
            card.innerHTML = `
                <h3 class="${priceChangeClass}">${displayShareName}</h3>
                <div class="live-price-display-section">
                    <span class="live-price-large ${priceChangeClass}">$${livePrice.toFixed(2)}</span>
                    <span class="price-change-large ${priceChangeClass}">${priceChangeText}</span>
                </div>
                <p><strong>Entered Price:</strong> $${displayEnteredPrice}</p>
                <p><strong>Target:</strong> $${displayTargetPrice}</p>
                <p><strong>Dividend:</strong> $${displayDividendAmount}</p>
                <p><strong>Franking:</strong> ${displayFrankingCredits}</p>
                <p><strong>Unfranked Yield:</strong> ${unfrankedYield !== null && !isNaN(unfrankedYield) ? unfrankedYield.toFixed(2) + '%' : '0.00%'}&#xFE0E;</p>
                <p><strong>Franked Yield:</strong> ${frankedYield !== null && !isNaN(frankedYield) ? frankedYield.toFixed(2) + '%' : '0.00%'}&#xFE0E;</p>
            `;
        }
    } else {
        if (currentMobileViewMode === 'compact') {
            card.innerHTML = `
                <h3 class="neutral">${displayShareName}</h3>
                <div class="live-price-display-section">
                    <span class="live-price-large neutral">N/A</span>
                    <span class="price-change-large"></span>
                    <div class="fifty-two-week-row"></div>
                    <div class="pe-ratio-row"></div>
                </div>
                <p><strong>Entered Price:</strong> $${displayEnteredPrice}</p>
                <p><strong>Target:</strong> $${displayTargetPrice}</p>
                <p><strong>Dividend:</strong> $${displayDividendAmount}</p>
                <p><strong>Franking:</strong> ${displayFrankingCredits}</p>
                <p><strong>Unfranked Yield:</strong> ${unfrankedYield !== null && !isNaN(unfrankedYield) ? unfrankedYield.toFixed(2) + '%' : '0.00%'}&#xFE0E;</p>
                <p><strong>Franked Yield:</strong> ${frankedYield !== null && !isNaN(frankedYield) ? frankedYield.toFixed(2) + '%' : '0.00%'}&#xFE0E;</p>
            `;
        } else {
            card.innerHTML = `
                <h3 class="neutral">${displayShareName}</h3>
                <div class="live-price-display-section">
                    <span class="live-price-large neutral">N/A</span>
                    <span class="price-change-large"></span>
                </div>
                <p><strong>Entered Price:</strong> $${displayEnteredPrice}</p>
                <p><strong>Target:</strong> $${displayTargetPrice}</p>
                <p><strong>Dividend:</strong> $${displayDividendAmount}</p>
                <p><strong>Franking:</strong> ${displayFrankingCredits}</p>
                <p><strong>Unfranked Yield:</strong> ${unfrankedYield !== null && !isNaN(unfrankedYield) ? unfrankedYield.toFixed(2) + '%' : '0.00%'}&#xFE0E;</p>
                <p><strong>Franked Yield:</strong> ${frankedYield !== null && !isNaN(frankedYield) ? frankedYield.toFixed(2) + '%' : '0.00%'}&#xFE0E;</p>
            `;
        }
    }
    mobileShareCardsContainer.appendChild(card);

    let lastClickTime = 0;
    card.addEventListener('click', function(e) {
        logDebug('Mobile Card Click: Share ID: ' + share.id);
        if (!contextMenuOpen) {
            const currentTime = new Date().getTime();
            const clickDelay = 300;
            if (currentTime - lastClickTime < clickDelay) {
                logDebug('Mobile Card Double Click: Share ID: ' + share.id);
                const docId = e.currentTarget.dataset.docId;
                selectShare(docId);
                showShareDetails();
            }
            lastClickTime = currentTime;
            const docId = e.currentTarget.dataset.docId;
            selectShare(docId);
        }
    });

    card.addEventListener('contextmenu', (event) => {
        logDebug('Mobile Card ContextMenu: Share ID: ' + share.id);
        event.preventDefault();
        selectShare(share.id);
        showContextMenu(event, share.id);
    });

    let touchStartTime;
    card.addEventListener('touchstart', (event) => {
        logDebug('Mobile Card TouchStart: Share ID: ' + share.id);
        if (event.touches.length === 1) {
            touchStartTime = new Date().getTime();
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
            longPressTimer = setTimeout(() => {
                event.preventDefault(); 
                selectShare(share.id);
                showContextMenu(event, share.id);
            }, LONG_PRESS_THRESHOLD);
        }
    });

    card.addEventListener('touchmove', (event) => {
        if (longPressTimer) {
            const currentX = event.touches[0].clientX;
            const currentY = event.touches[0].clientY;
            const distance = Math.sqrt(Math.pow(currentX - touchStartX, 2) + Math.pow(currentY - touchStartY, 2));
            if (distance > TOUCH_MOVE_THRESHOLD) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                logDebug('Mobile Card TouchMove: Long press cancelled due to movement.');
            }
        }
    });

    card.addEventListener('touchend', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            logDebug('Mobile Card TouchEnd: Long press timer cleared.');
        }
    });

    logDebug('Render: Added share ' + displayShareName + ' to mobile cards.');
}


/**
 * Renders the cash categories in the UI.
 */
function renderCashCategories() {
    if (!cashCategoriesContainer) {
        console.error('renderCashCategories: cashCategoriesContainer element not found.');
        return;
    }
    cashCategoriesContainer.innerHTML = '';

    if (userCashCategories.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.classList.add('empty-message');
        emptyMessage.textContent = 'No cash categories added yet. Click "Add New Cash Asset" in the sidebar to get started!';
        cashCategoriesContainer.appendChild(emptyMessage);
        return;
    }

    userCashCategories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.classList.add('cash-category-item');
        categoryItem.dataset.id = category.id;
        if (cashAssetVisibility[category.id] === false) {
            categoryItem.classList.add('hidden');
        }

        const categoryHeader = document.createElement('div');
        categoryHeader.classList.add('category-header');

        const nameDisplay = document.createElement('span');
        nameDisplay.classList.add('category-name-display');
        nameDisplay.textContent = category.name || 'Unnamed Asset';
        categoryHeader.appendChild(nameDisplay);

        const actionsContainer = document.createElement('div');
        actionsContainer.classList.add('category-actions');

        const hideToggleButton = document.createElement('button');
        hideToggleButton.classList.add('hide-toggle-btn');
        hideToggleButton.innerHTML = cashAssetVisibility[category.id] === false ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        hideToggleButton.title = cashAssetVisibility[category.id] === false ? 'Show Asset' : 'Hide Asset';
        if (cashAssetVisibility[category.id] === false) {
            hideToggleButton.classList.add('hidden-icon');
        }
        hideToggleButton.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleCashAssetVisibility(category.id);
        });
        actionsContainer.appendChild(hideToggleButton);

        categoryHeader.appendChild(actionsContainer);
        categoryItem.appendChild(categoryHeader);

        const balanceDisplay = document.createElement('span');
        balanceDisplay.classList.add('category-balance-display');
        balanceDisplay.textContent = '$' + (Number(category.balance) !== null && !isNaN(Number(category.balance)) ? Number(category.balance).toFixed(2) : '0.00');
        categoryItem.appendChild(balanceDisplay);

        categoryItem.addEventListener('click', () => {
            logDebug('Cash Categories: Card clicked for category ID: ' + category.id);
            selectCashAsset(category.id);
            showCashCategoryDetailsModal(category.id);
        });

        cashCategoriesContainer.appendChild(categoryItem);
    });
    logDebug('Cash Categories: UI rendered.');
    calculateTotalCash();
}

/**
 * Calculates and displays the total cash balance.
 */
function calculateTotalCash() {
    let total = 0;
    userCashCategories.forEach(category => {
        if (cashAssetVisibility[category.id] !== false) {
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

/**
 * Renders the watchlist based on the currentSelectedWatchlistIds.
 * This function now acts as a dispatcher for either stock or cash views.
 */
function renderWatchlist() {
    logDebug('Render: Rendering content for selected watchlist ID: ' + currentSelectedWatchlistIds[0]);

    const selectedWatchlistId = currentSelectedWatchlistIds[0];

    stockWatchlistSection.classList.add('app-hidden');
    cashAssetsSection.classList.add('app-hidden');
    
    clearShareListUI();
    if (cashCategoriesContainer) cashCategoriesContainer.innerHTML = '';

    if (selectedWatchlistId === CASH_BANK_WATCHLIST_ID) {
        cashAssetsSection.classList.remove('app-hidden');
        mainTitle.textContent = 'Cash & Assets';
        renderCashCategories();
        addShareHeaderBtn.classList.add('app-hidden'); // Plus button is hidden for cash view
        sortSelect.classList.remove('app-hidden'); // Sort is visible for cash assets
        refreshLivePricesBtn.classList.add('app-hidden');
        toggleCompactViewBtn.classList.add('app-hidden');
        asxCodeButtonsContainer.classList.add('app-hidden');
        targetHitIconBtn.classList.add('app-hidden');
        stopLivePriceUpdates();
        renderSortSelect(); // Re-render sort options for cash assets
    } else {
        stockWatchlistSection.classList.remove('app-hidden');
        const selectedWatchlist = userWatchlists.find(wl => wl.id === selectedWatchlistId);
        if (selectedWatchlistId === ALL_SHARES_ID) {
            mainTitle.textContent = 'All Shares';
        } else if (selectedWatchlist) {
            mainTitle.textContent = selectedWatchlist.name;
        } else {
            mainTitle.textContent = 'Share Watchlist';
        }

        addShareHeaderBtn.classList.remove('app-hidden'); // Plus button is visible for stock view
        sortSelect.classList.remove('app-hidden');
        refreshLivePricesBtn.classList.remove('app-hidden');
        toggleCompactViewBtn.classList.remove('app-hidden');
        asxCodeButtonsContainer.classList.remove('app-hidden');
        targetHitIconBtn.classList.remove('app-hidden');
        startLivePriceUpdates();
        renderSortSelect(); // Re-render sort options for shares
        renderShareListContent();
    }
    adjustMainContentPadding();
}

/**
 * Renders the share list content (table and mobile cards) based on current filters and sort order.
 */
function renderShareListContent() {
    clearShareListUI();

    const selectedWatchlistId = currentSelectedWatchlistIds[0];
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

    if (mobileShareCardsContainer) {
        if (currentMobileViewMode === 'compact') {
            mobileShareCardsContainer.classList.add('compact-view');
        } else {
            mobileShareCardsContainer.classList.remove('compact-view');
        }
    }

    if (asxCodeButtonsContainer) {
        if (currentMobileViewMode === 'compact') {
            asxCodeButtonsContainer.style.display = 'none';
            logDebug('UI: Hiding ASX code buttons in compact view.');
        } else {
            asxCodeButtonsContainer.style.display = 'flex';
            logDebug('UI: Showing ASX code buttons in default view.');
        }
    }

    if (sharesToRender.length === 0) {
        const emptyWatchlistMessage = document.createElement('p');
        emptyWatchlistMessage.textContent = 'No shares found for the selected watchlists. Add a new share to get started!';
        emptyWatchlistMessage.style.textAlign = 'center';
        emptyWatchlistMessage.style.padding = '20px';
        emptyWatchlistMessage.style.color = 'var(--ghosted-text)';
        const td = document.createElement('td');
        td.colSpan = 5;
        td.appendChild(emptyWatchlistMessage);
        const tr = document.createElement('tr');
        tr.appendChild(td);
        shareTableBody.appendChild(tr);
        mobileShareCardsContainer.appendChild(emptyWatchlistMessage.cloneNode(true));
    }

    sharesToRender.forEach((share) => {
        addShareToTable(share);
        addShareToMobileCards(share);
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
    updateTargetHitBanner();
    renderAsxCodeButtons();
}

/**
 * Sorts shares based on the current sort order.
 */
function sortShares() {
    const sortValue = currentSortOrder;
    if (!sortValue || sortValue === '') {
        logDebug('Sort: Sort placeholder selected, no explicit sorting applied.');
        renderWatchlist();
        return;
    }
    const [field, order] = sortValue.split('-');
    allSharesData.sort((a, b) => {
        if (field === 'percentageChange') {
            const livePriceDataA = livePrices[a.shareName.toUpperCase()];
            const livePriceA = livePriceDataA ? livePriceDataA.live : undefined;
            const prevCloseA = livePriceDataA ? livePriceDataA.prevClose : undefined;

            const livePriceDataB = livePrices[b.shareName.toUpperCase()];
            const livePriceB = livePriceDataB ? livePriceDataB.live : undefined;
            const prevCloseB = livePriceDataB ? livePriceDataB.prevClose : undefined;

            let percentageChangeA = null;
            if (livePriceA !== undefined && livePriceA !== null && !isNaN(livePriceA) &&
                prevCloseA !== undefined && prevCloseA !== null && !isNaN(prevCloseA) && prevCloseA !== 0) {
                percentageChangeA = ((livePriceA - prevCloseA) / prevCloseA) * 100;
            }

            let percentageChangeB = null;
            if (livePriceB !== undefined && livePriceB !== null && !isNaN(livePriceB) &&
                prevCloseB !== undefined && prevCloseB !== null && !isNaN(prevCloseB) && prevCloseB !== 0) {
                percentageChangeB = ((livePriceB - prevCloseB) / prevCloseB) * 100;
            }

            logDebug('Sort Debug - Percentage: Comparing ' + a.shareName + ' (Change: ' + percentageChangeA + ') vs ' + b.shareName + ' (Change: ' + percentageChangeB + ')');

            if (percentageChangeA === null && percentageChangeB === null) return 0;
            if (percentageChangeA === null) return 1;
            if (percentageChangeB === null) return -1;

            return order === 'asc' ? percentageChangeA - percentageChangeB : percentageChangeB - percentageChangeA;
        }

        let valA = a[field];
        let valB = b[field];

        if (field === 'currentPrice' || field === 'targetPrice' || field === 'dividendAmount' || field === 'frankingCredits') {
            valA = (typeof valA === 'string' && valA.trim() !== '') ? parseFloat(valA) : valA;
            valB = (typeof valB === 'string' && valB.trim() !== '') ? parseFloat(valB) : valB;
            valA = (valA === null || valA === undefined || isNaN(valA)) ? (order === 'asc' ? Infinity : -Infinity) : valA;
            valB = (valB === null || valB === undefined || isNaN(valB)) ? (order === 'asc' ? Infinity : -Infinity) : valB;
            return order === 'asc' ? valA - valB : valB - valA;
        } else if (field === 'shareName') {
            const nameA = (a.shareName || '').toUpperCase().trim();
            const nameB = (b.shareName || '').toUpperCase().trim();
            if (nameA === '' && nameB === '') return 0;
            if (nameA === '') return 1;
            if (nameB === '') return -1;

            return order === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        } else if (field === 'entryDate') {
            const dateA = new Date(valA);
            const dateB = new Date(valB);
            
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


// Date Formatting Helper Functions (Australian Style)
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const COMPANY_TAX_RATE = 0.30;
function calculateUnfrankedYield(dividendAmount, currentPrice) {
    if (typeof dividendAmount !== 'number' || isNaN(dividendAmount) || dividendAmount <= 0) { return null; }
    if (typeof currentPrice !== 'number' || isNaN(currentPrice) || currentPrice <= 0) { return null; }
    return (dividendAmount / currentPrice) * 100;
}

function calculateFrankedYield(dividendAmount, currentPrice, frankingCreditsPercentage) {
    if (typeof dividendAmount !== 'number' || isNaN(dividendAmount) || dividendAmount <= 0) { return null; }
    if (typeof currentPrice !== 'number' || isNaN(currentPrice) || currentPrice <= 0) { return null; }
    if (typeof frankingCreditsPercentage !== 'number' || isNaN(frankingCreditsPercentage) || frankingCreditsPercentage < 0 || frankingCreditsPercentage > 100) { return null; }
    const unfrankedYield = calculateUnfrankedYield(dividendAmount, currentPrice);
    if (unfrankedYield === null) return null;
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
        currentCustomThemeIndex = -1;
    } else if (themeName === 'light' || themeName === 'dark') {
        body.removeAttribute('data-theme');
        localStorage.removeItem('selectedTheme');
        localStorage.setItem('theme', themeName);
        if (themeName === 'dark') {
            body.classList.add('dark-theme');
        }
        logDebug('Theme Debug: Applied explicit default theme: ' + themeName);
        currentCustomThemeIndex = -1;
    } else {
        body.classList.add('theme-' + themeName.toLowerCase().replace(/\s/g, '-'));
        body.setAttribute('data-theme', themeName);
        localStorage.setItem('selectedTheme', themeName);
        localStorage.removeItem('theme');
        logDebug('Theme Debug: Applied custom theme: ' + themeName);
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
        if (CUSTOM_THEMES.includes(currentActiveTheme)) {
            colorThemeSelect.value = currentActiveTheme;
        } else {
            colorThemeSelect.value = 'none';
        }
        logDebug('Theme UI: Color theme select updated to: ' + colorThemeSelect.value);
    }

    if (CUSTOM_THEMES.includes(currentActiveTheme)) {
        currentCustomThemeIndex = CUSTOM_THEMES.indexOf(currentActiveTheme);
    } else {
        currentCustomThemeIndex = -1;
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
            const dataToSave = sortOrder ? { lastSortOrder: sortOrder } : { lastSortOrder: window.firestore.deleteField() };
            await window.firestore.setDoc(userProfileDocRef, dataToSave, { merge: true });
            logDebug('Sort: Saved sort order preference to Firestore: ' + sortOrder);
        } catch (error) {
            console.error('Sort: Error saving sort order preference to Firestore:', error);
        }
}

async function loadUserWatchlistsAndSettings() {
    if (!db || !currentUserId) {
        console.warn('User Settings: Firestore DB or User ID not available for loading settings.');
        window._appDataLoaded = false;
        hideSplashScreenIfReady();
        return;
    }
    userWatchlists = [];
    const watchlistsColRef = window.firestore ? window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists') : null;
    const userProfileDocRef = window.firestore ? window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings') : null;

    if (!watchlistsColRef || !userProfileDocRef) {
        console.error('User Settings: Firestore collection or doc reference is null. Cannot load settings.');
        showCustomAlert('Firestore services not fully initialized. Cannot load user settings.');
        window._appDataLoaded = false;
        hideSplashScreen();
        return;
    }

    try {
        logDebug('User Settings: Fetching user watchlists and profile settings...');
        const querySnapshot = await window.firestore.getDocs(window.firestore.query(watchlistsColRef));
        querySnapshot.forEach(doc => { userWatchlists.push({ id: doc.id, name: doc.data().name }); });
        logDebug('User Settings: Found ' + userWatchlists.length + ' existing watchlists.');

        if (!userWatchlists.some(wl => wl.id === CASH_BANK_WATCHLIST_ID)) {
            userWatchlists.push({ id: CASH_BANK_WATCHLIST_ID, name: 'Cash & Assets' });
            logDebug('User Settings: Added "Cash & Assets" to internal watchlists array.');
        }

        if (userWatchlists.length === 0) {
            const defaultWatchlistRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists/' + getDefaultWatchlistId(currentUserId));
            await window.firestore.setDoc(defaultWatchlistRef, { name: DEFAULT_WATCHLIST_NAME, createdAt: new Date().toISOString() });
            userWatchlists.push({ id: getDefaultWatchlistId(currentUserId), name: DEFAULT_WATCHLIST_NAME });
            logDebug('User Settings: Created default watchlist.');
        }
        userWatchlists.sort((a, b) => {
            if (a.id === CASH_BANK_WATCHLIST_ID) return 1;
            if (b.id === CASH_BANK_WATCHLIST_ID) return -1;
            return a.name.localeCompare(b.name);
        });

        const userProfileSnap = await window.firestore.getDoc(userProfileDocRef);
        savedSortOrder = null;
        savedTheme = null;

        if (userProfileSnap.exists()) {
            savedSortOrder = userProfileSnap.data().lastSortOrder;
            savedTheme = userProfileSnap.data().lastTheme;
            currentSelectedWatchlistIds = userProfileSnap.data().lastSelectedWatchlistIds;
            logDebug('User Settings: Found last selected watchlists in profile: ' + currentSelectedWatchlistIds);
            logDebug('User Settings: Found saved sort order in profile: ' + savedSortOrder);
            logDebug('User Settings: Found saved theme in profile: ' + savedTheme);
        }

        if (currentSelectedWatchlistIds && Array.isArray(currentSelectedWatchlistIds) && currentSelectedWatchlistIds.length > 0) {
            currentSelectedWatchlistIds = currentSelectedWatchlistIds.filter(id => 
                id === ALL_SHARES_ID || id === CASH_BANK_WATCHLIST_ID || userWatchlists.some(wl => wl.id === id)
            );

            const actualStockWatchlists = userWatchlists.filter(wl => wl.id !== ALL_SHARES_ID && wl.id !== CASH_BANK_WATCHLIST_ID);

            if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID) && actualStockWatchlists.length > 0) {
                currentSelectedWatchlistIds = [ALL_SHARES_ID];
                logDebug('User Settings: Saved preference was Cash & Assets, but stock watchlists exist. Defaulting to "All Shares" for initial view.');
            } else if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID) && actualStockWatchlists.length === 0) {
                 currentSelectedWatchlistIds = [CASH_BANK_WATCHLIST_ID];
                 logDebug('User Settings: Only Cash & Assets watchlist exists, defaulting to it.');
            }
            
            if (currentSelectedWatchlistIds.length === 0) {
                const firstNonCashWatchlist = userWatchlists.find(wl => wl.id !== CASH_BANK_WATCHLIST_ID);
                if (firstNonCashWatchlist) {
                     currentSelectedWatchlistIds = [firstNonCashWatchlist.id];
                     console.warn('User Settings: No valid watchlist selection after filtering, defaulting to first non-cash watchlist.');
                } else {
                     currentSelectedWatchlistIds = [CASH_BANK_WATCHLIST_ID];
                     console.warn('User Settings: No valid watchlist selection and no non-cash watchlists, defaulting to Cash & Assets.');
                }
            }
        } else {
            const firstNonCashWatchlist = userWatchlists.find(wl => wl.id !== CASH_BANK_WATCHLIST_ID);
            if (firstNonCashWatchlist) {
                 currentSelectedWatchlistIds = [firstNonCashWatchlist.id];
                 logDebug('User Settings: No saved watchlist preference, defaulting to first non-cash watchlist: ' + firstNonCashWatchlist.name);
            } else {
                 currentSelectedWatchlistIds = [CASH_BANK_WATCHLIST_ID];
                 logDebug('User Settings: No saved watchlist preference and no non-cash watchlists, defaulting to Cash & Assets: ' + userWatchlists[0].name);
            }
        }

        renderWatchlistSelect();
        
        if (currentUserId && savedSortOrder && Array.from(sortSelect.options).some(option => option.value === savedSortOrder)) {
            sortSelect.value = savedSortOrder;
            currentSortOrder = savedSortOrder;
            logDebug('Sort: Applied saved sort order: ' + currentSortOrder);
        } else {
            sortSelect.value = ''; 
            currentSortOrder = '';
            logDebug('Sort: No valid saved sort order or not logged in, defaulting to placeholder.');
        }
        renderSortSelect();
        
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

        const migratedSomething = await migrateOldSharesToWatchlist();
        if (!migratedSomething) {
            logDebug('Migration: No old shares to migrate/update, directly setting up shares listener for current watchlist.');
        }
        
        await loadShares();
        await loadCashCategories();

        renderWatchlist();

        window._appDataLoaded = true;
        hideSplashScreenIfReady();

    } catch (error) {
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
    if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
        console.log('Live Price: Skipping live price fetch because "Cash & Assets" is selected.');
        window._livePricesLoaded = true;
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
                const shareData = allSharesData.find(s => s.shareName.toUpperCase() === asxCode);
                const targetPrice = shareData && shareData.targetPrice !== null && !isNaN(parseFloat(shareData.targetPrice)) 
                                    ? parseFloat(shareData.targetPrice) 
                                    : undefined;

                const isTargetHit = (targetPrice !== undefined && livePrice <= targetPrice);

                console.log('Target Price Debug: Share: ' + asxCode + ', Live: ' + livePrice + ', Target: ' + targetPrice + ', Is Target Hit: ' + isTargetHit); 

                newLivePrices[asxCode] = {
                    live: livePrice,
                    prevClose: isNaN(prevClose) ? null : prevClose,
                    PE: isNaN(pe) ? null : pe, 
                    High52: isNaN(high52) ? null : high52, 
                    Low52: isNaN(low52) ? null : low52, 
                    targetHit: isTargetHit 
                };
            } else {
                console.warn('Live Price: Skipping item due to missing ASX code or invalid price:', item);
            }
        });
        livePrices = newLivePrices;
        console.log('Live Price: Live prices updated:', livePrices); 
        
        adjustMainContentPadding(); 
        
        window._livePricesLoaded = true;
        hideSplashScreenIfReady();
        
        updateTargetHitBanner();
    } catch (error) {
        console.error('Live Price: Error fetching live prices:', error);
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
    if (!currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
        fetchLivePrices(); 
        livePriceFetchInterval = setInterval(fetchLivePrices, LIVE_PRICE_FETCH_INTERVAL_MS);
        logDebug('Live Price: Started live price updates every ' + (LIVE_PRICE_FETCH_INTERVAL_MS / 1000 / 60) + ' minutes.');
    } else {
        logDebug('Live Price: Not starting live price updates because "Cash & Assets" is selected.');
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

/**
 * Updates the target hit notification icon.
 */
function updateTargetHitBanner() {
    sharesAtTargetPrice = allSharesData.filter(share => {
        const isShareInCurrentView = currentSelectedWatchlistIds.includes(ALL_SHARES_ID) || currentSelectedWatchlistIds.includes(share.watchlistId);
        
        const livePriceData = livePrices[share.shareName.toUpperCase()];
        return isShareInCurrentView && livePriceData && livePriceData.targetHit;
    });

    if (!targetHitIconBtn || !targetHitIconCount) {
        console.warn('Target Alert: Target hit icon elements not found. Cannot update icon.');
        return;
    }

    if (sharesAtTargetPrice.length > 0 && !targetHitIconDismissed && !currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
        targetHitIconCount.textContent = sharesAtTargetPrice.length;
        targetHitIconBtn.classList.remove('app-hidden');
        targetHitIconBtn.style.display = 'flex';
        targetHitIconCount.style.display = 'block';
        logDebug('Target Alert: Showing icon: ' + sharesAtTargetPrice.length + ' shares hit target (watchlist-specific check).');
    } else {
        targetHitIconBtn.classList.add('app-hidden');
        targetHitIconBtn.style.display = 'none';
        targetHitIconCount.style.display = 'none';
        logDebug('Target Alert: No shares hit target in current view or icon is dismissed or in cash view. Hiding icon.');
    }
}

/**
 * Renders alerts in the alert panel (placeholder).
 */
function renderAlertsInPanel() {
    if (!alertPanel) {
        console.warn('Alert Panel: Alert panel elements not found. Skipping renderAlertsInPanel.');
        return;
    }
    logDebug('Alert Panel: Rendering alerts in panel (placeholder).');
}


/**
 * Toggles the mobile view mode between default (single column) and compact (two columns).
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
    
    localStorage.setItem('currentMobileViewMode', currentMobileViewMode);
    renderWatchlist();
}

/**
 * Hides the splash screen with a fade-out effect.
 */
function hideSplashScreen() {
    if (splashScreen) {
        splashScreen.classList.add('hidden');
        if (splashKangarooIcon) {
            splashKangarooIcon.classList.remove('pulsing');
        }
        if (mainContainer) {
            mainContainer.classList.remove('app-hidden');
        }
        if (appHeader) {
            appHeader.classList.remove('app-hidden');
        }
        document.body.style.overflow = ''; 

        logDebug('Splash Screen: Hiding.');
    }
}

/**
 * Checks if all necessary app data is loaded and hides the splash screen if ready.
 */
function hideSplashScreenIfReady() {
    if (window._firebaseInitialized && window._userAuthenticated && window._appDataLoaded && window._livePricesLoaded) {
        if (splashScreenReady) {
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
 */
async function loadShares() {
    if (unsubscribeShares) {
        unsubscribeShares();
        unsubscribeShares = null;
        logDebug('Firestore Listener: Unsubscribed from previous shares listener.');
    }

    if (!db || !currentUserId || !window.firestore) {
        console.warn('Shares: Firestore DB, User ID, or Firestore functions not available for loading shares. Clearing list.');
        allSharesData = [];
        window._appDataLoaded = false;
        hideSplashScreen();
        return;
    }
    
    try {
        const sharesCol = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/shares');
        let q = window.firestore.query(sharesCol);

        unsubscribeShares = window.firestore.onSnapshot(q, async (querySnapshot) => { 
            logDebug('Firestore Listener: Shares snapshot received. Processing changes.');
            let fetchedShares = [];
            querySnapshot.forEach((doc) => {
                const share = { id: doc.id, ...doc.data() };
                fetchedShares.push(share);
            });

            allSharesData = fetchedShares;
            logDebug('Shares: Shares data updated from snapshot. Total shares: ' + allSharesData.length);
            
            sortShares();
            renderAsxCodeButtons();
            
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

/**
 * Sets up a real-time Firestore listener for cash categories.
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
        renderCashCategories();
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

            userCashCategories = fetchedCategories.sort((a, b) => a.name.localeCompare(b.name));
            logDebug('Cash Categories: Data updated from snapshot. Total categories: ' + userCashCategories.length);
            
            renderWatchlist();
            calculateTotalCash();

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
 * Clears the cash asset form.
 */
function clearCashAssetForm() {
    if (cashAssetNameInput) cashAssetNameInput.value = '';
    if (cashAssetBalanceInput) cashAssetBalanceInput.value = '';
    if (dynamicCashCommentsArea) dynamicCashCommentsArea.innerHTML = ''; // Clear comments
    selectedCashAssetDocId = null;
    originalCashAssetData = null;
    setIconDisabled(saveCashAssetBtn, true);
    logDebug('Cash Form: Cash asset form cleared.');
}

/**
 * Gets the current data from the cash asset form.
 * @returns {object} The current form data.
 */
function getCurrentCashAssetFormData() {
    const comments = [];
    if (dynamicCashCommentsArea) {
        dynamicCashCommentsArea.querySelectorAll('.comment-section').forEach(section => {
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
        comments: comments
    };
}

/**
 * Compares two cash asset data objects for equality.
 * @param {object} data1
 * @param {object} data2
 * @returns {boolean} True if equal, false otherwise.
 */
function areCashAssetDataEqual(data1, data2) {
    if (!data1 || !data2) return false;
    let balance1 = typeof data1.balance === 'number' && !isNaN(data1.balance) ? data1.balance : null;
    let balance2 = typeof data2.balance === 'number' && !isNaN(data2.balance) ? data2.balance : null;

    if (data1.name !== data2.name || balance1 !== balance2) return false;

    if (data1.comments.length !== data2.comments.length) return false;
    for (let i = 0; i < data1.comments.length; i++) {
        const comment1 = data1.comments[i];
        const comment2 = data2.comments[i];
        if (comment1.title !== comment2.title || comment1.text !== comment2.text) {
            return false;
        }
    }
    return true;
}

/**
 * Checks the dirty state of the cash asset form.
 */
function checkCashAssetFormDirtyState() {
    const currentData = getCurrentCashAssetFormData();
    const isNameValid = currentData.name.trim() !== '';
    let canSave = isNameValid;

    if (selectedCashAssetDocId && originalCashAssetData) {
        const isDirty = !areCashAssetDataEqual(originalCashAssetData, currentData);
        canSave = canSave && isDirty;
        if (!isDirty) {
            logDebug('Dirty State: Existing cash asset: No changes detected, save disabled.');
        }
    } else if (!selectedCashAssetDocId) {
        // For new cash assets, enable if name is valid
    }

    setIconDisabled(saveCashAssetBtn, !canSave);
    logDebug('Dirty State: Cash asset save button enabled: ' + canSave);
}

/**
 * Shows the add/edit cash category modal.
 * @param {string|null} assetIdToEdit The ID of the asset to edit, or null for new.
 */
function showAddEditCashCategoryModal(assetIdToEdit = null) {
    clearCashAssetForm();
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

        if (dynamicCashCommentsArea) {
            dynamicCashCommentsArea.innerHTML = '';
            if (assetToEdit.comments && Array.isArray(assetToEdit.comments) && assetToEdit.comments.length > 0) {
                assetToEdit.comments.forEach(comment => addCommentSection(dynamicCashCommentsArea, checkCashAssetFormDirtyState, comment.title, comment.text));
            } else {
                addCommentSection(dynamicCashCommentsArea, checkCashAssetFormDirtyState);
            }
        }

        setIconDisabled(deleteCashAssetBtn, false);
        originalCashAssetData = getCurrentCashAssetFormData();
        logDebug('Cash Form: Opened edit form for cash asset: ' + assetToEdit.name + ' (ID: ' + assetIdToEdit + ')');
    } else {
        cashFormTitle.textContent = 'Add New Cash Asset';
        setIconDisabled(deleteCashAssetBtn, true);
        originalCashAssetData = null;
        if (dynamicCashCommentsArea) {
            dynamicCashCommentsArea.innerHTML = '';
            addCommentSection(dynamicCashCommentsArea, checkCashAssetFormDirtyState);
        }
        logDebug('Cash Form: Opened add new cash asset form.');
    }
    setIconDisabled(saveCashAssetBtn, true);
    showModal(cashAssetFormModal);
    cashAssetNameInput.focus();
    checkCashAssetFormDirtyState();
}

/**
 * Saves cash asset data to Firestore.
 * @param {boolean} isSilent If true, no alert messages are shown on success.
 */
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
    if (dynamicCashCommentsArea) {
        dynamicCashCommentsArea.querySelectorAll('.comment-section').forEach(section => {
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
        balance: isNaN(assetBalance) ? 0 : assetBalance,
        comments: comments,
        userId: currentUserId,
        lastUpdated: new Date().toISOString()
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
            selectedCashAssetDocId = newDocRef.id;
            if (!isSilent) showCustomAlert('Cash asset \'' + assetName + '\' added successfully!', 1500);
            logDebug('Firestore: Cash asset \'' + assetName + '\' added with ID: ' + newDocRef.id);
        }
        originalCashAssetData = getCurrentCashAssetFormData();
        setIconDisabled(saveCashAssetBtn, true);
        if (!isSilent) closeModals();
    } catch (error) {
        console.error('Firestore: Error saving cash asset:', error);
        if (!isSilent) showCustomAlert('Error saving cash asset: ' + error.message);
    }
}

/**
 * Shows the cash category details modal.
 * @param {string} assetId The ID of the asset to display.
 */
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
    selectedCashAssetDocId = assetId;

    modalCashAssetName.textContent = asset.name || 'N/A';
    detailCashAssetName.textContent = asset.name || 'N/A';
    detailCashAssetBalance.textContent = '$' + (Number(asset.balance) !== null && !isNaN(Number(asset.balance)) ? Number(asset.balance).toFixed(2) : '0.00');
    detailCashAssetLastUpdated.textContent = formatDate(asset.lastUpdated) || 'N/A';

    if (detailCashCommentsContainer) {
        detailCashCommentsContainer.innerHTML = '';
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

                    detailCashCommentsContainer.appendChild(commentDiv);
                }
            });
        } else {
            detailCashCommentsContainer.innerHTML = '<p style="text-align: center; color: var(--label-color);">No comments for this cash asset.</p>';
        }
    }

    showModal(cashAssetDetailModal);
    logDebug('Details: Displayed details for cash asset: ' + asset.name + ' (ID: ' + assetId + ')');
}

/**
 * Toggles visibility of a cash asset.
 * @param {string} assetId The ID of the asset to toggle.
 */
function toggleCashAssetVisibility(assetId) {
    logDebug('Cash Asset Visibility: Toggling visibility for asset ID: ' + assetId);
    cashAssetVisibility[assetId] = cashAssetVisibility[assetId] !== false;

    const assetElement = cashCategoriesContainer.querySelector(`.cash-category-item[data-id="${assetId}"]`);
    if (assetElement) {
        if (cashAssetVisibility[assetId] === false) {
            assetElement.classList.add('hidden');
            assetElement.querySelector('.hide-toggle-btn').innerHTML = '<i class="fas fa-eye-slash"></i>';
            assetElement.querySelector('.hide-toggle-btn').title = 'Show Asset';
            assetElement.querySelector('.hide-toggle-btn').classList.add('hidden-icon');
            logDebug('Cash Asset Visibility: Asset ' + assetId + ' is now HIDDEN.');
        } else {
            assetElement.classList.remove('hidden');
            assetElement.querySelector('.hide-toggle-btn').innerHTML = '<i class="fas fa-eye"></i>';
            assetElement.querySelector('.hide-toggle-btn').title = 'Hide Asset';
            assetElement.querySelector('.hide-toggle-btn').classList.remove('hidden-icon');
            logDebug('Cash Asset Visibility: Asset ' + assetId + ' is now VISIBLE.');
        }
    }
    calculateTotalCash();
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


// Custom Confirm Dialog Function (Now unused for deletions, but kept for potential future use)
function showCustomConfirm(message, callback) {
    if (!customDialogModal || !customDialogMessage || !customDialogConfirmBtn || !customDialogCancelBtn) {
        console.error('Custom dialog elements not found. Cannot show confirm.');
        console.log('CONFIRM (fallback): ' + message);
        callback(window.confirm(message));
        return;
    }
    customDialogMessage.textContent = message;
    customDialogConfirmBtn.style.display = 'inline-flex';
    setIconDisabled(customDialogConfirmBtn, false);
    customDialogCancelBtn.style.display = 'inline-flex';
    setIconDisabled(customDialogCancelBtn, false);

    showModal(customDialogModal);

    const onConfirm = () => {
        hideModal(customDialogModal);
        customDialogConfirmBtn.removeEventListener('click', onConfirm);
        customDialogCancelBtn.removeEventListener('click', onCancel);
        callback(true);
        logDebug('Confirm: User confirmed.');
    };

    const onCancel = () => {
        hideModal(customDialogModal);
        customDialogConfirmBtn.removeEventListener('click', onConfirm);
        customDialogCancelBtn.removeEventListener('click', onCancel);
        callback(false);
        logDebug('Confirm: User cancelled.');
    };

    customDialogConfirmBtn.addEventListener('click', onConfirm);
    customDialogCancelBtn.addEventListener('click', onCancel);
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
        mainTitle.textContent = 'Cash & Assets';
    } else {
        mainTitle.textContent = selectedText;
    }
    logDebug('UI: Main title updated to: ' + mainTitle.textContent);
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
            anyMigrationPerformed = true;
        } else {
            logDebug('Migration: No old shares found requiring migration or schema update.');
        }
        return anyMigrationPerformed;
    } catch (error) {
        console.error('Migration: Error during data migration: ' + error.message);
        showCustomAlert('Error during data migration: ' + error.message);
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
            sidebarOverlay.style.pointerEvents = 'auto';
            logDebug('Sidebar: Mobile: Sidebar opened, body NOT shifted, overlay pointer-events: auto.');
        }
        logDebug('Sidebar: Sidebar opened.');
    } else if (forceState === false || (forceState === null && isOpen)) {
        appSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
        document.body.classList.remove('sidebar-active');
        document.body.style.overflow = '';
        sidebarOverlay.style.pointerEvents = 'none';
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
    
    if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
        showCustomAlert('Cash & Assets data cannot be exported via this function. Please switch to a stock watchlist.', 3000);
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
        sharesToExport = [...allSharesData];
        exportFileNamePrefix = 'all_shares';
    }

    if (sharesToExport.length === 0) {
        showCustomAlert('No shares in the current selection to export.', 2000);
        return;
    }

    const headers = [
        'Code', 'Entered Price', 'Live Price', 'Price Change', 'Target Price', 'Dividend Amount', 'Franking Credits (%)',
        'Unfranked Yield (%)', 'Franked Yield (%)', 'Entry Date'
    ];

    const csvRows = [];
    csvRows.push(headers.map(escapeCsvValue).join(','));

    sharesToExport.forEach(share => {
        const enteredPriceNum = Number(share.currentPrice);
        const dividendAmountNum = Number(share.dividendAmount);
        const frankingCreditsNum = Number(share.frankingCredits);
        const targetPriceNum = Number(share.targetPrice);

        const livePriceData = livePrices[share.shareName.toUpperCase()];
        const livePrice = livePriceData ? livePriceData.live : undefined;
        const prevClosePrice = livePriceData ? livePriceData.prevClose : undefined;

        let priceChange = '';
        if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice) && 
            prevClosePrice !== undefined && prevClosePrice !== null && !isNaN(prevClosePrice)) {
            const change = livePrice - prevClosePrice;
            const percentageChange = (prevClosePrice !== 0 && !isNaN(prevClosePrice)) ? (change / prevClosePrice) * 100 : 0;
            priceChange = change.toFixed(2) + ' (' + percentageChange.toFixed(2) + '%)';
        }

        const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;

        const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, priceForYield);
        const frankedYield = calculateFrankedYield(dividendAmountNum, priceForYield, frankingCreditsNum);

        const row = [
            share.shareName || '',
            (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? enteredPriceNum.toFixed(2) : '',
            (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice.toFixed(2) : '',
            priceChange,
            (!isNaN(targetPriceNum) && targetPriceNum !== null) ? targetPriceNum.toFixed(2) : '',
            (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? dividendAmountNum.toFixed(3) : '',
            (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? frankingCreditsNum.toFixed(1) : '',
            unfrankedYield !== null && !isNaN(unfrankedYield) ? unfrankedYield.toFixed(2) : '0.00',
            frankedYield !== null && !isNaN(frankedYield) ? frankedYield.toFixed(2) : '0.00',
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

    if (!isAddModal && originalWatchlistData) {
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

    const isDuplicate = userWatchlists.some(w => 
        w.name.toLowerCase() === newName.toLowerCase() && w.id !== watchlistId
    );
    if (isDuplicate) {
        if (!isSilent) showCustomAlert('A watchlist with this name already exists!');
        console.warn('Save Watchlist: Duplicate watchlist name. Skipping save.');
        return;
    }

    try {
        if (watchlistId) {
            const watchlistDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists', watchlistId);
            await window.firestore.updateDoc(watchlistDocRef, { name: newName });
            if (!isSilent) showCustomAlert('Watchlist renamed to \'' + newName + '\'!', 1500);
            logDebug('Firestore: Watchlist (ID: ' + watchlistId + ') renamed to \'' + newName + '\'.');
        } else {
            const watchlistsColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/watchlists');
            const newDocRef = await window.firestore.addDoc(watchlistsColRef, {
                name: newName,
                createdAt: new Date().toISOString(),
                userId: currentUserId
            });
            if (!isSilent) showCustomAlert('Watchlist \'' + newName + '\' added!', 1500);
            logDebug('Firestore: Watchlist \'' + newName + '\' added with ID: ' + newDocRef.id);
            currentSelectedWatchlistIds = [newDocRef.id];
            await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds);
        }
        
        await loadUserWatchlistsAndSettings();
        if (!isSilent) closeModals();
        originalWatchlistData = getCurrentWatchlistFormData(watchlistId === null);
        checkWatchlistFormDirtyState(watchlistId === null);
    } catch (error) {
        console.error('Firestore: Error saving watchlist:', error);
        if (!isSilent) showCustomAlert('Error saving watchlist: ' + error.message);
    }
}


async function initializeAppLogic() {
    logDebug('initializeAppLogic: Firebase is ready. Starting app logic.');

    if (shareFormSection) shareFormSection.style.setProperty('display', 'none', 'important');
    if (dividendCalculatorModal) dividendCalculatorModal.style.setProperty('display', 'none', 'important');
    if (shareDetailModal) shareDetailModal.style.setProperty('display', 'none', 'important');
    if (addWatchlistModal) addWatchlistModal.style.setProperty('display', 'none', 'important');
    if (manageWatchlistModal) manageWatchlistModal.style.setProperty('display', 'none', 'important');
    if (customDialogModal) customDialogModal.style.setProperty('display', 'none', 'important');
    if (calculatorModal) calculatorModal.style.setProperty('display', 'none', 'important');
    if (shareContextMenu) shareContextMenu.style.setProperty('display', 'none', 'important');
    if (targetHitIconBtn) targetHitIconBtn.style.display = 'none';
    if (alertPanel) alertPanel.style.display = 'none';
    if (cashAssetFormModal) cashAssetFormModal.style.setProperty('display', 'none', 'important');
    if (cashAssetDetailModal) cashAssetDetailModal.style.setProperty('display', 'none', 'important');


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

    const savedMobileViewMode = localStorage.getItem('currentMobileViewMode');
    if (savedMobileViewMode && (savedMobileViewMode === 'default' || savedMobileViewMode === 'compact')) {
        currentMobileViewMode = savedMobileViewMode;
        if (mobileShareCardsContainer) {
            if (currentMobileViewMode === 'compact') {
                mobileShareCardsContainer.classList.add('compact-view');
            } else {
                mobileShareCardsContainer.classList.remove('compact-view');
            }
        }
        logDebug('View Mode: Loaded saved preference: ' + currentMobileViewMode + ' view.');
    } else {
        logDebug('View Mode: No saved mobile view preference, defaulting to \'default\'.');
        currentMobileViewMode = 'default';
        if (mobileShareCardsContainer) {
             mobileShareCardsContainer.classList.remove('compact-view');
        }
    }


    if (shareNameInput) {
        shareNameInput.addEventListener('input', function() { 
            this.value = this.value.toUpperCase(); 
            checkFormDirtyState();
        });
    }

    formInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', checkFormDirtyState);
            input.addEventListener('change', checkFormDirtyState);
            input.addEventListener('focus', function() {
                this.select();
            });
        }
    });

    if (shareWatchlistSelect) {
        shareWatchlistSelect.addEventListener('change', checkFormDirtyState);
    }

    if (cashAssetNameInput) cashAssetNameInput.addEventListener('input', checkCashAssetFormDirtyState);
    if (cashAssetBalanceInput) cashAssetBalanceInput.addEventListener('input', checkCashAssetFormDirtyState);

    if (addCashCommentSectionBtn) {
        setIconDisabled(addCashCommentSectionBtn, false);
        addCashCommentSectionBtn.addEventListener('click', () => {
            addCommentSection(dynamicCashCommentsArea, checkCashAssetFormDirtyState);
            checkCashAssetFormDirtyState();
        });
    }


    formInputs.forEach((input, index) => {
        if (input) {
            input.addEventListener('keydown', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    if (index === formInputs.length - 1) {
                        if (addCommentSectionBtn && addCommentSectionBtn.offsetParent !== null && !addCommentSectionBtn.classList.contains('is-disabled-icon')) { 
                            addCommentSection(commentsFormContainer, checkFormDirtyState); // Pass commentsFormContainer
                            const newCommentTitleInput = commentsFormContainer.lastElementChild?.querySelector('.comment-title-input');
                            if (newCommentTitleInput) {
                                newCommentTitleInput.focus();
                            }
                        } else if (saveShareBtn && !saveShareBtn.classList.contains('is-disabled-icon')) { 
                            saveShareBtn.click();
                        }
                    } else {
                        if (formInputs[index + 1]) formInputs[index + 1].focus();
                    }
                }
            });
        }
    });

    if (addCommentSectionBtn) {
        setIconDisabled(addCommentSectionBtn, false);
        addCommentSectionBtn.addEventListener('click', () => {
            addCommentSection(commentsFormContainer, checkFormDirtyState); // Pass commentsFormContainer
            checkFormDirtyState();
        });
    }

    document.querySelectorAll('.close-button').forEach(button => {
        if (button.classList.contains('form-close-button')) {
            button.addEventListener('click', () => {
                logDebug('Form: Share form close button (X) clicked. Clearing form before closing to cancel edits.');
                clearForm();
                closeModals();
            });
        } else if (button.classList.contains('cash-form-close-button')) {
            button.addEventListener('click', () => {
                logDebug('Cash Form: Cash asset form close button (X) clicked. Clearing form before closing to cancel edits.');
                clearCashAssetForm();
                closeModals();
            });
        }
        else {
            button.addEventListener('click', closeModals);
        }
    });

    window.addEventListener('click', (event) => {
        if (event.target === shareDetailModal || event.target === dividendCalculatorModal ||
            event.target === shareFormSection || event.target === customDialogModal ||
            event.target === calculatorModal || event.target === addWatchlistModal ||
            event.target === manageWatchlistModal || event.target === alertPanel ||
            event.target === cashAssetFormModal || event.target === cashAssetDetailModal) {
            closeModals();
        }

        if (contextMenuOpen && shareContextMenu && !shareContextMenu.contains(event.target)) {
            hideContextMenu();
        }
    });

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
                if (splashKangarooIcon) {
                    splashKangarooIcon.classList.add('pulsing');
                    logDebug('Splash Screen: Started pulsing animation on sign-in click.');
                }
                splashSignInBtn.disabled = true;
                
                const provider = window.authFunctions.GoogleAuthProviderInstance;
                if (!provider) {
                    console.error('Auth: GoogleAuthProvider instance not found. Is Firebase module script loaded?');
                    showCustomAlert('Authentication service not ready. Please ensure Firebase module script is loaded.');
                    splashSignInBtn.disabled = false;
                    if (splashKangarooIcon) splashKangarooIcon.classList.remove('pulsing');
                    return;
                }
                await window.authFunctions.signInWithPopup(currentAuth, provider);
                logDebug('Auth: Google Sign-In successful from splash screen.');
            }
            catch (error) {
                console.error('Auth: Google Sign-In failed from splash screen: ' + error.message);
                showCustomAlert('Google Sign-In failed: ' + error.message);
                splashSignInBtn.disabled = false;
                if (splashKangarooIcon) splashKangarooIcon.classList.remove('pulsing');
            }
        });
    }

    if (targetHitIconBtn) {
        targetHitIconBtn.addEventListener('click', (event) => {
            logDebug('Target Alert: Icon button clicked. Dismissing icon.');
            targetHitIconDismissed = true;
            localStorage.setItem('targetHitIconDismissed', 'true');
            updateTargetHitBanner();
            showCustomAlert('Alerts dismissed for this session.', 1500);
            renderWatchlist();
        });
    }

    if (renderAlertsInPanel) { // Check if the function exists before calling
        renderAlertsInPanel();
    }

    if (closeAlertPanelBtn) {
        closeAlertPanelBtn.addEventListener('click', () => {
            logDebug('Alert Panel: Close button clicked.');
        });
    }

    if (clearAllAlertsBtn) {
        clearAllAlertsBtn.addEventListener('click', () => {
            logDebug('Alert Panel: Clear All button clicked.');
            sharesAtTargetPrice = [];
            updateTargetHitBanner();
            showCustomAlert('All alerts cleared for this session.', 1500);
        });
    }


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

                if (splashScreen) {
                    splashScreen.style.display = 'flex';
                    splashScreen.classList.remove('hidden');
                    document.body.style.overflow = 'hidden';
                    if (splashKangarooIcon) {
                        splashKangarooIcon.classList.remove('pulsing');
                    }
                    if (splashSignInBtn) {
                        splashSignInBtn.disabled = false;
                        splashSignInBtn.textContent = 'Google Sign In';
                    }
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
                targetHitIconDismissed = false;
                localStorage.removeItem('targetHitIconDismissed');

            }
            catch (error) {
                console.error('Auth: Logout failed:', error);
                showCustomAlert('Logout failed: ' + error.message);
            }
        });
    }

    if (watchlistSelect) {
        watchlistSelect.addEventListener('change', async (event) => {
            logDebug('Watchlist Select: Change event fired. New value: ' + event.target.value);
            currentSelectedWatchlistIds = [event.target.value];
            await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds);
            renderWatchlist();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', async (event) => {
            logDebug('Sort Select: Change event fired. New value: ' + event.target.value);
            currentSortOrder = sortSelect.value;
            sortShares();
            await saveSortOrderPreference(currentSortOrder);
        });
    }

    if (newShareBtn) {
        newShareBtn.addEventListener('click', () => {
            logDebug('UI: New Share button (sidebar) clicked.');
            clearForm();
            formTitle.textContent = 'Add New Share';
            if (deleteShareBtn) { deleteShareBtn.classList.add('hidden'); }
            populateShareWatchlistSelect(null, true);
            showModal(shareFormSection);
            shareNameInput.focus();
            toggleAppSidebar(false);
            addCommentSection(commentsFormContainer, checkFormDirtyState); // Pass commentsFormContainer
            checkFormDirtyState();
        });
    }

    if (addShareHeaderBtn) {
        addShareHeaderBtn.addEventListener('click', () => {
            logDebug('UI: Add Share button (header) clicked.');
            if (currentSelectedWatchlistIds.includes(CASH_BANK_WATCHLIST_ID)) {
                showAddEditCashCategoryModal();
            } else {
                clearForm();
                formTitle.textContent = 'Add New Share';
                if (deleteShareBtn) { deleteShareBtn.classList.add('hidden'); }
                populateShareWatchlistSelect(null, true);
                showModal(shareFormSection);
                shareNameInput.focus();
                addCommentSection(commentsFormContainer, checkFormDirtyState); // Pass commentsFormContainer
                checkFormDirtyState();
            }
        });
    }

    if (shareNameInput && saveShareBtn) {
        shareNameInput.addEventListener('input', () => {
            checkFormDirtyState(); 
        });
    }

    if (saveShareBtn) {
        saveShareBtn.addEventListener('click', async () => {
            logDebug('Share Form: Save Share button clicked.');
            saveShareData(false);
        });
    }

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

    if (addWatchlistBtn) {
        addWatchlistBtn.addEventListener('click', () => {
            logDebug('UI: Add Watchlist button clicked.');
            if (newWatchlistNameInput) newWatchlistNameInput.value = '';
            setIconDisabled(saveWatchlistBtn, true);
            logDebug('Add Watchlist: saveWatchlistBtn disabled initially.');
            originalWatchlistData = getCurrentWatchlistFormData(true);
            showModal(addWatchlistModal);
            newWatchlistNameInput.focus();
            toggleAppSidebar(false);
            checkWatchlistFormDirtyState(true);
        });
    }

    if (newWatchlistNameInput && saveWatchlistBtn) {
        newWatchlistNameInput.addEventListener('input', () => {
            checkWatchlistFormDirtyState(true);
        });
    }

    if (saveWatchlistBtn) {
        saveWatchlistBtn.addEventListener('click', async () => {
            logDebug('Watchlist Form: Save Watchlist button clicked.');
            if (saveWatchlistBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert('Please enter a watchlist name.');
                console.warn('Save Watchlist: Save button was disabled, preventing action.');
                return;
            }
            const watchlistName = newWatchlistNameInput.value.trim();
            await saveWatchlistChanges(false, watchlistName);
        });
    }

    if (editWatchlistBtn) {
        editWatchlistBtn.addEventListener('click', () => {
            logDebug('UI: Edit Watchlist button clicked.');
            let watchlistToEditId = watchlistSelect.value;

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
            const actualWatchlists = userWatchlists.filter(wl => wl.id !== ALL_SHARES_ID && wl.id !== CASH_BANK_WATCHLIST_ID);
            const isDisabledDelete = actualWatchlists.length <= 1; 
            setIconDisabled(deleteWatchlistInModalBtn, isDisabledDelete); 
            logDebug('Edit Watchlist: deleteWatchlistInModalBtn disabled: ' + isDisabledDelete);
            setIconDisabled(saveWatchlistNameBtn, true);
            logDebug('Edit Watchlist: saveWatchlistNameBtn disabled initially.');
            originalWatchlistData = getCurrentWatchlistFormData(false);
            showModal(manageWatchlistModal);
            editWatchlistNameInput.focus();
            toggleAppSidebar(false);
            checkWatchlistFormDirtyState(false);
        });
    }

    if (editWatchlistNameInput && saveWatchlistNameBtn) {
        editWatchlistNameInput.addEventListener('input', () => {
            checkWatchlistFormDirtyState(false);
        });
    }

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
            await saveWatchlistChanges(false, newName, watchlistToEditId);
        });
    }

    if (deleteWatchlistInModalBtn) {
        deleteWatchlistInModalBtn.addEventListener('click', async () => {
            logDebug('Manage Watchlist Form: Delete Watchlist button clicked (Direct Delete).');
            if (deleteWatchlistInModalBtn.classList.contains('is-disabled-icon')) {
                console.warn('Delete Watchlist In Modal: Delete button was disabled, preventing action.');
                return;
            }

            let watchlistToDeleteId = watchlistSelect.value;

            if (watchlistToDeleteId === ALL_SHARES_ID || watchlistToDeleteId === CASH_BANK_WATCHLIST_ID) {
                showCustomAlert('Cannot delete this special watchlist.', 2000);
                return;
            }

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

                currentSelectedWatchlistIds = [ALL_SHARES_ID];
                await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds);

                await loadUserWatchlistsAndSettings();
            } catch (error) {
                console.error('Firestore: Error deleting watchlist:', error);
                showCustomAlert('Error deleting watchlist: ' + error.message);
            }
        });
    }

    if (dividendCalcBtn) {
        dividendCalcBtn.addEventListener('click', () => {
            logDebug('UI: Dividend button clicked. Attempting to open modal.');
            if (calcDividendAmountInput) calcDividendAmountInput.value = ''; 
            if (calcCurrentPriceInput) calcCurrentPriceInput.value = ''; 
            if (calcFrankingCreditsInput) calcFrankingCreditsInput.value = ''; 
            if (calcUnfrankedYieldSpan) calcUnfrankedYieldSpan.textContent = '-'; 
            if (calcFrankedYieldSpan) calcFrankedYieldSpan.textContent = '-'; 
            if (calcEstimatedDividend) calcEstimatedDividend.textContent = '-'; 
            if (investmentValueSelect) investmentValueSelect.value = '10000';
            showModal(dividendCalculatorModal);
            if (calcCurrentPriceInput) calcCurrentPriceInput.focus(); 
            logDebug('UI: Dividend Calculator modal opened.');
            toggleAppSidebar(false);
        });
    }

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

    if (standardCalcBtn) {
        standardCalcBtn.addEventListener('click', () => {
            logDebug('UI: Standard Calculator button clicked.');
            resetCalculator();
            showModal(calculatorModal);
            logDebug('UI: Standard Calculator modal opened.');
            toggleAppSidebar(false);
        });
    }

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

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            logDebug('Theme Debug: Random Theme Toggle button clicked.');
            if (CUSTOM_THEMES.length > 0) {
                let randomIndex;
                let newThemeName;
                do {
                    randomIndex = Math.floor(Math.random() * CUSTOM_THEMES.length);
                    newThemeName = CUSTOM_THEMES[randomIndex];
                } while (newThemeName === currentActiveTheme && CUSTOM_THEMES.length > 1);

                logDebug('Theme Debug: Selected random nextThemeName: ' + newThemeName);
                applyTheme(newThemeName);
            } else {
                logDebug('Theme Debug: No custom themes defined. Defaulting to system-default.');
                applyTheme('system-default');
            }
        });
    }

    if (colorThemeSelect) {
        colorThemeSelect.addEventListener('change', (event) => {
            logDebug('Theme: Color theme select changed to: ' + event.target.value);
            const selectedTheme = event.target.value;
            if (selectedTheme === 'none') {
                applyTheme('system-default');
            } else {
                applyTheme(selectedTheme);
            }
        });
    }

    if (revertToDefaultThemeBtn) {
        revertToDefaultThemeBtn.addEventListener('click', async (event) => {
            logDebug('Theme Debug: Revert to Default Theme button clicked (now toggling Light/Dark).');
            event.preventDefault();

            const body = document.body;
            let targetTheme;

            body.className = body.className.split(' ').filter(c => !c.startsWith('theme-')).join(' ');
            body.removeAttribute('data-theme');
            localStorage.removeItem('selectedTheme');

            if (currentActiveTheme === 'light') {
                targetTheme = 'dark';
                body.classList.add('dark-theme');
                logDebug('Theme: Toggled from Light to Dark theme.');
            } else if (currentActiveTheme === 'dark') {
                targetTheme = 'light';
                body.classList.remove('dark-theme');
                logDebug('Theme: Toggled from Dark to Light theme.');
            } else {
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
            
            currentActiveTheme = targetTheme;
            localStorage.setItem('theme', targetTheme);
            
            if (currentUserId && db && window.firestore) {
                const userProfileDocRef = window.firestore.doc(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/profile/settings');
                try {
                    await window.firestore.setDoc(userProfileDocRef, { lastTheme: targetTheme }, { merge: true });
                    logDebug('Theme: Error saving explicit Light/Dark theme preference to Firestore:', error);
                } catch (error) {
                    console.error('Theme: Error saving explicit Light/Dark theme preference to Firestore:', error);
                }
            }
            updateThemeToggleAndSelector();
        });
    }

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
        
        sidebarOverlay.addEventListener('click', (event) => {
            logDebug('Sidebar Overlay: Clicked overlay. Attempting to close sidebar.');
            if (appSidebar.classList.contains('open') && event.target === sidebarOverlay) {
                toggleAppSidebar(false);
            }
        });

        document.addEventListener('click', (event) => {
            const isDesktop = window.innerWidth > 768;
            if (appSidebar.classList.contains('open') && isDesktop &&
                !appSidebar.contains(event.target) && !hamburgerBtn.contains(event.target)) {
                logDebug('Global Click: Clicked outside sidebar on desktop. Closing sidebar.');
                toggleAppSidebar(false);
            }
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

    if (exportWatchlistBtn) {
        exportWatchlistBtn.addEventListener('click', () => {
            logDebug('UI: Export Watchlist button clicked.');
            exportWatchlistToCSV();
            toggleAppSidebar(false);
        });
    }

    if (refreshLivePricesBtn) {
        refreshLivePricesBtn.addEventListener('click', () => {
            logDebug('UI: Refresh Live Prices button clicked.');
            fetchLivePrices();
            showCustomAlert('Refreshing live prices...', 1000);
            toggleAppSidebar(false);
        });
    }

    if (toggleCompactViewBtn) {
        logDebug('DEBUG: Attaching click listener to toggleCompactViewBtn.');
        toggleCompactViewBtn.addEventListener('click', () => {
            logDebug('UI: Toggle Compact View button clicked.');
            toggleMobileViewMode();
            toggleAppSidebar(false);
        });
    }

    if (addCashCategoryBtn) { // This button is removed from HTML, so this listener will not fire
        addCashCategoryBtn.addEventListener('click', () => {
            logDebug('UI: Add Cash Category button clicked.');
            showAddEditCashCategoryModal();
        });
    }

    if (saveCashBalancesBtn) { // This button is removed from HTML, so this listener will not fire
        saveCashBalancesBtn.addEventListener('click', () => {
            logDebug('UI: Save Cash Balances button clicked.');
            // This function is now not used for direct saving from main view.
            // Saving happens through the cash asset form modal.
            showCustomAlert('Saving cash balances is now done via the Add/Edit Cash Asset modal.', 2000);
        });
    }

    if (newCashAssetBtn) { // New button in sidebar
        newCashAssetBtn.addEventListener('click', () => {
            logDebug('UI: Add New Cash Asset button (sidebar) clicked.');
            showAddEditCashCategoryModal();
            toggleAppSidebar(false);
        });
    }

    if (saveCashAssetBtn) {
        saveCashAssetBtn.addEventListener('click', async () => {
            logDebug('Cash Form: Save Cash Asset button clicked.');
            if (saveCashAssetBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert('Asset name and balance are required, or no changes made.');
                console.warn('Save Cash Asset: Save button was disabled, preventing action.');
                return;
            }
            await saveCashAsset(false);
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
                await deleteCashCategory(selectedCashAssetDocId);
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
}

document.addEventListener('DOMContentLoaded', function() {
    logDebug('script.js DOMContentLoaded fired.');

    window._firebaseInitialized = false;
    window._userAuthenticated = false;
    window._appDataLoaded = false;
    window._livePricesLoaded = false;
    window._appLogicInitialized = false;

    if (splashScreen) {
        splashScreen.style.display = 'flex';
        splashScreen.classList.remove('hidden');
        splashScreenReady = true;
        document.body.style.overflow = 'hidden';
        logDebug('Splash Screen: Displayed on DOMContentLoaded, body overflow hidden.');
    } else {
        console.warn('Splash Screen: Splash screen element not found. App will start without it.');
        window._firebaseInitialized = true;
        window._userAuthenticated = false;
        window._appDataLoaded = true;
        window._livePricesLoaded = true;
        window._appLogicInitialized = true;
    }

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
        window._firebaseInitialized = true;
        logDebug('Firebase Ready: DB, Auth, and AppId assigned from window. Setting up auth state listener.');
        
        window.authFunctions.onAuthStateChanged(auth, async (user) => {
            if (!window._appLogicInitialized) {
                initializeAppLogic();
                window._appLogicInitialized = true;
            }

            if (user) {
                currentUserId = user.uid;
                logDebug('AuthState: User signed in: ' + user.uid);
                logDebug('AuthState: User email: ' + user.email);
                if (user.email && user.email.toLowerCase() === KANGA_EMAIL) {
                    mainTitle.textContent = 'Kanga\'s Share Watchlist';
                    logDebug('AuthState: Main title set to Kanga\'s Share Watchlist.');
                } else {
                    mainTitle.textContent = 'My Share Watchlist';
                    logDebug('AuthState: Main title set to My Share Watchlist.');
                }
                updateMainButtonsState(true);
                window._userAuthenticated = true;
                
                if (mainContainer) {
                    mainContainer.classList.remove('app-hidden');
                }
                if (appHeader) {
                    appHeader.classList.remove('app-hidden');
                }
                adjustMainContentPadding();

                if (splashKangarooIcon) {
                    splashKangarooIcon.classList.add('pulsing');
                    logDebug('Splash Screen: Started pulsing animation after sign-in.');
                }
                
                targetHitIconDismissed = localStorage.getItem('targetHitIconDismissed') === 'true';

                await loadUserWatchlistsAndSettings();
                await fetchLivePrices();

                if (currentMobileViewMode === 'compact' && mobileShareCardsContainer) {
                    mobileShareCardsContainer.classList.add('compact-view');
                } else if (mobileShareCardsContainer) {
                    mobileShareCardsContainer.classList.remove('compact-view');
                }

            } else {
                currentUserId = null;
                mainTitle.textContent = 'Share Watchlist';
                logDebug('AuthState: User signed out.');
                updateMainButtonsState(false);
                clearShareList();
                clearWatchlistUI();
                userCashCategories = [];
                if (cashCategoriesContainer) cashCategoriesContainer.innerHTML = '';
                if (totalCashDisplay) totalCashDisplay.textContent = '$0.00';
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                applyTheme('system-default');
                if (unsubscribeShares) {
                    unsubscribeShares();
                    unsubscribeShares = null;
                    logDebug('Firestore Listener: Unsubscribed from shares listener on logout.');
                }
                if (unsubscribeCashCategories) {
                    unsubscribeCashCategories();
                    unsubscribeCashCategories = null;
                    logDebug('Firestore Listener: Unsubscribed from cash categories listener on logout.');
                }
                stopLivePriceUpdates();
                
                window._userAuthenticated = false;
                if (splashScreen) {
                    splashScreen.style.display = 'flex';
                    splashScreen.classList.remove('hidden');
                    document.body.style.overflow = 'hidden';
                    if (splashKangarooIcon) {
                        splashKangarooIcon.classList.remove('pulsing');
                    }
                    if (splashSignInBtn) {
                        splashSignInBtn.disabled = false;
                        splashSignInBtn.textContent = 'Google Sign In';
                    }
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
                targetHitIconDismissed = false;
                localStorage.removeItem('targetHitIconDismissed');

                renderWatchlist();
            }
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
        adjustMainContentPadding();
        hideSplashScreen();
    }
});
