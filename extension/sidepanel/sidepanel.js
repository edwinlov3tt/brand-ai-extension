/**
 * Brand Inspector - Side Panel Controller
 * Manages tab navigation, state, and communication with content scripts
 */

class SidePanelController {
    constructor() {
        this.currentTab = 'overview';
        this.brandData = {
            colors: [],
            fonts: [],
            assets: [],
            textSnippets: [],
            metadata: {}
        };
        this.init();
    }

    /**
     * Initialize side panel
     */
    init() {
        console.log('Brand Inspector Side Panel initialized');

        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Initialize tab components
        this.colorsTab = new ColorsTab();
        this.fontsTab = new FontsTab();
        this.assetsTab = new AssetsTab();

        // Setup tab navigation
        this.setupTabNavigation();

        // Setup inspector controls
        this.setupInspectorControls();

        // Setup action buttons
        this.setupActionButtons();

        // Setup reanalyze button
        this.setupReanalyzeButton();

        // Setup message listener
        this.setupMessageListener();

        // Setup custom event listeners from tab components
        this.setupCustomEventListeners();

        // Load saved state
        this.loadState();

        // Listen for tab updates (URL changes)
        this.setupTabUpdateListener();

        // Request initial extraction from current tab
        this.requestInitialExtraction();
    }

    /**
     * Setup listener for tab URL changes
     */
    setupTabUpdateListener() {
        // Listen for tab updates
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            // Check if URL changed and it's the active tab
            if (changeInfo.url) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0] && tabs[0].id === tabId) {
                        console.log('Tab URL changed, clearing old data');
                        this.reanalyzePage();
                    }
                });
            }
        });

        // Listen for tab activation (switching between tabs)
        chrome.tabs.onActivated.addListener(async (activeInfo) => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                // Check if URL is different from stored metadata
                if (this.brandData.metadata.url && this.brandData.metadata.url !== tab.url) {
                    console.log('Switched to different URL, clearing old data');
                    this.reanalyzePage();
                }
            }
        });
    }

    /**
     * Setup custom event listeners from tab components
     */
    setupCustomEventListeners() {
        // Color picker activation
        window.addEventListener('activateColorPicker', () => {
            this.activateInspector('color');
        });

        // Font picker activation
        window.addEventListener('activateFontPicker', () => {
            this.activateInspector('font');
        });

        // Delete color
        window.addEventListener('deleteColor', (e) => {
            this.deleteColor(e.detail);
        });

        // Delete font
        window.addEventListener('deleteFont', (e) => {
            this.deleteFont(e.detail);
        });
    }

    /**
     * Setup tab navigation
     */
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-button');

        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = button.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Handle "Show all" buttons
        document.querySelectorAll('.show-all-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const expandTab = btn.dataset.expand;
                if (expandTab) {
                    this.switchTab(expandTab);
                }
            });
        });
    }

    /**
     * Switch to a different tab
     */
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        this.currentTab = tabName;
        console.log(`Switched to ${tabName} tab`);

        // Re-initialize icons when switching tabs
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Setup inspector control buttons
     */
    setupInspectorControls() {
        const pickColorBtn = document.getElementById('pick-color-btn');
        const pickFontBtn = document.getElementById('pick-font-btn');
        const addTextBtn = document.getElementById('add-text-btn');
        const pickImageBtn = document.getElementById('pick-image-btn');

        pickColorBtn.addEventListener('click', () => {
            this.activateInspector('color');
        });

        pickFontBtn.addEventListener('click', () => {
            this.activateInspector('font');
        });

        addTextBtn.addEventListener('click', () => {
            this.activateInspector('text');
        });

        pickImageBtn.addEventListener('click', () => {
            this.activateInspector('image');
        });
    }

    /**
     * Activate inspector mode in content script
     */
    async activateInspector(mode) {
        console.log(`Activating ${mode} inspector`);

        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            console.error('No active tab found');
            return;
        }

        // Send message to content script
        chrome.tabs.sendMessage(tab.id, {
            action: 'ACTIVATE_INSPECTOR',
            mode: mode
        }).catch(err => {
            console.error('Failed to activate inspector:', err);
            // Content script might not be loaded yet
            this.showNotification('Please refresh the page and try again', 'error');
        });

        // Update button state
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        let activeBtnId = '';
        if (mode === 'text') {
            activeBtnId = 'add-text-btn';
        } else {
            activeBtnId = `pick-${mode}-btn`;
        }

        const activeBtn = document.getElementById(activeBtnId);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    /**
     * Setup action bar buttons
     */
    setupActionButtons() {
        const exportBtn = document.getElementById('export-btn');
        const syncBtn = document.getElementById('sync-btn');

        exportBtn.addEventListener('click', () => {
            this.exportBrandData();
        });

        syncBtn.addEventListener('click', () => {
            this.syncToWebApp();
        });

        // Enable buttons if we have data
        this.updateActionButtons();
    }

    /**
     * Setup reanalyze button
     */
    setupReanalyzeButton() {
        const reanalyzeBtn = document.getElementById('reanalyze-btn');

        reanalyzeBtn.addEventListener('click', async () => {
            await this.reanalyzePage();
        });
    }

    /**
     * Reanalyze current page
     */
    async reanalyzePage() {
        console.log('Reanalyzing current page...');

        // Clear existing data
        this.brandData = {
            colors: [],
            fonts: [],
            assets: [],
            textSnippets: [],
            metadata: {}
        };

        // Update all tabs to show empty state
        this.updateOverviewTab();
        this.updateColorsTab();
        this.updateFontsTab();
        this.updateAssetsTab();
        this.updateActionButtons();

        // Request fresh extraction
        await this.requestInitialExtraction();
    }

    /**
     * Update action button states
     */
    updateActionButtons() {
        const hasData = this.brandData.colors.length > 0 ||
                       this.brandData.fonts.length > 0 ||
                       this.brandData.assets.length > 0;

        document.getElementById('export-btn').disabled = !hasData;
        document.getElementById('sync-btn').disabled = !hasData;
    }

    /**
     * Setup message listener for content script
     */
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Side panel received message:', message);

            switch (message.action) {
                case 'BRAND_EXTRACTED':
                    this.handleBrandExtraction(message.data);
                    sendResponse({ received: true });
                    break;

                case 'ELEMENT_SELECTED':
                    this.handleElementSelected(message.element, message.mode);
                    sendResponse({ received: true });
                    break;

                case 'INSPECTOR_DEACTIVATED':
                    this.deactivateInspectorUI();
                    sendResponse({ received: true });
                    break;

                case 'INSPECTOR_ACTIVATED':
                    // Just acknowledge, no action needed in sidepanel
                    sendResponse({ received: true });
                    break;

                default:
                    // Silently ignore unknown messages (they might be for other components)
                    sendResponse({ received: false });
            }

            return true; // Keep channel open for async responses
        });
    }

    /**
     * Request initial brand extraction from current page
     */
    async requestInitialExtraction() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                console.log('No active tab, skipping extraction');
                return;
            }

            // Update status
            this.updateStatus('Analyzing page...', 'syncing');

            // Send message to content script to extract brand data
            chrome.tabs.sendMessage(tab.id, {
                action: 'EXTRACT_BRAND_DATA'
            }).catch(err => {
                console.log('Content script not ready yet:', err);
                this.updateStatus('Ready', 'ready');
            });

        } catch (error) {
            console.error('Failed to request extraction:', error);
            this.updateStatus('Ready', 'ready');
        }
    }

    /**
     * Handle brand extraction results
     */
    handleBrandExtraction(data) {
        console.log('Brand data extracted:', data);

        // Merge with existing data
        if (data.colors) this.brandData.colors = [...this.brandData.colors, ...data.colors];
        if (data.fonts) this.brandData.fonts = [...this.brandData.fonts, ...data.fonts];
        if (data.assets) this.brandData.assets = [...this.brandData.assets, ...data.assets];
        if (data.metadata) this.brandData.metadata = { ...this.brandData.metadata, ...data.metadata };

        // Update UI
        this.updateOverviewTab();
        this.updateColorsTab();
        this.updateFontsTab();
        this.updateAssetsTab();

        // Save state
        this.saveState();

        // Update action buttons
        this.updateActionButtons();

        // Update status
        this.updateStatus('Analysis complete', 'ready');

        // Show notification
        this.showNotification('Brand assets detected successfully', 'success');
    }

    /**
     * Handle element selection from inspector
     */
    handleElementSelected(element, mode) {
        console.log(`Element selected in ${mode} mode:`, element);

        switch (mode) {
            case 'color':
                this.addColor(element);
                break;

            case 'font':
                this.addFont(element);
                break;

            case 'text':
                this.addTextSnippet(element);
                break;

            case 'image':
                this.addAsset(element);
                break;
        }

        // Save state
        this.saveState();

        // Update UI
        this.updateActionButtons();
    }

    /**
     * Add color to brand data
     */
    addColor(color) {
        // Check for duplicates
        const exists = this.brandData.colors.some(c => c.hex === color.hex);
        if (!exists) {
            this.brandData.colors.push(color);
            this.updateColorsTab();
            this.updateOverviewTab();
            this.showNotification(`Color ${color.hex} added`, 'success');
        }
    }

    /**
     * Delete color from brand data
     */
    deleteColor(color) {
        this.brandData.colors = this.brandData.colors.filter(c => c.hex !== color.hex);
        this.updateColorsTab();
        this.updateOverviewTab();
        this.saveState();
        this.updateActionButtons();
        this.showNotification(`Color ${color.hex} removed`, 'success');
    }

    /**
     * Add font to brand data
     */
    addFont(font) {
        // Check for duplicates
        const exists = this.brandData.fonts.some(f => f.family === font.family);
        if (!exists) {
            this.brandData.fonts.push(font);
            this.updateFontsTab();
            this.updateOverviewTab();
            this.showNotification(`Font ${font.family} added`, 'success');
        }
    }

    /**
     * Delete font from brand data
     */
    deleteFont(font) {
        this.brandData.fonts = this.brandData.fonts.filter(f => f.family !== font.family);
        this.updateFontsTab();
        this.updateOverviewTab();
        this.saveState();
        this.updateActionButtons();
        this.showNotification(`Font ${font.family} removed`, 'success');
    }

    /**
     * Add text snippet to brand data
     */
    addTextSnippet(text) {
        this.brandData.textSnippets.push(text);
        this.updateBrandProfileTab();
        this.showNotification('Text snippet captured', 'success');
    }

    /**
     * Add asset to brand data
     */
    addAsset(asset) {
        // Check for duplicates by URL
        const exists = this.brandData.assets.some(a => a.url === asset.url);
        if (!exists) {
            this.brandData.assets.push(asset);
            this.updateAssetsTab();
            this.showNotification(`Asset ${asset.fileName} added`, 'success');

            // Switch to assets tab to show the new asset
            this.switchTab('assets');
        }
    }

    /**
     * Update Overview tab
     */
    updateOverviewTab() {
        const emptyState = document.querySelector('#overview-tab .empty-state');
        const overviewContent = document.getElementById('overview-content');

        if (this.brandData.colors.length === 0 &&
            this.brandData.fonts.length === 0 &&
            this.brandData.assets.length === 0) {
            // Show empty state
            emptyState.classList.remove('hidden');
            overviewContent.classList.add('hidden');
            // Re-initialize icons
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Hide empty state, show content
        emptyState.classList.add('hidden');
        overviewContent.classList.remove('hidden');

        // Update color palette preview
        const colorsContainer = document.getElementById('overview-colors');
        colorsContainer.innerHTML = '';

        this.brandData.colors.slice(0, 5).forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color.hex;
            swatch.title = color.hex;
            colorsContainer.appendChild(swatch);
        });

        // Update fonts
        if (this.brandData.fonts.length > 0) {
            const displayFont = this.brandData.fonts.find(f => f.role === 'display') || this.brandData.fonts[0];
            const bodyFont = this.brandData.fonts.find(f => f.role === 'body') || this.brandData.fonts[1];

            if (displayFont) {
                document.getElementById('overview-display-font').textContent = displayFont.family;
            }
            if (bodyFont) {
                document.getElementById('overview-body-font').textContent = bodyFont.family;
            }
        }

        // Re-initialize icons after DOM updates
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // TODO: Update logo, hero, favicon when available
    }

    /**
     * Update Colors tab
     */
    updateColorsTab() {
        if (this.colorsTab) {
            this.colorsTab.updateColors(this.brandData.colors);
        }
    }

    /**
     * Update Fonts tab
     */
    updateFontsTab() {
        if (this.fontsTab) {
            this.fontsTab.updateFonts(this.brandData.fonts);
        }
    }

    /**
     * Update Assets tab
     */
    updateAssetsTab() {
        if (this.assetsTab) {
            this.assetsTab.updateAssets(this.brandData.assets);
        }
    }

    /**
     * Update Brand Profile tab
     */
    updateBrandProfileTab() {
        // TODO: Implement profile tab UI in Phase 4
        console.log('Profile tab update pending Phase 4');
    }

    /**
     * Deactivate inspector UI
     */
    deactivateInspectorUI() {
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }

    /**
     * Update status indicator
     */
    updateStatus(text, type = 'ready') {
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = statusIndicator.querySelector('.status-text');

        statusText.textContent = text;
        statusIndicator.className = 'status-indicator ' + type;
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // TODO: Implement toast notifications in future phase
    }

    /**
     * Export brand data
     */
    exportBrandData() {
        console.log('Exporting brand data...');

        const dataStr = JSON.stringify(this.brandData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `brand-profile-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);

        this.showNotification('Brand data exported', 'success');
    }

    /**
     * Sync to web app
     */
    async syncToWebApp() {
        console.log('Syncing to web app...');
        this.updateStatus('Syncing...', 'syncing');

        // TODO: Implement web app integration in Phase 6

        setTimeout(() => {
            this.updateStatus('Ready', 'ready');
            this.showNotification('Sync not implemented yet', 'error');
        }, 1000);
    }

    /**
     * Save state to Chrome storage
     */
    async saveState() {
        try {
            await chrome.storage.local.set({
                brandData: this.brandData,
                currentTab: this.currentTab
            });
            console.log('State saved');
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    }

    /**
     * Load state from Chrome storage
     */
    async loadState() {
        try {
            const result = await chrome.storage.local.get(['brandData', 'currentTab']);

            if (result.brandData) {
                this.brandData = result.brandData;
                this.updateOverviewTab();
                this.updateActionButtons();
                console.log('State loaded');
            }

            if (result.currentTab) {
                this.switchTab(result.currentTab);
            }
        } catch (error) {
            console.error('Failed to load state:', error);
        }
    }
}

// Initialize side panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.sidePanelController = new SidePanelController();
});
