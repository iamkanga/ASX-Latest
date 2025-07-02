// File Version: v146
// Last Updated: 2025-07-02 (Added All Watchlists functionality and data migration)

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
const KANGA_EMAIL = 'iamkanga@gmail.0com';
let currentCalculatorInput = '';
let operator = null;
let previousCalculatorInput = '';
let resultDisplayed = false;
const DEFAULT_WATCHLIST_NAME = 'My Watchlist (Default)';
const DEFAULT_WATCHLIST_ID_SUFFIX = 'default';
const ALL_SHARES_OPTION_ID = 'all_shares_option'; // Unique ID for the "All Watchlists" option
let userWatchlists = [];
let currentWatchlistId = null;
let currentWatchlistName = '';
let currentSortOrder = 'entryDate-desc'; // Default sort order, now a global variable
let contextMenuOpen = false; // To track if the custom context menu is open
let currentContextMenuShareId = null; // Stores the ID of the share that opened the context menu

// Theme related variables
const CUSTOM_THEMES = [
    'bold-1', 'bold-2', 'bold-3', 'bold-4', 'bold-5', 'bold-6', 'bold-7', 'bold-8', 'bold-9', 'bold-10',
    'subtle-1', 'subtle-2', 'subtle-3', 'subtle-4', 'subtle-5', 'subtle-6', 'subtle-7', 'subtle-8', 'subtle-9', 'subtle-10'
];
let currentCustomThemeIndex = -1; // To track the current theme in the cycle
let currentActiveTheme = 'system-default'; // Tracks the currently applied theme string (e.g., 'dark', 'bold', 'subtle', 'system-default')

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
const cancelFormBtn = document.getElementById('cancelFormBtn');
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
const modalTargetPrice = document.getElementById('modalTargetPrice');
const modalDividendAmount = document.getElementById('modalDividendAmount');
const modalFrankingCredits = document.getElementById('frankingCredits');
const modalCommentsContainer = document.getElementById('modalCommentsContainer');
const modalUnfrankedYieldSpan = document.getElementById('modalUnfrankedYield');
const modalFrankedYieldSpan = document.getElementById('modalFrankedYield');
const editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn'); // Now a span
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
const saveWatchlistBtn = document.getElementById('saveWatchlistBtn'); // Now a span
const cancelAddWatchlistBtn = document.getElementById('cancelAddWatchlistBtn'); // Now a span
const manageWatchlistModal = document.getElementById('manageWatchlistModal');
const editWatchlistNameInput = document.getElementById('editWatchlistName');
const saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn'); // Now a span
const deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn'); // Now a span
const cancelManageWatchlistBtn = document.getElementById('cancelManageWatchlistBtn'); // Now a span
const shareContextMenu = document.getElementById('shareContextMenu');
const contextEditShareBtn = document.getElementById('contextEditShareBtn');
const contextDeleteShareBtn = document.getElementById('contextDeleteShareBtn');
const logoutBtn = document.getElementById('logoutBtn'); // Now a span
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn'); // Export button

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
    console.log(`[setIconDisabled] Setting ${element.id || element.className} to isDisabled: ${isDisabled}`);
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

function showCustomConfirm(message, onConfirm, onCancel = null) {
    if (!customDialogModal || !customDialogMessage || !customDialogConfirmBtn || !customDialogCancelBtn) {
        console.error("Custom dialog elements not found. Cannot show confirm.");
        const confirmed = window.confirm(message);
        if (confirmed && onConfirm) onConfirm();
        else if (!confirmed && onCancel) onCancel();
        return;
    }
    customDialogMessage.textContent = message;
    // Ensure these icons are always enabled in the confirm dialog
    setIconDisabled(customDialogConfirmBtn, false); // Explicitly enable the tick icon
    customDialogConfirmBtn.style.display = 'block';
    setIconDisabled(customDialogCancelBtn, false); // Explicitly enable the cross icon
    customDialogCancelBtn.style.display = 'block';
    showModal(customDialogModal);
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); }
    customDialogConfirmBtn.onclick = () => { hideModal(customDialogModal); if (onConfirm) onConfirm(); currentDialogCallback = null; };
    customDialogCancelBtn.onclick = () => { hideModal(customDialogModal); if (onCancel) onCancel(); currentDialogCallback = null; };
    currentDialogCallback = () => { hideModal(customDialogModal); if (onCancel) onCancel(); currentDialogCallback = null; };
    console.log(`[Confirm] Showing confirm: "${message}"`);
}

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
    if (watchlistSelect) watchlistSelect.disabled = !enable; 
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
    console.log(`[UI State] Sort Select Disabled: ${sortSelect ? sortSelect.disabled : 'N/A'}`);


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
    if (!watchlistSelect) { console.error("[clearWatchlistUI] watchlistSelect element not found."); return; }
    watchlistSelect.innerHTML = '';
    // Add the "All Watchlists" option back after clearing
    const allSharesOption = document.createElement('option');
    allSharesOption.value = ALL_SHARES_OPTION_ID;
    allSharesOption.textContent = 'All Watchlists';
    watchlistSelect.appendChild(allSharesOption);

    userWatchlists = [];
    renderWatchlistSelect();
    renderSortSelect();
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
    commentSectionDiv.querySelector('.comment-delete-btn').addEventListener('click', (event) => {
        console.log("[Comments] Delete comment button clicked.");
        event.target.closest('.comment-section').remove();
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
    if (deleteShareBtn) {
        deleteShareBtn.classList.add('hidden'); // Hide delete icon when adding new share
        console.log("[clearForm] deleteShareBtn hidden.");
    }
    // Initially disable save button until share name is entered
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
    // Enable save button when opening for edit, as shareName should already be present
    setIconDisabled(saveShareBtn, false);
    console.log("[showEditFormForSelectedShare] saveShareBtn enabled.");
    showModal(shareFormSection);
    shareNameInput.focus();
    console.log(`[Form] Opened edit form for share: ${shareToEdit.shareName} (ID: ${selectedShareDocId})`);
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
    modalUnfrankedYieldSpan.textContent = unfrankedYield !== null ? `${unfrankedYield.toFixed(2)}%` : 'N/A';
    
    const frankedYield = calculateFrankedYield(dividendAmountNum, enteredPriceNum, frankingCreditsNum);
    modalFrankedYieldSpan.textContent = frankedYield !== null ? `${frankedYield.toFixed(2)}%` : 'N/A';
    
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

    // Ensure external links are always enabled and visible if shareName exists
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

    // Ensure editShareFromDetailBtn is enabled when showing details
    setIconDisabled(editShareFromDetailBtn, false);

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
    watchlistSelect.innerHTML = '';
    
    // Always add the "All Watchlists" option first
    const allSharesOption = document.createElement('option');
    allSharesOption.value = ALL_SHARES_OPTION_ID;
    allSharesOption.textContent = 'All Watchlists';
    watchlistSelect.appendChild(allSharesOption);

    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Select Watchlist'; // Changed for clarity
    placeholderOption.disabled = true;
    placeholderOption.selected = true; 
    watchlistSelect.appendChild(placeholderOption);

    if (userWatchlists.length === 0) {
        watchlistSelect.disabled = true;
        // If no user-defined watchlists, select "All Watchlists" by default
        watchlistSelect.value = ALL_SHARES_OPTION_ID;
        currentWatchlistId = ALL_SHARES_OPTION_ID;
        currentWatchlistName = 'All Watchlists';
        console.log("[UI Update] No user watchlists, defaulting to 'All Watchlists'.");
        return;
    }
    userWatchlists.forEach(watchlist => {
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        watchlistSelect.appendChild(option);
    });

    // Set the dropdown to the currentWatchlistId if it exists and is valid
    if (currentWatchlistId && (currentWatchlistId === ALL_SHARES_OPTION_ID || userWatchlists.some(w => w.id === currentWatchlistId))) {
        watchlistSelect.value = currentWatchlistId;
        console.log(`[UI Update] Watchlist dropdown set to: ${currentWatchlistName} (ID: ${currentWatchlistId})`);
    } else {
        // Fallback: If no valid currentWatchlistId, default to "All Watchlists"
        watchlistSelect.value = ALL_SHARES_OPTION_ID;
        currentWatchlistId = ALL_SHARES_OPTION_ID;
        currentWatchlistName = 'All Watchlists';
        console.warn(`[UI Update] currentWatchlistId was null/invalid, fallback to 'All Watchlists'.`);
    }
    
    watchlistSelect.disabled = false;
    console.log("[UI Update] Watchlist select rendered. Watchlist select disabled: ", watchlistSelect.disabled);
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

    if (currentUserId && currentSortOrder && Array.from(sortSelect.options).some(option => option.value === currentSortOrder)) {
        sortSelect.value = currentSortOrder; // Set the select element's value
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
    
    // Double click / Tap for details
    let lastClickTime = 0;
    row.addEventListener('click', (event) => { 
        console.log(`[Table Row Click] Single click detected for ID: ${share.id}.`);
        if (selectedShareDocId === share.id) { // If already selected, open details on second click (acting as double click)
            const currentTime = new Date().getTime();
            if (currentTime - lastClickTime < 300) { // Check for double click within 300ms
                console.log(`[Table Row Click] Double click detected for ID: ${share.id}. Showing details.`);
                showShareDetails();
                lastClickTime = 0; // Reset
            } else {
                lastClickTime = currentTime;
                console.log(`[Table Row Click] First click in potential double-click sequence for ID: ${share.id}.`);
            }
        }
        selectShare(share.id); // Always select on click
    });

    // Mobile long press to open context menu or details
    let pressTimer;
    row.addEventListener('touchstart', (e) => {
        if (window.innerWidth >= 768) return; // Only for mobile
        e.preventDefault(); // Prevent default touch behavior (like scrolling)
        console.log("[Touch] Touch start detected.");
        selectedElementForTap = row;
        pressTimer = setTimeout(() => {
            console.log("[Touch] Long press detected. Showing context menu.");
            selectShare(share.id);
            showContextMenu(e, share.id);
            selectedElementForTap = null; // Reset after use
        }, LONG_PRESS_THRESHOLD);
    });
    row.addEventListener('touchend', () => {
        if (window.innerWidth >= 768) return; // Only for mobile
        console.log("[Touch] Touch end detected. Clearing press timer.");
        clearTimeout(pressTimer);
    });
    row.addEventListener('touchmove', () => {
        if (window.innerWidth >= 768) return; // Only for mobile
        console.log("[Touch] Touch move detected. Clearing press timer (movement cancelled long press).");
        clearTimeout(pressTimer);
    });

    // Right-click for context menu (desktop)
    row.addEventListener('contextmenu', (e) => {
        if (window.innerWidth < 768) return; // Only for desktop
        e.preventDefault(); // Prevent default browser context menu
        console.log("[Context Menu] Right-click detected. Showing context menu.");
        selectShare(share.id);
        showContextMenu(e, share.id);
    });
    
    const enteredPriceNum = Number(share.currentPrice); // Using currentPrice as enteredPrice
    const targetPriceNum = Number(share.targetPrice);
    const dividendAmountNum = Number(share.dividendAmount);
    const frankingCreditsNum = Number(share.frankingCredits);

    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, enteredPriceNum);
    const frankedYield = calculateFrankedYield(dividendAmountNum, enteredPriceNum, frankingCreditsNum);

    const formatNumber = (num, decimals) => (num !== null && !isNaN(num)) ? num.toFixed(decimals) : 'N/A';
    const formatCurrency = (num) => (num !== null && !isNaN(num)) ? `$${num.toFixed(2)}` : 'N/A';
    const formatPercentage = (num) => (num !== null && !isNaN(num)) ? `${num.toFixed(2)}%` : 'N/A';
    const formatFrankingPercentage = (num) => (num !== null && !isNaN(num)) ? `${num.toFixed(1)}%` : 'N/A';

    row.insertCell().textContent = share.shareName || 'N/A';
    row.insertCell().textContent = formatCurrency(enteredPriceNum); // Current Price (used for Entered Price too)
    row.insertCell().textContent = formatCurrency(targetPriceNum);
    row.insertCell().textContent = formatNumber(dividendAmountNum, 3);
    row.insertCell().textContent = formatFrankingPercentage(frankingCreditsNum);
    row.insertCell().textContent = formatPercentage(unfrankedYield);
    row.insertCell().textContent = formatPercentage(frankedYield);
    row.insertCell().textContent = formatCurrency(enteredPriceNum); // Entered Price (same as current for now)
    row.insertCell().textContent = formatDate(share.entryDate) || 'N/A';
    row.insertCell().textContent = formatDateTime(share.lastPriceUpdate) || 'N/A';

    const actionCell = row.insertCell();
    actionCell.className = 'table-actions';
    actionCell.innerHTML = `
        <span class="edit-icon" data-doc-id="${share.id}" aria-label="Edit Share">
            <i class="fas fa-edit"></i>
        </span>
        <span class="delete-icon" data-doc-id="${share.id}" aria-label="Delete Share">
            <i class="fas fa-trash-alt"></i>
        </span>
    `;

    // Add event listeners for the action icons directly to the spans
    actionCell.querySelector('.edit-icon').addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent row click from firing
        console.log(`[Table Action] Edit icon clicked for ID: ${share.id}`);
        selectShare(share.id);
        showEditFormForSelectedShare(share.id);
    });
    actionCell.querySelector('.delete-icon').addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent row click from firing
        console.log(`[Table Action] Delete icon clicked for ID: ${share.id}`);
        showCustomConfirm(`Are you sure you want to delete ${share.shareName}?`, 
            () => deleteShare(share.id, share.watchlistId), // Pass watchlistId for specific deletion
            () => console.log("[Delete] Deletion cancelled by user.")
        );
    });
    console.log(`[Table Render] Added share ${share.shareName} to table.`);
}

function addShareToMobileCards(share) {
    if (!mobileShareCardsContainer) { console.error("[addShareToMobileCards] mobileShareCardsContainer element not found."); return; }
    const card = document.createElement('div');
    card.className = 'mobile-card';
    card.dataset.docId = share.id;

    // Mobile double tap or long press for details/context menu
    let lastTapTime = 0;
    let longPressTimer;
    card.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent default touch behavior (like scrolling)
        console.log("[Mobile Card Touch] Touch start detected.");
        selectedElementForTap = card; // Store the element for potential long press
        longPressTimer = setTimeout(() => {
            console.log("[Mobile Card Touch] Long press detected. Showing context menu.");
            selectShare(share.id);
            showContextMenu(e, share.id);
            selectedElementForTap = null; // Reset after use
        }, LONG_PRESS_THRESHOLD);
    }, { passive: false }); // Use passive: false to allow preventDefault

    card.addEventListener('touchend', (e) => {
        console.log("[Mobile Card Touch] Touch end detected. Clearing long press timer.");
        clearTimeout(longPressTimer);
        if (selectedElementForTap === card) { // Check if this was the element initially tapped
            const currentTime = new Date().getTime();
            if (currentTime - lastTapTime < 300) { // Double tap detected
                console.log("[Mobile Card Touch] Double tap detected. Showing details.");
                selectShare(share.id);
                showShareDetails();
                lastTapTime = 0; // Reset for next sequence
            } else {
                console.log("[Mobile Card Touch] Single tap (first tap of potential double) detected.");
                lastTapTime = currentTime;
            }
        }
        selectedElementForTap = null; // Clear on touch end
    });

    card.addEventListener('touchmove', () => {
        console.log("[Mobile Card Touch] Touch move detected. Clearing long press timer (movement cancelled long press).");
        clearTimeout(longPressTimer);
        selectedElementForTap = null; // Clear if finger moves
    });

    const enteredPriceNum = Number(share.currentPrice);
    const dividendAmountNum = Number(share.dividendAmount);
    const frankingCreditsNum = Number(share.frankingCredits);

    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, enteredPriceNum);
    const frankedYield = calculateFrankedYield(dividendAmountNum, enteredPriceNum, frankingCreditsNum);

    const formatCurrency = (num) => (num !== null && !isNaN(num)) ? `$${num.toFixed(2)}` : 'N/A';
    const formatPercentage = (num) => (num !== null && !isNaN(num)) ? `${num.toFixed(2)}%` : 'N/A';

    card.innerHTML = `
        <div class="card-header">
            <h3>${share.shareName || 'N/A'}</h3>
            <span class="card-edit-icon" data-doc-id="${share.id}" aria-label="Edit Share">
                <i class="fas fa-edit"></i>
            </span>
        </div>
        <div class="card-body">
            <p><strong>Current Price:</strong> ${formatCurrency(enteredPriceNum)}</p>
            <p><strong>Target Price:</strong> ${formatCurrency(Number(share.targetPrice))}</p>
            <p><strong>Dividend:</strong> ${Number(share.dividendAmount) !== null && !isNaN(Number(share.dividendAmount)) ? Number(share.dividendAmount).toFixed(3) : 'N/A'}</p>
            <p><strong>Franking:</strong> ${Number(share.frankingCredits) !== null && !isNaN(Number(share.frankingCredits)) ? `${Number(share.frankingCredits).toFixed(1)}%` : 'N/A'}</p>
            <p><strong>Unfranked Yield:</strong> ${formatPercentage(unfrankedYield)}</p>
            <p><strong>Franked Yield:</strong> ${formatPercentage(frankedYield)}</p>
            <p><strong>Entry Date:</strong> ${formatDate(share.entryDate) || 'N/A'}</p>
            <p><strong>Last Price Update:</strong> ${formatDateTime(share.lastPriceUpdate) || 'N/A'}</p>
        </div>
    `;
    mobileShareCardsContainer.appendChild(card);

    card.querySelector('.card-edit-icon').addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent card tap/double-tap from firing
        console.log(`[Mobile Card Action] Edit icon clicked for ID: ${share.id}`);
        selectShare(share.id);
        showEditFormForSelectedShare(share.id);
    });
    console.log(`[Mobile Render] Added share ${share.shareName} to mobile cards.`);
}

/**
 * Renders the watchlist based on the currentWatchlistId.
 */
function renderWatchlist() {
    console.log(`[Render] Rendering watchlist for currentWatchlistId: ${currentWatchlistId} (Name: ${currentWatchlistName})`);
    clearShareListUI(); // Clear UI first
    
    let sharesToDisplay = [];
    if (currentWatchlistId === ALL_SHARES_OPTION_ID) {
        sharesToDisplay = [...allSharesData]; // Display all shares for the user
        console.log("[Render] Displaying all shares for the user.");
    } else {
        sharesToDisplay = allSharesData.filter(share => share.watchlistId === currentWatchlistId);
        console.log(`[Render] Displaying shares for specific watchlist: ${currentWatchlistId}.`);
    }

    if (sharesToDisplay.length === 0) {
        // Display message if watchlist is empty
        const emptyWatchlistMessage = document.createElement('p');
        emptyWatchlistMessage.textContent = `This watchlist is currently empty. Add a new share to get started!`;
        emptyWatchlistMessage.style.textAlign = 'center';
        emptyWatchlistMessage.style.padding = '20px';
        emptyWatchlistMessage.style.color = 'var(--ghosted-text)';
        const td = document.createElement('td');
        td.colSpan = 10; // Span all columns in the table (adjust if table columns change)
        td.appendChild(emptyWatchlistMessage);
        const tr = document.createElement('tr');
        tr.appendChild(td);
        shareTableBody.appendChild(tr); // For table
        mobileShareCardsContainer.appendChild(emptyWatchlistMessage.cloneNode(true)); // For mobile cards
    } else {
        sharesToDisplay.forEach((share) => {
            addShareToTable(share);
            addShareToMobileCards(share); 
        });
    }

    if (selectedShareDocId) {
         const stillExists = sharesToDisplay.some(share => share.id === selectedShareDocId);
         if (stillExists) {
            selectShare(selectedShareDocId);
         } else {
            deselectCurrentShare();
         }
    }
    renderAsxCodeButtons(); // Re-render ASX buttons based on the filtered shares
    console.log("[Render] Watchlist rendering complete.");
}


// --- CRUD OPERATIONS (Firestore Interactions) ---

async function saveShare() {
    if (!currentUserId || !db || !currentWatchlistId) {
        showCustomAlert("Please sign in and select a watchlist to save shares.", 3000);
        console.error("[Save] Not authenticated or no watchlist selected.");
        return;
    }
    if (!shareNameInput.value.trim()) {
        showCustomAlert("Share name cannot be empty.", 1500);
        console.warn("[Save] Share name is empty.");
        return;
    }

    // If 'All Watchlists' is selected, we need to ensure a specific watchlist is chosen
    if (currentWatchlistId === ALL_SHARES_OPTION_ID) {
        showCustomAlert("Please select a specific watchlist to add or edit a share.", 2500);
        console.warn("[Save] Cannot save share when 'All Watchlists' is selected.");
        return;
    }

    setIconDisabled(saveShareBtn, true); // Disable save button during operation
    loadingIndicator.style.display = 'block';

    const shareData = {
        shareName: shareNameInput.value.trim().toUpperCase(),
        currentPrice: parseFloat(currentPriceInput.value) || null,
        targetPrice: parseFloat(targetPriceInput.value) || null,
        dividendAmount: parseFloat(dividendAmountInput.value) || null,
        frankingCredits: parseFloat(frankingCreditsInput.value) || null,
        comments: [],
        lastPriceUpdate: new Date().toISOString(), // Use ISO string for consistent date handling
        watchlistId: currentWatchlistId, // Store watchlist ID on the share for easier querying
        userId: currentUserId, // Crucial for collection group queries
        version: 1 // Initial version for new shares
    };

    // Gather comments
    document.querySelectorAll('.comment-section').forEach(section => {
        const titleInput = section.querySelector('.comment-title-input');
        const textInput = section.querySelector('.comment-text-input');
        if (titleInput.value.trim() || textInput.value.trim()) {
            shareData.comments.push({
                title: titleInput.value.trim(),
                text: textInput.value.trim()
            });
        }
    });

    try {
        if (selectedShareDocId) {
            // Update existing share
            const shareRef = firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, selectedShareDocId);
            // Increment version when updating
            shareData.version = (allSharesData.find(s => s.id === selectedShareDocId)?.version || 0) + 1;
            await firestore.setDoc(shareRef, shareData, { merge: true }); // Use setDoc with merge for partial updates
            showCustomAlert("Share updated successfully!", 1500);
            console.log(`[Firestore] Share updated: ${shareData.shareName} (ID: ${selectedShareDocId})`);
        } else {
            // Add new share
            shareData.entryDate = new Date().toISOString(); // Set entry date only for new shares
            const docRef = await firestore.addDoc(firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`), shareData);
            showCustomAlert("Share added successfully!", 1500);
            console.log(`[Firestore] New share added with ID: ${docRef.id}`);
        }
        closeModals();
        clearForm();
    } catch (e) {
        console.error("Error saving share: ", e);
        showCustomAlert("Error saving share. Please try again.", 2000);
    } finally {
        setIconDisabled(saveShareBtn, false); // Re-enable save button
        loadingIndicator.style.display = 'none';
    }
}

async function deleteShare(shareId, watchlistId) {
    if (!currentUserId || !db) {
        showCustomAlert("Please sign in to delete shares.", 3000);
        console.error("[Delete] Not authenticated.");
        return;
    }
    if (!watchlistId) {
        showCustomAlert("Cannot delete share: Watchlist ID is missing. Please try editing the share first and re-saving.", 3000);
        console.error(`[Delete] Cannot delete share ${shareId}: watchlistId is missing.`);
        return;
    }

    loadingIndicator.style.display = 'block';
    try {
        await firestore.deleteDoc(firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, shareId));
        showCustomAlert("Share deleted successfully!", 1500);
        console.log(`[Firestore] Share deleted: ${shareId} from watchlist: ${watchlistId}`);
        closeModals();
        clearForm(); // Clear form if the deleted share was being edited
    } catch (e) {
        console.error("Error deleting share: ", e);
        showCustomAlert("Error deleting share. Please try again.", 2000);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}


// --- DATA MIGRATION LOGIC ---
/**
 * Migrates old share documents to include a 'userId' field.
 * This is crucial for enabling collection group queries (e.g., "All Watchlists").
 * This function should run once per user.
 */
async function migrateSharesData() {
    if (!currentUserId || !db || !window.firestore) {
        console.warn("[Migration] Not authenticated or Firestore not available, skipping data migration.");
        return;
    }

    const userSettingsRef = window.firestore.doc(db, `userSettings`, currentUserId);
    const userSettingsSnap = await window.firestore.getDoc(userSettingsRef);
    const migrationStatus = userSettingsSnap.exists() ? userSettingsSnap.data().sharesMigrationDone : false;

    if (migrationStatus) {
        console.log("[Migration] Shares data migration already completed for this user.");
        return;
    }

    console.log("[Migration] Starting shares data migration for user:", currentUserId);
    loadingIndicator.style.display = 'block';

    try {
        const sharesCollectionRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
        const sharesSnapshot = await window.firestore.getDocs(sharesCollectionRef);
        
        if (!sharesSnapshot.empty) {
            const batch = window.firestore.writeBatch(db);
            let sharesUpdatedInBatch = 0;

            sharesSnapshot.forEach(shareDoc => {
                const shareData = shareDoc.data();
                if (!shareData.userId) { // Only update if userId is missing
                    batch.update(shareDoc.ref, { userId: currentUserId });
                    sharesUpdatedInBatch++;
                }
            });

            if (sharesUpdatedInBatch > 0) {
                await batch.commit();
                console.log(`[Migration] Updated ${sharesUpdatedInBatch} shares with userId.`);
            }
        }

        // Mark migration as complete in user settings
        await window.firestore.setDoc(userSettingsRef, { sharesMigrationDone: true }, { merge: true });
        console.log("[Migration] Shares data migration completed successfully for user:", currentUserId);
    } catch (error) {
        console.error("[Migration] Error during shares data migration:", error);
        showCustomAlert("An error occurred during data migration. Some features might not work correctly. Please contact support.", 5000);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}


// --- CALCULATOR LOGIC ---

const COMPANY_TAX_RATE = 0.30; // Australian company tax rate for franking credit calculations

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
    // Calculate the gross-up amount for franking credits
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

function updateYields() {
    const price = parseFloat(calcCurrentPriceInput.value);
    const dividend = parseFloat(calcDividendAmountInput.value);
    const franking = parseFloat(calcFrankingCreditsInput.value);

    const unfranked = calculateUnfrankedYield(dividend, price);
    const franked = calculateFrankedYield(dividend, price, franking);

    calcUnfrankedYieldSpan.textContent = unfranked !== null ? `${unfranked.toFixed(2)}%` : 'N/A';
    calcFrankedYieldSpan.textContent = franked !== null ? `${franked.toFixed(2)}%` : 'N/A';
    
    calculateEstimatedDividend(); // Update estimated dividend whenever yields update
}

// Universal Calculator Logic
function setupCalculator() {
    const buttons = [
        'C', 'CE', '/', '*',
        '7', '8', '9', '-',
        '4', '5', '6', '+',
        '1', '2', '3', '=',
        '0', '.',
    ];

    calculatorButtons.innerHTML = '';
    buttons.forEach(text => {
        const button = document.createElement('button');
        button.textContent = text;
        button.classList.add('calc-button');
        if (['C', 'CE', '=', '/', '*', '-', '+'].includes(text)) {
            button.classList.add('operator');
        }
        button.addEventListener('click', () => handleCalculatorInput(text));
        calculatorButtons.appendChild(button);
    });
}

function handleCalculatorInput(value) {
    if (value === 'C') { // Clear all
        currentCalculatorInput = '';
        operator = null;
        previousCalculatorInput = '';
        resultDisplayed = false;
        calculatorInput.textContent = '';
        calculatorResult.textContent = '0';
        return;
    }

    if (value === 'CE') { // Clear Entry
        currentCalculatorInput = '';
        resultDisplayed = false;
        calculatorInput.textContent = previousCalculatorInput + (operator ? ` ${operator} ` : '');
        calculatorResult.textContent = '0';
        return;
    }

    if (['/', '*', '-', '+'].includes(value)) {
        if (currentCalculatorInput === '' && previousCalculatorInput !== '') {
            operator = value;
            calculatorInput.textContent = `${previousCalculatorInput} ${operator}`;
            return;
        }
        if (currentCalculatorInput === '') return;
        if (previousCalculatorInput !== '' && operator) {
            evaluateExpression();
            previousCalculatorInput = calculatorResult.textContent;
        } else {
            previousCalculatorInput = currentCalculatorInput;
        }
        operator = value;
        currentCalculatorInput = '';
        calculatorInput.textContent = `${previousCalculatorInput} ${operator}`;
        resultDisplayed = false;
        return;
    }

    if (value === '=') {
        if (previousCalculatorInput === '' || currentCalculatorInput === '' || !operator) return;
        evaluateExpression();
        operator = null;
        previousCalculatorInput = '';
        resultDisplayed = true;
        return;
    }

    if (resultDisplayed) {
        currentCalculatorInput = value;
        resultDisplayed = false;
    } else {
        if (value === '.' && currentCalculatorInput.includes('.')) return;
        currentCalculatorInput += value;
    }
    calculatorInput.textContent = `${previousCalculatorInput} ${operator ? operator : ''} ${currentCalculatorInput}`;
    if (currentCalculatorInput !== '') {
        try { // Live evaluation for current input, if possible
            const tempResult = eval(currentCalculatorInput);
            if (!isNaN(tempResult)) {
                calculatorResult.textContent = tempResult;
            }
        } catch (e) {
            // Ignore syntax errors during live evaluation
        }
    } else {
        calculatorResult.textContent = previousCalculatorInput || '0';
    }
}

function evaluateExpression() {
    try {
        const expression = `${previousCalculatorInput} ${operator} ${currentCalculatorInput}`;
        const result = eval(expression);
        calculatorResult.textContent = result;
        currentCalculatorInput = String(result);
    } catch (e) {
        calculatorResult.textContent = 'Error';
        currentCalculatorInput = '';
        console.error("Calculator evaluation error:", e);
    }
}

function resetCalculator() {
    currentCalculatorInput = '';
    operator = null;
    previousCalculatorInput = '';
    resultDisplayed = false;
    if (calculatorInput) calculatorInput.textContent = '';
    if (calculatorResult) calculatorResult.textContent = '0';
    if (calcCurrentPriceInput) calcCurrentPriceInput.value = '';
    if (calcDividendAmountInput) calcDividendAmountInput.value = '';
    if (calcFrankingCreditsInput) calcFrankingCreditsInput.value = '';
    if (calcUnfrankedYieldSpan) calcUnfrankedYieldSpan.textContent = '0.00%';
    if (calcFrankedYieldSpan) calcFrankedYieldSpan.textContent = '0.00%';
    if (investmentValueSelect) investmentValueSelect.value = '';
    if (calcEstimatedDividend) calcEstimatedDividend.textContent = '$0.00';
    console.log("[Calculator] Resetting calculator state and UI.");
}


// --- THEME MANAGEMENT ---

function applyTheme(themeName) {
    console.log(`[Theme] Attempting to apply theme: ${themeName}`);
    document.body.classList.remove('dark-theme', ...CUSTOM_THEMES.map(t => `theme-${t}`)); // Remove all possible themes
    document.documentElement.removeAttribute('data-theme'); // Reset data-theme attribute

    currentActiveTheme = 'system-default'; // Default
    currentCustomThemeIndex = -1; // Reset custom theme index

    if (themeName === 'dark') {
        document.body.classList.add('dark-theme');
        currentActiveTheme = 'dark';
        console.log("[Theme] Dark theme applied.");
    } else if (CUSTOM_THEMES.includes(themeName)) {
        document.body.classList.add(`theme-${themeName}`); // Add specific custom-theme class
        document.documentElement.setAttribute('data-theme', themeName); // Set specific custom theme via data attribute
        currentActiveTheme = themeName;
        currentCustomThemeIndex = CUSTOM_THEMES.indexOf(themeName);
        console.log(`[Theme] Custom theme "${themeName}" applied (Index: ${currentCustomThemeIndex}).`);
    } else {
        // This handles 'system-default' or any unrecognized theme
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
            document.body.classList.add('dark-theme');
        }
        console.log("[Theme] System default theme applied (or unknown theme specified).");
    }
    // Save current theme preference
    if (currentUserId) {
        saveUserSettings({ theme: currentActiveTheme });
    }
    updateThemeToggleAndSelector();
}

function toggleTheme() {
    console.log("[Theme] Toggling theme.");
    if (currentActiveTheme === 'dark') {
        applyTheme('system-default');
    } else {
        applyTheme('dark');
    }
}

function cycleCustomThemes() {
    console.log("[Theme] Cycling custom themes.");
    currentCustomThemeIndex = (currentCustomThemeIndex + 1) % CUSTOM_THEMES.length;
    applyTheme(CUSTOM_THEMES[currentCustomThemeIndex]);
}

function revertToDefaultTheme() {
    console.log("[Theme] Reverting to default theme.");
    applyTheme('system-default');
}

function updateThemeToggleAndSelector() {
    if (colorThemeSelect) {
        if (CUSTOM_THEMES.includes(currentActiveTheme)) {
            colorThemeSelect.value = currentActiveTheme;
        } else {
            colorThemeSelect.value = 'none'; // "No Custom Theme"
        }
        console.log(`[Theme UI] Color theme select updated to: ${colorThemeSelect.value}`);
    }
}


// --- WATCHLIST MANAGEMENT ---

async function saveWatchlist(name, id = null) {
    if (!currentUserId || !db) {
        showCustomAlert("Please sign in to manage watchlists.", 3000);
        console.error("[Watchlist] Not authenticated to save watchlist.");
        return;
    }
    if (!name.trim()) {
        showCustomAlert("Watchlist name cannot be empty.", 1500);
        console.warn("[Watchlist] Watchlist name is empty.");
        return;
    }
    loadingIndicator.style.display = 'block';

    const watchlistData = {
        name: name.trim(),
        createdAt: new Date().toISOString(),
        userId: currentUserId // Add userId to watchlist document for potential future queries
    };

    try {
        if (id) {
            // Update existing watchlist
            const watchlistRef = firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`, id);
            await firestore.setDoc(watchlistRef, watchlistData, { merge: true });
            showCustomAlert("Watchlist updated successfully!", 1500);
            console.log(`[Firestore] Watchlist updated: ${name} (ID: ${id})`);
        } else {
            // Add new watchlist
            const docRef = await firestore.addDoc(firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`), watchlistData);
            showCustomAlert("Watchlist added successfully!", 1500);
            console.log(`[Firestore] New watchlist added with ID: ${docRef.id}`);
            // Automatically select the new watchlist
            currentWatchlistId = docRef.id;
            currentWatchlistName = name.trim();
            saveUserSettings({ lastWatchlistId: currentWatchlistId, lastWatchlistName: currentWatchlistName });
        }
        closeModals();
        loadUserWatchlistsAndSettings(); // Reload watchlists and settings to update UI
    } catch (e) {
        console.error("Error saving watchlist: ", e);
        showCustomAlert("Error saving watchlist. Please try again.", 2000);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

async function deleteWatchlist(id) {
    if (!currentUserId || !db) {
        showCustomAlert("Please sign in to manage watchlists.", 3000);
        console.error("[Watchlist] Not authenticated to delete watchlist.");
        return;
    }
    if (id === getDefaultWatchlistId(currentUserId)) {
        showCustomAlert("The default watchlist cannot be deleted.", 2500);
        console.warn("[Watchlist] Attempted to delete default watchlist.");
        return;
    }
    loadingIndicator.style.display = 'block';
    try {
        // Start a batch to delete all shares within the watchlist subcollection
        const batch = firestore.writeBatch(db);
        const sharesCollectionRef = firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
        const sharesToDeleteQuery = firestore.query(sharesCollectionRef, firestore.where('watchlistId', '==', id));
        const sharesSnapshot = await firestore.getDocs(sharesToDeleteQuery);

        sharesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete the watchlist document itself
        const watchlistRef = firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`, id);
        batch.delete(watchlistRef);

        await batch.commit();

        showCustomAlert("Watchlist and its shares deleted!", 1500);
        console.log(`[Firestore] Watchlist deleted: ${id}`);
        closeModals();
        // After deletion, re-load watchlists and settings. This will effectively
        // switch to the default watchlist if the deleted one was current.
        loadUserWatchlistsAndSettings();
    } catch (e) {
        console.error("Error deleting watchlist: ", e);
        showCustomAlert("Error deleting watchlist. Please try again.", 2000);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

async function loadUserWatchlistsAndSettings() {
    if (!currentUserId || !db || !window.firestore) {
        console.warn("[Load Settings] Not authenticated, cannot load watchlists or settings.");
        clearWatchlistUI();
        clearShareList();
        updateMainButtonsState(false);
        return;
    }

    loadingIndicator.style.display = 'block';
    try {
        // Run data migration first
        await migrateSharesData();

        const watchlistsCollectionRef = firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`);
        const userWatchlistsSnapshot = await firestore.getDocs(watchlistsCollectionRef);
        userWatchlists = [];

        if (userWatchlistsSnapshot.empty) {
            // If no watchlists exist, create a default one
            console.log("[Load Settings] No watchlists found, creating default.");
            const defaultWatchlistId = getDefaultWatchlistId(currentUserId);
            const defaultWatchlistRef = firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`, defaultWatchlistId);
            await firestore.setDoc(defaultWatchlistRef, {
                name: DEFAULT_WATCHLIST_NAME,
                createdAt: new Date().toISOString(),
                userId: currentUserId // Add userId to default watchlist document
            });
            userWatchlists.push({ id: defaultWatchlistId, name: DEFAULT_WATCHLIST_NAME });
            currentWatchlistId = defaultWatchlistId;
            currentWatchlistName = DEFAULT_WATCHLIST_NAME;
            console.log("[Load Settings] Default watchlist created and set as current.");
        } else {
            userWatchlistsSnapshot.forEach(doc => {
                userWatchlists.push({ id: doc.id, name: doc.data().name });
            });
            // Sort watchlists alphabetically by name
            userWatchlists.sort((a, b) => a.name.localeCompare(b.name));

            // Load user settings to get last selected watchlist and sort order
            const userSettingsRef = firestore.doc(db, 'userSettings', currentUserId);
            const userSettingsSnap = await firestore.getDoc(userSettingsRef);
            if (userSettingsSnap.exists()) {
                const settings = userSettingsSnap.data();
                currentSortOrder = settings.sortOrder || 'entryDate-desc';
                applyTheme(settings.theme || 'system-default');

                // Try to set the last active watchlist
                if (settings.lastWatchlistId && (settings.lastWatchlistId === ALL_SHARES_OPTION_ID || userWatchlists.some(w => w.id === settings.lastWatchlistId))) {
                    currentWatchlistId = settings.lastWatchlistId;
                    currentWatchlistName = settings.lastWatchlistName || userWatchlists.find(w => w.id === currentWatchlistId)?.name || 'All Watchlists';
                    console.log(`[Load Settings] Loaded last watchlist: ${currentWatchlistName} (ID: ${currentWatchlistId})`);
                } else {
                    // Fallback to "All Watchlists" if lastWatchlistId is invalid or not set
                    currentWatchlistId = ALL_SHARES_OPTION_ID;
                    currentWatchlistName = 'All Watchlists';
                    console.warn(`[Load Settings] lastWatchlistId invalid or not set, fallback to 'All Watchlists'.`);
                }
            } else {
                // No settings found, use defaults
                console.log("[Load Settings] No user settings found, applying defaults.");
                currentSortOrder = 'entryDate-desc';
                applyTheme('system-default');
                // Default to "All Watchlists" if no settings
                currentWatchlistId = ALL_SHARES_OPTION_ID;
                currentWatchlistName = 'All Watchlists';
            }
        }
        
        renderWatchlistSelect(); // Populate the dropdown
        renderSortSelect(); // Populate sort dropdown
        updateMainButtonsState(true); // Enable buttons once loaded
        await loadShares(); // Load shares for the selected watchlist (or all shares)

        // After successfully loading watchlists, check if editWatchlistBtn should be disabled
        if (editWatchlistBtn) {
            editWatchlistBtn.disabled = userWatchlists.length === 0;
            console.log(`[UI State] Edit Watchlist Btn Disabled: ${editWatchlistBtn.disabled}`);
        }

    } catch (e) {
        console.error("Error loading user watchlists and settings: ", e);
        showCustomAlert("Error loading your data. Please try again.", 3000);
        updateMainButtonsState(false);
        clearWatchlistUI();
        clearShareList();
    } finally {
        loadingIndicator.style.display = 'none';
        console.log("[Load Settings] Finished loading user watchlists and settings.");
    }
}

async function saveUserSettings(settings = {}) {
    if (!currentUserId || !db || !window.firestore) {
        console.warn("[Save Settings] Not authenticated, cannot save settings.");
        return;
    }
    try {
        const userSettingsRef = window.firestore.doc(db, 'userSettings', currentUserId);
        await window.firestore.setDoc(userSettingsRef, settings, { merge: true });
        console.log("[Save Settings] User settings saved successfully:", settings);
    } catch (e) {
        console.error("Error saving user settings: ", e);
    }
}

/**
 * Sets up a real-time Firestore listener for shares.
 * If `ALL_SHARES_OPTION_ID` is selected, it uses a collection group query.
 * Otherwise, it queries shares within a specific watchlist.
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
        let sharesQuery;
        if (currentWatchlistId === ALL_SHARES_OPTION_ID) {
            // Query all shares for the current user using a collection group query
            // This requires a Firestore index: `shares` collection, ordered by `userId` (Ascending)
            // and then by `shareName` (Ascending) for example.
            sharesQuery = window.firestore.query(
                window.firestore.collectionGroup(db, 'shares'),
                window.firestore.where('userId', '==', currentUserId)
            );
            console.log("[Firestore Query] Querying ALL shares for user:", currentUserId);
        } else {
            // Query shares within a specific watchlist
            sharesQuery = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
            sharesQuery = window.firestore.query(sharesQuery, window.firestore.where("watchlistId", "==", currentWatchlistId));
            console.log(`[Firestore Query] Querying shares for specific watchlist: ${currentWatchlistId}`);
        }
        
        // Set up the real-time listener
        unsubscribeShares = window.firestore.onSnapshot(sharesQuery, (querySnapshot) => {
            console.log("[Firestore Listener] Shares snapshot received. Processing changes.");
            allSharesData = []; // Clear existing data
            querySnapshot.forEach((doc) => {
                const share = { id: doc.id, ...doc.data() };
                allSharesData.push(share);
            });
            console.log(`[Shares] Shares data updated from snapshot. Total shares: ${allSharesData.length}`);
            
            // Re-sort and re-render UI after data update
            sortShares(); // This will call renderWatchlist() internally
            // renderAsxCodeButtons() is called inside renderWatchlist() now
            
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


// --- UI EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', function() {
    console.log("script.js (v146) loaded and DOMContentLoaded fired."); // Updated version number for script.js

    // Ensure references are valid before adding listeners
    if (addShareHeaderBtn) addShareHeaderBtn.addEventListener('click', () => {
        console.log("[Event] Add Share Header Button clicked.");
        clearForm();
        showModal(shareFormSection);
        shareNameInput.focus();
    });
    if (newShareBtn) newShareBtn.addEventListener('click', () => {
        console.log("[Event] New Share Button clicked.");
        clearForm();
        showModal(shareFormSection);
        shareNameInput.focus();
    });
    if (formCloseButton) formCloseButton.addEventListener('click', () => {
        console.log("[Event] Form Close Button clicked.");
        closeModals();
        clearForm();
    });
    if (cancelFormBtn) cancelFormBtn.addEventListener('click', () => {
        console.log("[Event] Cancel Form Button clicked.");
        closeModals();
        clearForm();
    });
    if (saveShareBtn) saveShareBtn.addEventListener('click', saveShare);
    if (deleteShareBtn) deleteShareBtn.addEventListener('click', () => {
        console.log("[Event] Delete Share Button clicked from form.");
        showCustomConfirm(`Are you sure you want to delete this share?`, 
            () => deleteShare(selectedShareDocId, allSharesData.find(s => s.id === selectedShareDocId)?.watchlistId), // Pass watchlistId
            () => console.log("[Delete] Deletion cancelled by user.")
        );
    });

    if (shareNameInput) {
        shareNameInput.addEventListener('input', () => {
            // Enable save button only if share name is not empty
            setIconDisabled(saveShareBtn, shareNameInput.value.trim() === '');
        });
    }


    if (shareDetailModal) {
        shareDetailModal.querySelector('.close-btn').addEventListener('click', () => {
            console.log("[Event] Share Detail Modal Close Button clicked.");
            closeModals();
        });
    }
    if (editShareFromDetailBtn) editShareFromDetailBtn.addEventListener('click', () => {
        console.log("[Event] Edit Share from Detail Button clicked.");
        showEditFormForSelectedShare();
    });
    if (addCommentSectionBtn) addCommentSectionBtn.addEventListener('click', () => {
        console.log("[Event] Add Comment Section Button clicked.");
        addCommentSection();
    });

    // Dividend Calculator Listeners
    if (dividendCalcBtn) dividendCalcBtn.addEventListener('click', () => {
        console.log("[Event] Dividend Calc Button clicked.");
        resetCalculator(); // Reset universal calculator too
        showModal(dividendCalculatorModal);
    });
    if (dividendCalculatorModal) {
        dividendCalculatorModal.querySelector('.calc-close-button').addEventListener('click', () => {
            console.log("[Event] Dividend Calc Close Button clicked.");
            hideModal(dividendCalculatorModal);
            resetCalculator();
        });
        calcCurrentPriceInput.addEventListener('input', updateYields);
        calcDividendAmountInput.addEventListener('input', updateYields);
        calcFrankingCreditsInput.addEventListener('input', updateYields);
        investmentValueSelect.addEventListener('input', calculateEstimatedDividend);
    }

    // Universal Calculator Listeners
    if (standardCalcBtn) standardCalcBtn.addEventListener('click', () => {
        console.log("[Event] Standard Calc Button clicked.");
        resetCalculator(); // Reset dividend calculator too
        setupCalculator(); // Ensure buttons are set up
        showModal(calculatorModal);
    });
    if (calculatorModal) {
        calculatorModal.querySelector('.close-btn').addEventListener('click', () => {
            console.log("[Event] Standard Calc Close Button clicked.");
            hideModal(calculatorModal);
            resetCalculator();
        });
    }

    // Sort Select Listener
    if (sortSelect) {
        sortSelect.addEventListener('change', (event) => {
            currentSortOrder = event.target.value;
            console.log(`[Event] Sort order changed to: ${currentSortOrder}`);
            if (currentUserId) {
                saveUserSettings({ sortOrder: currentSortOrder });
            }
            sortShares();
        });
        console.log("[Event] Sort Select listener attached.");
    }

    // Watchlist Select Listener
    if (watchlistSelect) {
        watchlistSelect.addEventListener('change', async (event) => {
            currentWatchlistId = event.target.value;
            currentWatchlistName = event.target.options[event.target.selectedIndex].text; // Get text from selected option
            console.log(`[Event] Watchlist changed to: ${currentWatchlistName} (ID: ${currentWatchlistId})`);
            if (currentUserId) {
                await saveUserSettings({ lastWatchlistId: currentWatchlistId, lastWatchlistName: currentWatchlistName });
            }
            await loadShares(); // Re-render shares for the new watchlist
        });
    }


    // Custom Dialog Listeners
    if (customDialogModal) {
        customDialogModal.querySelector('.close-btn').addEventListener('click', () => {
            console.log("[Event] Custom Dialog Close Button clicked.");
            if (currentDialogCallback) { currentDialogCallback(); } // Execute cancel callback if exists
            closeModals();
        });
        // Note: Confirm and Cancel buttons within the dialog have their handlers set by showCustomConfirm
    }

    // Theme buttons
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    if (colorThemeSelect) colorThemeSelect.addEventListener('click', cycleCustomThemes);
    if (revertToDefaultThemeBtn) revertToDefaultThemeBtn.addEventListener('click', revertToDefaultTheme);

    // Scroll to top button
    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 200) { // Show button after scrolling down 200px
                scrollToTopBtn.style.display = 'flex';
                scrollToTopBtn.style.opacity = '1';
            } else {
                scrollToTopBtn.style.opacity = '0';
                setTimeout(() => {
                    scrollToTopBtn.style.display = 'none';
                }, 300);
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

    // Hamburger menu and sidebar overlay
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
                console.log(`[Sidebar Menu Item Click] data-action-closes-menu: ${event.currentTarget.dataset.actionClosesMenu}, closesMenu: ${closesMenu}`);
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
