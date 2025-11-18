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

        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Initialize tab components
        this.colorsTab = new ColorsTab();
        this.fontsTab = new FontsTab();
        this.assetsTab = new AssetsTab();
        this.pagesTab = new PagesTab();
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

        // Setup copy buttons
        this.setupCopyButtons();

        // Setup header menu
        this.setupHeaderMenu();

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
        chrome.storage.onChanged.addListener(async (changes, areaName) => {
            if (areaName !== 'local') return;

            // Listen for extraction status updates
            if (changes.extractionStatus) {
                const status = changes.extractionStatus.newValue;

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
                    // Only process messages for the currently active tab
                    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!activeTab || message.tabId !== activeTab.id) {
                        return;
                    }

                    this.handleBrandExtraction(message.data, message.incremental);
                }
            }
        });
    }

    /**
     * Setup side panel close detection
     */
    setupPanelCloseDetection() {
        // Store current tab ID for synchronous access
        let currentTabId = null;

        // Track current tab
        chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
            if (tab) currentTabId = tab.id;
        });

        // Update tab ID when switching tabs
        chrome.tabs.onActivated.addListener(async (activeInfo) => {
            currentTabId = activeInfo.tabId;
        });

        // Listen for beforeunload event (when panel is closing)
        window.addEventListener('beforeunload', () => {

            // Use synchronous approach - no await to ensure message sends before close
            if (currentTabId) {
                // Stop all analysis and deactivate inspector
                chrome.tabs.sendMessage(currentTabId, {
                    action: 'STOP_ANALYSIS'
                }).catch(err => {
                });

                // Also reset the toggle
                const toggle = document.getElementById('inspector-mode-toggle');
                if (toggle) toggle.checked = false;
            }
        });

        // Note: Removed visibilitychange listener as it fires too often (when switching browser tabs)
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
        // Delete color
        window.addEventListener('deleteColor', (e) => {
            this.deleteColor(e.detail);
        });

        // Delete font
        window.addEventListener('deleteFont', (e) => {
            this.deleteFont(e.detail);
        });

        // Brand profile loaded - notify PagesTab
        window.addEventListener('brandProfileLoaded', (e) => {
            const { id, domain } = e.detail;
            if (this.pagesTab) {
                this.pagesTab.setBrandProfile(id, domain);
            }
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
    async switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        this.currentTab = tabName;

        // Trigger profile reload when switching to profile tab
        if (tabName === 'profile' && this.profileTab) {
            this.profileTab.loadCachedProfile();
        }

        // Trigger pages load when switching to pages tab
        if (tabName === 'pages' && this.pagesTab && this.profileTab && this.profileTab.brandProfile) {
            const profile = this.profileTab.brandProfile;
            if (profile) {
                // Use profile.id if it exists, otherwise use the domain as the ID
                const profileId = profile.id || profile.metadata?.id || await this.getCurrentDomain();
                const domain = profile.metadata?.domain || await this.getCurrentDomain();
                this.pagesTab.setBrandProfile(profileId, domain);
            }
        }

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

        // Note: Removed auto-reset on tab switch to allow inspector to stay active
        // Users can manually toggle off if needed
    }

    /**
     * Deactivate inspector mode
     */
    async deactivateInspector() {

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) return;

        chrome.tabs.sendMessage(tab.id, {
            action: 'DEACTIVATE_INSPECTOR'
        }).catch(err => {
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

        // Check if inspector toggle is enabled
        const toggle = document.getElementById('inspector-mode-toggle');
        if (!toggle || !toggle.checked) {
            return;
        }


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
        const savePageBtn = document.getElementById('save-page-btn');
        const syncBtn = document.getElementById('sync-btn');

        exportBtn.addEventListener('click', () => {
            this.exportBrandData();
        });

        savePageBtn.addEventListener('click', () => {
            this.saveCurrentPage();
        });

        syncBtn.addEventListener('click', async () => {
            const label = syncBtn.querySelector('.btn-label');

            // Route based on button state
            if (label && label.textContent === 'Generate Profile') {
                // Trigger profile generation
                await this.handleGenerateProfile();
            } else {
                // Open management page for ad copy generation
                this.openManagementPage();
            }
        });

        // Enable buttons if we have data
        this.updateActionButtons();

        // Setup event listeners for profile generation
        this.setupProfileGenerationListeners();
    }

    /**
     * Setup profile generation event listeners
     */
    setupProfileGenerationListeners() {
        // Listen for successful profile generation
        window.addEventListener('profileGenerationComplete', (event) => {
            this.handleProfileGenerationSuccess(event.detail.profile);
        });

        // Listen for failed profile generation
        window.addEventListener('profileGenerationFailed', (event) => {
            this.handleProfileGenerationError(event.detail.error);
        });
    }

    /**
     * Handle Generate Profile button click
     */
    async handleGenerateProfile() {
        const syncBtn = document.getElementById('sync-btn');
        if (!syncBtn) return;

        // Show loading state in button
        this.setButtonState(syncBtn, 'loading');

        // Trigger ProfileTab's generateProfile method
        if (this.profileTab) {
            await this.profileTab.generateProfile();
        }
    }

    /**
     * Handle successful profile generation
     */
    async handleProfileGenerationSuccess(profile) {
        const syncBtn = document.getElementById('sync-btn');
        if (!syncBtn) return;

        // Show success state
        this.setButtonState(syncBtn, 'success');

        // Wait 1.5 seconds, then switch to Profile tab
        setTimeout(async () => {
            // Switch to Profile tab
            this.switchToTab('profile');

            // Reset button styles before updating
            const label = syncBtn.querySelector('.btn-label');
            if (label) {
                label.style.color = '';
            }
            syncBtn.style.backgroundColor = '';

            // Update button to "Generate Ad Copy" state
            await this.updateActionButtons();
        }, 1500);
    }

    /**
     * Handle failed profile generation
     */
    handleProfileGenerationError(errorMessage) {
        const syncBtn = document.getElementById('sync-btn');
        if (!syncBtn) return;

        // Show error state
        this.setButtonState(syncBtn, 'error');
    }

    /**
     * Set button state (loading, success, error)
     */
    setButtonState(button, state) {
        const label = button.querySelector('.btn-label');
        if (!label) return;

        // Remove existing icons
        button.querySelectorAll('i, svg').forEach(el => el.remove());

        // Create icon element
        const icon = document.createElement('i');
        icon.className = 'btn-icon';
        button.insertBefore(icon, label);

        // Reset label color to white
        label.style.color = 'white';

        switch (state) {
            case 'loading':
                icon.setAttribute('data-lucide', 'loader-2');
                icon.style.animation = 'spin 1s linear infinite';
                icon.style.color = 'white';
                label.textContent = 'Generating...';
                button.style.backgroundColor = ''; // Keep default red
                button.disabled = true;
                break;

            case 'success':
                icon.setAttribute('data-lucide', 'check');
                icon.style.color = 'white';
                label.textContent = 'Success!';
                button.style.backgroundColor = '#22c55e'; // Green background
                button.disabled = true;
                break;

            case 'error':
                icon.setAttribute('data-lucide', 'alert-circle');
                icon.style.color = 'white';
                label.textContent = 'Failed - Retry?';
                button.style.backgroundColor = '#ef4444'; // Red background
                button.disabled = false;
                break;
        }

        // Re-initialize lucide icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Switch to a specific tab
     */
    switchToTab(tabName) {
        const navButtons = document.querySelectorAll('.tab-nav-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        // Update nav buttons
        navButtons.forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update tab contents
        tabContents.forEach(content => {
            if (content.id === `${tabName}-tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
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
     * Setup copy buttons with visual feedback
     */
    setupCopyButtons() {
        // Use event delegation for dynamically added buttons
        document.addEventListener('click', async (e) => {
            const copyBtn = e.target.closest('.copy-section-btn, .copy-all-btn, .page-copy-btn');
            if (!copyBtn) return;

            const section = copyBtn.dataset.section;
            let textToCopy = '';

            try {
                // Get content based on section
                if (section === 'colors') {
                    textToCopy = this.getColorsText();
                } else if (section === 'typography') {
                    textToCopy = this.getTypographyText();
                } else if (section === 'contact') {
                    textToCopy = this.getContactText();
                } else if (section === 'meta-image') {
                    textToCopy = this.getMetaImageURL();
                } else if (section === 'logos') {
                    textToCopy = this.getLogosText();
                } else if (copyBtn.id === 'copy-all-colors-btn') {
                    textToCopy = this.getAllColorsText();
                } else if (copyBtn.id === 'copy-all-fonts-btn') {
                    textToCopy = this.getAllFontsText();
                } else if (copyBtn.id === 'copy-all-assets-btn') {
                    textToCopy = this.getAllAssetsText();
                } else if (copyBtn.id === 'copy-all-pages-btn') {
                    textToCopy = this.getAllPagesText();
                } else if (copyBtn.classList.contains('page-copy-btn')) {
                    textToCopy = this.getPageCardText(copyBtn);
                }

                if (textToCopy && textToCopy.trim()) {
                    await navigator.clipboard.writeText(textToCopy);
                    this.showCopyFeedback(copyBtn);
                } else {
                    console.warn('No content to copy for section:', section || copyBtn.id);
                }
            } catch (error) {
                console.error('Failed to copy:', error);
                alert('Failed to copy to clipboard. Please try again.');
            }
        });
    }

    /**
     * Show visual feedback when copying
     */
    showCopyFeedback(button) {
        if (!button) return;

        // Find icon element (could be <i> or <svg> after Lucide initialization)
        let icon = button.querySelector('i');
        if (!icon) {
            icon = button.querySelector('svg');
        }

        let originalIcon = 'copy';
        if (icon) {
            originalIcon = icon.getAttribute('data-lucide') || 'copy';

            // Change icon to check
            icon.setAttribute('data-lucide', 'check');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        // Add success class for green animation
        button.classList.add('success-feedback');

        // Reset after 2 seconds
        setTimeout(() => {
            if (icon) {
                icon.setAttribute('data-lucide', originalIcon);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
            button.classList.remove('success-feedback');
        }, 2000);
    }

    /**
     * Get colors text from overview
     */
    getColorsText() {
        const colors = this.brandData.colors || [];
        return colors.map(c => c.hex).join('\n');
    }

    /**
     * Get all colors text
     */
    getAllColorsText() {
        const colors = this.brandData.colors || [];
        return colors.map(c => c.hex).join('\n');
    }

    /**
     * Get typography text
     */
    getTypographyText() {
        const display = document.getElementById('overview-display-font')?.textContent || '-';
        const body = document.getElementById('overview-body-font')?.textContent || '-';
        return `Display Font: ${display}\nBody Font: ${body}`;
    }

    /**
     * Get all fonts text
     */
    getAllFontsText() {
        const fonts = this.brandData.fonts || [];
        return fonts.map(f => f.family).join('\n');
    }

    /**
     * Get contact & social text
     */
    getContactText() {
        let text = '';
        const socialLinks = document.querySelectorAll('#overview-social-links a');
        const contactInfo = document.querySelectorAll('#overview-contact-info a');

        if (socialLinks.length > 0) {
            text += 'Social Media:\n';
            socialLinks.forEach(link => {
                text += `${link.textContent}: ${link.href}\n`;
            });
        }

        if (contactInfo.length > 0) {
            text += '\nContact:\n';
            contactInfo.forEach(link => {
                const cleanLink = link.href.replace('mailto:', '').replace('tel:', '');
                text += `${link.textContent}: ${cleanLink}\n`;
            });
        }

        return text || 'No contact information available';
    }

    /**
     * Get meta image URL
     */
    getMetaImageURL() {
        const metaImage = document.querySelector('#overview-meta-image img');
        return metaImage?.src || 'No meta image available';
    }

    /**
     * Get logos text
     */
    getLogosText() {
        let text = '';
        const logo = document.querySelector('#overview-logo img');
        const favicon = document.querySelector('#overview-favicon img');

        if (logo) text += `Logo: ${logo.src}\n`;
        if (favicon) text += `Favicon: ${favicon.src}`;

        return text || 'No logos available';
    }

    /**
     * Get all assets text
     */
    getAllAssetsText() {
        const assets = this.brandData.assets || [];
        return assets.map(a => a.url).join('\n');
    }

    /**
     * Get all pages text
     */
    getAllPagesText() {
        if (!this.pagesTab) {
            console.warn('PagesTab not initialized');
            return 'Pages tab not initialized';
        }
        return this.pagesTab.getAllPagesText();
    }

    /**
     * Get single page card text
     */
    getPageCardText(button) {
        if (!this.pagesTab) {
            console.warn('PagesTab not initialized');
            return 'Pages tab not initialized';
        }
        return this.pagesTab.getPageCardText(button);
    }

    /**
     * Setup header menu dropdown
     */
    setupHeaderMenu() {
        const menuBtn = document.getElementById('menu-btn');
        const menuDropdown = document.getElementById('menu-dropdown');
        const exportJsonBtn = document.getElementById('export-json-btn');

        // Toggle menu
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.classList.toggle('hidden');
        });

        // Close menu when clicking outside
        document.addEventListener('click', () => {
            menuDropdown.classList.add('hidden');
        });

        // Export JSON handler
        exportJsonBtn.addEventListener('click', () => {
            this.exportBrandDataAsJSON();
            menuDropdown.classList.add('hidden');
        });
    }

    /**
     * Reanalyze current page (manual trigger)
     */
    async reanalyzePage() {

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
    async updateActionButtons() {
        const hasData = this.brandData.colors.length > 0 ||
                       this.brandData.fonts.length > 0 ||
                       this.brandData.assets.length > 0;

        // Update Export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.disabled = !hasData;
        }

        // Get current tab for homepage detection
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const isHomepage = tab && tab.url ? new URL(tab.url).pathname === '/' : false;

        // Check if brand profile exists
        const currentDomain = await this.getCurrentDomain();
        const result = await chrome.storage.local.get(['brandProfiles']);
        const hasProfile = result.brandProfiles?.[currentDomain]?.profile;

        // Update Smart button (Generate Profile vs Generate Ad Copy)
        const syncBtn = document.getElementById('sync-btn');
        if (!syncBtn) return;

        const syncBtnLabel = syncBtn.querySelector('.btn-label');
        if (!syncBtnLabel) return;

        // Remove all existing icons (both <i> and <svg> elements)
        syncBtn.querySelectorAll('i, svg').forEach(el => el.remove());

        // Create fresh icon element
        const syncBtnIcon = document.createElement('i');
        syncBtnIcon.className = 'btn-icon';
        syncBtn.insertBefore(syncBtnIcon, syncBtnLabel);

        if (hasProfile) {
            syncBtnIcon.setAttribute('data-lucide', 'sparkles');
            syncBtnLabel.textContent = 'Generate Ad Copy';
            syncBtn.disabled = false;
        } else {
            syncBtnIcon.setAttribute('data-lucide', 'user');
            syncBtnLabel.textContent = 'Generate Profile';
            syncBtn.disabled = !hasData;
        }

        // Update Save Page button
        const savePageBtn = document.getElementById('save-page-btn');
        if (savePageBtn) {
            if (isHomepage) {
                savePageBtn.disabled = true;
                savePageBtn.title = 'Homepage already analyzed in brand profile';
            } else if (!hasProfile) {
                savePageBtn.disabled = true;
                savePageBtn.title = 'Generate a brand profile first';
            } else {
                savePageBtn.disabled = false;
                savePageBtn.title = 'Save current page';
            }
        }

        // Re-initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Get current domain
     */
    async getCurrentDomain() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.url) {
                const url = new URL(tab.url);
                return url.hostname;
            }
        } catch (error) {
            console.error('Failed to get current domain:', error);
        }
        return null;
    }

    /**
     * Open management page
     */
    async openManagementPage() {
        const currentDomain = await this.getCurrentDomain();
        const url = chrome.runtime.getURL('management/manage.html') +
                   (currentDomain ? `?domain=${encodeURIComponent(currentDomain)}` : '');

        chrome.tabs.create({ url });
    }

    /**
     * Save current page
     */
    async saveCurrentPage() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const saveBtn = document.getElementById('save-page-btn');

        // Check if homepage
        const url = new URL(tab.url);
        if (url.pathname === '/') {
            this.showNotification('Cannot save homepage - already analyzed in brand profile', 'error');
            return;
        }

        // Show loading state
        if (saveBtn) {
            saveBtn.classList.add('loading');
            const icon = saveBtn.querySelector('.btn-icon');
            if (icon) {
                icon.setAttribute('data-lucide', 'loader-2');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }

        // Ensure PagesTab has the current brand profile
        const currentDomain = await this.getCurrentDomain();
        if (currentDomain && this.pagesTab) {
            // Get the brand profile for this domain
            const result = await chrome.storage.local.get(['brandProfiles']);
            const brandProfiles = result.brandProfiles || {};
            const profileForDomain = brandProfiles[currentDomain];

            if (profileForDomain?.profile) {
                // Set the brand profile on PagesTab before saving
                // Use the actual profile ID from the database, not the domain
                const profileId = profileForDomain.profile.id;
                this.pagesTab.setBrandProfile(profileId, currentDomain);

                try {
                    await this.pagesTab.saveCurrentPage();

                    // Show success state
                    if (saveBtn) {
                        saveBtn.classList.remove('loading');
                        saveBtn.classList.add('success');
                        const icon = saveBtn.querySelector('.btn-icon');
                        if (icon) {
                            icon.setAttribute('data-lucide', 'check');
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                        }

                        // Reset after 2 seconds
                        setTimeout(() => {
                            saveBtn.classList.remove('success');
                            const icon = saveBtn.querySelector('.btn-icon');
                            if (icon) {
                                icon.setAttribute('data-lucide', 'file-plus');
                                if (typeof lucide !== 'undefined') lucide.createIcons();
                            }
                        }, 2000);
                    }
                } catch (error) {
                    // Reset loading state on error
                    if (saveBtn) {
                        saveBtn.classList.remove('loading');
                        const icon = saveBtn.querySelector('.btn-icon');
                        if (icon) {
                            icon.setAttribute('data-lucide', 'file-plus');
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                        }
                    }
                    throw error;
                }
            } else {
                // Reset loading state
                if (saveBtn) {
                    saveBtn.classList.remove('loading');
                    const icon = saveBtn.querySelector('.btn-icon');
                    if (icon) {
                        icon.setAttribute('data-lucide', 'file-plus');
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    }
                }
                this.showNotification('No brand profile loaded', 'error');
            }
        }
    }

    /**
     * Detect page type from URL
     */
    detectPageType(url) {
        const urlLower = url.toLowerCase();

        // Service patterns
        const servicePatterns = [
            '/service', '/services',
            '/what-we-do', '/solutions',
            '/consulting', '/expertise',
            '/capabilities'
        ];

        // Product patterns
        const productPatterns = [
            '/shop', '/store',
            '/product', '/products',
            '/collection', '/collections',
            '/catalog', '/buy'
        ];

        // Check service patterns
        for (const pattern of servicePatterns) {
            if (urlLower.includes(pattern)) {
                return 'service';
            }
        }

        // Check product patterns
        for (const pattern of productPatterns) {
            if (urlLower.includes(pattern)) {
                return 'product';
            }
        }

        // Default to service
        return 'service';
    }

    /**
     * Setup message listener for content script
     */
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

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

        // Check if we have any brand data to display
        if (!this.brandData || !this.brandData.colors ||
            (this.brandData.colors.length === 0 &&
             this.brandData.fonts.length === 0 &&
             this.brandData.assets.length === 0 &&
             !this.brandData.metadata?.title)) {
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
        // TODO: Implement toast notifications in future phase
    }

    /**
     * Export brand data
     */
    async exportBrandData() {

        const { metadata = {}, colors = [], fonts = [], assets = [] } = this.brandData;

        // Get domain from current tab if not in metadata
        let domain = metadata.domain || 'brand';

        // Check if brand profile exists
        const currentDomain = await this.getCurrentDomain();
        const result = await chrome.storage.local.get(['brandProfiles']);
        const brandProfile = result.brandProfiles?.[currentDomain]?.profile;

        let text = `Brand Overview\n${'='.repeat(50)}\n\n`;

        // Metadata
        text += `Domain: ${metadata.domain || metadata.url || 'N/A'}\n`;
        text += `Page Title: ${metadata.pageTitle || metadata.title || 'N/A'}\n`;
        if (metadata.tagline) {
            text += `Tagline: ${metadata.tagline}\n`;
        }
        if (metadata.description) {
            text += `Description: ${metadata.description}\n`;
        }
        text += '\n';

        // ========== FULL BRAND PROFILE (if exists) ==========
        if (brandProfile) {
            text += `\n${'='.repeat(50)}\n`;
            text += `FULL BRAND PROFILE\n`;
            text += `${'='.repeat(50)}\n\n`;

            // Brand Identity
            if (brandProfile.brand) {
                text += `Brand Identity\n${'-'.repeat(50)}\n`;
                if (brandProfile.brand.name) text += `Name: ${brandProfile.brand.name}\n`;
                if (brandProfile.brand.tagline) text += `Tagline: ${brandProfile.brand.tagline}\n`;
                if (brandProfile.brand.positioning) text += `Positioning: ${brandProfile.brand.positioning}\n`;
                text += '\n';
            }

            // Voice & Tone
            if (brandProfile.voice) {
                text += `Voice & Tone\n${'-'.repeat(50)}\n`;

                if (brandProfile.voice.personality && brandProfile.voice.personality.length > 0) {
                    text += `Personality Traits: ${brandProfile.voice.personality.join(', ')}\n`;
                }

                if (brandProfile.voice.toneSliders) {
                    text += `Tone:\n`;
                    text += `  - Formal: ${brandProfile.voice.toneSliders.formal}/100\n`;
                    text += `  - Playful: ${brandProfile.voice.toneSliders.playful}/100\n`;
                    text += `  - Respectful: ${brandProfile.voice.toneSliders.respectful}/100\n`;
                    text += `  - Enthusiastic: ${brandProfile.voice.toneSliders.enthusiastic}/100\n`;
                }

                if (brandProfile.voice.lexicon) {
                    if (brandProfile.voice.lexicon.preferred && brandProfile.voice.lexicon.preferred.length > 0) {
                        text += `Preferred Phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}\n`;
                    }
                    if (brandProfile.voice.lexicon.avoid && brandProfile.voice.lexicon.avoid.length > 0) {
                        text += `Avoid: ${brandProfile.voice.lexicon.avoid.join(', ')}\n`;
                    }
                }
                text += '\n';
            }

            // Target Audience
            if (brandProfile.audience) {
                text += `Target Audience\n${'-'.repeat(50)}\n`;
                if (brandProfile.audience.primary) text += `Primary: ${brandProfile.audience.primary}\n`;
                if (brandProfile.audience.secondary) text += `Secondary: ${brandProfile.audience.secondary}\n`;

                if (brandProfile.audience.painPoints && brandProfile.audience.painPoints.length > 0) {
                    text += `Pain Points:\n`;
                    brandProfile.audience.painPoints.forEach(p => text += `  • ${p}\n`);
                }

                if (brandProfile.audience.needs && brandProfile.audience.needs.length > 0) {
                    text += `Needs:\n`;
                    brandProfile.audience.needs.forEach(n => text += `  • ${n}\n`);
                }

                if (brandProfile.audience.goals && brandProfile.audience.goals.length > 0) {
                    text += `Goals:\n`;
                    brandProfile.audience.goals.forEach(g => text += `  • ${g}\n`);
                }
                text += '\n';
            }

            text += `${'='.repeat(50)}\n\n`;
        }

        // Colors
        if (colors.length > 0) {
            text += `Colors (${colors.length})\n${'-'.repeat(50)}\n`;
            colors.forEach((color, i) => {
                text += `${i + 1}. ${color.hex || color}`;
                if (color.name) text += ` - ${color.name}`;
                if (color.source) text += ` (from ${color.source})`;
                text += `\n`;
            });
            text += '\n';
        }

        // Fonts / Typography
        if (fonts.length > 0) {
            text += `Typography (${fonts.length})\n${'-'.repeat(50)}\n`;
            fonts.forEach((font, i) => {
                text += `${i + 1}. ${font.family || font.name || font}`;
                if (font.category) text += ` (${font.category})`;
                if (font.weight) text += ` - Weight: ${font.weight}`;
                if (font.size) text += ` - Size: ${font.size}`;
                text += `\n`;
            });
            text += '\n';
        }

        // Assets (Logos, Images)
        if (assets.length > 0) {
            text += `Assets (${assets.length})\n${'-'.repeat(50)}\n`;
            assets.forEach((asset, i) => {
                const type = asset.type || 'Image';
                const src = asset.src || asset.url || asset;
                text += `${i + 1}. ${type}: ${src}\n`;
                if (asset.alt) text += `   Alt text: ${asset.alt}\n`;
            });
            text += '\n';
        }

        const blob = new Blob([text.trim()], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const fileName = brandProfile
            ? `brand-profile-${domain.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.txt`
            : `brand-overview-${domain.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.txt`;
        a.download = fileName;
        a.click();

        URL.revokeObjectURL(url);

        const message = brandProfile ? 'Full brand profile exported' : 'Brand overview exported';
        this.showNotification(message, 'success');
    }

    exportBrandDataAsJSON() {

        const dataStr = JSON.stringify(this.brandData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `brand-data-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);

        this.showNotification('Brand data exported as JSON', 'success');
    }

    /**
     * Sync to web app
     */
    async syncToWebApp() {
        this.updateStatus('Syncing...', 'syncing');

        // TODO: Implement web app integration in Phase 6

        setTimeout(() => {
            this.updateStatus('Ready', 'ready');
            this.showNotification('Sync not implemented yet', 'error');
        }, 1000);
    }

    /**
     * Save state to Chrome storage (per-tab brand data)
     */
    async saveState() {
        try {
            // Get the currently active tab
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!activeTab?.id) {
                console.warn('No active tab, skipping save');
                return;
            }

            // Load existing per-tab data
            const result = await chrome.storage.local.get(['brandDataByTab']);
            const brandDataByTab = result.brandDataByTab || {};

            // Update data for the current tab (exclude assets to save storage)
            brandDataByTab[activeTab.id] = {
                colors: this.brandData.colors || [],
                fonts: this.brandData.fonts || [],
                // assets: excluded - images are heavy (~500KB-2MB per tab)
                // Assets will re-extract automatically when tab is revisited
                textSnippets: this.brandData.textSnippets || [],
                metadata: this.brandData.metadata || {}
            };

            await chrome.storage.local.set({
                brandDataByTab,
                currentTab: this.currentTab
            });
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    }

    /**
     * Load state from Chrome storage (per-tab brand data)
     */
    async loadState() {
        try {
            // Get the currently active tab
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const result = await chrome.storage.local.get(['brandDataByTab', 'brandData', 'currentTab']);

            // Migration: Convert old global brandData to per-tab format
            if (result.brandData && !result.brandDataByTab && activeTab?.id) {
                const brandDataByTab = {
                    [activeTab.id]: result.brandData
                };
                await chrome.storage.local.set({ brandDataByTab });
                await chrome.storage.local.remove(['brandData']); // Clean up old format
                result.brandDataByTab = brandDataByTab;
            }

            // Load brand data for the active tab (or keep default empty structure)
            if (activeTab?.id && result.brandDataByTab?.[activeTab.id]) {
                const cachedData = result.brandDataByTab[activeTab.id];

                // Merge cached data with current brandData structure
                // Note: assets are not cached (too heavy), so they'll be empty until re-extraction
                this.brandData = {
                    colors: cachedData.colors || [],
                    fonts: cachedData.fonts || [],
                    assets: [],  // Always empty - will re-extract automatically
                    textSnippets: cachedData.textSnippets || [],
                    metadata: cachedData.metadata || {}
                };

            } else {
                // No cached data for this tab yet - extraction will populate it
            }

            // Always update UI (will show empty state if no data)
            this.updateOverviewTab();
            this.updateColorsTab();   // Update colors from cache
            this.updateFontsTab();    // Update fonts from cache
            this.updateAssetsTab();   // Update assets (will be empty until re-extraction)
            this.updateActionButtons();

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
