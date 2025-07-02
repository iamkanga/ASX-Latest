// File Version: v145
// Last Updated: 2025-07-02 (Multi-Select Watchlist, News Links, No Confirmations)

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
const modalNewsLink = document.getElementById('modalNewsLink'); // New News Link
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
// const watchlistSelect = document.getElementById('watchlistSelect'); // Removed from HTML
const themeToggleBtn = document.getElementById('themeToggleBtn');
const colorThemeSelect = document.getElementById('colorThemeSelect');
const revertToDefaultThemeBtn = document.getElementById('revertToDefaultThemeBtn');
const scrollToTopBtn = document.getElementById('scrollToTopBtn');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const appSidebar = document.getElementById('appSidebar');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const selectWatchlistsBtn = document.getElementById('selectWatchlistsBtn'); // New sidebar button
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

// New elements for multi-select watchlist modal
const selectWatchlistsModal = document.getElementById('selectWatchlistsModal');
const watchlistCheckboxesContainer = document.getElementById('watchlistCheckboxesContainer');
const applyWatchlistSelectionBtn = document.getElementById('applyWatchlistSelectionBtn');


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
    if (selectWatchlistsBtn) selectWatchlistsBtn.disabled = !enable; // New watchlist button
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
    // Watchlist select dropdown is removed, so no need to clear its options directly.
    // We just need to clear the internal state and re-render the multi-select modal.
    userWatchlists = [];
    currentSelectedWatchlistIds = [];
    renderWatchlistSelectionModal(); // Re-render the multi-select modal content
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

    // News Link
    if (modalNewsLink && share.shareName) {
        const newsUrl = `https://news.google.com/search?q=${encodeURIComponent(share.shareName)}%20stock&hl=en-AU&gl=AU&ceid=AU:en`;
        modalNewsLink.href = newsUrl;
        modalNewsLink.textContent = `View News for ${share.shareName.toUpperCase()}`;
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

// Replaces renderWatchlistSelect
function renderWatchlistSelectionModal() {
    if (!watchlistCheckboxesContainer) {
        console.error("[renderWatchlistSelectionModal] watchlistCheckboxesContainer not found.");
        return;
    }
    watchlistCheckboxesContainer.innerHTML = ''; // Clear existing checkboxes

    // Add "Show All Shares" option
    const allSharesDiv = document.createElement('div');
    allSharesDiv.className = 'watchlist-checkbox-item';
    allSharesDiv.innerHTML = `
        <input type="checkbox" id="${ALL_SHARES_ID}" value="${ALL_SHARES_ID}">
        <label for="${ALL_SHARES_ID}">Show All Shares</label>
    `;
    watchlistCheckboxesContainer.appendChild(allSharesDiv);
    const allSharesCheckbox = allSharesDiv.querySelector(`#${ALL_SHARES_ID}`);
    allSharesCheckbox.addEventListener('change', handleAllSharesCheckboxChange);

    // Add individual watchlist options
    userWatchlists.forEach(watchlist => {
        const watchlistDiv = document.createElement('div');
        watchlistDiv.className = 'watchlist-checkbox-item';
        watchlistDiv.innerHTML = `
            <input type="checkbox" id="watchlist-${watchlist.id}" value="${watchlist.id}">
            <label for="watchlist-${watchlist.id}">${watchlist.name}</label>
        `;
        watchlistCheckboxesContainer.appendChild(watchlistDiv);
        const checkbox = watchlistDiv.querySelector(`input`);
        checkbox.addEventListener('change', handleIndividualWatchlistCheckboxChange);

        // Set initial checked state based on currentSelectedWatchlistIds
        if (currentSelectedWatchlistIds.includes(watchlist.id)) {
            checkbox.checked = true;
        }
    });

    // Set initial state for "Show All Shares" checkbox
    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        allSharesCheckbox.checked = true;
        // Disable individual checkboxes if "Show All Shares" is checked
        watchlistCheckboxesContainer.querySelectorAll('.watchlist-checkbox-item:not(#all_shares_option_parent) input[type="checkbox"]').forEach(cb => {
            cb.disabled = true;
            cb.closest('.watchlist-checkbox-item').classList.add('is-disabled-checkbox');
        });
    } else {
        // Ensure "Show All Shares" is not checked and individual ones are enabled
        allSharesCheckbox.checked = false;
        watchlistCheckboxesContainer.querySelectorAll('.watchlist-checkbox-item').forEach(div => {
            if (div.id !== ALL_SHARES_ID) { // Use ID or a specific class for the "All Shares" parent div
                div.querySelector('input[type="checkbox"]').disabled = false;
                div.classList.remove('is-disabled-checkbox');
            }
        });
    }
    console.log("[UI Update] Watchlist selection modal rendered.");
}

function handleAllSharesCheckboxChange(event) {
    const isChecked = event.target.checked;
    const individualWatchlistCheckboxes = watchlistCheckboxesContainer.querySelectorAll('.watchlist-checkbox-item:not(#all_shares_option_parent) input[type="checkbox"]');
    
    individualWatchlistCheckboxes.forEach(checkbox => {
        checkbox.checked = false; // Uncheck all individual watchlists
        checkbox.disabled = isChecked; // Disable if "Show All Shares" is checked
        if (isChecked) {
            checkbox.closest('.watchlist-checkbox-item').classList.add('is-disabled-checkbox');
        } else {
            checkbox.closest('.watchlist-checkbox-item').classList.remove('is-disabled-checkbox');
        }
    });
    console.log(`[Watchlist Selection] "Show All Shares" toggled to: ${isChecked}`);
}

function handleIndividualWatchlistCheckboxChange(event) {
    const allSharesCheckbox = watchlistCheckboxesContainer.querySelector(`#${ALL_SHARES_ID}`);
    if (event.target.checked) {
        // If an individual watchlist is checked, uncheck and disable "Show All Shares"
        if (allSharesCheckbox.checked) {
            allSharesCheckbox.checked = false;
            // Re-enable individual checkboxes if "Show All Shares" was just unchecked
            watchlistCheckboxesContainer.querySelectorAll('.watchlist-checkbox-item:not(#all_shares_option_parent) input[type="checkbox"]').forEach(cb => {
                cb.disabled = false;
                cb.closest('.watchlist-checkbox-item').classList.remove('is-disabled-checkbox');
            });
        }
    } else {
        // If an individual watchlist is unchecked, and no others are checked, re-enable "Show All Shares"
        const anyOtherIndividualChecked = Array.from(watchlistCheckboxesContainer.querySelectorAll('.watchlist-checkbox-item:not(#all_shares_option_parent) input[type="checkbox"]')).some(cb => cb.checked);
        if (!anyOtherIndividualChecked) {
            allSharesCheckbox.disabled = false;
            allSharesCheckbox.closest('.watchlist-checkbox-item').classList.remove('is-disabled-checkbox');
        }
    }
    console.log(`[Watchlist Selection] Individual watchlist toggled. All Shares checkbox disabled: ${allSharesCheckbox.disabled}`);
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

    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        sharesToRender = [...allSharesData]; // Render all shares
        mainTitle.textContent = "All My Shares";
        console.log("[Render] Displaying all shares.");
    } else if (currentSelectedWatchlistIds.length > 0) {
        sharesToRender = allSharesData.filter(share => currentSelectedWatchlistIds.includes(share.watchlistId));
        // Update mainTitle based on selected watchlists
        const selectedNames = currentSelectedWatchlistIds.map(id => {
            const wl = userWatchlists.find(w => w.id === id);
            return wl ? wl.name : 'Unknown Watchlist';
        });
        if (selectedNames.length === 1) {
            mainTitle.textContent = selectedNames[0];
        } else {
            mainTitle.textContent = "Multiple Watchlists Selected";
        }
        console.log(`[Render] Displaying shares from watchlists: ${selectedNames.join(', ')}`);
    } else {
        // No watchlists selected (shouldn't happen if default is created)
        mainTitle.textContent = "No Watchlists Selected";
        console.log("[Render] No watchlists selected for display.");
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
    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        sharesForButtons = [...allSharesData]; // Use all shares if "Show All Shares" is active
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
    } catch (error) {
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
    } catch (error) {
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
        let lastSelectedWatchlistIds = null;
        let savedSortOrder = null;
        let savedTheme = null; 
        if (userProfileSnap.exists()) {
            lastSelectedWatchlistIds = userProfileSnap.data().lastSelectedWatchlistIds;
            savedSortOrder = userProfileSnap.data().lastSortOrder;
            savedTheme = userProfileSnap.data().lastTheme;
            console.log(`[User Settings] Found last selected watchlists in profile: ${lastSelectedWatchlistIds}`);
            console.log(`[User Settings] Found saved sort order in profile: ${savedSortOrder}`);
            console.log(`[User Settings] Found saved theme in profile: ${savedTheme}`);
        }

        // Set currentSelectedWatchlistIds based on saved preferences or default
        if (lastSelectedWatchlistIds && Array.isArray(lastSelectedWatchlistIds) && lastSelectedWatchlistIds.length > 0) {
            // Filter out any IDs that no longer exist in userWatchlists (except ALL_SHARES_ID)
            currentSelectedWatchlistIds = lastSelectedWatchlistIds.filter(id => 
                id === ALL_SHARES_ID || userWatchlists.some(wl => wl.id === id)
            );
            if (currentSelectedWatchlistIds.length === 0 && !lastSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
                // If saved IDs are all invalid and "All Shares" wasn't selected, default to the first watchlist
                currentSelectedWatchlistIds = [userWatchlists[0].id];
                console.warn("[User Settings] Saved watchlist IDs were invalid or empty, defaulting to first watchlist.");
            }
        } else {
            // Default to the first watchlist if no saved preference
            currentSelectedWatchlistIds = [userWatchlists[0].id];
            console.log("[User Settings] No saved watchlist preference, defaulting to first watchlist.");
        }

        renderWatchlistSelectionModal(); // Render the multi-select modal with initial states
        
        if (currentUserId && savedSortOrder && Array.from(sortSelect.options).some(option => option.value === savedSortOrder)) {
            sortSelect.value = savedSortOrder; // Set the select element's value
            currentSortOrder = savedSortOrder; // Update the global variable
            console.log(`[Sort] Applied saved sort order: ${currentSortOrder}`);
        } else {
            sortSelect.value = ''; 
            currentSortOrder = '';
            console.log("[Sort] No valid saved sort order or not logged in, defaulting to placeholder.");
        }
        renderSortSelect(); // Re-render to ensure placeholder is correctly shown if no saved sort order
        
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

        if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID) || currentSelectedWatchlistIds.length === 0) {
            // If "Show All Shares" is selected or no specific watchlists are selected, fetch all shares for the user.
            q = window.firestore.query(sharesCol);
            console.log(`[Shares] Setting up real-time listener for ALL shares for user: ${currentUserId}`);
        } else {
            // If specific watchlists are selected, filter by those watchlist IDs.
            // Firestore 'in' query has a limit of 10. If more than 10 watchlists are selected,
            // we'll fetch all shares and filter in memory.
            if (currentSelectedWatchlistIds.length <= 10) {
                q = window.firestore.query(sharesCol, window.firestore.where("watchlistId", "in", currentSelectedWatchlistIds));
                console.log(`[Shares] Setting up real-time listener for shares in specific watchlists: ${currentSelectedWatchlistIds.join(', ')}`);
            } else {
                // Fallback for more than 10 selected watchlists: fetch all and filter client-side
                q = window.firestore.query(sharesCol);
                console.warn(`[Shares] More than 10 watchlists selected (${currentSelectedWatchlistIds.length}). Fetching all shares and filtering client-side.`);
            }
        }

        // Set up the real-time listener
        unsubscribeShares = window.firestore.onSnapshot(q, (querySnapshot) => {
            console.log("[Firestore Listener] Shares snapshot received. Processing changes.");
            let fetchedShares = [];
            querySnapshot.forEach((doc) => {
                const share = { id: doc.id, ...doc.data() };
                fetchedShares.push(share);
            });

            // Apply client-side filtering if necessary (e.g., if more than 10 watchlists were selected)
            if (!currentSelectedWatchlistIds.includes(ALL_SHARES_ID) && currentSelectedWatchlistIds.length > 10) {
                allSharesData = fetchedShares.filter(share => currentSelectedWatchlistIds.includes(share.watchlistId));
                console.log(`[Shares] Client-side filtered shares. Total shares after filter: ${allSharesData.length}`);
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
        console.log("[Migration] Checking for old shares to migrate/update schema and data types...");
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
        // Open sidebar
        appSidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
        if (isDesktop) {
            document.body.classList.add('sidebar-active');
            sidebarOverlay.style.pointerEvents = 'none'; // Clicks pass through overlay on desktop
        } else {
            document.body.classList.remove('sidebar-active'); // Ensure body doesn't shift on mobile
            sidebarOverlay.style.pointerEvents = 'auto'; // Clicks close overlay on mobile
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

    if (currentSelectedWatchlistIds.includes(ALL_SHARES_ID)) {
        sharesToExport = [...allSharesData];
        exportFileNamePrefix = "all_shares";
    } else {
        sharesToExport = allSharesData.filter(share => currentSelectedWatchlistIds.includes(share.watchlistId));
        if (currentSelectedWatchlistIds.length === 1) {
            const wl = userWatchlists.find(w => w.id === currentSelectedWatchlistIds[0]);
            if (wl) { exportFileNamePrefix = wl.name; }
        } else {
            exportFileNamePrefix = "multiple_watchlists";
        }
    }

    if (sharesToExport.length === 0) {
        showCustomAlert("No shares in the current selection to export.", 2000);
        return;
    }

    const headers = [
        "Code", "Entered Price", "Target Price", "Dividend Amount", "Franking Credits (%)",
        "Unfranked Yield (%)", "Franked Yield (%)", "Entry Date", "Comments"
    ];

    const csvRows = [];
    csvRows.push(headers.map(escapeCsvValue).join(',')); // Add headers

    sharesToExport.forEach(share => {
        const enteredPriceNum = Number(share.currentPrice);
        const dividendAmountNum = Number(share.dividendAmount);
        const frankingCreditsNum = Number(share.frankingCredits);
        const targetPriceNum = Number(share.targetPrice);

        const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, enteredPriceNum);
        const frankedYield = calculateFrankedYield(dividendAmountNum, enteredPriceNum, frankingCreditsNum);

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
            (!isNaN(targetPriceNum) && targetPriceNum !== null) ? targetPriceNum.toFixed(2) : '',
            (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? dividendAmountNum.toFixed(3) : '',
            (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? frankingCreditsNum.toFixed(1) : '',
            unfrankedYield !== null ? unfrankedYield.toFixed(2) : '',
            frankedYield !== null ? frankedYield.toFixed(2) : '',
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
    if (selectWatchlistsModal) selectWatchlistsModal.style.setProperty('display', 'none', 'important'); // New modal

    // renderWatchlistSelect(); // Replaced by renderWatchlistSelectionModal

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
            // console.log(`[shareNameInput] Input changed. Value: '${this.value.trim()}', saveShareBtn disabled: ${this.value.trim() === ''}`);
            setIconDisabled(saveShareBtn, this.value.trim() === '');
        });
    }

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
        addCommentSectionBtn.addEventListener('click', () => addCommentSection());
    }

    // Close buttons for modals
    document.querySelectorAll('.close-button').forEach(button => { button.addEventListener('click', closeModals); });

    // Global click listener to close modals/context menu if clicked outside
    window.addEventListener('click', (event) => {
        if (event.target === shareDetailModal || event.target === dividendCalculatorModal ||
            event.target === shareFormSection || event.target === customDialogModal ||
            event.target === calculatorModal || event.target === addWatchlistModal ||
            event.target === manageWatchlistModal || event.target === selectWatchlistsModal) { // Added new modal
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

    // Watchlist Select Change Listener (Removed as dropdown is gone)
    // if (watchlistSelect) { ... }

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
            const isDisabled = shareNameInput.value.trim() === '';
            // console.log(`[shareNameInput Listener] shareNameInput.value.trim(): '${shareNameInput.value.trim()}', isDisabled: ${isDisabled}`);
            setIconDisabled(saveShareBtn, isDisabled);
        });
    }

    // Save Share Button
    if (saveShareBtn) {
        saveShareBtn.addEventListener('click', async () => {
            console.log("[Share Form] Save Share button clicked.");
            // Ensure button is not disabled before proceeding
            if (saveShareBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert("Please enter a share code.");
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
                // When adding a new share, assign it to the first selected watchlist if available,
                // or the default watchlist if "All Shares" is active or no specific ones are selected.
                watchlistId: currentSelectedWatchlistIds.includes(ALL_SHARES_ID) && userWatchlists.length > 0
                             ? userWatchlists[0].id // If 'All Shares' is selected, assign to first available watchlist
                             : (currentSelectedWatchlistIds.length > 0 ? currentSelectedWatchlistIds[0] : getDefaultWatchlistId(currentUserId)),
                lastPriceUpdateTime: new Date().toISOString()
            };

            if (selectedShareDocId) {
                const existingShare = allSharesData.find(s => s.id === selectedShareDocId);
                if (existingShare) { shareData.previousFetchedPrice = existingShare.lastFetchedPrice; }
                else { shareData.previousFetchedPrice = shareData.currentPrice; }
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
                } catch (error) {
                    console.error("[Firestore] Error adding share:", error);
                    showCustomAlert("Error adding share: " + error.message);
                }
            }
            // No explicit loadShares() here, the onSnapshot listener will handle the UI refresh.
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
                    await window.firestore.deleteDoc(shareDocRef);
                    showCustomAlert("Share deleted successfully!", 1500);
                    console.log(`[Firestore] Share (ID: ${selectedShareDocId}) deleted.`);
                    closeModals();
                    // No explicit loadShares() here, the onSnapshot listener will handle the UI refresh.
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
                    await window.firestore.deleteDoc(shareDocRef);
                    showCustomAlert("Share deleted successfully!", 1500);
                    console.log(`[Firestore] Share (ID: ${shareToDeleteId}) deleted.`);
                    // No explicit loadShares() here, the onSnapshot listener will handle the UI refresh.
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
            showModal(addWatchlistModal);
            newWatchlistNameInput.focus();
            toggleAppSidebar(false);
        });
    }

    // Event listener for newWatchlistNameInput to toggle saveWatchlistBtn
    if (newWatchlistNameInput && saveWatchlistBtn) {
        newWatchlistNameInput.addEventListener('input', () => {
            const isDisabled = newWatchlistNameInput.value.trim() === '';
            // console.log(`[newWatchlistNameInput Listener] newWatchlistNameInput.value.trim(): '${newWatchlistNameInput.value.trim()}', isDisabled: ${isDisabled}`);
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
                const watchlistsColRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`);
                const newWatchlistRef = await window.firestore.addDoc(watchlistsColRef, {
                    name: watchlistName,
                    createdAt: new Date().toISOString(),
                    userId: currentUserId
                });
                showCustomAlert(`Watchlist '${watchlistName}' added!`, 1500);
                console.log(`[Firestore] Watchlist '${watchlistName}' added with ID: ${newWatchlistRef.id}`);
                hideModal(addWatchlistModal);
                
                // After adding, select only this new watchlist
                currentSelectedWatchlistIds = [newWatchlistRef.id];
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
            // For editing, we need to pick ONE watchlist. Let's use the first selected one, or the default.
            let watchlistToEditId = currentSelectedWatchlistIds.includes(ALL_SHARES_ID) && userWatchlists.length > 0
                                  ? userWatchlists[0].id
                                  : (currentSelectedWatchlistIds.length > 0 ? currentSelectedWatchlistIds[0] : null);

            if (!watchlistToEditId && userWatchlists.length > 0) {
                watchlistToEditId = userWatchlists[0].id; // Fallback to first available if nothing selected
            }

            const selectedWatchlistObj = userWatchlists.find(w => w.id === watchlistToEditId);
            const watchlistToEditName = selectedWatchlistObj ? selectedWatchlistObj.name : '';

            console.log(`[Edit Watchlist Button Click] Watchlist to edit ID: ${watchlistToEditId}, Name: ${watchlistToEditName}`);

            if (!watchlistToEditId) {
                showCustomAlert("Please create or select a watchlist to edit.");
                return;
            }
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
            // console.log(`[editWatchlistNameInput Listener] editWatchlistNameInput.value.trim(): '${editWatchlistNameInput.value.trim()}', isDisabled: ${isDisabled}`);
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

            // For editing, we need to pick ONE watchlist. Let's use the first selected one, or the default.
            let watchlistToEditId = currentSelectedWatchlistIds.includes(ALL_SHARES_ID) && userWatchlists.length > 0
                                  ? userWatchlists[0].id
                                  : (currentSelectedWatchlistIds.length > 0 ? currentSelectedWatchlistIds[0] : null);

            if (!watchlistToEditId && userWatchlists.length > 0) {
                watchlistToEditId = userWatchlists[0].id; // Fallback to first available if nothing selected
            }

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
                const watchlistDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`, watchlistToEditId);
                await window.firestore.updateDoc(watchlistDocRef, { name: newName });
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

            // For deleting, we need to pick ONE watchlist. Let's use the first selected one, or the default.
            let watchlistToDeleteId = currentSelectedWatchlistIds.includes(ALL_SHARES_ID) && userWatchlists.length > 0
                                  ? userWatchlists[0].id
                                  : (currentSelectedWatchlistIds.length > 0 ? currentSelectedWatchlistIds[0] : null);

            if (!watchlistToDeleteId && userWatchlists.length > 0) {
                watchlistToDeleteId = userWatchlists[0].id; // Fallback to first available if nothing selected
            }

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

                await loadUserWatchlistsAndSettings(); // This will re-render watchlists and trigger loadShares()
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

    // NEW: Select Watchlists Button (in sidebar)
    if (selectWatchlistsBtn) {
        selectWatchlistsBtn.addEventListener('click', () => {
            console.log("[UI] Select Watchlists button clicked.");
            renderWatchlistSelectionModal(); // Re-populate checkboxes based on current state
            showModal(selectWatchlistsModal);
            toggleAppSidebar(false);
        });
    }

    // NEW: Apply Watchlist Selection Button
    if (applyWatchlistSelectionBtn) {
        applyWatchlistSelectionBtn.addEventListener('click', async () => {
            console.log("[UI] Apply Watchlist Selection button clicked.");
            const selectedIds = [];
            const allSharesCheckbox = watchlistCheckboxesContainer.querySelector(`#${ALL_SHARES_ID}`);

            if (allSharesCheckbox && allSharesCheckbox.checked) {
                selectedIds.push(ALL_SHARES_ID);
                console.log("[Watchlist Selection] 'Show All Shares' is selected.");
            } else {
                watchlistCheckboxesContainer.querySelectorAll('.watchlist-checkbox-item input[type="checkbox"]').forEach(checkbox => {
                    if (checkbox.id !== ALL_SHARES_ID && checkbox.checked) {
                        selectedIds.push(checkbox.value);
                    }
                });
                console.log(`[Watchlist Selection] Selected individual watchlists: ${selectedIds.join(', ')}`);
            }

            if (selectedIds.length === 0) {
                showCustomAlert("Please select at least one watchlist or 'Show All Shares'.");
                return;
            }

            currentSelectedWatchlistIds = selectedIds;
            await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds);
            await loadShares(); // Trigger load shares with new selection
            hideModal(selectWatchlistsModal);
            showCustomAlert("Watchlist selection applied!", 1000);
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
    console.log("script.js (v145) DOMContentLoaded fired."); // Updated version number

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
                if (user.email && user.email.toLowerCase() === KANGA_EMAIL) {
                    mainTitle.textContent = "Kanga's Share Watchlist";
                } else {
                    mainTitle.textContent = "My Share Watchlist";
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
