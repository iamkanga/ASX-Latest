// File Version: v122 (Updated by Gemini for Firebase errors and robustness)
// Last Updated: 2025-06-28 (Added detailed logging for button clicks and Firebase auth)

// This script interacts with Firebase Firestore for data storage.
// Firebase app, db, auth instances, and userId are made globally available
// via window.firestoreDb, window.firebaseAuth, window.getFirebaseAppId(), etc.,
// from the <script type="module"> block in index.html.

// --- Global State Variables ---
let db;
let auth = null;
let currentUserId = null;
let currentAppId; // This will be set from window.getFirebaseAppId()
let selectedShareDocId = null;
let allSharesData = [];
let currentDialogCallback = null;
let autoDismissTimeout = null;
const KANGA_EMAIL = 'iamkanga@gmail.com';
let currentCalculatorInput = '';
let operator = null;
let previousCalculatorInput = '';
let resultDisplayed = false;
const DEFAULT_WATCHLIST_NAME = 'My Watchlist (Default)';
const DEFAULT_WATCHLIST_ID_SUFFIX = 'default';
let userWatchlists = [];
let currentWatchlistId = null;
let currentWatchlistName = '';

// --- UI Element References (Declared globally for access by all functions, populated in DOMContentLoaded) ---
let mainTitle;
let addShareHeaderBtn;
let newShareBtn;
let standardCalcBtn;
let dividendCalcBtn;
let asxCodeButtonsContainer;
let shareFormSection;
let formCloseButton;
let formTitle;
let saveShareBtn;
let cancelFormBtn;
let deleteShareFromFormBtn;
let shareNameInput;
let currentPriceInput;
let targetPriceInput;
let dividendAmountInput;
let frankingCreditsInput;
let commentsFormContainer;
let addCommentSectionBtn;
let shareTableBody;
let mobileShareCardsContainer;
let loadingIndicator;
let googleAuthBtnSidebar; // Specific reference for sidebar button
let googleAuthBtnFooter; // Specific reference for footer button
let shareDetailModal;
let modalShareName;
let modalEntryDate;
let modalEnteredPrice;
let modalEnteredPriceDateTime;
let modalTargetPrice;
let modalDividendAmount;
let modalFrankingCredits;
let modalCommentsContainer;
let modalUnfrankedYieldSpan;
let modalFrankedYieldSpan;
let editShareFromDetailBtn;
let modalMarketIndexLink;
let modalFoolLink;
let modalCommSecLink;
let commSecLoginMessage;
let dividendCalculatorModal;
let calcCloseButton;
let calcCurrentPriceInput;
let calcDividendAmountInput;
let calcFrankingCreditsInput;
let calcUnfrankedYieldSpan;
let calcFrankedYieldSpan;
let investmentValueSelect;
let calcEstimatedDividend;
let sortSelect;
let customDialogModal;
let customDialogMessage;
let customDialogConfirmBtn;
let customDialogCancelBtn;
let calculatorModal;
let calculatorInput;
let calculatorResult;
let calculatorButtons;
let watchlistSelect;
let themeToggleBtn;
let scrollToTopBtn;
let hamburgerBtn;
let appSidebar;
let closeMenuBtn;
let sidebarOverlay;
let addWatchlistBtn;
let editWatchlistBtn;
let addWatchlistModal;
let newWatchlistNameInput;
let saveWatchlistBtn;
let cancelAddWatchlistBtn;
let manageWatchlistModal;
let editWatchlistNameInput;
let saveWatchlistNameBtn;
let deleteWatchlistInModalBtn;
let cancelManageWatchlistBtn;

// Array of all form input elements for easy iteration and form clearing (excluding dynamic comments)
let formInputs = []; // Initialized here, populated in DOMContentLoaded

// --- Core Helper Functions (Declared globally for immediate availability) ---

function toggleAppSidebar(force) {
    const isSidebarOpen = appSidebar.classList.contains('open');
    const isForcedOpen = (typeof force === 'boolean' && force === true);
    const isForcedClosed = (typeof force === 'boolean' && force === false);

    let targetState;
    if (isForcedOpen) { targetState = true; }
    else if (isForcedClosed) { targetState = false; }
    else { targetState = !isSidebarOpen; }

    if (targetState) {
        appSidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
        document.body.classList.add('sidebar-active');
        document.documentElement.style.overflowX = 'hidden';
        document.body.style.overflowX = 'hidden';
        document.body.style.overflowY = 'hidden';
    } else {
        appSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
        document.body.classList.remove('sidebar-active');
        document.documentElement.style.overflowX = '';
        document.body.style.overflowX = '';
        document.body.style.overflowY = '';
    }
    console.log(`[Menu] App sidebar toggled. Open: ${appSidebar.classList.contains('open')}`);
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        if (modal) {
            modal.classList.remove('open');
        }
    });
    resetCalculator();
    deselectCurrentShare();
    if (autoDismissTimeout) { clearTimeout(autoDismissTimeout); autoDismissTimeout = null; }
    console.log("[Modals] All modals closed.");
}

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
    console.log(`[Alert] Showing alert: "${message}" for ${duration}ms.`);
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
    customDialogConfirmBtn.onclick = () => { hideModal(customDialogModal); if (onConfirm) onConfirm(); currentDialogCallback = null; console.log("[Confirm] Confirmed."); };
    customDialogCancelBtn.onclick = () => { hideModal(customDialogModal); if (onCancel) onCancel(); currentDialogCallback = null; console.log("[Confirm] Canceled."); };
    currentDialogCallback = () => { hideModal(customDialogModal); if (onCancel) onCancel(); currentDialogCallback = null; };
    console.log(`[Confirm] Showing confirm: "${message}"`);
}

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

function updateAuthButtonText(isSignedIn, userName = 'Sign In') {
    const buttonText = isSignedIn ? (userName || 'Signed In') : 'Sign In';
    if (googleAuthBtnSidebar) {
        googleAuthBtnSidebar.textContent = buttonText;
        console.log(`[Auth UI] Sidebar Google Auth button text updated to: ${buttonText}`);
    } else {
        console.warn("[Auth UI] googleAuthBtnSidebar element not found when trying to update text.");
    }
    if (googleAuthBtnFooter) {
        googleAuthBtnFooter.textContent = buttonText;
        console.log(`[Auth UI] Footer Google Auth button text updated to: ${buttonText}`);
    } else {
        console.warn("[Auth UI] googleAuthBtnFooter element not found when trying to update text.");
    }
}

function updateMainButtonsState(enable) {
    if (newShareBtn) newShareBtn.disabled = !enable;
    if (standardCalcBtn) standardCalcBtn.disabled = !enable;
    if (dividendCalcBtn) dividendCalcBtn.disabled = !enable;
    if (watchlistSelect) watchlistSelect.disabled = !enable;
    if (addWatchlistBtn) addWatchlistBtn.disabled = !enable;
    // Disable edit/delete watchlist if there's only one watchlist, regardless of auth state
    const disableEditDeleteWatchlist = !enable || userWatchlists.length <= 1;
    if (editWatchlistBtn) editWatchlistBtn.disabled = disableEditDeleteWatchlist;
    if (deleteWatchlistInModalBtn) deleteWatchlistInModalBtn.disabled = disableEditDeleteWatchlist;
    if (addShareHeaderBtn) addShareHeaderBtn.disabled = !enable;

    if (themeToggleBtn) {
        themeToggleBtn.disabled = false; // Theme toggle is always enabled
    }
    console.log(`[UI State] Main buttons enabled: ${enable}. Watchlist edit/delete disabled if only one watchlist: ${disableEditDeleteWatchlist}`);
}

function showModal(modalElement) {
    if (modalElement) {
        modalElement.classList.add('open');
        modalElement.scrollTop = 0;
        console.log(`[Modal] Opened modal: ${modalElement.id}`);
    } else {
        console.error("[Modal] Attempted to open null modal element.");
    }
}

function hideModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('open');
        console.log(`[Modal] Closed modal: ${modalElement.id}`);
    } else {
        console.warn("[Modal] Attempted to close null modal element.");
    }
}

function clearWatchlistUI() {
    if (watchlistSelect) watchlistSelect.innerHTML = '';
    userWatchlists = [];
    renderWatchlistSelect();
    renderSortSelect();
    console.log("[UI] Watchlist UI cleared.");
}

function clearShareListUI() {
    if (shareTableBody) shareTableBody.innerHTML = '';
    if (mobileShareCardsContainer) mobileShareCardsContainer.innerHTML = '';
    console.log("[UI] Share list UI cleared.");
}

function clearShareList() {
    clearShareListUI();
    if (asxCodeButtonsContainer) asxCodeButtonsContainer.innerHTML = '';
    deselectCurrentShare();
    console.log("[UI] Full share list cleared (UI + buttons).");
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
    if (!commentsFormContainer) { console.error("[Comments] commentsFormContainer not found."); return; }
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
        console.log("[Comments] Comment section deleted.");
    });
    console.log("[Comments] Added new comment section.");
}

function clearForm() {
    formInputs.forEach(input => {
        if (input) { input.value = ''; }
    });
    if (commentsFormContainer) commentsFormContainer.innerHTML = '';
    addCommentSection();
    selectedShareDocId = null;
    console.log("[Form] Form fields cleared and selectedShareDocId reset.");
}

function showEditFormForSelectedShare() {
    console.log("[Form] Attempting to open edit form.");
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

function showShareDetails() {
    console.log("[Details] Attempting to open share details modal.");
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
    modalEnteredPriceDateTime.textContent = '';

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
    console.log("[UI Update] Watchlist select rendered.");
}

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
    if (!sortSelect.value || sortSelect.value === '') {
        sortSelect.value = '';
    }
    console.log("[UI Update] Sort select rendered.");
}

function addShareToTable(share) {
    if (!shareTableBody) { console.error("[addShareToTable] shareTableBody element not found."); return; }
    const row = shareTableBody.insertRow();
    row.dataset.docId = share.id;
    row.addEventListener('click', (event) => { selectShare(share.id); });
    row.addEventListener('click', (event) => { selectShare(share.id); showShareDetails(); });

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
        const docId = e.currentTarget.dataset.docId;
        selectShare(docId, e.currentTarget);
        showShareDetails();
        e.preventDefault();
    });

    card.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

    console.log(`[Render] Added share ${displayShareName} to mobile cards.`);
}

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
        button.className = 'asx-code-button';
        button.textContent = asxCode;
        button.dataset.asxCode = asxCode;
        asxCodeButtonsContainer.appendChild(button);
        button.addEventListener('click', (event) => {
            console.log(`[ASX Button] Clicked ASX code button: ${event.target.dataset.asxCode}`);
            const clickedCode = event.target.dataset.asxCode;
            selectShare(allSharesData.find(s => s.shareName && s.shareName.toUpperCase() === clickedCode.toUpperCase())?.id);
            showShareDetails();
        });
    });
    console.log(`[UI] Rendered ${sortedAsxCodes.length} code buttons.`);
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

const themes = [
    { name: "Bright Blue", bg: "#e0f2f7", text: "#003366", header: "#a7d9ed", card: "#ffffff", border: "#87c9e0", button: "#007bff", hover: "#0056b3", sidebar: "#a7d9ed", asx_active_text: "#fff" },
    { name: "Sunny Yellow", bg: "#fffbe6", text: "#664d00", header: "#ffe066", card: "#ffffff", border: "#ffcc00", button: "#e6a700", hover: "#b38000", sidebar: "#ffe066", asx_active_text: "#fff" },
    { name: "Vibrant Green", bg: "#e6ffe6", text: "#006600", header: "#a7ed87", card: "#ffffff", border: "#87e087", button: "#28a745", hover: "#218838", sidebar: "#a7ed87", asx_active_text: "#fff" },
    { name: "Energetic Orange", bg: "#fff0e6", text: "#804000", header: "#ffb380", card: "#ffffff", border: "#ff9933", button: "#ff8c00", hover: "#cc7000", sidebar: "#ffb380", asx_active_text: "#fff" },
    { name: "Deep Purple", bg: "#f0e6ff", text: "#4d0066", header: "#cc99ff", card: "#ffffff", border: "#b366ff", button: "#8a2be2", hover: "#6b1fa8", sidebar: "#cc99ff", asx_active_text: "#fff" },
    { name: "Aqua Teal", bg: "#e6fafa", text: "#004d4d", header: "#80e6e6", card: "#ffffff", border: "#4ddede", button: "#008080", hover: "#006666", sidebar: "#80e6e6", asx_active_text: "#fff" },
    { name: "Crimson Red", bg: "#ffe6e6", text: "#660000", header: "#ff8080", card: "#ffffff", border: "#ff3333", button: "#cc0000", hover: "#990000", sidebar: "#ff8080", asx_active_text: "#fff" },
    { name: "Lime Green", bg: "#f0ffe6", text: "#334d00", header: "#ccee99", card: "#ffffff", border: "#aacc66", button: "#66cc00", hover: "#52a300", sidebar: "#ccee99", asx_active_text: "#fff" },
    { name: "Hot Pink", bg: "#ffe6f0", text: "#66004d", header: "#ff99cc", card: "#ffffff", border: "#ff66b3", button: "#ff0080", hover: "#cc0066", sidebar: "#ff99cc", asx_active_text: "#fff" },
    { name: "Gold Rush", bg: "#fffaf0", text: "#664000", header: "#ffdf80", card: "#ffffff", border: "#ffbf00", button: "#d4af37", hover: "#a88a2c", sidebar: "#ffdf80", asx_active_text: "#fff" },
    { name: "Soft Grey", bg: "#f4f7f6", text: "#333", header: "#e6e9eb", card: "#ffffff", border: "#c9d2d4", button: "#6c757d", hover: "#545b62", sidebar: "#e6e9eb", asx_active_text: "#fff" },
    { name: "Muted Blue", bg: "#e9eff2", text: "#4a5568", header: "#c9d5db", card: "#f0f4f7", border: "#aebbc2", button: "#4299e1", hover: "#3182ce", sidebar: "#c9d5db", asx_active_text: "#fff" },
    { name: "Earthy Green", bg: "#f0f5ee", text: "#4a574a", header: "#d1d9cf", card: "#f8fbf7", border: "#b8c2b8", button: "#48bb78", hover: "#38a169", sidebar: "#d1d9cf", asx_active_text: "#fff" },
    { name: "Warm Beige", bg: "#fbf8f3", text: "#6b462f", header: "#e8dcd2", card: "#ffffff", border: "#d4c0b0", button: "#dd6b20", hover: "#c05621", sidebar: "#e8dcd2", asx_active_text: "#fff" },
    { name: "Cool Grey", bg: "#eef2f5", text: "#4c5563", header: "#d4dae0", card: "#f7f9fb", border: "#c0c7cf", button: "#63b3ed", hover: "#4299e1", sidebar: "#d4dae0", asx_active_text: "#fff" },
    { name: "Dusty Rose", bg: "#fcf0f2", text: "#713f48", header: "#ebd2d5", card: "#ffffff", border: "#d9b3b8", button: "#e53e3e", hover: "#c53030", sidebar: "#ebd2d2", asx_active_text: "#fff" },
    { name: "Lavender Mist", bg: "#f5f3fa", text: "#5c4f70", header: "#dcd7e3", card: "#ffffff", border: "#c4b8d0", button: "#805ad5", hover: "#6b46c1", sidebar: "#dcd7e3", asx_active_text: "#fff" },
    { name: "Ocean Breeze", bg: "#e6f7f7", text: "#31708f", header: "#b3e0e0", card: "#ffffff", border: "#80caca", button: "#2b6cb0", hover: "#2c5282", sidebar: "#b3e0e0", asx_active_text: "#fff" },
    { name: "Sandstone", bg: "#fdf8ed", text: "#7b341f", header: "#e8d9c2", card: "#ffffff", border: "#d4b89b", button: "#a05a2c", hover: "#8a4b2b", sidebar: "#e8d9c2", asx_active_text: "#fff" },
    { name: "Forest Night", bg: "#2a363b", text: "#e0e0e0", header: "#3b4a50", card: "#3f5259", border: "#5a6a70", button: "#4a7dff", hover: "#3a6cd9", sidebar: "#3b4a50", asx_active_text: "#fff" }
];

let currentThemeIndex = -1;

function applyTheme(theme) {
    const root = document.documentElement;
    root.style.setProperty('--background-color', theme.bg);
    root.style.setProperty('--text-color', theme.text);
    root.style.setProperty('--header-bg', theme.header);
    root.style.setProperty('--card-bg', theme.card);
    root.style.setProperty('--border-color', theme.border);
    root.style.setProperty('--button-bg', theme.button);
    root.style.setProperty('--button-text', theme.text);
    root.style.setProperty('--button-hover-bg', theme.hover);
    root.style.setProperty('--input-bg', theme.card);
    root.style.setProperty('--input-border', theme.border);
    root.style.setProperty('--modal-bg', 'rgba(0, 0, 0, 0.6)');
    root.style.setProperty('--modal-content-bg', theme.card);
    root.style.setProperty('--table-header-bg', theme.header);
    root.style.setProperty('--table-row-hover-bg', theme.bg);
    root.style.setProperty('--asx-button-bg', theme.header);
    root.style.setProperty('--asx-button-hover-bg', theme.hover);
    root.style.setProperty('--asx-button-text', theme.text);
    root.style.setProperty('--asx-button-active-bg', theme.button);
    root.style.setProperty('--asx-button-active-text', theme.asx_active_text || theme.button);
    root.style.setProperty('--danger-button-bg', '#dc3545');
    root.style.setProperty('--danger-button-hover-bg', '#c82333');
    root.style.setProperty('--secondary-button-bg', '#6c757d');
    root.style.setProperty('--secondary-button-hover-bg', '#545b62');
    root.style.setProperty('--google-auth-btn-bg', '#dd4b39');
    root.style.setProperty('--google-auth-btn-hover-bg', '#c23321');
    root.style.setProperty('--label-color', theme.text);
    root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.15)');
    root.style.setProperty('--sidebar-bg', theme.header);
    root.style.setProperty('--sidebar-border', theme.border);
    root.style.setProperty('--sidebar-text', theme.text);
    root.style.setProperty('--close-sidebar-btn-color', theme.text);
    root.style.setProperty('--ghosted-text-color', theme.text);

    document.body.classList.remove('dark-theme');
    console.log(`[Theme] Applied custom theme: ${theme.name}`);
}

function applySystemDefaultTheme() {
    const root = document.documentElement;
    root.style.removeProperty('--background-color');
    root.style.removeProperty('--text-color');
    root.style.removeProperty('--header-bg');
    root.style.removeProperty('--card-bg');
    root.style.removeProperty('--border-color');
    root.style.removeProperty('--button-bg');
    root.style.removeProperty('--button-text');
    root.style.removeProperty('--button-hover-bg');
    root.style.removeProperty('--input-bg');
    root.style.removeProperty('--input-border');
    root.style.removeProperty('--modal-bg');
    root.style.removeProperty('--modal-content-bg');
    root.style.removeProperty('--table-header-bg');
    root.style.removeProperty('--table-row-hover-bg');
    root.style.removeProperty('--asx-button-bg');
    root.style.removeProperty('--asx-button-hover-bg');
    root.style.removeProperty('--asx-button-text');
    root.style.removeProperty('--asx-button-active-bg');
    root.style.removeProperty('--asx-button-active-text');
    root.style.removeProperty('--danger-button-bg');
    root.style.removeProperty('--danger-button-hover-bg');
    root.style.removeProperty('--secondary-button-bg');
    root.style.removeProperty('--secondary-button-hover-bg');
    root.style.removeProperty('--google-auth-btn-bg');
    root.style.removeProperty('--google-auth-btn-hover-bg');
    root.style.removeProperty('--label-color');
    root.style.removeProperty('--shadow-color');
    root.style.removeProperty('--sidebar-bg');
    root.style.removeProperty('--sidebar-border');
    root.style.removeProperty('--sidebar-text');
    root.style.removeProperty('--close-sidebar-btn-color');
    root.style.removeProperty('--ghosted-text-color');

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    console.log("[Theme] Applied system default theme.");
}

function toggleTheme() {
    console.log("[Theme] Toggling theme.");
    currentThemeIndex++;
    if (currentThemeIndex >= themes.length) {
        currentThemeIndex = -1;
    }

    if (currentThemeIndex === -1) {
        applySystemDefaultTheme();
        localStorage.removeItem('themeIndex');
        if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-desktop"></i> System Default';
    } else {
        const selectedTheme = themes[currentThemeIndex];
        applyTheme(selectedTheme);
        localStorage.setItem('themeIndex', currentThemeIndex.toString());
        if (themeToggleBtn) themeToggleBtn.innerHTML = `<i class="fas fa-palette"></i> ${selectedTheme.name}`;
    }
}

function loadAndApplySavedTheme() {
    const savedThemeIndex = localStorage.getItem('themeIndex');
    if (savedThemeIndex !== null) {
        currentThemeIndex = parseInt(savedThemeIndex, 10);
        if (currentThemeIndex >= 0 && currentThemeIndex < themes.length) {
            const selectedTheme = themes[currentThemeIndex];
            applyTheme(selectedTheme);
            if (themeToggleBtn) themeToggleBtn.innerHTML = `<i class="fas fa-palette"></i> ${selectedTheme.name}`;
        } else {
            currentThemeIndex = -1;
            applySystemDefaultTheme();
            if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-desktop"></i> System Default';
        }
    } else {
        currentThemeIndex = -1;
        applySystemDefaultTheme();
        if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-desktop"></i> System Default';
    }
    console.log("[Theme] Loaded and applied saved theme.");
}

function getDefaultWatchlistId(userId) {
    return `${userId}_${DEFAULT_WATCHLIST_ID_SUFFIX}`;
}

async function saveLastSelectedWatchlistId(watchlistId) {
    if (!window.firestore || !db || !currentUserId) {
        console.warn("[Watchlist] Cannot save last selected watchlist: Firestore functions, DB, or User ID not available.");
        return;
    }
    const userProfileDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`);
    try {
        await window.firestore.setDoc(userProfileDocRef, { lastSelectedWatchlistId: watchlistId }, { merge: true });
        console.log(`[Watchlist] Saved last selected watchlist ID: ${watchlistId}`);
    } catch (error) {
        console.error("[Watchlist] Error saving last selected watchlist ID:", error);
    }
}

async function loadUserWatchlists() {
    if (!db || !currentUserId || !window.firestore) {
        console.warn("[Watchlist] Firestore DB, User ID, or Firestore functions not available for loading watchlists.");
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        updateMainButtonsState(false);
        return;
    }

    userWatchlists = [];
    const watchlistsColRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`);
    const userProfileDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/profile/settings`);

    if (loadingIndicator) loadingIndicator.style.display = 'block';
    try {
        console.log("[Watchlist] Fetching user watchlists...");
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

        const userProfileSnap = await window.firestore.getDoc(userProfileDocRef);
        let lastSelectedWatchlistId = null;
        if (userProfileSnap.exists()) {
            lastSelectedWatchlistId = userProfileSnap.data().lastSelectedWatchlistId;
            console.log(`[Watchlist] Found last selected watchlist in profile: ${lastSelectedWatchlistId}`);
        }

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
        renderSortSelect();
        updateMainButtonsState(true);

        const migratedSomething = await migrateOldSharesToWatchlist();
        if (!migratedSomething) {
            console.log("[Watchlist] No old shares to migrate/update, directly loading shares for current watchlist.");
            await loadShares();
        }

    } catch (error) {
        console.error("[Watchlist] Error loading user watchlists:", error);
        showCustomAlert("Error loading watchlists: " + error.message);
        updateMainButtonsState(false);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

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
        sortShares();
        renderAsxCodeButtons();
    } catch (error) {
        console.error("[Shares] Error loading shares:", error);
        showCustomAlert("Error loading shares: " + error.message);
    } finally {
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
            if (typeof shareData.comments === 'string' && shareData.comments.trim() !== '') {
                try {
                    const parsedComments = JSON.parse(shareData.comments);
                    if (Array.isArray(parsedComments)) {
                        needsUpdate = true;
                        updatePayload.comments = parsedComments;
                        console.log(`[Migration] Share '${doc.id}': Converted comments string to array.`);
                    }
                } catch (e) {
                    needsUpdate = true;
                    updatePayload.comments = [{ title: "General Comments", text: shareData.comments }];
                    console.log(`[Migration] Share '${doc.id}': Wrapped comments string as single comment object.`);
                }
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


// --- DOMContentLoaded Listener for UI Element References and Event Listeners ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("script.js (v122) DOMContentLoaded fired.");

    // --- UI Element References (Populated here once DOM is ready) ---
    mainTitle = document.getElementById('mainTitle');
    addShareHeaderBtn = document.getElementById('addShareHeaderBtn');
    newShareBtn = document.getElementById('newShareBtn');
    standardCalcBtn = document.getElementById('standardCalcBtn');
    dividendCalcBtn = document.getElementById('dividendCalcBtn');
    asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
    shareFormSection = document.getElementById('shareFormSection');
    formCloseButton = document.querySelector('.form-close-button');
    formTitle = document.getElementById('formTitle');
    saveShareBtn = document.getElementById('saveShareBtn');
    cancelFormBtn = document.getElementById('cancelFormBtn');
    deleteShareFromFormBtn = document.getElementById('deleteShareFromFormBtn');
    shareNameInput = document.getElementById('shareName');
    currentPriceInput = document.getElementById('currentPrice');
    targetPriceInput = document.getElementById('targetPrice');
    dividendAmountInput = document.getElementById('dividendAmount');
    frankingCreditsInput = document.getElementById('frankingCredits');
    commentsFormContainer = document.getElementById('commentsFormContainer');
    addCommentSectionBtn = document.getElementById('addCommentSectionBtn');
    shareTableBody = document.querySelector('#shareTable tbody');
    mobileShareCardsContainer = document.getElementById('mobileShareCards');
    loadingIndicator = document.getElementById('loadingIndicator');
    googleAuthBtnSidebar = document.querySelector('#appSidebar #googleAuthBtn'); // Specific selector
    googleAuthBtnFooter = document.querySelector('footer #googleAuthBtn'); // Specific selector
    shareDetailModal = document.getElementById('shareDetailModal');
    modalShareName = document.getElementById('modalShareName');
    modalEntryDate = document.getElementById('modalEntryDate');
    modalEnteredPrice = document.getElementById('modalEnteredPrice');
    modalEnteredPriceDateTime = document.getElementById('modalEnteredPriceDateTime');
    modalTargetPrice = document.getElementById('modalTargetPrice');
    modalDividendAmount = document.getElementById('modalDividendAmount');
    modalFrankingCredits = document.getElementById('modalFrankingCredits');
    modalCommentsContainer = document.getElementById('modalCommentsContainer');
    modalUnfrankedYieldSpan = document.getElementById('modalUnfrankedYield');
    modalFrankedYieldSpan = document.getElementById('modalFrankedYield');
    editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn');
    modalMarketIndexLink = document.getElementById('modalMarketIndexLink');
    modalFoolLink = document.getElementById('modalFoolLink');
    modalCommSecLink = document.getElementById('modalCommSecLink');
    commSecLoginMessage = document.getElementById('commSecLoginMessage');
    dividendCalculatorModal = document.getElementById('dividendCalculatorModal');
    calcCloseButton = document.querySelector('.calc-close-button');
    calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
    calcDividendAmountInput = document.getElementById('calcDividendAmount');
    calcFrankingCreditsInput = document.getElementById('calcFrankingCredits');
    calcUnfrankedYieldSpan = document.getElementById('calcUnfrankedYield');
    calcFrankedYieldSpan = document.getElementById('calcFrankedYield');
    investmentValueSelect = document.getElementById('investmentValueSelect');
    calcEstimatedDividend = document.getElementById('calcEstimatedDividend');
    sortSelect = document.getElementById('sortSelect');
    customDialogModal = document.getElementById('customDialogModal');
    customDialogMessage = document.getElementById('customDialogMessage');
    customDialogConfirmBtn = document.getElementById('customDialogConfirmBtn');
    customDialogCancelBtn = document.getElementById('customDialogCancelBtn');
    calculatorModal = document.getElementById('calculatorModal');
    calculatorInput = document.getElementById('calculatorInput');
    calculatorResult = document.getElementById('calculatorResult');
    calculatorButtons = document.querySelector('.calculator-buttons');
    watchlistSelect = document.getElementById('watchlistSelect');
    themeToggleBtn = document.getElementById('themeToggleBtn');
    scrollToTopBtn = document.getElementById('scrollToTopBtn');
    hamburgerBtn = document.getElementById('hamburgerBtn');
    appSidebar = document.getElementById('appSidebar');
    closeMenuBtn = document.getElementById('closeMenuBtn');
    sidebarOverlay = document.querySelector('.sidebar-overlay');
    if (!sidebarOverlay) {
        sidebarOverlay = document.createElement('div');
        sidebarOverlay.classList.add('sidebar-overlay');
        document.body.appendChild(sidebarOverlay);
    }
    addWatchlistBtn = document.getElementById('addWatchlistBtn');
    editWatchlistBtn = document.getElementById('editWatchlistBtn');
    addWatchlistModal = document.getElementById('addWatchlistModal');
    newWatchlistNameInput = document.getElementById('newWatchlistName');
    saveWatchlistBtn = document.getElementById('saveWatchlistBtn');
    cancelAddWatchlistBtn = document.getElementById('cancelAddWatchlistBtn');
    manageWatchlistModal = document.getElementById('manageWatchlistModal');
    editWatchlistNameInput = document.getElementById('editWatchlistName');
    saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn');
    deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn');
    cancelManageWatchlistBtn = document.getElementById('cancelManageWatchlistBtn');

    // Populate formInputs array after elements are referenced
    formInputs = [
        shareNameInput, currentPriceInput, targetPriceInput,
        dividendAmountInput, frankingCreditsInput
    ];

    // --- Initial UI Setup ---
    if (shareFormSection) shareFormSection.classList.remove('open');
    if (dividendCalculatorModal) dividendCalculatorModal.classList.remove('open');
    if (shareDetailModal) shareDetailModal.classList.remove('open');
    if (addWatchlistModal) addWatchlistModal.classList.remove('open');
    if (manageWatchlistModal) manageWatchlistModal.classList.remove('open');
    if (customDialogModal) customDialogModal.classList.remove('open');
    if (calculatorModal) calculatorModal.classList.remove('open');
    updateMainButtonsState(false); // Initially disable all auth-dependent buttons
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    renderWatchlistSelect(); // Call this immediately to show the placeholder
    // Ensure both Google Auth buttons are initially disabled until Firebase auth is ready
    if (googleAuthBtnSidebar) googleAuthBtnSidebar.disabled = true;
    if (googleAuthBtnFooter) googleAuthBtnFooter.disabled = true;
    if (addShareHeaderBtn) addShareHeaderBtn.disabled = true;
    loadAndApplySavedTheme(); // Applies theme and updates themeToggleBtn text

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js', { scope: './' }) 
                .then(registration => {
                    console.log('Service Worker (v37) from script.js: Registered with scope:', registration.scope);
                })
                .catch(error => {
                    console.error('Service Worker (v37) from script.js: Registration failed:', error);
                });
        });
    }

    // --- Firebase Auth Listener (Moved to DOMContentLoaded for reliable element access) ---
    // This will trigger data loading and UI updates after Firebase is ready and user auth state is known
    if (window.firebaseAuth && typeof window.getFirebaseAppId === 'function') {
        db = window.firestoreDb; // Assign global db from window
        auth = window.firebaseAuth; // Assign global auth from window
        currentAppId = window.getFirebaseAppId(); // Assign global appId from window
        console.log(`[Firebase Init] App ID: ${currentAppId}`);

        // Enable Google Auth buttons once Firebase Auth is available
        if (googleAuthBtnSidebar) googleAuthBtnSidebar.disabled = false;
        if (googleAuthBtnFooter) googleAuthBtnFooter.disabled = false;
        console.log("[Auth] Google Auth buttons enabled.");

        window.authFunctions.onAuthStateChanged(auth, async (user) => {
            console.log("[AuthState] onAuthStateChanged fired. User:", user ? user.uid : "null");
            if (user) {
                currentUserId = user.uid;
                updateAuthButtonText(true, user.email || user.displayName);
                console.log("[AuthState] User signed in:", user.uid);
                if (user.email && user.email.toLowerCase() === KANGA_EMAIL) {
                    mainTitle.textContent = "Kanga's Share Watchlist";
                } else {
                    mainTitle.textContent = "My Share Watchlist";
                }
                updateMainButtonsState(true); // Enable auth-dependent buttons
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                await loadUserWatchlists();
            } else {
                currentUserId = null;
                updateAuthButtonText(false);
                mainTitle.textContent = "Share Watchlist";
                console.log("[AuthState] User signed out.");
                updateMainButtonsState(false); // Disable auth-dependent buttons
                clearShareList();
                clearWatchlistUI();
                if (loadingIndicator) loadingIndicator.style.display = 'none';
            }
        });
    } else {
        console.error("[Firebase] Firebase global variables or getFirebaseAppId function not available. Cannot set up auth listener or proceed with Firebase operations.");
        updateAuthButtonText(false);
        updateMainButtonsState(false);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
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
                        const currentCommentInputs = commentsFormContainer.querySelector('.comment-title-input');
                        if (currentCommentInputs) { currentCommentInputs.focus(); }
                        else if (saveShareBtn) { saveShareBtn.click(); }
                    } else {
                        if (formInputs[index + 1]) formInputs[index + 1].focus();
                    }
                }
            });
        }
    });

    // --- Event Listeners for Modal Close Buttons ---
    document.querySelectorAll('.modal .close-button').forEach(button => { 
        button.addEventListener('click', closeModals); 
    });

    // --- Event Listener for Clicking Outside Modals ---
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModals();
            }
        });
    });

    // --- Authentication Functions Event Listener ---
    // Attach event listeners to both Google Auth buttons
    const attachGoogleAuthListener = (button) => {
        if (button) {
            button.addEventListener('click', async () => {
                console.log(`[Auth] Google Auth Button Clicked. (Source: ${button.id === 'googleAuthBtn' ? 'Sidebar/Footer' : 'Unknown'})`);
                const currentAuth = window.firebaseAuth;
                if (!currentAuth || !window.authFunctions) {
                    console.warn("[Auth] Auth service not ready or functions not loaded. Cannot process click.");
                    showCustomAlert("Authentication service not ready. Please try again in a moment.");
                    return;
                }
                if (currentAuth.currentUser && currentAuth.currentUser.isAnonymous === false) { // Check if explicitly signed in
                    console.log("[Auth] Explicit user exists, attempting sign out.");
                    try {
                        await window.authFunctions.signOut(currentAuth);
                        console.log("[Auth] User signed out successfully.");
                    } catch (error) {
                        console.error("[Auth] Sign-Out failed:", error);
                        showCustomAlert("Sign-Out failed: " + error.message);
                    }
                } else {
                    console.log("[Auth] No explicit user, attempting Google sign in with popup.");
                    try {
                        const provider = window.authFunctions.GoogleAuthProviderInstance;
                        if (!provider) {
                            console.error("[Auth] GoogleAuthProvider instance not found. Is Firebase module script loaded?");
                            showCustomAlert("Authentication service not ready. Please ensure Firebase module script is loaded.");
                            return;
                        }
                        // Attempt sign-in with popup
                        await window.authFunctions.signInWithPopup(currentAuth, provider);
                        console.log("[Auth] Google Sign-In successful.");
                    }
                    catch (error) {
                        console.error("[Auth] Google Sign-In failed:", error.message);
                        // Check for common errors like popup closed by user or popup blocked
                        if (error.code === 'auth/popup-closed-by-user') {
                            showCustomAlert("Sign-in cancelled. Popup closed by user.", 2000);
                        } else if (error.code === 'auth/cancelled-popup-request') {
                            showCustomAlert("Sign-in cancelled. Another popup request was already in progress.", 2000);
                        } else if (error.code === 'auth/popup-blocked') {
                            showCustomAlert("Sign-in failed: Popup blocked. Please allow popups for this site.", 3000);
                        } else {
                            showCustomAlert("Google Sign-In failed: " + error.message, 3000);
                        }
                    }
                }
            });
        }
    };

    attachGoogleAuthListener(googleAuthBtnSidebar);
    attachGoogleAuthListener(googleAuthBtnFooter);


    // --- Event Listener for Watchlist Dropdown ---
    if (watchlistSelect) {
        watchlistSelect.addEventListener('change', async () => {
            console.log("[Watchlist Select] Change event detected.");
            currentWatchlistId = watchlistSelect.value;
            const selectedWatchlistObj = userWatchlists.find(w => w.id === currentWatchlistId);
            if (selectedWatchlistObj) {
                currentWatchlistName = selectedWatchlistObj.name;
                console.log(`[Watchlist Change] User selected: '${currentWatchlistName}' (ID: ${currentWatchlistId})`);
                await saveLastSelectedWatchlistId(currentWatchlistId);
                await loadShares();
            } else {
                console.warn("[Watchlist Change] Selected watchlist not found in userWatchlists array.");
            }
        });
    }

    // --- Event Listener for Sort Dropdown ---
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            console.log("[Sort Select] Change event detected.");
            sortShares();
        });
    }

    // --- Share Form Functions (Add/Edit) Event Listeners ---
    if (newShareBtn) {
        newShareBtn.addEventListener('click', () => {
            console.log("[Button] 'Add New Share' (Sidebar) clicked.");
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
            console.log("[Button] 'Add New Share' (Header) clicked.");
            clearForm();
            formTitle.textContent = 'Add New Share';
            deleteShareFromFormBtn.style.display = 'none';
            showModal(shareFormSection);
            shareNameInput.focus();
        });
    }

    if (saveShareBtn) {
        saveShareBtn.addEventListener('click', async () => {
            console.log("[Button] 'Save Share' clicked.");
            const shareName = shareNameInput.value.trim().toUpperCase();
            if (!shareName) { showCustomAlert("Code is required!"); return; }

            const currentPrice = parseFloat(currentPriceInput.value);
            const targetPrice = parseFloat(targetPriceInput.value);
            const dividendAmount = parseFloat(dividendAmountInput.value);
            const frankingCredits = parseFloat(frankingCreditsInput.value);

            const comments = [];
            commentsFormContainer.querySelectorAll('.comment-section').forEach(section => {
                const titleInput = section.querySelector('.comment-title-input');
                const textInput = section.querySelector('.comment-text-input');
                if (titleInput.value.trim() || textInput.value.trim()) {
                    comments.push({ title: titleInput.value.trim(), text: textInput.value.trim() });
                }
            });

            const shareData = {
                shareName: shareName,
                currentPrice: isNaN(currentPrice) ? null : currentPrice,
                targetPrice: isNaN(targetPrice) ? null : targetPrice,
                dividendAmount: isNaN(dividendAmount) ? null : dividendAmount,
                frankingCredits: isNaN(frankingCredits) ? null : frankingCredits,
                comments: comments,
                userId: currentUserId,
                watchlistId: currentWatchlistId,
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
            await loadShares();
            closeModals();
        });
    }

    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', () => {
            console.log("[Button] 'Cancel Form' clicked.");
            clearForm(); hideModal(shareFormSection); console.log("[Form] Form canceled.");
        });
    }

    if (deleteShareFromFormBtn) {
        deleteShareFromFormBtn.addEventListener('click', () => {
            console.log("[Button] 'Delete Share' clicked.");
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

    if (addCommentSectionBtn) {
        addCommentSectionBtn.addEventListener('click', () => {
            console.log("[Button] 'Add Comment Section' clicked.");
            addCommentSection();
        });
    }

    // --- Share Detail Modal Functions Event Listeners ---
    if (editShareFromDetailBtn) {
        editShareFromDetailBtn.addEventListener('click', () => {
            console.log("[Button] 'Edit Share' (from detail modal) clicked.");
            hideModal(shareDetailModal);
            showEditFormForSelectedShare();
        });
    }

    // --- Add Watchlist Modal Functions Event Listeners ---
    if (addWatchlistBtn) {
        addWatchlistBtn.addEventListener('click', () => {
            console.log("[Button] 'Add Watchlist' clicked.");
            if (newWatchlistNameInput) newWatchlistNameInput.value = '';
            showModal(addWatchlistModal);
            newWatchlistNameInput.focus();
            toggleAppSidebar(false);
        });
    }

    if (saveWatchlistBtn) {
        saveWatchlistBtn.addEventListener('click', async () => {
            console.log("[Button] 'Save Watchlist' clicked.");
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
                await loadUserWatchlists();
                await loadShares();

            } catch (error) {
                console.error("[Firestore] Error adding watchlist:", error);
                showCustomAlert("Error adding watchlist: " + error.message);
            }
        });
    }

    if (cancelAddWatchlistBtn) {
        cancelAddWatchlistBtn.addEventListener('click', () => {
            console.log("[Button] 'Cancel Add Watchlist' clicked.");
            hideModal(addWatchlistModal);
            if (newWatchlistNameInput) newWatchlistNameInput.value = '';
            console.log("[Watchlist] Add Watchlist canceled.");
        });
    }

    // --- Manage Watchlist Modal (Edit/Delete) Functions ---
    if (editWatchlistBtn) {
        editWatchlistBtn.addEventListener('click', () => {
            console.log("[Button] 'Manage Watchlist' clicked.");
            if (!currentWatchlistId) {
                showCustomAlert("Please select a watchlist to edit.");
                return;
            }
            editWatchlistNameInput.value = currentWatchlistName;
            // Disable delete if it's the last watchlist
            if (deleteWatchlistInModalBtn) {
                deleteWatchlistInModalBtn.disabled = userWatchlists.length <= 1;
            }
            showModal(manageWatchlistModal);
            editWatchlistNameInput.focus();
            toggleAppSidebar(false);
        });
    }

    if (saveWatchlistNameBtn) {
        saveWatchlistNameBtn.addEventListener('click', async () => {
            console.log("[Button] 'Save Watchlist Name' clicked.");
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
                await loadUserWatchlists();
                await loadShares();
            } catch (error) {
                console.error("[Firestore] Error renaming watchlist:", error);
                showCustomAlert("Error renaming watchlist: " + error.message);
            }
        });
    }

    if (deleteWatchlistInModalBtn) {
        deleteWatchlistInModalBtn.addEventListener('click', () => {
            console.log("[Button] 'Delete Watchlist' (in modal) clicked.");
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

                    await loadUserWatchlists();
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
            console.log("[Button] 'Cancel Manage Watchlist' clicked.");
            hideModal(manageWatchlistModal);
            editWatchlistNameInput.value = '';
            console.log("[Watchlist] Manage Watchlist canceled.");
        });
    }

    // --- Dividend Calculator Functions Event Listeners ---
    if (dividendCalcBtn) {
        dividendCalcBtn.addEventListener('click', () => {
            console.log("[Button] 'Dividend Calculator' clicked.");
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
            console.log("[Button] 'Standard Calculator' clicked.");
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
            console.log(`[Calculator] Button clicked - Value: ${value}, Action: ${action}`);
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

    // --- Theme Toggling Logic Event Listener ---
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (localStorage.getItem('themeIndex') === null) {
            if (event.matches) {
                document.body.classList.add('dark-theme');
                if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-desktop"></i> System Default';
            } else {
                document.body.classList.remove('dark-theme');
                if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-desktop"></i> System Default';
            }
            console.log("[Theme] System theme preference changed and applied.");
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
        hamburgerBtn.addEventListener('click', () => {
            console.log("[Button] Hamburger button clicked.");
            toggleAppSidebar();
        });
        closeMenuBtn.addEventListener('click', () => {
            console.log("[Button] Close Menu button clicked.");
            toggleAppSidebar(false);
        });
        
        sidebarOverlay.addEventListener('click', (event) => {
            console.log("[Sidebar Overlay] Clicked overlay. Attempting to close sidebar.");
            if (appSidebar.classList.contains('open')) {
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
                    console.log(`[Button] Sidebar menu item clicked (closes menu): ${button.textContent.trim()}`);
                    toggleAppSidebar(false);
                });
            } else {
                button.addEventListener('click', () => {
                    console.log(`[Button] Sidebar menu item clicked (does not close menu): ${button.textContent.trim()}`);
                });
            }
        });
    }

}); // End DOMContentLoaded
