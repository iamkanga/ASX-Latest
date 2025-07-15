// This script interacts with Firebase Firestore for data storage.
// Firebase app, db, auth instances, and userId are made globally available
// via window.firestoreDb, window.firebaseAuth, window.getFirebaseAppId(), etc.,
// from the <script type="module"> block in index.html.

// --- GLOBAL VARIABLES ---
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
let currentSortOrder = 'entryDate-desc'; // Default sort order
let contextMenuOpen = false; // To track if the custom context menu is open
let currentContextMenuShareId = null; // Stores the ID of the share that opened the context menu
let originalShareData = null; // Stores the original share data when editing for dirty state check
let originalWatchlistData = null; // Stores original watchlist data for dirty state check in watchlist modals

// Live Price Data
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzp7OjZL3zqvJ9wPsV9M-afm2wKeQPbIgGVv_juVpkaRllADESLwj7F4-S7YWYerau-/exec'; // Your new Google Apps Script URL
let livePrices = {}; // Stores live price data: {ASX_CODE: {live: price, prevClose: price, PE: value, High52: value, Low52: value, targetHit: boolean}}
let livePriceFetchInterval = null; // To hold the interval ID for live price updates
const LIVE_PRICE_FETCH_INTERVAL_MS = 5 * 60 * 1000; // Fetch every 5 minutes

// Theme related variables
const CUSTOM_THEMES = [
    'bold-1', 'bold-2', 'bold-3', 'bold-4', 'bold-5', 'bold-6', 'bold-7', 'bold-8', 'bold-9', 'bold-10',
    'subtle-1', 'subtle-2', 'subtle-3', 'subtle-4', 'subtle-5', 'subtle-6', 'subtle-7', 'subtle-8', 'subtle-9', 'subtle-10',
    // NEW MID-RANGE THEMES
    'mid-1', 'mid-2', 'mid-3', 'mid-4', 'mid-5', 'mid-6', 'mid-7', 'mid-8', 'mid-9', 'mid-10'
];
let currentCustomThemeIndex = -1; // To track the current theme in the cycle
let currentActiveTheme = 'system-default'; // Tracks the currently applied theme string
let savedSortOrder = null; // GLOBAL: Stores the sort order loaded from user settings
let savedTheme = null; // GLOBAL: Stores the theme loaded from user settings

let unsubscribeShares = null; // Holds the unsubscribe function for the Firestore shares listener

// NEW: Global variable to store shares that have hit their target price (and not dismissed)
let sharesAtTargetPrice = [];
// NEW: Global variable to store IDs of target hits that the user has dismissed
let dismissedTargetHits = [];
// NEW: Global variable to track the expansion state of the notification bubble
let isBubbleExpanded = false;


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
// CORRECTED: This now points to the new dynamicCommentsArea ID
const commentsFormContainer = document.getElementById('dynamicCommentsArea'); 
const addCommentSectionBtn = document.getElementById('addCommentSectionBtn');
const shareTableBody = document.querySelector('#shareTable tbody');
const mobileShareCardsContainer = document.getElementById('mobileShareCards');
const loadingIndicator = document.getElementById('loadingIndicator');
const googleAuthBtn = document.getElementById('googleAuthBtn');
const shareDetailModal = document.getElementById('shareDetailModal');
const modalShareName = document.getElementById('modalShareName');
const modalEntryDate = document.getElementById('modalEntryDate');
// Removed: modalEnteredPrice (original was still here, but now it's in the dedicated section)
// Removed: modalLivePrice (original was still here, but now it's in the dedicated section)
// Removed: modalPriceChange (original was still here, but now it's in the dedicated section)
const modalTargetPrice = document.getElementById('modalTargetPrice');
// Corrected: These were globally referenced but needed to be created dynamically inside showShareDetails
// const modalDividendAmount = document.getElementById('dividendAmount'); 
// const modalFrankingCredits = document.getElementById('frankingCredits'); 
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
const logoutBtn = document.getElementById('logoutBtn'); // Changed to match ID in HTML
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn');
const refreshLivePricesBtn = document.getElementById('refreshLivePricesBtn');
// NEW: Reference for the watchlist select inside the share form modal
const shareWatchlistSelect = document.getElementById('shareWatchlistSelect');
// NEW: References for the large live price display in the modal
// Removed global references for modalLivePriceLarge and modalPriceChangeLarge
// as they are now created dynamically in showShareDetails()


// NEW: References for 52-week high/low and P/E in share details modal
const modalLivePriceDisplaySection = document.querySelector('.live-price-display-section'); // The existing colored section

// NEW: References for the target hit notification bubble
const targetNotificationBubble = document.getElementById('targetNotificationBubble');
const bubbleCount = document.getElementById('bubbleCount');
const bubbleDetails = document.getElementById('bubbleDetails');
const bubbleShareList = document.getElementById('bubbleShareList');
const bubbleCloseBtn = document.querySelector('.bubble-close-btn');
const bubbleDismissAllBtn = document.getElementById('bubbleDismissAllBtn');


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
        // This pushes the content down so it starts exactly below the fixed header.
        mainContainer.style.paddingTop = `${headerHeight}px`;
        console.log(`[Layout] Adjusted main content padding-top to: ${headerHeight}px`);
    } else {
        console.warn("[Layout] Could not adjust main content padding-top: appHeader or mainContainer not found.");
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
        console.warn(`[setIconDisabled] Element is null or undefined. Cannot set disabled state.`);
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
        console.log("[Auto-Save] Share form modal is closing. Checking for unsaved changes.");
        const currentData = getCurrentFormData();
        const isShareNameValid = currentData.shareName.trim() !== '';
        
        // The cancel button fix means clearForm() is called before closeModals()
        // For auto-save on clicking outside or other non-cancel closes:
        if (selectedShareDocId) { // Existing share
            if (originalShareData && !areShareDataEqual(originalShareData, currentData)) { // Check if originalShareData exists and if form is dirty
                console.log("[Auto-Save] Unsaved changes detected for existing share. Attempting silent save.");
                saveShareData(true); // true indicates silent save
            } else {
                console.log("[Auto-Save] No changes detected for existing share.");
            }
        } else { // New share
            // Only attempt to save if a share name was entered AND a watchlist was selected (if applicable)
            const isWatchlistSelected = shareWatchlistSelect && shareWatchlistSelect.value !== '';
            const needsWatchlistSelection = currentSelectedWatchlistIds.includes(ALL_SHARES_ID);
            
            if (isShareNameValid && (!needsWatchlistSelection || isWatchlistSelected)) { 
                console.log("[Auto-Save] New share detected with valid name and watchlist. Attempting silent save.");
                saveShareData(true); // true indicates silent save
            } else {
                console.log("[Auto-Save] New share has no name or invalid watchlist. Discarding changes.");
            }
        }
    }

    // NEW: Auto-save logic for watchlist modals
    if (addWatchlistModal && addWatchlistModal.style.display !== 'none') {
        console.log("[Auto-Save] Add Watchlist modal is closing. Checking for unsaved changes.");
        const currentWatchlistData = getCurrentWatchlistFormData(true); // true for add modal
        if (currentWatchlistData.name.trim() !== '') {
            console.log("[Auto-Save] New watchlist detected with name. Attempting silent save.");
            saveWatchlistChanges(true, currentWatchlistData.name); // true indicates silent save, pass name
        } else {
            console.log("[Auto-Save] New watchlist has no name. Discarding changes.");
        }
    }

    if (manageWatchlistModal && manageWatchlistModal.style.display !== 'none') {
        console.log("[Auto-Save] Manage Watchlist modal is closing. Checking for unsaved changes.");
        const currentWatchlistData = getCurrentWatchlistFormData(false); // false for edit modal
        if (originalWatchlistData && !areWatchlistDataEqual(originalWatchlistData, currentWatchlistData)) {
            console.log("[Auto-Save] Unsaved changes detected for existing watchlist. Attempting silent save.");
            saveWatchlistChanges(true, currentWatchlistData.name, watchlistSelect.value); // true indicates silent save, pass name and ID
        } else {
            console.log("[Auto-Save] No changes detected for existing watchlist.");
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
    collapseBubble(); // Ensure bubble is collapsed when any modal is closed
    console.log("[Modal] All modals closed.");
}

// Custom Dialog (Alert) Function
function showCustomAlert(message, duration = 1000) {
    if (!customDialogModal || !customDialogMessage || !customDialogConfirmBtn || !customDialogCancelBtn) {
        console.error("Custom dialog elements not found. Cannot show alert.");
        console.log("ALERT (fallback):", message);
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
    console.log(`[Alert] Showing alert: "${message}"`);
}

// Date Formatting Helper Functions (Australian Style)
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// UI State Management Functions
function updateAuthButtonText(isSignedIn, userName = 'Sign In') {
    if (googleAuthBtn) {
        googleAuthBtn.textContent = isSignedIn ? (userName || 'Signed In') : 'Google Sign In';
        console.log(`[Auth UI] Auth button text updated to: ${googleAuthBtn.textContent}`);
    }
}

function updateMainButtonsState(enable) {
    console.log(`[UI State] Setting main buttons state to: ${enable ? 'ENABLED' : 'DISABLED'}`);
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
    console.log(`[UI State] Sort Select Disabled: ${sortSelect ? sortSelect.disabled : 'N/A'}`);
    console.log(`[UI State] Watchlist Select Disabled: ${watchlistSelect ? watchlistSelect.disabled : 'N/A'}`);
}

function showModal(modalElement) {
    if (modalElement) {
        modalElement.style.setProperty('display', 'flex', 'important');
        modalElement.scrollTop = 0;
        const scrollableContent = modalElement.querySelector('.modal-body-scrollable');
        if (scrollableContent) {
            scrollableContent.scrollTop = 0;
        }
        console.log(`[Modal] Showing modal: ${modalElement.id}`);
    }
}

function hideModal(modalElement) {
    if (modalElement) {
        modalElement.style.setProperty('display', 'none', 'important');
        console.log(`[Modal] Hiding modal: ${modalElement.id}`);
    }
}

function clearWatchlistUI() {
    if (watchlistSelect) watchlistSelect.innerHTML = '<option value="" disabled selected>Watch List</option>'; // Updated placeholder
    userWatchlists = [];
    currentSelectedWatchlistIds = [];
    console.log("[UI] Watchlist UI cleared.");
}

function clearShareListUI() {
    if (!shareTableBody) { console.error("[clearShareListUI] shareTableBody element not found."); return; }
    if (!mobileShareCardsContainer) { console.error("[clearShareListUI] mobileShareCardsContainer element not found."); return; }
    shareTableBody.innerHTML = '';
    mobileShareCardsContainer.innerHTML = '';
    console.log("[UI] Share list UI cleared.");
}

function clearShareList() {
    clearShareListUI();
    if (asxCodeButtonsContainer) asxCodeButtonsContainer.innerHTML = '';
    deselectCurrentShare();
    console.log("[UI] Full share list cleared (UI + buttons).");
}

function selectShare(shareId) {
    console.log(`[Selection] Attempting to select share with ID: ${shareId}`);
    deselectCurrentShare();

    const tableRow = document.querySelector(`#shareTable tbody tr[data-doc-id="${shareId}"]`);
    const mobileCard = document.querySelector(`.mobile-card[data-doc-id="${shareId}"]`);

    if (tableRow) {
        tableRow.classList.add('selected');
        console.log(`[Selection] Selected table row for ID: ${shareId}`);
    }
    if (mobileCard) {
        mobileCard.classList.add('selected');
        console.log(`[Selection] Selected mobile card for ID: ${shareId}`);
    }
    selectedShareDocId = shareId;
}

function deselectCurrentShare() {
    const currentlySelected = document.querySelectorAll('.share-list-section tr.selected, .mobile-card.selected');
    console.log(`[Selection] Attempting to deselect ${currentlySelected.length} elements.`);
    currentlySelected.forEach(el => {
        el.classList.remove('selected');
    });
    selectedShareDocId = null;
    console.log("[Selection] Share deselected. selectedShareDocId is now null.");
}

function addCommentSection(title = '', text = '') {
    // commentsFormContainer now correctly points to #dynamicCommentsArea
    if (!commentsFormContainer) { console.error("[addCommentSection] commentsFormContainer (dynamicCommentsArea) not found."); return; }
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
        console.log("[Comments] Delete comment button clicked.");
        event.target.closest('.comment-section').remove();
        checkFormDirtyState();
    });
    console.log("[Comments] Added new comment section.");
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
        console.log("[clearForm] deleteShareBtn hidden.");
    }
    // Reset shareWatchlistSelect to its default placeholder
    if (shareWatchlistSelect) {
        shareWatchlistSelect.value = ''; // Set to empty string to select the disabled option
        shareWatchlistSelect.disabled = false; // Ensure it's enabled for new share entry
    }
    setIconDisabled(saveShareBtn, true); // Save button disabled on clear
    console.log("[Form] Form fields cleared and selectedShareDocId reset. saveShareBtn disabled.");
}

/**
 * Populates the 'Assign to Watchlist' dropdown in the share form modal.
 * Sets the default selection based on current view or existing share.
 * @param {string|null} currentShareWatchlistId The ID of the watchlist the share is currently in (for editing).
 * @param {boolean} isNewShare True if adding a new share, false if editing.
 */
function populateShareWatchlistSelect(currentShareWatchlistId = null, isNewShare = true) {
    if (!shareWatchlistSelect) {
        console.error("[populateShareWatchlistSelect] shareWatchlistSelect element not found.");
        return;
    }

    shareWatchlistSelect.innerHTML = '<option value="" disabled selected>Select a Watchlist</option>'; // Always start with placeholder

    userWatchlists.forEach(watchlist => {
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        shareWatchlistSelect.appendChild(option);
    });

    if (isNewShare) {
        // If adding a new share:
        if (currentSelectedWatchlistIds.length === 1 && currentSelectedWatchlistIds[0] !== ALL_SHARES_ID) {
            // If currently viewing a specific watchlist, pre-select it and disable dropdown
            shareWatchlistSelect.value = currentSelectedWatchlistIds[0];
            shareWatchlistSelect.disabled = true; // Cannot change watchlist when adding from a specific one
            console.log(`[Share Form] New share: Pre-selected and disabled watchlist to current view (${userWatchlists.find(wl => wl.id === currentSelectedWatchlistIds[0])?.name}).`);
        } else {
            // If viewing "All Shares" or multiple, force selection (dropdown remains enabled)
            shareWatchlistSelect.value = ''; // Ensure placeholder is selected
            shareWatchlistSelect.disabled = false;
            console.log("[Share Form] New share: User must select a watchlist.");
        }
    } else {
        // If editing an existing share:
        if (currentShareWatchlistId && userWatchlists.some(wl => wl.id === currentShareWatchlistId)) {
            shareWatchlistSelect.value = currentShareWatchlistId;
            console.log(`[Share Form] Editing share: Pre-selected watchlist to existing share's (${userWatchlists.find(wl => wl.id === currentShareWatchlistId)?.name}).`);
        } else if (userWatchlists.length > 0) {
            // Fallback to first watchlist if current one is invalid/missing
            shareWatchlistSelect.value = userWatchlists[0].id;
            console.warn("[Share Form] Editing share: Original watchlist not found, defaulted to first available.");
        } else {
            shareWatchlistSelect.value = ''; // No watchlists available
            console.warn("[Share Form] Editing share: No watchlists available to select.");
        }
        shareWatchlistSelect.disabled = false; // Always allow changing watchlist when editing
    }
    // Add event listener for dirty state checking on this dropdown
    shareWatchlistSelect.addEventListener('change', checkFormDirtyState);
}


function showEditFormForSelectedShare(shareIdToEdit = null) {
    const targetShareId = shareIdToEdit || selectedShareDocId;

    if (!targetShareId) {
        showCustomAlert("Please select a share to edit.");
        return;
    }
    const shareToEdit = allSharesData.find(share => share.id === targetShareId);
    if (!shareToEdit) {
        showCustomAlert("Selected share not found.");
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
        deleteShareBtn.classList.remove('hidden');
        setIconDisabled(deleteShareBtn, false);
        console.log("[showEditFormForSelectedShare] deleteShareBtn shown and enabled.");
    }
    
    originalShareData = getCurrentFormData();
    setIconDisabled(saveShareBtn, true); // Save button disabled initially for editing
    console.log("[showEditFormForSelectedShare] saveShareBtn initially disabled for dirty check.");
    
    showModal(shareFormSection);
    shareNameInput.focus();
    console.log(`[Form] Opened edit form for share: ${shareToEdit.shareName} (ID: ${selectedShareDocId})`);
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
            console.log("[Dirty State] New share from All Shares: Watchlist not selected, save disabled.");
        }
    }

    if (selectedShareDocId && originalShareData) {
        const isDirty = !areShareDataEqual(originalShareData, currentData);
        canSave = canSave && isDirty;
        if (!isDirty) {
            console.log("[Dirty State] Existing share: No changes detected, save disabled.");
        }
    } else if (!selectedShareDocId) {
        // For new shares, enable if name is valid and (if from All Shares) watchlist is selected
        // No additional 'isDirty' check needed for new shares beyond initial validity
    }

    setIconDisabled(saveShareBtn, !canSave);
    console.log(`[Dirty State] Save button enabled: ${canSave}`);
}

/**
 * Saves share data to Firestore. Can be called silently for auto-save.
 * @param {boolean} isSilent If true, no alert messages are shown on success.
 */
async function saveShareData(isSilent = false) {
    console.log("[Share Form] saveShareData called.");
    // Check if the save button would normally be disabled (no valid name or no changes)
    // This prevents saving blank new shares or unchanged existing shares on auto-save.
    if (saveShareBtn.classList.contains('is-disabled-icon') && isSilent) {
        console.log("[Auto-Save] Save button is disabled (no changes or no valid name). Skipping silent save.");
        return;
    }

    const shareName = shareNameInput.value.trim().toUpperCase();
    if (!shareName) { 
        if (!isSilent) showCustomAlert("Code is required!"); 
        console.warn("[Save Share] Code is required. Skipping save.");
        return; 
    }

    const selectedWatchlistIdForSave = shareWatchlistSelect ? shareWatchlistSelect.value : null;
    // For new shares from 'All Shares' view, force watchlist selection
    if (!selectedShareDocId && currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        if (!selectedWatchlistIdForSave || selectedWatchlistIdForSave === '') { // Check for empty string too
            if (!isSilent) showCustomAlert("Please select a watchlist to assign the new share to.");
            console.warn("[Save Share] New share from All Shares: Watchlist not selected. Skipping save.");
            return;
        }
    } else if (!selectedShareDocId && !selectedWatchlistIdForSave) { // New share not from All Shares, but no watchlist selected (shouldn't happen if default exists)
         if (!isSilent) showCustomAlert("Please select a watchlist to assign the new share to.");
         console.warn("[Save Share] New share: No watchlist selected. Skipping save.");
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
            const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, selectedShareDocId);
            await window.firestore.updateDoc(shareDocRef, shareData);
            if (!isSilent) showCustomAlert(`Share '${shareName}' updated successfully!`, 1500);
            console.log(`[Firestore] Share '${shareName}' (ID: ${selectedShareDocId}) updated.`);
            originalShareData = getCurrentFormData(); // Update original data after successful save
            setIconDisabled(saveShareBtn, true); // Disable save button after saving
        } catch (error) {
            console.error("[Firestore] Error updating share:", error);
            if (!isSilent) showCustomAlert("Error updating share: " + error.message);
        }
    } else {
        shareData.entryDate = new Date().toISOString();
        shareData.lastFetchedPrice = shareData.currentPrice;
        shareData.previousFetchedPrice = shareData.currentPrice;

        try {
            const sharesColRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
            const newDocRef = await window.firestore.addDoc(sharesColRef, shareData);
            selectedShareDocId = newDocRef.id; // Set selectedShareDocId for the newly added share
            if (!isSilent) showCustomAlert(`Share '${shareName}' added successfully!`, 1500);
            console.log(`[Firestore] Share '${shareName}' added with ID: ${newDocRef.id}`);
            originalShareData = getCurrentFormData(); // Update original data after successful save
            setIconDisabled(saveShareBtn, true); // Disable save button after saving
        } catch (error) {
            console.error("[Firestore] Error adding share:", error);
            if (!isSilent) showCustomAlert("Error adding share: " + error.message);
        }
    }
    if (!isSilent) closeModals(); // Only close if not a silent save
}


function showShareDetails() {
    if (!selectedShareDocId) {
        showCustomAlert("Please select a share to view details.");
        return;
    }
    const share = allSharesData.find(s => s.id === selectedShareDocId);
    if (!share) {
        showCustomAlert("Selected share not found.");
        return;
    }
    modalShareName.textContent = share.shareName || 'N/A';
    
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

        // Clear previous dynamic content in the section
        modalLivePriceDisplaySection.innerHTML = ''; 

        // 1. Add 52-Week Low and High at the top
        const fiftyTwoWeekRow = document.createElement('div');
        fiftyTwoWeekRow.classList.add('fifty-two-week-row'); // New class for styling
        
        const lowSpan = document.createElement('span');
        lowSpan.classList.add('fifty-two-week-value', 'low'); // New classes
        lowSpan.textContent = `Low: ${low52Week !== undefined && low52Week !== null && !isNaN(low52Week) ? '$' + low52Week.toFixed(2) : 'N/A'}`;
        fiftyTwoWeekRow.appendChild(lowSpan);

        const highSpan = document.createElement('span');
        highSpan.classList.add('fifty-two-week-value', 'high'); // New classes
        highSpan.textContent = `High: ${high52Week !== undefined && high52Week !== null && !isNaN(high52Week) ? '$' + high52Week.toFixed(2) : 'N/A'}`;
        fiftyTwoWeekRow.appendChild(highSpan);

        modalLivePriceDisplaySection.appendChild(fiftyTwoWeekRow);

        // 2. Add Live Price and Change (Dynamically create these elements now)
        const currentModalLivePriceLarge = document.createElement('span');
        currentModalLivePriceLarge.classList.add('live-price-large');
        const currentModalPriceChangeLarge = document.createElement('span');
        currentModalPriceChangeLarge.classList.add('price-change-large');

        const livePriceRow = document.createElement('div');
        livePriceRow.classList.add('live-price-main-row'); // New class for styling
        livePriceRow.appendChild(currentModalLivePriceLarge);
        livePriceRow.appendChild(currentModalPriceChangeLarge);
        modalLivePriceDisplaySection.appendChild(livePriceRow);

        if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) {
            currentModalLivePriceLarge.textContent = `$${livePrice.toFixed(2)}`;
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
            priceChangeSpan.classList.add('price-change'); // Keep base class for coloring

            if (change > 0) {
                priceChangeSpan.textContent = `(+$${change.toFixed(2)} / +${percentageChange.toFixed(2)}%)`;
                priceChangeSpan.classList.add('positive');
                modalLivePriceDisplaySection.classList.add('positive-change-section');
            } else if (change < 0) {
                priceChangeSpan.textContent = `(-$${Math.abs(change).toFixed(2)} / ${percentageChange.toFixed(2)}%)`; // percentageChange is already negative
                priceChangeSpan.classList.add('negative');
                modalLivePriceDisplaySection.classList.add('negative-change-section');
            } else {
                priceChangeSpan.textContent = `($0.00 / 0.00%)`;
                priceChangeSpan.classList.add('neutral');
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
        peSpan.textContent = `P/E: ${peRatio !== undefined && peRatio !== null && !isNaN(peRatio) ? peRatio.toFixed(2) : 'N/A'}`;
        peRow.appendChild(peSpan);
        modalLivePriceDisplaySection.appendChild(peRow);
    }
    
    // Original Live Price/Change removed from HTML, so these references are no longer needed
    // if (modalLivePrice) { /* ... */ }
    // if (modalPriceChange) { /* ... */ }


    modalEnteredPrice.textContent = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? `$${enteredPriceNum.toFixed(2)}` : 'N/A';
    const targetPriceNum = Number(share.targetPrice);
    modalTargetPrice.textContent = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? `$${targetPriceNum.toFixed(2)}` : 'N/A';
    
    const dividendAmountNum = Number(share.dividendAmount);
    // Corrected declaration of divAmountDisplay
    const modalDividendAmountText = (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? `$${dividendAmountNum.toFixed(3)}` : 'N/A';
    
    const frankingCreditsNum = Number(share.frankingCredits);
    // Corrected declaration of modalFrankingCredits.textContent
    // modalFrankingCredits.textContent = (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? `${frankingCreditsNum.toFixed(1)}%` : 'N/A';
    
    const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;
    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, priceForYield); 
    // NEW: Display "0.00%" if unfrankedYield is null or NaN, otherwise format
    modalUnfrankedYieldSpan.textContent = unfrankedYield !== null && !isNaN(unfrankedYield) ? `${unfrankedYield.toFixed(2)}%` : '0.00%';
    
    const frankedYield = calculateFrankedYield(dividendAmountNum, priceForYield, frankingCreditsNum);
    // NEW: Display "0.00%" if frankedYield is null or NaN, otherwise format
    modalFrankedYieldSpan.textContent = frankedYield !== null && !isNaN(frankedYield) ? `${frankedYield.toFixed(2)}%` : '0.00%';

    // Populate Entry Date after Franked Yield
    modalEntryDate.textContent = formatDate(share.entryDate) || 'N/A';
    
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
        const newsUrl = `https://news.google.com/search?q=${encodeURIComponent(share.shareName)}%20ASX&hl=en-AU&gl=AU&ceid=AU%3Aen`;
        modalNewsLink.href = newsUrl;
        modalNewsLink.textContent = `View ${share.shareName.toUpperCase()} News`;
        modalNewsLink.style.display = 'inline-flex';
        setIconDisabled(modalNewsLink, false);
    } else if (modalNewsLink) {
        modalNewsLink.style.display = 'none';
        setIconDisabled(modalNewsLink, true);
    }

    if (modalMarketIndexLink && share.shareName) {
        const marketIndexUrl = `https://www.marketindex.com.au/asx/${share.shareName.toLowerCase()}`;
        modalMarketIndexLink.href = marketIndexUrl;
        modalMarketIndexLink.textContent = `View ${share.shareName.toUpperCase()} on MarketIndex.com.au`;
        modalMarketIndexLink.style.display = 'inline-flex';
        setIconDisabled(modalMarketIndexLink, false);
    } else if (modalMarketIndexLink) {
        modalMarketIndexLink.style.display = 'none';
        setIconDisabled(modalMarketIndexLink, true);
    }

    if (commSecLoginMessage) {
        commSecLoginMessage.style.display = 'block'; 
    }

    // Moved to header: setIconDisabled(editShareFromDetailBtn, false);
    // Moved to header: setIconDisabled(deleteShareFromDetailBtn, false);

    showModal(shareDetailModal);
    console.log(`[Details] Displayed details for share: ${share.shareName} (ID: ${selectedShareDocId})`);
}

function sortShares() {
    const sortValue = currentSortOrder;
    if (!sortValue || sortValue === '') {
        console.log("[Sort] Sort placeholder selected, no explicit sorting applied.");
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
            const prevCloseB = livePriceDataB ? livePriceDataB.prevClose : undefined;

            let percentageChangeA = null;
            // Only calculate if both livePriceA and prevCloseA are valid numbers and prevCloseA is not zero
            if (livePriceA !== undefined && livePriceA !== null && !isNaN(livePriceA) &&
                prevCloseA !== undefined && prevCloseA !== null && !isNaN(prevCloseA) && prevCloseA !== 0) {
                percentageChangeA = ((livePriceA - prevCloseA) / prevCloseA) * 100;
            }

            let percentageChangeB = null;
            // Only calculate if both livePriceB and prevCloseB are valid numbers and prevCloseB is not zero
            if (livePriceB !== undefined && livePriceB !== null && !isNaN(livePriceB) &&
                prevCloseB !== undefined && prevCloseB !== null && !isNaN(prevCloseB) && prevCloseB !== 0) {
                percentageChangeB = ((livePriceB - prevCloseB) / prevCloseB) * 100;
            }

            // Debugging log for percentage sort
            console.log(`[Sort Debug - Percentage] Comparing ${a.shareName} (Change: ${percentageChangeA}) vs ${b.shareName} (Change: ${percentageChangeB})`);


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
            // If A is empty, it comes after B (push to bottom)
            if (nameA === '') return 1; 
            // If B is empty, it comes after A (push to bottom)
            if (nameB === '') return -1; 

            return order === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        } else if (field === 'entryDate') {
            const dateA = new Date(valA);
            const dateB = new Date(valB);
            valA = isNaN(dateA.getTime()) ? (order === 'asc' ? Infinity : -Infinity) : dateA.getTime();
            valB = isNaN(dateB.getTime()) ? (order === 'asc' ? Infinity : -Infinity) : dateB.getTime();
            return order === 'asc' ? valA - valB : valB - valA;
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
    console.log("[Sort] Shares sorted. Rendering watchlist.");
    renderWatchlist(); 
}

function renderWatchlistSelect() {
    if (!watchlistSelect) { console.error("[renderWatchlistSelect] watchlistSelect element not found."); return; }
    // Set the initial placeholder text to "Watch List"
    watchlistSelect.innerHTML = '<option value="" disabled selected>Watch List</option>';

    const allSharesOption = document.createElement('option');
    allSharesOption.value = ALL_SHARES_ID;
    allSharesOption.textContent = 'All Shares';
    watchlistSelect.appendChild(allSharesOption);

    userWatchlists.forEach(watchlist => {
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        watchlistSelect.appendChild(option);
    });

    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        watchlistSelect.value = ALL_SHARES_ID;
    } else if (currentSelectedWatchlistIds.length === 1) {
        watchlistSelect.value = currentSelectedWatchlistIds[0];
    } else if (userWatchlists.length > 0) {
        watchlistSelect.value = userWatchlists[0].id;
        currentSelectedWatchlistIds = [userWatchlists[0].id];
    } else {
        watchlistSelect.value = '';
    }
    console.log("[UI Update] Watchlist select dropdown rendered.");
}

function renderSortSelect() {
    if (!sortSelect) { console.error("[renderSortSelect] sortSelect element not found."); return; }
    // Set the initial placeholder text to "Sort List"
    sortSelect.innerHTML = '<option value="" disabled selected>Sort List</option>';

    const options = [
        { value: "entryDate-desc", text: "Date Added (Newest)" },
        { value: "entryDate-asc", text: "Date Added (Oldest)" },
        { value: "shareName-asc", text: "Code (A-Z)" },
        { value: "shareName-desc", text: "Code (Z-A)" },
        { value: "dividendAmount-desc", text: "Dividend (High-Low)" },
        { value: "dividendAmount-asc", text: "Dividend (Low-High)" },
        // NEW: Options for percentage change
        { value: "percentageChange-desc", text: "Percentage Change (High-Low)" },
        { value: "percentageChange-asc", text: "Percentage Change (Low-High)" }
    ];
    options.forEach(opt => {
        const optionElement = document.createElement('option');
        optionElement.value = opt.value;
        optionElement.textContent = opt.text;
        sortSelect.appendChild(optionElement);
    });

    if (currentUserId && savedSortOrder && Array.from(sortSelect.options).some(option => option.value === savedSortOrder)) {
        sortSelect.value = savedSortOrder;
        currentSortOrder = savedSortOrder;
        console.log(`[Sort] Applied saved sort order: ${currentSortOrder}`);
    } else {
        sortSelect.value = ''; 
        currentSortOrder = '';
        console.log("[Sort] No valid saved sort order or not logged in, defaulting to placeholder.");
    }
    console.log("[UI Update] Sort select rendered. Sort select disabled: ", sortSelect.disabled);
}

function addShareToTable(share) {
    if (!shareTableBody) { console.error("[addShareToTable] shareTableBody element not found."); return; }
    const row = shareTableBody.insertRow();
    row.dataset.docId = share.id;
    
    // NEW: Apply target-hit-alert class if condition met
    const livePriceData = livePrices[share.shareName.toUpperCase()];
    const isTargetHit = livePriceData ? livePriceData.targetHit : false;
    if (isTargetHit) {
        row.classList.add('target-hit-alert');
    } else {
        row.classList.remove('target-hit-alert');
    }

    let lastClickTime = 0;
    row.addEventListener('click', (event) => { 
        console.log(`[Table Row Click] Share ID: ${share.id}`);
        if (!contextMenuOpen) {
            const currentTime = new Date().getTime();
            const clickDelay = 300;
            if (currentTime - lastClickTime < clickDelay) {
                console.log(`[Table Row Double Click] Share ID: ${share.id}`);
                selectShare(share.id); 
                showShareDetails();
            }
            lastClickTime = currentTime;
            selectShare(share.id);
        }
    });

    row.addEventListener('contextmenu', (event) => {
        console.log(`[Table Row ContextMenu] Share ID: ${share.id}`);
        event.preventDefault();
        selectShare(share.id);
        showContextMenu(event, share.id);
    });

    let touchStartTime;
    row.addEventListener('touchstart', (event) => {
        console.log(`[Table Row TouchStart] Share ID: ${share.id}`);
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
                console.log("[Table Row TouchMove] Long press cancelled due to movement.");
            }
        }
    });

    row.addEventListener('touchend', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            console.log("[Table Row TouchEnd] Long press timer cleared.");
        }
    });


    const displayShareName = (share.shareName && String(share.shareName).trim() !== '') ? share.shareName : '(No Code)';
    row.insertCell().textContent = displayShareName;

    const livePriceCell = row.insertCell();
    // Get live price data from the global livePrices object
    // livePriceData is already defined above for targetHit check
    const livePrice = livePriceData ? livePriceData.live : undefined;
    const prevClosePrice = livePriceData ? livePriceData.prevClose : undefined;

    if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) {
        // Add a span for the price value itself for more granular styling
        const priceValueSpan = document.createElement('span');
        priceValueSpan.classList.add('live-price-value'); // New class for the number
        priceValueSpan.textContent = `$${livePrice.toFixed(2)}`;
        livePriceCell.appendChild(priceValueSpan);
        
        // Calculate daily change using livePrice and prevClosePrice
        if (prevClosePrice !== undefined && prevClosePrice !== null && !isNaN(prevClosePrice)) {
            const change = livePrice - prevClosePrice;
            const percentageChange = (prevClosePrice !== 0 && !isNaN(prevClosePrice)) ? (change / prevClosePrice) * 100 : 0; // Handle division by zero
            const priceChangeSpan = document.createElement('span');
            priceChangeSpan.classList.add('price-change');
            if (change > 0) {
                priceChangeSpan.textContent = `(+$${change.toFixed(2)} / +${percentageChange.toFixed(2)}%)`; // Include percentage
                priceChangeSpan.classList.add('positive');
                livePriceCell.classList.add('positive-change'); // Apply conditional background
            } else if (change < 0) {
                priceChangeSpan.textContent = `(-$${Math.abs(change).toFixed(2)} / ${percentageChange.toFixed(2)}%)`; // Include percentage
                priceChangeSpan.classList.add('negative');
                livePriceCell.classList.add('negative-change'); // Apply conditional background
            } else {
                priceChangeSpan.textContent = `($0.00 / 0.00%)`;
                priceChangeSpan.classList.add('neutral');
            }
            livePriceCell.appendChild(priceChangeSpan);
        }
    } else {
        livePriceCell.textContent = 'N/A';
    }

    const enteredPriceCell = row.insertCell();
    const enteredPriceNum = Number(share.currentPrice);
    const displayEnteredPrice = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? `$${enteredPriceNum.toFixed(2)}` : '-';
    enteredPriceCell.textContent = displayEnteredPrice;


    const targetPriceNum = Number(share.targetPrice);
    const displayTargetPrice = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? `$${targetPriceNum.toFixed(2)}` : '-';
    row.insertCell().textContent = displayTargetPrice;

    const dividendCell = row.insertCell();
    const dividendAmountNum = Number(share.dividendAmount);
    const frankingCreditsNum = Number(share.frankingCredits);
    const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;

    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, priceForYield); 
    // NEW: Display "0.00%" if unfrankedYield is null or NaN, otherwise format
    const displayUnfrankedYield = unfrankedYield !== null && !isNaN(unfrankedYield) ? `${unfrankedYield.toFixed(2)}%` : '0.00%';
    
    const frankedYield = calculateFrankedYield(dividendAmountNum, priceForYield, frankingCreditsNum);
    // NEW: Display "0.00%" if frankedYield is null or NaN, otherwise format
    const displayFrankedYield = frankedYield !== null && !isNaN(frankedYield) ? `${frankedYield.toFixed(2)}%` : '0.00%';

    dividendCell.innerHTML = `
        <div class="dividend-yield-cell-content">
            <span>Dividend:</span> <span class="value">${(Number(share.dividendAmount) !== null && !isNaN(Number(share.dividendAmount))) ? `$${Number(share.dividendAmount).toFixed(2)}` : '-'}</span>
        </div>
        <div class="dividend-yield-cell-content">
            <span>Unfranked Yield:</span> <span class="value">${displayUnfrankedYield}&#xFE0E;</span>
        </div>
        <div class="dividend-yield-cell-content">
            <span>Franked Yield:</span> <span class="value">${displayFrankedYield}&#xFE0E;</span>
        </div>
    `;

    // Removed comments cell as per instruction
    // const commentsCell = row.insertCell();
    // commentsCell.textContent = ''; 
    console.log(`[Render] Added share ${displayShareName} to table.`);
}

function addShareToMobileCards(share) {
    if (!mobileShareCardsContainer) { console.error("[addShareToMobileCards] mobileShareCardsContainer element not found."); return; }
    if (!window.matchMedia("(max-width: 768px)").matches) { return; }

    const card = document.createElement('div');
    card.className = 'mobile-card';
    card.dataset.docId = share.id;

    // NEW: Apply target-hit-alert class if condition met
    const livePriceData = livePrices[share.shareName.toUpperCase()];
    const isTargetHit = livePriceData ? livePriceData.targetHit : false;
    if (isTargetHit) {
        card.classList.add('target-hit-alert');
    } else {
        card.classList.remove('target-hit-alert');
    }

    const enteredPriceNum = Number(share.currentPrice);
    const dividendAmountNum = Number(share.dividendAmount);
    const frankingCreditsNum = Number(share.frankingCredits);
    const targetPriceNum = Number(share.targetPrice);
    
    // Get live price data from the global livePrices object
    // livePriceData is already defined above for targetHit check
    const livePrice = livePriceData ? livePriceData.live : undefined;
    const prevClosePrice = livePriceData ? livePriceData.prevClose : undefined;

    const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;

    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, priceForYield);
    const frankedYield = calculateFrankedYield(dividendAmountNum, priceForYield, frankingCreditsNum);

    const displayTargetPrice = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? targetPriceNum.toFixed(2) : '-';
    const displayDividendAmount = (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? dividendAmountNum.toFixed(2) : '-';
    const displayFrankingCredits = (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? `${frankingCreditsNum}%` : '-';
    const displayShareName = (share.shareName && String(share.shareName).trim() !== '') ? share.shareName : '(No Code)';
    const displayEnteredPrice = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? enteredPriceNum.toFixed(2) : '-';

    let livePriceHtml = '';
    let priceChangeClass = '';
    let priceChangeText = '';

    if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) {
        // Calculate daily change using livePrice and prevClosePrice for mobile cards
        if (prevClosePrice !== undefined && prevClosePrice !== null && !isNaN(prevClosePrice)) {
            const change = livePrice - prevClosePrice;
            const percentageChange = (prevClosePrice !== 0 && !isNaN(prevClosePrice)) ? (change / prevClosePrice) * 100 : 0;
            if (change > 0) {
                priceChangeText = `(+$${change.toFixed(2)} / +${percentageChange.toFixed(2)}%)`;
                priceChangeClass = 'positive';
            } else if (change < 0) {
                priceChangeText = `(-$${Math.abs(change).toFixed(2)} / ${percentageChange.toFixed(2)}%)`;
                priceChangeClass = 'negative';
            } else {
                priceChangeText = `($0.00 / 0.00%)`;
                priceChangeClass = 'neutral';
            }
        }

        card.innerHTML = `
            <h3>${displayShareName}</h3>
            <div class="live-price-display-section ${priceChangeClass}-change-section">
                <span class="live-price-large">$${livePrice.toFixed(2)}</span>
                <span class="price-change-large ${priceChangeClass}">${priceChangeText}</span>
            </div>
            <p><strong>Entered Price:</strong> $${displayEnteredPrice}</p>
            <p><strong>Target:</strong> $${displayTargetPrice}</p>
            <p><strong>Dividend:</strong> $${displayDividendAmount}</p>
            <p><strong>Franking:</strong> ${displayFrankingCredits}</p>
            <p><strong>Unfranked Yield:</strong> ${unfrankedYield !== null && !isNaN(unfrankedYield) ? unfrankedYield.toFixed(2) + '%' : '0.00%'}&#xFE0E;</p>
            <p><strong>Franked Yield:</strong> ${frankedYield !== null && !isNaN(frankedYield) ? frankedYield.toFixed(2) + '%' : '0.00%'}&#xFE0E;</p>
            <!-- Removed Entry Date from mobile cards -->
            <!-- <p><strong>Entry Date:</strong> ${formatDate(share.entryDate) || '-'}</p> -->
        `;
    } else {
        card.innerHTML = `
            <h3>${displayShareName}</h3>
            <div class="live-price-display-section">
                <span class="live-price-large">N/A</span>
                <span class="price-change-large"></span>
            </div>
            <p><strong>Entered Price:</strong> $${displayEnteredPrice}</p>
            <p><strong>Target:</strong> $${displayTargetPrice}</p>
            <p><strong>Dividend:</strong> $${displayDividendAmount}</p>
            <p><strong>Franking:</strong> ${displayFrankingCredits}</p>
            <p><strong>Unfranked Yield:</strong> ${unfrankedYield !== null && !isNaN(unfrankedYield) ? unfrankedYield.toFixed(2) + '%' : '0.00%'}&#xFE0E;</p>
            <p><strong>Franked Yield:</strong> ${frankedYield !== null && !isNaN(frankedYield) ? frankedYield.toFixed(2) + '%' : '0.00%'}&#xFE0E;</p>
            <!-- Removed Entry Date from mobile cards -->
            <!-- <p><strong>Entry Date:</strong> ${formatDate(share.entryDate) || '-'}</p> -->
        `;
    }
    mobileShareCardsContainer.appendChild(card);

    let lastClickTime = 0;
    card.addEventListener('click', function(e) {
        console.log(`[Mobile Card Click] Share ID: ${share.id}`);
        if (!contextMenuOpen) {
            const currentTime = new Date().getTime();
            const clickDelay = 300;
            if (currentTime - lastClickTime < clickDelay) {
                console.log(`[Mobile Card Double Click] Share ID: ${share.id}`);
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
        console.log(`[Mobile Card ContextMenu] Share ID: ${share.id}`);
        event.preventDefault();
        selectShare(share.id);
        showContextMenu(event, share.id);
    });

    let touchStartTime;
    card.addEventListener('touchstart', (event) => {
        console.log(`[Mobile Card TouchStart] Share ID: ${share.id}`);
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
                console.log("[Mobile Card TouchMove] Long press cancelled due to movement.");
            }
        }
    });

    card.addEventListener('touchend', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            console.log("[Mobile Card TouchEnd] Long press timer cleared.");
        }
    });

    console.log(`[Render] Added share ${displayShareName} to mobile cards.`);
}

/**
 * Renders the watchlist based on the currentSelectedWatchlistIds.
 */
function renderWatchlist() {
    console.log(`[Render] Rendering shares for selected watchlists: ${currentSelectedWatchlistIds.join(', ')}`);
    clearShareListUI();
    
    let sharesToRender = [];

    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        sharesToRender = [...allSharesData];
        mainTitle.textContent = "All My Shares";
        console.log("[Render] Displaying all shares (from ALL_SHARES_ID in currentSelectedWatchlistIds).");
    } else if (currentSelectedWatchlistIds.length === 0 && userWatchlists.length > 0) {
        currentSelectedWatchlistIds = [userWatchlists[0].id];
        sharesToRender = allSharesData.filter(share => currentSelectedWatchlistIds.includes(share.watchlistId));
        mainTitle.textContent = userWatchlists[0].name;
        console.log("[Render] No specific watchlists selected, defaulting to first watchlist.");
    } else if (currentSelectedWatchlistIds.length > 0) {
        sharesToRender = allSharesData.filter(share => currentSelectedWatchlistIds.includes(share.watchlistId));
        const selectedNames = currentSelectedWatchlistIds.map(id => {
            const wl = userWatchlists.find(w => w.id === id);
            return wl ? wl.name : 'Unknown Watchlist';
        });
        if (selectedNames.length === 1) {
            mainTitle.textContent = selectedNames[0];
        } else if (selectedNames.length > 1) {
            mainTitle.textContent = "Multiple Watchlists Selected";
        } else {
            mainTitle.textContent = "No Watchlists Selected";
        }
        console.log(`[Render] Displaying shares from watchlists: ${selectedNames.join(', ')}`);
    } else {
        mainTitle.textContent = "Share Watchlist";
        console.log("[Render] No watchlists available for display.");
    }


    if (sharesToRender.length === 0) {
        const emptyWatchlistMessage = document.createElement('p');
        emptyWatchlistMessage.textContent = `No shares found for the selected watchlists. Add a new share to get started!`;
        emptyWatchlistMessage.style.textAlign = 'center';
        emptyWatchlistMessage.style.padding = '20px';
        emptyWatchlistMessage.style.color = 'var(--ghosted-text)';
        const td = document.createElement('td');
        td.colSpan = 5; // Updated colspan to 5 as Comments column is removed
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
    console.log("[Render] Watchlist rendering complete.");
    updateTargetHitBubble(); // NEW: Update the bubble after rendering the watchlist
}

function renderAsxCodeButtons() {
    if (!asxCodeButtonsContainer) { console.error("[renderAsxCodeButtons] asxCodeButtonsContainer element not found."); return; }
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
        console.log("[UI] No unique ASX codes found for current view. Hiding ASX buttons container.");
    } else {
        asxCodeButtonsContainer.style.display = 'flex';
    }
    const sortedAsxCodes = Array.from(uniqueAsxCodes).sort();
    sortedAsxCodes.forEach(asxCode => {
        const button = document.createElement('button');
        button.className = 'asx-code-btn';
        button.textContent = asxCode;
        button.dataset.asxCode = asxCode;
        asxCodeButtonsContainer.appendChild(button);
        button.addEventListener('click', (event) => {
            console.log(`[ASX Button Click] Button for ${asxCode} clicked.`);
            const clickedCode = event.target.dataset.asxCode;
            scrollToShare(clickedCode);
        });
    });
    console.log(`[UI] Rendered ${sortedAsxCodes.length} code buttons.`);
    // NEW: Adjust padding after rendering buttons, as their presence affects header height
    adjustMainContentPadding();
}

function scrollToShare(asxCode) {
    console.log(`[UI] Attempting to scroll to/highlight share with Code: ${asxCode}`);
    const targetShare = allSharesData.find(s => s.shareName && s.shareName.toUpperCase() === asxCode.toUpperCase());
    if (targetShare) {
        selectShare(targetShare.id);
        let elementToScrollTo = document.querySelector(`#shareTable tbody tr[data-doc-id="${targetShare.id}"]`);
        if (!elementToScrollTo || window.matchMedia("(max-width: 768px)").matches) {
            elementToScrollTo = document.querySelector(`.mobile-card[data-doc-id="${targetShare.id}"]`);
        }
        if (elementToScrollTo) {
            // Get the height of the fixed header
            const fixedHeaderHeight = appHeader ? appHeader.offsetHeight : 0;
            const elementRect = elementToScrollTo.getBoundingClientRect();
            // Calculate scroll position, accounting for the fixed header
            const scrollY = elementRect.top + window.scrollY - fixedHeaderHeight - 10; // 10px buffer for a little space
            window.scrollTo({ top: scrollY, behavior: 'smooth' });
            console.log(`[UI] Scrolled to element for share ID: ${targetShare.id}`);
        } else {
            console.warn(`[UI] Element for share ID: ${targetShare.id} not found for scrolling.`);
        }
        showShareDetails(); 
    } else {
        showCustomAlert(`Share '${asxCode}' not found.`);
        console.warn(`[UI] Share '${asxCode}' not found in allSharesData.`);
    }
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
    calculatorInput.textContent = previousCalculatorInput + (operator ? ` ${getOperatorSymbol(operator)} ` : '') + currentCalculatorInput;
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
            if (current === 0) { showCustomAlert("Cannot divide by zero!"); res = 'Error'; }
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
    console.log("[Calculator] Calculator state reset.");
}

async function applyTheme(themeName) {
    const body = document.body;
    // Remove all existing theme classes
    body.className = body.className.split(' ').filter(c => !c.endsWith('-theme') && !c.startsWith('theme-')).join(' ');

    console.log(`[Theme Debug] Attempting to apply theme: ${themeName}`);
    currentActiveTheme = themeName;

    if (themeName === 'system-default') {
        body.removeAttribute('data-theme');
        localStorage.removeItem('selectedTheme');
        localStorage.removeItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
            body.classList.add('dark-theme');
        }
        console.log("[Theme Debug] Reverted to system default theme.");
        // When reverting to system-default, ensure currentCustomThemeIndex is reset to -1
        currentCustomThemeIndex = -1; 
    } else if (themeName === 'light' || themeName === 'dark') {
        body.removeAttribute('data-theme');
        localStorage.removeItem('selectedTheme');
        localStorage.setItem('theme', themeName);
        if (themeName === 'dark') {
            body.classList.add('dark-theme');
        }
        console.log(`[Theme Debug] Applied explicit default theme: ${themeName}`);
        // When applying explicit light/dark, ensure currentCustomThemeIndex is reset to -1
        currentCustomThemeIndex = -1; 
    } else {
        body.classList.add('theme-' + themeName);
        body.setAttribute('data-theme', themeName);
        localStorage.setItem('selectedTheme', themeName);
        localStorage.removeItem('theme');
        console.log(`[Theme Debug] Applied custom theme: ${themeName}`);
        // When applying a custom theme, set currentCustomThemeIndex to its position
        currentCustomThemeIndex = CUSTOM_THEMES.indexOf(themeName); 
    }
    
    console.log(`[Theme Debug] Body classes after applying: ${body.className}`);
    console.log(`[Theme Debug] currentCustomThemeIndex after applying: ${currentCustomThemeIndex}`);

    if (currentUserId && db && window.firestore) {
        const userProfileDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`);
        try {
            await window.firestore.setDoc(userProfileDocRef, { lastTheme: themeName }, { merge: true });
            console.log(`[Theme] Saved theme preference to Firestore: ${themeName}`);
        } catch (error) {
            console.error("[Theme] Error saving theme preference to Firestore:", error);
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
            // If not a custom theme, set dropdown to 'none' (System Default)
            colorThemeSelect.value = 'none';
        }
        console.log(`[Theme UI] Color theme select updated to: ${colorThemeSelect.value}`);
    }

    // This part ensures currentCustomThemeIndex is correctly set based on the currentActiveTheme
    // regardless of whether it was set by toggle or dropdown/load.
    // This is crucial for the toggle button to know where it is in the cycle.
    if (CUSTOM_THEMES.includes(currentActiveTheme)) {
        currentCustomThemeIndex = CUSTOM_THEMES.indexOf(currentActiveTheme);
    } else {
        currentCustomThemeIndex = -1; // Not a custom theme, so reset index
    }
    console.log(`[Theme UI] currentCustomThemeIndex after updateThemeToggleAndSelector: ${currentCustomThemeIndex}`);
}

function getDefaultWatchlistId(userId) {
    return `${userId}_${DEFAULT_WATCHLIST_ID_SUFFIX}`;
}

async function saveLastSelectedWatchlistIds(watchlistIds) {
    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Watchlist] Cannot save last selected watchlists: DB, User ID, or Firestore functions not available.");
        return;
    }
    const userProfileDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`);
    try {
        await window.firestore.setDoc(userProfileDocRef, { lastSelectedWatchlistIds: watchlistIds }, { merge: true });
        console.log(`[Watchlist] Saved last selected watchlist IDs: ${watchlistIds.join(', ')}`);
    }
    catch (error) {
        console.error("[Watchlist] Error saving last selected watchlist IDs:", error);
    }
}

async function saveSortOrderPreference(sortOrder) {
    console.log(`[Sort Debug] Attempting to save sort order: ${sortOrder}`);
    console.log(`[Sort Debug] db: ${db ? 'Available' : 'Not Available'}`);
    console.log(`[Sort Debug] currentUserId: ${currentUserId}`);
    console.log(`[Sort Debug] window.firestore: ${window.firestore ? 'Available' : 'Not Available'}`);

    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Sort] Cannot save sort order preference: DB, User ID, or Firestore functions not available. Skipping save.");
        return;
    }
    const userProfileDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`);
    try {
        await window.firestore.setDoc(userProfileDocRef, { lastSortOrder: sortOrder }, { merge: true });
        console.log(`[Sort] Saved sort order preference: ${sortOrder}`);
    }
    catch (error) {
        console.error("[Sort] Error saving sort order preference:", error);
    }
}

async function loadUserWatchlistsAndSettings() {
    if (!db || !currentUserId) {
        console.warn("[User Settings] Firestore DB or User ID not available for loading settings.");
        return;
    }
    userWatchlists = [];
    const watchlistsColRef = window.firestore ? window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`) : null;
    const userProfileDocRef = window.firestore ? window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`) : null;

    if (!watchlistsColRef || !userProfileDocRef) {
        console.error("[User Settings] Firestore collection or doc reference is null. Cannot load settings.");
        showCustomAlert("Firestore services not fully initialized. Cannot load user settings.");
        return;
    }

    try {
        console.log("[User Settings] Fetching user watchlists and profile settings...");
        const querySnapshot = await window.firestore.getDocs(window.firestore.query(watchlistsColRef));
        querySnapshot.forEach(doc => { userWatchlists.push({ id: doc.id, name: doc.data().name }); });
        console.log(`[User Settings] Found ${userWatchlists.length} existing watchlists.`);

        if (userWatchlists.length === 0) {
            const defaultWatchlistRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists/${getDefaultWatchlistId(currentUserId)}`);
            await window.firestore.setDoc(defaultWatchlistRef, { name: DEFAULT_WATCHLIST_NAME, createdAt: new Date().toISOString() });
            userWatchlists.push({ id: getDefaultWatchlistId(currentUserId), name: DEFAULT_WATCHLIST_NAME });
            console.log("[User Settings] Created default watchlist.");
        }
        userWatchlists.sort((a, b) => a.name.localeCompare(b.name));

        const userProfileSnap = await window.firestore.getDoc(userProfileDocRef);
        savedSortOrder = null;
        savedTheme = null;
        dismissedTargetHits = []; // Initialize to empty array before loading

        if (userProfileSnap.exists()) {
            savedSortOrder = userProfileSnap.data().lastSortOrder;
            savedTheme = userProfileSnap.data().lastTheme;
            currentSelectedWatchlistIds = userProfileSnap.data().lastSelectedWatchlistIds;
            // NEW: Load dismissedTargetHits
            if (userProfileSnap.data().dismissedTargetHits) {
                dismissedTargetHits = userProfileSnap.data().dismissedTargetHits;
                console.log(`[User Settings] Loaded dismissed target hits: ${dismissedTargetHits.length} items.`);
            }
            console.log(`[User Settings] Found last selected watchlists in profile: ${currentSelectedWatchlistIds}`);
            console.log(`[User Settings] Found saved sort order in profile: ${savedSortOrder}`);
            console.log(`[User Settings] Found saved theme in profile: ${savedTheme}`);
        }

        if (currentSelectedWatchlistIds && Array.isArray(currentSelectedWatchlistIds) && currentSelectedWatchlistIds.length > 0) {
            currentSelectedWatchlistIds = currentSelectedWatchlistIds.filter(id => 
                id === ALL_SHARES_ID || userWatchlists.some(wl => wl.id === id)
            );
            if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID) && userWatchlists.length === 0) {
                 currentSelectedWatchlistIds = [];
            }
            if (currentSelectedWatchlistIds.length === 0) {
                currentSelectedWatchlistIds = [userWatchlists[0].id];
                console.warn("[User Settings] Saved watchlist IDs were invalid or empty, defaulting to first watchlist.");
            }
        } else {
            currentSelectedWatchlistIds = [userWatchlists[0].id];
            console.log("[User Settings] No saved watchlist preference, defaulting to first watchlist.");
        }

        renderWatchlistSelect();
        
        if (currentUserId && savedSortOrder && Array.from(sortSelect.options).some(option => option.value === savedSortOrder)) {
            sortSelect.value = savedSortOrder;
            currentSortOrder = savedSortOrder;
            console.log(`[Sort] Applied saved sort order: ${currentSortOrder}`);
        } else {
            sortSelect.value = ''; 
            currentSortOrder = '';
            console.log("[Sort] No valid saved sort order or not logged in, defaulting to placeholder.");
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
            console.log("[Watchlist] No old shares to migrate/update, directly setting up shares listener for current watchlist.");
            await loadShares();
        }

    } catch (error) {
        console.error("[User Settings] Error loading user watchlists and settings:", error);
        showCustomAlert("Error loading user settings: " + error.message);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Fetches live price data from the Google Apps Script Web App.
 * Updates the `livePrices` global object.
 */
async function fetchLivePrices() {
    console.log("[Live Price] Attempting to fetch live prices...");
    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("[Live Price] Raw data received:", data);

        const newLivePrices = {};
        data.forEach(item => {
            const asxCode = String(item.ASXCode).toUpperCase();
            const livePrice = parseFloat(item.LivePrice);
            const prevClose = parseFloat(item.PrevClose); 
            const pe = parseFloat(item.PE);
            const high52 = parseFloat(item.High52);
            const low52 = parseFloat(item.Low52);

            if (asxCode && !isNaN(livePrice)) {
                // Find the corresponding share in allSharesData to get its targetPrice
                const shareData = allSharesData.find(s => s.shareName.toUpperCase() === asxCode);
                // Ensure targetPrice is parsed as a number, handling null/undefined/NaN
                const targetPrice = shareData && shareData.targetPrice !== null && !isNaN(parseFloat(shareData.targetPrice)) 
                                    ? parseFloat(shareData.targetPrice) 
                                    : undefined;

                const isTargetHit = (targetPrice !== undefined && livePrice <= targetPrice);

                // Debugging log:
                console.log(`[Target Price Debug] Share: ${asxCode}, Live: ${livePrice}, Target: ${targetPrice}, Is Target Hit: ${isTargetHit}`);


                newLivePrices[asxCode] = {
                    live: livePrice,
                    prevClose: isNaN(prevClose) ? null : prevClose,
                    PE: isNaN(pe) ? null : pe, 
                    High52: isNaN(high52) ? null : high52, 
                    Low52: isNaN(low52) ? null : low52, 
                    targetHit: isTargetHit 
                };
            } else {
                console.warn(`[Live Price] Skipping item due to missing ASX code or invalid price:`, item);
            }
        });
        livePrices = newLivePrices;
        console.log("[Live Price] Live prices updated:", livePrices);
        renderWatchlist(); 
    } catch (error) {
        console.error("[Live Price] Error fetching live prices:", error);
    }
}

/**
 * Starts the periodic fetching of live prices.
 */
function startLivePriceUpdates() {
    if (livePriceFetchInterval) {
        clearInterval(livePriceFetchInterval);
        console.log("[Live Price] Cleared existing live price interval.");
    }
    fetchLivePrices(); 
    livePriceFetchInterval = setInterval(fetchLivePrices, LIVE_PRICE_FETCH_INTERVAL_MS);
    console.log(`[Live Price] Started live price updates every ${LIVE_PRICE_FETCH_INTERVAL_MS / 1000 / 60} minutes.`);
}

/**
 * Stops the periodic fetching of live prices.
 */
function stopLivePriceUpdates() {
    if (livePriceFetchInterval) {
        clearInterval(livePriceFetchInterval);
        livePriceFetchInterval = null;
        console.log("[Live Price] Stopped live price updates.");
    }
}

/**
 * Updates the target hit notification bubble.
 * Filters shares that are at target and not dismissed, then updates the UI.
 */
function updateTargetHitBubble() {
    // Filter shares that are at target and not dismissed
    sharesAtTargetPrice = allSharesData.filter(share => {
        const livePriceData = livePrices[share.shareName.toUpperCase()];
        const isTargetHit = livePriceData && livePriceData.targetHit;
        const isDismissed = dismissedTargetHits.includes(share.id);
        return isTargetHit && !isDismissed;
    });

    if (!targetNotificationBubble || !bubbleCount || !bubbleDetails || !bubbleShareList) {
        console.warn("[Target Bubble] Notification bubble elements not found. Cannot update bubble.");
        return;
    }

    if (sharesAtTargetPrice.length > 0) {
        bubbleCount.textContent = sharesAtTargetPrice.length;
        targetNotificationBubble.classList.remove('hidden'); // Show the bubble
        // Ensure it's collapsed by default when it first appears or updates
        targetNotificationBubble.classList.remove('expanded');
        isBubbleExpanded = false;
        populateBubbleShareList(); // Populate details even if collapsed, for quick expansion
        console.log(`[Target Bubble] Showing bubble: ${sharesAtTargetPrice.length} shares hit target.`);
    } else {
        targetNotificationBubble.classList.add('hidden'); // Hide the bubble
        targetNotificationBubble.classList.remove('expanded'); // Ensure it's collapsed
        isBubbleExpanded = false;
        console.log("[Target Bubble] No shares hit target or all dismissed. Hiding bubble.");
    }
}

/**
 * Populates the list of shares within the expanded target notification bubble.
 */
function populateBubbleShareList() {
    if (!bubbleShareList) return;
    bubbleShareList.innerHTML = ''; // Clear existing list

    if (sharesAtTargetPrice.length === 0) {
        const li = document.createElement('li');
        li.textContent = "No shares currently at target.";
        li.style.textAlign = 'center';
        li.style.color = 'var(--ghosted-text)';
        li.style.cursor = 'default';
        li.style.borderBottom = 'none';
        bubbleShareList.appendChild(li);
        if (bubbleDismissAllBtn) bubbleDismissAllBtn.style.display = 'none';
        return;
    }
    if (bubbleDismissAllBtn) bubbleDismissAllBtn.style.display = 'block';

    sharesAtTargetPrice.forEach(share => {
        const li = document.createElement('li');
        li.dataset.shareId = share.id;
        li.textContent = share.shareName;
        // Optionally add live price to the list item
        const livePriceData = livePrices[share.shareName.toUpperCase()];
        if (livePriceData && livePriceData.live !== undefined && livePriceData.live !== null && !isNaN(livePriceData.live)) {
            const priceSpan = document.createElement('span');
            priceSpan.textContent = ` ($${livePriceData.live.toFixed(2)})`;
            priceSpan.style.fontWeight = 'normal';
            priceSpan.style.fontSize = '0.9em';
            priceSpan.style.color = 'var(--ghosted-text)';
            li.appendChild(priceSpan);
        }
        bubbleShareList.appendChild(li);
    });
}

/**
 * Toggles the expanded/collapsed state of the target notification bubble.
 */
function toggleBubbleExpansion() {
    if (!targetNotificationBubble) return;
    isBubbleExpanded = !isBubbleExpanded;
    if (isBubbleExpanded) {
        targetNotificationBubble.classList.add('expanded');
        // Ensure details are populated when expanding
        populateBubbleShareList();
        console.log("[Target Bubble] Expanded.");
    } else {
        targetNotificationBubble.classList.remove('expanded');
        console.log("[Target Bubble] Collapsed.");
    }
}

/**
 * Forces the target notification bubble to collapse.
 */
function collapseBubble() {
    if (targetNotificationBubble) {
        targetNotificationBubble.classList.remove('expanded');
        isBubbleExpanded = false;
        console.log("[Target Bubble] Forcibly collapsed.");
    }
}

/**
 * Adds a share ID to the dismissedTargetHits array and saves it to Firestore.
 * @param {string} shareId The ID of the share to dismiss.
 */
async function dismissTargetHit(shareId) {
    if (!dismissedTargetHits.includes(shareId)) {
        dismissedTargetHits.push(shareId);
        await saveDismissedTargetHits();
        console.log(`[Target Bubble] Dismissed share ID: ${shareId}`);
        updateTargetHitBubble(); // Re-render bubble after dismissal
    }
}

/**
 * Dismisses all currently active target hit notifications.
 */
async function dismissAllTargetHits() {
    if (sharesAtTargetPrice.length > 0) {
        sharesAtTargetPrice.forEach(share => {
            if (!dismissedTargetHits.includes(share.id)) {
                dismissedTargetHits.push(share.id);
            }
        });
        await saveDismissedTargetHits();
        console.log("[Target Bubble] Dismissed all current target hits.");
        updateTargetHitBubble(); // Re-render bubble after dismissal
        collapseBubble(); // Collapse after dismissing all
    }
}

/**
 * Saves the current `dismissedTargetHits` array to Firestore.
 */
async function saveDismissedTargetHits() {
    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Firestore] Cannot save dismissed target hits: DB, User ID, or Firestore functions not available.");
        return;
    }
    const userProfileDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`);
    try {
        await window.firestore.setDoc(userProfileDocRef, { dismissedTargetHits: dismissedTargetHits }, { merge: true });
        console.log(`[Firestore] Saved dismissed target hits: ${dismissedTargetHits.length} items.`);
    } catch (error) {
        console.error("[Firestore] Error saving dismissed target hits:", error);
    }
}

/**
 * Loads the `dismissedTargetHits` array from Firestore.
 */
async function loadDismissedTargetHits() {
    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Firestore] Cannot load dismissed target hits: DB, User ID, or Firestore functions not available.");
        return;
    }
    const userProfileDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`);
    try {
        const docSnap = await window.firestore.getDoc(userProfileDocRef);
        if (docSnap.exists() && docSnap.data().dismissedTargetHits) {
            dismissedTargetHits = docSnap.data().dismissedTargetHits;
            console.log(`[Firestore] Loaded dismissed target hits: ${dismissedTargetHits.length} items.`);
        } else {
            dismissedTargetHits = [];
            console.log("[Firestore] No dismissed target hits found in profile.");
        }
    } catch (error) {
        console.error("[Firestore] Error loading dismissed target hits:", error);
        dismissedTargetHits = []; // Default to empty on error
    }
}


/**
 * Sets up a real-time Firestore listener for shares based on currentSelectedWatchlistIds.
 * Updates `allSharesData` and re-renders the UI whenever changes occur.
 */
async function loadShares() {
    if (unsubscribeShares) {
        unsubscribeShares();
        unsubscribeShares = null;
        console.log("[Firestore Listener] Unsubscribed from previous shares listener.");
    }

    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Shares] Firestore DB, User ID, or Firestore functions not available for loading shares. Clearing list.");
        clearShareList();
        return;
    }
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    
    try {
        const sharesCol = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
        let q;

        let effectiveWatchlistId = null;
        if (watchlistSelect && watchlistSelect.value && watchlistSelect.value !== "") {
            effectiveWatchlistId = watchlistSelect.value;
        } else if (currentSelectedWatchlistIds.length > 0 && currentSelectedWatchlistIds[0] !== ALL_SHARES_ID) {
            effectiveWatchlistId = currentSelectedWatchlistIds[0];
        } else if (userWatchlists.length > 0) {
            effectiveWatchlistId = userWatchlists[0].id;
        }

        if (effectiveWatchlistId === ALL_SHARES_ID) {
            q = window.firestore.query(sharesCol);
            console.log(`[Shares] Setting up real-time listener for ALL shares for user: ${currentUserId}`);
        } else if (effectiveWatchlistId) {
            q = window.firestore.query(sharesCol, window.firestore.where("watchlistId", "==", effectiveWatchlistId));
            console.log(`[Shares] Setting up real-time listener for shares in watchlist: ${effectiveWatchlistId}`);
        } else {
            q = window.firestore.query(sharesCol, window.firestore.where("watchlistId", "==", "NO_WATCHLIST_ID_EXISTS"));
            console.warn("[Shares] No effective watchlist selected or available. Querying for non-existent ID to get empty results.");
        }
        
        unsubscribeShares = window.firestore.onSnapshot(q, (querySnapshot) => {
            console.log("[Firestore Listener] Shares snapshot received. Processing changes.");
            let fetchedShares = [];
            querySnapshot.forEach((doc) => {
                const share = { id: doc.id, ...doc.data() };
                fetchedShares.push(share);
            });

            allSharesData = fetchedShares;
            console.log(`[Shares] Shares data updated from snapshot. Total shares: ${allSharesData.length}`);
            
            sortShares();
            renderAsxCodeButtons();
            
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }, (error) => {
            console.error("[Firestore Listener] Error listening to shares:", error);
            showCustomAlert("Error loading shares in real-time: " + error.message);
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        });

    } catch (error) {
        console.error("[Shares] Error setting up shares listener:", error);
        showCustomAlert("Error setting up real-time share updates: " + error.message);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}


async function migrateOldSharesToWatchlist() {
    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Migration] Firestore DB, User ID, or Firestore functions not available for migration.");
        return false;
    }
    const sharesCol = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
    const q = window.firestore.query(sharesCol);
    let sharesToUpdate = [];
    let anyMigrationPerformed = false;
    try {
        console.log("[Migration] Checking for old shares to migrate/update schema and data types.");
        const querySnapshot = await window.firestore.getDocs(q);
        querySnapshot.forEach(doc => {
            const shareData = doc.data();
            let updatePayload = {};
            let needsUpdate = false;
            if (!shareData.hasOwnProperty('watchlistId')) {
                needsUpdate = true;
                updatePayload.watchlistId = getDefaultWatchlistId(currentUserId);
                console.log(`[Migration] Share '${doc.id}' missing watchlistId. Assigning to default.`);
            }
            if ((!shareData.shareName || String(shareData.shareName).trim() === '') && shareData.hasOwnProperty('name') && String(shareData.name).trim() !== '') {
                needsUpdate = true;
                updatePayload.shareName = String(shareData.name).trim();
                updatePayload.name = window.firestore.deleteField();
                console.log(`[Migration] Share '${doc.id}' missing 'shareName' but has 'name' ('${shareData.name}'). Migrating 'name' to 'shareName'.`);
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
                            console.log(`[Migration] Share '${doc.id}': Converted ${field} from string '${value}' (type ${originalValueType}) to number ${parsedValue}.`);
                        }
                    } else {
                        needsUpdate = true;
                        updatePayload[field] = null;
                        console.warn(`[Migration] Share '${doc.id}': Field '${field}' was invalid string '${value}', setting to null.`);
                    }
                } else if (originalValueType === 'number' && isNaN(value)) {
                    needsUpdate = true;
                    updatePayload[field] = null;
                    console.warn(`[Migration] Share '${doc.id}': Field '${field}' was NaN number, setting to null.`);
                }
                if (field === 'frankingCredits' && typeof parsedValue === 'number' && !isNaN(parsedValue)) {
                    if (parsedValue > 0 && parsedValue < 1) {
                        needsUpdate = true;
                        updatePayload.frankingCredits = parsedValue * 100;
                        console.log(`[Migration] Share '${doc.id}': Converted frankingCredits from decimal ${parsedValue} to percentage ${parsedValue * 100}.`);
                    }
                }
            });
            const effectiveCurrentPrice = (typeof updatePayload.currentPrice === 'number' && !isNaN(updatePayload.currentPrice)) ? updatePayload.currentPrice :
                                          ((typeof shareData.currentPrice === 'string' ? parseFloat(shareData.currentPrice) : shareData.currentPrice) || null);
            if (!shareData.hasOwnProperty('lastFetchedPrice') || (typeof shareData.lastFetchedPrice === 'string' && isNaN(parseFloat(shareData.lastFetchedPrice)))) {
                needsUpdate = true;
                updatePayload.lastFetchedPrice = effectiveCurrentPrice;
                console.log(`[Migration] Share '${doc.id}': Setting missing lastFetchedPrice to ${effectiveCurrentPrice}.`);
            }
            if (!shareData.hasOwnProperty('previousFetchedPrice') || (typeof shareData.previousFetchedPrice === 'string' && isNaN(parseFloat(shareData.previousFetchedPrice)))) {
                needsUpdate = true;
                updatePayload.previousFetchedPrice = effectiveCurrentPrice;
                console.log(`[Migration] Share '${doc.id}': Setting missing previousFetchedPrice to ${effectiveCurrentPrice}.`);
            }
            if (!shareData.hasOwnProperty('lastPriceUpdateTime')) {
                needsUpdate = true;
                updatePayload.lastPriceUpdateTime = new Date().toISOString();
                console.log(`[Migration] Share '${doc.id}': Setting missing lastPriceUpdateTime.`);
            }
            if (needsUpdate) { sharesToUpdate.push({ ref: doc.ref, data: updatePayload }); }
        });
        if (sharesToUpdate.length > 0) {
            console.log(`[Migration] Performing consolidated update for ${sharesToUpdate.length} shares.`);
            for (const item of sharesToUpdate) { await window.firestore.updateDoc(item.ref, item.data); }
            showCustomAlert(`Migrated/Updated ${sharesToUpdate.length} old shares.`, 2000);
            console.log("[Migration] Migration complete. Setting up shares listener.");
            await loadShares();
            anyMigrationPerformed = true;
        } else {
            console.log("[Migration] No old shares found requiring migration or schema update.");
        }
        return anyMigrationPerformed;
    } catch (error) {
        console.error("[Migration] Error during data migration: " + error.message);
        showCustomAlert("Error during data migration: " + error.message);
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
    console.log(`[Context Menu] Opened for share ID: ${shareId} at (${x}, ${y})`);
}

function hideContextMenu() {
    if (shareContextMenu) {
        shareContextMenu.style.display = 'none';
        contextMenuOpen = false;
        currentContextMenuShareId = null;
        deselectCurrentShare();
        console.log("[Context Menu] Hidden.");
    }
}

function toggleAppSidebar(forceState = null) {
    console.log(`[Sidebar] toggleAppSidebar called. Current open state: ${appSidebar.classList.contains('open')}, Force state: ${forceState}`);
    const isDesktop = window.innerWidth > 768;
    const isOpen = appSidebar.classList.contains('open');

    if (forceState === true || (forceState === null && !isOpen)) {
        appSidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
        if (isDesktop) {
            document.body.classList.add('sidebar-active');
            sidebarOverlay.style.pointerEvents = 'none';
            console.log("[Sidebar] Desktop: Sidebar opened, body shifted, overlay pointer-events: none.");
        } else {
            document.body.classList.remove('sidebar-active');
            sidebarOverlay.style.pointerEvents = 'auto';
            console.log("[Sidebar] Mobile: Sidebar opened, body NOT shifted, overlay pointer-events: auto.");
        }
        console.log("[Sidebar] Sidebar opened.");
    } else if (forceState === false || (forceState === null && isOpen)) {
        appSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
        document.body.classList.remove('sidebar-active');
        sidebarOverlay.style.pointerEvents = 'none';
        console.log("[Sidebar] Sidebar closed.");
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
        showCustomAlert("Please sign in and select watchlists to export.");
        return;
    }
    
    let sharesToExport = [];
    let exportFileNamePrefix = "selected_watchlists";

    if (currentSelectedWatchlistIds.length === 1) {
        const selectedWatchlistId = currentSelectedWatchlistIds[0];
        if (selectedWatchlistId === ALL_SHARES_ID) {
            sharesToExport = [...allSharesData];
            exportFileNamePrefix = "all_shares";
        } else {
            sharesToExport = allSharesData.filter(share => share.watchlistId === selectedWatchlistId);
            const wl = userWatchlists.find(w => w.id === selectedWatchlistId);
            if (wl) { exportFileNamePrefix = wl.name; }
        }
    } else {
        sharesToExport = [...allSharesData];
        exportFileNamePrefix = "all_shares";
    }

    if (sharesToExport.length === 0) {
        showCustomAlert("No shares in the current selection to export.", 2000);
        return;
    }

    const headers = [
        "Code", "Entered Price", "Live Price", "Price Change", "Target Price", "Dividend Amount", "Franking Credits (%)",
        "Unfranked Yield (%)", "Franked Yield (%)", "Entry Date"
        // Removed "Comments" from headers
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
            priceChange = `${change.toFixed(2)} (${percentageChange.toFixed(2)}%)`; // Include percentage in CSV
        }

        const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;

        const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, priceForYield);
        const frankedYield = calculateFrankedYield(dividendAmountNum, priceForYield, frankingCreditsNum);

        // Comments are no longer exported
        // let allCommentsText = '';
        // if (share.comments && Array.isArray(share.comments)) {
        //     allCommentsText = share.comments.map(c => {
        //         let commentPart = '';
        //         if (c.title) commentPart += `${c.title}: `;
        //         if (c.text) commentPart += c.text;
        //         return commentPart;
        //     }).filter(Boolean).join('; ');
        // }

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
            // Removed allCommentsText from row
        ];
        csvRows.push(row.map(escapeCsvValue).join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const formattedDate = new Date().toISOString().slice(0, 10);
    const safeFileNamePrefix = exportFileNamePrefix.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${safeFileNamePrefix}_watchlist_${formattedDate}.csv`;
    
    link.href = URL.createObjectURL(blob);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    showCustomAlert(`Exported shares to CSV!`, 2000);
    console.log(`[Export] Shares exported to CSV with prefix: '${exportFileNamePrefix}'.`);
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
            console.log("[Dirty State] Existing watchlist: No changes detected, save disabled.");
        }
    } else if (isAddModal) {
        // For new watchlists, enable if name is valid
    }

    const targetSaveBtn = isAddModal ? saveWatchlistBtn : saveWatchlistNameBtn;
    setIconDisabled(targetSaveBtn, !canSave);
    console.log(`[Dirty State] Watchlist save button enabled: ${canSave} (Modal: ${isAddModal ? 'Add' : 'Edit'})`);
}

/**
 * Saves or updates watchlist data to Firestore. Can be called silently for auto-save.
 * @param {boolean} isSilent If true, no alert messages are shown on success.
 * @param {string} newName The new name for the watchlist.
 * @param {string|null} watchlistId The ID of the watchlist to update, or null if adding new.
 */
async function saveWatchlistChanges(isSilent = false, newName, watchlistId = null) {
    console.log("[Watchlist Form] saveWatchlistChanges called.");

    if (!newName || newName.trim() === '') {
        if (!isSilent) showCustomAlert("Watchlist name is required!");
        console.warn("[Save Watchlist] Watchlist name is empty. Skipping save.");
        return;
    }

    // Check for duplicate name (case-insensitive, excluding current watchlist if editing)
    const isDuplicate = userWatchlists.some(w => 
        w.name.toLowerCase() === newName.toLowerCase() && w.id !== watchlistId
    );
    if (isDuplicate) {
        if (!isSilent) showCustomAlert("A watchlist with this name already exists!");
        console.warn("[Save Watchlist] Duplicate watchlist name. Skipping save.");
        return;
    }

    try {
        if (watchlistId) { // Editing existing watchlist
            const watchlistDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`, watchlistId);
            await window.firestore.updateDoc(watchlistDocRef, { name: newName });
            if (!isSilent) showCustomAlert(`Watchlist renamed to '${newName}'!`, 1500);
            console.log(`[Firestore] Watchlist (ID: ${watchlistId}) renamed to '${newName}'.`);
        } else { // Adding new watchlist
            const watchlistsColRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`);
            const newDocRef = await window.firestore.addDoc(watchlistsColRef, {
                name: newName,
                createdAt: new Date().toISOString(),
                userId: currentUserId
            });
            if (!isSilent) showCustomAlert(`Watchlist '${newName}' added!`, 1500);
            console.log(`[Firestore] Watchlist '${newName}' added with ID: ${newDocRef.id}`);
            // If new watchlist added, set it as current selection and save preference
            currentSelectedWatchlistIds = [newDocRef.id];
            await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds);
        }
        
        await loadUserWatchlistsAndSettings(); // Re-load to update UI and internal state
        if (!isSilent) closeModals(); // Only close if not a silent save
        originalWatchlistData = getCurrentWatchlistFormData(watchlistId === null); // Update original data after successful save
        checkWatchlistFormDirtyState(watchlistId === null); // Disable save button after saving
    } catch (error) {
        console.error("[Firestore] Error saving watchlist:", error);
        if (!isSilent) showCustomAlert("Error saving watchlist: " + error.message);
    }
}


async function initializeAppLogic() {
    console.log("initializeAppLogic: Firebase is ready. Starting app logic.");

    // Initial modal hiding
    if (shareFormSection) shareFormSection.style.setProperty('display', 'none', 'important');
    if (dividendCalculatorModal) dividendCalculatorModal.style.setProperty('display', 'none', 'important');
    if (shareDetailModal) shareDetailModal.style.setProperty('display', 'none', 'important');
    if (addWatchlistModal) addWatchlistModal.style.setProperty('display', 'none', 'important');
    if (manageWatchlistModal) manageWatchlistModal.style.setProperty('display', 'none', 'important');
    if (customDialogModal) customDialogModal.style.setProperty('display', 'none', 'important');
    if (calculatorModal) calculatorModal.style.setProperty('display', 'none', 'important');
    if (shareContextMenu) shareContextMenu.style.setProperty('display', 'none', 'important');
    // NEW: Ensure notification bubble is hidden initially
    if (targetNotificationBubble) targetNotificationBubble.classList.add('hidden');

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js', { scope: './' }) 
                .then(registration => {
                    console.log('Service Worker: Registered with scope:', registration.scope); 
                })
                .catch(error => {
                    console.error('Service Worker: Registration failed:', error);
                });
        });
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
                console.log("[Form] Share form close button (X) clicked. Clearing form before closing to cancel edits.");
                clearForm(); // This will reset originalShareData and selectedShareDocId, preventing auto-save
                closeModals(); // Now closeModals won't trigger auto-save for this form
            });
        } else {
            button.addEventListener('click', closeModals); // Other modals still close normally
        }
    });

    // Global click listener to close modals/context menu/bubble details if clicked outside
    window.addEventListener('click', (event) => {
        if (event.target === shareDetailModal || event.target === dividendCalculatorModal ||
            event.target === shareFormSection || event.target === customDialogModal ||
            event.target === calculatorModal || event.target === addWatchlistModal ||
            event.target === manageWatchlistModal) {
            closeModals();
        }

        if (contextMenuOpen && shareContextMenu && !shareContextMenu.contains(event.target)) {
            hideContextMenu();
        }

        // NEW: Collapse bubble details if clicked outside
        if (isBubbleExpanded && targetNotificationBubble && !targetNotificationBubble.contains(event.target)) {
            collapseBubble();
        }
    });

    // Google Auth Button (Sign In/Out)
    if (googleAuthBtn) {
        googleAuthBtn.addEventListener('click', async () => {
            console.log("[Auth] Google Auth Button Clicked.");
            const currentAuth = window.firebaseAuth;
            if (!currentAuth || !window.authFunctions) {
                console.warn("[Auth] Auth service not ready or functions not loaded. Cannot process click.");
                showCustomAlert("Authentication service not ready. Please try again in a moment.");
                return;
            }
            if (currentAuth.currentUser) {
                console.log("[Auth] Current user exists, attempting sign out.");
                try {
                    await window.authFunctions.signOut(currentAuth);
                    console.log("[Auth] User signed out.");
                } catch (error) {
                    console.error("[Auth] Sign-Out failed:", error);
                    showCustomAlert("Sign-Out failed: " + error.message);
                }
            } else {
                console.log("[Auth] No current user, attempting sign in.");
                try {
                    const provider = window.authFunctions.GoogleAuthProviderInstance;
                    if (!provider) {
                        console.error("[Auth] GoogleAuthProvider instance not found. Is Firebase module script loaded?");
                        showCustomAlert("Authentication service not ready. Please ensure Firebase module script is loaded.");
                        return;
                    }
                    await window.authFunctions.signInWithPopup(currentAuth, provider);
                    console.log("[Auth] Google Sign-In successful.");
                }
                catch (error) {
                    console.error("[Auth] Google Sign-In failed: " + error.message);
                    showCustomAlert("Google Sign-In failed: " + error.message);
                }
            }
        });
    }

    // Logout Button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            console.log("[Auth] Logout Button Clicked (No Confirmation).");
            const currentAuth = window.firebaseAuth;
            if (!currentAuth || !window.authFunctions) {
                console.warn("[Auth] Auth service not ready or functions not loaded. Cannot process logout.");
                showCustomAlert("Authentication service not ready. Please try again in a moment.");
                return;
            }
            try {
                await window.authFunctions.signOut(currentAuth);
                showCustomAlert("Logged out successfully!", 1500);
                console.log("[Auth] User successfully logged out.");
                toggleAppSidebar(false);
            }
            catch (error) {
                console.error("[Auth] Logout failed:", error);
                showCustomAlert("Logout failed: " + error.message);
            }
        });
    }

    // Watchlist Select Change Listener
    if (watchlistSelect) {
        watchlistSelect.addEventListener('change', async (event) => {
            console.log(`[Watchlist Select] Change event fired. New value: ${event.target.value}`);
            currentSelectedWatchlistIds = [event.target.value];
            await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds);
            await loadShares();
        });
    }

    // Sort Select Change Listener
    if (sortSelect) {
        sortSelect.addEventListener('change', async (event) => {
            console.log(`[Sort Select] Change event fired. New value: ${event.target.value}`);
            currentSortOrder = sortSelect.value;
            sortShares();
            await saveSortOrderPreference(currentSortOrder);
        });
    }

    // New Share Button (from sidebar)
    if (newShareBtn) {
        newShareBtn.addEventListener('click', () => {
            console.log("[UI] New Share button (sidebar) clicked.");
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
            console.log("[UI] Add Share button (header) clicked.");
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
            console.log("[Share Form] Save Share button clicked.");
            // Call the shared save function, not silent
            saveShareData(false);
        });
    }

    // Delete Share Button
    if (deleteShareBtn) {
        deleteShareBtn.addEventListener('click', async () => {
            console.log("[Share Form] Delete Share button clicked (No Confirmation).");
            if (deleteShareBtn.classList.contains('is-disabled-icon')) {
                console.warn("[Delete Share] Delete button was disabled, preventing action.");
                return;
            }
            if (selectedShareDocId) {
                try {
                    const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, selectedShareDocId);
                    await window.firestore.deleteDoc(shareDocRef);
                    showCustomAlert("Share deleted successfully!", 1500);
                    console.log(`[Firestore] Share (ID: ${selectedShareDocId}) deleted.`);
                    closeModals();
                } catch (error) {
                    console.error("[Firestore] Error deleting share:", error);
                    showCustomAlert("Error deleting share: " + error.message);
                }
            } else { showCustomAlert("No share selected for deletion."); }
        });
    }

    // Edit Share From Detail Button
    if (editShareFromDetailBtn) {
        editShareFromDetailBtn.addEventListener('click', () => {
            console.log("[Share Details] Edit Share button clicked.");
            if (editShareFromDetailBtn.classList.contains('is-disabled-icon')) {
                console.warn("[Edit Share From Detail] Edit button was disabled, preventing action.");
                return;
            }
            hideModal(shareDetailModal);
            showEditFormForSelectedShare();
        });
    }

    // Delete Share From Detail Button
    if (deleteShareFromDetailBtn) {
        deleteShareFromDetailBtn.addEventListener('click', async () => {
            console.log("[Share Details] Delete Share button clicked (No Confirmation).");
            if (deleteShareFromDetailBtn.classList.contains('is-disabled-icon')) {
                console.warn("[Delete Share From Detail] Delete button was disabled, preventing action.");
                return;
            }
            if (selectedShareDocId) {
                try {
                    const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, selectedShareDocId);
                    await window.firestore.deleteDoc(shareDocRef);
                    showCustomAlert("Share deleted successfully!", 1500);
                    console.log(`[Firestore] Share (ID: ${selectedShareDocId}) deleted.`);
                    closeModals();
                } catch (error) {
                    console.error("[Firestore] Error deleting share:", error);
                    showCustomAlert("Error deleting share: " + error.message);
                }
            } else { showCustomAlert("No share selected for deletion."); }
        });
    }

    // Context Menu Edit Share Button
    if (contextEditShareBtn) {
        contextEditShareBtn.addEventListener('click', () => {
            console.log("[Context Menu] Edit Share button clicked.");
            if (currentContextMenuShareId) {
                const shareIdToEdit = currentContextMenuShareId;
                hideContextMenu();
                showEditFormForSelectedShare(shareIdToEdit);
            } else {
                console.warn("[Context Menu] No share ID found for editing.");
            }
        });
    }

    // Context Menu Delete Share Button
    if (contextDeleteShareBtn) {
        contextDeleteShareBtn.addEventListener('click', async () => {
            console.log("[Context Menu] Delete Share button clicked (No Confirmation).");
            if (currentContextMenuShareId) {
                const shareToDeleteId = currentContextMenuShareId;
                hideContextMenu();
                try {
                    const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, shareToDeleteId);
                    await window.firestore.deleteDoc(shareDocRef);
                    showCustomAlert("Share deleted successfully!", 1500);
                    console.log(`[Firestore] Share (ID: ${shareToDeleteId}) deleted.`);
                } catch (error) {
                    console.error("[Firestore] Error deleting share:", error);
                    showCustomAlert("Error deleting share: " + error.message);
                }
            } else {
                showCustomAlert("No share selected for deletion from context menu.");
                console.warn("[Context Menu] No share ID found for deletion.");
            }
        });
    }

    // Add Watchlist Button
    if (addWatchlistBtn) {
        addWatchlistBtn.addEventListener('click', () => {
            console.log("[UI] Add Watchlist button clicked.");
            if (newWatchlistNameInput) newWatchlistNameInput.value = '';
            setIconDisabled(saveWatchlistBtn, true); // Disable save button initially
            console.log("[Add Watchlist] saveWatchlistBtn disabled initially.");
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
            console.log("[Watchlist Form] Save Watchlist button clicked.");
            if (saveWatchlistBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert("Please enter a watchlist name.");
                console.warn("[Save Watchlist] Save button was disabled, preventing action.");
                return;
            }
            const watchlistName = newWatchlistNameInput.value.trim();
            await saveWatchlistChanges(false, watchlistName); // false indicates not silent
        });
    }

    // Edit Watchlist Button
    if (editWatchlistBtn) {
        editWatchlistBtn.addEventListener('click', () => {
            console.log("[UI] Edit Watchlist button clicked.");
            let watchlistToEditId = watchlistSelect.value;

            if (!watchlistToEditId || !userWatchlists.some(w => w.id === watchlistToEditId)) {
                showCustomAlert("Please select a watchlist to edit.");
                return;
            }
            const selectedWatchlistObj = userWatchlists.find(w => w.id === watchlistToEditId);
            const watchlistToEditName = selectedWatchlistObj ? selectedWatchlistObj.name : '';

            console.log(`[Edit Watchlist Button Click] Watchlist to edit ID: ${watchlistToEditId}, Name: ${watchlistToEditName}`);

            editWatchlistNameInput.value = watchlistToEditName;
            const isDisabledDelete = userWatchlists.length <= 1;
            setIconDisabled(deleteWatchlistInModalBtn, isDisabledDelete); 
            console.log(`[Edit Watchlist] deleteWatchlistInModalBtn disabled: ${isDisabledDelete}`);
            setIconDisabled(saveWatchlistNameBtn, true); // Disable save button initially
            console.log("[Edit Watchlist] saveWatchlistNameBtn disabled initially.");
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
            console.log("[Manage Watchlist Form] Save Watchlist Name button clicked.");
            if (saveWatchlistNameBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert("Watchlist name cannot be empty or unchanged.");
                console.warn("[Save Watchlist Name] Save button was disabled, preventing action.");
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
            console.log("[Manage Watchlist Form] Delete Watchlist button clicked (No Confirmation).");
            if (deleteWatchlistInModalBtn.classList.contains('is-disabled-icon')) {
                console.warn("[Delete Watchlist In Modal] Delete button was disabled, preventing action.");
                return;
            }

            let watchlistToDeleteId = watchlistSelect.value;

            if (!watchlistToDeleteId || userWatchlists.length <= 1) {
                showCustomAlert("Cannot delete the last watchlist. Please create another watchlist first.");
                return;
            }
            const watchlistToDeleteName = userWatchlists.find(w => w.id === watchlistToDeleteId)?.name || 'Unknown Watchlist';
            
            try {
                const sharesColRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
                const q = window.firestore.query(sharesColRef, window.firestore.where("watchlistId", "==", watchlistToDeleteId));
                const querySnapshot = await window.firestore.getDocs(q);

                const batch = window.firestore.writeBatch(db);
                querySnapshot.forEach(doc => {
                    const shareRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, doc.id);
                    batch.delete(shareRef);
                });
                await batch.commit();
                console.log(`[Firestore] Deleted ${querySnapshot.docs.length} shares from watchlist '${watchlistToDeleteName}'.`);

                const watchlistDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`, watchlistToDeleteId);
                await window.firestore.deleteDoc(watchlistDocRef);
                console.log(`[Firestore] Watchlist '${watchlistToDeleteName}' (ID: ${watchlistToDeleteId}) deleted.`);

                showCustomAlert(`Watchlist '${watchlistToDeleteName}' and its shares deleted successfully!`, 2000);
                closeModals();

                await loadUserWatchlistsAndSettings();
            } catch (error) {
                console.error("[Firestore] Error deleting watchlist:", error);
                showCustomAlert("Error deleting watchlist: " + error.message);
            }
        });
    }

    // Dividend Calculator Button
    if (dividendCalcBtn) {
        dividendCalcBtn.addEventListener('click', () => {
            console.log("[UI] Dividend button clicked. Attempting to open modal.");
            calcDividendAmountInput.value = ''; calcCurrentPriceInput.value = ''; calcFrankingCreditsInput.value = '';
            calcUnfrankedYieldSpan.textContent = '-'; calcFrankedYieldSpan.textContent = '-'; calcEstimatedDividend.textContent = '-';
            investmentValueSelect.value = '10000';
            showModal(dividendCalculatorModal);
            calcCurrentPriceInput.focus(); 
            console.log("[UI] Dividend Calculator modal opened.");
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
        
        calcUnfrankedYieldSpan.textContent = unfrankedYield !== null ? `${unfrankedYield.toFixed(2)}%` : '-';
        calcFrankedYieldSpan.textContent = frankedYield !== null ? `${frankedYield.toFixed(2)}%` : '-';
        calcEstimatedDividend.textContent = estimatedDividend !== null ? `$${estimatedDividend.toFixed(2)}` : '-';
    }

    // Standard Calculator Button
    if (standardCalcBtn) {
        standardCalcBtn.addEventListener('click', () => {
            console.log("[UI] Standard Calculator button clicked.");
            resetCalculator();
            showModal(calculatorModal);
            console.log("[UI] Standard Calculator modal opened.");
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

    // Theme Toggle Button
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            console.log("[Theme Debug] Theme toggle button clicked.");
            console.log(`[Theme Debug] currentActiveTheme before toggle: ${currentActiveTheme}`);
            
            let nextIndex;
            // If currentActiveTheme is a custom theme, find its index
            if (CUSTOM_THEMES.includes(currentActiveTheme)) {
                let currentIndex = CUSTOM_THEMES.indexOf(currentActiveTheme);
                nextIndex = (currentIndex + 1);
            } else {
                // If not a custom theme (system-default, light, dark), start from the first custom theme
                nextIndex = 0;
            }

            let nextThemeName;
            if (nextIndex < CUSTOM_THEMES.length) {
                nextThemeName = CUSTOM_THEMES[nextIndex];
            } else {
                // If we've cycled past the last custom theme, go to system-default
                nextThemeName = 'system-default';
            }
            
            console.log(`[Theme Debug] Calculated nextIndex: ${nextIndex}, nextThemeName: ${nextThemeName}`);
            applyTheme(nextThemeName);
        });
    }

    // Color Theme Select Dropdown
    if (colorThemeSelect) {
        colorThemeSelect.addEventListener('change', (event) => {
            console.log(`[Theme] Color theme select changed to: ${event.target.value}`);
            const selectedTheme = event.target.value;
            applyTheme(selectedTheme);
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
        if (window.innerWidth > 768) {
            scrollToTopBtn.style.display = 'none';
        } else {
            window.dispatchEvent(new Event('scroll'));
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
            event.stopPropagation();
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

        document.addEventListener('click', (event) => {
            const isDesktop = window.innerWidth > 768;
            if (appSidebar.classList.contains('open') && isDesktop &&
                !appSidebar.contains(event.target) && !hamburgerBtn.contains(event.target)) {
                console.log("[Global Click] Clicked outside sidebar on desktop. Closing sidebar.");
                toggleAppSidebar(false);
            }
        });

        window.addEventListener('resize', () => {
            console.log("[Window Resize] Resizing window. Closing sidebar if open.");
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
                console.log(`[Sidebar Menu Item Click] Button '${event.currentTarget.textContent.trim()}' clicked.`);
                const closesMenu = event.currentTarget.dataset.actionClosesMenu !== 'false';
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
            toggleAppSidebar(false);
        });
    }

    // Refresh Live Prices Button Event Listener
    if (refreshLivePricesBtn) {
        refreshLivePricesBtn.addEventListener('click', () => {
            console.log("[UI] Refresh Live Prices button clicked.");
            fetchLivePrices();
            showCustomAlert("Refreshing live prices...", 1000);
            toggleAppSidebar(false); // NEW: Close sidebar on refresh
        });
    }

    // NEW: Target notification bubble click listener (to toggle expansion)
    if (targetNotificationBubble) {
        targetNotificationBubble.addEventListener('click', (event) => {
            // Prevent click from propagating to global window listener immediately
            event.stopPropagation(); 
            // Only toggle expansion if not clicking inside the details pop-up itself
            if (!bubbleDetails.contains(event.target)) {
                toggleBubbleExpansion();
            }
        });
    }

    // NEW: Bubble close button listener
    if (bubbleCloseBtn) {
        bubbleCloseBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from propagating to bubble toggle
            collapseBubble();
        });
    }

    // NEW: Bubble dismiss all button listener
    if (bubbleDismissAllBtn) {
        bubbleDismissAllBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from propagating to bubble toggle
            dismissAllTargetHits();
        });
    }

    // NEW: Bubble share list item click listener (event delegation)
    if (bubbleShareList) {
        bubbleShareList.addEventListener('click', (event) => {
            const listItem = event.target.closest('li');
            if (listItem && listItem.dataset.shareId) {
                const shareId = listItem.dataset.shareId;
                console.log(`[Target Bubble] Clicked share in list: ${listItem.textContent.trim()} (ID: ${shareId})`);
                // Optionally dismiss the specific share, or view its details
                // For now, let's view its details and dismiss it from the bubble
                dismissTargetHit(shareId); // Dismiss from bubble
                collapseBubble(); // Collapse the bubble
                selectShare(shareId); // Select the share in the main list
                showShareDetails(); // Show its details modal
            }
        });
    }


    // Call adjustMainContentPadding initially and on window load/resize
    window.addEventListener('load', adjustMainContentPadding);
    // Already added to window.addEventListener('resize') in sidebar section
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("script.js DOMContentLoaded fired.");

    if (window.firestoreDb && window.firebaseAuth && window.getFirebaseAppId && window.firestore && window.authFunctions) {
        db = window.firestoreDb;
        auth = window.firebaseAuth;
        currentAppId = window.getFirebaseAppId();
        console.log("[Firebase Ready] DB, Auth, and AppId assigned from window. Setting up auth state listener.");
        
        window.authFunctions.onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                updateAuthButtonText(true, user.email || user.displayName);
                console.log("[AuthState] User signed in:", user.uid);
                console.log("[AuthState] User email:", user.email);
                if (user.email && user.email.toLowerCase() === KANGA_EMAIL) {
                    mainTitle.textContent = "Kanga's Share Watchlist";
                    console.log("[AuthState] Main title set to Kanga's Share Watchlist.");
                } else {
                    mainTitle.textContent = "My Share Watchlist";
                    console.log("[AuthState] Main title set to My Share Watchlist.");
                }
                updateMainButtonsState(true);
                await loadUserWatchlistsAndSettings(); // This will now also load dismissedTargetHits
                startLivePriceUpdates();
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
                if (unsubscribeShares) {
                    unsubscribeShares();
                    unsubscribeShares = null;
                    console.log("[Firestore Listener] Unsubscribed from shares listener on logout.");
                }
                stopLivePriceUpdates();
                // Clear dismissed target hits when logged out
                dismissedTargetHits = [];
                updateTargetHitBubble(); // Hide bubble on logout
            }
            if (!window._appLogicInitialized) {
                initializeAppLogic();
                window._appLogicInitialized = true;
            }
            // NEW: Call adjustMainContentPadding here to ensure correct spacing after auth state changes
            adjustMainContentPadding();
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
        // NEW: Call adjustMainContentPadding even if Firebase fails, to ensure some basic layout
        adjustMainContentPadding();
    }
});
