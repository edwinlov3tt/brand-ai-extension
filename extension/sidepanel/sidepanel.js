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
        this.profileTab = new ProfileTab();

        // Setup tab navigation
        this.setupTabNavigation();

        // Setup inspector controls
        this.setupInspectorControls();

        // Setup inspector toggle
        this.setupInspectorToggle();

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

        // Setup storage listener for extraction status updates
        this.setupStorageListener();

        // Setup side panel close detection
        this.setupPanelCloseDetection();
    }

    /**
     * Setup storage listener for instant extraction status updates
     */
    setupStorageListener() {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local') return;

            // Listen for extraction status updates
            if (changes.extractionStatus) {
                const status = changes.extractionStatus.newValue;
                console.log('Extraction status changed:', status);

                if (status.state === 'checking') {
                    this.updateStatus('Checking page...', 'syncing');
                } else if (status.state === 'extracting') {
                    this.updateStatus('Analyzing...', 'syncing');
                } else if (status.state === 'complete') {
                    this.updateStatus('Analysis complete', 'ready');
                } else if (status.state === 'failed') {
                    this.updateStatus('Failed', 'error');
                }
            }

            // Listen for brand data messages (from service worker via storage)
            if (changes.latestMessage) {
                const message = changes.latestMessage.newValue;

                if (message.action === 'BRAND_EXTRACTED') {
                    this.handleBrandExtraction(message.data, message.incremental);
                }
            }
        });
    }

    /**
     * Setup side panel close detection
     */
    setupPanelCloseDetection() {
        // Listen for beforeunload event (when panel is closing)
        window.addEventListener('beforeunload', async () => {
            console.log('Side panel closing, deactivating inspector');

            // Get current tab and deactivate inspector
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'DEACTIVATE_INSPECTOR'
                    }).catch(err => {
                        console.log('Failed to deactivate inspector:', err);
                    });
                }
            } catch (error) {
                console.error('Error deactivating inspector on close:', error);
            }
        });

        // Also use visibilitychange as a backup
        document.addEventListener('visibilitychange', async () => {
            if (document.hidden) {
                console.log('Side panel hidden, deactivating inspector');

                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'DEACTIVATE_INSPECTOR'
                        }).catch(err => {
                            console.log('Failed to deactivate inspector:', err);
                        });
                    }
                } catch (error) {
                    console.error('Error deactivating inspector:', error);
                }
            }
        });
    }

    /**
     * Setup listener for tab URL changes
     */
    setupTabUpdateListener() {
        // Note: URL change detection is now handled automatically by service worker
        // This listener is kept for potential future use

        // Listen for tab activation (switching between tabs)
        chrome.tabs.onActivated.addListener(async (activeInfo) => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                // Load state for the new tab if available
                this.loadState();
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

        // Text capture activation
        window.addEventListener('activateTextCapture', () => {
            this.activateInspector('text');
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
     * Setup inspector toggle switch
     */
    setupInspectorToggle() {
        const toggle = document.getElementById('inspector-mode-toggle');

        if (!toggle) return;

        toggle.addEventListener('change', async (e) => {
            const isEnabled = e.target.checked;

            if (isEnabled) {
                // Enable inspector mode - activate based on current tab
                const currentTab = this.currentTab;

                if (currentTab === 'colors') {
                    this.activateInspector('color');
                } else if (currentTab === 'fonts') {
                    this.activateInspector('font');
                } else if (currentTab === 'assets') {
                    this.activateInspector('image');
                } else {
                    // Default to color picker if on overview/profile
                    this.activateInspector('color');
                }
            } else {
                // Disable inspector mode
                await this.deactivateInspector();
            }
        });

        // Listen for tab changes to update toggle state
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', () => {
                // Reset toggle when switching tabs
                toggle.checked = false;
            });
        });
    }

    /**
     * Deactivate inspector mode
     */
    async deactivateInspector() {
        console.log('Deactivating inspector');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) return;

        chrome.tabs.sendMessage(tab.id, {
            action: 'DEACTIVATE_INSPECTOR'
        }).catch(err => {
            console.log('Failed to deactivate inspector:', err);
        });
    }

    /**
     * Setup inspector control buttons (now combined with tab navigation)
     */
    setupInspectorControls() {
        const pickColorBtn = document.getElementById('pick-color-btn');
        const pickFontBtn = document.getElementById('pick-font-btn');
        const pickImageBtn = document.getElementById('pick-image-btn');

        // Colors tab - activate color picker when clicking
        pickColorBtn.addEventListener('click', (e) => {
            // Check if already on colors tab
            if (pickColorBtn.classList.contains('active')) {
                this.activateInspector('color');
            }
        });

        // Fonts tab - activate font picker when clicking
        pickFontBtn.addEventListener('click', (e) => {
            // Check if already on fonts tab
            if (pickFontBtn.classList.contains('active')) {
                this.activateInspector('font');
            }
        });

        // Assets tab - activate image picker when clicking
        pickImageBtn.addEventListener('click', (e) => {
            // Check if already on assets tab
            if (pickImageBtn.classList.contains('active')) {
                this.activateInspector('image');
            }
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
     * Reanalyze current page (manual trigger)
     */
    async reanalyzePage() {
        console.log('Manually reanalyzing current page...');

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

        // Update status
        this.updateStatus('Analyzing page...', 'syncing');

        // Get current tab and send extraction request
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.tabs.sendMessage(tab.id, {
                action: 'EXTRACT_BRAND_DATA'
            }).catch(err => {
                console.error('Failed to send extraction request:', err);
                this.updateStatus('Failed', 'error');
            });
        }
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
     * Handle brand extraction results
     */
    handleBrandExtraction(data, incremental = false) {
        console.log('Brand data extracted:', data, 'incremental:', incremental);

        if (incremental) {
            // Incremental update - only merge metadata, preserve colors/fonts/assets
            if (data.metadata) {
                this.brandData.metadata = { ...this.brandData.metadata, ...data.metadata };
            }

            // Only update overview and metadata-related sections
            this.updateOverviewTab();
            this.showNotification('Page metadata updated', 'success');
        } else {
            // Full extraction - merge/replace all data
            if (data.colors) this.brandData.colors = data.colors;
            if (data.fonts) this.brandData.fonts = data.fonts;
            if (data.assets) this.brandData.assets = data.assets;
            if (data.metadata) this.brandData.metadata = data.metadata;

            // Update all UI
            this.updateOverviewTab();
            this.updateColorsTab();
            this.updateFontsTab();
            this.updateAssetsTab();

            this.showNotification('Brand assets detected successfully', 'success');
        }

        // Save state
        this.saveState();

        // Update action buttons
        this.updateActionButtons();

        // Update status
        this.updateStatus('Analysis complete', 'ready');
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
            this.brandData.assets.length === 0 &&
            !this.brandData.metadata.title) {
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

        // Update Brand Snapshot
        this.updateBrandSnapshot();

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
    }

    /**
     * Update Brand Snapshot section
     */
    updateBrandSnapshot() {
        const snapshotSection = document.getElementById('brand-snapshot-section');
        const logoFaviconSection = document.getElementById('logo-favicon-section');
        const metadata = this.brandData.metadata || {};

        // Update Brand Snapshot section (includes meta image + text)
        const hasSnapshotData = metadata.metaImage || metadata.title || metadata.description;
        if (snapshotSection) {
            snapshotSection.style.display = hasSnapshotData ? 'block' : 'none';
        }

        // Update Meta Image
        const metaImageContainer = document.getElementById('meta-image-container');
        const metaImagePreview = document.getElementById('overview-meta-image');
        if (metaImagePreview && metaImageContainer) {
            if (metadata.metaImage) {
                metaImagePreview.innerHTML = `
                    <img src="${metadata.metaImage}" alt="Meta Image">
                    <button class="asset-download-btn" data-url="${metadata.metaImage}" data-filename="meta-image.jpg" title="Download meta image">
                        <i data-lucide="download" class="icon-sm"></i>
                    </button>
                `;
                metaImageContainer.style.display = 'block';
            } else {
                metaImageContainer.style.display = 'none';
            }
        }

        // Update Page Name
        const pageName = document.getElementById('overview-page-name');
        if (pageName) {
            pageName.textContent = metadata.title || '';
            pageName.style.display = metadata.title ? 'block' : 'none';
        }

        // Update Tagline (use description)
        const tagline = document.getElementById('overview-tagline');
        if (tagline) {
            tagline.textContent = metadata.description || metadata.tagline || '';
            tagline.style.display = (metadata.description || metadata.tagline) ? 'block' : 'none';
        }

        // Update Logo & Favicon section
        const hasLogoFavicon = metadata.logo || metadata.favicon;
        if (logoFaviconSection) {
            logoFaviconSection.style.display = hasLogoFavicon ? 'block' : 'none';
        }

        // Update Logo
        const logoPreview = document.getElementById('overview-logo');
        if (logoPreview) {
            if (metadata.logo) {
                const filename = this.getFilenameFromUrl(metadata.logo);
                logoPreview.innerHTML = `
                    <img src="${metadata.logo}" alt="Logo">
                    <button class="asset-download-btn" data-url="${metadata.logo}" data-filename="${filename}" title="Download logo">
                        <i data-lucide="download" class="icon-sm"></i>
                    </button>
                `;
            } else {
                logoPreview.innerHTML = '';
            }
        }

        // Update Favicon
        const faviconPreview = document.getElementById('overview-favicon');
        if (faviconPreview) {
            if (metadata.favicon) {
                const filename = this.getFilenameFromUrl(metadata.favicon);
                faviconPreview.innerHTML = `
                    <img src="${metadata.favicon}" alt="Favicon">
                    <button class="asset-download-btn" data-url="${metadata.favicon}" data-filename="${filename}" title="Download favicon">
                        <i data-lucide="download" class="icon-sm"></i>
                    </button>
                `;
            } else {
                faviconPreview.innerHTML = '';
            }
        }

        // Setup download button event listeners
        this.setupAssetDownloadButtons();

        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Update Contact & Social section
        this.updateContactSocial(metadata);
    }

    /**
     * Get filename from URL
     */
    getFilenameFromUrl(url) {
        try {
            const pathname = new URL(url).pathname;
            const filename = pathname.split('/').pop();
            return filename || 'download';
        } catch (e) {
            return 'download';
        }
    }

    /**
     * Setup asset download button event listeners
     */
    setupAssetDownloadButtons() {
        const downloadButtons = document.querySelectorAll('.asset-download-btn');
        downloadButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const url = button.dataset.url;
                const filename = button.dataset.filename || 'asset';

                try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const objectUrl = URL.createObjectURL(blob);

                    const a = document.createElement('a');
                    a.href = objectUrl;
                    a.download = filename;
                    a.click();

                    URL.revokeObjectURL(objectUrl);
                } catch (error) {
                    console.error('Failed to download asset:', error);
                    this.showNotification('Failed to download asset', 'error');
                }
            });
        });
    }

    /**
     * Update Contact & Social section
     */
    updateContactSocial(metadata) {
        const section = document.getElementById('contact-social-section');
        const socialLinksContainer = document.getElementById('social-links-container');
        const contactInfoContainer = document.getElementById('contact-info-container');
        const socialLinks = document.getElementById('overview-social-links');
        const contactInfo = document.getElementById('overview-contact-info');

        // Check if we have any social or contact data
        const hasSocial = metadata.social && Object.values(metadata.social).some(v => v !== null);
        const hasContact = metadata.contact && (metadata.contact.emails?.length > 0 || metadata.contact.phones?.length > 0);

        // Hide entire section if no data
        if (!hasSocial && !hasContact) {
            if (section) section.style.display = 'none';
            return;
        }

        // Show section
        if (section) section.style.display = 'block';

        // Update Social Media Links
        if (hasSocial && socialLinks) {
            socialLinksContainer.style.display = 'block';
            socialLinks.innerHTML = '';

            const socialPlatforms = [
                { key: 'facebook', name: 'Facebook', icon: 'facebook' },
                { key: 'instagram', name: 'Instagram', icon: 'instagram' },
                { key: 'twitter', name: 'X', icon: 'twitter' },
                { key: 'youtube', name: 'YouTube', icon: 'youtube' },
                { key: 'linkedin', name: 'LinkedIn', icon: 'linkedin' },
                { key: 'googleBusiness', name: 'Google', icon: 'map-pin' }
            ];

            socialPlatforms.forEach(platform => {
                if (metadata.social[platform.key]) {
                    const link = document.createElement('a');
                    link.className = 'social-link';
                    link.href = metadata.social[platform.key];
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.innerHTML = `
                        <i data-lucide="${platform.icon}" class="icon-sm"></i>
                        <span>${platform.name}</span>
                    `;
                    socialLinks.appendChild(link);
                }
            });
        } else {
            socialLinksContainer.style.display = 'none';
        }

        // Update Contact Information
        if (hasContact && contactInfo) {
            contactInfoContainer.style.display = 'block';
            contactInfo.innerHTML = '';

            // Add emails
            if (metadata.contact.emails && metadata.contact.emails.length > 0) {
                metadata.contact.emails.forEach(email => {
                    const item = document.createElement('div');
                    item.className = 'contact-item';
                    item.innerHTML = `
                        <i data-lucide="mail" class="contact-item-icon"></i>
                        <a href="mailto:${email}" class="contact-item-link">${email}</a>
                    `;
                    contactInfo.appendChild(item);
                });
            }

            // Add phones
            if (metadata.contact.phones && metadata.contact.phones.length > 0) {
                metadata.contact.phones.forEach(phone => {
                    const item = document.createElement('div');
                    item.className = 'contact-item';
                    item.innerHTML = `
                        <i data-lucide="phone" class="contact-item-icon"></i>
                        <a href="tel:${phone}" class="contact-item-link">${phone}</a>
                    `;
                    contactInfo.appendChild(item);
                });
            }
        } else {
            contactInfoContainer.style.display = 'none';
        }

        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
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
        const statusDot = statusIndicator.querySelector('.status-dot');
        const reanalyzeBtn = document.getElementById('reanalyze-btn');

        // Update title attribute for tooltip
        if (statusIndicator) {
            statusIndicator.title = text;
        }

        // Update status class for dot color
        if (statusDot) {
            statusDot.className = 'status-dot ' + type;
        }

        // Show reanalyze button only on errors
        if (reanalyzeBtn) {
            if (type === 'error') {
                reanalyzeBtn.classList.add('visible');
            } else {
                reanalyzeBtn.classList.remove('visible');
            }
        }
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
