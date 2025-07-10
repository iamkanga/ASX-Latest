// File Version: v173
// Last Updated: 2025-07-09 (Fixed incorrect alert/action on calculator close, and ASX code button display)

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
let isDeletingShare = false; // Flag to prevent auto-save after a delete operation
let lastSavedShareId = null; // NEW: Track the ID of the last successfully saved share

// Theme related variables
const CUSTOM_THEMES = [
    'bold-1', 'bold-2', 'bold-3', 'bold-4', 'bold-5', 'bold-6', 'bold-7', 'bold-8', 'bold-9', 'bold-10',
    'subtle-1', 'subtle-2', 'subtle-3', 'subtle-4', 'subtle-5', 'subtle-6', 'subtle-7', 'subtle-8', 'subtle-9', 'subtle-10'
];
let currentCustomThemeIndex = -1; // To track the current theme in the cycle
let currentActiveTheme = 'system-default'; // Tracks the currently applied theme string (e.g., 'dark', 'bold', 'subtle', 'system-default')
let savedSortOrder = null; // GLOBAL: Stores the sort order loaded from user settings
let savedTheme = null; // GLOBAL: Stores the theme loaded from user settings

// Google Sheet Live Price Integration Variables
const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbwjuU2ZE1rCe4kiHT7WD-7CALkB0pg-zxkizz0xMIrhKxCBlKEp-YoMiUK85BQ2dHnZ/exec'; // UPDATED URL
let livePricesData = []; // Stores live prices fetched from Google Sheet


let unsubscribeShares = null; // Holds the unsubscribe function for the Firestore shares listener


// --- UI Element References (Declared globally for access by all functions) ---
const mainTitle = document.getElementById('mainTitle');
const addShareHeaderBtn = document.getElementById('addShareHeaderBtn');
const newShareBtn = document.getElementById('newShareBtn');
const standardCalcBtn = document.getElementById('standardCalcBtn');
const dividendCalcBtn = document.getElementById('dividendCalcBtn');
const asxCodeButtonsContainer = document.getElementById('asxCodeButtonsContainer');
const shareFormSection = document.getElementById('shareFormSection');
const formTitle = document.getElementById('formTitle');
const saveShareBtn = document.getElementById('saveShareBtn');
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
const modalFrankingCredits = document.getElementById('modalFrankingCredits'); // Corrected ID
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
const calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
const calcDividendAmountInput = document.getElementById('calcDividendAmount');
const calcFrankingCreditsInput = document.getElementById('calcFrankingCredits'); // Corrected ID for calculator's franking input
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
const addWatchlistBtn = document.getElementById('addWatchlistBtn');
const editWatchlistBtn = document.getElementById('editWatchlistBtn');
const addWatchlistModal = document.getElementById('addWatchlistModal');
const newWatchlistNameInput = document.getElementById('newWatchlistName');
const saveWatchlistBtn = document.getElementById('saveWatchlistBtn'); // Now a span
const manageWatchlistModal = document.getElementById('manageWatchlistModal');
const editWatchlistNameInput = document.getElementById('editWatchlistName');
const saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn'); // Now a span
const deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn'); // Now a span
const shareContextMenu = document.getElementById('shareContextMenu');
const contextEditShareBtn = document.getElementById('contextEditShareBtn');
const contextDeleteShareBtn = document.getElementById('contextDeleteShareBtn');
const logoutBtn = document.getElementById('logoutBtn'); // Now a span
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn'); // Export button
const refreshPricesBtn = document.getElementById('refreshPricesBtn'); // NEW: Refresh Prices button

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
    if (isDisabled) {
        element.classList.add('is-disabled-icon');
    } else {
        element.classList.remove('is-disabled-icon');
    }
}

/**
 * Saves the current share form data to Firestore.
 * This function is called when the modal is closed or explicitly saved.
 * @returns {Promise<boolean>} True if save was attempted and successful, false otherwise.
 */
async function saveShareFormData() {
    // Only attempt to save if a share is selected (editing) OR if it's a new share with a valid name
    const currentData = getCurrentFormData();
    const isShareNameValid = currentData.shareName.trim() !== '';

    if (!currentUserId || (!selectedShareDocId && !isShareNameValid)) {
        console.log("[Auto-Save] Skipping save: Not logged in or new share with empty name.");
        return false;
    }

    // If it's an existing share and no changes were made, skip saving
    if (selectedShareDocId && originalShareData && areShareDataEqual(originalShareData, currentData)) {
        console.log("[Auto-Save] Skipping save: No changes detected for existing share.");
        return false;
    }
    
    // If it's a new share and the name is empty, do not save.
    if (!selectedShareDocId && !isShareNameValid) {
        console.log("[Auto-Save] Skipping save: New share with empty name.");
        return false;
    }

    const shareName = currentData.shareName;
    const currentPrice = currentData.currentPrice;
    const targetPrice = currentData.targetPrice;
    const dividendAmount = parseFloat(dividendAmountInput.value); // Ensure parsing here
    const frankingCredits = parseFloat(frankingCreditsInput.value); // Ensure parsing here
    const comments = currentData.comments;

    const shareData = {
        shareName: shareName,
        currentPrice: isNaN(currentPrice) ? null : currentPrice,
        targetPrice: isNaN(targetPrice) ? null : targetPrice,
        dividendAmount: isNaN(dividendAmount) ? null : dividendAmount,
        frankingCredits: isNaN(frankingCredits) ? null : frankingCredits,
        comments: comments,
        userId: currentUserId,
        watchlistId: (watchlistSelect && watchlistSelect.value && watchlistSelect.value !== "") 
                       ? watchlistSelect.value 
                       : (userWatchlists.length > 0 ? userWatchlists[0].id : getDefaultWatchlistId(currentUserId)),
        lastPriceUpdateTime: new Date().toISOString()
    };

    try {
        if (selectedShareDocId) {
            // Before updating, check if the document still exists. This handles cases where it might have been deleted.
            const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, selectedShareDocId);
            const docSnap = await window.firestore.getDoc(shareDocRef);
            if (docSnap.exists()) {
                await window.firestore.updateDoc(shareDocRef, shareData);
                showCustomAlert(`Share '${shareName}' updated!`, 1000);
                console.log(`[Auto-Save] Share '${shareName}' (ID: ${selectedShareDocId}) auto-updated.`);
                lastSavedShareId = selectedShareDocId; // Track last saved share
                return true; // Indicate successful save
            } else {
                console.warn(`[Auto-Save] Skipping update: Document ${selectedShareDocId} no longer exists. It may have been deleted.`);
                lastSavedShareId = null; // Clear last saved ID if document is gone
                return false; // Indicate no save occurred
            }
        } else {
            shareData.entryDate = new Date().toISOString();
            shareData.lastFetchedPrice = shareData.currentPrice;
            shareData.previousFetchedPrice = shareData.currentPrice;

            const sharesColRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
            const newDocRef = await window.firestore.addDoc(sharesColRef, shareData);
            selectedShareDocId = newDocRef.id; // Set selectedShareDocId for the new share
            showCustomAlert(`Share '${shareName}' added!`, 1000);
            console.log(`[Auto-Save] New share '${shareName}' auto-added with ID: ${newDocRef.id}`);
            lastSavedShareId = newDocRef.id; // Track last saved share
            return true; // Indicate successful save
        }
    } catch (error) {
        console.error("[Auto-Save] Error auto-saving share:", error);
        showCustomAlert("Error auto-saving share: " + error.message);
        lastSavedShareId = null; // Clear last saved ID on error
        return false; // Indicate save failed
    }
}

/**
 * Saves new watchlist data to Firestore.
 * @returns {Promise<boolean>} True if save was attempted and successful, false otherwise.
 */
async function saveWatchlistData() {
    const watchlistName = newWatchlistNameInput.value.trim();
    if (!watchlistName) {
        showCustomAlert("Watchlist name is required!");
        return false; // Indicate no save occurred
    }
    if (userWatchlists.some(w => w.name.toLowerCase() === watchlistName.toLowerCase())) {
        showCustomAlert("A watchlist with this name already exists!");
        return false; // Indicate no save occurred
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
        
        currentSelectedWatchlistIds = [newWatchlistRef.id];
        await saveLastSelectedWatchlistIds(currentSelectedWatchlistIds);
        await loadUserWatchlistsAndSettings(); // This will re-render watchlists and trigger loadShares()
        return true; // Indicate successful save
    } catch (error) {
        console.error("[Firestore] Error adding watchlist:", error);
        showCustomAlert("Error adding watchlist: " + error.message);
        return false; // Indicate save failed
    }
}

/**
 * Saves edited watchlist name to Firestore.
 * @returns {Promise<boolean>} True if save was attempted and successful, false otherwise.
 */
async function saveEditedWatchlistName() {
    let watchlistToEditId = watchlistSelect.value;
    const newName = editWatchlistNameInput.value.trim();
    if (!newName) {
        showCustomAlert("Watchlist name cannot be empty!");
        return false; // Indicate no save occurred
    }
    if (userWatchlists.some(w => w.name.toLowerCase() === newName.toLowerCase() && w.id !== watchlistToEditId)) {
        showCustomAlert("A watchlist with this name already exists!");
        return false; // Indicate no save occurred
    }

    try {
        const watchlistDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`, watchlistToEditId);
        await window.firestore.updateDoc(watchlistDocRef, { name: newName });
        showCustomAlert(`Watchlist renamed to '${newName}'!`, 1500);
        console.log(`[Firestore] Watchlist (ID: ${watchlistToEditId}) renamed to '${newName}'.`);
        await loadUserWatchlistsAndSettings(); // This will re-render watchlists and trigger loadShares()
        return true; // Indicate successful save
    } catch (error) {
        console.error("[Firestore] Error renaming watchlist:", error);
        showCustomAlert("Error renaming watchlist: " + error.message);
        return false; // Indicate save failed
    }
}


// Centralized Modal Closing Function
function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        if (modal) {
            const isEditableModal = modal.id === 'shareFormSection' || modal.id === 'addWatchlistModal' || modal.id === 'manageWatchlistModal';
            
            if (isEditableModal) {
                // Use a dedicated async IIFE to handle the save and prevent blocking the main thread
                (async () => {
                    let saveSuccessful = false;
                    if (modal.id === 'shareFormSection') {
                        // Only attempt auto-save if not currently in a delete operation
                        if (!isDeletingShare) { // Check the flag here
                            const currentFormData = getCurrentFormData();
                            const isShareNameValid = currentFormData.shareName.trim() !== '';
                            const isDirty = selectedShareDocId ? !areShareDataEqual(originalShareData, currentFormData) : isShareNameValid;
                            
                            // Only attempt save if dirty AND shareName is valid
                            if (isDirty && isShareNameValid) { 
                                saveSuccessful = await saveShareFormData();
                            } else if (!isDirty) { 
                                console.log("[Auto-Save] Skipping save: Share form not dirty.");
                            } else if (!isShareNameValid) { 
                                console.warn("[Auto-Save] Skipping save: Share form has invalid name.");
                            }
                        } else {
                            console.log("[Auto-Save] Skipping save: Delete operation in progress.");
                            isDeletingShare = false; // Reset the flag after skipping
                        }
                    } else if (modal.id === 'addWatchlistModal') {
                        if (newWatchlistNameInput && newWatchlistNameInput.value.trim() !== '') {
                            const watchlistName = newWatchlistNameInput.value.trim();
                            if (!userWatchlists.some(w => w.name.toLowerCase() === watchlistName.toLowerCase())) {
                                saveSuccessful = await saveWatchlistData();
                            } else {
                                console.log("[Auto-Save] Skipping save: Add Watchlist form not dirty or duplicate name.");
                            }
                        } else {
                             console.log("[Auto-Save] Skipping save: Add Watchlist form empty.");
                        }
                    } else if (modal.id === 'manageWatchlistModal') {
                        const currentName = editWatchlistNameInput.value.trim();
                        const selectedWatchlistObj = userWatchlists.find(w => w.id === watchlistSelect.value);
                        if (selectedWatchlistObj && currentName !== selectedWatchlistObj.name) {
                            saveSuccessful = await saveEditedWatchlistName();
                        } else {
                            console.log("[Auto-Save] Skipping save: Manage Watchlist form not dirty.");
                        }
                    }
                })();
            } else if (modal.id === 'dividendCalculatorModal' || modal.id === 'calculatorModal') {
                console.log(`[Auto-Save] Calculator modal (${modal.id}) closed, no save alert.`);
            }
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
        const buttonTextSpan = googleAuthBtn.querySelector('.button-text');
        if (buttonTextSpan) {
            buttonTextSpan.textContent = isSignedIn ? (userName || 'Signed In') : 'Sign In with Google';
            console.log(`[Auth UI] Auth button text updated to: ${buttonTextSpan.textContent}`);
        }
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
    if (editWatchlistBtn) editWatchlistBtn.disabled = !enable || userWatchlists.length === 0; 
    if (addShareHeaderBtn) addShareHeaderBtn.disabled = !enable;
    if (logoutBtn) setIconDisabled(logoutBtn, !enable); 
    if (themeToggleBtn) themeToggleBtn.disabled = !enable;
    if (colorThemeSelect) colorThemeSelect.disabled = !enable;
    if (revertToDefaultThemeBtn) revertToDefaultThemeBtn.disabled = !enable;
    if (sortSelect) sortSelect.disabled = !enable; 
    if (watchlistSelect) watchlistSelect.disabled = !enable; 
    if (refreshPricesBtn) refreshPricesBtn.disabled = !enable; 
    console.log(`[UI State] Sort Select Disabled: ${sortSelect ? sortSelect.disabled : 'N/A'}`);
    console.log(`[UI State] Watchlist Select Disabled: ${watchlistSelect ? watchlistSelect.disabled : 'N/A'}`);
    console.log(`[UI State] Refresh Prices Button Disabled: ${refreshPricesBtn ? refreshPricesBtn.disabled : 'N/A'}`);
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
        if (input) { 
            // Set value to empty string for text inputs
            if (input.type === 'text') {
                input.value = '';
            } 
            // For number inputs, set to empty string and add focus/click listener to clear
            else if (input.type === 'number') {
                input.value = ''; // Start empty
                // Add a one-time listener to clear on focus/click if not already empty
                const clearOnFocus = () => {
                    if (this.value === '0' || this.value === '0.00' || this.value === '0.000') {
                        this.value = '';
                    }
                    this.removeEventListener('focus', clearOnFocus);
                    this.removeEventListener('click', clearOnFocus);
                };
                input.addEventListener('focus', clearOnFocus);
                input.addEventListener('click', clearOnFocus);
            }
        }
    });
    if (commentsFormContainer) {
        commentsFormContainer.innerHTML = '';
        addCommentSection(); // Always add one initial comment section to make it visible
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
    frankingCreditsInput.value = Number(shareToEdit.frankingCredits) !== null && !isNaN(Number(shareToEdit.frankingCredits)) ? Number(shareToEdit.frankingCredits).toFixed(1) : ''; // Corrected typo
    
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
            return false;
        }
    }

    // Deep compare comments array
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

    if (!isShareNameValid) {
        setIconDisabled(saveShareBtn, true); // Always disable if share name is empty
        return;
    }

    if (selectedShareDocId && originalShareData) {
        // Editing an existing share
        const isDirty = !areShareDataEqual(originalShareData, currentData);
        setIconDisabled(saveShareBtn, !isDirty);
    } else {
        // Adding a new share (only depends on share name validity)
        setIconDisabled(saveShareBtn, !isShareNameValid);
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
    
    // Live Price for Modal Details
    const normalizedShareName = share.shareName ? share.shareName.toUpperCase().replace('ASX:', '') : '';
    const livePriceItem = livePricesData.find(item => 
        typeof item.Code === 'string' && item.Code.toUpperCase().replace('ASX:', '') === normalizedShareName
    );
    // Debugging live price display
    console.log(`[Live Price Debug] Share: ${share.shareName}, Normalized: ${normalizedShareName}, LivePriceItem:`, livePriceItem);

    // Ensure Price is a number before using toFixed
    const livePrice = livePriceItem && typeof livePriceItem.Price === 'number' && !isNaN(livePriceItem.Price) ? livePriceItem.Price : undefined;
    const previousClosePrice = livePriceItem && typeof livePriceItem.PreviousClose === 'number' && !isNaN(livePriceItem.PreviousClose) ? livePriceItem.PreviousClose : undefined;

    let livePriceDisplay = livePrice !== undefined ? `$${Number(livePrice).toFixed(2)}` : '-';
    let livePriceClass = ''; // For red/green styling

    if (livePrice !== undefined && previousClosePrice !== undefined) {
        if (livePrice > previousClosePrice) {
            livePriceClass = 'price-up'; // Green
        } else if (livePrice < previousClosePrice) {
            livePriceClass = 'price-down'; // Red
        }
    }

    // Insert Live Price before Entered Price in the modal details
    // Remove any existing live price paragraph first to prevent duplicates on re-opening
    const existingLivePriceParagraph = document.querySelector('#shareDetailModal #modalLivePrice');
    if (existingLivePriceParagraph) {
        existingLivePriceParagraph.remove();
    }
    const enteredPriceParagraph = document.getElementById('modalEnteredPrice').closest('p');
    if (enteredPriceParagraph) {
        const livePriceParagraph = document.createElement('p');
        livePriceParagraph.id = 'modalLivePrice'; // Add an ID to easily find and remove it later
        livePriceParagraph.innerHTML = `<strong>Live Price:</strong> <span class="numerical-input-bold ${livePriceClass}">${livePriceDisplay}</span>`;
        enteredPriceParagraph.parentNode.insertBefore(livePriceParagraph, enteredPriceParagraph);
    }

    const enteredPriceNum = Number(share.currentPrice);
    document.getElementById('modalEnteredPrice').textContent = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? `$${enteredPriceNum.toFixed(2)}` : 'N/A';

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

    if (modalCommSecLink && share.shareName) { // Corrected from modalCommSecLink to commSecLink
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
    allSharesOption.textContent = 'All Shares'; // Removed "Display"
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
        currentSortOrder = savedSortOrder; // Update the global variable
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

    // NEW: Live Price Cell - Safely access item.Code and item.Price
    const livePriceCell = row.insertCell();
    // Normalize share name for lookup (remove ASX: if present, ensure uppercase)
    const normalizedShareName = share.shareName ? share.shareName.toUpperCase().replace('ASX:', '') : '';
    const livePriceItem = livePricesData.find(item => 
        typeof item.Code === 'string' && item.Code.toUpperCase().replace('ASX:', '') === normalizedShareName
    );
    // Debugging live price display
    console.log(`[Live Price Debug] Share: ${share.shareName}, Normalized: ${normalizedShareName}, LivePriceItem:`, livePriceItem);

    // Ensure Price is a number before using toFixed
    const livePrice = livePriceItem && typeof livePriceItem.Price === 'number' && !isNaN(livePriceItem.Price) ? livePriceItem.Price : undefined;
    const previousClosePrice = livePriceItem && typeof livePriceItem.PreviousClose === 'number' && !isNaN(livePriceItem.PreviousClose) ? livePriceItem.PreviousClose : undefined;

    let livePriceDisplay = livePrice !== undefined ? `$${Number(livePrice).toFixed(2)}` : '-';
    let livePriceClass = ''; // For red/green styling

    if (livePrice !== undefined && previousClosePrice !== undefined) {
        if (livePrice > previousClosePrice) {
            livePriceClass = 'price-up'; // Green
        } else if (livePrice < previousClosePrice) {
            livePriceClass = 'price-down'; // Red
        }
    }
    
    livePriceCell.innerHTML = `<span class="numerical-input-bold ${livePriceClass}">${livePriceDisplay}</span>`;
    livePriceCell.title = livePrice !== undefined ? `Live Price: $${Number(livePrice).toFixed(2)}` : 'No live price available';


    const enteredPriceCell = row.insertCell();
    const enteredPriceNum = Number(share.currentPrice);
    const displayEnteredPrice = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? `$${enteredPriceNum.toFixed(2)}` : '-';
    enteredPriceCell.innerHTML = `<span class="numerical-input-bold">${displayEnteredPrice}</span>`;


    const targetPriceCell = row.insertCell();
    const targetPriceNum = Number(share.targetPrice);
    const displayTargetPrice = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? `$${targetPriceNum.toFixed(2)}` : '-';
    targetPriceCell.innerHTML = `<span class="numerical-input-bold">${displayTargetPrice}</span>`;


    const dividendCell = row.insertCell();
    const dividendAmountNum = Number(share.dividendAmount);
    const frankingCreditsNum = Number(share.frankingCredits);
    const unfrankedYield = calculateUnfrankedYield(dividendAmountNum, enteredPriceNum); 
    const frankedYield = calculateFrankedYield(dividendAmountNum, enteredPriceNum, frankingCreditsNum);
    const divAmountDisplay = (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? `$${dividendAmountNum.toFixed(2)}` : '-';

    dividendCell.innerHTML = `
        <div class="dividend-yield-cell-content">
            <span>Dividend:</span> <span class="value numerical-input-bold">${divAmountDisplay}</span>
        </div>
        <div class="dividend-yield-cell-content">
            <span>Unfranked Yield:</span> <span class="value numerical-input-bold">${unfrankedYield !== null ? unfrankedYield.toFixed(2) + '%' : '-'}</span>
        </div>
        <div class="dividend-yield-cell-content">
            <span>Franked Yield:</span> <span class="value numerical-input-bold">${frankedYield !== null ? frankedYield.toFixed(2) + '%' : '-'}</span>
        </div>
    `;

    const commentsCell = row.insertCell();
    let commentsText = '';
    if (share.comments && Array.isArray(share.comments) && share.comments.length > 0 && share.comments[0].text) {
        commentsText = truncateText(commentsText, 70);
    }
    commentsCell.textContent = commentsText;
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
        commentsSummary = truncateText(commentsSummary, 70); // Corrected to use commentsSummary
    }

    const displayTargetPrice = (!isNaN(targetPriceNum) && targetPriceNum !== null) ? targetPriceNum.toFixed(2) : '-';
    const displayDividendAmount = (!isNaN(dividendAmountNum) && dividendAmountNum !== null) ? dividendAmountNum.toFixed(2) : '-';
    const displayFrankingCredits = (!isNaN(frankingCreditsNum) && frankingCreditsNum !== null) ? `${frankingCreditsNum}%` : '-';
    const displayShareName = (share.shareName && String(share.shareName).trim() !== '') ? share.shareName : '(No Code)';
    const displayEnteredPrice = (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? enteredPriceNum.toFixed(2) : '-';

    // NEW: Live Price for Mobile Cards - Safely access item.Code and item.Price
    const normalizedShareName = share.shareName ? share.shareName.toUpperCase().replace('ASX:', '') : '';
    const livePriceItem = livePricesData.find(item => 
        typeof item.Code === 'string' && item.Code.toUpperCase().replace('ASX:', '') === normalizedShareName
    );
    // Debugging live price display
    console.log(`[Live Price Debug] Mobile Card Share: ${share.shareName}, Normalized: ${normalizedShareName}, LivePriceItem:`, livePriceItem);

    const livePrice = livePriceItem && typeof livePriceItem.Price === 'number' && !isNaN(livePriceItem.Price) ? livePriceItem.Price : undefined;
    const previousClosePrice = livePriceItem && typeof livePriceItem.PreviousClose === 'number' && !isNaN(livePriceItem.PreviousClose) ? livePriceItem.PreviousClose : undefined; // Corrected to PreviousClose

    let displayLivePrice = livePrice !== undefined ? `$${Number(livePrice).toFixed(2)}` : '-';
    let livePriceClass = ''; // For red/green styling

    if (livePrice !== undefined && previousClosePrice !== undefined) {
        if (livePrice > previousClosePrice) {
            livePriceClass = 'price-up'; // Green
        } else if (livePrice < previousClosePrice) {
            livePriceClass = 'price-down'; // Red
        }
    }


    card.innerHTML = `
        <h3>${displayShareName}</h3>
        <p><strong>Entry Date:</strong> ${formatDate(share.entryDate) || '-'}</p>
        <p><strong>Live Price:</strong> <span class="numerical-input-bold ${livePriceClass}">${displayLivePrice}</span></p> <!-- NEW: Live Price -->
        <p><strong>Entered Price:</strong> <span class="numerical-input-bold">$${displayEnteredPrice}</span></p>
        <p><strong>Target:</strong> <span class="numerical-input-bold">$${displayTargetPrice}</span></p>
        <p><strong>Dividend:</strong> <span class="numerical-input-bold">$${displayDividendAmount}</span></p>
        <p><strong>Franking:</strong> <span class="numerical-input-bold">${displayFrankingCredits}</span></p>
        <p><strong>Unfranked Yield:</strong> <span class="numerical-input-bold">${unfrankedYield !== null ? unfrankedYield.toFixed(2) + '%' : '-'}</span></p>
        <p><strong>Franked Yield:</strong> <span class="numerical-input-bold">${frankedYield !== null ? frankedYield.toFixed(2) + '%' : '-'}</span></p>
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
        td.colSpan = 6; // Adjusted colspan for the new 'Live Price' column
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
        button.addEventListener('click', (event) => {
            console.log(`[ASX Button Click] Button for ${asxCode} clicked.`); // Log to confirm click
            const clickedCode = event.target.dataset.asxCode;
            scrollToShare(clickedCode);
        });
        asxCodeButtonsContainer.appendChild(button); // Append the button here
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
        console.warn("[Watchlist] Cannot save last selected watchlists: DB, User ID, or Firestore functions not available. Skipping save.");
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
            // If "Show All Shares" was selected, ensure it's still valid (i.e., there are watchlists)
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
            console.log("[Sort] No valid saved sort order or not logged in, defaulting to placeholder.");
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
 * Fetches live share prices from the Google Apps Script API.
 */
async function fetchLivePrices() {
    if (!GOOGLE_SHEET_API_URL) {
        console.warn("[Live Prices] Google Sheet API URL is not defined. Skipping live price fetch.");
        return;
    }
    console.log("[Live Prices] Fetching live prices from Google Sheet API...");
    try {
        const response = await fetch(GOOGLE_SHEET_API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        livePricesData = data;
        console.log("[Live Prices] Successfully fetched live prices:", livePricesData);
        // Add more detailed logging for live prices data to debug display issues
        if (livePricesData.length > 0) {
            console.log("[Live Prices Debug] First live price item:", livePricesData[0]);
        }
    } catch (error) {
        console.error("[Live Prices] Error fetching live prices:", error);
        showCustomAlert("Error fetching live prices: " + error.message, 2000);
        livePricesData = []; // Clear old data on error
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
        unsubscribeShares = window.firestore.onSnapshot(q, async (querySnapshot) => { // Added async here
            console.log("[Firestore Listener] Shares snapshot received. Processing changes.");
            let fetchedShares = [];
            querySnapshot.forEach((doc) => {
                const share = { id: doc.id, ...doc.data() };
                fetchedShares.push(share);
            });

            allSharesData = fetchedShares;
            console.log(`[Shares] Shares data updated from snapshot. Total shares: ${allSharesData.length}`);
            
            // Fetch live prices after shares are loaded
            await fetchLivePrices(); // Fetch live prices here

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
                console.log(`[Migration] Share '${doc.id}': Converted 'name' to 'shareName'.`);
            }
            const fieldsToConvert = ['currentPrice', 'targetPrice', 'dividendAmount', 'frankingCredits', 'entryPrice', 'lastFetchedPrice', 'previousFetchedPrice'];
            fieldsToConvert.forEach(field => {
                const value = shareData[field];
                const originalValueType = typeof value;
                let parsedValue = value;
                let fieldNeedsUpdate = false; // Flag to track if this specific field needs update

                if (originalValueType === 'string' && value.trim() !== '') {
                    parsedValue = parseFloat(value);
                    if (isNaN(parsedValue)) {
                        parsedValue = null; // Set to null if parsing fails
                        fieldNeedsUpdate = true;
                        console.warn(`[Migration] Share '${doc.id}': Field '${field}' was invalid string '${value}', setting to null.`);
                    } else if (originalValueType !== typeof parsedValue || value !== String(parsedValue)) {
                        // Only update if type changed or string representation is different (e.g., "1.0" to 1)
                        fieldNeedsUpdate = true;
                        console.log(`[Migration] Share '${doc.id}': Converted ${field} from string '${value}' (type ${originalValueType}) to number ${parsedValue}.`);
                    }
                } else if (originalValueType === 'number' && isNaN(value)) {
                    parsedValue = null;
                    fieldNeedsUpdate = true;
                    console.warn(`[Migration] Share '${doc.id}': Field '${field}' was NaN number, setting to null.`);
                }

                // Apply franking credits specific logic after parsing
                if (field === 'frankingCredits' && typeof parsedValue === 'number' && !isNaN(parsedValue)) {
                    if (parsedValue > 0 && parsedValue < 1) { // Convert 0.7 to 70
                        parsedValue *= 100;
                        fieldNeedsUpdate = true;
                        console.log(`[Migration] Share '${doc.id}': Converted frankingCredits from decimal to percentage ${parsedValue}.`);
                    }
                }

                if (fieldNeedsUpdate) {
                    needsUpdate = true; // Overall share needs update
                    updatePayload[field] = parsedValue;
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
    const menuHeight = shareContextMenu.offsetHeight; // Corrected from offsetWidth to offsetHeight
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust x position if menu overflows right
    if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10; // 10px padding from right edge
    }
    // Adjust y position if menu overflows bottom
    if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10; // 10px padding from bottom edge
    }
    // Ensure menu doesn't go off screen to the left or top
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
        "Code", "Entered Price", "Live Price", "Target Price", "Dividend Amount", "Franking Credits (%)", // Added Live Price to headers
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

        // Get live price for export - Safely access item.Code and item.Price
        const normalizedShareName = share.shareName ? share.shareName.toUpperCase().replace('ASX:', '') : '';
        const livePriceItem = livePricesData.find(item => 
            typeof item.Code === 'string' && item.Code.toUpperCase().replace('ASX:', '') === normalizedShareName
        );
        const exportLivePrice = livePriceItem && typeof livePriceItem.Price === 'number' && !isNaN(livePriceItem.Price) ? Number(livePriceItem.Price).toFixed(2) : '';

        const row = [
            share.shareName || '',
            (!isNaN(enteredPriceNum) && enteredPriceNum !== null) ? enteredPriceNum.toFixed(2) : '',
            exportLivePrice, // Added live price to the row
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
            // Add focus listener to clear input value if it's '0' or '0.00'
            input.addEventListener('focus', function() {
                if (this.type === 'number' && (this.value === '0' || this.value === '0.00' || this.value === '0.000')) {
                    this.value = '';
                }
            });
            // Add blur listener to re-format if empty after focus
            input.addEventListener('blur', function() {
                // For frankingCreditsInput, if it's left empty, set it to null or 0 for consistency
                if (this.id === 'frankingCredits' && this.value === '') {
                    this.value = ''; // Keep it visually empty
                }
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

    // Add Comment Section Button (Re-implementation)
    // Remove existing event listener if any to prevent duplicates
    if (addCommentSectionBtn) {
        addCommentSectionBtn.removeEventListener('click', addCommentSection); // Remove old listener if it exists
        addCommentSectionBtn.addEventListener('click', () => {
            addCommentSection();
            checkFormDirtyState(); // Check dirty state after adding a comment section
        });
        setIconDisabled(addCommentSectionBtn, false); // Ensure it's enabled by default
    }


    // Global click listener to close modals/context menu if clicked outside
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

    // Save Share Button (explicit save)
    if (saveShareBtn) {
        saveShareBtn.addEventListener('click', async () => {
            console.log("[Share Form] Save Share button clicked.");
            // Ensure button is not disabled before proceeding
            if (saveShareBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert("Please enter a share code and make changes to save.");
                console.warn("[Save Share] Save button was disabled, preventing action.");
                return;
            }
            await saveShareFormData(); // Call the unified save function
            closeModals(); // Close modal after explicit save
        });
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
                isDeletingShare = true; // Set flag before deletion
                try {
                    const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, selectedShareDocId);
                    await window.firestore.deleteDoc(shareDocRef);
                    showCustomAlert("Share deleted successfully!", 1500);
                    console.log(`[Firestore] Share (ID: ${selectedShareDocId}) deleted.`);
                    // Set selectedShareDocId to null immediately after successful deletion to prevent auto-save attempts
                    selectedShareDocId = null; 
                    closeModals();
                } catch (error) {
                    console.error("[Firestore] Error deleting share:", error);
                    showCustomAlert("Error deleting share: " + error.message);
                } finally {
                    isDeletingShare = false; // Reset flag after operation completes or fails
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
            if (deleteShareFromDetailBtn.classList.contains('is-disabled-icon')) {
                console.warn("[Delete Share From Detail] Delete button was disabled, preventing action.");
                return; // Do nothing if visually disabled
            }
            if (selectedShareDocId) {
                isDeletingShare = true; // Set flag before deletion
                try {
                    const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, selectedShareDocId);
                    await window.firestore.deleteDoc(shareDocRef);
                    showCustomAlert("Share deleted successfully!", 1500);
                    console.log(`[Firestore] Share (ID: ${selectedShareDocId}) deleted.`);
                    // Set selectedShareDocId to null immediately after successful deletion to prevent auto-save attempts
                    selectedShareDocId = null;
                    closeModals();
                } catch (error) {
                    console.error("[Firestore] Error deleting share:", error);
                    showCustomAlert("Error deleting share: " + error.message);
                } finally {
                    isDeletingShare = false; // Reset flag after operation completes or fails
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

    // Context Menu Delete Share Button (No confirmation as per user request)
    if (contextDeleteShareBtn) {
        contextDeleteShareBtn.addEventListener('click', async () => {
            console.log("[Context Menu] Delete Share button clicked (No Confirmation).");
            if (currentContextMenuShareId) {
                isDeletingShare = true; // Set flag before deletion
                const shareToDeleteId = currentContextMenuShareId;
                hideContextMenu();
                try {
                    const shareDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, shareToDeleteId);
                    await window.firestore.deleteDoc(shareDocRef);
                    showCustomAlert("Share deleted successfully!", 1500);
                    console.log(`[Firestore] Share (ID: ${shareToDeleteId}) deleted.`);
                    // Set selectedShareDocId to null immediately after successful deletion to prevent auto-save attempts
                    selectedShareDocId = null;
                    closeModals();
                } catch (error) {
                    console.error("[Firestore] Error deleting share:", error);
                    showCustomAlert("Error deleting share: " + error.message);
                } finally {
                    isDeletingShare = false; // Reset flag after operation completes or fails
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
            setIconDisabled(saveWatchlistBtn, isDisabled);
        });
    }

    // Save Watchlist Button (explicit save)
    if (saveWatchlistBtn) {
        saveWatchlistBtn.addEventListener('click', async () => {
            console.log("[Watchlist Form] Save Watchlist button clicked.");
            if (saveWatchlistBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert("Please enter a watchlist name.");
                return;
            }
            await saveWatchlistData(); // Call the dedicated save function
            closeModals(); // Close modal after explicit save
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

    // Save Watchlist Name Button (explicit save)
    if (saveWatchlistNameBtn) {
        saveWatchlistNameBtn.addEventListener('click', async () => {
            console.log("[Manage Watchlist Form] Save Watchlist Name button clicked.");
            if (saveWatchlistNameBtn.classList.contains('is-disabled-icon')) {
                showCustomAlert("Watchlist name cannot be empty.");
                return;
            }
            await saveEditedWatchlistName(); // Call the dedicated save function
            closeModals(); // Close modal after explicit save
        });
    }

    // Delete Watchlist In Modal Button (No confirmation as per user request)
    if (deleteWatchlistInModalBtn) {
        deleteWatchlistInModalBtn.addEventListener('click', async () => {
            console.log("[Manage Watchlist Form] Delete Watchlist button clicked (No Confirmation).");
            if (deleteWatchlistInModalBtn.classList.contains('is-disabled-icon')) {
                console.warn("[Delete Watchlist In Modal] Delete button was disabled, preventing action.");
                return; // Do nothing if visually disabled
            }

            let watchlistToEditId = watchlistSelect.value; 

            if (!watchlistToEditId || userWatchlists.length <= 1) {
                showCustomAlert("Cannot delete the last watchlist. Please create another watchlist first.");
                return;
            }
            const watchlistToDeleteName = userWatchlists.find(w => w.id === watchlistToEditId)?.name || 'Unknown Watchlist';
            
            try {
                const sharesColRef = window.firestore.collection(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`);
                const q = window.firestore.query(sharesColRef, window.firestore.where("watchlistId", "==", watchlistToEditId));
                const querySnapshot = await window.firestore.getDocs(q);

                const batch = window.firestore.writeBatch(db);
                querySnapshot.forEach(doc => {
                    const shareRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/shares`, doc.id);
                    batch.delete(shareRef);
                });
                await batch.commit();
                console.log(`[Firestore] Deleted ${querySnapshot.docs.length} shares from watchlist '${watchlistToDeleteName}'.`);

                const watchlistDocRef = window.firestore.doc(db, `artifacts/${currentAppId}/users/${currentUserId}/watchlists`, watchlistToEditId);
                await window.firestore.deleteDoc(watchlistDocRef);
                console.log(`[Firestore] Watchlist '${watchlistToDeleteName}' (ID: ${watchlistToEditId}) deleted.`);

                showCustomAlert(`Watchlist '${watchlistToDeleteName}' and its shares deleted successfully!`, 2000);
                closeModals();

                await loadUserWatchlistsAndSettings(); // This will re-render watchlists and trigger loadShares()
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
            // Clear and reset inputs for the calculator
            if (calcDividendAmountInput) calcDividendAmountInput.value = '';
            if (calcCurrentPriceInput) calcCurrentPriceInput.value = '';
            if (calcFrankingCreditsInput) calcFrankingCreditsInput.value = '';
            if (calcUnfrankedYieldSpan) calcUnfrankedYieldSpan.textContent = '-';
            if (calcFrankedYieldSpan) calcFrankedYieldSpan.textContent = '-';
            if (calcEstimatedDividend) calcEstimatedDividend.textContent = '-';
            if (investmentValueSelect) investmentValueSelect.value = '10000'; // Reset to default investment value
            
            showModal(dividendCalculatorModal);
            if (calcCurrentPriceInput) calcCurrentPriceInput.focus(); 
            console.log("[UI] Dividend Calculator modal opened.");
            toggleAppSidebar(false);
        });
    }

    // Dividend Calculator Input Listeners
    [calcDividendAmountInput, calcCurrentPriceInput, calcFrankingCreditsInput, investmentValueSelect].forEach(input => {
        if (input) {
            input.addEventListener('input', updateDividendCalculations);
            input.addEventListener('change', updateDividendCalculations);
            // Add focus listener to clear input value if it's '0' or '0.00'
            input.addEventListener('focus', function() {
                if (this.type === 'number' && (this.value === '0' || this.value === '0.00' || this.value === '0.000')) {
                    this.value = '';
                }
            });
        }
    });

    function updateDividendCalculations() {
        const currentPrice = parseFloat(calcCurrentPriceInput.value);
        const dividendAmount = parseFloat(calcDividendAmountInput.value);
        const frankingCredits = parseFloat(calcFrankingCreditsInput.value); // Use calcFrankingCreditsInput
        const investmentValue = parseFloat(investmentValueSelect.value);
        
        const unfrankedYield = calculateUnfrankedYield(dividendAmount, currentPrice); 
        const frankedYield = calculateFrankedYield(dividendAmount, currentPrice, frankingCredits);
        const estimatedDividend = estimateDividendIncome(investmentValue, dividendAmount, currentPrice);
        
        calcUnfrankedYieldSpan.textContent = unfrankedYield !== null ? `${unfrankedYield.toFixed(2)}%` : '-';
        calcFrankedYieldSpan.textContent = frankedYield !== null ? `${frankedYield.toFixed(2)}%` : '-';
        calcEstimatedDividend.textContent = estimatedDividend !== null ? `$${estimatedDividend.toFixed(2)}` : '-';
    }

    // Standard Calculator Modal
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
            if (currentCalculatorInput === '' && previousCalculatorInput === '') {
                // If no input and no previous result, but an operator is pressed, assume 0
                if (previousCalculatorInput === '') {
                    previousCalculatorInput = '0';
                }
            }
            if (currentCalculatorInput !== '') {
                if (previousCalculatorInput !== '') { calculateResult(); previousCalculatorInput = calculatorResult.textContent; }
                else { previousCalculatorInput = currentCalculatorInput; }
            }
            operator = action; currentCalculatorInput = ''; resultDisplayed = false; updateCalculatorDisplay(); return;
        }
        if (action === 'calculate') {
            if (previousCalculatorInput === '' || currentCalculatorInput === '' || operator === null) { return; }
            calculateResult(); operator = null;
            resultDisplayed = true;
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

    // NEW: Refresh Prices Button Event Listener
    if (refreshPricesBtn) {
        refreshPricesBtn.addEventListener('click', async () => {
            console.log("[UI] Refresh Prices button clicked.");
            if (currentUserId) {
                if (loadingIndicator) loadingIndicator.style.display = 'block';
                await fetchLivePrices(); // Re-fetch live prices
                sortShares(); // Re-render shares with new prices (sortShares calls renderWatchlist)
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                showCustomAlert("Live prices refreshed!", 1500);
            } else {
                showCustomAlert("Please sign in to refresh prices.", 1500);
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("script.js (v170) DOMContentLoaded fired."); // Updated version number

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
