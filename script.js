// File Version: v166
// Last Updated: 2025-07-10 (Fixed critical interaction bugs: hamburger, modal buttons, context menu; completed dynamic comments; fixed watchlist selection modal functionality)

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
let currentSelectedWatchlistIds = []; // Stores IDs of currently selected watchlists for display
const ALL_SHARES_ID = 'all_shares_option'; // Special ID for the "Show All Shares" option
let currentSortOrder = 'entryDate-desc'; // Default sort order, now a global variable
let contextMenuOpen = false; // To track if the custom context menu is open
let currentContextMenuShareId = null; // Stores the ID of the share that opened the context menu
let originalShareData = null; // Stores the original share data when editing for dirty state check

// Live Price Data
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwjuU2ZE1rCe4kiHT7WD-7CALkB0pg-zxkizz0xMIrhKxCBlKEp-YoMiUK85BQ2dHnZ/exec';
let livePrices = {}; // Stores live price data: {ASX_CODE: price}
let livePriceFetchInterval = null; // To hold the interval ID for live price updates
const LIVE_PRICE_FETCH_INTERVAL_MS = 5 * 60 * 1000; // Fetch every 5 minutes

// Theme related variables
const CUSTOM_THEMES = [
    'bold-1', 'bold-2', 'bold-3', 'bold-4', 'bold-5', 'bold-6', 'bold-7', 'bold-8', 'bold-9', 'bold-10',
    'subtle-1', 'subtle-2', 'subtle-3', 'subtle-4', 'subtle-5', 'subtle-6', 'subtle-7', 'subtle-8', 'subtle-9', 'subtle-10'
];
let currentCustomThemeIndex = -1; // To track the current theme in the cycle
let currentActiveTheme = 'system-default'; // Tracks the currently applied theme string (e.g., 'dark', 'bold', 'subtle', 'system-default')
let savedSortOrder = null; // GLOBAL: Stores the sort order loaded from user settings
let savedTheme = null; // GLOBAL: Stores the theme loaded from user settings


let unsubscribeShares = null; // Holds the unsubscribe function for the Firestore shares listener


// --- UI Element References (Declared globally for access by all functions) ---
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
// const cancelFormBtn = document.getElementById('cancelFormBtn'); // This button is removed from HTML
const deleteShareBtn = document.getElementById('deleteShareBtn');
const shareNameInput = document.getElementById('shareName');
const currentPriceInput = document.getElementById('currentPrice');
const targetPriceInput = document.getElementById('targetPrice');
const dividendAmountInput = document.getElementById('dividendAmount');
const frankingCreditsInput = document.getElementById('frankingCredits');
const commentsFormContainer = document.getElementById('commentsFormContainer');
const addCommentSectionBtn = document.getElementById('addCommentSectionBtn'); // Now a span
const shareTableBody = document.querySelector('#shareTable tbody');
const mobileShareCardsContainer = document.getElementById('mobileShareCards');
const loadingIndicator = document.getElementById('loadingIndicator');
const googleAuthBtn = document.getElementById('googleAuthBtn');
const shareDetailModal = document.getElementById('shareDetailModal');
const modalShareName = document.getElementById('modalShareName');
const modalEntryDate = document.getElementById('modalEntryDate');
const modalEnteredPrice = document.getElementById('modalEnteredPrice');
const modalLivePrice = document.getElementById('modalLivePrice'); // NEW
const modalPriceChange = document.getElementById('modalPriceChange'); // NEW
const modalTargetPrice = document.getElementById('modalTargetPrice');
const modalDividendAmount = document.getElementById('modalDividendAmount');
const modalFrankingCredits = document.getElementById('frankingCredits');
const modalCommentsContainer = document.getElementById('modalCommentsContainer');
const modalUnfrankedYieldSpan = document.getElementById('modalUnfrankedYield');
const modalFrankedYieldSpan = document.getElementById('modalFrankedYield');
const editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn'); // Now a span
const deleteShareFromDetailBtn = document.getElementById('deleteShareFromDetailBtn'); // NEW: Delete button in share details modal
const modalNewsLink = document.getElementById('modalNewsLink'); // RE-ADDED: News Link
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
const customDialogConfirmBtn = document.getElementById('customDialogConfirmBtn'); // Now a span
const customDialogCancelBtn = document.getElementById('customDialogCancelBtn'); // Now a span
const calculatorModal = document.getElementById('calculatorModal');
const calculatorInput = document.getElementById('calculatorInput');
const calculatorResult = document.getElementById('calculatorResult');
const calculatorButtons = document.querySelector('.calculator-buttons');
const watchlistSelect = document.getElementById('watchlistSelect'); // Re-added for now as per user's provided index.html
const themeToggleBtn = document.getElementById('themeToggleBtn');
const colorThemeSelect = document.getElementById('colorThemeSelect');
const revertToDefaultThemeBtn = document.getElementById('revertToDefaultThemeBtn');
const scrollToTopBtn = document.getElementById('scrollToTopBtn');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const appSidebar = document.getElementById('appSidebar');
const closeMenuBtn = document.getElementById('closeMenuBtn');
// const selectWatchlistsBtn = document.getElementById('selectWatchlistsBtn'); // New sidebar button - removed as per user's provided index.html
const addWatchlistBtn = document.getElementById('addWatchlistBtn');
const editWatchlistBtn = document.getElementById('editWatchlistBtn');
const addWatchlistModal = document.getElementById('addWatchlistModal');
const newWatchlistNameInput = document.getElementById('newWatchlistName');
const saveWatchlistBtn = document.getElementById('saveWatchlistBtn'); // Now a span
// const cancelAddWatchlistBtn = document.getElementById('cancelAddWatchlistBtn'); // Now a span - removed from HTML
const manageWatchlistModal = document.getElementById('manageWatchlistModal');
const editWatchlistNameInput = document.getElementById('editWatchlistName');
const saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn'); // Now a span
const deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn'); // Now a span
// const cancelManageWatchlistBtn = document.getElementById('cancelManageWatchlistBtn'); // Now a span - removed from HTML
const shareContextMenu = document.getElementById('shareContextMenu');
const contextEditShareBtn = document.getElementById('contextEditShareBtn');
const contextDeleteShareBtn = document.getElementById('contextDeleteShareBtn');
const logoutBtn = document.getElementById('logoutBtn'); // Now a span
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn'); // Export button
const refreshLivePricesBtn = document.getElementById('refreshLivePricesBtn'); // NEW

// New elements for watchlist selection when adding share from "All Shares" view
const selectWatchlistForShareModal = document.getElementById('selectWatchlistForShareModal');
const watchlistSelectionList = document.getElementById('watchlistSelectionList');
const confirmWatchlistSelectionBtn = document.getElementById('confirmWatchlistSelectionBtn');
const cancelWatchlistSelectionBtn = document.getElementById('cancelWatchlistSelectionBtn');


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


// --- GLOBAL HELPER FUNCTIONS (MOVED OUTSIDE DOMContentLoaded for accessibility) ---

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
    // console.log(`[setIconDisabled] Setting ${element.id || element.className} to isDisabled: ${isDisabled}`);
    if (isDisabled) {
        element.classList.add('is-disabled-icon');
    } else {
        element.classList.remove('is-disabled-icon');
    }
}

// Centralized Modal Closing Function
function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
        }
    });
    resetCalculator();
    // Do NOT deselect share here. selectedShareDocId is needed for context menu actions.
    // deselectCurrentShare(); 
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); autoDismissTimeout = null; }
    hideContextMenu();
    console.log("[Modal] All modals closed.");
}

// Custom Dialog (Alert/Confirm) Functions
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

// Confirmation screen removed as per user request
// function showCustomConfirm(message, onConfirm, onCancel = null) { ... }

// Date Formatting Helper Functions (Australian Style)
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-AU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
    });
}

// UI State Management Functions
function updateAuthButtonText(isSignedIn, userName = 'Sign In') {
    if (googleAuthBtn) {
        // If signed in, show user name or "Signed In". If signed out, show "Google Sign In".
        googleAuthBtn.textContent = isSignedIn ? (userName || 'Signed In') : 'Google Sign In';
        console.log(`[Auth UI] Auth button text updated to: ${googleAuthBtn.textContent}`);
    }
}

function updateMainButtonsState(enable) {
    console.log(`[UI State] Setting main buttons state to: ${enable ? 'ENABLED' : 'DISABLED'}`);
    // Sidebar buttons (native buttons, use .disabled)
    if (newShareBtn) newShareBtn.disabled = !enable;
    if (standardCalcBtn) standardCalcBtn.disabled = !enable;
    if (dividendCalcBtn) dividendCalcBtn.disabled = !enable;
    if (exportWatchlistBtn) exportWatchlistBtn.disabled = !enable;
    // if (selectWatchlistsBtn) setIconDisabled(selectWatchlistsBtn, !enable); // New watchlist button - removed as per user's provided index.html
    if (addWatchlistBtn) addWatchlistBtn.disabled = !enable;
    // editWatchlistBtn's disabled state is also dependent on userWatchlists.length, handled in loadUserWatchlistsAndSettings
    if (editWatchlistBtn) editWatchlistBtn.disabled = !enable || userWatchlists.length === 0; 
    if (addShareHeaderBtn) addShareHeaderBtn.disabled = !enable;
    // Logout button is now a span, handle its disabled state with setIconDisabled
    if (logoutBtn) setIconDisabled(logoutBtn, !enable); 
    if (themeToggleBtn) themeToggleBtn.disabled = !enable;
    if (colorThemeSelect) colorThemeSelect.disabled = !enable;
    if (revertToDefaultThemeBtn) revertToDefaultThemeBtn.disabled = !enable;
    if (sortSelect) sortSelect.disabled = !enable; // Ensure sort select is disabled if not enabled
    if (watchlistSelect) watchlistSelect.disabled = !enable; // Ensure watchlist select is disabled if not enabled
    if (refreshLivePricesBtn) refreshLivePricesBtn.disabled = !enable; // NEW: Disable refresh button if not enabled
    console.log(`[UI State] Sort Select Disabled: ${sortSelect ? sortSelect.disabled : 'N/A'}`);
    console.log(`[UI State] Watchlist Select Disabled: ${watchlistSelect ? watchlistSelect.disabled : 'N/A'}`);


    // Note: Modal action icons (e.g., saveShareBtn, deleteShareBtn) are handled separately
    // by setIconDisabled based on their specific conditions (e.g., input validity).
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
    if (watchlistSelect) watchlistSelect.innerHTML = '<option value="" disabled selected>Watchlist</option>';
    userWatchlists = [];
    currentSelectedWatchlistIds = []; // Reset this too
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
    // Ensure only the newly selected row/card has the 'selected' class
    document.querySelectorAll('.share-list-section tr.selected, .mobile-card.selected').forEach(el => {
        el.classList.remove('selected');
    });

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

function truncateText(text, maxLength) {
    if (typeof text !== 'string' || text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}

function addCommentSection(title = '', text = '') {
    if (!commentsFormContainer) { console.error("[addCommentSection] commentsFormContainer not found."); return; }
    const commentSectionDiv = document.createElement('div');
    commentSectionDiv.className = 'comment-section';
    commentSectionDiv.innerHTML = `
        <div class="comment-section-header">
            <input type="text" class="comment-title-input" placeholder="Comment Title" value="${title}">
            <button type="button" class="comment-delete-btn">&times;</button>
        </div>
        <textarea class="comment-text-input" placeholder="Your comments here...">${text}</textarea>
    `;
    commentsFormContainer.appendChild(commentSectionDiv);
    
    // Add event listeners for dirty state check
    const commentTitleInput = commentSectionDiv.querySelector('.comment-title-input');
    const commentTextInput = commentSectionDiv.querySelector('.comment-text-input');
    if (commentTitleInput) commentTitleInput.addEventListener('input', checkFormDirtyState);
    if (commentTextInput) commentTextInput.addEventListener('input', checkFormDirtyState);

    commentSectionDiv.querySelector('.comment-delete-btn').addEventListener('click', (event) => {
        console.log("[Comments] Delete comment button clicked.");
        event.target.closest('.comment-section').remove();
        checkFormDirtyState(); // Check dirty state after deleting a comment
    });
    console.log("[Comments] Added new comment section.");
}

function clearForm() {
    formInputs.forEach(input => {
        if (input) { input.value = ''; }
    });
    if (commentsFormContainer) {
        commentsFormContainer.innerHTML = '';
        // Do not add a default comment section here, user will click "+" to add
        // addCommentSection(); 
    }
    selectedShareDocId = null;
    originalShareData = null; // Reset original data when clearing form for new share
    if (deleteShareBtn) {
        deleteShareBtn.classList.add('hidden'); // Hide delete icon when adding new share
        console.log("[clearForm] deleteShareBtn hidden.");
    }
    // Initially disable save button until share name is entered and form is dirty
    setIconDisabled(saveShareBtn, true);
    console.log("[Form] Form fields cleared and selectedShareDocId reset. saveShareBtn disabled.");
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
    
    if (commentsFormContainer) {
        commentsFormContainer.innerHTML = '';
        if (shareToEdit.comments && Array.isArray(shareToEdit.comments) && shareToEdit.comments.length > 0) {
            shareToEdit.comments.forEach(comment => addCommentSection(comment.title, comment.text));
        } else {
            // Do not add a default comment section here, user will click "+" to add
            // addCommentSection();
        }
    }
    if (deleteShareBtn) {
        deleteShareBtn.classList.remove('hidden'); // Show delete icon when editing
        setIconDisabled(deleteShareBtn, false); // Ensure it's enabled when shown
        console.log("[showEditFormForSelectedShare] deleteShareBtn shown and enabled.");
    }
    
    // Store original data for dirty state check
    originalShareData = getCurrentFormData();
    // Initially disable save button, it will be enabled if form is dirty
    setIconDisabled(saveShareBtn, true); 
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
    if (commentsFormContainer) {
        commentsFormContainer.querySelectorAll('.comment-section').forEach(section => {
            const titleInput = section.querySelector('.comment-title-input');
            const textInput = section.querySelector('.comment-text-input');
            const title = titleInput ? titleInput.value.trim() : '';
            const text = textInput ? textInput.value.trim() : '';
            if (title || text) { // Only add comment if it has content
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
        comments: comments
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
    if (!data1 || !data2) return false; // One is null/undefined, so not equal

    // Compare simple fields
    const fields = ['shareName', 'currentPrice', 'targetPrice', 'dividendAmount', 'frankingCredits'];
    for (const field of fields) {
        let val1 = data1[field];
        let val2 = data2[field];

        // Handle NaN and null/undefined for numeric fields
        if (typeof val1 === 'number' && isNaN(val1)) val1 = null;
        if (typeof val2 === 'number' && isNaN(val2)) val2 = null;

        if (val1 !== val2) {
            // console.log(`[Dirty Check] Field '${field}' differs: '${val1}' vs '${val2}'`);
            return false;
        }
    }

    // Deep compare comments array
    if (data1.comments.length !== data2.comments.length) {
        // console.log("[Dirty Check] Comments length differs.");
        return false;
    }
    for (let i = 0; i < data1.comments.length; i++) {
        const comment1 = data1.comments[i];
        const comment2 = data2.comments[i];
        if (comment1.title !== comment2.title || comment1.text !== comment2.text) {
            // console.log(`[Dirty Check] Comment ${i} differs.`);
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

    if (!isShareNameValid) {
        setIconDisabled(saveShareBtn, true); // Always disable if share name is empty
        // console.log("[Dirty Check] Save button disabled: Share name is empty.");
        return;
    }

    if (selectedShareDocId && originalShareData) {
        // Editing an existing share
        const isDirty = !areShareDataEqual(originalShareData, currentData);
        setIconDisabled(saveShareBtn, !isDirty);
        // console.log(`[Dirty Check] Editing existing share. Is dirty: ${isDirty}. Save button disabled: ${!isDirty}`);
    } else {
        // Adding a new share (only depends on share name validity)
        setIconDisabled(saveShareBtn, !isShareNameValid);
        // console.log(`[Dirty Check] Adding new share. Share name valid: ${isShareNameValid}. Save button disabled: ${!isShareNameValid}`);
    }
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
    modalEntryDate.textContent = formatDate(share.entryDate) || 'N/A';
    
    const enteredPriceNum = Number(share.currentPrice);

    // NEW: Display Live Price and Price Change
    const livePrice = livePrices[share.shareName.toUpperCase()];
    const previousFetchedPrice = Number(share.previousFetchedPrice); // From Firestore
    const lastFetchedPrice = Number(share.lastFetchedPrice); // From Firestore

    if (modalLivePrice) {
        if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) {
            modalLivePrice.textContent = `$${livePrice.toFixed(2)}`;
            modalLivePrice.style.display = 'inline';
        } else {
            modalLivePrice.textContent = 'N/A';
            modalLivePrice.style.display = 'inline'; // Still show N/A
        }
    }

    if (modalPriceChange) {
        modalPriceChange.textContent = ''; // Clear previous content
        modalPriceChange.classList.remove('positive', 'negative', 'neutral');

        // Determine which price to compare against for change
        let comparisonPrice = null;
        if (lastFetchedPrice !== undefined && lastFetchedPrice !== null && !isNaN(lastFetchedPrice)) {
            comparisonPrice = lastFetchedPrice;
        } else if (enteredPriceNum !== undefined && enteredPriceNum !== null && !isNaN(enteredPriceNum)) {
            comparisonPrice = enteredPriceNum;
        }

        if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice) && comparisonPrice !== null) {
            const change = livePrice - comparisonPrice;
            if (change > 0) {
                modalPriceChange.textContent = `(+$${change.toFixed(2)})`;
                modalPriceChange.classList.add('positive');
            } else if (change < 0) {
                modalPriceChange.textContent = `(-$${Math.abs(change).toFixed(2)})`;
                modalPriceChange.classList.add('negative');
            } else {
                modalPriceChange.textContent = `($0.00)`;
                modalPriceChange.classList.add('neutral');
            }
            modalPriceChange.style.display = 'inline';
        } else {
            modalPriceChange.style.display = 'none'; // Hide if no valid comparison
        }
    }

    modalEnteredPrice.textContent = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? `$${enteredPriceNum.toFixed(2)}` : 'N/A'; // MOVED DOWN
    const targetPriceNum = Number(share.targetPrice);
    modalTargetPrice.textContent = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? `$${targetPriceNum.toFixed(2)}` : 'N/A';
    
    const dividendAmountNum = Number(share.dividendAmount);
    modalDividendAmount.textContent = (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? `$${dividendAmountNum.toFixed(3)}` : 'N/A';
    
    const frankingCreditsNum = Number(share.frankingCredits);
    modalFrankingCredits.textContent = (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? `${frankingCreditsNum.toFixed(1)}%` : 'N/A';
    
    // Use livePrice for yield calculation if available, otherwise use enteredPriceNum
    const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;
    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, priceForYield); 
    modalUnfrankedYieldSpan.textContent = unfrankedYield !== null ? `${unfrankedYield.toFixed(2)}%` : 'N/A';
    
    const frankedYield = calculateFrankedYield(dividendAmountNum, priceForYield, frankingCreditsNum);
    modalFrankedYieldSpan.textContent = frankedYield !== null ? `${frankedYield.toFixed(2)}%` : 'N/A';
    
    if (modalCommentsContainer) {
        modalCommentsContainer.innerHTML = '';
        if (share.comments && Array.isArray(share.comments) && share.comments.length > 0) {
            share.comments.forEach(comment => {
                if (comment.title || comment.text) {
                    const commentDiv = document.createElement('div');
                    commentDiv.className = 'modal-comment-item';
                    // Clearly distinguish title and text
                    commentDiv.innerHTML = `
                        <strong style="display: block; margin-bottom: 5px;">${comment.title || 'General Comment'}</strong>
                        <p style="margin: 0;">${comment.text || ''}</p>
                    `;
                    modalCommentsContainer.appendChild(commentDiv);
                }
            });
        } else {
            modalCommentsContainer.innerHTML = '<p style="text-align: center; color: var(--label-color);">No comments for this share.</p>';
        }
    }

    // Google News Link
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

    // Market Index Link
    if (modalMarketIndexLink && share.shareName) {
        const marketIndexUrl = `https://www.marketindex.com.au/asx/${share.shareName.toLowerCase()}`;
        modalMarketIndexLink.href = marketIndexUrl;
        modalMarketIndexLink.textContent = `View ${share.shareName.toUpperCase()} on MarketIndex.com.au`;
        modalMarketIndexLink.style.display = 'inline-flex';
        setIconDisabled(modalMarketIndexLink, false); // Explicitly enable
    } else if (modalMarketIndexLink) {
        modalMarketIndexLink.style.display = 'none';
        setIconDisabled(modalMarketIndexLink, true);
    }

    if (modalFoolLink && share.shareName) {
        const foolUrl = `https://www.fool.com.au/tickers/asx-${share.shareName.toLowerCase()}/`;
        modalFoolLink.href = foolUrl;
        modalFoolLink.textContent = `View ${share.shareName.toUpperCase()} on Fool.com.au`;
        modalFoolLink.style.display = 'inline-flex';
        setIconDisabled(modalFoolLink, false); // Explicitly enable
    } else if (modalFoolLink) {
        modalFoolLink.style.display = 'none';
        setIconDisabled(modalFoolLink, true);
    }

    if (modalCommSecLink && share.shareName) {
        const commSecUrl = `https://www2.commsec.com.au/quotes/summary?stockCode=${share.shareName.toUpperCase()}&exchangeCode=ASX`;
        modalCommSecLink.href = commSecUrl;
        modalCommSecLink.textContent = `View ${share.shareName.toUpperCase()} on CommSec.com.au`;
        modalCommSecLink.style.display = 'inline-flex';
        setIconDisabled(modalCommSecLink, false); // Explicitly enable
    } else if (modalCommSecLink) {
        modalCommSecLink.style.display = 'none';
        setIconDisabled(modalCommSecLink, true);
    }

    if (commSecLoginMessage) {
        commSecLoginMessage.style.display = 'block'; 
    }

    // Ensure editShareFromDetailBtn and deleteShareFromDetailBtn are enabled when showing details
    setIconDisabled(editShareFromDetailBtn, false);
    setIconDisabled(deleteShareFromDetailBtn, false); // NEW: Enable delete button in details modal

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
            if (nameA === '') return order === 'asc' ? 1 : -1;
            if (nameB === '') return order === 'asc' ? -1 : 1;
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
    watchlistSelect.innerHTML = '<option value="" disabled selected>Watchlist</option>'; // Default placeholder

    // Add "All Shares" option first
    const allSharesOption = document.createElement('option');
    allSharesOption.value = ALL_SHARES_ID;
    allSharesOption.textContent = 'All Shares'; // Changed from "Display All Shares"
    watchlistSelect.appendChild(allSharesOption);

    userWatchlists.forEach(watchlist => {
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        watchlistSelect.appendChild(option);
    });

    // Set the selected watchlist based on currentSelectedWatchlistIds
    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        watchlistSelect.value = ALL_SHARES_ID;
    } else if (currentSelectedWatchlistIds.length === 1) {
        watchlistSelect.value = currentSelectedWatchlistIds[0];
    } else if (userWatchlists.length > 0) {
        // Fallback to the first watchlist if no specific selection or "All Shares" is not active
        watchlistSelect.value = userWatchlists[0].id;
        currentSelectedWatchlistIds = [userWatchlists[0].id]; // Ensure internal state matches UI
    } else {
        watchlistSelect.value = ''; // No watchlists available
    }
    console.log("[UI Update] Watchlist select dropdown rendered.");
}

/**
 * Renders the watchlist selection modal when adding a new share from "All Shares" view.
 */
function showWatchlistSelectionModalForNewShare() {
    if (!selectWatchlistForShareModal || !watchlistSelectionList || !confirmWatchlistSelectionBtn || !cancelWatchlistSelectionBtn) {
        showCustomAlert("Error: Watchlist selection modal elements not found.");
        console.error("Watchlist selection modal elements are missing.");
        return;
    }

    watchlistSelectionList.innerHTML = ''; // Clear previous options

    if (userWatchlists.length === 0) {
        watchlistSelectionList.innerHTML = '<p style="text-align: center; color: var(--ghosted-text);">No watchlists found. Please create one first.</p>';
        setIconDisabled(confirmWatchlistSelectionBtn, true); // Disable confirm if no watchlists
        console.warn("[Watchlist Selection] No watchlists available for selection.");
        return;
    } else {
        setIconDisabled(confirmWatchlistSelectionBtn, false); // Enable confirm if watchlists exist
    }

    userWatchlists.forEach(watchlist => {
        const listItem = document.createElement('li');
        listItem.className = 'watchlist-selection-item';
        listItem.dataset.watchlistId = watchlist.id;
        listItem.textContent = watchlist.name;
        watchlistSelectionList.appendChild(listItem);

        // Add click listener for selection
        listItem.addEventListener('click', () => {
            watchlistSelectionList.querySelectorAll('.watchlist-selection-item').forEach(item => {
                item.classList.remove('selected');
            });
            listItem.classList.add('selected');
            confirmWatchlistSelectionBtn.dataset.selectedWatchlistId = watchlist.id; // Store selected ID
            setIconDisabled(confirmWatchlistSelectionBtn, false); // Enable confirm button
            console.log(`[Watchlist Selection] Selected: ${watchlist.name} (${watchlist.id})`);
        });
    });

    // Pre-select the first watchlist if available
    if (userWatchlists.length > 0) {
        watchlistSelectionList.querySelector(`[data-watchlist-id="${userWatchlists[0].id}"]`).classList.add('selected');
        confirmWatchlistSelectionBtn.dataset.selectedWatchlistId = userWatchlists[0].id;
    } else {
        setIconDisabled(confirmWatchlistSelectionBtn, true); // Disable if no watchlists
    }

    showModal(selectWatchlistForShareModal);
    console.log("[Watchlist Selection] Showing watchlist selection modal for new share.");
}

function handleNewShareCreation() {
    // If "All Shares" is selected, open the watchlist selection modal
    if (watchlistSelect.value === ALL_SHARES_ID && userWatchlists.length > 0) { // Corrected condition to use watchlistSelect.value
        showWatchlistSelectionModalForNewShare();
    } else {
        // Otherwise, open the share form directly and assign to the currently selected watchlist
        clearForm();
        formTitle.textContent = 'Add New Share';
        if (deleteShareBtn) { deleteShareBtn.classList.add('hidden'); }
        showModal(shareFormSection);
        shareNameInput.focus();
    }
}


function renderSortSelect() {
    if (!sortSelect) { console.error("[renderSortSelect] sortSelect element not found."); return; }
    sortSelect.innerHTML = '<option value="" disabled selected>Sort by</option>'; // Changed placeholder text to "Sort by"

    const options = [
        { value: "entryDate-desc", text: "Date Added (Newest)" },
        { value: "entryDate-asc", text: "Date Added (Oldest)" },
        { value: "shareName-asc", text: "Code (A-Z)" },
        { value: "shareName-desc", text: "Code (Z-A)" },
        { value: "dividendAmount-desc", text: "Dividend (High-Low)" },
        { value: "dividendAmount-asc", text: "Dividend (Low-High)" }
    ];
    options.forEach(opt => {
        const optionElement = document.createElement('option');
        optionElement.value = opt.value;
        optionElement.textContent = opt.text;
        sortSelect.appendChild(optionElement);
    });

    // Use the global currentSortOrder, which should have been set by loadUserWatchlistsAndSettings
    if (currentUserId && savedSortOrder && Array.from(sortSelect.options).some(option => option.value === savedSortOrder)) {
        sortSelect.value = savedSortOrder; // Set the select element's value
        currentSortOrder = savedSortOrder; // Update the global variable
        console.log(`[Sort] Applied saved sort order: ${currentSortOrder}`);
    } else {
        sortSelect.value = ''; 
        currentSortOrder = ''; // Ensure global variable is reset if no valid option
        console.log("[UI Update] Sort select rendered. Sort select disabled: ", sortSelect.disabled);
    }
    // Removed the recursive call to renderSortSelect() here
    console.log("[UI Update] Sort select rendered. Sort select disabled: ", sortSelect.disabled);
}

function addShareToTable(share) {
    if (!shareTableBody) { console.error("[addShareToTable] shareTableBody element not found."); return; }
    const row = shareTableBody.insertRow();
    row.dataset.docId = share.id;
    
    // Double click / Tap for details
    let lastClickTime = 0;
    row.addEventListener('click', (event) => { 
        console.log(`[Table Row Click] Share ID: ${share.id}`);
        // Only select if not a right-click/long-press initiating the context menu
        if (!contextMenuOpen) {
            const currentTime = new Date().getTime();
            const clickDelay = 300; // milliseconds for double click detection
            if (currentTime - lastClickTime < clickDelay) {
                // Double click detected
                console.log(`[Table Row Double Click] Share ID: ${share.id}`);
                selectShare(share.id); 
                showShareDetails();
            } else {
                selectShare(share.id); // Also select on single click
            }
            lastClickTime = currentTime;
        }
    });

    // Right click for context menu
    row.addEventListener('contextmenu', (event) => {
        console.log(`[Table Row ContextMenu] Share ID: ${share.id}`);
        event.preventDefault();
        selectShare(share.id); // Ensure share is selected before showing context menu
        showContextMenu(event, share.id);
    });

    // Touch events for long press (mobile context menu)
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

    // NEW: Live Price Cell (moved up)
    const livePriceCell = row.insertCell();
    const livePrice = livePrices[share.shareName.toUpperCase()];
    const previousFetchedPrice = Number(share.previousFetchedPrice); // From Firestore
    const lastFetchedPrice = Number(share.lastFetchedPrice); // From Firestore

    if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) {
        livePriceCell.textContent = `$${livePrice.toFixed(2)}`;
        livePriceCell.classList.add('live-price-cell'); // Add class for styling
        
        // Determine price change relative to last fetched price or entered price if no last fetched
        let comparisonPrice = null;
        if (lastFetchedPrice !== undefined && lastFetchedPrice !== null && !isNaN(lastFetchedPrice)) {
            comparisonPrice = lastFetchedPrice;
        } else if (Number(share.currentPrice) !== undefined && Number(share.currentPrice) !== null && !isNaN(Number(share.currentPrice))) {
            comparisonPrice = Number(share.currentPrice);
        }

        if (comparisonPrice !== null) {
            const change = livePrice - comparisonPrice;
            const priceChangeSpan = document.createElement('span');
            priceChangeSpan.classList.add('price-change');
            if (change > 0) {
                priceChangeSpan.textContent = `(+$${change.toFixed(2)})`;
                priceChangeSpan.classList.add('positive');
            } else if (change < 0) {
                priceChangeSpan.textContent = `(-$${Math.abs(change).toFixed(2)})`;
                priceChangeSpan.classList.add('negative');
            } else {
                priceChangeSpan.textContent = `($0.00)`;
                priceChangeSpan.classList.add('neutral');
            }
            livePriceCell.appendChild(priceChangeSpan);
        }
    } else {
        livePriceCell.textContent = 'N/A';
    }

    const enteredPriceCell = row.insertCell(); // MOVED DOWN
    const enteredPriceNum = Number(share.currentPrice);
    const displayEnteredPrice = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? `$${enteredPriceNum.toFixed(2)}` : '-';
    enteredPriceCell.textContent = displayEnteredPrice;


    const targetPriceNum = Number(share.targetPrice);
    const displayTargetPrice = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? `$${targetPriceNum.toFixed(2)}` : '-';
    row.insertCell().textContent = displayTargetPrice;

    const dividendCell = row.insertCell();
    const dividendAmountNum = Number(share.dividendAmount);
    const frankingCreditsNum = Number(share.frankingCredits);
    // Use livePrice for yield calculation if available, otherwise use enteredPriceNum
    const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;

    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, priceForYield); 
    const frankedYield = calculateFrankedYield(dividendAmountNum, priceForYield, frankingCreditsNum);
    const divAmountDisplay = (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? `$${dividendAmountNum.toFixed(2)}` : '-';

    dividendCell.innerHTML = `
        <div class="dividend-yield-cell-content">
            <span>Dividend:</span> <span class="value">${divAmountDisplay}</span>
        </div>
        <div class="dividend-yield-cell-content">
            <span>Unfranked Yield:</span> <span class="value">${unfrankedYield !== null ? unfrankedYield.toFixed(2) + '%' : '-'}</span>
        </div>
        <div class="dividend-yield-cell-content">
            <span>Franked Yield:</span> <span class="value">${frankedYield !== null ? frankedYield.toFixed(2) + '%' : '-'}</span>
        </div>
    `;

    const commentsCell = row.insertCell();
    // Comments section removed from main watchlist/cards
    commentsCell.textContent = ''; 
    commentsCell.style.display = 'none'; // Ensure the cell is hidden
    console.log(`[Render] Added share ${displayShareName} to table.`);
}

function addShareToMobileCards(share) {
    if (!mobileShareCardsContainer) { console.error("[addShareToMobileCards] mobileShareCardsContainer element not found."); return; }
    if (!window.matchMedia("(max-width: 768px)").matches) { return; }

    const card = document.createElement('div');
    card.className = 'mobile-card';
    card.dataset.docId = share.id;

    const enteredPriceNum = Number(share.currentPrice);
    const dividendAmountNum = Number(share.dividendAmount);
    const frankingCreditsNum = Number(share.frankingCredits);
    const targetPriceNum = Number(share.targetPrice);
    
    // Use livePrice for yield calculation if available, otherwise use enteredPriceNum
    const livePrice = livePrices[share.shareName.toUpperCase()];
    const previousFetchedPrice = Number(share.previousFetchedPrice); // From Firestore
    const lastFetchedPrice = Number(share.lastFetchedPrice); // From Firestore

    const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;

    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, priceForYield);
    const frankedYield = calculateFrankedYield(dividendAmountNum, priceForYield, frankingCreditsNum);

    // Comments section removed from main watchlist/cards
    // let commentsSummary = '-';
    // if (share.comments && Array.isArray(share.comments) && share.comments.length > 0 && share.comments[0].text) {
    //     commentsSummary = truncateText(share.comments[0].text, 70);
    // }

    const displayTargetPrice = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? targetPriceNum.toFixed(2) : '-';
    const displayDividendAmount = (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? dividendAmountNum.toFixed(2) : '-';
    const displayFrankingCredits = (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? `${frankingCreditsNum}%` : '-';
    const displayShareName = (share.shareName && String(share.shareName).trim() !== '') ? share.shareName : '(No Code)';
    const displayEnteredPrice = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? enteredPriceNum.toFixed(2) : '-';

    let livePriceHtml = '';
    if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) {
        livePriceHtml = `<p><strong>Live Price:</strong> $${livePrice.toFixed(2)}`;
        
        let comparisonPrice = null;
        if (lastFetchedPrice !== undefined && lastFetchedPrice !== null && !isNaN(lastFetchedPrice)) {
            comparisonPrice = lastFetchedPrice;
        } else if (enteredPriceNum !== undefined && enteredPriceNum !== null && !isNaN(enteredPriceNum)) {
            comparisonPrice = enteredPriceNum;
        }

        if (comparisonPrice !== null) {
            const change = livePrice - comparisonPrice;
            if (change > 0) {
                livePriceHtml += ` <span class="price-change positive">(+$${change.toFixed(2)})</span></p>`;
            } else if (change < 0) {
                livePriceHtml += ` <span class="price-change negative">(-$${Math.abs(change).toFixed(2)})`;
            } else {
                livePriceHtml += ` <span class="price-change neutral">($0.00)`;
            }
            livePriceHtml += `</span></p>`; // Close the span and p tag
        } else {
            livePriceHtml = `<p><strong>Live Price:</strong> N/A</p>`;
        }
    } else {
        livePriceHtml = `<p><strong>Live Price:</strong> N/A</p>`;
    }


    card.innerHTML = `
        <h3>${displayShareName}</h3>
        <p><strong>Entry Date:</strong> ${formatDate(share.entryDate) || '-'}</p>
        ${livePriceHtml} <!-- NEW -->
        <p><strong>Entered Price:</strong> $${displayEnteredPrice}</p> <!-- MOVED DOWN -->
        <p><strong>Target:</strong> $${displayTargetPrice}</p>
        <p><strong>Dividend:</strong> $${displayDividendAmount}</p>
        <p><strong>Franking:</strong> ${displayFrankingCredits}</p>
        <p><strong>Unfranked Yield:</strong> ${unfrankedYield !== null ? unfrankedYield.toFixed(2) + '%' : '-'}</p>
        <p><strong>Franked Yield:</strong> ${frankedYield !== null ? frankedYield.toFixed(2) + '%' : '-'}</p>
    `;
    mobileShareCardsContainer.appendChild(card);

    let lastClickTime = 0;
    card.addEventListener('click', function(e) {
        console.log(`[Mobile Card Click] Share ID: ${share.id}`);
        // Only select if not a right-click/long-press initiating the context menu
        if (!contextMenuOpen) {
            const currentTime = new Date().getTime();
            const clickDelay = 300; // milliseconds for double click detection
            if (currentTime - lastClickTime < clickDelay) {
                // Double click detected
                console.log(`[Mobile Card Double Click] Share ID: ${share.id}`);
                const docId = e.currentTarget.dataset.docId;
                selectShare(docId);
                showShareDetails();
            } else {
                selectShare(docId); // Also select on single click
            }
            lastClickTime = currentTime;
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
        sharesToRender = [...allSharesData]; // Render all shares
        mainTitle.textContent = "All My Shares";
        console.log("[Render] Displaying all shares (from ALL_SHARES_ID in currentSelectedWatchlistIds).");
    } else if (currentSelectedWatchlistIds.length === 0 && userWatchlists.length > 0) {
        // This case handles initial load where no preference is saved, or after logout/login where no specific WL is set.
        // Default to the first watchlist.
        currentSelectedWatchlistIds = [userWatchlists[0].id];
        sharesToRender = allSharesData.filter(share => currentSelectedWatchlistIds.includes(share.watchlistId));
        mainTitle.textContent = userWatchlists[0].name;
        console.log("[Render] No specific watchlists selected, defaulting to first watchlist.");
    } else if (currentSelectedWatchlistIds.length > 0) {
        sharesToRender = allSharesData.filter(share => currentSelectedWatchlistIds.includes(share.watchlistId));
        // Update mainTitle based on selected watchlists
        const selectedNames = currentSelectedWatchlistIds.map(id => {
            const wl = userWatchlists.find(w => w.id === id);
            return wl ? wl.name : 'Unknown Watchlist';
        });
        if (selectedNames.length === 1) {
            mainTitle.textContent = selectedNames[0];
        } else if (selectedNames.length > 1) {
            mainTitle.textContent = "Multiple Watchlists Selected";
        } else {
            mainTitle.textContent = "No Watchlists Selected"; // Should ideally not happen if logic is correct
        }
        console.log(`[Render] Displaying shares from watchlists: ${selectedNames.join(', ')}`);
    } else {
        // Fallback if no watchlists exist at all (e.g., brand new user with no default created yet)
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
        td.colSpan = 5; // Span all columns (Code, Live Price, Entered Price, Target, Dividends) - Comments column removed
        td.appendChild(emptyWatchlistMessage);
        const tr = document.createElement('tr');
        tr.appendChild(td);
        shareTableBody.appendChild(tr); // For table
        mobileShareCardsContainer.appendChild(emptyWatchlistMessage.cloneNode(true)); // For mobile cards
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
}

function renderAsxCodeButtons() {
    if (!asxCodeButtonsContainer) { console.error("[renderAsxCodeButtons] asxCodeButtonsContainer element not found."); return; }
    asxCodeButtonsContainer.innerHTML = ''; // Clear existing buttons
    const uniqueAsxCodes = new Set();
    
    let sharesForButtons = [];
    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) { 
        sharesForButtons = [...allSharesData]; // Use all shares if "All Shares" is active
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
        return;
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
            console.log(`[ASX Button Click] Button for ${asxCode} clicked.`); // Log to confirm click
            const clickedCode = event.target.dataset.asxCode;
            scrollToShare(clickedCode);
        });
    });
    console.log(`[UI] Rendered ${sortedAsxCodes.length} code buttons.`);
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
            elementToScrollTo.scrollIntoView({ behavior: 'smooth', block: 'center' });
            console.log(`[UI] Scrolled to element for share ID: ${targetShare.id}`);
        } else {
            showCustomAlert(`Share '${asxCode}' not found.`);
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
    else if (currentCalculatorInput !== '') { calculatorResult.textContent = currentCalculatorInput; }
    else if (previousCalculatorInput !== '' && operator) { calculatorResult.textContent = previousCalculatorInput; }
    else { calculatorResult.textContent = '0'; }
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
    body.className = body.className.split(' ').filter(c => !c.endsWith('-theme') && !c.startsWith('theme-')).join(' ');

    currentActiveTheme = themeName;

    if (themeName === 'system-default') {
        body.removeAttribute('data-theme');
        localStorage.removeItem('selectedTheme');
        localStorage.removeItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
            body.classList.add('dark-theme');
        }
        console.log("[Theme] Reverted to system default theme.");
        currentCustomThemeIndex = -1;
    } else if (themeName === 'light' || themeName === 'dark') {
        body.removeAttribute('data-theme');
        localStorage.removeItem('selectedTheme');
        localStorage.setItem('theme', themeName);
        if (themeName === 'dark') {
            body.classList.add('dark-theme');
        }
        console.log(`[Theme] Applied explicit default theme: ${themeName}`);
        currentCustomThemeIndex = -1;
    } else {
        body.classList.add('theme-' + themeName);
        body.setAttribute('data-theme', themeName);
        localStorage.setItem('selectedTheme', themeName);
        localStorage.removeItem('theme');
        console.log(`[Theme] Applied custom theme: ${themeName}`);
        currentCustomThemeIndex = CUSTOM_THEMES.indexOf(themeName);
    }
    
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
        if (currentActiveTheme.startsWith('bold-') || currentActiveTheme.startsWith('subtle-')) {
            colorThemeSelect.value = currentActiveTheme;
        } else {
            colorThemeSelect.value = 'none';
        }
        console.log(`[Theme UI] Color theme select updated to: ${colorThemeSelect.value}`);
    }

    if (currentActiveTheme.startsWith('bold-') || currentActiveTheme.startsWith('subtle-')) {
        currentCustomThemeIndex = CUSTOM_THEMES.indexOf(currentActiveTheme);
    } else {
        currentCustomThemeIndex = -1;
    }
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
        // Assign to global variables
        savedSortOrder = null; // Reset before assigning
        savedTheme = null; // Reset before assigning

        if (userProfileSnap.exists()) {
            savedSortOrder = userProfileSnap.data().lastSortOrder;
            savedTheme = userProfileSnap.data().lastTheme;
            currentSelectedWatchlistIds = userProfileSnap.data().lastSelectedWatchlistIds; // Keep this local to the if block, then filter
            console.log(`[User Settings] Found last selected watchlists in profile: ${currentSelectedWatchlistIds}`);
            console.log(`[User Settings] Found saved sort order in profile: ${savedSortOrder}`);
            console.log(`[User Settings] Found saved theme in profile: ${savedTheme}`);
        }

        // Set currentSelectedWatchlistIds based on saved preferences or default
        if (currentSelectedWatchlistIds && Array.isArray(currentSelectedWatchlistIds) && currentSelectedWatchlistIds.length > 0) {
            // Filter out any IDs that no longer exist in userWatchlists (except ALL_SHARES_ID)
            currentSelectedWatchlistIds = currentSelectedWatchlistIds.filter(id => 
                id === ALL_SHARES_ID || userWatchlists.some(wl => wl.id === id)
            );
            // If "All Shares" was selected, ensure it's still valid (i.e., there are watchlists)
            if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID) && userWatchlists.length === 0) {
                 currentSelectedWatchlistIds = []; // Cannot show all if there are none
            }
            if (currentSelectedWatchlistIds.length === 0) { // If after filtering, nothing is selected
                currentSelectedWatchlistIds = [userWatchlists[0].id]; // Default to the first watchlist
                console.warn("[User Settings] Saved watchlist IDs were invalid or empty, defaulting to first watchlist.");
            }
        } else {
            // Default to the first watchlist if no saved preference
            currentSelectedWatchlistIds = [userWatchlists[0].id];
            console.log("[User Settings] No saved watchlist preference, defaulting to first watchlist.");
        }

        renderWatchlistSelect(); // Re-render the watchlist select dropdown
        
        // Use the global savedSortOrder here
        if (currentUserId && savedSortOrder && Array.from(sortSelect.options).some(option => option.value === savedSortOrder)) {
            sortSelect.value = savedSortOrder; // Set the select element's value
            currentSortOrder = savedSortOrder; // Update the global variable
            console.log(`[Sort] Applied saved sort order: ${currentSortOrder}`);
        } else {
            sortSelect.value = ''; 
            currentSortOrder = ''; // Ensure global variable is reset if no valid option
            console.log("[UI Update] Sort select rendered. Sort select disabled: ", sortSelect.disabled);
        }
        renderSortSelect(); // Re-render to ensure placeholder is correctly shown if no saved sort order
        
        // Use the global savedTheme here
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
            await loadShares(); // Now sets up onSnapshot listener
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
            // Find the key that is not 'Price', 'PreviousClose', '52 High', '52 Low'
            const asxCodeKey = Object.keys(item).find(key => 
                key !== 'Price' && key !== 'PreviousClose' && key !== '52 High' && key !== '52 Low'
            );
            if (asxCodeKey && item[asxCodeKey] && item['Price'] !== undefined) {
                const asxCode = String(item[asxCodeKey]).toUpperCase();
                const price = parseFloat(item['Price']);
                if (!isNaN(price)) {
                    newLivePrices[asxCode] = price;
                } else {
                    console.warn(`[Live Price] Invalid price for ${asxCode}: ${item['Price']}`);
                }
            } else {
                console.warn("[Live Price] Skipping item due to missing ASX code key or price:", item);
            }
        });
        livePrices = newLivePrices;
        console.log("[Live Price] Live prices updated:", livePrices);
        // After fetching new prices, re-render the watchlist to update displayed prices
        renderWatchlist(); 
    } catch (error) {
        console.error("[Live Price] Error fetching live prices:", error);
        // Optionally show a non-dismissing alert for persistent errors:
        // showCustomAlert("Error fetching live prices: " + error.message, 5000); 
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
    // Fetch immediately on start
    fetchLivePrices(); 
    // Then set up interval
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
 * Sets up a real-time Firestore listener for shares based on currentSelectedWatchlistIds.
 * Updates `allSharesData` and re-renders the UI whenever changes occur.
 */
async function loadShares() {
    // Unsubscribe from any previous listener to avoid multiple listeners
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

        // Determine the effective watchlist ID based on current selection
        let effectiveWatchlistId = null;
        if (watchlistSelect && watchlistSelect.value && watchlistSelect.value !== "") {
            effectiveWatchlistId = watchlistSelect.value;
        } else if (currentSelectedWatchlistIds.length > 0 && currentSelectedWatchlistIds[0] !== ALL_SHARES_ID) {
            effectiveWatchlistId = currentSelectedWatchlistIds[0];
        } else if (userWatchlists.length > 0) {
            effectiveWatchlistId = userWatchlists[0].id; // Fallback to first watchlist if nothing explicitly selected
        }

        if (effectiveWatchlistId === ALL_SHARES_ID) {
            // If "All Shares" is selected, fetch all shares.
            q = window.firestore.query(sharesCol);
            console.log(`[Shares] Setting up real-time listener for ALL shares for user: ${currentUserId}`);
        } else if (effectiveWatchlistId) {
            // Fetch shares for the currently selected/effective single watchlist.
            q = window.firestore.query(sharesCol, window.firestore.where("watchlistId", "==", effectiveWatchlistId));
            console.log(`[Shares] Setting up real-time listener for shares in watchlist: ${effectiveWatchlistId}`);
        } else {
            // If no watchlist is effective (e.g., no watchlists exist at all), query for nothing.
            // This will result in an in an empty snapshot, correctly reflecting no shares to display.
            q = window.firestore.query(sharesCol, window.firestore.where("watchlistId", "==", "NO_WATCHLIST_ID_EXISTS")); // Query for a non-existent ID
            console.warn("[Shares] No effective watchlist selected or available. Querying for non-existent ID to get empty results.");
        }
        
        // Set up the real-time listener
        unsubscribeShares = window.firestore.onSnapshot(q, (querySnapshot) => {
            console.log("[Firestore Listener] Shares snapshot received. Processing changes.");
            let fetchedShares = [];
            querySnapshot.forEach((doc) => {
                const share = { id: doc.id, ...doc.data() };
                fetchedShares.push(share);
            });

            // No client-side filtering needed here if the query itself is already filtered by watchlistId.
            // If effectiveWatchlistId is ALL_SHARES_ID, then q already fetches all.
            allSharesData = fetchedShares;
            console.log(`[Shares] Shares data updated from snapshot. Total shares: ${allSharesData.length}`);
            
            // Re-sort and re-render UI after data update
            sortShares(); // This will call renderWatchlist() internally
            renderAsxCodeButtons(); // Crucial: Re-render ASX buttons based on updated allSharesData
            
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
        // Use getDocs for one-time fetch for migration, not onSnapshot
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
            await loadShares(); // Set up the onSnapshot listener after migration
            anyMigrationPerformed = true;
        } else {
            console.log("[Migration] No old shares found requiring migration or schema update.");
        }
        return anyMigrationPerformed;
    } catch (error) {
        console.error("[Migration] Error during migration/schema update:", error);
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

    // Adjust x position to prevent overflow
    if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10; // 10px padding from right edge
    }
    // Adjust y position to prevent overflow
    if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10; // 10px padding from bottom edge
    }
    // Ensure it doesn't go off screen to the left/top
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
        // Do NOT deselect share here, as the user might click edit/delete from context menu,
        // and we need selectedShareDocId to be set for those actions.
        // deselectCurrentShare(); 
        console.log("[Context Menu] Hidden.");
    }
}

function toggleAppSidebar(forceState = null) {
    console.log(`[Sidebar] toggleAppSidebar called. Current open state: ${appSidebar.classList.contains('open')}, Force state: ${forceState}`);
    const isDesktop = window.innerWidth > 768;
    const isOpen = appSidebar.classList.contains('open');

    if (forceState === true || (forceState === null && !isOpen)) {
        // Open sidebar
        appSidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
        if (isDesktop) {
            document.body.classList.add('sidebar-active');
            sidebarOverlay.style.pointerEvents = 'none'; // Clicks pass through overlay on desktop
            console.log("[Sidebar] Desktop: Sidebar opened, body shifted, overlay pointer-events: none.");
        } else {
            document.body.classList.remove('sidebar-active'); // Ensure body doesn't shift on mobile
            sidebarOverlay.style.pointerEvents = 'auto'; // Clicks close overlay on mobile
            console.log("[Sidebar] Mobile: Sidebar opened, body NOT shifted, overlay pointer-events: auto.");
        }
        console.log("[Sidebar] Sidebar opened.");
    } else if (forceState === false || (forceState === null && isOpen)) {
        // Close sidebar
        appSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
        document.body.classList.remove('sidebar-active'); // Remove class that shifts main content
        sidebarOverlay.style.pointerEvents = 'none'; // Reset pointer events
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
    // If the string contains a comma, double quote, or newline, enclose it in double quotes.
    // Also, escape any double quotes within the string by doubling them.
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
        stringValue = stringValue.replace(/"/g, '""'); // Escape internal double quotes
        return `"${stringValue}"`; // Enclose in double quotes
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

    // In this version, currentSelectedWatchlistIds will usually have one ID
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
        // Fallback for unexpected multiple selections or no selection
        sharesToExport = [...allSharesData];
        exportFileNamePrefix = "all_shares"; // Default to all shares if selection is ambiguous
    }

    if (sharesToExport.length === 0) {
        showCustomAlert("No shares in the current selection to export.", 2000);
        return;
    }

    const headers = [
        "Code", "Entered Price", "Live Price", "Price Change", "Target Price", "Dividend Amount", "Franking Credits (%)",
        "Unfranked Yield (%)", "Franked Yield (%)", "Entry Date", "Comments"
    ];

    const csvRows = [];
    csvRows.push(headers.map(escapeCsvValue).join(',')); // Add headers

    sharesToExport.forEach(share => {
        const enteredPriceNum = Number(share.currentPrice);
        const dividendAmountNum = Number(share.dividendAmount);
        const frankingCreditsNum = Number(share.frankingCredits);
        const targetPriceNum = Number(share.targetPrice);

        const livePrice = livePrices[share.shareName.toUpperCase()];
        const previousFetchedPrice = Number(share.previousFetchedPrice);
        const lastFetchedPrice = Number(share.lastFetchedPrice);

        let priceChange = '';
        if (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) {
            let comparisonPrice = null;
            if (lastFetchedPrice !== undefined && lastFetchedPrice !== null && !isNaN(lastFetchedPrice)) {
                comparisonPrice = lastFetchedPrice;
            } else if (enteredPriceNum !== undefined && enteredPriceNum !== null && !isNaN(enteredPriceNum)) {
                comparisonPrice = enteredPriceNum;
            }

            if (comparisonPrice !== null) {
                const change = livePrice - comparisonPrice;
                priceChange = change.toFixed(2);
            }
        }

        // Use livePrice for yield calculation if available, otherwise use enteredPriceNum
        const priceForYield = (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice : enteredPriceNum;

        const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, priceForYield);
        const frankedYield = calculateFrankedYield(dividendAmountNum, priceForYield, frankingCreditsNum);

        let allCommentsText = '';
        if (share.comments && Array.isArray(share.comments)) {
            allCommentsText = share.comments.map(c => {
                let commentPart = '';
                if (c.title) commentPart += `${c.title}: `;
                if (c.text) commentPart += c.text;
                return commentPart;
            }).filter(Boolean).join('; '); // Join multiple comments with a semicolon and space
        }

        const row = [
            share.shareName || '',
            (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? enteredPriceNum.toFixed(2) : '',
            (livePrice !== undefined && livePrice !== null && !isNaN(livePrice)) ? livePrice.toFixed(2) : '', // Live Price
            priceChange, // Price Change
            (!isNaN(targetPriceNum) && targetPriceNum !== null) ? targetPriceNum.toFixed(2) : '',
            (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? dividendAmountNum.toFixed(3) : '',
            (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? frankingCreditsNum.toFixed(1) : '',
            unfrankedYield !== null ? unfrankedYield.toFixed(2) : '',
            frankedYield !== null ? frankedYield.toFixed(2) + '%' : '',
            formatDate(share.entryDate) || '',
            allCommentsText
        ];
        csvRows.push(row.map(escapeCsvValue).join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Create a filename based on the watchlist name and current date
    const formattedDate = new Date().toISOString().slice(0, 10); //YYYY-MM-DD
    const safeFileNamePrefix = exportFileNamePrefix.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${safeFileNamePrefix}_watchlist_${formattedDate}.csv`;
    
    link.href = URL.createObjectURL(blob);
    link.style.display = 'none'; // Hide the link
    document.body.appendChild(link); // Append to body
    link.click(); // Trigger download
    document.body.removeChild(link); // Clean up
    URL.revokeObjectURL(link.href); // Release object URL
    
    showCustomAlert(`Exported shares to CSV!`, 2000);
    console.log(`[Export] Shares exported to CSV with prefix: '${exportFileNamePrefix}'.`);
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
    if (selectWatchlistForShareModal) selectWatchlistForShareModal.style.setProperty('display', 'none', 'important'); // NEW: Hide watchlist selection modal


    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js', { scope: './' }) 
                .then(registration => {
                    console.log('Service Worker (v47) from script.js: Registered with scope:', registration.scope); 
                })
                .catch(error => {
                    console.error('Service Worker (v47) from script.js: Registration failed:', error);
                });
        });
    }

    // Share Name Input to uppercase
    if (shareNameInput) {
        shareNameInput.addEventListener('input', function() { 
            this.value = this.value.toUpperCase(); 
            checkFormDirtyState(); // Check dirty state on input
        });
    }

    // Add event listeners to all form inputs for dirty state checking
    formInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', checkFormDirtyState);
            input.addEventListener('change', checkFormDirtyState); // For number inputs, etc.
            // NEW: Clear input on focus (select all text)
            input.addEventListener('focus', function() {
                this.select(); // Selects all text in the input
            });
        }
    });


    // Form input navigation with Enter key
    formInputs.forEach((input, index) => {
        if (input) {
            input.addEventListener('keydown', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    if (index === formInputs.length - 1) {
                        // Check for 'is-disabled-icon' class instead of 'disabled' attribute
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
        // Ensure addCommentSectionBtn is never disabled by default
        setIconDisabled(addCommentSectionBtn, false);
        addCommentSectionBtn.addEventListener('click', () => {
            addCommentSection();
            checkFormDirtyState(); // Check dirty state after adding a comment section
        });
    }

    // Close buttons for modals
    document.querySelectorAll('.close-button').forEach(button => { button.addEventListener('click', closeModals); });

    // Global click listener to close modals/context menu if clicked outside
    window.addEventListener('click', (event) => {
        if (event.target === shareDetailModal || event.target === dividendCalculatorModal ||
            event.target === shareFormSection || event.target === customDialogModal ||
            event.target === calculatorModal || event.target === addWatchlistModal ||
            event.target === manageWatchlistModal || event.target === selectWatchlistForShareModal) { // NEW: Added selectWatchlistForShareModal
            closeModals();
        }

        // Only hide context menu if the click is not inside the context menu itself,
        // and not on a selected share row/card (which might be opening the menu).
        if (contextMenuOpen && shareContextMenu && !shareContextMenu.contains(event.target)) {
            // Check if the click was on a share element that might have just opened the menu
            const isShareElement = event.target.closest('.share-list-section tr, .mobile-card');
            if (!isShareElement || isShareElement.dataset.docId !== currentContextMenuShareId) {
                hideContextMenu();
            }
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
                    console.error("[Auth] Google Sign-In failed:", error); // Log full error object
                    showCustomAlert("Google Sign-In failed: " + error.message);
                }
            }
        });
    }

    // Logout Button (No confirmation as per user request)
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
            } catch (error) {
                console.error("[Auth] Logout failed:", error);
                showCustomAlert("Logout failed: " + error.message);
            }
        });
    }

    // Watchlist Select Change Listener
    if (watchlistSelect) {
        watchlistSelect.addEventListener('change', async (event) => {
            console.log(`[Watchlist Select] Change event fired. New value: ${event.target.value}`);
            currentSelectedWatchlistIds = [event.target.value]; // Update to single selection
            await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds);
            await loadShares(); // Trigger load shares with new selection
        });
    }

    // Sort Select Change Listener
    if (sortSelect) {
        sortSelect.addEventListener('change', async (event) => {
            console.log(`[Sort Select] Change event fired. New value: ${event.target.value}`);
            currentSortOrder = sortSelect.value;
            sortShares(); // This will call renderWatchlist()
            await saveSortOrderPreference(currentSortOrder);
        });
    }

    // New Share Button (from sidebar)
    if (newShareBtn) {
        newShareBtn.addEventListener('click', () => {
            console.log("[UI] New Share button (sidebar) clicked.");
            handleNewShareCreation(); // Call the new handler
            toggleAppSidebar(false); 
        });
    }

    // Add Share Header Button (from header)
    if (addShareHeaderBtn) {
        addShareHeaderBtn.addEventListener('click', () => {
            console.log("[UI] Add Share button (header) clicked.");
            handleNewShareCreation(); // Call the new handler
        });
    }

    // Event listener for shareNameInput to toggle saveShareBtn
    if (shareNameInput && saveShareBtn) {
        shareNameInput.addEventListener('input', () => {
            // This listener now just triggers the comprehensive dirty state check
            checkFormDirtyState(); 
        });
    }

    // Save Share Button
    if (saveShareBtn) {
        saveShareBtn.addEventListener('click', async () => {
            console.log("[Share Form] Save Share button clicked.");
            // Ensure button is not disabled before proceeding
            if (saveShareBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert("Please enter a share code and make changes to save.");
                console.warn("[Save Share] Save button was disabled, preventing action.");
                return;
            }

            const shareName = shareNameInput.value.trim().toUpperCase();
            if (!shareName) { showCustomAlert("Code is required!"); return; }

            const currentPrice = parseFloat(currentPriceInput.value);
            const targetPrice = parseFloat(targetPriceInput.value);
            const dividendAmount = parseFloat(dividendAmountInput.value);
            const frankingCredits = parseFloat(frankingCreditsInput.value);

            const comments = [];
            if (commentsFormContainer) {
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
            
            // Determine watchlistId for saving
            let finalWatchlistId;
            if (selectWatchlistForShareModal && selectWatchlistForShareModal.style.display !== 'none' && confirmWatchlistSelectionBtn.dataset.selectedWatchlistId) {
                // If the watchlist selection modal was used, use its selected ID
                finalWatchlistId = confirmWatchlistSelectionBtn.dataset.selectedWatchlistId;
                delete shareNameInput.dataset.targetWatchlistId; // Clear it after use
                console.log(`[Save Share] Using targetWatchlistId from dataset: ${finalWatchlistId}`);
            } else if (watchlistSelect && watchlistSelect.value && watchlistSelect.value !== ALL_SHARES_ID) {
                // Otherwise, use the currently selected watchlist from the main dropdown (if not "All Shares")
                finalWatchlistId = watchlistSelect.value;
                console.log(`[Save Share] Using selected watchlist from dropdown: ${finalWatchlistId}`);
            } else {
                // Fallback to the default watchlist if "All Shares" is selected or no other specific watchlist
                finalWatchlistId = userWatchlists.length > 0 ? userWatchlists[0].id : getDefaultWatchlistId(currentUserId);
                console.log(`[Save Share] Falling back to default watchlist: ${finalWatchlistId}`);
            }


            const shareData = {
                shareName: shareName,
                currentPrice: isNaN(currentPrice) ? null : currentPrice,
                targetPrice: isNaN(targetPrice) ? null : targetPrice,
                dividendAmount: isNaN(dividendAmount) ? null : dividendAmount,
                frankingCredits: isNaN(frankingCredits) ? null : frankingCredits,
                comments: comments,
                userId: currentUserId,
                watchlistId: finalWatchlistId, // Use the determined watchlist ID
                lastPriceUpdateTime: new Date().toISOString()
            };

            // ... (rest of the save share logic) ...
            if (selectedShareDocId) {
                const existingShare = allSharesData.find(s => s.id === selectedShareDocId); // Corrected to use s.id
                // Update lastFetchedPrice and previousFetchedPrice only if currentPrice is valid and changed
                if (shareData.currentPrice !== null && existingShare && existingShare.currentPrice !== shareData.currentPrice) {
                    shareData.previousFetchedPrice = existingShare.lastFetchedPrice; // Store old lastFetchedPrice
                    shareData.lastFetchedPrice = shareData.currentPrice; // Update lastFetchedPrice to new currentPrice
                } else if (!existingShare || existingShare.lastFetchedPrice === undefined) { // If it's a new field or no existing share
                    shareData.previousFetchedPrice = existingShare.previousFetchedPrice; // Preserve existing if no change
                    shareData.lastFetchedPrice = existingShare.lastFetchedPrice; // Preserve existing if no change
                } else { // No change in currentPrice, preserve existing fetched prices
                    shareData.previousFetchedPrice = existingShare.previousFetchedPrice;
                    shareData.lastFetchedPrice = existingShare.lastFetchedPrice;
                }

                try {
                    const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, selectedShareDocId);
                    await window.firestore.updateDoc(shareDocRef, shareData);
                    showCustomAlert(`Share '${shareName}' updated successfully!`, 1500);
                    console.log(`[Firestore] Share '${shareName}' (ID: ${selectedShareDocId}) updated.`);
                } catch (error) {
                    console.error("[Firestore] Error updating share:", error);
                    showCustomAlert("Error updating share: " + error.message);
                }
            } else {
                shareData.entryDate = new Date().toISOString();
                shareData.lastFetchedPrice = shareData.currentPrice;
                shareData.previousFetchedPrice = shareData.currentPrice;

                try {
                    const sharesColRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
                    const newDocRef = await window.firestore.addDoc(sharesColRef, shareData);
                    selectedShareDocId = newDocRef.id;
                    showCustomAlert(`Share '${shareName}' added successfully!`, 1500);
                    console.log(`[Firestore] Share '${shareName}' added with ID: ${newDocRef.id}`);
                } catch (error) {
                    console.error("[Firestore] Error adding share:", error);
                    showCustomAlert("Error adding share: " + error.message);
                }
            }
            closeModals();
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Ensure this script only runs its initialization logic once
    if (window._appLogicInitializedOnce) {
        console.warn("script.js: initializeAppLogic already executed. Skipping duplicate initialization.");
        return;
    }
    window._appLogicInitializedOnce = true;


    console.log("script.js (v165) DOMContentLoaded fired."); // Updated version number

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
                console.log("[AuthState] User email:", user.email); // Log user email for debugging title
                if (user.email && user.email.toLowerCase() === KANGA_EMAIL) {
                    mainTitle.textContent = "Kanga's Share Watchlist";
                    console.log("[AuthState] Main title set to Kanga's Share Watchlist.");
                } else {
                    mainTitle.textContent = "My Share Watchlist";
                    console.log("[AuthState] Main title set to My Share Watchlist.");
                }
                updateMainButtonsState(true);
                await loadUserWatchlistsAndSettings(); // This will set currentSelectedWatchlistIds and then call loadShares()
                startLivePriceUpdates(); // Start fetching live prices when user signs in
            } else {
                currentUserId = null;
                updateAuthButtonText(false); // Changed to false for "Google Sign In" text
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
                stopLivePriceUpdates(); // Stop fetching live prices when user signs out
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
