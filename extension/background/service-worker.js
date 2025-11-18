/**
 * Brand Inspector - Service Worker
 * Handles extension lifecycle, side panel management, and message routing
 */


/**
 * Extraction state management
 */
const extractionState = new Map(); // tabId -> { url, state, timestamp, retryCount }

const ExtractionStates = {
    IDLE: 'idle',
    CHECKING: 'checking',
    EXTRACTING: 'extracting',
    COMPLETE: 'complete',
    FAILED: 'failed'
};

/**
 * Check if content script is ready
 */
async function pingContentScript(tabId, retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, { action: 'PING' });
            if (response && response.ready) {
                return true;
            }
        } catch (error) {
            // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
            await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
        }
    }
    console.warn(`Content script not ready for tab ${tabId} after ${retries} attempts`);
    return false;
}

/**
 * Installation handler
 */
chrome.runtime.onInstalled.addListener((details) => {

    if (details.reason === 'install') {
        // First-time installation

        // Initialize storage with default values
        chrome.storage.local.set({
            brandData: {
                colors: [],
                fonts: [],
                assets: [],
                textSnippets: [],
                metadata: {}
            },
            settings: {
                autoExtract: true,
                theme: 'light'
            }
        });

        // Open welcome page (optional)
        // chrome.tabs.create({ url: 'welcome.html' });
    } else if (details.reason === 'update') {
        // Extension updated
    }
});

/**
 * Extension icon click handler - opens side panel
 */
chrome.action.onClicked.addListener(async (tab) => {

    // Open side panel for this tab
    chrome.sidePanel.open({ tabId: tab.id }).catch(err => {
        console.error('Failed to open side panel:', err);
    });

    // Trigger extraction when side panel opens
    if (tab.url) {
        // Small delay to ensure content script is loaded
        setTimeout(async () => {
            chrome.storage.local.get(['brandData'], async (result) => {
                const previousUrl = result.brandData?.metadata?.url;

                // Extract if different URL or no previous data
                if (!previousUrl || previousUrl !== tab.url) {
                    const sameSite = isSameSite(previousUrl, tab.url);
                    await extractBrandData(tab.id, tab.url, !sameSite);
                }
            });
        }, 100);
    }
});

/**
 * Keyboard command handler
 */
chrome.commands.onCommand.addListener((command) => {

    // Get current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;

        const tab = tabs[0];

        // Map command to inspector mode
        let mode;
        switch (command) {
            case 'activate-color-picker':
                mode = 'color';
                break;
            case 'activate-font-picker':
                mode = 'font';
                break;
            case 'activate-text-capture':
                mode = 'text';
                break;
            case 'activate-image-picker':
                mode = 'image';
                break;
            default:
                console.warn('Unknown command:', command);
                return;
        }

        // Send message to content script
        chrome.tabs.sendMessage(tab.id, {
            action: 'ACTIVATE_INSPECTOR',
            mode: mode
        }).catch(err => {
            console.error('Failed to send message to content script:', err);
        });

        // Open side panel if not already open
        chrome.sidePanel.open({ tabId: tab.id }).catch(err => {
        });
    });
});

/**
 * Message routing between content scripts and side panel
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    switch (message.action) {
        case 'BRAND_EXTRACTED':
            // Mark extraction as complete
            const tabId = sender.tab.id;
            const state = extractionState.get(tabId);
            if (state) {
                extractionState.set(tabId, {
                    ...state,
                    state: ExtractionStates.COMPLETE
                });

                chrome.storage.local.set({
                    extractionStatus: {
                        state: ExtractionStates.COMPLETE,
                        url: state.url
                    }
                });
            }

            // Store brand data per-tab
            chrome.storage.local.get(['brandDataByTab'], (result) => {
                const brandDataByTab = result.brandDataByTab || {};
                brandDataByTab[tabId] = message.data;

                chrome.storage.local.set({
                    brandDataByTab,
                    latestMessage: {
                        ...message,
                        tabId,
                        timestamp: Date.now()
                    }
                });
            });

            sendResponse({ received: true });
            break;

        case 'ELEMENT_SELECTED':
            // Forward element selection to side panel
            forwardToSidePanel(message, sender.tab.id);
            sendResponse({ received: true });
            break;

        case 'INSPECTOR_ACTIVATED':
            sendResponse({ received: true });
            break;

        case 'INSPECTOR_DEACTIVATED':
            // Forward to side panel
            forwardToSidePanel(message, sender.tab.id);
            sendResponse({ received: true });
            break;

        case 'GET_TAB_INFO':
            // Return current tab information
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    sendResponse({
                        url: tabs[0].url,
                        title: tabs[0].title,
                        favIconUrl: tabs[0].favIconUrl
                    });
                }
            });
            return true; // Keep channel open for async response

        default:
            console.warn('Unknown message action:', message.action);
            sendResponse({ error: 'Unknown action' });
    }

    return true; // Keep message channel open
});

/**
 * Forward message to side panel
 */
async function forwardToSidePanel(message, tabId) {
    try {
        // Note: In Manifest V3, we can't directly send messages to side panel
        // The side panel will need to poll or use storage for updates
        // For now, we'll use chrome.storage as a message bus

        const timestamp = Date.now();
        await chrome.storage.local.set({
            latestMessage: {
                ...message,
                timestamp,
                tabId
            }
        });

    } catch (error) {
        console.error('Failed to forward message to side panel:', error);
    }
}

/**
 * Extract brand data with retry logic
 */
async function extractBrandData(tabId, url, isFullExtraction = true, bypassDuplicateCheck = false) {
    const state = extractionState.get(tabId) || {};

    // Check for duplicate extraction (within 2 seconds, unless bypassed)
    if (!bypassDuplicateCheck && state.url === url && state.timestamp && (Date.now() - state.timestamp < 2000)) {
        return;
    }

    // Check if already extracting
    if (state.state === ExtractionStates.EXTRACTING) {
        return;
    }

    // Update state
    extractionState.set(tabId, {
        url,
        state: ExtractionStates.CHECKING,
        timestamp: Date.now(),
        retryCount: 0
    });

    // Update status in storage
    chrome.storage.local.set({
        extractionStatus: { state: ExtractionStates.CHECKING, url }
    });

    // Check if content script is ready
    const isReady = await pingContentScript(tabId);

    if (!isReady) {
        console.error('Content script not ready after retries');
        extractionState.set(tabId, {
            ...extractionState.get(tabId),
            state: ExtractionStates.FAILED
        });
        chrome.storage.local.set({
            extractionStatus: { state: ExtractionStates.FAILED, url, error: 'Content script not ready' }
        });
        return;
    }

    // Content script ready, start extraction
    extractionState.set(tabId, {
        ...extractionState.get(tabId),
        state: ExtractionStates.EXTRACTING
    });

    chrome.storage.local.set({
        extractionStatus: { state: ExtractionStates.EXTRACTING, url }
    });

    try {
        const action = isFullExtraction ? 'EXTRACT_BRAND_DATA' : 'EXTRACT_METADATA_ONLY';

        // Send extraction request - completion will be marked when BRAND_EXTRACTED message arrives
        chrome.tabs.sendMessage(tabId, { action }).catch(err => {
            console.warn('Message send failed (tab may have closed):', err.message);

            // Mark as failed if message couldn't be sent
            extractionState.set(tabId, {
                ...extractionState.get(tabId),
                state: ExtractionStates.FAILED
            });

            chrome.storage.local.set({
                extractionStatus: { state: ExtractionStates.FAILED, url, error: err.message }
            });
        });


    } catch (error) {
        console.error('Extraction failed:', error);
        extractionState.set(tabId, {
            ...extractionState.get(tabId),
            state: ExtractionStates.FAILED
        });

        chrome.storage.local.set({
            extractionStatus: { state: ExtractionStates.FAILED, url, error: error.message }
        });
    }
}

/**
 * Check if navigation is same-site
 */
function isSameSite(url1, url2) {
    if (!url1 || !url2) return false;
    try {
        const origin1 = new URL(url1).origin;
        const origin2 = new URL(url2).origin;
        return origin1 === origin2;
    } catch {
        return false;
    }
}

/**
 * Tab update handler - detect page navigation
 */
let navigationTimeouts = new Map();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {

        // Check if URL is valid HTTP(S) - skip chrome:// and other internal pages
        if (!tab.url || !/^https?:\/\//.test(tab.url)) {
            return;
        }

        // Clear any pending timeout for this tab
        if (navigationTimeouts.has(tabId)) {
            clearTimeout(navigationTimeouts.get(tabId));
        }

        // Debounce rapid navigation (300ms)
        const timeout = setTimeout(async () => {
            navigationTimeouts.delete(tabId);

            // Check if auto-extract is enabled
            chrome.storage.local.get(['settings', 'brandData'], async (result) => {
                if (result.settings?.autoExtract === false) return;

                const previousUrl = result.brandData?.metadata?.url;
                const sameSite = isSameSite(previousUrl, tab.url);

                // Full extraction for new site, incremental for same site
                await extractBrandData(tabId, tab.url, !sameSite);
            });
        }, 300);

        navigationTimeouts.set(tabId, timeout);
    }
});

/**
 * Tab activation handler - update side panel context and trigger extraction
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {

    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);

        // Check if URL is valid HTTP(S)
        if (!tab.url || !/^https?:\/\//.test(tab.url)) {
            return;
        }

        // Notify side panel of tab change
        await chrome.storage.local.set({
            activeTabId: activeInfo.tabId
        });

        // Get settings and current brand data
        const result = await chrome.storage.local.get(['settings', 'brandDataByTab']);

        // Skip if auto-extract is disabled
        if (result.settings?.autoExtract === false) {
            return;
        }

        // Check if we already have data for this tab
        const existingData = result.brandDataByTab?.[activeInfo.tabId];
        const previousUrl = existingData?.metadata?.url;
        const sameSite = isSameSite(previousUrl, tab.url);

        // Extract brand data (always extract on tab switch, bypass duplicate check)
        // This ensures fresh data when user switches tabs
        await extractBrandData(activeInfo.tabId, tab.url, !sameSite, true);
    } catch (error) {
        console.error('Failed to handle tab activation:', error);
    }
});

/**
 * Handle extension updates
 */
chrome.runtime.onUpdateAvailable.addListener((details) => {

    // Optional: Auto-reload extension
    // chrome.runtime.reload();
});

/**
 * Error handling
 */
self.addEventListener('error', (event) => {
    console.error('Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

/**
 * Keep service worker alive (optional, use sparingly)
 */
let keepAliveInterval;

function keepAlive() {
    keepAliveInterval = setInterval(() => {
        chrome.runtime.getPlatformInfo(() => {
            // This keeps the service worker active
        });
    }, 25000); // Every 25 seconds
}

// Uncomment if you need to keep service worker alive
// keepAlive();

