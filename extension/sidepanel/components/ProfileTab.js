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
                <!-- Brand Profile Display -->
                <div class="profile-display" id="profile-display"></div>
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
                this.renderProfile();
                return;
            }


            // Check chrome.storage for this specific domain
            const result = await chrome.storage.local.get(['brandProfiles']);
            const brandProfiles = result.brandProfiles || {};
            const profileForDomain = brandProfiles[currentDomain];

            if (profileForDomain?.profile) {
                // Load existing profile for this domain
                this.brandProfile = profileForDomain.profile;
                this.adCopies = profileForDomain.adCopies || [];
                this.renderProfile();
                return;
            }

            // No local cache - check Worker API for saved profile
            try {
                const response = await fetch(`${this.workerUrl}/api/brand-profile/${currentDomain}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.metadata) {
                        // Found in database, cache it locally
                        await this.saveBrandProfile(data, currentDomain);
                        this.brandProfile = data;
                        this.renderProfile();
                        return;
                    }
                }
            } catch (error) {
            }

            // No profile exists - show empty state
            this.brandProfile = null;
            this.adCopies = [];
            this.renderProfile();
        } catch (error) {
            console.error('Failed to load cached profile:', error);
            this.renderProfile();
        }
    }

    /**
     * Wait for content script to be ready
     */
    async waitForContentScript(tabId, maxAttempts = 5) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                await chrome.tabs.sendMessage(tabId, { action: 'ping' });
                return true;
            } catch (error) {
                if (i < maxAttempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }
        return false;
    }

    /**
     * Generate brand profile
     */
    async generateProfile() {

        // Show loading state
        this.showLoading();

        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error('No active tab');

            // Wait for content script to be ready
            const isReady = await this.waitForContentScript(tab.id);
            if (!isReady) {
                throw new Error('Content script not ready. Please refresh the page and try again.');
            }

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

            // Refresh profile display from cache
            await this.loadCachedProfile();

            this.hideLoading();

            // Dispatch success event for footer button to handle
            window.dispatchEvent(new CustomEvent('profileGenerationComplete', {
                detail: { profile: brandProfile }
            }));

        } catch (error) {
            console.error('Failed to generate profile:', error);
            this.hideLoading();

            // Dispatch error event for footer button to handle
            window.dispatchEvent(new CustomEvent('profileGenerationFailed', {
                detail: { error: error.message }
            }));
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
            // Notify that profile was cleared
            window.dispatchEvent(new CustomEvent('brandProfileLoaded', {
                detail: { id: null, domain: null }
            }));
            return;
        }

        emptyState.classList.add('hidden');
        content.classList.remove('hidden');

        // Notify that profile was loaded
        const profileId = this.brandProfile.id;
        const profileDomain = this.brandProfile.metadata?.domain;
        window.dispatchEvent(new CustomEvent('brandProfileLoaded', {
            detail: {
                id: profileId,
                domain: profileDomain
            }
        }));

        const { brand, voice, audience, writingGuide } = this.brandProfile;

        display.innerHTML = `
            <div class="brand-header">
                <h2 class="brand-name">${brand.name || 'Unknown Brand'}</h2>
                ${brand.tagline ? `<p class="brand-tagline">"${brand.tagline}"</p>` : ''}
            </div>

            <div class="profile-sections">
                <div class="profile-section" data-section="brand-identity">
                    <h3 class="profile-section-title">
                        <i data-lucide="info" class="icon-sm"></i>
                        <span>Brand Identity</span>
                        <button class="copy-section-btn" data-section="brand-identity" title="Copy this section">
                            <i data-lucide="copy" class="icon-xs"></i>
                        </button>
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

                <div class="profile-section" data-section="voice-tone">
                    <h3 class="profile-section-title">
                        <i data-lucide="mic" class="icon-sm"></i>
                        <span>Voice & Tone</span>
                        <button class="copy-section-btn" data-section="voice-tone" title="Copy this section">
                            <i data-lucide="copy" class="icon-xs"></i>
                        </button>
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

                <div class="profile-section" data-section="target-audience">
                    <h3 class="profile-section-title">
                        <i data-lucide="users" class="icon-sm"></i>
                        <span>Target Audience</span>
                        <button class="copy-section-btn" data-section="target-audience" title="Copy this section">
                            <i data-lucide="copy" class="icon-xs"></i>
                        </button>
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
                <button class="btn-secondary" id="copy-all-btn" title="Copy entire profile">
                    <i data-lucide="copy" class="btn-icon"></i>
                    <span class="btn-label">Copy All</span>
                </button>
                <button class="btn-secondary" id="export-profile-btn" title="Export profile as TXT">
                    <i data-lucide="download" class="btn-icon"></i>
                    <span class="btn-label">Export</span>
                </button>
                <button class="btn-secondary" id="regenerate-profile-btn">
                    <i data-lucide="refresh-cw" class="btn-icon"></i>
                    <span class="btn-label">Re-generate</span>
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

        // Setup copy all button
        const copyAllBtn = document.getElementById('copy-all-btn');
        if (copyAllBtn) {
            copyAllBtn.addEventListener('click', () => this.copyAllProfile());
        }

        // Setup export button
        const exportBtn = document.getElementById('export-profile-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportProfile());
        }

        // Setup individual section copy buttons (only within profile tab)
        const profileTab = document.getElementById('profile-tab');
        if (profileTab) {
            profileTab.querySelectorAll('.copy-section-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const sectionName = btn.dataset.section;
                    this.copySection(sectionName);
                });
            });
        }
    }

    /**
     * Copy individual section to clipboard
     */
    copySection(sectionName) {
        const section = document.querySelector(`[data-section="${sectionName}"]`);
        if (!section) return;

        const title = section.querySelector('.profile-section-title span').textContent;
        const content = section.querySelector('.profile-section-content');
        const text = this.extractTextContent(content);

        const formattedText = `${title}\n${'='.repeat(title.length)}\n\n${text}`;

        navigator.clipboard.writeText(formattedText).then(() => {
            this.showCopyFeedback(section.querySelector('.copy-section-btn'));
        });
    }

    /**
     * Copy all profile sections to clipboard
     */
    copyAllProfile() {
        const { brand, voice, audience } = this.brandProfile;

        let text = `${brand.name || 'Brand Profile'}\n${'='.repeat((brand.name || 'Brand Profile').length)}\n\n`;

        if (brand.tagline) {
            text += `"${brand.tagline}"\n\n`;
        }

        // Brand Identity
        text += `Brand Identity\n${'='.repeat(15)}\n\n`;
        if (brand.story) text += `Story:\n${brand.story}\n\n`;
        if (brand.mission) text += `Mission:\n${brand.mission}\n\n`;
        if (brand.positioning) text += `Positioning:\n${brand.positioning}\n\n`;
        if (brand.valueProps && brand.valueProps.length > 0) {
            text += `Value Propositions:\n${brand.valueProps.map(vp => `• ${vp}`).join('\n')}\n\n`;
        }

        // Voice & Tone
        text += `Voice & Tone\n${'='.repeat(13)}\n\n`;
        if (voice.personality && voice.personality.length > 0) {
            text += `Personality: ${voice.personality.join(', ')}\n\n`;
        }
        if (voice.toneSliders) {
            text += `Tone:\n`;
            text += `• Formal: ${voice.toneSliders.formal}%\n`;
            text += `• Playful: ${voice.toneSliders.playful}%\n`;
            text += `• Premium: ${voice.toneSliders.premium}%\n\n`;
        }
        if (voice.lexicon?.preferred && voice.lexicon.preferred.length > 0) {
            text += `Preferred Phrases:\n${voice.lexicon.preferred.map(p => `• ${p}`).join('\n')}\n\n`;
        }

        // Target Audience
        text += `Target Audience\n${'='.repeat(15)}\n\n`;
        if (audience.primary) text += `Primary:\n${audience.primary}\n\n`;
        if (audience.needs && audience.needs.length > 0) {
            text += `Needs:\n${audience.needs.map(need => `• ${need}`).join('\n')}\n\n`;
        }
        if (audience.painPoints && audience.painPoints.length > 0) {
            text += `Pain Points:\n${audience.painPoints.map(pain => `• ${pain}`).join('\n')}\n\n`;
        }

        navigator.clipboard.writeText(text.trim()).then(() => {
            this.showCopyFeedback(document.getElementById('copy-all-btn'));
        });
    }

    /**
     * Export profile as TXT file
     */
    exportProfile() {
        const { brand, voice, audience } = this.brandProfile;

        let text = `${brand.name || 'Brand Profile'}\n${'='.repeat((brand.name || 'Brand Profile').length)}\n\n`;

        if (brand.tagline) {
            text += `"${brand.tagline}"\n\n`;
        }

        // Brand Identity
        text += `Brand Identity\n${'-'.repeat(50)}\n\n`;
        if (brand.story) text += `Story:\n${brand.story}\n\n`;
        if (brand.mission) text += `Mission:\n${brand.mission}\n\n`;
        if (brand.positioning) text += `Positioning:\n${brand.positioning}\n\n`;
        if (brand.valueProps && brand.valueProps.length > 0) {
            text += `Value Propositions:\n${brand.valueProps.map(vp => `• ${vp}`).join('\n')}\n\n`;
        }

        // Voice & Tone
        text += `Voice & Tone\n${'-'.repeat(50)}\n\n`;
        if (voice.personality && voice.personality.length > 0) {
            text += `Personality: ${voice.personality.join(', ')}\n\n`;
        }
        if (voice.toneSliders) {
            text += `Tone Sliders:\n`;
            text += `• Formal: ${voice.toneSliders.formal}%\n`;
            text += `• Playful: ${voice.toneSliders.playful}%\n`;
            text += `• Premium: ${voice.toneSliders.premium}%\n\n`;
        }
        if (voice.lexicon?.preferred && voice.lexicon.preferred.length > 0) {
            text += `Preferred Phrases:\n${voice.lexicon.preferred.map(p => `• ${p}`).join('\n')}\n\n`;
        }

        // Target Audience
        text += `Target Audience\n${'-'.repeat(50)}\n\n`;
        if (audience.primary) text += `Primary:\n${audience.primary}\n\n`;
        if (audience.needs && audience.needs.length > 0) {
            text += `Needs:\n${audience.needs.map(need => `• ${need}`).join('\n')}\n\n`;
        }
        if (audience.painPoints && audience.painPoints.length > 0) {
            text += `Pain Points:\n${audience.painPoints.map(pain => `• ${pain}`).join('\n')}\n\n`;
        }

        // Create download
        const blob = new Blob([text.trim()], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(brand.name || 'brand-profile').replace(/\s+/g, '-').toLowerCase()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Show success feedback
        this.showCopyFeedback(document.getElementById('export-profile-btn'));
    }

    /**
     * Extract text content from HTML element
     */
    extractTextContent(element) {
        let text = '';
        const clone = element.cloneNode(true);

        // Process each child element
        clone.querySelectorAll('p').forEach(p => {
            const strong = p.querySelector('strong');
            if (strong) {
                text += `${strong.textContent}\n`;
                strong.remove();
            }
            if (p.textContent.trim()) {
                text += `${p.textContent.trim()}\n\n`;
            }
        });

        clone.querySelectorAll('ul').forEach(ul => {
            ul.querySelectorAll('li').forEach(li => {
                text += `• ${li.textContent.trim()}\n`;
            });
            text += '\n';
        });

        return text.trim();
    }

    /**
     * Show visual feedback for copy action
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

        setTimeout(() => {
            if (icon) {
                icon.setAttribute('data-lucide', originalIcon);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
            button.classList.remove('success-feedback');
        }, 2000);
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
}

// Export for use in sidepanel
if (typeof window !== 'undefined') {
    window.ProfileTab = ProfileTab;
}
