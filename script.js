// File Version: v153
// Last Updated: 2025-07-03 (Firebase Reference Fixes & Share Research Logic)

// This script interacts with Firebase Firestore for data storage.
// Firebase app, db, auth instances, and userId are made globally available
// via window.firestoreDb, window.firebaseAuth, window.getFirebaseAppId(), etc.,
// from the <script type="module"> block in index.html.

// Import necessary Firebase functions directly for use with the global db/auth instances
// These are imported in index.html's module script and made available via window.firestoreDb, etc.
// We still declare them here to satisfy ESLint or for clarity, but they are populated from window.
let db;
let auth;
// Firestore functions (will be populated from global window.firestore properties if needed, or used directly with db)
let collection;
let doc;
let getDoc;
let addDoc;
let setDoc;
let updateDoc;
let deleteDoc;
let onSnapshot;
let query;
let where;
let getDocs;
let FieldValue; // For serverTimestamp, deleteField
let writeBatch;

// Auth functions (will be populated from global window.authFunctions)
let GoogleAuthProviderInstance;
let signInAnonymously;
let signInWithCustomToken;
let signInWithPopup;
let signOut;
let onAuthStateChanged;


// --- GLOBAL VARIABLES (Accessible throughout the script) ---
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
let unsubscribeShares = null; // Holds the unsubscribe function for the shares listener
let unsubscribeWatchlists = null; // Holds the unsubscribe function for the watchlists listener

// --- DOM ELEMENT REFERENCES ---
const appSidebar = document.getElementById('appSidebar');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const addShareHeaderBtn = document.getElementById('addShareHeaderBtn');
const shareFormSection = document.getElementById('shareFormSection');
const formTitle = document.getElementById('formTitle');
const shareNameInput = document.getElementById('shareName');
const currentPriceInput = document.getElementById('currentPrice');
const targetPriceInput = document.getElementById('targetPrice');
const dividendAmountInput = document.getElementById('dividendAmount');
const frankingCreditsInput = document.getElementById('frankingCredits');
const commentsFormContainer = document.getElementById('commentsFormContainer');
const addCommentSectionBtn = document.getElementById('addCommentSectionBtn'); // Changed to span/icon
const saveShareBtn = document.getElementById('saveShareBtn');
const cancelFormBtn = document.getElementById('cancelFormBtn');
const deleteShareBtn = document.getElementById('deleteShareBtn');
const shareTableBody = document.querySelector('#shareTable tbody');
const mobileShareCardsContainer = document.getElementById('mobileShareCards');
const shareDetailModal = document.getElementById('shareDetailModal');
const modalShareName = document.getElementById('modalShareName');
const modalEntryDate = document.getElementById('modalEntryDate');
const modalEnteredPrice = document.getElementById('modalEnteredPrice');
const modalTargetPrice = document.getElementById('modalTargetPrice');
const modalDividendAmount = document.getElementById('modalDividendAmount');
const modalFrankingCredits = document.getElementById('modalFrankingCredits');
const modalUnfrankedYield = document.getElementById('modalUnfrankedYield');
const modalFrankedYield = document.getElementById('modalFrankedYield');
const modalNewsLink = document.getElementById('modalNewsLink');
const modalMarketIndexLink = document.getElementById('modalMarketIndexLink');
const modalFoolLink = document.getElementById('modalFoolLink');
const modalCommSecLink = document.getElementById('modalCommSecLink');
const modalCommentsContainer = document.getElementById('modalCommentsContainer');
const deleteShareFromDetailBtn = document.getElementById('deleteShareFromDetailBtn');
const editShareFromDetailBtn = document.getElementById('editShareFromDetailBtn');
const googleAuthBtn = document.getElementById('googleAuthBtn');
const mainTitle = document.getElementById('mainTitle');
const loadingIndicator = document.getElementById('loadingIndicator');
const customDialogModal = document.getElementById('customDialogModal');
const customDialogMessage = document.getElementById('customDialogMessage');
const customDialogConfirmBtn = document.getElementById('customDialogConfirmBtn');
const customDialogCancelBtn = document.getElementById('customDialogCancelBtn');
const newShareBtn = document.getElementById('newShareBtn');
const watchlistSelect = document.getElementById('watchlistSelect');
const addWatchlistBtn = document.getElementById('addWatchlistBtn');
const addWatchlistModal = document.getElementById('addWatchlistModal');
const newWatchlistNameInput = document.getElementById('newWatchlistName');
const saveWatchlistBtn = document.getElementById('saveWatchlistBtn');
const cancelAddWatchlistBtn = document.getElementById('cancelAddWatchlistBtn');
const editWatchlistBtn = document.getElementById('editWatchlistBtn');
const manageWatchlistModal = document.getElementById('manageWatchlistModal');
const editWatchlistNameInput = document.getElementById('editWatchlistName');
const deleteWatchlistInModalBtn = document.getElementById('deleteWatchlistInModalBtn');
const saveWatchlistNameBtn = document.getElementById('saveWatchlistNameBtn');
const cancelManageWatchlistBtn = document.getElementById('cancelManageWatchlistBtn');
const sortSelect = document.getElementById('sortSelect');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const colorThemeSelect = document.getElementById('colorThemeSelect');
const revertToDefaultThemeBtn = document.getElementById('revertToDefaultThemeBtn');
const logoutBtn = document.getElementById('logoutBtn');
const standardCalcBtn = document.getElementById('standardCalcBtn');
const dividendCalcBtn = document.getElementById('dividendCalcBtn');
const calculatorModal = document.getElementById('calculatorModal');
const calculatorInputDisplay = document.getElementById('calculatorInput');
const calculatorResultDisplay = document.getElementById('calculatorResult');
const calculatorButtons = document.querySelector('#calculatorModal .calculator-buttons');
const dividendCalculatorModal = document.getElementById('dividendCalculatorModal');
const calcCurrentPriceInput = document.getElementById('calcCurrentPrice');
const calcDividendAmountInput = document.getElementById('calcDividendAmount');
const calcFrankingCreditsInput = document.getElementById('calcFrankingCredits');
const calcUnfrankedYieldSpan = document.getElementById('calcUnfrankedYield');
const calcFrankedYieldSpan = document.getElementById('calcFrankedYield');
const investmentValueSelect = document.getElementById('investmentValueSelect');
const calcEstimatedDividendSpan = document.getElementById('calcEstimatedDividend');
const exportWatchlistBtn = document.getElementById('exportWatchlistBtn');

// NEW: Share Research Feature DOM elements
const shareResearchInput = document.getElementById('shareResearchInput');
const shareResearchBtn = document.getElementById('shareResearchBtn');
const shareResearchModal = document.getElementById('shareResearchModal');
const researchShareCodeDisplay = document.getElementById('researchShareCodeDisplay');
const researchNewsLink = document.getElementById('researchNewsLink');
const researchMarketIndexLink = document.getElementById('researchMarketIndexLink');
const researchFoolLink = document.getElementById('researchFoolLink');
const researchCommSecLink = document.getElementById('researchCommSecLink');
const researchCommSecLoginMessage = document.getElementById('researchCommSecLoginMessage');
const researchCalcCurrentPrice = document.getElementById('researchCalcCurrentPrice');
const researchCalcDividendAmount = document.getElementById('researchCalcDividendAmount');
const researchFrankingCredits = document.getElementById('researchFrankingCredits');
const researchCalcUnfrankedYield = document.getElementById('researchCalcUnfrankedYield');
const researchCalcFrankedYield = document.getElementById('researchCalcFrankedYield');
const researchInvestmentValueSelect = document.getElementById('researchInvestmentValueSelect');
const researchCalcEstimatedDividend = document.getElementById('researchCalcEstimatedDividend');
const researchWatchlistSelect = document.getElementById('researchWatchlistSelect');
const researchTargetPrice = document.getElementById('researchTargetPrice');
const researchComments = document.getElementById('researchComments');
const cancelResearchBtn = document.getElementById('cancelResearchBtn');
const saveResearchShareBtn = document.getElementById('saveResearchShareBtn');


// --- UTILITY FUNCTIONS ---

/**
 * Displays a modal.
 * @param {HTMLElement} modalElement - The modal DOM element to display.
 */
function showModal(modalElement) {
    modalElement.style.display = 'block';
    // Add a class to body to prevent scrolling
    document.body.classList.add('modal-open');
}

/**
 * Hides a modal.
 * @param {HTMLElement} modalElement - The modal DOM element to hide.
 */
function hideModal(modalElement) {
    modalElement.style.display = 'none';
    // Remove the class from body
    document.body.classList.remove('modal-open');
}

/**
 * Shows a custom dialog message to the user.
 * @param {string} message - The message to display.
 * @param {boolean} isConfirm - If true, shows Yes/No buttons. Otherwise, just an OK button.
 * @returns {Promise<boolean>} - Resolves true for Confirm/Yes, false for Cancel/No, or true for OK.
 */
function showCustomDialog(message, isConfirm = false) {
    return new Promise((resolve) => {
        customDialogMessage.textContent = message;
        customDialogCancelBtn.style.display = isConfirm ? 'inline-flex' : 'none'; // Show Cancel only for confirms
        customDialogConfirmBtn.innerHTML = isConfirm ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-check-circle"></i>'; // Change icon for OK/Yes
        customDialogConfirmBtn.title = isConfirm ? 'Yes' : 'OK';

        const confirmHandler = () => {
            hideModal(customDialogModal);
            customDialogConfirmBtn.removeEventListener('click', confirmHandler);
            customDialogCancelBtn.removeEventListener('click', cancelHandler);
            resolve(true);
        };

        const cancelHandler = () => {
            hideModal(customDialogModal);
            customDialogConfirmBtn.removeEventListener('click', confirmHandler);
            customDialogCancelBtn.removeEventListener('click', cancelHandler);
            resolve(false);
        };

        customDialogConfirmBtn.addEventListener('click', confirmHandler);
        customDialogCancelBtn.addEventListener('click', cancelHandler);

        showModal(customDialogModal);
    });
}

/**
 * Formats a number as currency (e.g., $25.50).
 * @param {number} value - The number to format.
 * @returns {string} - The formatted currency string.
 */
function formatCurrency(value) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '-';
    }
    return `$${value.toFixed(2)}`;
}

/**
 * Formats a number as a percentage (e.g., 5.00%).
 * @param {number} value - The number to format.
 * @returns {string} - The formatted percentage string.
 */
function formatPercentage(value) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '-';
    }
    return `${value.toFixed(2)}%`;
}

/**
 * Formats a number as a date string.
 * @param {number} timestamp - The Firestore timestamp seconds.
 * @returns {string} - The formatted date string.
 */
function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
    return date.toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Calculates unfranked and franked dividend yields.
 * @param {number} price - Current share price.
 * @param {number} dividend - Annual dividend amount per share.
 * @param {number} franking - Franking credits percentage (0-100).
 * @returns {{unfrankedYield: number, frankedYield: number}} - Calculated yields.
 */
function calculateYields(price, dividend, franking) {
    let unfrankedYield = 0;
    let frankedYield = 0;

    if (price > 0 && dividend > 0) {
        unfrankedYield = (dividend / price) * 100;
        // Franked yield calculation: dividend / price * (1 + (franking / 100) * (30 / 70)) * 100
        // Assuming company tax rate is 30% for franking credit calculation
        frankedYield = unfrankedYield * (1 + (franking / 100) * (30 / 70));
    }
    return {
        unfrankedYield: parseFloat(unfrankedYield.toFixed(2)),
        frankedYield: parseFloat(frankedYield.toFixed(2))
    };
}

/**
 * Calculates estimated annual dividend based on investment value.
 * @param {number} price - Current share price.
 * @param {number} dividend - Annual dividend amount per share.
 * @param {number} investmentValue - Total investment value.
 * @returns {number} - Estimated annual dividend.
 */
function calculateEstimatedAnnualDividend(price, dividend, investmentValue) {
    if (price > 0 && dividend > 0 && investmentValue > 0) {
        const numberOfShares = investmentValue / price;
        return numberOfShares * dividend;
    }
    return 0;
}

/**
 * Generates external link URLs for a given share code.
 * @param {string} shareCode - The ASX share code.
 * @returns {{marketIndex: string, fool: string, commSec: string, news: string}} - URLs for various financial sites.
 */
function generateExternalLinks(shareCode) {
    const encodedCode = encodeURIComponent(shareCode.toUpperCase());
    return {
        marketIndex: `https://www.marketindex.com.au/asx/${encodedCode}`,
        fool: `https://www.fool.com.au/quote/${encodedCode}/`,
        commSec: `https://www.commsec.com.au/market-insights/company-research/ASX-${encodedCode}.html`,
        news: `https://www.google.com/search?q=${encodedCode}+ASX+news`
    };
}

/**
 * Applies the selected theme to the body.
 * @param {string} themeName - The name of the theme (e.g., 'dark-theme', 'bold-1').
 */
function applyTheme(themeName) {
    document.body.className = ''; // Clear existing themes
    if (themeName && themeName !== 'system-default' && themeName !== 'none') {
        document.body.classList.add(`theme-${themeName}`);
    }
    // Also update the theme toggle button icon based on the current theme
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (themeName === 'system-default') {
        if (systemPrefersDark) {
            document.body.classList.add('dark-theme');
            themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i> <span>Light Mode</span>';
        } else {
            document.body.classList.remove('dark-theme');
            themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i> <span>Dark Mode</span>';
        }
    } else if (document.body.classList.contains('dark-theme')) {
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i> <span>Light Mode</span>';
    } else {
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i> <span>Dark Mode</span>';
    }

    // Save the selected theme to local storage
    localStorage.setItem('selectedTheme', themeName);
}

/**
 * Populates the theme selection dropdown.
 */
function populateThemeSelect() {
    const savedTheme = localStorage.getItem('selectedTheme') || 'system-default';
    if (colorThemeSelect) {
        colorThemeSelect.value = savedTheme;
        applyTheme(savedTheme); // Apply immediately on load
    }
}


// --- FIREBASE & DATA HANDLING ---

/**
 * Gets the base path for user-specific data in Firestore.
 * @returns {string} The Firestore collection path.
 */
function getUserDataPath() {
    if (!currentUserId) {
        console.error("User ID is not available. Cannot construct Firestore path.");
        return null;
    }
    const appId = window.getFirebaseAppId();
    // For private user data, use /artifacts/{appId}/users/{userId}/{collectionName}
    return `artifacts/${appId}/users/${currentUserId}`;
}

/**
 * Subscribes to real-time updates for the user's watchlists from Firestore.
 */
async function subscribeToWatchlists() {
    if (unsubscribeWatchlists) {
        unsubscribeWatchlists(); // Unsubscribe from previous listener if exists
        console.log("[Firestore Listener] Unsubscribed from watchlists listener.");
    }

    const userPath = getUserDataPath();
    if (!userPath || !db || !collection) { // Check for db and collection function availability
        console.warn("Firestore or user path not ready for watchlists subscription.");
        return;
    }

    const watchlistsColRef = collection(db, userPath, 'watchlists'); // Correct usage
    unsubscribeWatchlists = onSnapshot(watchlistsColRef, (snapshot) => { // Correct usage
        userWatchlists = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        // Ensure the default watchlist always exists for the current user
        const defaultWatchlistExists = userWatchlists.some(wl => wl.id === DEFAULT_WATCHLIST_ID_SUFFIX);
        if (!defaultWatchlistExists) {
            // Add default watchlist if it doesn't exist
            const defaultWatchlistRef = doc(watchlistsColRef, DEFAULT_WATCHLIST_ID_SUFFIX); // Correct usage
            setDoc(defaultWatchlistRef, { name: DEFAULT_WATCHLIST_NAME, createdAt: FieldValue.serverTimestamp() }, { merge: true }) // Correct usage
                .then(() => {
                    console.log("Default watchlist created/ensured.");
                })
                .catch(error => {
                    console.error("Error ensuring default watchlist:", error);
                });
        }
        populateWatchlistSelects(); // Update all watchlist dropdowns
        updateMainTitle(); // Update main title to show current watchlist
        console.log("[Firestore] Watchlists updated:", userWatchlists);
    }, (error) => {
        console.error("Error listening to watchlists:", error);
        showCustomDialog("Error loading watchlists. Please try again later.");
    });
    console.log("[Firestore Listener] Subscribed to watchlists.");
}

/**
 * Populates the watchlist dropdowns (`watchlistSelect` and `researchWatchlistSelect`).
 */
function populateWatchlistSelects() {
    const selects = [watchlistSelect, researchWatchlistSelect];
    selects.forEach(selectElement => {
        if (!selectElement) return;

        // Store current selection to try and restore it
        const currentSelectedId = selectElement.value;
        const currentSelectedName = selectElement.options[selectElement.selectedIndex]?.textContent;

        selectElement.innerHTML = ''; // Clear existing options

        // Add a default "Select Watchlist" option for the research modal
        if (selectElement.id === 'researchWatchlistSelect') {
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "Select Watchlist";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            selectElement.appendChild(defaultOption);
        } else {
            // For the main watchlist select, ensure "All Shares" is always first
            const allSharesOption = document.createElement('option');
            allSharesOption.value = "ALL_SHARES_ID"; // Special ID for "All Shares"
            allSharesOption.textContent = "All Shares";
            selectElement.appendChild(allSharesOption);
        }
        

        // Sort watchlists alphabetically by name, but keep "My Watchlist (Default)" at the top
        const sortedWatchlists = [...userWatchlists].sort((a, b) => {
            if (a.id === DEFAULT_WATCHLIST_ID_SUFFIX) return -1;
            if (b.id === DEFAULT_WATCHLIST_ID_SUFFIX) return 1;
            return a.name.localeCompare(b.name);
        });

        sortedWatchlists.forEach(watchlist => {
            const option = document.createElement('option');
            option.value = watchlist.id;
            option.textContent = watchlist.name;
            selectElement.appendChild(option);
        });

        // Attempt to restore selection
        if (selectElement.id === 'watchlistSelect') {
            // For the main watchlist select, prioritize the stored currentSelectedWatchlistIds
            // If nothing is selected, default to "All Shares"
            if (currentSelectedWatchlistIds.length > 0 && selectElement.querySelector(`option[value="${currentSelectedWatchlistIds[0]}"]`)) {
                selectElement.value = currentSelectedWatchlistIds[0];
            } else {
                selectElement.value = "ALL_SHARES_ID";
                currentSelectedWatchlistIds = ["ALL_SHARES_ID"];
            }
            // Update currentWatchlistName based on the actual selected option
            currentWatchlistName = selectElement.options[selectElement.selectedIndex]?.textContent || "Watchlist";
        } else if (selectElement.id === 'researchWatchlistSelect') {
            // For research modal, try to restore previous selection or keep default
            if (currentSelectedId && selectElement.querySelector(`option[value="${currentSelectedId}"]`)) {
                selectElement.value = currentSelectedId;
            } else {
                // Default to the user's "My Watchlist (Default)" if it exists
                const defaultWatchlistOption = selectElement.querySelector(`option[value="${DEFAULT_WATCHLIST_ID_SUFFIX}"]`);
                if (defaultWatchlistOption) {
                    selectElement.value = DEFAULT_WATCHLIST_ID_SUFFIX;
                } else {
                    selectElement.value = ""; // Keep "Select Watchlist" if no default
                }
            }
        }
    });
    updateMainTitle(); // Ensure title reflects current watchlist
}


/**
 * Subscribes to real-time updates for shares based on the currently selected watchlists.
 */
async function subscribeToShares() {
    if (unsubscribeShares) {
        unsubscribeShares(); // Unsubscribe from previous listener
        console.log("[Firestore Listener] Unsubscribed from shares listener.");
    }

    const userPath = getUserDataPath();
    if (!userPath || !db || !collection || !query || !where || !onSnapshot) { // Check for Firestore function availability
        console.warn("Firestore or user path not ready for shares subscription.");
        return;
    }

    loadingIndicator.style.display = 'block'; // Show loading indicator

    let q;
    const sharesCollectionRef = collection(db, userPath, 'shares'); // Correct usage

    if (currentSelectedWatchlistIds.includes("ALL_SHARES_ID")) {
        // Query all shares for the user
        q = query(sharesCollectionRef); // Correct usage
        console.log("[Firestore Query] Fetching all shares.");
    } else if (currentSelectedWatchlistIds.length > 0) {
        // Query shares belonging to the selected watchlists
        q = query(sharesCollectionRef, where('watchlists', 'array-contains-any', currentSelectedWatchlistIds)); // Correct usage
        console.log("[Firestore Query] Fetching shares for watchlists:", currentSelectedWatchlistIds);
    } else {
        // No watchlists selected, show empty list
        allSharesData = [];
        renderShareList();
        loadingIndicator.style.display = 'none';
        console.log("[Firestore Query] No watchlists selected, displaying empty share list.");
        return;
    }

    unsubscribeShares = onSnapshot(q, (snapshot) => { // Correct usage
        allSharesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderShareList();
        loadingIndicator.style.display = 'none';
        console.log("[Firestore] Shares updated:", allSharesData);
    }, (error) => {
        console.error("Error listening to shares:", error);
        showCustomDialog("Error loading shares. Please try again later.");
        loadingIndicator.style.display = 'none';
    });
    console.log("[Firestore Listener] Subscribed to shares.");
}


/**
 * Renders the share list in both table and mobile card formats.
 */
function renderShareList() {
    // Sort the shares before rendering
    const sortedShares = [...allSharesData].sort((a, b) => {
        let valA, valB;
        switch (currentSortOrder) {
            case 'entryDate-desc':
                valA = a.entryDate ? a.entryDate.seconds : 0;
                valB = b.entryDate ? b.entryDate.seconds : 0;
                return valB - valA; // Newest first
            case 'entryDate-asc':
                valA = a.entryDate ? a.entryDate.seconds : 0;
                valB = b.entryDate ? b.entryDate.seconds : 0;
                return valA - valB; // Oldest first
            case 'shareName-asc':
                valA = a.shareName.toLowerCase();
                valB = b.shareName.toLowerCase();
                return valA.localeCompare(valB);
            case 'shareName-desc':
                valA = a.shareName.toLowerCase();
                valB = b.shareName.toLowerCase();
                return valB.localeCompare(valA);
            case 'dividendAmount-desc':
                valA = parseFloat(a.dividendAmount || 0);
                valB = parseFloat(b.dividendAmount || 0);
                return valB - valA; // High to Low
            case 'dividendAmount-asc':
                valA = parseFloat(a.dividendAmount || 0);
                valB = parseFloat(b.dividendAmount || 0);
                return valA - valB; // Low to High
            default:
                return 0; // No sort
        }
    });

    shareTableBody.innerHTML = '';
    mobileShareCardsContainer.innerHTML = '';

    if (sortedShares.length === 0) {
        shareTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No shares added to this watchlist yet.</td></tr>';
        mobileShareCardsContainer.innerHTML = '<p style="text-align: center; padding: 15px;">No shares added to this watchlist yet.</p>';
        return;
    }

    sortedShares.forEach(share => {
        const { unfrankedYield, frankedYield } = calculateYields(
            parseFloat(share.enteredPrice),
            parseFloat(share.dividendAmount),
            parseFloat(share.frankingCredits)
        );

        // Render for desktop table
        const row = shareTableBody.insertRow();
        row.dataset.id = share.id;
        row.dataset.share = JSON.stringify(share); // Store full share data
        row.innerHTML = `
            <td>${share.shareName.toUpperCase()}</td>
            <td>${formatCurrency(share.enteredPrice)}</td>
            <td>${formatCurrency(share.targetPrice)}</td>
            <td>${formatCurrency(share.dividendAmount)} (${formatPercentage(unfrankedYield)} Unfranked, ${formatPercentage(frankedYield)} Franked)</td>
            <td>${share.comments && share.comments.length > 0 ? share.comments.length : '0'}</td>
        `;
        row.addEventListener('click', (event) => {
            // Deselect any previously selected row/card
            document.querySelectorAll('.share-list-section .selected').forEach(el => el.classList.remove('selected'));
            row.classList.add('selected');
            openShareDetailModal(share);
        });
        row.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            showContextMenu(event, share);
        });
        row.addEventListener('touchstart', (event) => handleTouchStart(event, share));
        row.addEventListener('touchmove', handleTouchMove);
        row.addEventListener('touchend', handleTouchEnd);


        // Render for mobile cards
        const card = document.createElement('div');
        card.classList.add('mobile-card');
        card.dataset.id = share.id;
        card.dataset.share = JSON.stringify(share); // Store full share data
        card.innerHTML = `
            <h3>${share.shareName.toUpperCase()}</h3>
            <p><strong>Entered Price:</strong> ${formatCurrency(share.enteredPrice)}</p>
            <p><strong>Target Price:</strong> ${formatCurrency(share.targetPrice)}</p>
            <p><strong>Dividends:</strong> ${formatCurrency(share.dividendAmount)} (${formatPercentage(unfrankedYield)} Unfranked, ${formatPercentage(frankedYield)} Franked)</p>
            <p><strong>Comments:</strong> ${share.comments ? share.comments.length : '0'}</p>
        `;
        card.addEventListener('click', (event) => {
            // Deselect any previously selected row/card
            document.querySelectorAll('.share-list-section .selected').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
            openShareDetailModal(share);
        });
        card.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            showContextMenu(event, share);
        });
        card.addEventListener('touchstart', (event) => handleTouchStart(event, share));
        card.addEventListener('touchmove', handleTouchMove);
        card.addEventListener('touchend', handleTouchEnd);
        mobileShareCardsContainer.appendChild(card);
    });
}

/**
 * Clears the share list UI.
 */
function clearShareList() {
    shareTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No shares loaded.</td></tr>';
    mobileShareCardsContainer.innerHTML = '<p style="text-align: center; padding: 15px;">No shares loaded.</p>';
}

/**
 * Clears the watchlist UI elements.
 */
function clearWatchlistUI() {
    watchlistSelect.innerHTML = '';
    researchWatchlistSelect.innerHTML = '';
    currentSelectedWatchlistIds = [];
    currentWatchlistName = '';
    updateMainTitle();
}


/**
 * Opens the share form modal for adding or editing a share.
 * @param {Object|null} share - The share object to edit, or null for a new share.
 */
function openShareFormModal(share = null) {
    selectedShareDocId = share ? share.id : null;
    formTitle.textContent = share ? 'Edit Share' : 'Add New Share';
    deleteShareBtn.classList.toggle('hidden', !share); // Show delete button only for existing shares

    shareNameInput.value = share ? share.shareName : '';
    currentPriceInput.value = share ? share.enteredPrice : '';
    targetPriceInput.value = share ? share.targetPrice : '';
    dividendAmountInput.value = share ? share.dividendAmount : '';
    frankingCreditsInput.value = share ? share.frankingCredits : '';

    // Clear existing comments and add new ones
    commentsFormContainer.querySelectorAll('.comment-section').forEach(c => c.remove());
    if (share && share.comments && share.comments.length > 0) {
        share.comments.forEach(comment => addCommentSection(comment.title, comment.text));
    } else {
        // Add an initial empty comment section for new shares or shares without comments
        addCommentSection('', '');
    }

    showModal(shareFormSection);
    shareNameInput.focus();
}

/**
 * Adds a new comment section to the share form.
 * @param {string} title - The initial title for the comment.
 * @param {string} text - The initial text for the comment.
 */
function addCommentSection(title = '', text = '') {
    const commentSection = document.createElement('div');
    commentSection.classList.add('comment-section');
    commentSection.innerHTML = `
        <div class="comment-section-header">
            <input type="text" class="comment-title-input" placeholder="Comment Title" value="${title}">
            <span class="comment-delete-btn"><i class="fas fa-times-circle"></i></span>
        </div>
        <textarea class="comment-text-input" placeholder="Your comments here...">${text}</textarea>
    `;
    commentsFormContainer.appendChild(commentSection);

    // Add event listener for delete button
    commentSection.querySelector('.comment-delete-btn').addEventListener('click', function() {
        commentSection.remove();
    });
}

/**
 * Saves a new share or updates an existing one to Firestore.
 */
async function saveShare() {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to save shares.");
        return;
    }
    if (!db || !collection || !doc || !addDoc || !updateDoc || !FieldValue) { // Check Firestore functions
        showCustomDialog("Firestore is not fully initialized. Please try again later.");
        console.error("Firestore functions missing for saveShare.");
        return;
    }

    const shareName = shareNameInput.value.trim();
    const enteredPrice = parseFloat(currentPriceInput.value);
    const targetPrice = parseFloat(targetPriceInput.value);
    const dividendAmount = parseFloat(dividendAmountInput.value);
    const frankingCredits = parseFloat(frankingCreditsInput.value);

    // Validate inputs
    if (!shareName) {
        showCustomDialog("Share Code is required.");
        return;
    }
    if (isNaN(enteredPrice) || enteredPrice <= 0) {
        showCustomDialog("Entered Price must be a positive number.");
        return;
    }
    if (isNaN(dividendAmount) || dividendAmount < 0) {
        showCustomDialog("Dividend Amount must be a non-negative number.");
        return;
    }
    if (isNaN(frankingCredits) || frankingCredits < 0 || frankingCredits > 100) {
        showCustomDialog("Franking Credits must be a number between 0 and 100.");
        return;
    }

    // Get comments
    const comments = [];
    commentsFormContainer.querySelectorAll('.comment-section').forEach(section => {
        const title = section.querySelector('.comment-title-input').value.trim();
        const text = section.querySelector('.comment-text-input').value.trim();
        if (title || text) { // Only save if there's content
            comments.push({ title, text });
        }
    });

    // Ensure at least one watchlist is selected for new shares
    let targetWatchlistIds = [...currentSelectedWatchlistIds];
    if (selectedShareDocId === null && (targetWatchlistIds.length === 0 || targetWatchlistIds.includes("ALL_SHARES_ID"))) {
        // If adding a new share and "All Shares" or no watchlist is selected,
        // default to "My Watchlist (Default)"
        const defaultWatchlist = userWatchlists.find(wl => wl.id === DEFAULT_WATCHLIST_ID_SUFFIX);
        if (defaultWatchlist) {
            targetWatchlistIds = [DEFAULT_WATCHLIST_ID_SUFFIX];
            showCustomDialog(`New share will be added to "${DEFAULT_WATCHLIST_NAME}".`);
        } else {
            showCustomDialog("Please select a watchlist to save the share to.");
            return;
        }
    } else if (targetWatchlistIds.includes("ALL_SHARES_ID")) {
        // If editing an existing share and "All Shares" is selected,
        // it means we're viewing all shares, but the share itself belongs to specific watchlists.
        // We need to preserve its existing watchlists.
        const existingShare = allSharesData.find(s => s.id === selectedShareDocId);
        if (existingShare && existingShare.watchlists) {
            targetWatchlistIds = existingShare.watchlists;
        } else {
            // Fallback if existing share has no watchlists, add to default
            const defaultWatchlist = userWatchlists.find(wl => wl.id === DEFAULT_WATCHLIST_ID_SUFFIX);
            if (defaultWatchlist) {
                targetWatchlistIds = [DEFAULT_WATCHLIST_ID_SUFFIX];
            } else {
                showCustomDialog("Could not determine target watchlist. Please select one.");
                return;
            }
        }
    }


    const shareData = {
        shareName: shareName.toUpperCase(),
        enteredPrice: enteredPrice,
        targetPrice: isNaN(targetPrice) ? null : targetPrice, // Store null if not a valid number
        dividendAmount: dividendAmount,
        frankingCredits: frankingCredits,
        comments: comments,
        watchlists: targetWatchlistIds // Link share to selected watchlists
    };

    try {
        loadingIndicator.style.display = 'block';
        const userPath = getUserDataPath();
        if (!userPath) return;
        const sharesCollectionRef = collection(db, userPath, 'shares'); // Correct usage

        if (selectedShareDocId) {
            // Update existing share
            const shareDocRef = doc(sharesCollectionRef, selectedShareDocId); // Correct usage
            await updateDoc(shareDocRef, shareData); // Correct usage
            showCustomDialog("Share updated successfully!");
            console.log("Share updated:", selectedShareDocId, shareData);
        } else {
            // Add new share
            shareData.entryDate = FieldValue.serverTimestamp(); // Correct usage
            const docRef = await addDoc(sharesCollectionRef, shareData); // Correct usage
            showCustomDialog("Share added successfully!");
            console.log("Share added with ID:", docRef.id, shareData);
        }
        hideModal(shareFormSection);
    } catch (error) {
        console.error("Error saving share:", error);
        showCustomDialog("Error saving share. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Deletes a share from Firestore.
 * @param {string} shareId - The ID of the share document to delete.
 */
async function deleteShare(shareId) {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to delete shares.");
        return;
    }
    if (!db || !collection || !doc || !deleteDoc) { // Check Firestore functions
        showCustomDialog("Firestore is not fully initialized. Please try again later.");
        console.error("Firestore functions missing for deleteShare.");
        return;
    }

    const confirm = await showCustomDialog("Are you sure you want to delete this share?", true);
    if (!confirm) {
        return;
    }

    try {
        loadingIndicator.style.display = 'block';
        const userPath = getUserDataPath();
        if (!userPath) return;
        const shareDocRef = doc(collection(db, userPath, 'shares'), shareId); // Correct usage
        await deleteDoc(shareDocRef); // Correct usage
        showCustomDialog("Share deleted successfully!");
        console.log("Share deleted:", shareId);
        hideModal(shareFormSection); // Close the form if open
        hideModal(shareDetailModal); // Close the detail modal if open
    } catch (error) {
        console.error("Error deleting share:", error);
        showCustomDialog("Error deleting share. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Opens the share detail modal and populates it with data.
 * @param {Object} share - The share object to display.
 */
function openShareDetailModal(share) {
    selectedShareDocId = share.id; // Set selected share ID for edit/delete from detail modal
    modalShareName.textContent = share.shareName.toUpperCase();
    modalEntryDate.textContent = formatDate(share.entryDate ? share.entryDate.seconds : null);
    modalEnteredPrice.textContent = formatCurrency(share.enteredPrice);
    modalTargetPrice.textContent = formatCurrency(share.targetPrice);
    modalDividendAmount.textContent = formatCurrency(share.dividendAmount);
    modalFrankingCredits.textContent = formatPercentage(share.frankingCredits);

    const { unfrankedYield, frankedYield } = calculateYields(
        parseFloat(share.enteredPrice),
        parseFloat(share.dividendAmount),
        parseFloat(share.frankingCredits)
    );
    modalUnfrankedYield.textContent = formatPercentage(unfrankedYield);
    modalFrankedYield.textContent = formatPercentage(frankedYield);

    // Set external links
    const links = generateExternalLinks(share.shareName);
    modalNewsLink.href = links.news;
    modalMarketIndexLink.href = links.marketIndex;
    modalFoolLink.href = links.fool;
    modalCommSecLink.href = links.commSec;

    // Populate comments section
    modalCommentsContainer.innerHTML = '<h3>Comments</h3>'; // Clear previous comments
    if (share.comments && share.comments.length > 0) {
        share.comments.forEach(comment => {
            const commentItem = document.createElement('div');
            commentItem.classList.add('modal-comment-item');
            commentItem.innerHTML = `
                <strong>${comment.title || 'Untitled Comment'}</strong>
                <p>${comment.text || 'No comment text.'}</p>
            `;
            modalCommentsContainer.appendChild(commentItem);
        });
    } else {
        modalCommentsContainer.innerHTML += '<p>No comments for this share.</p>';
    }

    showModal(shareDetailModal);
}

/**
 * Adds a new watchlist to Firestore.
 */
async function addWatchlist() {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to add watchlists.");
        return;
    }
    if (!db || !collection || !addDoc || !FieldValue) { // Check Firestore functions
        showCustomDialog("Firestore is not fully initialized. Please try again later.");
        console.error("Firestore functions missing for addWatchlist.");
        return;
    }

    const watchlistName = newWatchlistNameInput.value.trim();
    if (!watchlistName) {
        showCustomDialog("Watchlist name cannot be empty.");
        return;
    }

    // Check for duplicate names (case-insensitive)
    const isDuplicate = userWatchlists.some(wl => wl.name.toLowerCase() === watchlistName.toLowerCase());
    if (isDuplicate) {
        showCustomDialog("A watchlist with this name already exists. Please choose a different name.");
        return;
    }

    try {
        loadingIndicator.style.display = 'block';
        const userPath = getUserDataPath();
        if (!userPath) return;
        await addDoc(collection(db, userPath, 'watchlists'), { // Correct usage
            name: watchlistName,
            createdAt: FieldValue.serverTimestamp() // Correct usage
        });
        showCustomDialog("Watchlist added successfully!");
        newWatchlistNameInput.value = ''; // Clear input
        hideModal(addWatchlistModal);
    } catch (error) {
        console.error("Error adding watchlist:", error);
        showCustomDialog("Error adding watchlist. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Opens the manage watchlist modal, populating it with the currently selected watchlist's data.
 */
function openManageWatchlistModal() {
    if (currentSelectedWatchlistIds.length !== 1 || currentSelectedWatchlistIds[0] === "ALL_SHARES_ID") {
        showCustomDialog("Please select a single watchlist to edit from the dropdown.");
        return;
    }

    const selectedWatchlistId = currentSelectedWatchlistIds[0];
    const watchlistToEdit = userWatchlists.find(wl => wl.id === selectedWatchlistId);

    if (!watchlistToEdit) {
        showCustomDialog("Selected watchlist not found.");
        return;
    }

    // Disable delete button for the default watchlist
    if (selectedWatchlistId === DEFAULT_WATCHLIST_ID_SUFFIX) {
        deleteWatchlistInModalBtn.classList.add('is-disabled-icon');
        deleteWatchlistInModalBtn.title = "Cannot delete default watchlist";
    } else {
        deleteWatchlistInModalBtn.classList.remove('is-disabled-icon');
        deleteWatchlistInModalBtn.title = "Delete Watchlist";
    }

    editWatchlistNameInput.value = watchlistToEdit.name;
    showModal(manageWatchlistModal);
}

/**
 * Saves changes to the currently managed watchlist.
 */
async function saveWatchlistName() {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to save watchlists.");
        return;
    }
    if (!db || !collection || !doc || !updateDoc) { // Check Firestore functions
        showCustomDialog("Firestore is not fully initialized. Please try again later.");
        console.error("Firestore functions missing for saveWatchlistName.");
        return;
    }

    const selectedWatchlistId = currentSelectedWatchlistIds[0];
    const newName = editWatchlistNameInput.value.trim();

    if (!newName) {
        showCustomDialog("Watchlist name cannot be empty.");
        return;
    }

    // Check for duplicate names (excluding the current watchlist's original name)
    const originalWatchlist = userWatchlists.find(wl => wl.id === selectedWatchlistId);
    const isDuplicate = userWatchlists.some(wl =>
        wl.id !== selectedWatchlistId && wl.name.toLowerCase() === newName.toLowerCase()
    );

    if (isDuplicate) {
        showCustomDialog("A watchlist with this name already exists. Please choose a different name.");
        return;
    }

    try {
        loadingIndicator.style.display = 'block';
        const userPath = getUserDataPath();
        if (!userPath) return;
        const watchlistDocRef = doc(collection(db, userPath, 'watchlists'), selectedWatchlistId); // Correct usage
        await updateDoc(watchlistDocRef, { name: newName }); // Correct usage
        showCustomDialog("Watchlist name updated successfully!");
        hideModal(manageWatchlistModal);
    } catch (error) {
        console.error("Error updating watchlist name:", error);
        showCustomDialog("Error updating watchlist name. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Deletes the currently managed watchlist from Firestore.
 */
async function deleteWatchlist() {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to delete watchlists.");
        return;
    }
    if (!db || !collection || !doc || !deleteDoc || !query || !where || !getDocs || !FieldValue || !writeBatch) { // Check Firestore functions
        showCustomDialog("Firestore is not fully initialized. Please try again later.");
        console.error("Firestore functions missing for deleteWatchlist.");
        return;
    }

    const selectedWatchlistId = currentSelectedWatchlistIds[0];

    // Prevent deletion of the default watchlist
    if (selectedWatchlistId === DEFAULT_WATCHLIST_ID_SUFFIX) {
        showCustomDialog("The default watchlist cannot be deleted.");
        return;
    }

    const confirm = await showCustomDialog("Are you sure you want to delete this watchlist and remove all shares from it?", true);
    if (!confirm) {
        return;
    }

    try {
        loadingIndicator.style.display = 'block';
        const userPath = getUserDataPath();
        if (!userPath) return;
        
        const batch = writeBatch(db); // Correct usage

        // 1. Delete the watchlist document itself
        const watchlistDocRef = doc(collection(db, userPath, 'watchlists'), selectedWatchlistId); // Correct usage
        batch.delete(watchlistDocRef);

        // 2. Remove this watchlist from any shares that belong to it
        const sharesCollectionRef = collection(db, userPath, 'shares'); // Correct usage
        const q = query(sharesCollectionRef, where('watchlists', 'array-contains', selectedWatchlistId)); // Correct usage
        const querySnapshot = await getDocs(q); // Correct usage

        querySnapshot.forEach(shareDoc => {
            const currentWatchlists = shareDoc.data().watchlists || [];
            const updatedWatchlists = currentWatchlists.filter(wlId => wlId !== selectedWatchlistId);

            // If a share is no longer in any watchlist, move it to the default watchlist
            if (updatedWatchlists.length === 0) {
                updatedWatchlists.push(DEFAULT_WATCHLIST_ID_SUFFIX);
            }

            const shareRef = doc(sharesCollectionRef, shareDoc.id); // Correct usage
            batch.update(shareRef, { watchlists: updatedWatchlists });
        });

        await batch.commit();

        // After successful deletion, reset current selection to "All Shares"
        watchlistSelect.value = "ALL_SHARES_ID";
        currentSelectedWatchlistIds = ["ALL_SHARES_ID"];
        subscribeToShares(); // Re-subscribe to update the main list
        updateMainTitle(); // Update the main title

        showCustomDialog("Watchlist and associated shares updated successfully!");
        hideModal(manageWatchlistModal);
    } catch (error) {
        console.error("Error deleting watchlist:", error);
        showCustomDialog("Error deleting watchlist. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}


/**
 * Updates the main title to reflect the current watchlist name.
 */
function updateMainTitle() {
    if (watchlistSelect.value === "ALL_SHARES_ID") {
        mainTitle.textContent = "All Shares";
    } else {
        const selectedOption = watchlistSelect.options[watchlistSelect.selectedIndex];
        if (selectedOption) {
            currentWatchlistName = selectedOption.textContent;
            mainTitle.textContent = currentWatchlistName;
        } else {
            mainTitle.textContent = "Share Watchlist"; // Fallback
        }
    }
}

/**
 * Updates the state of main action buttons (Add Share, Watchlist controls).
 * @param {boolean} enable - True to enable, false to disable.
 */
function updateMainButtonsState(enable) {
    const buttons = [
        addShareHeaderBtn,
        newShareBtn,
        addWatchlistBtn,
        editWatchlistBtn,
        watchlistSelect,
        sortSelect,
        exportWatchlistBtn,
        shareResearchBtn, // NEW: Share Research button
        shareResearchInput // NEW: Share Research input
    ];
    buttons.forEach(btn => {
        if (btn) {
            btn.disabled = !enable;
            // For icon-only spans acting as buttons, toggle a class
            if (btn.tagName === 'SPAN' || btn.tagName === 'I') {
                btn.classList.toggle('is-disabled-icon', !enable);
            }
        }
    });
}

/**
 * Handles user authentication state changes.
 * @param {Object} user - The Firebase user object, or null if logged out.
 */
function handleAuthStateChanged(user) {
    if (user) {
        currentUserId = user.uid;
        googleAuthBtn.textContent = "Signed In";
        googleAuthBtn.disabled = true; // Disable button once signed in
        logoutBtn.classList.remove('is-disabled-icon'); // Enable logout button
        updateMainButtonsState(true);
        mainTitle.textContent = "Loading Watchlists...";
        subscribeToWatchlists(); // Start listening to watchlists
        subscribeToShares(); // Start listening to shares
        populateThemeSelect(); // Load and apply theme
        console.log("Auth State: User signed in:", user.uid);
    } else {
        currentUserId = null;
        googleAuthBtn.textContent = "Sign In";
        googleAuthBtn.disabled = false; // Enable sign-in button
        logoutBtn.classList.add('is-disabled-icon'); // Disable logout button
        updateMainButtonsState(false);
        mainTitle.textContent = "Share Watchlist"; // Reset title
        clearShareList();
        clearWatchlistUI();
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        applyTheme('system-default'); // Revert to default theme on logout
        if (unsubscribeShares) { // Ensure listener is cleaned up on logout
            unsubscribeShares();
            unsubscribeShares = null;
            console.log("[Firestore Listener] Unsubscribed from shares listener on logout.");
        }
        if (unsubscribeWatchlists) { // Ensure listener is cleaned up on logout
            unsubscribeWatchlists();
            unsubscribeWatchlists = null;
            console.log("[Firestore Listener] Unsubscribed from watchlists listener on logout.");
        }
        console.log("Auth State: User signed out.");
    }
}

// --- CALCULATOR LOGIC (Standard) ---
function updateCalculatorDisplay() {
    calculatorInputDisplay.textContent = previousCalculatorInput + (operator || '') + currentCalculatorInput;
    calculatorResultDisplay.textContent = currentCalculatorInput || '0';
}

function clearCalculator() {
    currentCalculatorInput = '';
    operator = null;
    previousCalculatorInput = '';
    resultDisplayed = false;
    updateCalculatorDisplay();
}

function appendNumber(number) {
    if (resultDisplayed) {
        currentCalculatorInput = '';
        resultDisplayed = false;
    }
    if (number === '.' && currentCalculatorInput.includes('.')) return;
    currentCalculatorInput += number;
    updateCalculatorDisplay();
}

function chooseOperator(nextOperator) {
    if (currentCalculatorInput === '' && previousCalculatorInput === '') return;

    if (currentCalculatorInput !== '') {
        if (previousCalculatorInput !== '') {
            calculateResult();
        }
        previousCalculatorInput = currentCalculatorInput;
    }
    operator = nextOperator;
    currentCalculatorInput = '';
    resultDisplayed = false;
    updateCalculatorDisplay();
}

function calculateResult() {
    let calculation;
    const prev = parseFloat(previousCalculatorInput);
    const current = parseFloat(currentCalculatorInput);

    if (isNaN(prev) || isNaN(current) || !operator) return;

    switch (operator) {
        case '+':
            calculation = prev + current;
            break;
        case '-':
            calculation = prev - current;
            break;
        case '×':
            calculation = prev * current;
            break;
        case '÷':
            calculation = current !== 0 ? prev / current : 'Error';
            break;
        case '%':
            calculation = (prev / 100) * current;
            break;
        default:
            return;
    }

    currentCalculatorInput = calculation.toString();
    operator = null;
    previousCalculatorInput = '';
    resultDisplayed = true;
    updateCalculatorDisplay();
}

// --- DIVIDEND CALCULATOR LOGIC ---
function calculateDividendYieldsAndEstimatedDividend(
    priceInput, dividendInput, frankingInput,
    unfrankedYieldSpan, frankedYieldSpan,
    investmentValueSelect, estimatedDividendSpan
) {
    const price = parseFloat(priceInput.value);
    const dividend = parseFloat(dividendInput.value);
    const franking = parseFloat(frankingInput.value);
    const investmentValue = parseFloat(investmentValueSelect.value);

    if (isNaN(price) || isNaN(dividend) || isNaN(franking)) {
        unfrankedYieldSpan.textContent = '-';
        frankedYieldSpan.textContent = '-';
        estimatedDividendSpan.textContent = '-';
        return;
    }

    const { unfrankedYield, frankedYield } = calculateYields(price, dividend, franking);
    unfrankedYieldSpan.textContent = formatPercentage(unfrankedYield);
    frankedYieldSpan.textContent = formatPercentage(frankedYield);

    const estimatedDividend = calculateEstimatedAnnualDividend(price, dividend, investmentValue);
    estimatedDividendSpan.textContent = formatCurrency(estimatedDividend);
}

// --- SHARE RESEARCH MODAL LOGIC (NEW) ---

/**
 * Opens the Share Research Modal and populates it.
 * @param {string} shareCode - The share code to research.
 */
async function openShareResearchModal(shareCode) {
    if (!shareCode) {
        showCustomDialog("Please enter a share code to research.");
        return;
    }

    researchShareCodeDisplay.textContent = shareCode.toUpperCase();

    // Populate external links
    const links = generateExternalLinks(shareCode);
    researchNewsLink.href = links.news;
    researchMarketIndexLink.href = links.marketIndex;
    researchFoolLink.href = links.fool;
    researchCommSecLink.href = links.commSec;

    // Reset and populate the dividend calculator within the research modal
    researchCalcCurrentPrice.value = '';
    researchCalcDividendAmount.value = '';
    researchFrankingCredits.value = '';
    researchCalcUnfrankedYield.textContent = '-';
    researchCalcFrankedYield.textContent = '-';
    researchInvestmentValueSelect.value = '10000'; // Default to $10,000
    researchCalcEstimatedDividend.textContent = '-';

    // Populate the watchlist select dropdown
    populateWatchlistSelects(); // This function already handles both main and research selects

    // Reset target price and comments
    researchTargetPrice.value = '';
    researchComments.value = '';

    showModal(shareResearchModal);
}

/**
 * Calculates dividend yields and estimated dividend for the research modal.
 */
function calculateResearchDividendYields() {
    calculateDividendYieldsAndEstimatedDividend(
        researchCalcCurrentPrice,
        researchCalcDividendAmount,
        researchFrankingCredits,
        researchCalcUnfrankedYield,
        researchCalcFrankedYield,
        researchInvestmentValueSelect,
        researchCalcEstimatedDividend
    );
}

/**
 * Saves the researched share to the selected watchlist.
 */
async function saveResearchedShareToWatchlist() {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to save shares.");
        return;
    }
    if (!db || !collection || !doc || !addDoc || !updateDoc || !query || !where || !getDocs || !FieldValue) { // Check Firestore functions
        showCustomDialog("Firestore is not fully initialized. Please try again later.");
        console.error("Firestore functions missing for saveResearchedShareToWatchlist.");
        return;
    }

    const shareName = researchShareCodeDisplay.textContent.trim();
    const enteredPrice = parseFloat(researchCalcCurrentPrice.value);
    const dividendAmount = parseFloat(researchCalcDividendAmount.value);
    const frankingCredits = parseFloat(researchFrankingCredits.value);
    const targetPrice = parseFloat(researchTargetPrice.value);
    const commentsText = researchComments.value.trim();
    const selectedWatchlistId = researchWatchlistSelect.value;

    // Basic validation
    if (!shareName || shareName === 'N/A') {
        showCustomDialog("Share Code is missing from research. Please search for a valid share.");
        return;
    }
    if (isNaN(enteredPrice) || enteredPrice <= 0) {
        showCustomDialog("Share Price (Entered Price) is required and must be a positive number.");
        return;
    }
    if (isNaN(dividendAmount) || dividendAmount < 0) {
        showCustomDialog("Dividend Amount is required and must be a non-negative number.");
        return;
    }
    if (isNaN(frankingCredits) || frankingCredits < 0 || frankingCredits > 100) {
        showCustomDialog("Franking Credits must be a number between 0 and 100.");
        return;
    }
    if (!selectedWatchlistId) {
        showCustomDialog("Please select a watchlist to save this share to.");
        return;
    }

    // Prepare comments array
    const comments = [];
    if (commentsText) {
        comments.push({
            title: 'Research Notes', // Default title for research comments
            text: commentsText
        });
    }

    const shareData = {
        shareName: shareName,
        enteredPrice: enteredPrice,
        targetPrice: isNaN(targetPrice) ? null : targetPrice, // Store null if not a valid number
        dividendAmount: dividendAmount,
        frankingCredits: frankingCredits,
        comments: comments,
        watchlists: [selectedWatchlistId], // Link to the single selected watchlist
        entryDate: FieldValue.serverTimestamp() // New entry
    };

    try {
        loadingIndicator.style.display = 'block';
        const userPath = getUserDataPath();
        if (!userPath) return;
        const sharesCollectionRef = collection(db, userPath, 'shares'); // Correct usage

        // Check if a share with this code already exists in the selected watchlist
        const existingShareQuery = query(
            sharesCollectionRef,
            where('shareName', '==', shareName),
            where('watchlists', 'array-contains', selectedWatchlistId)
        );
        const existingShareSnapshot = await getDocs(existingShareQuery);

        if (!existingShareSnapshot.empty) {
            const existingShareDoc = existingShareSnapshot.docs[0];
            const confirmUpdate = await showCustomDialog(`Share "${shareName}" already exists in "${researchWatchlistSelect.options[researchWatchlistSelect.selectedIndex].textContent}". Do you want to update it?`, true);
            if (confirmUpdate) {
                // Update existing share
                await updateDoc(existingShareDoc.ref, shareData);
                showCustomDialog("Share updated successfully in selected watchlist!");
            } else {
                showCustomDialog("Save operation cancelled.");
                return;
            }
        } else {
            // Add new share
            await addDoc(sharesCollectionRef, shareData);
            showCustomDialog("Share added to watchlist successfully!");
        }

        hideModal(shareResearchModal);
        // No need to manually refresh, onSnapshot listener will handle it
    } catch (error) {
        console.error("Error saving researched share:", error);
        showCustomDialog("Error saving researched share. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}


// --- CONTEXT MENU LOGIC ---
const shareContextMenu = document.getElementById('shareContextMenu');
const contextEditShareBtn = document.getElementById('contextEditShareBtn');
const contextDeleteShareBtn = document.getElementById('contextDeleteShareBtn');
let activeShareForContext = null; // Stores the share object for the context menu

/**
 * Shows the custom context menu.
 * @param {Event} event - The event that triggered the context menu.
 * @param {Object} share - The share object associated with the context.
 */
function showContextMenu(event, share) {
    activeShareForContext = share;
    shareContextMenu.style.display = 'block';
    
    // Position the context menu
    // Prioritize mouse position on desktop, tap position on mobile
    let x = event.clientX;
    let y = event.clientY;

    // Adjust for menu size and screen boundaries
    const menuWidth = shareContextMenu.offsetWidth;
    const menuHeight = shareContextMenu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10; // 10px margin
    }
    if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10; // 10px margin
    }

    shareContextMenu.style.left = `${x}px`;
    shareContextMenu.style.top = `${y}px`;

    // Add a click listener to the document to hide the menu
    document.addEventListener('click', hideContextMenu);
}

/**
 * Hides the custom context menu.
 */
function hideContextMenu() {
    shareContextMenu.style.display = 'none';
    document.removeEventListener('click', hideContextMenu);
    activeShareForContext = null;
}

// --- TOUCH EVENT HANDLING FOR LONG PRESS (Context Menu) ---
function handleTouchStart(event, share) {
    // Prevent default context menu
    // event.preventDefault(); // Do not prevent default here, as it can block scrolling

    // Store initial touch position
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;

    // Clear any existing timer
    if (longPressTimer) {
        clearTimeout(longPressTimer);
    }

    // Set a timer for long press
    longPressTimer = setTimeout(() => {
        // If touch has moved significantly, it's a scroll, not a long press
        if (Math.abs(event.touches[0].clientX - touchStartX) > TOUCH_MOVE_THRESHOLD ||
            Math.abs(event.touches[0].clientY - touchStartY) > TOUCH_MOVE_THRESHOLD) {
            return; // It was a scroll, not a long press
        }
        
        // This is a long press, show context menu
        showContextMenu(event, share);
        longPressTimer = null; // Reset timer
    }, LONG_PRESS_THRESHOLD);
}

function handleTouchMove(event) {
    // If touch moves significantly, cancel the long press timer
    if (longPressTimer) {
        const currentX = event.touches[0].clientX;
        const currentY = event.touches[0].clientY;
        const deltaX = Math.abs(currentX - touchStartX);
        const deltaY = Math.abs(currentY - touchStartY);

        if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }
}

function handleTouchEnd() {
    // If the timer is still running, it means it was a short tap, not a long press
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}


// --- INITIALIZATION ---

/**
 * Initializes the application logic once Firebase is ready.
 */
function initializeAppLogic() {
    // Assign global Firebase instances and functions to local variables
    db = window.firestoreDb;
    auth = window.firebaseAuth;
    currentAppId = window.getFirebaseAppId();

    // Assign Firestore functions from the global window.firestore object
    // These are imported in index.html's module script and made available globally
    ({ collection, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs } = window.firestore);
    ({ FieldValue, writeBatch } = window.firestore); // FieldValue and writeBatch are properties of window.firestore

    // Assign Auth functions from the global window.authFunctions object
    ({ GoogleAuthProviderInstance, signInAnonymously, signInWithCustomToken, signInWithPopup, signOut, onAuthStateChanged } = window.authFunctions);


    // Attach Auth State Observer
    if (auth && onAuthStateChanged) { // Check for auth and the onAuthStateChanged function
        onAuthStateChanged(auth, handleAuthStateChanged);
    } else {
        console.error("Firebase Auth not available. Cannot set up auth state listener.");
        handleAuthStateChanged(null); // Treat as logged out
    }

    // --- EVENT LISTENERS ---

    // Sidebar and Modals
    hamburgerBtn.addEventListener('click', () => {
        appSidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
    });

    closeMenuBtn.addEventListener('click', () => {
        appSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
    });

    sidebarOverlay.addEventListener('click', () => {
        appSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
    });

    // Close modals when clicking outside content
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                hideModal(modal);
            }
        });
    });

    // Close buttons for modals
    document.querySelectorAll('.modal .close-button').forEach(button => {
        button.addEventListener('click', (event) => {
            hideModal(event.target.closest('.modal'));
        });
    });

    // Share Form Modal Buttons
    addShareHeaderBtn.addEventListener('click', () => openShareFormModal());
    newShareBtn.addEventListener('click', () => openShareFormModal());
    cancelFormBtn.addEventListener('click', () => hideModal(shareFormSection));
    saveShareBtn.addEventListener('click', saveShare);
    deleteShareBtn.addEventListener('click', () => {
        if (selectedShareDocId) {
            deleteShare(selectedShareDocId);
        }
    });

    // Share Details Modal Buttons
    editShareFromDetailBtn.addEventListener('click', () => {
        const shareData = JSON.parse(document.querySelector('#shareTable tbody tr.selected')?.dataset.share || document.querySelector('#mobileShareCards .mobile-card.selected')?.dataset.share);
        if (shareData) {
            hideModal(shareDetailModal);
            openShareFormModal(shareData);
        } else {
            showCustomDialog("No share selected to edit.");
        }
    });
    deleteShareFromDetailBtn.addEventListener('click', () => {
        if (selectedShareDocId) {
            deleteShare(selectedShareDocId);
        }
    });

    // Comments section in Share Form
    addCommentSectionBtn.addEventListener('click', () => addCommentSection());

    // Watchlist Management
    addWatchlistBtn.addEventListener('click', () => showModal(addWatchlistModal));
    cancelAddWatchlistBtn.addEventListener('click', () => hideModal(addWatchlistModal));
    saveWatchlistBtn.addEventListener('click', addWatchlist);
    editWatchlistBtn.addEventListener('click', openManageWatchlistModal);
    cancelManageWatchlistBtn.addEventListener('click', () => hideModal(manageWatchlistModal));
    saveWatchlistNameBtn.addEventListener('click', saveWatchlistName);
    deleteWatchlistInModalBtn.addEventListener('click', deleteWatchlist);

    // Main Watchlist Select Change
    watchlistSelect.addEventListener('change', (event) => {
        currentSelectedWatchlistIds = [event.target.value];
        subscribeToShares(); // Re-subscribe to shares based on new selection
        updateMainTitle(); // Update main title
    });

    // Sort Select Change
    sortSelect.addEventListener('change', (event) => {
        currentSortOrder = event.target.value;
        renderShareList(); // Re-render with new sort order
    });

    // Theme Toggling
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('selectedTheme') || 'system-default';
        if (currentTheme === 'dark-theme') {
            applyTheme('system-default');
        } else {
            applyTheme('dark-theme');
        }
    });
    colorThemeSelect.addEventListener('change', (event) => {
        applyTheme(event.target.value);
    });
    revertToDefaultThemeBtn.addEventListener('click', () => {
        applyTheme('system-default');
        colorThemeSelect.value = 'none'; // Reset dropdown
    });

    // Standard Calculator
    standardCalcBtn.addEventListener('click', () => {
        clearCalculator();
        showModal(calculatorModal);
    });
    calculatorButtons.addEventListener('click', (event) => {
        const target = event.target;
        if (target.tagName !== 'BUTTON') return;

        const value = target.dataset.value;
        const action = target.dataset.action;

        if (value) {
            appendNumber(value);
        } else if (action) {
            if (action === 'clear') {
                clearCalculator();
            } else if (action === 'calculate') {
                calculateResult();
            } else {
                chooseOperator(target.textContent);
            }
        }
    });

    // Dividend Calculator (Standalone)
    dividendCalcBtn.addEventListener('click', () => {
        // Reset fields when opening standalone dividend calculator
        calcCurrentPriceInput.value = '';
        calcDividendAmountInput.value = '';
        calcFrankingCreditsInput.value = '';
        calcUnfrankedYieldSpan.textContent = '-';
        calcFrankedYieldSpan.textContent = '-';
        investmentValueSelect.value = '10000';
        calcEstimatedDividendSpan.textContent = '-';
        showModal(dividendCalculatorModal);
    });
    // Event listeners for dividend calculator inputs
    [calcCurrentPriceInput, calcDividendAmountInput, calcFrankingCreditsInput, investmentValueSelect].forEach(input => {
        input.addEventListener('input', () => {
            calculateDividendYieldsAndEstimatedDividend(
                calcCurrentPriceInput, calcDividendAmountInput, calcFrankingCreditsInput,
                calcUnfrankedYieldSpan, calcFrankedYieldSpan,
                investmentValueSelect, calcEstimatedDividendSpan
            );
        });
    });

    // Export Watchlist
    exportWatchlistBtn.addEventListener('click', exportWatchlistToCSV);

    // NEW: Share Research Feature Event Listeners
    shareResearchBtn.addEventListener('click', () => {
        const shareCode = shareResearchInput.value.trim();
        openShareResearchModal(shareCode);
    });
    shareResearchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            const shareCode = shareResearchInput.value.trim();
            openShareResearchModal(shareCode);
        }
    });
    cancelResearchBtn.addEventListener('click', () => hideModal(shareResearchModal));
    saveResearchShareBtn.addEventListener('click', saveResearchedShareToWatchlist);

    // Event listeners for research modal's dividend calculator inputs
    [researchCalcCurrentPrice, researchCalcDividendAmount, researchFrankingCredits, researchInvestmentValueSelect].forEach(input => {
        input.addEventListener('input', calculateResearchDividendYields);
    });


    // Context Menu Event Listeners
    contextEditShareBtn.addEventListener('click', () => {
        if (activeShareForContext) {
            hideContextMenu();
            openShareFormModal(activeShareForContext);
        }
    });
    contextDeleteShareBtn.addEventListener('click', () => {
        if (activeShareForContext) {
            hideContextMenu();
            deleteShare(activeShareForContext.id);
        }
    });
    // Hide context menu if clicked anywhere else on the document
    document.addEventListener('click', (event) => {
        if (shareContextMenu.style.display === 'block' && !shareContextMenu.contains(event.target)) {
            hideContextMenu();
        }
    });
    // Prevent default context menu on document right-click
    document.addEventListener('contextmenu', (event) => {
        // Only prevent if it's not on an input or textarea
        if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
            // event.preventDefault(); // Re-enable if we want to completely override browser context menu
        }
    });


    // Scroll to Top Button
    const scrollToTopBtn = document.getElementById("scrollToTopBtn");
    window.onscroll = function() {
        if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
            scrollToTopBtn.style.display = "flex"; // Use flex to center icon
        } else {
            scrollToTopBtn.style.display = "none";
        }
    };
    scrollToTopBtn.addEventListener("click", function() {
        document.body.scrollTop = 0; // For Safari
        document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    });

    // Ensure initial state of main buttons is disabled until auth
    updateMainButtonsState(false);
}

/**
 * Exports the current shares in the selected watchlist to a CSV file.
 */
async function exportWatchlistToCSV() {
    if (!currentUserId) {
        showCustomDialog("You must be signed in to export data.");
        return;
    }

    if (allSharesData.length === 0) {
        showCustomDialog("No shares to export in the current view.");
        return;
    }

    const confirmExport = await showCustomDialog("Export current shares to CSV?", true);
    if (!confirmExport) {
        return;
    }

    try {
        loadingIndicator.style.display = 'block';

        // Define CSV headers
        const headers = [
            "Share Code", "Entry Date", "Entered Price", "Target Price",
            "Dividend Amount", "Franking Credits (%)", "Unfranked Yield (%)",
            "Franked Yield (%)", "Comments"
        ];

        // Map share data to CSV rows
        const csvRows = allSharesData.map(share => {
            const { unfrankedYield, frankedYield } = calculateYields(
                parseFloat(share.enteredPrice),
                parseFloat(share.dividendAmount),
                parseFloat(share.frankingCredits)
            );

            // Flatten comments into a single string, handling multiple comments
            const commentsString = share.comments && share.comments.length > 0
                ? share.comments.map(c => `${c.title}: ${c.text}`).join('; ')
                : '';

            return [
                `"${share.shareName.toUpperCase()}"`,
                `"${formatDate(share.entryDate ? share.entryDate.seconds : null)}"`,
                `"${share.enteredPrice || ''}"`,
                `"${share.targetPrice || ''}"`,
                `"${share.dividendAmount || ''}"`,
                `"${share.frankingCredits || ''}"`,
                `"${unfrankedYield || ''}"`,
                `"${frankedYield || ''}"`,
                `"${commentsString.replace(/"/g, '""')}"` // Escape double quotes for CSV
            ].join(',');
        });

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...csvRows
        ].join('\n');

        // Create a Blob and download it
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const fileName = currentWatchlistName === "All Shares" ? "all_shares_export.csv" : `${currentWatchlistName.toLowerCase().replace(/\s/g, '_')}_export.csv`;
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showCustomDialog("Watchlist exported successfully!");

    } catch (error) {
        console.error("Error exporting watchlist:", error);
        showCustomDialog("Error exporting watchlist. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}


// --- DOMContentLoaded and Firebase Availability Check ---
document.addEventListener('DOMContentLoaded', async function() {
    console.log("script.js (v153) DOMContentLoaded fired."); // Updated version number

    // Check if Firebase objects are available from index.html's module script
    if (window.firestoreDb && window.firebaseAuth && window.getFirebaseAppId && window.firestore && window.authFunctions) {
        // Assign global Firebase instances and functions to local variables
        db = window.firestoreDb;
        auth = window.firebaseAuth;
        currentAppId = window.getFirebaseAppId();

        // Assign Firestore functions from the global window.firestore object
        // These are imported in index.html's module script and made available globally
        // We need to get the individual functions from the Firebase SDK, not from the simplified window.firestore object.
        // The individual functions like `collection`, `doc`, etc., are imported in index.html's module script.
        // We need to ensure they are available in the global scope or passed correctly.
        // The current setup in index.html exposes `db` and `auth` directly, and `FieldValue`, `writeBatch` under `window.firestore`.
        // The other functions like `collection`, `doc`, `query`, `where`, `onSnapshot`, `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `getDocs`, `getDoc`
        // are imported in the module script but *not* explicitly assigned to `window`.
        // To make them available here, we need to either:
        // 1. Assign them to `window` in index.html (less clean)
        // 2. Pass them as arguments to `initializeAppLogic` (cleaner, but requires refactoring)
        // 3. Re-import them here (redundant if already imported in module script, but ensures availability)

        // For now, let's assume they are available via the global window.firestore object as initially intended,
        // but the error suggests they are not.
        // Let's explicitly get them from the window.firestore object if they were intended to be there.
        // Given the error, it's more likely they need to be imported directly here or passed.
        // Re-importing them here is the most robust solution without changing index.html's module script structure too much.
        // However, the prompt states they are available via `window.firestore`. Let's correct the assignment.

        // Correct way to get the Firestore functions if they were exposed via window.firestore object:
        // (This assumes index.html's module script correctly exposed them, which it currently does not for all.)
        // Given the previous `index.html` update, `collection`, `doc`, etc. are *not* on `window.firestore`.
        // They are imported in the module script but only `dbInstance`, `authInstance`, `FieldValue`, `writeBatch`,
        // and auth functions are assigned to `window`.

        // To fix this, we need to ensure all required Firestore functions are available.
        // The most direct fix is to get them from the global `window.firestore` object if they were assigned there.
        // Since `index.html` only assigns `FieldValue` and `writeBatch` to `window.firestore`,
        // the other functions (collection, doc, etc.) are still missing.

        // Re-evaluate: The prompt's instructions state:
        // "Firebase app, db, auth instances, and userId are made globally available
        // via window.firestoreDb, window.firebaseAuth, window.getFirebaseAppId(), etc.,
        // from the <script type="module"> block in index.html."
        // And for `window.firestore`:
        // "window.firestore = firebaseInitialized ? {
        //     collection: collection,
        //     doc: doc,
        //     getDoc: getDoc,
        //     addDoc: addDoc,
        //     setDoc: setDoc,
        //     updateDoc: updateDoc,
        //     deleteDoc: deleteDoc,
        //     onSnapshot: onSnapshot,
        //     query: query,
        //     where: where,
        //     getDocs: getDocs,
        //     deleteField: FieldValue.delete,
        //     writeBatch: writeBatch
        // } : null;"
        // This means they *should* be available on `window.firestore`.
        // The error implies `window.firestore` itself is not the Firestore instance, but an object *containing* the functions.
        // My previous `initializeAppLogic` was trying to destructure directly from `window.firestore` which was correct
        // if `window.firestore` contained those functions.
        // The issue is that `collection` (and others) need `db` as their *first argument*.
        // So `window.firestore.collection(userPath, 'watchlists')` is wrong. It should be `collection(db, userPath, 'watchlists')`.

        // Let's ensure the local variables are correctly assigned from `window.firestore` and `window.authFunctions`.
        // This means the `index.html`'s module script *must* expose these functions.
        // The current `index.html` (v84) *does* expose them correctly now:
        // `window.firestore = firebaseInitialized ? { collection: collection, doc: doc, ... } : null;`
        // So, the destructuring in `initializeAppLogic` should work.

        // The error `Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore`
        // strongly suggests that `collection` is being called without `db` as its first argument.
        // I will re-verify all calls to `collection`, `doc`, `query`, `onSnapshot`, `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `getDocs`.

        // Re-assign local variables from window scope
        collection = window.firestore.collection;
        doc = window.firestore.doc;
        getDoc = window.firestore.getDoc;
        addDoc = window.firestore.addDoc;
        setDoc = window.firestore.setDoc;
        updateDoc = window.firestore.updateDoc;
        deleteDoc = window.firestore.deleteDoc;
        onSnapshot = window.firestore.onSnapshot;
        query = window.firestore.query;
        where = window.firestore.where;
        getDocs = window.firestore.getDocs;
        FieldValue = window.firestore.FieldValue; // Correctly assigned from window.firestore
        writeBatch = window.firestore.writeBatch; // Correctly assigned from window.firestore

        GoogleAuthProviderInstance = window.authFunctions.GoogleAuthProviderInstance;
        signInAnonymously = window.authFunctions.signInAnonymously;
        signInWithCustomToken = window.authFunctions.signInWithCustomToken;
        signInWithPopup = window.authFunctions.signInWithPopup;
        signOut = window.authFunctions.signOut;
        onAuthStateChanged = window.authFunctions.onAuthStateChanged;


        // Initial authentication check and setup
        // This ensures the app logic initializes only after Firebase auth state is determined
        // and prevents duplicate initialization if onAuthStateChanged fires multiple times.
        if (!window._appLogicInitialized) {
            // Attempt to sign in anonymously if no custom token is provided
            // This is crucial for the very first load in the Canvas environment
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                try {
                    await signInWithCustomToken(auth, __initial_auth_token); // Correct usage
                    console.log("[Auth] Signed in with custom token.");
                } catch (error) {
                    console.error("[Auth] Error signing in with custom token:", error);
                    // Fallback to anonymous if custom token fails
                    try {
                        await signInAnonymously(auth); // Correct usage
                        console.log("[Auth] Signed in anonymously as fallback.");
                    } catch (anonError) {
                        console.error("[Auth] Error signing in anonymously:", anonError);
                        showCustomDialog("Authentication failed. Please refresh the page.");
                    }
                }
            } else {
                try {
                    await signInAnonymously(auth); // Correct usage
                    console.log("[Auth] Signed in anonymously (no custom token provided).");
                } catch (anonError) {
                    console.error("[Auth] Error signing in anonymously:", anonError);
                    showCustomDialog("Authentication failed. Please refresh the page.");
                }
            }
            // The onAuthStateChanged listener will then trigger handleAuthStateChanged
            // once the auth state is confirmed.
            initializeAppLogic(); // Call this directly after initial auth attempt
            window._appLogicInitialized = true;
        }
        
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
        updateMainButtonsState(false);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        applyTheme('system-default');
    }
});
