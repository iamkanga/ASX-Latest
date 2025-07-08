// File Version: v150 (Updated for Watchlist Fixes)
// Last Updated: 2025-07-08 (Merged watchlist fixes from later versions)

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
const KANGA_EMAIL = 'iamkanga@gmail.com'; // CORRECTED EMAIL ADDRESS
let currentCalculatorInput = '';
let operator = null;
let previousCalculatorInput = '';
let resultDisplayed = false;
const DEFAULT_WATCHLIST_NAME = 'My Watchlist (Default)';
const DEFAULT_WATCHLIST_ID_SUFFIX = 'default';
let userWatchlists = []; // Stores all watchlists for the user (now an array of objects)
let currentSelectedWatchlistIds = []; // Stores IDs of currently selected watchlists for display
let unsubscribeShares = null; // To store the unsubscribe function for the Firestore listener

// Constants for theme and sort order (keeping from v150 but ensuring consistency with v160 logic)
const ALL_SHARES_ID = 'all_shares'; // Corrected ID for "All Shares" option
let currentSortOrder = 'entryDate-desc'; // Default sort order
let contextMenuOpen = false; // To track if the custom context menu is open
let currentContextMenuShareId = null; // Stores the ID of the share that opened the context menu
let originalShareData = null; // Stores the original share data when editing for dirty state check

// Theme related variables (keeping from v150/v160)
const CUSTOM_THEMES = [
    'bold-1', 'bold-2', 'bold-3', 'bold-4', 'bold-5', 'bold-6', 'bold-7', 'bold-8', 'bold-9', 'bold-10',
    'subtle-1', 'subtle-2', 'subtle-3', 'subtle-4', 'subtle-5', 'subtle-6', 'subtle-7', 'subtle-8', 'subtle-9', 'subtle-10'
];
let currentCustomThemeIndex = -1; // To track the current theme in the cycle
let currentActiveTheme = 'system-default'; // Tracks the currently applied theme string (e.g., 'dark', 'bold', 'subtle', 'system-default')
let savedSortOrder = null; // GLOBAL: Stores the sort order loaded from user settings
let savedTheme = null; // GLOBAL: Stores the theme loaded from user settings


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
const modalFrankingCredits = document.getElementById('modalFrankingCredits'); // Corrected ID from 'frankingCredits'
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
const addToWatchlistBtn = document.getElementById('addToWatchlistBtn'); // NEW

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

// NEW: Add/Remove from Watchlist Modal Elements (from v160)
const addToWatchlistModal = document.getElementById('addToWatchlistModal');
const addToWatchlistCloseBtn = document.getElementById('addToWatchlistCloseBtn');
const shareNameForWatchlistModal = document.getElementById('shareNameForWatchlistModal');
const watchlistCheckboxesContainer = document.getElementById('watchlistCheckboxesContainer');
const cancelAddToWatchlistBtn = document.getElementById('cancelAddToWatchlistBtn');
const saveAddToWatchlistBtn = document.getElementById('saveAddToWatchlistBtn');
let currentShareIdForWatchlistManagement = null; // To store the share ID being managed

// Dividend Calculator Modal Elements
const dividendCalculatorModal = document.getElementById('dividendCalculatorModal');
const dividendCalcCloseBtn = dividendCalculatorModal ? dividendCalculatorModal.querySelector('.calc-close-button') : null;
const calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
const calcDividendAmountInput = document.getElementById('calcDividendAmount');
const calcFrankingCreditsInput = document.getElementById('calcFrankingCredits');
const calcUnfrankedYieldSpan = document.getElementById('calcUnfrankedYield');
const calcFrankedYieldSpan = document.getElementById('calcFrankedYield');
const investmentValueSelect = document.getElementById('investmentValueSelect');
const calcEstimatedDividend = document.getElementById('calcEstimatedDividend'); // Corrected ID from 'calcEstimatedDividendSpan'

// Standard Calculator Modal Elements
const calculatorModal = document.getElementById('calculatorModal');
const calculatorCloseBtn = calculatorModal ? calculatorModal.querySelector('.close-button') : null;
const calculatorInput = document.getElementById('calculatorInput'); // Corrected ID from 'calculatorInputDisplay'
const calculatorResult = document.getElementById('calculatorResult'); // Corrected ID from 'calculatorResultDisplay'
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
const contextAddToWatchlistBtn = document.getElementById('contextAddToWatchlistBtn'); // NEW

// Ensure sidebar overlay is present in DOM
let sidebarOverlay = document.querySelector('.sidebar-overlay');
if (!sidebarOverlay) {
    sidebarOverlay = document.createElement('div');
    sidebarOverlay.classList.add('sidebar-overlay');
    document.body.appendChild(sidebarOverlay);
}

// Form inputs array for dirty state check
const formInputs = [
    shareNameInput, currentPriceInput, targetPriceInput,
    dividendAmountInput, frankingCreditsInput
];


// --- GLOBAL HELPER FUNCTIONS ---

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
    document.querySelectorAll('.modal').forEach(modal => {
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
        }
    });
    resetCalculator();
    deselectCurrentShare();
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

// UI State Management Functions
function updateAuthButtonText(isSignedIn, userName = 'Sign In') {
    if (googleAuthBtn) {
        googleAuthBtn.textContent = isSignedIn ? (userName || 'Signed In') : 'Sign In';
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
    deselectCurrentShare(); // Deselect any previously selected share

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
        addCommentSection(); // Always add one initial comment section
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
            addCommentSection();
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
            comments.push({ title: title, text: text });
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
        showCustomAlert("Share details not found.");
        return;
    }
    modalShareName.textContent = share.shareName || 'N/A';
    modalEntryDate.textContent = formatDate(share.entryDate) || 'N/A';
    
    const enteredPriceNum = Number(share.currentPrice);
    modalEnteredPrice.textContent = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? `$${enteredPriceNum.toFixed(2)}` : 'N/A';

    const targetPriceNum = Number(share.targetPrice);
    modalTargetPrice.textContent = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? `$${targetPriceNum.toFixed(2)}` : 'N/A';
    
    const dividendAmountNum = Number(share.dividendAmount);
    modalDividendAmount.textContent = (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? `$${dividendAmountNum.toFixed(3)}` : 'N/A';
    
    const frankingCreditsNum = Number(share.frankingCredits);
    modalFrankingCredits.textContent = (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? `${frankingCreditsNum.toFixed(1)}%` : 'N/A';
    
    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, enteredPriceNum); 
    modalUnfrankedYield.textContent = unfrankedYield !== null ? `${unfrankedYield.toFixed(2)}%` : 'N/A';
    
    const frankedYield = calculateFrankedYield(dividendAmountNum, enteredPriceNum, frankingCreditsNum);
    modalFrankedYield.textContent = frankedYield !== null ? `${frankedYield.toFixed(2)}%` : 'N/A';
    
    if (modalCommentsContainer) {
        modalCommentsContainer.innerHTML = '';
        if (share.comments && Array.isArray(share.comments) && share.comments.length > 0) {
            share.comments.forEach(comment => {
                if (comment.title || comment.text) {
                    const commentDiv = document.createElement('div');
                    commentDiv.className = 'modal-comment-item';
                    commentDiv.innerHTML = `
                        <strong>${comment.title || 'General Comment'}</strong>
                        <p>${comment.text || ''}</p>
                    `;
                    modalCommentsContainer.appendChild(commentDiv);
                }
            });
        } else {
            modalCommentsContainer.innerHTML = '<p style="text-align: center; color: var(--label-color);">No comments for this share.</p>';
        }
    }

    // NEW: Google News Link
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
        setIconDisabled(modalMarketIndexLink, true); // Explicitly disable if no shareName
    }

    if (modalFoolLink && share.shareName) {
        const foolUrl = `https://www.fool.com.au/tickers/asx-${share.shareName.toLowerCase()}/`;
        modalFoolLink.href = foolUrl;
        modalFoolLink.textContent = `View ${share.shareName.toUpperCase()} on Fool.com.au`;
        modalFoolLink.style.display = 'inline-flex';
        setIconDisabled(modalFoolLink, false); // Explicitly enable
    } else if (modalFoolLink) {
        modalFoolLink.style.display = 'none';
        setIconDisabled(modalFoolLink, true); // Explicitly disable if no shareName
    }

    if (modalCommSecLink && share.shareName) {
        const commSecUrl = `https://www2.commsec.com.au/quotes/summary?stockCode=${share.shareName.toUpperCase()}&exchangeCode=ASX`;
        modalCommSecLink.href = commSecUrl;
        modalCommSecLink.textContent = `View ${share.shareName.toUpperCase()} on CommSec.com.au`;
        modalCommSecLink.style.display = 'inline-flex';
        setIconDisabled(modalCommSecLink, false); // Explicitly enable
    } else if (modalCommSecLink) {
        modalCommSecLink.style.display = 'none';
        setIconDisabled(modalCommSecLink, true); // Explicitly disable if no shareName
    }

    if (commSecLoginMessage) {
        commSecLoginMessage.style.display = 'block'; 
    }

    // Ensure editShareFromDetailBtn and deleteShareFromDetailBtn are enabled when showing details
    setIconDisabled(editShareFromDetailBtn, false);
    setIconDisabled(deleteShareFromDetailBtn, false); // NEW: Enable delete button in details modal
    setIconDisabled(addToWatchlistBtn, false); // Enable add to watchlist button

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
    allSharesOption.textContent = 'All Shares';
    watchlistSelect.appendChild(allSharesOption);

    // Sort user-defined watchlists alphabetically by name, but keep 'My Watchlist (Default)' first
    const sortedUserWatchlists = [...userWatchlists].sort((a, b) => {
        if (a.id === getDefaultWatchlistId(currentUserId)) return -1; // Default watchlist always first
        if (b.id === getDefaultWatchlistId(currentUserId)) return 1;
        return a.name.localeCompare(b.name);
    });

    sortedUserWatchlists.forEach(watchlist => {
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        watchlistSelect.appendChild(option);
    });

    // Set the selected value based on currentSelectedWatchlistIds
    if (currentSelectedWatchlistIds.length > 0) {
        const selectedId = currentSelectedWatchlistIds[0];
        if (watchlistSelect.querySelector(`option[value="${selectedId}"]`)) {
            watchlistSelect.value = selectedId;
        } else {
            // Fallback if selected ID is no longer valid (e.g., watchlist deleted)
            watchlistSelect.value = ALL_SHARES_ID; 
            currentSelectedWatchlistIds = [ALL_SHARES_ID];
            saveLastSelectedWatchlistIds(currentSelectedWatchlistIds); // Save corrected preference
        }
    } else {
        // Default to "All Shares" if no watchlist is selected
        watchlistSelect.value = ALL_SHARES_ID; 
        currentSelectedWatchlistIds = [ALL_SHARES_ID];
        saveLastSelectedWatchlistIds(currentSelectedWatchlistIds); // Save default preference
    }
    console.log("[UI Update] Watchlist select dropdown rendered.");
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
    if (currentUserId && currentSortOrder && Array.from(sortSelect.options).some(option => option.value === currentSortOrder)) {
        sortSelect.value = currentSortOrder; // Set the select element's value
        // currentSortOrder is already set by loadUserWatchlistsAndSettings
        console.log(`[Sort] Applied saved sort order: ${currentSortOrder}`);
    } else {
        sortSelect.value = ''; 
        currentSortOrder = ''; // Ensure global variable is reset if no valid option
        console.log("[Sort] No valid saved sort order or not logged in, defaulting to placeholder.");
    }
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
        if (!contextMenuOpen) {
            const currentTime = new Date().getTime();
            const clickDelay = 300; // milliseconds for double click detection
            if (currentTime - lastClickTime < clickDelay) {
                // Double click detected
                console.log(`[Table Row Double Click] Share ID: ${share.id}`);
                selectShare(share.id); 
                showShareDetails();
            }
            lastClickTime = currentTime;
            selectShare(share.id); // Also select on single click
        }
    });

    // Right click for context menu
    row.addEventListener('contextmenu', (event) => {
        console.log(`[Table Row ContextMenu] Share ID: ${share.id}`);
        event.preventDefault();
        selectShare(share.id);
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
                event.preventDefault(); // Prevent default browser context menu
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
    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, enteredPriceNum); 
    const frankedYield = calculateFrankedYield(dividendAmountNum, enteredPriceNum, frankingCreditsNum);
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
    let commentsText = '';
    if (share.comments && Array.isArray(share.comments) && share.comments.length > 0 && share.comments[0].text) {
        commentsText = share.comments[0].text;
    }
    commentsCell.textContent = truncateText(commentsText, 70);
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
    
    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, enteredPriceNum);
    const frankedYield = calculateFrankedYield(dividendAmountNum, enteredPriceNum, frankingCreditsNum);

    let commentsSummary = '-';
    if (share.comments && Array.isArray(share.comments) && share.comments.length > 0 && share.comments[0].text) {
        commentsSummary = truncateText(share.comments[0].text, 70);
    }

    const displayTargetPrice = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? targetPriceNum.toFixed(2) : '-';
    const displayDividendAmount = (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? dividendAmountNum.toFixed(2) : '-';
    const displayFrankingCredits = (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? `${frankingCreditsNum}%` : '-';
    const displayShareName = (share.shareName && String(share.shareName).trim() !== '') ? share.shareName : '(No Code)';
    const displayEnteredPrice = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? enteredPriceNum.toFixed(2) : '-';


    card.innerHTML = `
        <h3>${displayShareName}</h3>
        <p><strong>Entry Date:</strong> ${formatDate(share.entryDate) || '-'}</p>
        <p><strong>Entered Price:</strong> $${displayEnteredPrice}</p>
        <p><strong>Target:</strong> $${displayTargetPrice}</p>
        <p><strong>Dividend:</strong> $${displayDividendAmount}</p>
        <p><strong>Franking:</strong> ${displayFrankingCredits}</p>
        <p><strong>Unfranked Yield:</strong> ${unfrankedYield !== null ? unfrankedYield.toFixed(2) + '%' : '-'}</p>
        <p><strong>Franked Yield:</strong> ${frankedYield !== null ? frankedYield.toFixed(2) + '%' : '-'}</p>
        <p class="card-comments"><strong>Comments:</strong> ${commentsSummary}</p>
    `;
    mobileShareCardsContainer.appendChild(card);

    let lastClickTime = 0;
    card.addEventListener('click', function(e) {
        console.log(`[Mobile Card Click] Share ID: ${share.id}`);
        if (!contextMenuOpen) {
            const currentTime = new Date().getTime();
            const clickDelay = 300; // milliseconds for double click detection
            if (currentTime - lastClickTime < clickDelay) {
                // Double click detected
                console.log(`[Mobile Card Double Click] Share ID: ${share.id}`);
                const docId = e.currentTarget.dataset.docId;
                selectShare(docId);
                showShareDetails();
            }
            lastClickTime = currentTime;
            const docId = e.currentTarget.dataset.docId;
            selectShare(docId); // Also select on single click
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

    // If "All Shares" is selected, render all shares from allSharesData
    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        sharesToRender = [...allSharesData]; 
        mainTitle.textContent = "All My Shares";
        console.log("[Render] Displaying all shares (from ALL_SHARES_ID in currentSelectedWatchlistIds).");
    } else if (currentSelectedWatchlistIds.length > 0) {
        // Filter allSharesData based on the watchlistId property of each share
        sharesToRender = allSharesData.filter(share => 
            currentSelectedWatchlistIds.includes(share.watchlistId)
        );
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
        // Fallback if no watchlists are selected or available (e.g., brand new user)
        mainTitle.textContent = "Share Watchlist";
        console.log("[Render] No watchlists available or selected for display.");
    }


    if (sharesToRender.length === 0) {
        const emptyWatchlistMessage = document.createElement('p');
        emptyWatchlistMessage.textContent = `No shares found for the selected watchlists. Add a new share to get started!`;
        emptyWatchlistMessage.style.textAlign = 'center';
        emptyWatchlistMessage.style.padding = '20px';
        emptyWatchlistMessage.style.color = 'var(--ghosted-text)';
        const td = document.createElement('td');
        td.colSpan = 5; // Span all columns in the table
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
    // Use allSharesData directly as it's already filtered by the onSnapshot listener
    sharesForButtons = [...allSharesData]; 

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
    const grossUpFactor = 1 / (1 - COMPANY_TAX_RATE); // Approx 1.42857
    const frankedAmount = dividendAmount * (1 + (frankingRatio * grossUpFactor * COMPANY_TAX_RATE)); // Simplified gross-up logic
    return (frankedAmount / currentPrice) * 100;
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
    // Remove all existing theme classes (dark-theme, theme-bold-X, theme-subtle-X)
    body.className = body.className.split(' ').filter(c => !c.endsWith('-theme') && !c.startsWith('theme-')).join(' ');

    currentActiveTheme = themeName;

    if (themeName === 'system-default') {
        body.removeAttribute('data-theme');
        localStorage.removeItem('selectedTheme'); // Clear custom theme from local storage
        localStorage.removeItem('theme'); // Clear old 'theme' key from local storage
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
            body.classList.add('dark-theme');
        }
        console.log("[Theme] Reverted to system default theme.");
        currentCustomThemeIndex = -1;
    } else if (themeName === 'light' || themeName === 'dark') { // Handle explicit light/dark if ever used
        body.removeAttribute('data-theme');
        localStorage.removeItem('selectedTheme');
        localStorage.setItem('theme', themeName);
        if (themeName === 'dark') {
            body.classList.add('dark-theme');
        }
        console.log(`[Theme] Applied explicit default theme: ${themeName}`);
        currentCustomThemeIndex = -1;
    } else { // Custom themes
        body.classList.add('theme-' + themeName);
        body.setAttribute('data-theme', themeName); // Set data-theme attribute for CSS targeting
        localStorage.setItem('selectedTheme', themeName); // Save custom theme to local storage
        localStorage.removeItem('theme'); // Ensure old 'theme' key is removed
        console.log(`[Theme] Applied custom theme: ${themeName}`);
        currentCustomThemeIndex = CUSTOM_THEMES.indexOf(themeName);
    }
    
    // Save theme preference to Firestore
    if (currentUserId && db && window.firestore) {
        const userSettingsDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/user_settings/main_settings`);
        try {
            await window.firestore.setDoc(userSettingsDocRef, { theme: themeName }, { merge: true });
            console.log(`[Theme] Saved theme preference to Firestore: ${themeName}`);
        } catch (error) {
            console.error("[Theme] Error saving theme preference to Firestore:", error);
        }
    }
    updateThemeToggleAndSelector();
}

function updateThemeToggleAndSelector() {
    // Update the dropdown to show the currently active custom theme or 'none'
    if (colorThemeSelect) {
        if (currentActiveTheme.startsWith('bold-') || currentActiveTheme.startsWith('subtle-')) {
            colorThemeSelect.value = currentActiveTheme;
        } else {
            colorThemeSelect.value = 'none';
        }
        console.log(`[Theme UI] Color theme select updated to: ${colorThemeSelect.value}`);
    }

    // Update currentCustomThemeIndex based on the active theme
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
    const userSettingsDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/user_settings/main_settings`);
    try {
        await window.firestore.setDoc(userSettingsDocRef, { currentSelectedWatchlistIds: watchlistIds }, { merge: true });
        console.log(`[Watchlist] Saved last selected watchlist IDs: ${watchlistIds.join(', ')}`);
    } catch (error) {
        console.error("[Watchlist] Error saving last selected watchlist IDs:", error);
    }
}

async function saveSortOrderPreference(sortOrder) {
    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Sort] Cannot save sort order preference: DB, User ID, or Firestore functions not available. Skipping save.");
        return;
    }
    const userSettingsDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/user_settings/main_settings`);
    try {
        await window.firestore.setDoc(userSettingsDocRef, { lastSortOrder: sortOrder }, { merge: true });
        console.log(`[Sort] Saved sort order preference: ${sortOrder}`);
    } catch (error) {
        console.error("[Sort] Error saving sort order preference:", error);
    }
}

async function loadUserWatchlistsAndSettings() {
    if (!db || !currentUserId) {
        console.warn("[User Settings] Firestore DB or User ID not available for loading settings.");
        return;
    }
    userWatchlists = []; // Clear existing watchlists before loading
    const userSettingsDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/user_settings/main_settings`);
    const oldWatchlistsCollectionRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`);

    try {
        console.log("[User Settings] Fetching user settings and old watchlists for migration...");
        let settingsFromFirestore = null;
        const settingsDocSnap = await window.firestore.getDoc(userSettingsDocRef);
        if (settingsDocSnap.exists()) {
            settingsFromFirestore = settingsDocSnap.data();
            userWatchlists = settingsFromFirestore.watchlists || [];
            console.log("[User Settings] User settings loaded from main_settings.");
        } else {
            console.log("[User Settings] No user settings found in main_settings. Starting fresh.");
            userWatchlists = [];
        }

        // --- Migration Logic from v160 ---
        const oldWatchlistsFromCollection = [];
        const oldWatchlistsQuerySnapshot = await window.firestore.getDocs(oldWatchlistsCollectionRef);
        oldWatchlistsQuerySnapshot.forEach(doc => {
            const oldWlData = doc.data();
            // Ensure old watchlists have the 'shares' property for compatibility, and copy it
            if (!oldWlData.shares) oldWlData.shares = {};
            oldWatchlistsFromCollection.push({ id: doc.id, ...oldWlData });
        });
        console.log(`[Migration] Found ${oldWatchlistsFromCollection.length} watchlists in old collection.`);

        let combinedWatchlists = [...userWatchlists]; // Start with watchlists from main_settings

        oldWatchlistsFromCollection.forEach(oldWl => {
            const existsInCombined = combinedWatchlists.some(currentWl => currentWl.id === oldWl.id);
            if (!existsInCombined) {
                combinedWatchlists.push(oldWl); // Add if it's a new ID
            } else {
                // If ID exists, merge properties, prioritizing existing (e.g., if 'shares' was added later)
                const existingWl = combinedWatchlists.find(currentWl => currentWl.id === oldWl.id);
                // Merge old watchlist data into the existing one, ensuring 'shares' is an object
                Object.assign(existingWl, oldWl);
                if (!existingWl.shares) existingWl.shares = {};
            }
        });
        userWatchlists = combinedWatchlists; // Update the global array with merged data

        // Ensure default watchlist exists and is correctly structured
        const defaultWlId = getDefaultWatchlistId(currentUserId);
        const defaultWlExists = userWatchlists.some(wl => wl.id === defaultWlId);
        if (!defaultWlExists) {
            userWatchlists.unshift({ // Add to the beginning for consistent ordering
                id: defaultWlId,
                name: DEFAULT_WATCHLIST_NAME,
                shares: {} // Initialize with an empty shares object
            });
            console.log("[Migration] Ensured default watchlist exists.");
        }
        // --- End Migration Logic ---

        // Sort watchlists alphabetically by name, but keep 'My Watchlist (Default)' first
        userWatchlists.sort((a, b) => {
            if (a.id === defaultWlId) return -1;
            if (b.id === defaultWlId) return 1;
            return a.name.localeCompare(b.name);
        });

        // Load saved preferences from settingsDocSnap or set defaults
        currentSelectedWatchlistIds = settingsFromFirestore?.currentSelectedWatchlistIds || [ALL_SHARES_ID];
        savedSortOrder = settingsFromFirestore?.lastSortOrder || 'entryDate-desc'; // Default sort order
        savedTheme = settingsFromFirestore?.theme || 'system-default'; // Default theme

        // Filter out any invalid watchlist IDs from currentSelectedWatchlistIds
        currentSelectedWatchlistIds = currentSelectedWatchlistIds.filter(id => 
            id === ALL_SHARES_ID || userWatchlists.some(wl => wl.id === id)
        );
        // If no valid watchlists are selected, default to the first available watchlist or ALL_SHARES_ID
        if (currentSelectedWatchlistIds.length === 0) {
            if (userWatchlists.length > 0) {
                currentSelectedWatchlistIds = [userWatchlists[0].id];
                console.warn("[User Settings] No valid watchlist selected, defaulting to first watchlist.");
            } else {
                currentSelectedWatchlistIds = [ALL_SHARES_ID]; // Should not happen if default is created
                console.warn("[User Settings] No watchlists found, defaulting to ALL_SHARES_ID (though no shares might exist).");
            }
        }

        // Save the consolidated watchlists and settings back to main_settings (important for migration persistence)
        await window.firestore.setDoc(userSettingsDocRef, {
            watchlists: userWatchlists,
            currentSelectedWatchlistIds: currentSelectedWatchlistIds,
            lastSortOrder: savedSortOrder,
            theme: savedTheme
        }, { merge: true });
        console.log("[User Settings] Consolidated watchlists and settings saved to main_settings.");

        populateWatchlistDropdown(); // Populate the UI dropdown
        sortSelect.value = savedSortOrder; // Set the sort dropdown
        currentSortOrder = savedSortOrder; // Update global sort order
        renderSortSelect(); // Re-render sort select to ensure it's correct

        applyTheme(savedTheme); // Apply the saved theme

        updateMainButtonsState(true); 

        // Trigger migration of old share fields (like 'name' to 'shareName', string numbers to actual numbers)
        // This is separate from watchlist structure migration but good to run here.
        await migrateOldSharesSchema(); // This function will also call loadShares() if migration occurs

    } catch (error) {
        console.error("[User Settings] Error loading user watchlists and settings:", error);
        showCustomAlert("Error loading your data. Please try refreshing the page.");
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Saves user-specific settings to Firestore. This is called whenever userWatchlists or
 * currentSelectedWatchlistIds or theme/sortOrder change in memory.
 */
async function saveUserSettings() {
    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Firestore] Firestore or User ID not available for saving settings.");
        return;
    }
    console.log("[Firestore] Saving user settings...");
    const userSettingsDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/user_settings/main_settings`);

    try {
        await window.firestore.setDoc(userSettingsDocRef, {
            watchlists: userWatchlists,
            currentSelectedWatchlistIds: currentSelectedWatchlistIds,
            lastSortOrder: currentSortOrder, // Save current sort order
            theme: currentActiveTheme // Save current active theme
        }, { merge: true });
        console.log("[Firestore] User settings saved successfully.");
    } catch (error) {
        console.error("[Firestore] Error saving user settings:", error);
        showCustomAlert("Error saving settings.", 3000);
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

        let effectiveWatchlistIdsForQuery = [...currentSelectedWatchlistIds];

        if (effectiveWatchlistIdsForQuery.includes(ALL_SHARES_ID)) {
            // If "All Shares" is selected, fetch all shares.
            q = window.firestore.query(sharesCol);
            console.log(`[Shares] Setting up real-time listener for ALL shares for user: ${currentUserId}`);
        } else if (effectiveWatchlistIdsForQuery.length > 0) {
            // If specific watchlists are selected, use 'where' clause for watchlistId
            // Firestore 'in' query supports up to 10 values, but for single-select dropdown, it's usually 1.
            // If we ever support multi-select, this would need to change to multiple 'where' clauses or a single 'in'
            // if the number of selected watchlists is small. For now, assuming single selection from dropdown.
            q = window.firestore.query(sharesCol, window.firestore.where("watchlistId", "==", effectiveWatchlistIdsForQuery[0]));
            console.log(`[Shares] Setting up real-time listener for shares in watchlist: ${effectiveWatchlistIdsForQuery[0]}`);
        } else {
            // No watchlist selected or available, query for nothing or handle as empty state.
            // For now, if no watchlist is effective, we'll just fetch all and filter client-side (or show empty).
            // This case should ideally be handled by defaulting to ALL_SHARES_ID or first watchlist.
            q = window.firestore.query(sharesCol); // Fetch all to allow client-side filtering if needed
            console.warn("[Shares] No effective watchlist selected. Fetching all shares for potential client-side filtering.");
        }
        
        // Set up the real-time listener
        unsubscribeShares = window.firestore.onSnapshot(q, (querySnapshot) => {
            console.log("[Firestore Listener] Shares snapshot received. Processing changes.");
            let fetchedShares = [];
            querySnapshot.forEach((doc) => {
                const share = { id: doc.id, ...doc.data() };
                fetchedShares.push(share);
            });

            // Client-side filtering based on effective watchlist ID, if not ALL_SHARES_ID
            // This is a fallback/double-check, as the query should ideally handle most filtering.
            if (!effectiveWatchlistIdsForQuery.includes(ALL_SHARES_ID) && effectiveWatchlistIdsForQuery.length > 0) {
                allSharesData = fetchedShares.filter(share => effectiveWatchlistIdsForQuery.includes(share.watchlistId));
                console.log(`[Shares] Client-side filtered shares for watchlist(s) ${effectiveWatchlistIdsForQuery.join(', ')}. Total shares after filter: ${allSharesData.length}`);
            } else {
                allSharesData = fetchedShares;
                console.log(`[Shares] Shares data updated from snapshot. Total shares: ${allSharesData.length}`);
            }
            
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

/**
 * Adds or removes a share from a watchlist.
 * This function updates the `shares` map within the specific watchlist object in `userWatchlists`
 * and then saves the entire `userWatchlists` array to Firestore.
 * @param {string} shareId - The ID of the share.
 * @param {string} watchlistId - The ID of the watchlist.
 * @param {boolean} add - True to add, false to remove.
 */
async function toggleShareInWatchlist(shareId, watchlistId, add) {
    if (!db || !currentUserId || !window.firestore) {
        showCustomAlert("Error: Not authenticated or Firestore not available.");
        return;
    }

    // Find the watchlist in the in-memory array
    const watchlistIndex = userWatchlists.findIndex(wl => wl.id === watchlistId);

    if (watchlistIndex > -1) {
        // Ensure the 'shares' property exists as an object
        if (!userWatchlists[watchlistIndex].shares) {
            userWatchlists[watchlistIndex].shares = {};
        }

        if (add) {
            userWatchlists[watchlistIndex].shares[shareId] = true; // Mark presence of the share
            console.log(`[Watchlist Management] Share ${shareId} marked as present in watchlist ${watchlistId}.`);
        } else {
            delete userWatchlists[watchlistIndex].shares[shareId]; // Remove the share entry
            console.log(`[Watchlist Management] Share ${shareId} removed from watchlist ${watchlistId}.`);
        }
        
        // Save the updated userWatchlists array to Firestore
        await saveUserSettings(); 
        // The onSnapshot listener for shares will automatically update the UI if needed
    } else {
        console.warn(`[Watchlist Management] Watchlist with ID ${watchlistId} not found in userWatchlists array.`);
    }
}

/**
 * Populates and displays the "Add/Remove from Watchlist" modal.
 * @param {string} shareId - The ID of the share to manage watchlists for.
 */
function showAddToWatchlistModal(shareId) {
    currentShareIdForWatchlistManagement = shareId;
    const share = allSharesData.find(s => s.id === shareId);
    if (!share) {
        showCustomAlert("Share not found for watchlist management.");
        return;
    }

    shareNameForWatchlistModal.textContent = share.shareName;
    watchlistCheckboxesContainer.innerHTML = ''; // Clear existing checkboxes

    // Filter out the "All Shares" option as it's not a real watchlist to assign to
    userWatchlists.filter(wl => wl.id !== ALL_SHARES_ID).forEach(watchlist => {
        const checkboxId = `watchlist-${watchlist.id}`;
        // Check if the share is currently in this watchlist based on the 'shares' map
        const isChecked = watchlist.shares && watchlist.shares[shareId];

        const div = document.createElement('div');
        div.className = 'watchlist-checkbox-item';
        div.innerHTML = `
            <input type="checkbox" id="${checkboxId}" value="${watchlist.id}" ${isChecked ? 'checked' : ''}>
            <label for="${checkboxId}">${watchlist.name}</label>
        `;
        watchlistCheckboxesContainer.appendChild(div);
    });

    showModal(addToWatchlistModal);
    console.log(`[Watchlist Management] Showing modal for share: ${shareId}`);
}

/**
 * Handles saving changes from the "Add/Remove from Watchlist" modal.
 */
async function handleAddToWatchlistSave() {
    if (!currentShareIdForWatchlistManagement) {
        console.error("[Watchlist Management] No share ID selected for saving.");
        return;
    }

    loadingIndicator.style.display = 'block';
    try {
        const checkboxes = watchlistCheckboxesContainer.querySelectorAll('input[type="checkbox"]');
        let changesMade = false;

        for (const checkbox of checkboxes) {
            const watchlistId = checkbox.value;
            const isChecked = checkbox.checked;

            const watchlist = userWatchlists.find(wl => wl.id === watchlistId);
            if (watchlist) {
                const wasInWatchlist = watchlist.shares && watchlist.shares[currentShareIdForWatchlistManagement];

                if (isChecked && !wasInWatchlist) {
                    // Add share to watchlist
                    await toggleShareInWatchlist(currentShareIdForWatchlistManagement, watchlistId, true);
                    changesMade = true;
                } else if (!isChecked && wasInWatchlist) {
                    // Remove share from watchlist
                    await toggleShareInWatchlist(currentShareIdForWatchlistManagement, watchlistId, false);
                    changesMade = true;
                }
            }
        }

        if (changesMade) {
            showCustomAlert("Watchlist assignments updated!", 2000);
        } else {
            showCustomAlert("No changes made to watchlists.", 2000);
        }
        hideModal(addToWatchlistModal);
    } catch (error) {
        console.error("[Watchlist Management] Error saving watchlist changes:", error);
        showCustomAlert("Error saving watchlist changes. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
        currentShareIdForWatchlistManagement = null; // Clear the stored share ID
    }
}

/**
 * Migrates old share schema fields (e.g., 'name' to 'shareName', string numbers to actual numbers)
 * and ensures shares have a 'watchlistId'. This function is designed to run once per user.
 */
async function migrateOldSharesSchema() {
    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Migration] Firestore DB, User ID, or Firestore functions not available for schema migration.");
        return false;
    }
    const sharesCol = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
    const q = window.firestore.query(sharesCol);
    let sharesToUpdate = [];
    let anyMigrationPerformed = false;

    try {
        console.log("[Migration] Checking for old share schema to migrate.");
        const querySnapshot = await window.firestore.getDocs(q);

        querySnapshot.forEach(doc => {
            const shareData = doc.data();
            let updatePayload = {};
            let needsUpdate = false;

            // 1. Migrate 'name' to 'shareName' if 'shareName' is missing or empty
            if ((!shareData.shareName || String(shareData.shareName).trim() === '') && shareData.hasOwnProperty('name') && String(shareData.name).trim() !== '') {
                needsUpdate = true;
                updatePayload.shareName = String(shareData.name).trim();
                updatePayload.name = window.firestore.FieldValue.delete(); // Delete old 'name' field
                console.log(`[Migration] Share '${doc.id}': Migrating 'name' ('${shareData.name}') to 'shareName'.`);
            }

            // 2. Convert string numbers to actual numbers and handle NaN
            const fieldsToConvert = ['currentPrice', 'targetPrice', 'dividendAmount', 'frankingCredits', 'entryPrice', 'lastFetchedPrice', 'previousFetchedPrice'];
            fieldsToConvert.forEach(field => {
                const value = shareData[field];
                const originalValueType = typeof value;
                let parsedValue = value; // Default to original value

                if (originalValueType === 'string' && value.trim() !== '') {
                    parsedValue = parseFloat(value);
                    if (!isNaN(parsedValue)) {
                        // Only update if type is different or string representation is different (e.g., "10.00" vs 10)
                        if (originalValueType !== typeof parsedValue || value !== String(parsedValue)) {
                            needsUpdate = true;
                            updatePayload[field] = parsedValue;
                            console.log(`[Migration] Share '${doc.id}': Converted ${field} from string '${value}' to number ${parsedValue}.`);
                        }
                    } else { // String but not a valid number
                        needsUpdate = true;
                        updatePayload[field] = null; // Set to null if invalid string
                        console.warn(`[Migration] Share '${doc.id}': Field '${field}' was invalid string '${value}', setting to null.`);
                    }
                } else if (originalValueType === 'number' && isNaN(value)) { // Number but NaN
                    needsUpdate = true;
                    updatePayload[field] = null; // Set to null if NaN
                    console.warn(`[Migration] Share '${doc.id}': Field '${field}' was NaN number, setting to null.`);
                }
            });

            // 3. Adjust frankingCredits if it's a decimal (e.g., 0.70 instead of 70)
            const currentFranking = updatePayload.frankingCredits !== undefined ? updatePayload.frankingCredits : shareData.frankingCredits;
            if (typeof currentFranking === 'number' && !isNaN(currentFranking) && currentFranking > 0 && currentFranking < 1) {
                needsUpdate = true;
                updatePayload.frankingCredits = currentFranking * 100;
                console.log(`[Migration] Share '${doc.id}': Converted frankingCredits from decimal ${currentFranking} to percentage ${currentFranking * 100}.`);
            }

            // 4. Ensure watchlistId is present and assign to default if missing
            if (!shareData.hasOwnProperty('watchlistId')) {
                needsUpdate = true;
                updatePayload.watchlistId = getDefaultWatchlistId(currentUserId);
                console.log(`[Migration] Share '${doc.id}' missing watchlistId. Assigning to default: ${updatePayload.watchlistId}.`);
            }

            // 5. Ensure price update fields are present
            const effectiveCurrentPrice = (updatePayload.currentPrice !== undefined && !isNaN(updatePayload.currentPrice)) ? updatePayload.currentPrice : 
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
            
            if (needsUpdate) {
                sharesToUpdate.push({ ref: doc.ref, data: updatePayload });
                anyMigrationPerformed = true;
            }
        });

        if (sharesToUpdate.length > 0) {
            console.log(`[Migration] Performing consolidated update for ${sharesToUpdate.length} shares for schema migration.`);
            const batch = window.firestore.writeBatch(db);
            sharesToUpdate.forEach(item => {
                batch.update(item.ref, item.data);
            });
            await batch.commit();
            showCustomAlert(`Migrated/Updated ${sharesToUpdate.length} old shares.`, 2000);
            console.log("[Migration] Schema migration complete. Reloading shares.");
            await loadShares(); // Reload shares after schema migration
        } else {
            console.log("[Migration] No old shares found requiring schema migration.");
            // If no schema migration, still need to load shares for the first time
            await loadShares(); // Initial load for current watchlist
        }
        return anyMigrationPerformed;
    } catch (error) {
        console.error("[Migration] Error during schema migration:", error);
        showCustomAlert("Error during data migration: " + error.message);
        return false;
    }
}


// --- INITIALIZATION ---

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
    if (addToWatchlistModal) addToWatchlistModal.style.setProperty('display', 'none', 'important'); // NEW modal

    // Service Worker Registration (keeping from v89 index.html)
    // Note: This block is already in index.html's module script. Keeping it here for completeness
    // but the one in index.html will likely run first.
    if ('serviceWorker' in navigator) {
        // No window.addEventListener('load') here to avoid duplicate registration if index.html already does it.
        // It's better for index.html to handle initial registration.
        console.log("Service Worker registration handled by index.html module script.");
    }

    // Share Name Input to uppercase and dirty state check
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
            event.target === manageWatchlistModal || event.target === addToWatchlistModal) { // Added addToWatchlistModal
            closeModals();
        }

        if (contextMenuOpen && shareContextMenu && !shareContextMenu.contains(event.target)) {
            hideContextMenu();
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
                    console.error("[Auth] Google Sign-In failed:", error.message);
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
            clearForm();
            formTitle.textContent = 'Add New Share';
            if (deleteShareBtn) { deleteShareBtn.classList.add('hidden'); } // Ensure it's hidden for new share
            showModal(shareFormSection);
            shareNameInput.focus();
            toggleAppSidebar(false); 
        });
    }

    // Add Share Header Button (from header)
    if (addShareHeaderBtn) {
        addShareHeaderBtn.addEventListener('click', () => {
            console.log("[UI] Add Share button (header) clicked.");
            clearForm();
            formTitle.textContent = 'Add New Share';
            if (deleteShareBtn) { deleteShareBtn.classList.add('hidden'); } // Ensure it's hidden for new share
            showModal(shareFormSection);
            shareNameInput.focus();
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

            const shareData = {
                shareName: shareName,
                currentPrice: isNaN(currentPrice) ? null : currentPrice,
                targetPrice: isNaN(targetPrice) ? null : targetPrice,
                dividendAmount: isNaN(dividendAmount) ? null : dividendAmount,
                frankingCredits: isNaN(frankingCredits) ? null : frankingCredits,
                comments: comments,
                userId: currentUserId,
                // Assign to the currently selected watchlist from the dropdown.
                // If no watchlist is selected (e.g., placeholder), default to the first available watchlist.
                watchlistId: (watchlistSelect && watchlistSelect.value && watchlistSelect.value !== "" && watchlistSelect.value !== ALL_SHARES_ID) 
                             ? watchlistSelect.value 
                             : (userWatchlists.length > 0 ? userWatchlists[0].id : getDefaultWatchlistId(currentUserId)),
                lastPriceUpdateTime: new Date().toISOString()
            };

            if (selectedShareDocId) {
                const existingShare = allSharesData.find(s => s.id === selectedShareDocId);
                if (existingShare) { shareData.previousFetchedPrice = existingShare.lastFetchedPrice; }
                else { shareData.previousFetchedPrice = shareData.currentPrice; } // Fallback if existing share not found in current data
                shareData.lastFetchedPrice = shareData.currentPrice;

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

                    // Also add the new share to the 'shares' map of the assigned watchlist in userWatchlists array
                    const assignedWatchlist = userWatchlists.find(wl => wl.id === shareData.watchlistId);
                    if (assignedWatchlist) {
                        if (!assignedWatchlist.shares) {
                            assignedWatchlist.shares = {};
                        }
                        assignedWatchlist.shares[newDocRef.id] = true;
                        await saveUserSettings(); // Persist the updated userWatchlists array
                        console.log(`[Firestore] New share ${newDocRef.id} added to watchlist ${shareData.watchlistId} in settings.`);
                    } else {
                        console.warn(`[Firestore] Assigned watchlist ${shareData.watchlistId} not found in userWatchlists array after adding share.`);
                    }

                } catch (error) {
                    console.error("[Firestore] Error adding share:", error);
                    showCustomAlert("Error adding share: " + error.message);
                }
            }
            closeModals();
        });
    }

    // Cancel Form Button
    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', () => { console.log("[Form] Form canceled."); clearForm(); hideModal(shareFormSection); });
    }

    // Delete Share Button (No confirmation as per user request)
    if (deleteShareBtn) {
        deleteShareBtn.addEventListener('click', async () => {
            console.log("[Share Form] Delete Share button clicked (No Confirmation).");
            // Ensure button is not disabled before proceeding
            if (deleteShareBtn.classList.contains('is-disabled-icon')) {
                console.warn("[Delete Share] Delete button was disabled, preventing action.");
                return; // Do nothing if visually disabled
            }
            if (selectedShareDocId) {
                try {
                    const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, selectedShareDocId);
                    
                    // Remove share from all watchlists it belongs to in user settings
                    const userSettingsDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/user_settings/main_settings`);
                    const settingsSnap = await window.firestore.getDoc(userSettingsDocRef);
                    if (settingsSnap.exists()) {
                        const settings = settingsSnap.data();
                        const currentWatchlists = settings.watchlists || [];
                        currentWatchlists.forEach(watchlist => {
                            if (watchlist.shares && watchlist.shares[selectedShareDocId]) {
                                delete watchlist.shares[selectedShareDocId];
                                console.log(`[Firestore] Removed share ${selectedShareDocId} from watchlist ${watchlist.id} in settings.`);
                            }
                        });
                        await window.firestore.updateDoc(userSettingsDocRef, { watchlists: currentWatchlists });
                    }

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
            // Ensure button is not disabled before proceeding
            if (editShareFromDetailBtn.classList.contains('is-disabled-icon')) {
                console.warn("[Edit Share From Detail] Edit button was disabled, preventing action.");
                return; // Do nothing if visually disabled
            }
            hideModal(shareDetailModal);
            showEditFormForSelectedShare();
        });
    }

    // NEW: Delete Share From Detail Button
    if (deleteShareFromDetailBtn) {
        deleteShareFromDetailBtn.addEventListener('click', async () => {
            console.log("[Share Details] Delete Share button clicked (No Confirmation).");
            // Ensure button is not disabled before proceeding
            if (deleteShareFromDetailBtn.classList.contains('is-disabled-icon')) {
                console.warn("[Delete Share From Detail] Delete button was disabled, preventing action.");
                return; // Do nothing if visually disabled
            }
            if (selectedShareDocId) {
                try {
                    const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, selectedShareDocId);
                    
                    // Remove share from all watchlists it belongs to in user settings
                    const userSettingsDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/user_settings/main_settings`);
                    const settingsSnap = await window.firestore.getDoc(userSettingsDocRef);
                    if (settingsSnap.exists()) {
                        const settings = settingsSnap.data();
                        const currentWatchlists = settings.watchlists || [];
                        currentWatchlists.forEach(watchlist => {
                            if (watchlist.shares && watchlist.shares[selectedShareDocId]) {
                                delete watchlist.shares[selectedShareDocId];
                                console.log(`[Firestore] Removed share ${selectedShareDocId} from watchlist ${watchlist.id} in settings.`);
                            }
                        });
                        await window.firestore.updateDoc(userSettingsDocRef, { watchlists: currentWatchlists });
                    }

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

    // NEW: Add to Watchlist button in Share Detail Modal
    if (addToWatchlistBtn) {
        addToWatchlistBtn.addEventListener('click', () => {
            console.log("[UI] Add to Watchlist button clicked (from Share Detail).");
            // Ensure button is not disabled before proceeding
            if (addToWatchlistBtn.classList.contains('is-disabled-icon')) {
                console.warn("[Add to Watchlist] Button was disabled, preventing action.");
                return; // Do nothing if visually disabled
            }
            if (selectedShareDocId) {
                hideModal(shareDetailModal);
                showAddToWatchlistModal(selectedShareDocId); // Use the currently selected share ID
            } else {
                showCustomAlert("No share selected to add/remove from watchlists.");
            }
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

    // Context Menu Delete Share Button (No confirmation as per user request)
    if (contextDeleteShareBtn) {
        contextDeleteShareBtn.addEventListener('click', async () => {
            console.log("[Context Menu] Delete Share button clicked (No Confirmation).");
            if (currentContextMenuShareId) {
                const shareToDeleteId = currentContextMenuShareId;
                hideContextMenu();
                try {
                    const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, shareToDeleteId);
                    
                    // Remove share from all watchlists it belongs to in user settings
                    const userSettingsDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/user_settings/main_settings`);
                    const settingsSnap = await window.firestore.getDoc(userSettingsDocRef);
                    if (settingsSnap.exists()) {
                        const settings = settingsSnap.data();
                        const currentWatchlists = settings.watchlists || [];
                        currentWatchlists.forEach(watchlist => {
                            if (watchlist.shares && watchlist.shares[shareToDeleteId]) {
                                delete watchlist.shares[shareToDeleteId];
                                console.log(`[Firestore] Removed share ${shareToDeleteId} from watchlist ${watchlist.id} in settings.`);
                            }
                        });
                        await window.firestore.updateDoc(userSettingsDocRef, { watchlists: currentWatchlists });
                    }

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

    // NEW: Context Menu Add/Remove from Watchlist button
    if (contextAddToWatchlistBtn) {
        contextAddToWatchlistBtn.addEventListener('click', () => {
            console.log("[Context Menu] Add/Remove from Watchlist button clicked.");
            if (currentContextMenuShareId) {
                hideContextMenu();
                showAddToWatchlistModal(currentContextMenuShareId);
            } else {
                showCustomAlert("No share selected to add/remove from watchlists.");
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
            showModal(addWatchlistModal);
            newWatchlistNameInput.focus();
            toggleAppSidebar(false);
        });
    }

    // Event listener for newWatchlistNameInput to toggle saveWatchlistBtn
    if (newWatchlistNameInput && saveWatchlistBtn) {
        newWatchlistNameInput.addEventListener('input', () => {
            const isDisabled = newWatchlistNameInput.value.trim() === '';
            setIconDisabled(saveWatchlistBtn, isDisabled);
        });
    }

    // Save Watchlist Button
    if (saveWatchlistBtn) {
        saveWatchlistBtn.addEventListener('click', async () => {
            console.log("[Watchlist Form] Save Watchlist button clicked.");
            // Ensure button is not disabled before proceeding
            if (saveWatchlistBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert("Please enter a watchlist name.");
                console.warn("[Save Watchlist] Save button was disabled, preventing action.");
                return;
            }

            const watchlistName = newWatchlistNameInput.value.trim();
            if (!watchlistName) {
                showCustomAlert("Watchlist name is required!");
                return;
            }
            if (userWatchlists.some(w => w.name.toLowerCase() === watchlistName.toLowerCase())) {
                showCustomAlert("A watchlist with this name already exists!");
                return;
            }

            try {
                const newWatchlistId = window.firestore.doc(window.firestore.collection(db, 'dummy_collection_for_id_gen')).id; // Generate unique ID
                const newWatchlistData = {
                    id: newWatchlistId,
                    name: watchlistName,
                    shares: {}, // Initialize with empty shares map
                    createdAt: new Date().toISOString()
                };

                userWatchlists.push(newWatchlistData); // Add to in-memory array
                await saveUserSettings(); // Save the entire updated userWatchlists array to Firestore

                showCustomAlert(`Watchlist '${watchlistName}' added!`, 1500);
                console.log(`[Firestore] Watchlist '${watchlistName}' added with ID: ${newWatchlistId}`);
                hideModal(addWatchlistModal);
                
                // After adding, select only this new watchlist
                currentSelectedWatchlistIds = [newWatchlistId];
                await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds);
                await loadUserWatchlistsAndSettings(); // This will re-render watchlists and trigger loadShares()
            } catch (error) {
                console.error("[Firestore] Error adding watchlist:", error);
                showCustomAlert("Error adding watchlist: " + error.message);
            }
        });
    }

    // Cancel Add Watchlist Button
    if (cancelAddWatchlistBtn) {
        cancelAddWatchlistBtn.addEventListener('click', () => {
            console.log("[Watchlist] Add Watchlist canceled.");
            hideModal(addWatchlistModal);
            if (newWatchlistNameInput) newWatchlistNameInput.value = '';
        });
    }

    // Edit Watchlist Button
    if (editWatchlistBtn) {
        editWatchlistBtn.addEventListener('click', () => {
            console.log("[UI] Edit Watchlist button clicked.");
            // For editing, we need to pick ONE watchlist. Let's use the currently selected one.
            let watchlistToEditId = watchlistSelect.value;

            if (!watchlistToEditId || !userWatchlists.some(w => w.id === watchlistToEditId)) {
                showCustomAlert("Please select a watchlist to edit.");
                return;
            }
            const selectedWatchlistObj = userWatchlists.find(w => w.id === watchlistToEditId);
            const watchlistToEditName = selectedWatchlistObj ? selectedWatchlistObj.name : '';

            console.log(`[Edit Watchlist Button Click] Watchlist to edit ID: ${watchlistToEditId}, Name: ${watchlistToEditName}`);

            editWatchlistNameInput.value = watchlistToEditName;
            // The delete icon in the modal should still be disabled if it's the last watchlist
            const isDisabledDelete = userWatchlists.length <= 1;
            setIconDisabled(deleteWatchlistInModalBtn, isDisabledDelete); 
            console.log(`[Edit Watchlist] deleteWatchlistInModalBtn disabled: ${isDisabledDelete}`);
            setIconDisabled(saveWatchlistNameBtn, false); // Enable save button initially
            console.log("[Edit Watchlist] saveWatchlistNameBtn enabled initially.");
            showModal(manageWatchlistModal);
            editWatchlistNameInput.focus();
            toggleAppSidebar(false);
        });
    }

    // Event listener for editWatchlistNameInput to toggle saveWatchlistNameBtn
    if (editWatchlistNameInput && saveWatchlistNameBtn) {
        editWatchlistNameInput.addEventListener('input', () => {
            const isDisabled = editWatchlistNameInput.value.trim() === '';
            setIconDisabled(saveWatchlistNameBtn, isDisabled);
        });
    }

    // Save Watchlist Name Button
    if (saveWatchlistNameBtn) {
        saveWatchlistNameBtn.addEventListener('click', async () => {
            console.log("[Manage Watchlist Form] Save Watchlist Name button clicked.");
            // Ensure button is not disabled before proceeding
            if (saveWatchlistNameBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert("Watchlist name cannot be empty.");
                console.warn("[Save Watchlist Name] Save button was disabled, preventing action.");
                return;
            }

            // For editing, we need to pick ONE watchlist. Let's use the currently selected one.
            let watchlistToEditId = watchlistSelect.value;

            const newName = editWatchlistNameInput.value.trim();
            if (!newName) {
                showCustomAlert("Watchlist name cannot be empty!");
                return;
            }
            if (userWatchlists.some(w => w.name.toLowerCase() === newName.toLowerCase() && w.id !== watchlistToEditId)) {
                showCustomAlert("A watchlist with this name already exists!");
                return;
            }

            try {
                // Update the name in the in-memory userWatchlists array
                const watchlistIndex = userWatchlists.findIndex(wl => wl.id === watchlistToEditId);
                if (watchlistIndex > -1) {
                    userWatchlists[watchlistIndex].name = newName;
                    await saveUserSettings(); // Save the entire updated userWatchlists array to Firestore
                } else {
                    console.error(`[Firestore] Watchlist with ID ${watchlistToEditId} not found in memory for renaming.`);
                    showCustomAlert("Error: Watchlist not found in memory.");
                    return;
                }

                showCustomAlert(`Watchlist renamed to '${newName}'!`, 1500);
                console.log(`[Firestore] Watchlist (ID: ${watchlistToEditId}) renamed to '${newName}'.`);
                hideModal(manageWatchlistModal);
                await loadUserWatchlistsAndSettings(); // This will re-render watchlists and trigger loadShares()
            } catch (error) {
                console.error("[Firestore] Error renaming watchlist:", error);
                showCustomAlert("Error renaming watchlist: " + error.message);
            }
        });
    }

    // Delete Watchlist In Modal Button (No confirmation as per user request)
    if (deleteWatchlistInModalBtn) {
        deleteWatchlistInModalBtn.addEventListener('click', async () => {
            console.log("[Manage Watchlist Form] Delete Watchlist button clicked (No Confirmation).");
            // Ensure button is not disabled before proceeding
            if (deleteWatchlistInModalBtn.classList.contains('is-disabled-icon')) {
                console.warn("[Delete Watchlist In Modal] Delete button was disabled, preventing action.");
                return; // Do nothing if visually disabled
            }

            // For deleting, we need to pick ONE watchlist. Let's use the currently selected one.
            let watchlistToDeleteId = watchlistSelect.value;

            if (!watchlistToDeleteId) {
                showCustomAlert("No watchlist selected for deletion.");
                return;
            }
            if (userWatchlists.length <= 1) {
                showCustomAlert("Cannot delete the last watchlist. Please create another watchlist first.");
                return;
            }
            if (watchlistToDeleteId === getDefaultWatchlistId(currentUserId)) {
                showCustomAlert("The default watchlist cannot be deleted.");
                return;
            }

            const watchlistToDeleteName = userWatchlists.find(w => w.id === watchlistToDeleteId)?.name || 'Unknown Watchlist';
            
            try {
                const sharesColRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
                const q = window.firestore.query(sharesColRef, window.firestore.where("watchlistId", "==", watchlistToDeleteId));
                const querySnapshot = await window.firestore.getDocs(q);

                const batch = window.firestore.writeBatch(db);
                querySnapshot.forEach(doc => {
                    // Update shares to remove their watchlistId or reassign to default
                    const shareRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, doc.id);
                    batch.update(shareRef, { watchlistId: getDefaultWatchlistId(currentUserId) }); // Reassign shares to default watchlist
                });
                await batch.commit();
                console.log(`[Firestore] Reassigned ${querySnapshot.docs.length} shares from deleted watchlist '${watchlistToDeleteName}' to default.`);

                // Remove the watchlist from the in-memory array
                userWatchlists = userWatchlists.filter(wl => wl.id !== watchlistToDeleteId);
                
                // If the deleted watchlist was selected, switch to the default watchlist
                if (currentSelectedWatchlistIds.includes(watchlistToDeleteId)) {
                    currentSelectedWatchlistIds = [getDefaultWatchlistId(currentUserId)];
                }

                await saveUserSettings(); // Save the updated userWatchlists array and selected IDs
                console.log(`[Firestore] Watchlist '${watchlistToDeleteName}' (ID: ${watchlistToDeleteId}) deleted from settings.`);

                showCustomAlert(`Watchlist '${watchlistToDeleteName}' deleted and its shares reassigned to default!`, 2000);
                closeModals();

                await loadUserWatchlistsAndSettings(); // Re-render watchlists and trigger loadShares()
            } catch (error) {
                console.error("[Firestore] Error deleting watchlist:", error);
                showCustomAlert("Error deleting watchlist: " + error.message);
            }
        });
    }

    // Cancel Manage Watchlist Button
    if (cancelManageWatchlistBtn) {
        cancelManageWatchlistBtn.addEventListener('click', () => {
            console.log("[Watchlist] Manage Watchlist canceled.");
            hideModal(manageWatchlistModal);
            editWatchlistNameInput.value = '';
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
            // Ensure the clicked element is a calculator button and not disabled
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
                return; // Should not happen if previous checks pass
            }

            if (isNaN(val)) return;

            if (operator && previousCalculatorInput !== '') {
                // If there's a pending operation, calculate percentage of the previous number
                const prevNum = parseFloat(previousCalculatorInput);
                if (isNaN(prevNum)) return;
                currentCalculatorInput = (prevNum * (val / 100)).toString();
            } else {
                // Otherwise, just divide the current input by 100
                currentCalculatorInput = (val / 100).toString();
            }
            resultDisplayed = false; // A new calculation has started or modified
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
            console.log("[Theme] Theme toggle button clicked.");
            currentCustomThemeIndex = (currentCustomThemeIndex + 1);
            if (currentCustomThemeIndex >= CUSTOM_THEMES.length) {
                currentCustomThemeIndex = -1;
                applyTheme('system-default');
            } else {
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

        window.addEventListener('resize', () => {
            console.log("[Window Resize] Resizing window. Closing sidebar if open.");
            const isDesktop = window.innerWidth > 768;
            if (appSidebar.classList.contains('open')) {
                toggleAppSidebar(false); // Close sidebar on resize for consistency
            }
            if (scrollToTopBtn) {
                if (window.innerWidth > 768) {
                    scrollToTopBtn.style.display = 'none';
                } else {
                    window.dispatchEvent(new Event('scroll')); // Re-evaluate visibility on mobile
                }
            }
        });

        // Menu buttons that should close the sidebar
        const menuButtons = appSidebar.querySelectorAll('.menu-button-item');
        menuButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                console.log(`[Sidebar Menu Item Click] Button '${event.currentTarget.textContent.trim()}' clicked.`);
                // Check if the data-action-closes-menu attribute is explicitly set to "false"
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
            toggleAppSidebar(false); // Close sidebar after clicking export
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("script.js (v150) DOMContentLoaded fired."); // Updated version number

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
