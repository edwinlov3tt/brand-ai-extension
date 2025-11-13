/**
 * Profile Tab Component
 * Manages brand profile display and ad copy generation
 */

class ProfileTab {
    constructor(workerUrl = 'https://brand-inspector-worker.edwin-6f1.workers.dev') {
        this.workerUrl = workerUrl;
        this.brandProfile = null;
        this.adCopies = [];
        this.init();
    }

    /**
     * Initialize Profile tab
     */
    init() {
        this.setupProfileControls();
        this.loadCachedProfile();
        this.setupUrlChangeListener();
    }

    /**
     * Listen for URL changes and reload profile for new domain
     */
    setupUrlChangeListener() {
        // Listen for tab updates
        chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
            // Only handle URL changes on the active tab
            if (changeInfo.url && tab.active) {
                try {
                    const newDomain = new URL(changeInfo.url).hostname;
                    const currentDomain = this.brandProfile?.metadata?.domain;

                    // If domain changed, reset and reload
                    if (newDomain !== currentDomain) {
                        console.log('Domain changed from', currentDomain, 'to', newDomain);
                        this.brandProfile = null;
                        this.adCopies = [];
                        await this.loadCachedProfile();
                    }
                } catch (error) {
                    console.error('Error handling URL change:', error);
                }
            }
        });

        // Also listen for tab activation (switching between tabs)
        chrome.tabs.onActivated.addListener(async (activeInfo) => {
            try {
                const tab = await chrome.tabs.get(activeInfo.tabId);
                if (tab.url) {
                    const newDomain = new URL(tab.url).hostname;
                    const currentDomain = this.brandProfile?.metadata?.domain;

                    if (newDomain !== currentDomain) {
                        console.log('Switched to tab with different domain:', newDomain);
                        this.brandProfile = null;
                        this.adCopies = [];
                        await this.loadCachedProfile();
                    }
                }
            } catch (error) {
                console.error('Error handling tab activation:', error);
            }
        });
    }

    /**
     * Setup profile tab controls
     */
    setupProfileControls() {
        const profileTab = document.getElementById('profile-tab');
        if (!profileTab) return;

        // Check if controls already exist
        if (profileTab.querySelector('.profile-container')) return;

        // Create main container
        const container = document.createElement('div');
        container.className = 'profile-container';
        container.innerHTML = `
            <div class="profile-empty-state" id="profile-empty-state">
                <i data-lucide="user-circle" class="empty-icon"></i>
                <h2>No Brand Profile Yet</h2>
                <p>Generate a brand profile from the current page to start creating AI-powered ad copy.</p>
                <button class="btn-primary" id="generate-profile-btn">
                    <i data-lucide="sparkles"></i>
                    Generate Brand Profile
                </button>
            </div>

            <div class="profile-content hidden" id="profile-content">
                <!-- Tab Navigation -->
                <div class="profile-tabs">
                    <button class="tab-btn active" id="profile-tab-btn" data-tab="profile">
                        <i data-lucide="user"></i>
                        Brand Profile
                    </button>
                    <button class="tab-btn disabled" id="adcopy-tab-btn" data-tab="adcopy">
                        <i data-lucide="sparkles"></i>
                        Ad Copy
                    </button>
                </div>

                <!-- Profile Tab Content -->
                <div class="tab-content active" id="profile-tab-content">
                    <div class="profile-display" id="profile-display"></div>
                </div>

                <!-- Ad Copy Tab Content -->
                <div class="tab-content hidden" id="adcopy-tab-content">
                    <!-- Ad Copy Generator -->
                    <div class="ad-copy-generator" id="ad-copy-generator">
                        <h3 class="section-title">Generate Ad Copy</h3>
                        <div class="generator-form">
                            <div class="form-group">
                                <label for="tactic-select">Tactic</label>
                                <select id="tactic-select" class="form-select">
                                    <option value="">Select tactic...</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="campaign-objective">Campaign Objective</label>
                                <input type="text" id="campaign-objective" class="form-input" placeholder="E.g., Increase demo signups">
                            </div>
                            <div class="form-group">
                                <label for="variations-select">Variations</label>
                                <select id="variations-select" class="form-select">
                                    <option value="3">3 variations</option>
                                    <option value="5">5 variations</option>
                                </select>
                            </div>
                            <button class="btn-primary" id="generate-ad-btn">
                                <i data-lucide="wand-2"></i>
                                Generate Ad Copy
                            </button>
                        </div>
                    </div>

                    <!-- Ad Copy Results -->
                    <div class="ad-copy-results hidden" id="ad-copy-results">
                        <h3 class="section-title">Generated Ad Copy</h3>
                        <div class="ad-copy-list" id="ad-copy-list"></div>
                    </div>

                    <!-- Open Full Management Page -->
                    <div class="management-page-link">
                        <button class="btn-secondary" id="open-management-page-btn">
                            <i data-lucide="external-link"></i>
                            View All Brands & Ad Copy
                        </button>
                    </div>
                </div>
            </div>

            <div class="profile-loading hidden" id="profile-loading">
                <div class="loading-spinner"></div>
                <p>Analyzing page content...</p>
            </div>
        `;

        // Remove existing empty state
        const existingEmptyState = profileTab.querySelector('.empty-state');
        if (existingEmptyState) existingEmptyState.remove();

        profileTab.appendChild(container);

        // Setup event listeners
        this.setupEventListeners();

        // Load tactics
        this.loadTactics();

        // Initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Generate profile button
        const generateBtn = document.getElementById('generate-profile-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateProfile());
        }

        // Tab switching buttons
        const profileTabBtn = document.getElementById('profile-tab-btn');
        const adcopyTabBtn = document.getElementById('adcopy-tab-btn');

        if (profileTabBtn) {
            profileTabBtn.addEventListener('click', () => this.switchTab('profile'));
        }

        if (adcopyTabBtn) {
            adcopyTabBtn.addEventListener('click', () => {
                if (!adcopyTabBtn.classList.contains('disabled')) {
                    this.switchTab('adcopy');
                }
            });
        }

        // Generate ad copy button
        const generateAdBtn = document.getElementById('generate-ad-btn');
        if (generateAdBtn) {
            generateAdBtn.addEventListener('click', () => this.generateAdCopy());
        }

        // Open management page button
        const openMgmtPageBtn = document.getElementById('open-management-page-btn');
        if (openMgmtPageBtn) {
            openMgmtPageBtn.addEventListener('click', () => this.openManagementPage());
        }
    }

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        // Update tab buttons
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update tab content
        const profileContent = document.getElementById('profile-tab-content');
        const adcopyContent = document.getElementById('adcopy-tab-content');

        if (tabName === 'profile') {
            profileContent.classList.remove('hidden');
            profileContent.classList.add('active');
            adcopyContent.classList.add('hidden');
            adcopyContent.classList.remove('active');
        } else if (tabName === 'adcopy') {
            adcopyContent.classList.remove('hidden');
            adcopyContent.classList.add('active');
            profileContent.classList.add('hidden');
            profileContent.classList.remove('active');
        }

        // Refresh icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Get current tab domain
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
     * Load cached profile from chrome.storage
     */
    async loadCachedProfile() {
        try {
            // Get current domain
            const currentDomain = await this.getCurrentDomain();
            if (!currentDomain) {
                console.log('No current domain, showing empty state');
                this.renderProfile();
                return;
            }

            console.log('Loading profile for domain:', currentDomain);

            // Check chrome.storage for this specific domain
            const result = await chrome.storage.local.get(['brandProfiles']);
            const brandProfiles = result.brandProfiles || {};
            const profileForDomain = brandProfiles[currentDomain];

            if (profileForDomain?.profile) {
                // Load existing profile for this domain
                console.log('Found cached profile for domain:', currentDomain);
                this.brandProfile = profileForDomain.profile;
                this.adCopies = profileForDomain.adCopies || [];
                this.renderProfile();
                return;
            }

            // No local cache - check Worker API for saved profile
            try {
                console.log('Checking Worker API for profile...');
                const response = await fetch(`${this.workerUrl}/api/brand-profile/${currentDomain}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.metadata) {
                        // Found in database, cache it locally
                        console.log('Found profile in Worker API:', currentDomain);
                        await this.saveBrandProfile(data, currentDomain);
                        this.brandProfile = data;
                        this.renderProfile();
                        return;
                    }
                }
            } catch (error) {
                console.log('No profile found in database for:', currentDomain);
            }

            // No profile exists - show empty state
            console.log('No profile found, showing empty state');
            this.brandProfile = null;
            this.adCopies = [];
            this.renderProfile();
        } catch (error) {
            console.error('Failed to load cached profile:', error);
            this.renderProfile();
        }
    }

    /**
     * Generate brand profile
     */
    async generateProfile() {
        console.log('Generating brand profile...');

        // Show loading state
        this.showLoading();

        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error('No active tab');

            // Send message to content script to extract page content
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'EXTRACT_PAGE_CONTENT_FOR_PROFILE'
            });

            if (!response || !response.content) {
                throw new Error('Failed to extract page content');
            }

            // Send to Worker API
            const apiResponse = await fetch(`${this.workerUrl}/api/brand-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(response.content)
            });

            if (!apiResponse.ok) {
                const error = await apiResponse.text();
                throw new Error(`API error: ${error}`);
            }

            const brandProfile = await apiResponse.json();

            // Save to chrome.storage
            await this.saveBrandProfile(brandProfile);

            // Display profile
            this.brandProfile = brandProfile;
            this.renderProfile();

            this.hideLoading();

        } catch (error) {
            console.error('Failed to generate profile:', error);
            alert(`Failed to generate brand profile: ${error.message}`);
            this.hideLoading();
        }
    }

    /**
     * Save brand profile to chrome.storage (domain-keyed)
     */
    async saveBrandProfile(profile, domain = null) {
        try {
            // Get domain from profile metadata or parameter
            const profileDomain = domain || profile.metadata?.domain || await this.getCurrentDomain();

            if (!profileDomain) {
                console.error('Cannot save profile without domain');
                return;
            }

            console.log('Saving profile for domain:', profileDomain);

            // Get existing profiles
            const result = await chrome.storage.local.get(['brandProfiles']);
            const brandProfiles = result.brandProfiles || {};

            // Save/update profile for this domain
            brandProfiles[profileDomain] = {
                profile,
                metadata: {
                    domain: profileDomain,
                    lastUpdated: Date.now()
                },
                adCopies: brandProfiles[profileDomain]?.adCopies || []
            };

            await chrome.storage.local.set({ brandProfiles });
            console.log('Profile saved successfully for:', profileDomain);
        } catch (error) {
            console.error('Failed to save profile:', error);
        }
    }

    /**
     * Render brand profile
     */
    renderProfile() {
        const emptyState = document.getElementById('profile-empty-state');
        const content = document.getElementById('profile-content');
        const display = document.getElementById('profile-display');

        if (!this.brandProfile) {
            emptyState.classList.remove('hidden');
            content.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        content.classList.remove('hidden');

        const { brand, voice, audience, writingGuide } = this.brandProfile;

        display.innerHTML = `
            <div class="brand-header">
                <h2 class="brand-name">${brand.name || 'Unknown Brand'}</h2>
                ${brand.tagline ? `<p class="brand-tagline">"${brand.tagline}"</p>` : ''}
            </div>

            <div class="profile-sections">
                <div class="profile-section">
                    <h3 class="profile-section-title">
                        <i data-lucide="info" class="icon-sm"></i>
                        Brand Identity
                    </h3>
                    <div class="profile-section-content">
                        ${brand.story ? `<p><strong>Story:</strong> ${brand.story}</p>` : ''}
                        ${brand.mission ? `<p><strong>Mission:</strong> ${brand.mission}</p>` : ''}
                        ${brand.positioning ? `<p><strong>Positioning:</strong> ${brand.positioning}</p>` : ''}
                        ${brand.valueProps && brand.valueProps.length > 0 ? `
                            <p><strong>Value Propositions:</strong></p>
                            <ul>${brand.valueProps.map(vp => `<li>${vp}</li>`).join('')}</ul>
                        ` : ''}
                    </div>
                </div>

                <div class="profile-section">
                    <h3 class="profile-section-title">
                        <i data-lucide="mic" class="icon-sm"></i>
                        Voice & Tone
                    </h3>
                    <div class="profile-section-content">
                        ${voice.personality && voice.personality.length > 0 ? `
                            <div class="personality-tags">
                                ${voice.personality.map(trait => `<span class="personality-tag">${trait}</span>`).join('')}
                            </div>
                        ` : ''}
                        ${voice.toneSliders ? `
                            <div class="tone-sliders">
                                <div class="tone-slider">
                                    <span>Formal</span>
                                    <div class="slider-bar"><div class="slider-fill" style="width: ${voice.toneSliders.formal}%"></div></div>
                                    <span>${voice.toneSliders.formal}</span>
                                </div>
                                <div class="tone-slider">
                                    <span>Playful</span>
                                    <div class="slider-bar"><div class="slider-fill" style="width: ${voice.toneSliders.playful}%"></div></div>
                                    <span>${voice.toneSliders.playful}</span>
                                </div>
                                <div class="tone-slider">
                                    <span>Premium</span>
                                    <div class="slider-bar"><div class="slider-fill" style="width: ${voice.toneSliders.premium}%"></div></div>
                                    <span>${voice.toneSliders.premium}</span>
                                </div>
                            </div>
                        ` : ''}
                        ${voice.lexicon?.preferred && voice.lexicon.preferred.length > 0 ? `
                            <div class="preferred-phrases">
                                <strong>Preferred Phrases</strong>
                                <div class="phrase-tags">
                                    ${voice.lexicon.preferred.slice(0, 6).map(phrase => `<span class="phrase-tag">${phrase}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="profile-section">
                    <h3 class="profile-section-title">
                        <i data-lucide="users" class="icon-sm"></i>
                        Target Audience
                    </h3>
                    <div class="profile-section-content">
                        ${audience.primary ? `<p><strong>Primary:</strong> ${audience.primary}</p>` : ''}
                        ${audience.needs && audience.needs.length > 0 ? `
                            <p><strong>Needs:</strong></p>
                            <ul>${audience.needs.map(need => `<li>${need}</li>`).join('')}</ul>
                        ` : ''}
                        ${audience.painPoints && audience.painPoints.length > 0 ? `
                            <p><strong>Pain Points:</strong></p>
                            <ul>${audience.painPoints.map(pain => `<li>${pain}</li>`).join('')}</ul>
                        ` : ''}
                    </div>
                </div>
            </div>

            <div class="profile-actions">
                <button class="btn-secondary" id="regenerate-profile-btn">
                    <i data-lucide="refresh-cw" class="btn-icon"></i>
                    Re-generate
                </button>
            </div>
        `;

        // Re-initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Setup regenerate button
        const regenerateBtn = document.getElementById('regenerate-profile-btn');
        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', () => this.generateProfile());
        }

        // Enable Ad Copy tab now that profile is generated
        const adcopyTabBtn = document.getElementById('adcopy-tab-btn');
        if (adcopyTabBtn) {
            adcopyTabBtn.classList.remove('disabled');
        }
    }

    /**
     * Load available tactics from Worker
     */
    async loadTactics() {
        try {
            const response = await fetch(`${this.workerUrl}/api/tactics`);
            if (!response.ok) throw new Error('Failed to load tactics');

            const data = await response.json();
            const select = document.getElementById('tactic-select');

            if (!select) return;

            // Clear existing options except first
            select.innerHTML = '<option value="">Select tactic...</option>';

            // Add tactics
            data.tactics.forEach(tactic => {
                const option = document.createElement('option');
                option.value = tactic.id;
                option.textContent = `${tactic.name} (${tactic.maxChars} chars, ${tactic.maxWords} words)`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load tactics:', error);
        }
    }

    /**
     * Generate ad copy
     */
    async generateAdCopy() {
        const tactic = document.getElementById('tactic-select').value;
        const objective = document.getElementById('campaign-objective').value;
        const variations = parseInt(document.getElementById('variations-select').value);

        if (!tactic || !objective) {
            alert('Please select a tactic and enter a campaign objective');
            return;
        }

        if (!this.brandProfile) {
            alert('Please generate a brand profile first');
            return;
        }

        // Show loading
        const generateBtn = document.getElementById('generate-ad-btn');
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<div class="loading-spinner-sm"></div> Generating...';

        try {
            const response = await fetch(`${this.workerUrl}/api/generate-ad-copy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: this.brandProfile.metadata?.domain,
                    tactic,
                    campaignObjective: objective,
                    variations
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API error: ${error}`);
            }

            const data = await response.json();

            // Save to chrome.storage
            await this.saveAdCopies(data.adCopies);

            // Display results
            this.renderAdCopyResults(data.adCopies);

        } catch (error) {
            console.error('Failed to generate ad copy:', error);
            alert(`Failed to generate ad copy: ${error.message}`);
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i data-lucide="wand-2" class="btn-icon"></i> Generate Ad Copy';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    /**
     * Save ad copies to chrome.storage (domain-keyed)
     */
    async saveAdCopies(newCopies) {
        try {
            const currentDomain = await this.getCurrentDomain();
            if (!currentDomain) {
                console.error('Cannot save ad copies without domain');
                return;
            }

            const result = await chrome.storage.local.get(['brandProfiles']);
            const brandProfiles = result.brandProfiles || {};

            if (!brandProfiles[currentDomain]) {
                console.error('No profile found for domain:', currentDomain);
                return;
            }

            // Add new copies to the beginning, keep last 20
            brandProfiles[currentDomain].adCopies = brandProfiles[currentDomain].adCopies || [];
            brandProfiles[currentDomain].adCopies = [...newCopies, ...brandProfiles[currentDomain].adCopies].slice(0, 20);

            await chrome.storage.local.set({ brandProfiles });
            console.log('Ad copies saved for domain:', currentDomain);

            this.adCopies = brandProfiles[currentDomain].adCopies;
            this.renderRecentAdCopies();
        } catch (error) {
            console.error('Failed to save ad copies:', error);
        }
    }

    /**
     * Render ad copy results
     */
    renderAdCopyResults(copies) {
        const resultsContainer = document.getElementById('ad-copy-results');
        const list = document.getElementById('ad-copy-list');

        resultsContainer.classList.remove('hidden');

        list.innerHTML = copies.map(copy => `
            <div class="ad-copy-card">
                <div class="ad-copy-header">
                    <span class="ad-copy-tactic">${copy.tactic.replace('_', ' ')}</span>
                    <div class="ad-copy-actions">
                        <button class="icon-btn copy-btn" data-copy="${copy.text}" title="Copy to clipboard">
                            <i data-lucide="copy" class="icon-sm"></i>
                        </button>
                    </div>
                </div>
                <div class="ad-copy-text">${copy.text}</div>
                <div class="ad-copy-meta">
                    <span>Characters: ${copy.charCount}</span>
                    <span>Words: ${copy.wordCount}</span>
                </div>
            </div>
        `).join('');

        // Setup copy buttons
        list.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.dataset.copy;
                navigator.clipboard.writeText(text);
                btn.innerHTML = '<i data-lucide="check" class="icon-sm"></i>';
                setTimeout(() => {
                    btn.innerHTML = '<i data-lucide="copy" class="icon-sm"></i>';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }, 1500);
            });
        });

        // Re-initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Render recent ad copies
     */
    renderRecentAdCopies() {
        if (!this.adCopies || this.adCopies.length === 0) return;

        const container = document.getElementById('recent-ad-copy');
        const list = document.getElementById('recent-ad-copy-list');

        container.classList.remove('hidden');

        list.innerHTML = this.adCopies.slice(0, 5).map(copy => `
            <div class="ad-copy-card-compact">
                <div class="ad-copy-text">${copy.text}</div>
                <div class="ad-copy-meta-compact">
                    <span>${copy.charCount} chars</span>
                    <span>${copy.wordCount} words</span>
                    <button class="icon-btn-sm copy-btn" data-copy="${copy.text}">
                        <i data-lucide="copy" class="icon-xs"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Setup copy buttons
        list.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.dataset.copy;
                navigator.clipboard.writeText(text);
            });
        });

        // Re-initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Show loading state
     */
    showLoading() {
        document.getElementById('profile-empty-state').classList.add('hidden');
        document.getElementById('profile-content').classList.add('hidden');
        document.getElementById('profile-loading').classList.remove('hidden');
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        document.getElementById('profile-loading').classList.add('hidden');
    }

    /**
     * Open full-width management page
     */
    openManagementPage() {
        const url = chrome.runtime.getURL('management/manage.html');
        chrome.tabs.create({ url });
    }
}

// Export for use in sidepanel
if (typeof window !== 'undefined') {
    window.ProfileTab = ProfileTab;
}
