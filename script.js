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
const CASH_BANK_WATCHLIST_ID = 'cashBank'; // NEW: Special ID for the "Cash & Assets" option
let currentSortOrder = 'entryDate-desc'; // Default sort order
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
let unsubscribeCashCategories = null; // NEW: Holds the unsubscribe function for Firestore cash categories listener

// NEW: Global variable to store shares that have hit their target price
let sharesAtTargetPrice = [];

// NEW: Global variable to track the current mobile view mode ('default' or 'compact')
let currentMobileViewMode = 'default'; 

// NEW: Global variable to track if the target hit icon is dismissed for the current session
let targetHitIconDismissed = false;

// NEW: Global variable to store cash categories data
let userCashCategories = [];
let selectedCashAssetDocId = null; // NEW: To track selected cash asset for edit/detail
let originalCashAssetData = null; // NEW: For dirty state check on cash asset form

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
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn');
const refreshLivePricesBtn = document.getElementById('refreshLivePricesBtn');
const shareWatchlistSelect = document.getElementById('shareWatchlistSelect');
const modalLivePriceDisplaySection = document.querySelector('.live-price-display-section'); 
const targetHitIconBtn = document.getElementById('targetHitIconBtn'); // NEW: Reference to the icon button
const targetHitIconCount = document.getElementById('targetHitIconCount'); // NEW: Reference to the count span
const toggleCompactViewBtn = document.getElementById('toggleCompactViewBtn');
const splashScreen = document.getElementById('splashScreen');
const splashKangarooIcon = document.getElementById('splashKangarooIcon');
const splashSignInBtn = document.getElementById('splashSignInBtn');
const alertPanel = document.getElementById('alertPanel'); // NEW: Reference to the alert panel (not in current HTML, but kept for consistency)
const alertList = document.getElementById('alertList'); // NEW: Reference to the alert list container (not in current HTML, but kept for consistency)
const closeAlertPanelBtn = document.getElementById('closeAlertPanelBtn'); // NEW: Reference to close alert panel button (not in current HTML, but kept for consistency)
const clearAllAlertsBtn = document.getElementById('clearAllAlertsBtn'); // NEW: Reference to clear all alerts button (not in current HTML, but kept for consistency)

// NEW: Cash & Assets UI Elements (Renamed from Cash & Bank)
const stockWatchlistSection = document.getElementById('stockWatchlistSection');
const cashAssetSection = document.getElementById('cashAssetSection'); // Renamed
const cashAssetListDisplay = document.getElementById('cashAssetListDisplay'); // New container for display
const totalCashDisplay = document.getElementById('totalCashDisplay');

// NEW: Cash Asset Modals
const cashAssetFormModal = document.getElementById('cashAssetFormModal');
const cashAssetFormTitle = document.getElementById('cashAssetFormTitle');
const cashAssetNameInput = document.getElementById('cashAssetName');
const cashAssetBalanceInput = document.getElementById('cashAssetBalance');
const saveCashAssetBtn = document.getElementById('saveCashAssetBtn');
const deleteCashAssetBtn = document.getElementById('deleteCashAssetBtn');
const cashAssetFormCloseButton = document.querySelector('.cash-asset-form-close-button'); // Specific close button for this modal

const cashAssetDetailModal = document.getElementById('cashAssetDetailModal');
const modalCashAssetName = document.getElementById('modalCashAssetName');
const detailCashAssetName = document.getElementById('detailCashAssetName');
const detailCashAssetBalance = document.getElementById('detailCashAssetBalance');
const detailCashAssetLastUpdated = document.getElementById('detailCashAssetLastUpdated');
const editCashAssetFromDetailBtn = document.getElementById('editCashAssetFromDetailBtn');
const deleteCashAssetFromDetailBtn = document.getElementById('deleteCashAssetFromDetailBtn');


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

// NEW: Cash Asset Form Inputs for dirty state check
const cashAssetFormInputs = [
    cashAssetNameInput, cashAssetBalanceInput
];


// --- GLOBAL HELPER FUNCTIONS ---

/**
 * Dynamically adjusts the top padding of the main content area
 * to prevent it from being hidden by the fixed header.
 */
function adjustMainContentPadding() {
    // Ensure both the header and main content container elements exist.
    if (appHeader && mainContainer) {
        // Get the current computed height of the fixed header.
        const headerHeight = appHeader.offsetHeight;
        
        // Apply this height as padding to the top of the main content container.
        // The target banner is now a floating icon, so it doesn't affect top padding.
        mainContainer.style.paddingTop = `${headerHeight}px`;
        logDebug('Layout: Adjusted main content padding-top to: ' + headerHeight + 'px (Header only).');
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


    document.querySelectorAll('.modal').forEach(modal => {
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
        }
    });
    resetCalculator();
    deselectCurrentShare();
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); autoDismissTimeout = null; }
    hideContextMenu();
    // NEW: Close the alert panel if open (alertPanel is not in current HTML, but kept for consistency)
    if (alertPanel) hideModal(alertPanel);
    logDebug('Modal: All modals closed.');
}

// Custom Dialog (Alert) Function
function showCustomAlert(message, duration = 1000) {
    if (!customDialogModal || !customDialogMessage || !customDialogConfirmBtn || !customDialogCancelBtn) {
        console.error('Custom dialog elements not found. Cannot show alert.');
        console.log('ALERT (fallback): ' + message); // Use console.log directly as per user instruction
        return;
    }
    customDialogMessage.textContent = message;
    setIconDisabled(customDialogConfirmBtn, true); // Hide and disable confirm for alert
    customDialogConfirmBtn.style.display = 'none';
    setIconDisabled(customDialogCancelBtn, true); // Hide and disable cancel for alert
    customDialogCancelBtn.style.display = 'none';
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

// UI State Management Functions
function updateMainButtonsState(enable) {
    logDebug('UI State: Setting main buttons state to: ' + (enable ? 'ENABLED' : 'DISABLED'));
    if (newShareBtn) newShareBtn.disabled = !enable;
    if (standardCalcBtn) standardCalcBtn.disabled = !enable;
    if (dividendCalcBtn) dividendCalcBtn.disabled = !enable;
    if (exportWatchlistBtn) exportWatchlistBtn.disabled = !enable;
    if (addWatchlistBtn) addWatchlistBtn.disabled = !enable;
    if (editWatchlistBtn) editWatchlistBtn.disabled = !enable || userWatchlists.length === 0; 
    if (addShareHeaderBtn) addShareHeaderBtn.disabled = !enable;
    if (logoutBtn) setIconDisabled(logoutBtn, !enable); 
    if (themeToggleBtn) themeToggleBtn.disabled = !enable;
    if (colorThemeSelect) colorThemeSelect.disabled = !enable;
    if (revertToDefaultThemeBtn) revertToDefaultThemeBtn.disabled = !enable;
    if (sortSelect) sortSelect.disabled = !enable;
    if (watchlistSelect) watchlistSelect.disabled = !enable;
    if (refreshLivePricesBtn) refreshLivePricesBtn.disabled = !enable;
    if (toggleCompactViewBtn) toggleCompactViewBtn.disabled = !enable; // NEW: Disable compact view toggle
    
    // NEW: Disable/enable buttons specific to cash section
    if (addCashCategoryBtn) addCashCategoryBtn.disabled = !enable;
    if (saveCashBalancesBtn) saveCashBalancesBtn.disabled = !enable;

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

function addCommentSection(title = '', text = '') {
    // commentsFormContainer now correctly points to #dynamicCommentsArea
    if (!commentsFormContainer) { console.error('addCommentSection: commentsFormContainer (dynamicCommentsArea) not found.'); return; }
    const commentSectionDiv = document.createElement('div');
    commentSectionDiv.className = 'comment-section';
    // This HTML is for the individual comment input box, NOT the main H3 header
    commentSectionDiv.innerHTML = `
        <div class="comment-section-header">
            <input type="text" class="comment-title-input" placeholder="Comment Title" value="${title}">
            <button type="button" class="comment-delete-btn">&times;</button>
        </div>
        <textarea class="comment-text-input" placeholder="Your comments here...">${text}</textarea>
    `;
    commentsFormContainer.appendChild(commentSectionDiv);
    
    const commentTitleInput = commentSectionDiv.querySelector('.comment-title-input');
    const commentTextInput = commentSectionDiv.querySelector('.comment-text-input');
    if (commentTitleInput) commentTitleInput.addEventListener('input', checkFormDirtyState);
    if (commentTextInput) commentTextInput.addEventListener('input', checkFormDirtyState);

    commentSectionDiv.querySelector('.comment-delete-btn').addEventListener('click', (event) => {
        logDebug('Comments: Delete comment button clicked.');
        event.target.closest('.comment-section').remove();
        checkFormDirtyState();
    });
    logDebug('Comments: Added new comment section.');
}

function clearForm() {
    formInputs.forEach(input => {
        if (input) { input.value = ''; }
    });
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
        shareWatchlistSelect.value = ''; // Set to empty string to select the disabled option
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
    if (!shareWatchlistSelect) {
        console.error('populateShareWatchlistSelect: shareWatchlistSelect element not found.');
        return;
    }

    shareWatchlistSelect.innerHTML = '<option value="" disabled selected>Select a Watchlist</option>'; // Always start with placeholder

    // Filter out the "Cash & Bank" option from the share watchlist dropdown
    const stockWatchlists = userWatchlists.filter(wl => wl.id !== CASH_BANK_WATCHLIST_ID);

    stockWatchlists.forEach(watchlist => {
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        shareWatchlistSelect.appendChild(option);
    });

    if (isNewShare) {
        // If adding a new share:
        // Pre-select if currently viewing a specific stock watchlist (not All Shares or Cash & Bank)
        if (currentSelectedWatchlistIds.length === 1 && 
            currentSelectedWatchlistIds[0] !== ALL_SHARES_ID &&
            currentSelectedWatchlistIds[0] !== CASH_BANK_WATCHLIST_ID) {
            
            shareWatchlistSelect.value = currentSelectedWatchlistIds[0];
            shareWatchlistSelect.disabled = true; // Cannot change watchlist when adding from a specific one
            logDebug('Share Form: New share: Pre-selected and disabled watchlist to current view (' + stockWatchlists.find(wl => wl.id === currentSelectedWatchlistIds[0])?.name + ').');
        } else {
            // If viewing "All Shares", "Cash & Bank", or multiple, force selection (dropdown remains enabled)
            shareWatchlistSelect.value = ''; // Ensure placeholder is selected
            shareWatchlistSelect.disabled = false;
            logDebug('Share Form: New share: User must select a watchlist.');
        }
    } else {
        // If editing an existing share:
        if (currentShareWatchlistId && stockWatchlists.some(wl => wl.id === currentShareWatchlistId)) {
            shareWatchlistSelect.value = currentShareWatchlistId;
            logDebug('Share Form: Editing share: Pre-selected watchlist to existing share\'s (' + stockWatchlists.find(wl => wl.id === currentShareWatchlistId)?.name + ').');
        } else if (stockWatchlists.length > 0) {
            // Fallback to first stock watchlist if current one is invalid/missing
            shareWatchlistSelect.value = stockWatchlists[0].id;
            console.warn('Share Form: Editing share: Original watchlist not found, defaulted to first available stock watchlist.');
        } else {
            shareWatchlistSelect.value = ''; // No watchlists available
            console.warn('Share Form: Editing share: No stock watchlists available to select.');
        }
        shareWatchlistSelect.disabled = false; // Always allow changing watchlist when editing
    }
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
    currentPriceInput.value = Number(shareToEdit.currentPrice) !== null && !isNaN(Number(shareToEdit.currentPrice)) ? Number(shareToEdit.currentPrice).toFixed(2) : '';
    targetPriceInput.value = Number(shareToEdit.targetPrice) !== null && !isNaN(Number(shareToEdit.targetPrice)) ? Number(shareToEdit.targetPrice).toFixed(2) : '';
    dividendAmountInput.value = Number(shareToEdit.dividendAmount) !== null && !isNaN(Number(shareToEdit.dividendAmount)) ? Number(shareToEdit.dividendAmount).toFixed(3) : '';
    frankingCreditsInput.value = Number(shareToEdit.frankingCredits) !== null && !isNaN(Number(shareToEdit.frankingCredits)) ? Number(shareToEdit.frankingCredits).toFixed(1) : '';
    
    // Populate and set selection for the watchlist dropdown
    populateShareWatchlistSelect(shareToEdit.watchlistId, false); // false indicates not a new share

    if (commentsFormContainer) { // This now refers to #dynamicCommentsArea
        commentsFormContainer.innerHTML = ''; // Clear existing dynamic comment sections
        if (shareToEdit.comments && Array.isArray(shareToEdit.comments) && shareToEdit.comments.length > 0) {
            shareToEdit.comments.forEach(comment => addCommentSection(comment.title, comment.text));
        } else {
            // Add one empty comment section if no existing comments
            addCommentSection(); 
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
        targetPrice: parseFloat(targetPriceInput.value),
        dividendAmount: parseFloat(dividendAmountInput.value),
        frankingCredits: parseFloat(frankingCreditsInput.value),
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

    const fields = ['shareName', 'currentPrice', 'targetPrice', 'dividendAmount', 'frankingCredits', 'watchlistId']; // Include watchlistId
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


    const currentPrice = parseFloat(currentPriceInput.value);
    const targetPrice = parseFloat(targetPriceInput.value);
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

    const shareData = {
        shareName: shareName,
        currentPrice: isNaN(currentPrice) ? null : currentPrice,
        targetPrice: isNaN(targetPrice) ? null : targetPrice,
        dividendAmount: isNaN(dividendAmount) ? null : dividendAmount,
        frankingCredits: isNaN(frankingCredits) ? null : frankingCredits,
        comments: comments,
        userId: currentUserId,
        // Use the selected watchlist from the modal dropdown
        watchlistId: selectedWatchlistIdForSave,
        lastPriceUpdateTime: new Date().toISOString()
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

/**
 * Saves all current cash categories and their balances to Firestore.
 */
async function saveCashCategories() {
    if (!db || !currentUserId || !window.firestore) {
        showCustomAlert('Firestore not available. Cannot save cash balances.');
        return;
    }

    // Validate category names before saving
    if (userCashCategories.some(cat => cat.name.trim() === '')) {
        showCustomAlert('Category names cannot be empty.');
        return;
    }

    const batch = window.firestore.writeBatch(db);
    const cashCategoriesColRef = window.firestore.collection(db, 'artifacts/' + currentAppId + '/users/' + currentUserId + '/cashCategories');

    // Fetch current existing documents to determine what to update vs add
    const existingDocsSnapshot = await window.firestore.getDocs(cashCategoriesColRef);
    const existingDocIds = new Set();
    const existingDocsMap = new Map();
    existingDocsSnapshot.forEach(doc => {
        existingDocIds.add(doc.id);
        existingDocsMap.set(doc.id, doc.data());
    });

    let categoriesProcessedCount = 0;

    for (const category of userCashCategories) {
        const currentBalance = isNaN(category.balance) || category.balance === null ? 0 : parseFloat(category.balance);
        const categoryData = {
            name: category.name.trim(),
            balance: currentBalance,
            userId: currentUserId
        };

        if (category.id && existingDocIds.has(category.id)) {
            // Check if existing data has actually changed to avoid unnecessary writes
            const oldData = existingDocsMap.get(category.id);
            if (oldData && (oldData.name !== categoryData.name || oldData.balance !== categoryData.balance)) {
                // Update existing category
                const docRef = window.firestore.doc(cashCategoriesColRef, category.id);
                batch.update(docRef, categoryData);
                logDebug('Firestore: Batching update for cash category: ' + category.name + ' (ID: ' + category.id + ')');
                categoriesProcessedCount++;
            } else {
                logDebug('Firestore: Skipping update for unchanged cash category: ' + category.name + ' (ID: ' + category.id + ')');
            }
        } else if (category.name.trim() !== '') {
            // Add new category (only if it has a name and is not an existing ID)
            const newDocRef = window.firestore.doc(cashCategoriesColRef); // Let Firestore generate ID
            batch.set(newDocRef, categoryData);
            logDebug('Firestore: Batching new cash category: ' + category.name);
            categoriesProcessedCount++;
        }
    }

    try {
        if (categoriesProcessedCount > 0) {
            await batch.commit();
            showCustomAlert('Cash balances saved successfully!', 1500);
            logDebug('Firestore: Cash balances batch committed. ' + categoriesProcessedCount + ' categories processed.');
        } else {
            showCustomAlert('No changes to save for cash balances.', 1500);
            logDebug('Firestore: No changes detected for cash balances. Skipping batch commit.');
        }
        // No need to call loadCashCategories() here, the onSnapshot listener will handle updates automatically
    } catch (error) {
        console.error('Firestore: Error saving cash categories:', error);
        showCustomAlert('Error saving cash balances: ' + error.message);
    }
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
 * Calculates and displays the total cash balance.
 */
function calculateTotalCash() {
    let total = 0;
    userCashCategories.forEach(category => {
        if (typeof category.balance === 'number' && !isNaN(category.balance)) {
            total += category.balance;
        }
    });
    if (totalCashDisplay) {
        totalCashDisplay.textContent = '$' + total.toFixed(2);
    }
    logDebug('Cash Categories: Total cash calculated: $' + total.toFixed(2));
}

// Custom Confirm Dialog Function (Now unused for deletions, but kept for potential future use)
function showCustomConfirm(message, callback) {
    if (!customDialogModal || !customDialogMessage || !customDialogConfirmBtn || !customDialogCancelBtn) {
        console.error('Custom dialog elements not found. Cannot show confirm.');
        console.log('CONFIRM (fallback): ' + message); // Use console.log directly as per user instruction
        callback(window.confirm(message)); // Fallback to native confirm
        return;
    }
    customDialogMessage.textContent = message;
    customDialogConfirmBtn.style.display = 'inline-flex'; // Show confirm
    setIconDisabled(customDialogConfirmBtn, false);
    customDialogCancelBtn.style.display = 'inline-flex'; // Show cancel
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
        mainTitle.textContent = 'Cash & Bank';
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
        showCustomAlert('Cash & Bank data cannot be exported via this function. Please switch to a stock watchlist.', 3000);
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
            (!isNaN(targetPriceNum) && targetPriceNum !== null) ? targetPriceNum.toFixed(2) : '',
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


async function initializeAppLogic() {
    // DEBUG: Log when initializeAppLogic starts
    logDebug('initializeAppLogic: Firebase is ready. Starting app logic.');

    // Initial modal hiding
    if (shareFormSection) hideModal(shareFormSection); // Use hideModal for consistency
    if (dividendCalculatorModal) hideModal(dividendCalculatorModal);
    if (shareDetailModal) hideModal(shareDetailModal);
    if (addWatchlistModal) hideModal(addWatchlistModal);
    if (manageWatchlistModal) hideModal(manageWatchlistModal);
    if (customDialogModal) hideModal(customDialogModal);
    if (calculatorModal) hideModal(calculatorModal);
    if (shareContextMenu) hideModal(shareContextMenu); // Context menu is not a modal, but treat similarly for hiding
    if (targetHitIconBtn) targetHitIconBtn.style.display = 'none'; // Ensure icon is hidden initially
    if (alertPanel) hideModal(alertPanel); // NEW: Ensure alert panel is hidden initially

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
                mobileShareCardsContainer.classList.remove('compact');
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


    // Form input navigation with Enter key
    formInputs.forEach((input, index) => {
        if (input) {
            input.addEventListener('keydown', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    if (index === formInputs.length - 1) {
                        if (addCommentSectionBtn && addCommentSectionBtn.offsetParent !== null && !addCommentSectionBtn.classList.contains('is-disabled-icon')) { 
                            addCommentSectionBtn.click();
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

    // Add Comment Section Button
    if (addCommentSectionBtn) {
        setIconDisabled(addCommentSectionBtn, false);
        addCommentSectionBtn.addEventListener('click', () => {
            addCommentSection();
            checkFormDirtyState();
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
        } else {
            button.addEventListener('click', closeModals); // Other modals still close normally
        }
    });

    // Global click listener to close modals/context menu if clicked outside
    window.addEventListener('click', (event) => {
        if (event.target === shareDetailModal || event.target === dividendCalculatorModal ||
            event.target === shareFormSection || event.target === customDialogModal ||
            event.target === calculatorModal || event.target === addWatchlistModal ||
            event.target === manageWatchlistModal || event.target === alertPanel) { // NEW: Include alertPanel here
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

    // NEW: Target hit icon button listener for dismissal
    if (targetHitIconBtn) {
        targetHitIconBtn.addEventListener('click', (event) => {
            logDebug('Target Alert: Icon button clicked. Dismissing icon.');
            targetHitIconDismissed = true; // Set flag to true
            localStorage.setItem('targetHitIconDismissed', 'true'); // Save dismissal state to localStorage
            updateTargetHitBanner(); // Re-run to hide the icon
            showCustomAlert('Alerts dismissed for this session.', 1500); // Optional: Provide user feedback
            renderWatchlist(); // NEW: Re-render watchlist to remove highlighting
        });
    }

    // NEW: Target hit icon button listener to open alert panel (if you decide to use it later)
    // For now, this is commented out as the user wants simple dismissal on click.
    /*
    if (targetHitIconBtn) {
        targetHitIconBtn.addEventListener('click', () => {
            logDebug('Target Alert: Icon button clicked. Toggling alert panel.');
            if (alertPanel.style.display === 'flex') {
                hideModal(alertPanel);
            } else {
                renderAlertsInPanel(); // Render alerts before showing
                showModal(alertPanel);
            }
        });
    }
    */

    // NEW: Close alert panel button listener (alertPanel is not in current HTML, but kept for consistency)
    if (closeAlertPanelBtn) {
        closeAlertPanelBtn.addEventListener('click', () => {
            logDebug('Alert Panel: Close button clicked.');
            // hideModal(alertPanel); // Commented out as alertPanel is not in HTML
        });
    }

    // NEW: Clear All Alerts button listener (alertPanel is not in current HTML, but kept for consistency)
    if (clearAllAlertsBtn) {
        clearAllAlertsBtn.addEventListener('click', () => {
            logDebug('Alert Panel: Clear All button clicked.');
            sharesAtTargetPrice = []; // Clear all alerts in memory
            // renderAlertsInPanel(); // Commented out as alertPanel is not in HTML
            updateTargetHitBanner(); // Update the main icon count
            showCustomAlert('All alerts cleared for this session.', 1500);
            // hideModal(alertPanel); // Commented out as alertPanel is not in HTML
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
                // NEW: Reset targetHitIconDismissed and clear localStorage entry on logout for a fresh start on next login
                targetHitIconDismissed = false; 
                localStorage.removeItem('targetHitIconDismissed');

            }
            catch (error) {
                console.error('Auth: Logout failed:', error);
                showCustomAlert('Logout failed: ' + error.message);
            }
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
            sortShares();
            await saveSortOrderPreference(currentSortOrder);
        });
    }

    // New Share Button (from sidebar)
    if (newShareBtn) {
        newShareBtn.addEventListener('click', () => {
            logDebug('UI: New Share button (sidebar) clicked.');
            clearForm();
            formTitle.textContent = 'Add New Share';
            if (deleteShareBtn) { deleteShareBtn.classList.add('hidden'); }
            populateShareWatchlistSelect(null, true); // true indicates new share
            showModal(shareFormSection);
            shareNameInput.focus();
            toggleAppSidebar(false);
            addCommentSection(); // ADDED: Add an initial empty comment section for new shares
            checkFormDirtyState(); // Check dirty state immediately after opening for new share
        });
    }

    // Add Share Header Button (from header)
    if (addShareHeaderBtn) {
        addShareHeaderBtn.addEventListener('click', () => {
            logDebug('UI: Add Share button (header) clicked.');
            clearForm();
            formTitle.textContent = 'Add New Share';
            if (deleteShareBtn) { deleteShareBtn.classList.add('hidden'); }
            populateShareWatchlistSelect(null, true); // true indicates new share
            showModal(shareFormSection);
            shareNameInput.focus();
            addCommentSection(); // ADDED: Add an initial empty comment section for new shares
            checkFormDirtyState(); // Check dirty state immediately after opening for new share
        });
    }

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

            // Prevent editing "All Shares" or "Cash & Bank"
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
            // Keep at least one real watchlist + Cash & Bank
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

            // Prevent deleting "All Shares" or "Cash & Bank"
            if (watchlistToDeleteId === ALL_SHARES_ID || watchlistToDeleteId === CASH_BANK_WATCHLIST_ID) {
                showCustomAlert('Cannot delete this special watchlist.', 2000);
                return;
            }

            // Ensure at least one actual watchlist remains (excluding Cash & Bank)
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
                    logDebug('Theme: Error saving explicit Light/Dark theme preference to Firestore:', error);
                } catch (error) {
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

    // NEW: Cash & Bank Event Listeners
    if (addCashCategoryBtn) {
        addCashCategoryBtn.addEventListener('click', () => {
            logDebug('UI: Add Cash Category button clicked.');
            addCashCategoryUI();
        });
    }

    if (saveCashBalancesBtn) {
        saveCashBalancesBtn.addEventListener('click', () => {
            logDebug('UI: Save Cash Balances button clicked.');
            saveCashCategories();
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
                if (user.email && user.email.toLowerCase() === KANGA_EMAIL) {
                    mainTitle.textContent = 'Kanga\'s Share Watchlist';
                    logDebug('AuthState: Main title set to Kanga\'s Share Watchlist.');
                } else {
                    mainTitle.textContent = 'My Share Watchlist';
                    logDebug('AuthState: Main title set to My Share Watchlist.');
                }
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
                
                // Load dismissal state from localStorage on login
                targetHitIconDismissed = localStorage.getItem('targetHitIconDismissed') === 'true';

                // Load data and then hide splash screen
                await loadUserWatchlistsAndSettings(); // This now sets _appDataLoaded and calls hideSplashScreenIfReady
                // startLivePriceUpdates(); // This is now called by renderWatchlist based on selected type

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
            // renderWatchlist() is now called by loadUserWatchlistsAndSettings or directly by watchlistSelect change.
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
