// File Version: v110 (Updated by Gemini for Firebase errors and robustness)
// Last Updated: 2025-06-28 (Improved Firebase initialization checks, fixed window.getFirebaseAppId access)

// This script interacts with Firebase Firestore for data storage.
// Firebase app, db, auth instances, and userId are made globally available
// via window.firestoreDb, window.firebaseAuth, window.getFirebaseAppId(), etc.,
// from the <script type="module"> block in index.html.

document.addEventListener('DOMContentLoaded', function() {
    console.log("script.js (v110) DOMContentLoaded fired."); // New log to confirm script version and DOM ready

    // --- Core Helper Functions (DECLARED FIRST FOR HOISTING) ---
    // Moved toggleAppSidebar here to ensure it's defined before any calls within this scope.
    function toggleAppSidebar(force) {
        const isSidebarOpen = appSidebar.classList.contains('open');
        const isForcedOpen = (typeof force === 'boolean' && force === true);
        const isForcedClosed = (typeof force === 'boolean' && force === false);

        // Determine the target state based on 'force' or current state
        let targetState;
        if (isForcedOpen) { targetState = true; }
        else if (isForcedClosed) { targetState = false; }
        else { targetState = !isSidebarOpen; } // Toggle if no force specified

        if (targetState) {
            appSidebar.classList.add('open');
            sidebarOverlay.classList.add('open'); // Show overlay
            document.body.classList.add('sidebar-active'); // Shift content
            document.documentElement.style.overflowX = 'hidden'; // Prevent horizontal scroll on html
            document.body.style.overflowX = 'hidden'; // Prevent horizontal scroll on body
            document.body.style.overflowY = 'hidden'; // Prevent vertical scroll on body when sidebar is open
        } else {
            appSidebar.classList.remove('open');
            sidebarOverlay.classList.remove('open'); // Hide overlay
            document.body.classList.remove('sidebar-active'); // Revert content shift
            document.documentElement.style.overflowX = ''; // Allow horizontal scroll if needed
            document.body.style.overflowX = ''; // Allow horizontal scroll if needed
            document.body.style.overflowY = ''; // Allow vertical scroll on body
        }
        console.log(`[Menu] App sidebar toggled. Open: ${appSidebar.classList.contains('open')}`);
    }

    // Centralized Modal Closing Function
    function closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal) {
                // Use class manipulation for transitions instead of direct display style
                modal.classList.remove('open');
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

    // FIX: Refined updateMainButtonsState logic for hamburger menu buttons
    function updateMainButtonsState(enable) {
        // These buttons are now primarily controlled by the unified sidebar.
        // Their disabled state should still reflect auth status.
        // We now reference the unified buttons directly.
        if (newShareBtn) newShareBtn.disabled = !enable;
        if (standardCalcBtn) standardCalcBtn.disabled = !enable;
        if (dividendCalcBtn) dividendCalcBtn.disabled = !enable;
        if (watchlistSelect) watchlistSelect.disabled = !enable; 
        if (addWatchlistBtn) addWatchlistBtn.disabled = !enable; // Enable/disable add watchlist button
        // Disable edit/delete watchlist if only one watchlist exists
        if (editWatchlistBtn) editWatchlistBtn.disabled = !enable || userWatchlists.length <= 1; 
        if (deleteWatchlistInModalBtn) deleteWatchlistInModalBtn.disabled = !enable || userWatchlists.length <= 1;
        if (addShareHeaderBtn) addShareHeaderBtn.disabled = !enable; // New: Disable addShareHeaderBtn

        // Ensure theme toggle button is always enabled, regardless of auth state
        if (themeToggleBtn) {
            themeToggleBtn.disabled = false;
        }
    }

    // MODAL OPEN/CLOSE FUNCTIONS - UPDATED TO USE 'open' CLASS FOR CSS TRANSITIONS
    function showModal(modalElement) {
        if (modalElement) {
            modalElement.classList.add('open');
            modalElement.scrollTop = 0;
        }
    }

    function hideModal(modalElement) {
        if (modalElement) {
            modalElement.classList.remove('open');
        }
    }

    // Watchlist UI clearing
    function clearWatchlistUI() {
        if (watchlistSelect) watchlistSelect.innerHTML = '';
        userWatchlists = [];
        renderWatchlistSelect(); // Re-render to show placeholder and disabled state
        renderSortSelect(); // Re-render to ensure sort is also reset
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
        // Robust type checking for number inputs
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
        
        // Display Entered Price - REMOVED DATE/TIME
        const enteredPriceNum = Number(share.currentPrice); // This is the user-entered price
        modalEnteredPrice.textContent = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? `$${enteredPriceNum.toFixed(2)}` : 'N/A';
        modalEnteredPriceDateTime.textContent = ''; // Clear date/time

        const targetPriceNum = Number(share.targetPrice);
        modalTargetPrice.textContent = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? `$${targetPriceNum.toFixed(2)}` : 'N/A';
        
        const dividendAmountNum = Number(share.dividendAmount);
        modalDividendAmount.textContent = (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? `$${dividendAmountNum.toFixed(3)}` : 'N/A';
        
        const frankingCreditsNum = Number(share.frankingCredits);
        modalFrankingCredits.textContent = (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? `${frankingCreditsNum.toFixed(1)}%` : 'N/A';
        
        const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, enteredPriceNum); // Use enteredPriceNum for yield calculations in modal
        modalUnfrankedYieldSpan.textContent = unfrankedYield !== null ? `${unfrankedYield.toFixed(2)}%` : 'N/A';
        
        const frankedYield = calculateFrankedYield(dividendAmountNum, enteredPriceNum, frankingCreditsNum); // Use enteredPriceNum for yield calculations in modal
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

        // Set MarketIndex and Fool.com.au links
        if (modalMarketIndexLink && share.shareName) {
            const marketIndexUrl = `https://www.marketindex.com.au/asx/${share.shareName.toLowerCase()}`;
            modalMarketIndexLink.href = marketIndexUrl;
            modalMarketIndexLink.textContent = `View ${share.shareName.toUpperCase()} on MarketIndex.com.au`;
            modalMarketIndexLink.style.display = 'inline-flex'; // Ensure it's visible
        } else if (modalMarketIndexLink) {
            modalMarketIndexLink.style.display = 'none'; // Hide if no share name
        }

        if (modalFoolLink && share.shareName) {
            const foolUrl = `https://www.fool.com.au/tickers/asx-${share.shareName.toLowerCase()}/`;
            modalFoolLink.href = foolUrl;
            modalFoolLink.textContent = `View ${share.shareName.toUpperCase()} on Fool.com.au`;
            modalFoolLink.style.display = 'inline-flex'; // Ensure it's visible
        } else if (modalFoolLink) {
            modalFoolLink.style.display = 'none'; // Hide if no share name
        }

        // NEW: Set CommSec link
        if (modalCommSecLink && share.shareName) {
            const commSecUrl = `https://www2.commsec.com.au/quotes/summary?stockCode=${share.shareName.toUpperCase()}&exchangeCode=ASX`;
            modalCommSecLink.href = commSecUrl;
            modalCommSecLink.textContent = `View ${share.shareName.toUpperCase()} on CommSec.com.au`;
            modalCommSecLink.style.display = 'inline-flex'; // Ensure it's visible
        } else if (modalCommSecLink) {
            modalCommSecLink.style.display = 'none'; // Hide if no share name
        }

        // NEW: CommSec Login Message
        if (commSecLoginMessage) {
            commSecLoginMessage.style.display = 'block'; // Always display the message
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

            // For numerical fields, use entered price for sorting as current price column is removed
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
        // Always set placeholder as selected initially, then override if a watchlist is active
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
            // If currentWatchlistId is not set or invalid, default to the first watchlist
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
        if (!sortSelect.value || sortSelect.value === '') {
            sortSelect.value = '';
        }
    }

    // Add Share to UI Functions
    function addShareToTable(share) {
        if (!shareTableBody) { console.error("[addShareToTable] shareTableBody element not found."); return; }
        const row = shareTableBody.insertRow();
        row.dataset.docId = share.id;
        row.addEventListener('click', (event) => { selectShare(share.id); });
        // MODAL FIX: Changed from dblclick to single click for table rows
        row.addEventListener('click', (event) => { selectShare(share.id); showShareDetails(); });

        const displayShareName = (share.shareName && String(share.shareName).trim() !== '') ? share.shareName : '(No Code)';
        row.insertCell().textContent = displayShareName;

        // Display "Entered Price" column
        const enteredPriceCell = row.insertCell();
        const enteredPriceNum = Number(share.currentPrice); // This is the user-entered price
        const displayEnteredPrice = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? `$${enteredPriceNum.toFixed(2)}` : '-';
        enteredPriceCell.textContent = displayEnteredPrice;

        const targetPriceNum = Number(share.targetPrice);
        const displayTargetPrice = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? `$${targetPriceNum.toFixed(2)}` : '-';
        row.insertCell().textContent = displayTargetPrice;

        const dividendCell = row.insertCell();
        const dividendAmountNum = Number(share.dividendAmount);
        const frankingCreditsNum = Number(share.frankingCredits);
        // Use enteredPriceNum for yield calculations in table
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
        // Only add mobile cards if we are currently in a mobile viewport
        if (!window.matchMedia("(max-width: 768px)").matches) { return; }

        const card = document.createElement('div');
        card.className = 'mobile-card';
        card.dataset.docId = share.id;

        // Robust type checking for display
        const enteredPriceNum = Number(share.currentPrice); // User-entered price
        const dividendAmountNum = Number(share.dividendAmount);
        const frankingCreditsNum = Number(share.frankingCredits);
        const targetPriceNum = Number(share.targetPrice);
        
        // Use enteredPriceNum for yield calculations in cards
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
            <p><strong>Entered Price:</strong> $${displayEnteredPrice}</p> <!-- REMOVED DATE/TIME -->
            <p><strong>Target:</strong> $${displayTargetPrice}</p>
            <p><strong>Dividend:</strong> $${displayDividendAmount}</p>
            <p><strong>Franking:</strong> ${displayFrankingCredits}</p>
            <p><strong>Unfranked Yield:</strong> ${unfrankedYield !== null ? unfrankedYield.toFixed(2) + '%' : '-'}</p>
            <p><strong>Franked Yield:</strong> ${frankedYield !== null ? frankedYield.toFixed(2) + '%' : '-'}</p>
            <p class="card-comments"><strong>Comments:</strong> ${commentsSummary}</p>
        `;
        mobileShareCardsContainer.appendChild(card);

        // Mobile Double-Clicking / Tap Logic - MODIFIED FOR SINGLE CLICK TO OPEN MODAL
        card.addEventListener('click', function(e) {
            const docId = e.currentTarget.dataset.docId;
            selectShare(docId, e.currentTarget); // Select the share
            showShareDetails(); // Show details on single tap
            e.preventDefault(); // Prevent default click behavior
        });

        // Prevent long-press context menu on touch devices
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
            // Always attempt to add mobile cards, will be filtered by addShareToMobileCards based on media query
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

    // NEW FUNCTION: renderAsxCodeButtons
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
            button.className = 'asx-code-button'; // Ensure this class is styled in CSS
            button.textContent = asxCode;
            button.dataset.asxCode = asxCode;
            asxCodeButtonsContainer.appendChild(button);
            // MODAL FIX: Attach click listener to open modal directly
            button.addEventListener('click', (event) => {
                const clickedCode = event.target.dataset.asxCode;
                selectShare(allSharesData.find(s => s.shareName && s.shareName.toUpperCase() === clickedCode.toUpperCase())?.id);
                showShareDetails(); // Open modal
            });
        });
        console.log(`[UI] Rendered ${sortedAsxCodes.length} code buttons.`);
    }

    // NEW FUNCTION: scrollToShare - This function is no longer needed as ASX Code buttons now open modals directly.
    // Keeping it commented out in case it's repurposed later.
    // function scrollToShare(asxCode) {
    //     console.log(`[UI] Attempting to scroll to/highlight share with Code: ${asxCode}`);
    //     const targetShare = allSharesData.find(s => s.shareName && s.shareName.toUpperCase() === asxCode.toUpperCase());
    //     if (targetShare) {
    //         selectShare(targetShare.id);
    //         let elementToScrollTo = document.querySelector(`#shareTable tbody tr[data-doc-id="${targetShare.id}"]`);
    //         // Check for mobile card if table row not found or if on mobile
    //         if (!elementToScrollTo || window.matchMedia("(max-width: 768px)").matches) {
    //             elementToScrollTo = document.querySelector(`.mobile-card[data-doc-id="${targetShare.id}"]`);
    //         }
    //         if (elementToScrollTo) {
    //             elementToScrollTo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    //         }
    //         // On mobile, if a share is selected via ASX code button, immediately show details
    //         if (window.matchMedia("(max-width: 768px)").matches) {
    //             showShareDetails(); 
    //         }
    //     } else {
    //         showCustomAlert(`Share '${asxCode}' not found.`);
    //     }
    // }

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

    // Theme Toggling Logic - MODIFIED FOR 20 THEMES + SYSTEM DEFAULT
    const themes = [
        // 10 Bright Themes
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
        // 10 Subtle Themes
        { name: "Soft Grey", bg: "#f4f7f6", text: "#333", header: "#e6e9eb", card: "#ffffff", border: "#c9d2d4", button: "#6c757d", hover: "#545b62", sidebar: "#e6e9eb", asx_active_text: "#fff" },
        { name: "Muted Blue", bg: "#e9eff2", text: "#4a5568", header: "#c9d5db", card: "#f0f4f7", border: "#aebbc2", button: "#4299e1", hover: "#3182ce", sidebar: "#c9d5db", asx_active_text: "#fff" },
        { name: "Earthy Green", bg: "#f0f5ee", text: "#4a574a", header: "#d1d9cf", card: "#f8fbf7", border: "#b8c2b8", button: "#48bb78", hover: "#38a169", sidebar: "#d1d9cf", asx_active_text: "#fff" },
        { name: "Warm Beige", bg: "#fbf8f3", text: "#6b462f", header: "#e8dcd2", card: "#ffffff", border: "#d4c0b0", button: "#dd6b20", hover: "#c05621", sidebar: "#e8dcd2", asx_active_text: "#fff" },
        { name: "Cool Grey", bg: "#eef2f5", text: "#4c5563", header: "#d4dae0", card: "#f7f9fb", border: "#c0c7cf", button: "#63b3ed", hover: "#4299e1", sidebar: "#d4dae0", asx_active_text: "#fff" },
        { name: "Dusty Rose", bg: "#fcf0f2", text: "#713f48", header: "#ebd2d5", card: "#ffffff", border: "#d9b3b8", button: "#e53e3e", hover: "#c53030", sidebar: "#ebd2d2", asx_active_text: "#fff" },
        { name: "Lavender Mist", bg: "#f5f3fa", text: "#5c4f70", header: "#dcd7e3", card: "#ffffff", border: "#c4b8d0", button: "#805ad5", hover: "#6b46c1", sidebar: "#dcd7e3", asx_active_text: "#fff" },
        { name: "Ocean Breeze", bg: "#e6f7f7", text: "#31708f", header: "#b3e0e0", card: "#ffffff", border: "#80caca", button: "#2b6cb0", hover: "#2c5282", sidebar: "#b3e0e0", asx_active_text: "#fff" },
        { name: "Sandstone", bg: "#fdf8ed", text: "#7b341f", header: "#e8d9c2", card: "#ffffff", border: "#d4b89b", button: "#a05a2c", hover: "#8a4b2b", sidebar: "#e8d9c2", asx_active_text: "#fff" },
        { name: "Forest Night", bg: "#2a363b", text: "#e0e0e0", header: "#3b4a50", card: "#3f5259", border: "#5a6a70", button: "#4a7dff", hover: "#3a6cd9", sidebar: "#3b4a50", asx_active_text: "#fff" } // Darker subtle theme
    ];

    let currentThemeIndex = -1; // -1 for system default, 0 to 19 for custom themes

    function applyTheme(theme) {
        const root = document.documentElement;
        root.style.setProperty('--background-color', theme.bg);
        root.style.setProperty('--text-color', theme.text);
        root.style.setProperty('--header-bg', theme.header);
        root.style.setProperty('--card-bg', theme.card);
        root.style.setProperty('--border-color', theme.border);
        root.style.setProperty('--button-bg', theme.button);
        root.style.setProperty('--button-text', theme.text); // Use text color for button text
        root.style.setProperty('--button-hover-bg', theme.hover);
        root.style.setProperty('--input-bg', theme.card); // Use card background for input
        root.style.setProperty('--input-border', theme.border);
        root.style.setProperty('--modal-bg', 'rgba(0, 0, 0, 0.6)'); // Keep consistent modal overlay
        root.style.setProperty('--modal-content-bg', theme.card);
        root.style.setProperty('--table-header-bg', theme.header);
        root.style.setProperty('--table-row-hover-bg', theme.bg); // Use background for row hover
        root.style.setProperty('--asx-button-bg', theme.header); // Use header for asx buttons
        root.style.setProperty('--asx-button-hover-bg', theme.hover);
        root.style.setProperty('--asx-button-text', theme.text);
        root.style.setProperty('--asx-button-active-bg', theme.button);
        root.style.setProperty('--asx-button-active-text', theme.asx_active_text || theme.button); // Use specific or button text color
        root.style.setProperty('--danger-button-bg', '#dc3545'); // Keep consistent danger
        root.style.setProperty('--danger-button-hover-bg', '#c82333');
        root.style.setProperty('--secondary-button-bg', '#6c757d'); // Keep consistent secondary
        root.style.setProperty('--secondary-button-hover-bg', '#545b62');
        root.style.setProperty('--google-auth-btn-bg', '#dd4b39'); // Keep consistent Google
        root.style.setProperty('--google-auth-btn-hover-bg', '#c23321');
        root.style.setProperty('--label-color', theme.text); // Use text color for labels
        root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.15)'); // Keep consistent shadow
        root.style.setProperty('--sidebar-bg', theme.header);
        root.style.setProperty('--sidebar-border', theme.border);
        root.style.setProperty('--sidebar-text', theme.text);
        root.style.setProperty('--close-sidebar-btn-color', theme.text);
        root.style.setProperty('--ghosted-text-color', theme.text); // Use text color for ghosted text

        // Remove dark-theme class if a custom theme is applied
        document.body.classList.remove('dark-theme');
        console.log(`[Theme] Applied custom theme: ${theme.name}`);
    }

    function applySystemDefaultTheme() {
        const root = document.documentElement;
        // Reset all custom properties by removing them
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

        // Re-apply dark-theme class based on system preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
        console.log("[Theme] Applied system default theme.");
    }

    function toggleTheme() {
        currentThemeIndex++;
        if (currentThemeIndex >= themes.length) {
            currentThemeIndex = -1; // Cycle back to system default
        }

        if (currentThemeIndex === -1) {
            applySystemDefaultTheme();
            localStorage.removeItem('themeIndex'); // Remove stored index for system default
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
                // Fallback if saved index is out of bounds
                currentThemeIndex = -1;
                applySystemDefaultTheme();
                if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-desktop"></i> System Default';
            }
        } else {
            // No saved theme, apply system default initially
            currentThemeIndex = -1;
            applySystemDefaultTheme();
            if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-desktop"></i> System Default';
        }
    }


    // Watchlist ID generation
    function getDefaultWatchlistId(userId) {
        return `${userId}_${DEFAULT_WATCHLIST_ID_SUFFIX}`;
    }

    // Save the last selected watchlist ID to user's profile
    async function saveLastSelectedWatchlistId(watchlistId) {
        // Ensure window.firestore and db are available before proceeding
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

    // Load watchlists from Firestore and set the current one
    async function loadUserWatchlists() {
        // Ensure db and currentUserId are available before proceeding
        if (!db || !currentUserId || !window.firestore) {
            console.warn("[Watchlist] Firestore DB, User ID, or Firestore functions not available for loading watchlists.");
            // If Firebase is not ready, hide loading and disable buttons
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
            updateMainButtonsState(true); // Update button states, including delete watchlist

            const migratedSomething = await migrateOldSharesToWatchlist();
            if (!migratedSomething) {
                console.log("[Watchlist] No old shares to migrate/update, directly loading shares for current watchlist.");
                await loadShares();
            }

        } catch (error) {
            console.error("[Watchlist] Error loading user watchlists:", error);
            showCustomAlert("Error loading watchlists: " + error.message);
            updateMainButtonsState(false); // Disable buttons on error
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }

    // Load shares from Firestore
    async function loadShares() {
        // Ensure db, currentUserId, currentWatchlistId, and window.firestore are available
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

    // One-time migration function for old shares
    async function migrateOldSharesToWatchlist() {
        // Ensure db, currentUserId, and window.firestore are available
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


    // --- UI Element References (Declared here after core functions, but before initial setup uses them) ---
    const mainTitle = document.getElementById('mainTitle');
    // New: Header "Add Share" button
    const addShareHeaderBtn = document.getElementById('addShareHeaderBtn');
    // Unified button IDs (no Desktop/Mobile suffix in JS)
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
    const currentPriceInput = document.getElementById('currentPrice'); // This is now "Entered Price" in UI
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
    const modalEnteredPrice = document.getElementById('modalEnteredPrice'); // New element for Entered Price
    const modalEnteredPriceDateTime = document.getElementById('modalEnteredPriceDateTime'); // New element for date/time next to Entered Price
    const modalTargetPrice = document.getElementById('modalTargetPrice');
    const modalDividendAmount = document.getElementById('modalDividendAmount');
    const modalFrankingCredits = document.getElementById('modalFrankingCredits');
    const modalCommentsContainer = document.getElementById('modalCommentsContainer');
    const modalUnfrankedYieldSpan = document.getElementById('modalUnfrankedYield');
    const modalFrankedYieldSpan = document.getElementById('modalFrankedYield');
    const editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn');
    // New external links
    const modalMarketIndexLink = document.getElementById('modalMarketIndexLink');
    const modalFoolLink = document.getElementById('modalFoolLink');
    const modalCommSecLink = document.getElementById('modalCommSecLink'); // NEW COMMSEC LINK REFERENCE
    const commSecLoginMessage = document.getElementById('commSecLoginMessage'); // NEW COMMSEC LOGIN MESSAGE REFERENCE

    const dividendCalculatorModal = document.getElementById('dividendCalculatorModal');
    const calcCloseButton = document.querySelector('.calc-close-button');
    // Reordered input references for dividend calculator
    const calcCurrentPriceInput = document.getElementById('calcCurrentPrice'); // Share Price
    const calcDividendAmountInput = document.getElementById('calcDividendAmount'); // Dividend Amount
    const calcFrankingCreditsInput = document.getElementById('calcFrankingCredits'); // Franking Credits
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
    const themeToggleBtn = document.getElementById('themeToggleBtn'); // Unified ID
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const appSidebar = document.getElementById('appSidebar'); // Renamed from mobileMenu
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    // Watchlist Management elements
    const addWatchlistBtn = document.getElementById('addWatchlistBtn');
    const editWatchlistBtn = document.getElementById('editWatchlistBtn'); // Renamed from deleteWatchlistBtn
    const addWatchlistModal = document.getElementById('addWatchlistModal');
    const newWatchlistNameInput = document.getElementById('newWatchlistName');
    const saveWatchlistBtn = document.getElementById('saveWatchlistBtn');
    const cancelAddWatchlistBtn = document.getElementById('cancelAddWatchlistBtn');
    // New Manage Watchlist Modal elements
    const manageWatchlistModal = document.getElementById('manageWatchlistModal');
    const editWatchlistNameInput = document.getElementById('editWatchlistName');
    const saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn');
    const deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn');
    const cancelManageWatchlistBtn = document.getElementById('cancelManageWatchlistBtn');

    // Ensure sidebarOverlay is correctly referenced or created if not already in HTML
    let sidebarOverlay = document.querySelector('.sidebar-overlay');
    if (!sidebarOverlay) { // Create if it doesn't exist
        sidebarOverlay = document.createElement('div');
        sidebarOverlay.classList.add('sidebar-overlay');
        document.body.appendChild(sidebarOverlay);
    }

    // Array of all form input elements for easy iteration and form clearing (excluding dynamic comments)
    const formInputs = [
        shareNameInput, currentPriceInput, targetPriceInput,
        dividendAmountInput, frankingCreditsInput
    ];

    // --- State Variables (Declared here) ---
    let db;
    let auth = null;
    let currentUserId = null;
    let currentAppId; // This will be set from window.getFirebaseAppId()
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


    // --- Initial UI Setup (Now after all element references and core functions) ---
    // MODAL FIX: Use class manipulation for initial hiding
    if (shareFormSection) shareFormSection.classList.remove('open');
    if (dividendCalculatorModal) dividendCalculatorModal.classList.remove('open');
    if (shareDetailModal) shareDetailModal.classList.remove('open');
    if (addWatchlistModal) addWatchlistModal.classList.remove('open'); // Hide new watchlist modal
    if (manageWatchlistModal) manageWatchlistModal.classList.remove('open'); // Hide new manage watchlist modal
    if (customDialogModal) customDialogModal.classList.remove('open');
    if (calculatorModal) calculatorModal.classList.remove('open');
    updateMainButtonsState(false); // Initially disable all auth-dependent buttons
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    // WatchlistSelect should always be rendered with placeholder, then enabled if logged in
    renderWatchlistSelect(); // Call this immediately to show the placeholder
    if (googleAuthBtn) googleAuthBtn.disabled = true;
    if (addShareHeaderBtn) addShareHeaderBtn.disabled = true; // Disable new add share button initially
    loadAndApplySavedTheme(); // Applies theme and updates themeToggleBtn text


    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js', { scope: './' }) 
                .then(registration => {
                    console.log('Service Worker (v25) from script.js: Registered with scope:', registration.scope); // Increment SW version
                })
                .catch(error => {
                    console.error('Service Worker (v25) from script.js: Registration failed:', error); // Increment SW version
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
    // MODAL FIX: Changed to target all .close-button elements within .modal-content
    document.querySelectorAll('.modal .close-button').forEach(button => { 
        button.addEventListener('click', closeModals); 
    });

    // --- Event Listener for Clicking Outside Modals ---
    // MODAL FIX: Changed to target the modal-overlay class (which is the background)
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            // Only close if the click is directly on the modal background, not its content
            if (event.target === modal) {
                closeModals();
            }
        });
    });


    // --- Firebase Initialization and Authentication State Listener ---
    // Safely assign Firebase globals after checking they exist
    if (window.firestoreDb && window.firebaseAuth && typeof window.getFirebaseAppId === 'function') {
        db = window.firestoreDb;
        auth = window.firebaseAuth;
        currentAppId = window.getFirebaseAppId(); // Now safely call the function
        console.log(`[Firebase Init] App ID: ${currentAppId}`); // Log the retrieved App ID
    } else {
        console.error("[Firebase] Firebase global variables or getFirebaseAppId function not available. Cannot proceed with Firebase operations.");
        document.body.innerHTML = '<div class="error-message"><p>Application failed to initialize Firebase.</p><p>Please ensure your environment provides Firebase configuration and try again.</p></div>';
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        updateMainButtonsState(false); // Disable all buttons
        return; // Stop script execution if Firebase isn't ready
    }

    if (auth) {
        if (googleAuthBtn) {
            googleAuthBtn.disabled = false;
            console.log("[Auth] Google Auth button enabled.");
        }
        window.authFunctions.onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                updateAuthButtonText(true, user.email || user.displayName);
                console.log("[AuthState] User signed in:", user.uid);
                if (user.email && user.email.toLowerCase() === KANGA_EMAIL) {
                    mainTitle.textContent = "Kanga's Share Watchlist"; // Corrected to "Kanga's Share Watchlist"
                } else {
                    mainTitle.textContent = "My Share Watchlist"; // Removed ASX
                }
                updateMainButtonsState(true); // Enable auth-dependent buttons
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                await loadUserWatchlists();
            } else {
                currentUserId = null;
                updateAuthButtonText(false);
                mainTitle.textContent = "Share Watchlist"; // Changed to "Share Watchlist" before login
                console.log("[AuthState] User signed out.");
                updateMainButtonsState(false); // Disable auth-dependent buttons
                clearShareList();
                clearWatchlistUI();
                if (loadingIndicator) loadingIndicator.style.display = 'none';
            }
        });
    } else {
        console.error("[Firebase] Firebase Auth not available. Cannot set up auth state listener or proceed with data loading.");
        updateAuthButtonText(false);
        updateMainButtonsState(false);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }

    // --- Authentication Functions Event Listener ---
    if (googleAuthBtn) {
        googleAuthBtn.addEventListener('click', async () => {
            console.log("[Auth] Google Auth Button Clicked.");
            const currentAuth = window.firebaseAuth;
            if (!currentAuth || !window.authFunctions) {
                console.warn("[Auth] Auth service not ready or functions not loaded. Cannot process click. Is button still disabled?");
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
        sortSelect.addEventListener('change', sortShares);
    }

    // --- Share Form Functions (Add/Edit) Event Listeners ---
    if (newShareBtn) {
        newShareBtn.addEventListener('click', () => {
            clearForm();
            formTitle.textContent = 'Add New Share';
            deleteShareFromFormBtn.style.display = 'none';
            showModal(shareFormSection);
            shareNameInput.focus();
            // Close sidebar when opening a modal/form
            toggleAppSidebar(false); 
        });
    }

    // New: Event listener for the header "Add Share" button
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
                else { shareData.previousFetchedPrice = shareData.currentPrice; } // Use currentPrice if no lastFetchedPrice
                shareData.lastFetchedPrice = shareData.currentPrice; // Update lastFetchedPrice to the new currentPrice

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

    if (addCommentSectionBtn) {
        addCommentSectionBtn.addEventListener('click', () => addCommentSection());
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
            if (newWatchlistNameInput) newWatchlistNameInput.value = ''; // Clear input
            showModal(addWatchlistModal);
            newWatchlistNameInput.focus();
            toggleAppSidebar(false); // Close sidebar
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
                
                // --- FIX: Immediately update currentWatchlistId and currentWatchlistName, then reload ---
                currentWatchlistId = newWatchlistRef.id;
                currentWatchlistName = watchlistName;
                await saveLastSelectedWatchlistId(currentWatchlistId); // Save as last selected
                await loadUserWatchlists(); // Reload watchlists to update dropdown and state (will now select the new one)
                await loadShares(); // Load shares for the newly selected watchlist (which will be empty)
                // --- END FIX ---

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
            // Disable delete button if it's the last watchlist
            deleteWatchlistInModalBtn.disabled = userWatchlists.length <= 1;
            showModal(manageWatchlistModal);
            editWatchlistNameInput.focus();
            toggleAppSidebar(false); // Close sidebar
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
                // Update local state and re-render UI
                currentWatchlistName = newName;
                await loadUserWatchlists(); // This will re-sort and select the current watchlist
                await loadShares(); // Ensure shares are reloaded if necessary (though not strictly needed for rename)
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
            // Updated confirmation message
            showCustomConfirm(`Are you sure you want to delete the watchlist '${watchlistToDeleteName}'? ALL SHARES IN THIS WATCHLIST WILL BE PERMANENTLY DELETED. This action cannot be undone.`, async () => {
                try {
                    // 1. Delete shares from the watchlist being deleted
                    const sharesColRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
                    const q = window.firestore.query(sharesColRef, window.firestore.where("watchlistId", "==", currentWatchlistId));
                    const querySnapshot = await window.firestore.getDocs(q);

                    const batch = window.firestore.writeBatch(db); // Use the exposed writeBatch
                    querySnapshot.forEach(doc => {
                        const shareRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, doc.id);
                        batch.delete(shareRef); // Delete the share
                    });
                    await batch.commit();
                    console.log(`[Firestore] Deleted ${querySnapshot.docs.length} shares from watchlist '${watchlistToDeleteName}'.`);

                    // 2. Delete the watchlist document itself
                    const watchlistDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`, currentWatchlistId);
                    await window.firestore.deleteDoc(watchlistDocRef);
                    console.log(`[Firestore] Watchlist '${watchlistToDeleteName}' (ID: ${currentWatchlistId}) deleted.`);

                    showCustomAlert(`Watchlist '${watchlistToDeleteName}' and its shares deleted successfully!`, 2000);
                    closeModals(); // Close the manage watchlist modal

                    // 3. Update UI and state
                    // After loadUserWatchlists, currentWatchlistId and currentWatchlistName will be set to the default
                    await loadUserWatchlists(); // Reload all watchlists to get updated list
                    await loadShares(); // Reload shares for the new current watchlist (which will be empty)
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
            // Focus on the first input in the new order
            calcCurrentPriceInput.focus(); 
            console.log("[UI] Dividend Calculator modal opened.");
            // Close sidebar when opening a modal/form
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
        // Read inputs in the new order
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
            // Close sidebar when opening a modal/form
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

    // --- Theme Toggling Logic Event Listener ---
    if (themeToggleBtn) { // This is the unified theme toggle button
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Listen for system theme changes (if no explicit saved theme is set)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        // Only react to system changes if no explicit theme is saved by the user
        if (localStorage.getItem('themeIndex') === null) { // Check for null, not 'light' or 'dark'
            if (event.matches) {
                document.body.classList.add('dark-theme');
                if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-desktop"></i> System Default'; // Keep icon consistent
            } else {
                document.body.classList.remove('dark-theme');
                if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-desktop"></i> System Default'; // Keep icon consistent
            }
            console.log("[Theme] System theme preference changed and applied.");
        }
    });

    // --- Scroll-to-Top Button Logic ---
    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            // Only show on mobile devices (or smaller screens as defined by CSS media query breakpoint)
            // Using window.innerWidth to check screen size for mobile responsiveness
            if (window.innerWidth <= 768) { // Assuming 768px as the breakpoint for mobile layout
                if (window.scrollY > 200) { // Show after scrolling down 200px
                    scrollToTopBtn.style.display = 'flex'; // Use flex to center arrow
                    scrollToTopBtn.style.opacity = '1';
                } else {
                    scrollToTopBtn.style.opacity = '0';
                    setTimeout(() => { // Hide completely after fade out
                        scrollToTopBtn.style.display = 'none';
                    }, 300); // Match CSS transition duration
                }
            } else {
                // Ensure it's hidden on desktop
                scrollToTopBtn.style.display = 'none';
            }
        });
        // Initial check for desktop to hide it immediately if window is resized or loaded on desktop
        if (window.innerWidth > 768) {
            scrollToTopBtn.style.display = 'none';
        }
        scrollToTopBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); console.log("[UI] Scrolled to top."); });
    }

    // --- Hamburger/Sidebar Menu Logic Event Listeners ---
    if (hamburgerBtn && appSidebar && closeMenuBtn && sidebarOverlay) {
        hamburgerBtn.addEventListener('click', () => toggleAppSidebar()); // No force, just toggle
        closeMenuBtn.addEventListener('click', () => toggleAppSidebar(false)); // Force close
        
        // Event listener for clicking outside the sidebar (on the overlay)
        sidebarOverlay.addEventListener('click', (event) => {
            console.log("[Sidebar Overlay] Clicked overlay. Attempting to close sidebar.");
            // Check if the sidebar is actually open before attempting to close via overlay
            if (appSidebar.classList.contains('open')) {
                toggleAppSidebar(false); // Force close
            }
        });

        // Handle resize event to adapt sidebar behavior
        window.addEventListener('resize', () => {
            const isDesktop = window.innerWidth > 768;
            // If sidebar is open, close it on resize to prevent layout issues
            if (appSidebar.classList.contains('open')) {
                toggleAppSidebar(false); // Force close
            }
            // Re-evaluate scroll-to-top button visibility on resize
            if (scrollToTopBtn) {
                if (window.innerWidth > 768) {
                    scrollToTopBtn.style.display = 'none';
                } else {
                    // Re-trigger scroll event to evaluate visibility based on scroll position
                    window.dispatchEvent(new Event('scroll'));
                }
            }
        });

        // Add event listeners to close menu when certain menu buttons are clicked
        const menuButtons = appSidebar.querySelectorAll('.menu-button-item');
        menuButtons.forEach(button => {
            // Corrected: Use camelCase for dataset property access
            if (button.dataset.actionClosesMenu === 'true') { 
                button.addEventListener('click', () => {
                    toggleAppSidebar(false); // Explicitly close the sidebar after these actions
                });
            }
        });
    }

}); // End DOMContentLoaded
