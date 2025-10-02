/**
 * Brand Inspector - Service Worker
 * Handles extension lifecycle, side panel management, and message routing
 */

console.log('Brand Inspector service worker loaded');

/**
 * Installation handler
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed:', details.reason);

    if (details.reason === 'install') {
        // First-time installation
        console.log('Welcome to Brand Inspector!');

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
        console.log('Extension updated to version', chrome.runtime.getManifest().version);
    }
});

/**
 * Extension icon click handler - opens side panel
 */
chrome.action.onClicked.addListener((tab) => {
    console.log('Extension icon clicked, opening side panel');

    // Open side panel for this tab
    chrome.sidePanel.open({ tabId: tab.id }).catch(err => {
        console.error('Failed to open side panel:', err);
    });
});

/**
 * Keyboard command handler
 */
chrome.commands.onCommand.addListener((command) => {
    console.log('Command triggered:', command);

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
            console.log('Side panel already open or failed to open:', err);
        });
    });
});

/**
 * Message routing between content scripts and side panel
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Service worker received message:', message.action, 'from', sender.tab?.id || 'side panel');

    switch (message.action) {
        case 'BRAND_EXTRACTED':
            // Forward brand extraction data to side panel
            forwardToSidePanel(message, sender.tab.id);
            sendResponse({ received: true });
            break;

        case 'ELEMENT_SELECTED':
            // Forward element selection to side panel
            forwardToSidePanel(message, sender.tab.id);
            sendResponse({ received: true });
            break;

        case 'INSPECTOR_ACTIVATED':
            console.log('Inspector activated:', message.mode);
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

        console.log('Message stored for side panel');
    } catch (error) {
        console.error('Failed to forward message to side panel:', error);
    }
}

/**
 * Tab update handler - detect page navigation
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        console.log('Page loaded:', tab.url);

        // Check if auto-extract is enabled
        chrome.storage.local.get(['settings'], (result) => {
            if (result.settings?.autoExtract !== false) {
                // Trigger automatic brand extraction
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, {
                        action: 'EXTRACT_BRAND_DATA'
                    }).catch(err => {
                        console.log('Content script not ready or extraction failed:', err);
                    });
                }, 1000); // Wait 1 second for page to settle
            }
        });
    }
});

/**
 * Tab activation handler - update side panel context
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log('Tab activated:', activeInfo.tabId);

    // Notify side panel of tab change
    chrome.storage.local.set({
        activeTabId: activeInfo.tabId
    });
});

/**
 * Handle extension updates
 */
chrome.runtime.onUpdateAvailable.addListener((details) => {
    console.log('Update available:', details.version);

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

console.log('Brand Inspector service worker ready');
