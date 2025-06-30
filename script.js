// File Version: v120
// Last Updated: 2025-06-28 (Syntax Error Fix)

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
let allSharesData = [];
let currentDialogCallback = null;
let autoDismissTimeout = null;
let lastTapTime = 0;
let tapTimeout;
let selectedElementForTap = null;
let longPressTimer;
const LONG_PRESS_THRESHOLD = 400; // Increased sensitivity for long press
const DOUBLE_TAP_THRESHOLD = 300; // Max time between taps for double tap
const DOUBLE_TAP_TIMEOUT = 250; // Timeout to register single tap vs potential double tap
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;
const TOUCH_MOVE_THRESHOLD = 10;
const KANGA_EMAIL = 'iamkanga@gmail.com';
let currentCalculatorInput = '';
let operator = null;
let previousCalculatorInput = '';
let resultDisplayed = false;
const DEFAULT_WATCHLIST_NAME = 'My Watchlist (Default)'; // Updated default watchlist name
const DEFAULT_WATCHLIST_ID_SUFFIX = 'default';
let userWatchlists = [];
let currentWatchlistId = null;
let currentWatchlistName = '';

// Theme related variables
const CUSTOM_THEMES = [
    'bold-1', 'bold-2', 'bold-3', 'bold-4', 'bold-5', 'bold-6', 'bold-7', 'bold-8', 'bold-9', 'bold-10',
    'subtle-1', 'subtle-2', 'subtle-3', 'subtle-4', 'subtle-5', 'subtle-6', 'subtle-7', 'subtle-8', 'subtle-9', 'subtle-10'
];
let currentCustomThemeIndex = -1; // To track the current theme in the cycle

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
const deleteShareFromFormBtn = document.getElementById('deleteShareFromFormBtn');
const shareNameInput = document.getElementById('shareName');
const currentPriceInput = document.getElementById('currentPrice');
const targetPriceInput = document.getElementById('targetPrice');
const dividendAmountInput = document.getElementById('dividendAmount');
const frankingCreditsInput = document.getElementById('frankingCredits');
const commentsFormContainer = document.getElementById('commentsFormContainer');
const addCommentSectionBtn = document.getElementById('addCommentSectionBtn');
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
const modalFrankingCredits = document.getElementById('modalFrankingCredits');
const modalCommentsContainer = document.getElementById('modalCommentsContainer');
const modalUnfrankedYieldSpan = document.getElementById('modalUnfrankedYield');
const modalFrankedYieldSpan = document.getElementById('modalFrankedYield');
const editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn');
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
const revertToDefaultThemeBtn = document.getElementById('revertToDefaultThemeBtn'); // Changed from link to button
const scrollToTopBtn = document.getElementById('scrollToTopBtn');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const appSidebar = document.getElementById('appSidebar');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const addWatchlistBtn = document.getElementById('addWatchlistBtn');
const editWatchlistBtn = document.getElementById('editWatchlistBtn');
const addWatchlistModal = document.getElementById('addWatchlistModal');
const newWatchlistNameInput = document.getElementById('newWatchlistName');
const saveWatchlistBtn = document.getElementById('saveWatchlistBtn');
const cancelAddWatchlistBtn = document.getElementById('cancelAddWatchlistBtn');
const manageWatchlistModal = document.getElementById('manageWatchlistModal');
const editWatchlistNameInput = document.getElementById('editWatchlistName');
const saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn');
const deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn');
const cancelManageWatchlistBtn = document.getElementById('cancelManageWatchlistBtn');

// Ensure sidebarOverlay is correctly referenced or created if not already in HTML
let sidebarOverlay = document.querySelector('.sidebar-overlay');
if (!sidebarOverlay) {
    sidebarOverlay = document.createElement('div');
    sidebarOverlay.classList.add('sidebar-overlay');
    document.body.appendChild(sidebarOverlay);
}

// Array of all form input elements for easy iteration and form clearing (excluding dynamic comments)
const formInputs = [
    shareNameInput, currentPriceInput, targetPriceInput,
    dividendAmountInput, frankingCreditsInput
];


// --- GLOBAL HELPER FUNCTIONS (MOVED OUTSIDE DOMContentLoaded for accessibility) ---

// Centralized Modal Closing Function
function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
        }
    });
    resetCalculator(); // Reset calculator state when closing calculator modal
    deselectCurrentShare(); // Always deselect share when any modal is closed
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); autoDismissTimeout = null; }
}

// Custom Dialog (Alert/Confirm) Functions
function showCustomAlert(message, duration = 1000) {
    if (!customDialogModal || !customDialogMessage || !customDialogConfirmBtn || !customDialogCancelBtn) {
        console.error("Custom dialog elements not found. Cannot show alert.");
        console.log("ALERT (fallback):", message);
        return;
    }
    customDialogMessage.textContent = message;
    customDialogConfirmBtn.style.display = 'none';
    customDialogCancelBtn.style.display = 'none';
    showModal(customDialogModal);
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); }
    autoDismissTimeout = setTimeout(() => { hideModal(customDialogModal); autoDismissTimeout = null; }, duration);
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
    customDialogConfirmBtn.textContent = 'Yes';
    customDialogConfirmBtn.style.display = 'block';
    customDialogCancelBtn.textContent = 'No';
    customDialogCancelBtn.style.display = 'block';
    showModal(customDialogModal);
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); }
    customDialogConfirmBtn.onclick = () => { hideModal(customDialogModal); if (onConfirm) onConfirm(); currentDialogCallback = null; };
    customDialogCancelBtn.onclick = () => { hideModal(customDialogModal); if (onCancel) onCancel(); currentDialogCallback = null; };
    currentDialogCallback = () => { hideModal(customDialogModal); if (onCancel) onCancel(); currentDialogCallback = null; };
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
    }
}

function updateMainButtonsState(enable) {
    if (newShareBtn) newShareBtn.disabled = !enable;
    if (standardCalcBtn) standardCalcBtn.disabled = !enable;
    if (dividendCalcBtn) dividendCalcBtn.disabled = !enable;
    if (watchlistSelect) watchlistSelect.disabled = !enable; 
    if (addWatchlistBtn) addWatchlistBtn.disabled = !enable;
    // editWatchlistBtn and deleteWatchlistInModalBtn depend on userWatchlists.length
    // They are enabled only if there's more than one watchlist (i.e., not just the default)
    if (editWatchlistBtn) editWatchlistBtn.disabled = !enable || userWatchlists.length <= 1; 
    if (deleteWatchlistInModalBtn) deleteWatchlistInModalBtn.disabled = !enable || userWatchlists.length <= 1;
    if (addShareHeaderBtn) addShareHeaderBtn.disabled = !enable;
}

function showModal(modalElement) {
    if (modalElement) {
        modalElement.style.setProperty('display', 'flex', 'important');
        modalElement.scrollTop = 0;
    }
}

function hideModal(modalElement) {
    if (modalElement) {
        modalElement.style.setProperty('display', 'none', 'important');
    }
}

// Watchlist UI clearing
function clearWatchlistUI() {
    if (watchlistSelect) watchlistSelect.innerHTML = '';
    userWatchlists = [];
    renderWatchlistSelect();
    renderSortSelect();
    console.log("[UI] Watchlist UI cleared.");
}

// Share List UI clearing
function clearShareListUI() {
    if (shareTableBody) shareTableBody.innerHTML = '';
    if (mobileShareCardsContainer) mobileShareCardsContainer.innerHTML = '';
    console.log("[UI] Share list UI cleared.");
}

// Full share list clearing (UI + buttons + selection)
function clearShareList() {
    clearShareListUI();
    if (asxCodeButtonsContainer) asxCodeButtonsContainer.innerHTML = '';
    deselectCurrentShare();
    console.log("[UI] Full share list cleared (UI + buttons).");
}

// Deselect currently highlighted share
function deselectCurrentShare() {
    const currentlySelected = document.querySelectorAll('.share-list-section tr.selected, .mobile-card.selected');
    console.log(`[Selection] Attempting to deselect ${currentlySelected.length} elements.`);
    currentlySelected.forEach(el => {
        el.classList.remove('selected');
    });
    selectedShareDocId = null;
    console.log("[Selection] Share deselected. selectedShareDocId is now null.");
}

// Function to truncate text
function truncateText(text, maxLength) {
    if (typeof text !== 'string' || text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}

// Function to add a comment section to the form
function addCommentSection(title = '', text = '') {
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
        event.target.closest('.comment-section').remove();
    });
}

// Function to clear the form fields
function clearForm() {
    formInputs.forEach(input => {
        if (input) { input.value = ''; }
    });
    commentsFormContainer.innerHTML = '';
    addCommentSection(); // Add one empty comment section by default
    selectedShareDocId = null;
    console.log("[Form] Form fields cleared and selectedShareDocId reset.");
}

// Function to show the edit form with selected share's data
function showEditFormForSelectedShare() {
    if (!selectedShareDocId) {
        showCustomAlert("Please select a share to edit.");
        return;
    }
    const shareToEdit = allSharesData.find(share => share.id === selectedShareDocId);
    if (!shareToEdit) {
        showCustomAlert("Selected share not found.");
        return;
    }
    formTitle.textContent = 'Edit Share';
    shareNameInput.value = shareToEdit.shareName || '';
    currentPriceInput.value = Number(shareToEdit.currentPrice) !== null && !isNaN(Number(shareToEdit.currentPrice)) ? Number(shareToEdit.currentPrice).toFixed(2) : '';
    targetPriceInput.value = Number(shareToEdit.targetPrice) !== null && !isNaN(Number(shareToEdit.targetPrice)) ? Number(shareToEdit.targetPrice).toFixed(2) : '';
    dividendAmountInput.value = Number(shareToEdit.dividendAmount) !== null && !isNaN(Number(shareToEdit.dividendAmount)) ? Number(shareToEdit.dividendAmount).toFixed(3) : '';
    frankingCreditsInput.value = Number(shareToEdit.frankingCredits) !== null && !isNaN(Number(shareToEdit.frankingCredits)) ? Number(shareToEdit.frankingCredits).toFixed(1) : '';
    
    commentsFormContainer.innerHTML = '';
    if (shareToEdit.comments && Array.isArray(shareToEdit.comments)) {
        shareToEdit.comments.forEach(comment => addCommentSection(comment.title, comment.text));
    }
    if (shareToEdit.comments === undefined || shareToEdit.comments.length === 0) {
        addCommentSection();
    }
    deleteShareFromFormBtn.style.display = 'inline-flex';
    showModal(shareFormSection);
    shareNameInput.focus();
    console.log(`[Form] Opened edit form for share: ${shareToEdit.shareName} (ID: ${selectedShareDocId})`);
}

// Function to show share details in the modal
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

    if (modalMarketIndexLink && share.shareName) {
        const marketIndexUrl = `https://www.marketindex.com.au/asx/${share.shareName.toLowerCase()}`;
        modalMarketIndexLink.href = marketIndexUrl;
        modalMarketIndexLink.textContent = `View ${share.shareName.toUpperCase()} on MarketIndex.com.au`;
        modalMarketIndexLink.style.display = 'inline-flex';
    } else if (modalMarketIndexLink) {
        modalMarketIndexLink.style.display = 'none';
    }

    if (modalFoolLink && share.shareName) {
        const foolUrl = `https://www.fool.com.au/tickers/asx-${share.shareName.toLowerCase()}/`;
        modalFoolLink.href = foolUrl;
        modalFoolLink.textContent = `View ${share.shareName.toUpperCase()} on Fool.com.au`;
        modalFoolLink.style.display = 'inline-flex';
    } else if (modalFoolLink) {
        modalFoolLink.style.display = 'none';
    }

    if (modalCommSecLink && share.shareName) {
        const commSecUrl = `https://www2.commsec.com.au/quotes/summary?stockCode=${share.shareName.toUpperCase()}&exchangeCode=ASX`;
        modalCommSecLink.href = commSecUrl;
        modalCommSecLink.textContent = `View ${share.shareName.toUpperCase()} on CommSec.com.au`;
        modalCommSecLink.style.display = 'inline-flex';
    } else if (modalCommSecLink) {
        modalCommSecLink.style.display = 'none';
    }

    if (commSecLoginMessage) {
        commSecLoginMessage.style.display = 'block'; 
    }

    showModal(shareDetailModal);
    console.log(`[Details] Displayed details for share: ${share.shareName} (ID: ${selectedShareDocId})`);
}

// Watchlist Sorting Logic
function sortShares() {
    const sortValue = sortSelect.value;
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

// Render options in the watchlist dropdown
function renderWatchlistSelect() {
    if (!watchlistSelect) { console.error("[renderWatchlistSelect] watchlistSelect element not found."); return; }
    watchlistSelect.innerHTML = '';
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Watchlist';
    placeholderOption.disabled = true;
    placeholderOption.selected = true; 
    watchlistSelect.appendChild(placeholderOption);

    if (userWatchlists.length === 0) {
        watchlistSelect.disabled = true;
        return;
    }
    userWatchlists.forEach(watchlist => {
        const option = document.createElement('option');
        option.value = watchlist.id;
        option.textContent = watchlist.name;
        watchlistSelect.appendChild(option);
    });
    if (currentWatchlistId && userWatchlists.some(w => w.id === currentWatchlistId)) {
        watchlistSelect.value = currentWatchlistId;
        console.log(`[UI Update] Watchlist dropdown set to: ${currentWatchlistName} (ID: ${currentWatchlistId})`);
    } else if (userWatchlists.length > 0) {
        watchlistSelect.value = userWatchlists[0].id;
        currentWatchlistId = userWatchlists[0].id;
        currentWatchlistName = userWatchlists[0].name;
        console.warn(`[UI Update] currentWatchlistId was null/invalid, fallback to first watchlist: ${currentWatchlistName} (ID: ${currentWatchlistId})`);
    } else {
         watchlistSelect.value = '';
    }
    watchlistSelect.disabled = false;
}

// Render options in the sort by dropdown
function renderSortSelect() {
    if (!sortSelect) { console.error("[renderSortSelect] sortSelect element not found."); return; }
    const firstOption = sortSelect.options[0];
    if (firstOption && firstOption.value === '') {
        firstOption.textContent = 'Sort';
        firstOption.disabled = true;
        firstOption.selected = true;
    } else {
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Sort';
        placeholderOption.disabled = true;
        placeholderOption.selected = true;
        sortSelect.insertBefore(placeholderOption, sortSelect.firstChild);
    }
    // Ensure that if a valid value is already set, it remains selected.
    // The previous logic was fine here, as it only adds the placeholder if not already there.
    // The actual setting of the value happens in loadUserPreferences.
}

// Add Share to UI Functions
function addShareToTable(share) {
    if (!shareTableBody) { console.error("[addShareToTable] shareTableBody element not found."); return; }
    const row = shareTableBody.insertRow();
    row.dataset.docId = share.id;
    row.addEventListener('click', (event) => { 
        selectShare(share.id); 
        if (window.innerWidth > 768 && !event.target.closest('button')) {
            showShareDetails();
        }
    });
    row.addEventListener('dblclick', (event) => { 
        if (window.innerWidth <= 768) {
            selectShare(share.id); 
            showShareDetails(); 
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

    card.addEventListener('click', function(e) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        const docId = e.currentTarget.dataset.docId;

        if (tapLength < DOUBLE_TAP_THRESHOLD && tapLength > 0 && selectedElementForTap === e.currentTarget) {
            clearTimeout(tapTimeout);
            lastTapTime = 0;
            selectedElementForTap = null;
            selectShare(docId);
            showShareDetails();
            e.preventDefault();
        } else {
            lastTapTime = currentTime;
            selectedElementForTap = e.currentTarget;
            tapTimeout = setTimeout(() => {
                if (selectedElementForTap) {
                    selectShare(docId);
                    selectedElementForTap = null;
                }
            }, DOUBLE_TAP_TIMEOUT);
        }
    });

    card.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

    console.log(`[Render] Added share ${displayShareName} to mobile cards.`);
}

// Function to select a share by its document ID and visually highlight it
function selectShare(docId) {
    deselectCurrentShare();
    if (docId) {
        selectedShareDocId = docId;
        const tableRow = shareTableBody.querySelector(`tr[data-doc-id="${docId}"]`);
        if (tableRow) {
            tableRow.classList.add('selected');
            console.log(`[Selection] Selected table row for docId: ${docId}`);
        }
        const mobileCard = mobileShareCardsContainer.querySelector(`.mobile-card[data-doc-id="${docId}"]`);
        if (mobileCard) {
            mobileCard.classList.add('selected');
            console.log(`[Selection] Selected mobile card for docId: ${docId}`);
        }
        console.log(`[Selection] New share selected: ${docId}.`);
    }
}

// Function to re-render the watchlist (table and cards) after sorting or other changes
function renderWatchlist() {
    console.log(`[Render] Rendering watchlist for currentWatchlistId: ${currentWatchlistId} (Name: ${currentWatchlistName})`);
    clearShareListUI();
    const sharesToRender = allSharesData.filter(share => share.watchlistId === currentWatchlistId);
    console.log(`[Render] Shares filtered for rendering. Total shares to render: ${sharesToRender.length}`);

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
}

function renderAsxCodeButtons() {
    if (!asxCodeButtonsContainer) { console.error("[renderAsxCodeButtons] asxCodeButtonsContainer element not found."); return; }
    asxCodeButtonsContainer.innerHTML = '';
    const uniqueAsxCodes = new Set();
    const sharesInCurrentWatchlist = allSharesData.filter(share => share.watchlistId === currentWatchlistId);
    sharesInCurrentWatchlist.forEach(share => {
        if (share.shareName && typeof share.shareName === 'string' && share.shareName.trim() !== '') {
                uniqueAsxCodes.add(share.shareName.trim().toUpperCase());
        }
    });
    if (uniqueAsxCodes.size === 0) {
        asxCodeButtonsContainer.style.display = 'none';
        return;
    } else {
        asxCodeButtonsContainer.style.display = 'flex';
    }
    const sortedAsxCodes = Array.from(uniqueAsxCodes).sort();
    sortedAsxCodes.forEach(asxCode => {
        const button = document.createElement('button');
        button.className = 'asx-code-btn'; // Changed from asx-code-button to asx-code-btn
        button.textContent = asxCode;
        button.dataset.asxCode = asxCode;
        asxCodeButtonsContainer.appendChild(button);
        button.addEventListener('click', (event) => {
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
        }
        showShareDetails(); 
    } else {
        showCustomAlert(`Share '${asxCode}' not found.`);
    }
}

// Financial Calculation Functions (Australian context)
const COMPANY_TAX_RATE = 0.30; // 30% company tax rate
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

// Calculator Functions
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

// Theme Toggling Logic
function applyTheme(themeName) {
    const body = document.body;
    // Remove all existing theme classes (both 'dark-theme' and 'theme-X')
    body.className = body.className.split(' ').filter(c => !c.startsWith('theme-') && c !== 'dark-theme').join(' ');

    if (themeName && themeName !== 'none') {
        body.classList.add(`theme-${themeName}`);
        localStorage.setItem('selectedTheme', themeName);
        localStorage.removeItem('theme'); // Clear default light/dark preference if custom theme is selected
        console.log(`[Theme] Applied custom theme: ${themeName}. Body class: ${body.className}`);
    } else { // themeName is 'none' (revert to default)
        localStorage.removeItem('selectedTheme'); // Always clear custom theme preference

        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        let effectiveDefaultTheme = localStorage.getItem('theme'); // Get previously saved default preference

        // If no explicit default preference saved, use system preference as the new saved default
        if (!effectiveDefaultTheme) {
            effectiveDefaultTheme = systemPrefersDark ? 'dark' : 'light';
            localStorage.setItem('theme', effectiveDefaultTheme); // Explicitly save this default
            console.log(`[Theme] No default theme preference found, setting to system preference: ${effectiveDefaultTheme} and saving.`);
        } else {
            console.log(`[Theme] Using previously saved default theme: ${effectiveDefaultTheme}`);
        }

        // Apply the determined default theme
        if (effectiveDefaultTheme === 'dark') {
            body.classList.add('dark-theme');
        } else {
            body.classList.remove('dark-theme');
        }
        console.log(`[Theme] Reverted to default theme: ${effectiveDefaultTheme}. Body class: ${body.className}`);
    }
    updateThemeToggleAndSelector();
}

function updateThemeToggleAndSelector() {
    const currentCustomTheme = localStorage.getItem('selectedTheme');
    const currentDefaultTheme = localStorage.getItem('theme'); // 'light' or 'dark'

    // Update theme toggle button icon
    if (themeToggleBtn) {
        // The "Toggle Theme" button always uses the palette icon now.
        // Its text doesn't need to change based on light/dark.
        themeToggleBtn.innerHTML = '<i class="fas fa-palette"></i> Toggle Theme';
    }

    // Update theme selector dropdown
    if (colorThemeSelect) {
        if (currentCustomTheme) {
            colorThemeSelect.value = currentCustomTheme;
            // Update currentCustomThemeIndex to match the selected theme
            currentCustomThemeIndex = CUSTOM_THEMES.indexOf(currentCustomTheme);
            console.log(`[Theme Selector] Set dropdown to custom theme: ${currentCustomTheme}`);
        } else {
            colorThemeSelect.value = 'none'; // Select "No Custom Theme"
            currentCustomThemeIndex = -1; // Reset index if no custom theme
            console.log(`[Theme Selector] Set dropdown to "No Custom Theme".`);
        }
    }
}

// Function to apply the default light/dark theme based on localStorage or system preference
// This function needs to be defined BEFORE it's called in initializeAppLogic.
function applyDefaultLightDarkTheme() {
    const body = document.body;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let savedDefaultTheme = localStorage.getItem('theme'); // 'light' or 'dark'

    // Remove all custom theme classes
    body.className = body.className.split(' ').filter(c => !c.startsWith('theme-') && c !== 'dark-theme').join(' ');

    if (!savedDefaultTheme) {
        // If no explicit default preference saved, use system preference and save it
        savedDefaultTheme = systemPrefersDark ? 'dark' : 'light';
        localStorage.setItem('theme', savedDefaultTheme);
        console.log(`[Theme] No explicit default theme found, setting to system preference: ${savedDefaultTheme} and saving.`);
    } else {
        console.log(`[Theme] Using previously saved default theme: ${savedDefaultTheme}`);
    }

    if (savedDefaultTheme === 'dark') {
        body.classList.add('dark-theme');
    } else {
        body.classList.remove('dark-theme');
    }
    console.log(`[Theme] Applied default theme: ${savedDefaultTheme}. Body class: ${body.className}`);
    updateThemeToggleAndSelector(); // Update the UI elements for theme selection
}


// Watchlist ID generation
function getDefaultWatchlistId(userId) {
    return `${userId}_${DEFAULT_WATCHLIST_ID_SUFFIX}`;
}

// Save the last selected watchlist ID to user's profile
async function saveLastSelectedWatchlistId(watchlistId) {
    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Watchlist] Cannot save last selected watchlist: DB, User ID, or Firestore functions not available.");
        return;
    }
    const userProfileDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`);
    try {
        await window.firestore.setDoc(userProfileDocRef, { lastSelectedWatchlistId: watchlistId }, { merge: true });
        console.log(`[Watchlist] Saved last selected watchlist ID: ${watchlistId}`);
    }
    catch (error) {
        console.error("[Watchlist] Error saving last selected watchlist ID:", error);
    }
}

// Save the last selected sort order to user's profile
async function saveSortOrderPreference(sortValue) {
    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Sort] Cannot save sort order preference: DB, User ID, or Firestore functions not available.");
        return;
    }
    const userProfileDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`);
    try {
        await window.firestore.setDoc(userProfileDocRef, { lastSelectedSortOrder: sortValue }, { merge: true });
        console.log(`[Sort] Saved last selected sort order: ${sortValue}`);
    }
    catch (error) {
        console.error("[Sort] Error saving sort order preference:", error);
    }
}

// Load user preferences (watchlist and sort order) from Firestore
async function loadUserPreferences() {
    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Preferences] Firestore DB, User ID, or Firestore functions not available for loading preferences.");
        return;
    }
    const userProfileDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`);

    try {
        console.log("[Preferences] Fetching user preferences...");
        const userProfileSnap = await window.firestore.getDoc(userProfileDocRef);
        let lastSelectedWatchlistId = null;
        let lastSelectedSortOrder = '';

        if (userProfileSnap.exists()) {
            const data = userProfileSnap.data();
            lastSelectedWatchlistId = data.lastSelectedWatchlistId;
            lastSelectedSortOrder = data.lastSelectedSortOrder || '';
            console.log(`[Preferences] Found last selected watchlist: ${lastSelectedWatchlistId}, Sort Order: ${lastSelectedSortOrder}`);
        } else {
            console.log("[Preferences] No user profile settings found.");
        }

        // Load watchlists first
        userWatchlists = [];
        const watchlistsColRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`);
        const querySnapshot = await window.firestore.getDocs(watchlistsColRef);
        querySnapshot.forEach(doc => { userWatchlists.push({ id: doc.id, name: doc.data().name }); });
        console.log(`[Watchlist] Found ${userWatchlists.length} existing watchlists.`);

        if (userWatchlists.length === 0) {
            const defaultWatchlistRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists/${getDefaultWatchlistId(currentUserId)}`);
            await window.firestore.setDoc(defaultWatchlistRef, { name: DEFAULT_WATCHLIST_NAME, createdAt: new Date().toISOString() });
            userWatchlists.push({ id: getDefaultWatchlistId(currentUserId), name: DEFAULT_WATCHLIST_NAME });
            console.log("[Watchlist] Created default watchlist.");
        }
        userWatchlists.sort((a, b) => a.name.localeCompare(b.name));

        let targetWatchlist = null;
        if (lastSelectedWatchlistId) { targetWatchlist = userWatchlists.find(w => w.id === lastSelectedWatchlistId); }
        if (!targetWatchlist) { targetWatchlist = userWatchlists.find(w => w.name === DEFAULT_WATCHLIST_NAME); }
        if (!targetWatchlist && userWatchlists.length > 0) { targetWatchlist = userWatchlists[0]; }

        if (targetWatchlist) {
            currentWatchlistId = targetWatchlist.id;
            currentWatchlistName = targetWatchlist.name;
            console.log(`[Watchlist] Setting current watchlist to: '${currentWatchlistName}' (ID: ${currentWatchlistId})`);
        } else {
            currentWatchlistId = null;
            currentWatchlistName = 'No Watchlist Selected';
            console.log("[Watchlist] No watchlists available. Current watchlist set to null.");
        }

        renderWatchlistSelect();
        
        // Apply sort order preference
        if (sortSelect) {
            if (lastSelectedSortOrder && Array.from(sortSelect.options).some(option => option.value === lastSelectedSortOrder)) {
                sortSelect.value = lastSelectedSortOrder;
                console.log(`[Sort] Applied saved sort order: ${lastSelectedSortOrder}. Current sortSelect.value: ${sortSelect.value}`);
            } else {
                sortSelect.value = ''; // Reset to placeholder if no saved or invalid
                console.log("[Sort] No valid saved sort order found or sortSelect not available, resetting sort dropdown.");
            }
            renderSortSelect(); // Ensure placeholder is correctly set if no value
        }

        const migratedSomething = await migrateOldSharesToWatchlist();
        if (!migratedSomething) {
            console.log("[Watchlist] No old shares to migrate/update, directly loading shares for current watchlist.");
            await loadShares();
        }

    } catch (error) {
        console.error("[Preferences] Error loading user preferences:", error);
        showCustomAlert("Error loading user preferences: " + error.message);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}


// Load shares from Firestore
async function loadShares() {
    if (!db || !currentUserId || !currentWatchlistId || !window.firestore) {
        console.warn("[Shares] Firestore DB, User ID, Watchlist ID, or Firestore functions not available for loading shares. Clearing list.");
        clearShareList();
        return;
    }
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    allSharesData = [];
    try {
        const sharesCol = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
        const q = window.firestore.query( sharesCol, window.firestore.where("watchlistId", "==", currentWatchlistId) );
        console.log(`[Shares] Attempting to load shares for watchlist ID: ${currentWatchlistId} (Name: ${currentWatchlistName})`);
        const querySnapshot = await window.firestore.getDocs(q);
        querySnapshot.forEach((doc) => {
            const share = { id: doc.id, ...doc.data() };
            allSharesData.push(share);
        });
        console.log(`[Shares] Shares loaded successfully for watchlist: '${currentWatchlistName}' (ID: ${currentWatchlistId}). Total shares: ${allSharesData.length}`);
        console.log("[Shares] All shares data (after load):", allSharesData);
        sortShares(); // Apply sorting after loading shares
        renderAsxCodeButtons();
    } catch (error) {
        console.error("[Shares] Error loading shares:", error);
        showCustomAlert("Error loading shares: " + error.message);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// One-time migration function for old shares
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
            console.log("[Migration] Migration complete. Reloading shares.");
            await loadShares();
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

// --- TOGGLE SIDEBAR FUNCTION (MOVED TO GLOBAL SCOPE) ---
function toggleAppSidebar(forceState = null) {
    const isDesktop = window.innerWidth > 768;
    const isOpen = appSidebar.classList.contains('open');

    if (forceState === true || (forceState === null && !isOpen)) {
        appSidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
        if (isDesktop) {
            document.body.classList.add('sidebar-active');
            sidebarOverlay.style.pointerEvents = 'none';
        } else {
            document.body.classList.remove('sidebar-active');
            sidebarOverlay.style.pointerEvents = 'auto';
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

// --- Main Application Logic Initialization Function ---
// This function will be called ONLY when Firebase is confirmed ready.
async function initializeAppLogic() {
    console.log("initializeAppLogic: Firebase is ready. Starting app logic.");

    // --- Initial UI Setup (moved from DOMContentLoaded) ---
    if (shareFormSection) shareFormSection.style.setProperty('display', 'none', 'important');
    if (dividendCalculatorModal) dividendCalculatorModal.style.setProperty('display', 'none', 'important');
    if (shareDetailModal) shareDetailModal.style.setProperty('display', 'none', 'important');
    if (addWatchlistModal) addWatchlistModal.style.setProperty('display', 'none', 'important');
    if (manageWatchlistModal) manageWatchlistModal.style.setProperty('display', 'none', 'important');
    if (customDialogModal) customDialogModal.style.setProperty('display', 'none', 'important');
    if (calculatorModal) calculatorModal.style.setProperty('display', 'none', 'important');
    
    // Buttons will be enabled based on auth state, not here directly
    // This call is now redundant here as it will be called after loadUserPreferences in onAuthStateChanged
    // updateMainButtonsState(false); 
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    renderWatchlistSelect(); // Render initial empty watchlist select
    
    // Apply theme on initial load
    const savedCustomTheme = localStorage.getItem('selectedTheme');
    if (savedCustomTheme) {
        applyTheme(savedCustomTheme);
    } else {
        applyDefaultLightDarkTheme(); // This is the call that was causing the error due to definition order
    }
    updateThemeToggleAndSelector();

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js', { scope: './' }) 
                .then(registration => {
                    console.log('Service Worker (v46) from script.js: Registered with scope:', registration.scope); 
                })
                .catch(error => {
                    console.error('Service Worker (v46) from script.js: Registration failed:', error);
                });
        });
    }

    // --- Event Listeners for Input Fields ---
    if (shareNameInput) {
        shareNameInput.addEventListener('input', function() { this.value = this.value.toUpperCase(); });
    }
    formInputs.forEach((input, index) => {
        if (input) {
            input.addEventListener('keydown', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    if (index === formInputs.length - 1) {
                        if (addCommentSectionBtn && addCommentSectionBtn.offsetParent !== null) { // Check if visible
                            addCommentSectionBtn.click();
                        } else if (saveShareBtn) { saveShareBtn.click(); }
                    } else {
                        if (formInputs[index + 1]) formInputs[index + 1].focus();
                    }
                }
            });
        }
    });

    if (addCommentSectionBtn) {
        addCommentSectionBtn.addEventListener('click', () => addCommentSection());
    }

    // --- Event Listeners for Modal Close Buttons ---
    document.querySelectorAll('.close-button').forEach(button => { button.addEventListener('click', closeModals); });

    // --- Event Listener for Clicking Outside Modals ---
    window.addEventListener('click', (event) => {
        if (event.target === shareDetailModal || event.target === dividendCalculatorModal ||
            event.target === shareFormSection || event.target === customDialogModal ||
            event.target === calculatorModal || event.target === addWatchlistModal ||
            event.target === manageWatchlistModal) {
            closeModals();
        }
    });

    // --- Authentication Functions Event Listener ---
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

    // --- Event Listener for Watchlist Dropdown ---
    if (watchlistSelect) {
        watchlistSelect.addEventListener('change', async () => {
            currentWatchlistId = watchlistSelect.value;
            const selectedWatchlistObj = userWatchlists.find(w => w.id === currentWatchlistId);
            if (selectedWatchlistObj) {
                currentWatchlistName = selectedWatchlistObj.name;
                console.log(`[Watchlist Change] User selected: '${currentWatchlistName}' (ID: ${currentWatchlistId})`);
                await saveLastSelectedWatchlistId(currentWatchlistId);
                await loadShares();
            }
        });
    }

    // --- Event Listener for Sort Dropdown ---
    if (sortSelect) {
        sortSelect.addEventListener('change', async () => { // Made async to save preference
            sortShares();
            await saveSortOrderPreference(sortSelect.value); // Save preference on change
        });
    }

    // --- Share Form Functions (Add/Edit) Event Listeners ---
    if (newShareBtn) {
        newShareBtn.addEventListener('click', () => {
            clearForm();
            formTitle.textContent = 'Add New Share';
            deleteShareFromFormBtn.style.display = 'none';
            showModal(shareFormSection);
            shareNameInput.focus();
            toggleAppSidebar(false); 
        });
    }

    if (addShareHeaderBtn) {
        addShareHeaderBtn.addEventListener('click', () => {
            clearForm();
            formTitle.textContent = 'Add New Share';
            deleteShareFromFormBtn.style.display = 'none';
            showModal(shareFormSection);
            shareNameInput.focus();
        });
    }

    if (saveShareBtn) {
        saveShareBtn.addEventListener('click', async () => {
            // Disable button immediately to prevent multiple clicks
            saveShareBtn.disabled = true;

            const shareName = shareNameInput.value.trim().toUpperCase();
            if (!shareName) { 
                showCustomAlert("Code is required!"); 
                saveShareBtn.disabled = false; // Re-enable on validation failure
                return; 
            }

            const currentPrice = parseFloat(currentPriceInput.value);
            const targetPrice = parseFloat(targetPriceInput.value);
            const dividendAmount = parseFloat(dividendAmountInput.value);
            const frankingCredits = parseFloat(frankingCreditsInput.value);

            const comments = [];
            commentsFormContainer.querySelectorAll('.comment-section').forEach(section => {
                const title = section.querySelector('.comment-title-input').value.trim();
                const text = section.querySelector('.comment-text-input').value.trim();
                if (title || text) { // Only save if there's content
                    comments.push({ title: title, text: text });
                }
            });

            const shareData = {
                shareName: shareName,
                currentPrice: isNaN(currentPrice) ? null : currentPrice,
                targetPrice: isNaN(targetPrice) ? null : targetPrice,
                dividendAmount: isNaN(dividendAmount) ? null : dividendAmount,
                frankingCredits: isNaN(frankingCredits) ? null : frankingCredits,
                comments: comments, // Save the collected comments array
                userId: currentUserId,
                watchlistId: currentWatchlistId,
                lastPriceUpdateTime: new Date().toISOString()
            };

            try {
                if (selectedShareDocId) {
                    const existingShare = allSharesData.find(s => s.id === selectedShareDocId);
                    // Preserve previousFetchedPrice if it exists, otherwise use currentPrice
                    shareData.previousFetchedPrice = existingShare ? existingShare.lastFetchedPrice : shareData.currentPrice;
                    shareData.lastFetchedPrice = shareData.currentPrice; // Update lastFetchedPrice to current input

                    const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, selectedShareDocId);
                    await window.firestore.updateDoc(shareDocRef, shareData);
                    showCustomAlert(`Share '${shareName}' updated successfully!`, 1500);
                    console.log(`[Firestore] Share '${shareName}' (ID: ${selectedShareDocId}) updated.`);
                } else {
                    shareData.entryDate = new Date().toISOString();
                    shareData.lastFetchedPrice = shareData.currentPrice;
                    shareData.previousFetchedPrice = shareData.currentPrice; // For new shares, prev and last are the same initially

                    const sharesColRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
                    const newDocRef = await window.firestore.addDoc(sharesColRef, shareData);
                    selectedShareDocId = newDocRef.id;
                    showCustomAlert(`Share '${shareName}' added successfully!`, 1500);
                    console.log(`[Firestore] Share '${shareName}' added with ID: ${newDocRef.id}`);
                }
                await loadShares();
                closeModals();
            } catch (error) {
                console.error("[Firestore] Error saving share:", error);
                showCustomAlert("Error saving share: " + error.message);
            } finally {
                // Re-enable button regardless of success or failure
                saveShareBtn.disabled = false;
            }
        });
    }

    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', () => { clearForm(); hideModal(shareFormSection); console.log("[Form] Form canceled."); });
    }

    if (deleteShareFromFormBtn) {
        deleteShareFromFormBtn.addEventListener('click', () => {
            if (selectedShareDocId) {
                showCustomConfirm("Are you sure you want to delete this share? This action cannot be undone.", async () => {
                    try {
                        const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, selectedShareDocId);
                        await window.firestore.deleteDoc(shareDocRef);
                        showCustomAlert("Share deleted successfully!", 1500);
                        console.log(`[Firestore] Share (ID: ${selectedShareDocId}) deleted.`);
                        closeModals();
                        await loadShares();
                    } catch (error) {
                        console.error("[Firestore] Error deleting share:", error);
                        showCustomAlert("Error deleting share: " + error.message);
                    }
                });
            } else { showCustomAlert("No share selected for deletion."); }
        });
    }

    // --- Share Detail Modal Functions Event Listeners ---
    if (editShareFromDetailBtn) {
        editShareFromDetailBtn.addEventListener('click', () => {
            hideModal(shareDetailModal);
            showEditFormForSelectedShare();
        });
    }

    // --- Add Watchlist Modal Functions Event Listeners ---
    if (addWatchlistBtn) {
        addWatchlistBtn.addEventListener('click', () => {
            if (newWatchlistNameInput) newWatchlistNameInput.value = '';
            showModal(addWatchlistModal);
            newWatchlistNameInput.focus();
            toggleAppSidebar(false);
        });
    }

    if (saveWatchlistBtn) {
        saveWatchlistBtn.addEventListener('click', async () => {
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
                
                currentWatchlistId = newWatchlistRef.id;
                currentWatchlistName = watchlistName;
                await saveLastSelectedWatchlistId(currentWatchlistId);
                await loadUserPreferences(); // Reload all user preferences including watchlists
                await loadShares();

            } catch (error) {
                console.error("[Firestore] Error adding watchlist:", error);
                showCustomAlert("Error adding watchlist: " + error.message);
            }
        });
    }

    if (cancelAddWatchlistBtn) {
        cancelAddWatchlistBtn.addEventListener('click', () => {
            hideModal(addWatchlistModal);
            if (newWatchlistNameInput) newWatchlistNameInput.value = '';
            console.log("[Watchlist] Add Watchlist canceled.");
        });
    }

    // --- Manage Watchlist Modal (Edit/Delete) Functions ---
    if (editWatchlistBtn) {
        editWatchlistBtn.addEventListener('click', () => {
            if (!currentWatchlistId) {
                showCustomAlert("Please select a watchlist to edit.");
                return;
            }
            editWatchlistNameInput.value = currentWatchlistName;
            deleteWatchlistInModalBtn.disabled = userWatchlists.length <= 1;
            showModal(manageWatchlistModal);
            editWatchlistNameInput.focus();
            toggleAppSidebar(false);
        });
    }

    if (saveWatchlistNameBtn) {
        saveWatchlistNameBtn.addEventListener('click', async () => {
            const newName = editWatchlistNameInput.value.trim();
            if (!newName) {
                showCustomAlert("Watchlist name cannot be empty!");
                return;
            }
            if (newName === currentWatchlistName) {
                showCustomAlert("Watchlist name is already the same.");
                hideModal(manageWatchlistModal);
                return;
            }
            if (userWatchlists.some(w => w.name.toLowerCase() === newName.toLowerCase() && w.id !== currentWatchlistId)) {
                showCustomAlert("A watchlist with this name already exists!");
                return;
            }

            try {
                const watchlistDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`, currentWatchlistId);
                await window.firestore.updateDoc(watchlistDocRef, { name: newName });
                showCustomAlert(`Watchlist renamed to '${newName}'!`, 1500);
                console.log(`[Firestore] Watchlist (ID: ${currentWatchlistId}) renamed to '${newName}'.`);
                hideModal(manageWatchlistModal);
                currentWatchlistName = newName;
                await loadUserPreferences(); // Reload all user preferences including watchlists
                await loadShares();
            } catch (error) {
                console.error("[Firestore] Error renaming watchlist:", error);
                showCustomAlert("Error renaming watchlist: " + error.message);
            }
        });
    }

    if (deleteWatchlistInModalBtn) {
        deleteWatchlistInModalBtn.addEventListener('click', () => {
            if (!currentWatchlistId || userWatchlists.length <= 1) {
                showCustomAlert("Cannot delete the last watchlist. Please create another watchlist first.");
                return;
            }
            const watchlistToDeleteName = currentWatchlistName;
            showCustomConfirm(`Are you sure you want to delete the watchlist '${watchlistToDeleteName}'? ALL SHARES IN THIS WATCHLIST WILL BE PERMANENTLY DELETED. This action cannot be undone.`, async () => {
                try {
                    const sharesColRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
                    const q = window.firestore.query(sharesColRef, window.firestore.where("watchlistId", "==", currentWatchlistId));
                    const querySnapshot = await window.firestore.getDocs(q);

                    const batch = window.firestore.writeBatch(db);
                    querySnapshot.forEach(doc => {
                        const shareRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, doc.id);
                        batch.delete(shareRef);
                    });
                    await batch.commit();
                    console.log(`[Firestore] Deleted ${querySnapshot.docs.length} shares from watchlist '${watchlistToDeleteName}'.`);

                    const watchlistDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`, currentWatchlistId);
                    await window.firestore.deleteDoc(watchlistDocRef);
                    console.log(`[Firestore] Watchlist '${watchlistToDeleteName}' (ID: ${currentWatchlistId}) deleted.`);

                    showCustomAlert(`Watchlist '${watchlistToDeleteName}' and its shares deleted successfully!`, 2000);
                    closeModals();

                    await loadUserPreferences(); // Reload all user preferences including watchlists
                    await loadShares();
                } catch (error) {
                    console.error("[Firestore] Error deleting watchlist:", error);
                    showCustomAlert("Error deleting watchlist: " + error.message);
                }
            });
        });
    }

    if (cancelManageWatchlistBtn) {
        cancelManageWatchlistBtn.addEventListener('click', () => {
            hideModal(manageWatchlistModal);
            editWatchlistNameInput.value = '';
            console.log("[Watchlist] Manage Watchlist canceled.");
        });
    }


    // --- Dividend Calculator Functions Event Listeners ---
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

    // --- Standard Calculator Functions Event Listeners ---
    if (standardCalcBtn) {
        standardCalcBtn.addEventListener('click', () => {
            resetCalculator();
            showModal(calculatorModal);
            console.log("[UI] Standard Calculator modal opened.");
            toggleAppSidebar(false);
        });
    }

    if (calculatorButtons) {
        calculatorButtons.addEventListener('click', (event) => {
            const target = event.target;
            if (!target.classList.contains('calc-btn')) { return; }
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
        if (action === 'percentage') { if (currentCalculatorInput === '') return; currentCalculatorInput = (parseFloat(currentCalculatorInput) / 100).toString(); updateCalculatorDisplay(); return; }
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

    // Listen for system theme changes (if no explicit saved theme is set)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        // Only react to system changes if no custom theme is selected AND no explicit default theme is saved
        if (!localStorage.getItem('selectedTheme') && !localStorage.getItem('theme')) {
            if (event.matches) {
                document.body.classList.add('dark-theme');
                localStorage.setItem('theme', 'dark'); // Save this system preference as the default
            } else {
                document.body.classList.remove('dark-theme');
                localStorage.setItem('theme', 'light'); // Save this system preference as the default
            }
            console.log("[Theme] System theme preference changed and applied as new default.");
            updateThemeToggleAndSelector();
        } else {
            console.log("[Theme] System theme preference changed, but custom or explicit default theme is active, so not applying.");
        }
    });

    // --- Scroll-to-Top Button Logic ---
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
        }
        scrollToTopBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); console.log("[UI] Scrolled to top."); });
    }

    // --- Hamburger/Sidebar Menu Logic Event Listeners ---
    if (hamburgerBtn && appSidebar && closeMenuBtn && sidebarOverlay) {
        hamburgerBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleAppSidebar();
        });
        closeMenuBtn.addEventListener('click', () => toggleAppSidebar(false));
        
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
        });

        const menuButtons = appSidebar.querySelectorAll('.menu-button-item');
        menuButtons.forEach(button => {
            if (button.dataset.actionClosesMenu === 'true') { 
                button.addEventListener('click', () => {
                    toggleAppSidebar(false);
                });
            }
        });
    }

} // End initializeAppLogic

// --- DOMContentLoaded Event Listener (Main entry point) ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("script.js (v120) DOMContentLoaded fired."); // Updated version number

    // Check if Firebase objects are available from the module script in index.html
    // If they are, proceed with setting up the auth state listener.
    // If not, it means Firebase initialization failed in index.html, and an.
    if (window.firestoreDb && window.firebaseAuth && window.getFirebaseAppId && window.firestore && window.authFunctions) {
        db = window.firestoreDb;
        auth = window.firebaseAuth;
        currentAppId = window.getFirebaseAppId();
        console.log("[Firebase Ready] DB, Auth, and AppId assigned from window. Setting up auth state listener.");
        
        // Listen for auth state changes to trigger the main app logic
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
                if (loadingIndicator) loadingIndicator.style.display = 'block';
                await loadUserPreferences(); // This populates userWatchlists and loads last sort order
                // Enable main buttons AFTER user preferences and watchlists are loaded
                updateMainButtonsState(true); // <--- MOVED HERE to ensure data is ready
            } else {
                currentUserId = null;
                updateAuthButtonText(false);
                mainTitle.textContent = "Share Watchlist";
                console.log("[AuthState] User signed out.");
                updateMainButtonsState(false);
                clearShareList();
                clearWatchlistUI();
                if (loadingIndicator) loadingIndicator.style.display = 'none';
            }
            // This ensures initializeAppLogic runs only once after the initial auth state is determined
            // It's crucial that this runs *after* the user state is known, as many UI elements depend on it.
            if (!window._appLogicInitialized) {
                initializeAppLogic();
                window._appLogicInitialized = true; // Prevent re-running
            }
        });
        
        // Enable the Google Auth button immediately if Firebase is available
        if (googleAuthBtn) {
            googleAuthBtn.disabled = false;
            console.log("[Auth] Google Auth button enabled on DOMContentLoaded.");
        }

    } else {
        console.error("[Firebase] Firebase objects (db, auth, appId, firestore, authFunctions) are not available on DOMContentLoaded. Firebase initialization likely failed in index.html.");
        // The error message for missing config is already displayed by index.html
        updateAuthButtonText(false);
        updateMainButtonsState(false);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}); // End DOMContentLoaded
