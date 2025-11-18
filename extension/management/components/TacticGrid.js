/**
 * Tactic Grid Component
 * Renders grid of tactic cards and handles inline generation view
 */

class TacticGrid {
    constructor(apiBaseUrl, brandProfile) {
        this.apiBaseUrl = apiBaseUrl;
        this.brandProfile = brandProfile;
        this.tactics = [];
        this.currentTactic = null;
        this.onAdCopyGenerated = null;
        this.currentPlatform = 'all';

        // Platform mapping for tactics
        this.platformMap = {
            google: ['google_headline', 'spark_ad_copy'],
            facebook: ['facebook_title', 'facebook_ad_copy', 'facebook_carousel_ad'],
            instagram: ['instagram_caption'],
            twitter: ['twitter_post'],
            tiktok: ['tiktok_ad_copy'],
            snapchat: ['snapchat_ad_copy'],
            linkedin: ['linkedin_intro', 'linkedin_ad_copy'],
            pinterest: ['pinterest_ad_copy'],
            nextdoor: ['nextdoor_display_ad', 'nextdoor_sale_ad', 'nextdoor_rail_ad'],
            email: ['email_subject', 'email_marketing_copy'],
            native: ['native_ad_copy']
        };

        this.init();
    }

    async init() {
        await this.loadTactics();
        this.renderGrid();
        this.setupInlineEvents();
        this.setupPlatformFilters();
    }

    async loadTactics() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/tactics`);
            if (response.ok) {
                const data = await response.json();
                this.tactics = data.tactics;
            }
        } catch (error) {
            console.error('Failed to load tactics:', error);
        }
    }

    renderGrid() {
        // Render all tactics on the Tactics page
        const tacticsGrid = document.getElementById('tactics-grid');
        if (tacticsGrid) {
            tacticsGrid.innerHTML = '';
            this.tactics.forEach(tactic => {
                const card = new TacticCard(tactic, (tactic) => this.openInlineView(tactic));
                const cardElement = card.render();

                // Add platform attribute for filtering
                const platforms = this.getTacticPlatforms(tactic.id);
                cardElement.dataset.platforms = platforms.join(',');

                tacticsGrid.appendChild(cardElement);
            });
        }
    }

    /**
     * Get platforms for a tactic ID
     */
    getTacticPlatforms(tacticId) {
        const platforms = [];
        for (const [platform, tacticIds] of Object.entries(this.platformMap)) {
            if (tacticIds.includes(tacticId)) {
                platforms.push(platform);
            }
        }
        return platforms;
    }

    /**
     * Setup platform filter chip event listeners
     */
    setupPlatformFilters() {
        const filterChips = document.querySelectorAll('.platform-chip');
        filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const platform = chip.dataset.platform;
                this.filterByPlatform(platform);

                // Update active state
                filterChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });
        });
    }

    /**
     * Filter tactics by platform
     */
    filterByPlatform(platform) {
        this.currentPlatform = platform;
        const tacticsGrid = document.getElementById('tactics-grid');
        if (!tacticsGrid) return;

        const cards = tacticsGrid.querySelectorAll('.tactic-card');
        cards.forEach(card => {
            if (platform === 'all') {
                card.style.display = '';
            } else {
                const platforms = card.dataset.platforms?.split(',') || [];
                card.style.display = platforms.includes(platform) ? '' : 'none';
            }
        });
    }

    openInlineView(tactic) {
        this.currentTactic = tactic;

        // Update title
        const title = document.getElementById('generation-tactic-title');
        if (title) {
            title.textContent = tactic.name;
        }

        // Clear previous results
        this.clearResults();

        // Populate saved pages dropdown
        this.populatePageDropdown();

        // Hide all page views
        document.querySelectorAll('.page-view').forEach(page => {
            page.classList.add('hidden');
        });

        // Show inline generation view
        const inlineView = document.getElementById('inline-generation-view');
        if (inlineView) inlineView.classList.remove('hidden');

        // Update breadcrumb
        const breadcrumbCurrent = document.getElementById('breadcrumb-current');
        if (breadcrumbCurrent) {
            breadcrumbCurrent.textContent = tactic.name;
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async populatePageDropdown() {
        const pageSelect = document.getElementById('inline-page-select');
        if (!pageSelect) return;

        // Get current brand profile ID
        const brandProfileId = this.brandProfile?.id;
        if (!brandProfileId) {
            pageSelect.innerHTML = '<option value="">None - Use general brand profile</option>';
            return;
        }

        try {
            // Fetch saved pages from API using brandProfileId
            const response = await fetch(`${this.apiBaseUrl}/api/pages/${brandProfileId}`);
            if (!response.ok) throw new Error('Failed to fetch pages');

            const data = await response.json();
            const pages = data.pages || [];

            // Populate dropdown
            pageSelect.innerHTML = '<option value="">None - Use general brand profile</option>';

            if (pages.length > 0) {
                pages.forEach(page => {
                    const option = document.createElement('option');
                    option.value = page.id;
                    option.textContent = `${page.title || 'Untitled'} (${page.type})`;
                    option.dataset.pageData = JSON.stringify(page);
                    pageSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load pages:', error);
            pageSelect.innerHTML = '<option value="">None - Use general brand profile</option>';
        }
    }

    setupInlineEvents() {
        // Back button
        const backBtn = document.getElementById('back-to-tactics-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.closeInlineView());
        }

        // Close button
        const closeBtn = document.getElementById('close-generation-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeInlineView());
        }

        // Generate button
        const generateBtn = document.getElementById('inline-generate-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateAdCopy());
        }

        // Number stepper controls for inline view
        const variationsInput = document.getElementById('inline-tactic-variations');
        const decreaseBtn = document.getElementById('inline-decrease-variations');
        const increaseBtn = document.getElementById('inline-increase-variations');

        if (decreaseBtn && variationsInput) {
            decreaseBtn.addEventListener('click', () => {
                const currentValue = parseInt(variationsInput.value);
                const minValue = parseInt(variationsInput.min) || 1;
                if (currentValue > minValue) {
                    variationsInput.value = currentValue - 1;
                }
            });
        }

        if (increaseBtn && variationsInput) {
            increaseBtn.addEventListener('click', () => {
                const currentValue = parseInt(variationsInput.value);
                const maxValue = parseInt(variationsInput.max) || 10;
                if (currentValue < maxValue) {
                    variationsInput.value = currentValue + 1;
                }
            });
        }

        // Emoji checkbox - no additional setup needed, handled by checkbox input
    }

    closeInlineView() {
        this.currentTactic = null;

        // Hide inline generation view
        const inlineView = document.getElementById('inline-generation-view');
        if (inlineView) inlineView.classList.add('hidden');

        // Go back to the current page using PageNavigation
        if (window.pageNavigation) {
            const currentPage = window.pageNavigation.getCurrentPage();
            window.pageNavigation.navigateToPage(currentPage);
        }

        // Clear form
        document.getElementById('inline-tactic-objective').value = '';
        document.getElementById('inline-tactic-variations').value = '3';

        // Reset emoji checkbox to unchecked
        const emojiCheckbox = document.getElementById('emoji-toggle-checkbox');
        if (emojiCheckbox) {
            emojiCheckbox.checked = false;
        }

        // Reset variations display
        if (typeof window.formControls !== 'undefined') {
            window.formControls.updateVariationsDisplay(3);
        }

        this.clearResults();
    }

    async generateAdCopy() {
        if (!this.currentTactic || !this.brandProfile) {
            alert('Please select a brand first');
            return;
        }

        const objective = document.getElementById('inline-tactic-objective').value.trim();
        if (!objective) {
            alert('Please enter a campaign objective');
            return;
        }

        const variations = parseInt(document.getElementById('inline-tactic-variations').value);

        // Get emoji checkbox value
        const emojiCheckbox = document.getElementById('emoji-toggle-checkbox');
        const includeEmojis = emojiCheckbox && emojiCheckbox.checked;

        // Get selected page context (if any)
        const pageSelect = document.getElementById('inline-page-select');
        let pageContext = null;
        if (pageSelect && pageSelect.value) {
            const selectedOption = pageSelect.options[pageSelect.selectedIndex];
            if (selectedOption.dataset.pageData) {
                try {
                    pageContext = JSON.parse(selectedOption.dataset.pageData);
                } catch (e) {
                    console.error('Failed to parse page data:', e);
                }
            }
        }

        // Show loading
        this.showLoading();

        try {
            const requestBody = {
                domain: this.brandProfile.metadata.domain,
                tactic: this.currentTactic.id,
                campaignObjective: objective,
                variations,
                includeEmojis,
                emojiInstructions: includeEmojis ? 'Include no more than 1 emoji in the copy. Place it where it fits naturally and enhances the message.' : undefined
            };

            // Add page context if a page is selected
            if (pageContext) {
                requestBody.pageContext = {
                    title: pageContext.title,
                    type: pageContext.type,
                    summary: pageContext.summary,
                    valuePropositions: pageContext.valuePropositions,
                    features: pageContext.features,
                    benefits: pageContext.benefits,
                    targetAudience: pageContext.targetAudience
                };
            }

            const response = await fetch(`${this.apiBaseUrl}/api/generate-ad-copy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('Failed to generate ad copy');
            }

            const data = await response.json();
            this.displayResults(data.adCopies);

            // Trigger callback for history refresh
            if (this.onAdCopyGenerated) {
                this.onAdCopyGenerated();
            }

        } catch (error) {
            console.error('Generation error:', error);
            alert('Failed to generate ad copy. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    displayResults(adCopies) {
        const resultsPanel = document.getElementById('inline-results-panel');
        if (!resultsPanel) return;

        resultsPanel.innerHTML = '';

        // Check if this is multi-component or single component
        if (adCopies.multiComponent) {
            this.displayGroupedResults(adCopies, resultsPanel);
        } else {
            this.displaySingleComponentResults(adCopies, resultsPanel);
        }
    }

    displaySingleComponentResults(adCopies, resultsPanel) {
        adCopies.forEach((copy, index) => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <div class="result-header">
                    <span style="font-size: 12px; color: var(--text-muted);">Variation ${index + 1}</span>
                    <button class="copy-btn" data-text="${copy.text.replace(/"/g, '&quot;')}">
                        <i class="ki-outline ki-copy fs-5"></i>
                        Copy
                    </button>
                </div>
                <div class="result-text">${copy.text}</div>
                <div class="result-meta">
                    <span><i class="ki-outline ki-text fs-6"></i> ${copy.charCount} chars</span>
                    <span><i class="ki-outline ki-message-text fs-6"></i> ${copy.wordCount} words</span>
                    ${copy.valid ?
                        '<span style="color: var(--success-color);"><i class="ki-outline ki-check-circle fs-6"></i> Valid</span>' :
                        '<span style="color: var(--warning-color);"><i class="ki-outline ki-information-2 fs-6"></i> Over limit</span>'}
                </div>
            `;
            resultsPanel.appendChild(card);
        });

        // Add copy event listeners
        resultsPanel.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.dataset.text;
                navigator.clipboard.writeText(text).then(() => {
                    btn.innerHTML = '<i class="ki-outline ki-check fs-5"></i> Copied!';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.innerHTML = '<i class="ki-outline ki-copy fs-5"></i> Copy';
                        btn.classList.remove('copied');
                    }, 2000);
                });
            });
        });
    }

    displayGroupedResults(adCopies, resultsPanel) {
        // Create a single card containing all components
        const card = document.createElement('div');
        card.className = 'result-card grouped-result';

        let componentHTML = '';

        adCopies.components.forEach((component, compIndex) => {
            const isLastComponent = compIndex === adCopies.components.length - 1;

            componentHTML += `
                <div class="component-group ${isLastComponent ? '' : 'component-separator'}">
                    <div class="component-header">
                        <h4 style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 0;">
                            <i class="ki-outline ki-element-11 fs-5" style="color: var(--primary-color);"></i>
                            ${component.name}
                        </h4>
                    </div>
                    <div class="component-variations">
            `;

            component.variations.forEach((variation, varIndex) => {
                const escapedText = variation.text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                const displayText = variation.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

                componentHTML += `
                    <div class="variation-item">
                        <div class="variation-content">
                            <span class="variation-label">${component.variations.length > 1 ? `${varIndex + 1}.` : ''}</span>
                            <span class="variation-text">${displayText}</span>
                            <button class="copy-btn-inline" data-text="${escapedText}" title="Copy">
                                <i class="ki-outline ki-copy fs-6"></i>
                            </button>
                        </div>
                        <div class="variation-meta">
                            <span style="font-size: 11px; color: var(--text-muted);">
                                <i class="ki-outline ki-text fs-7"></i> ${variation.charCount} chars
                            </span>
                            ${variation.valid ?
                                '<span style="font-size: 11px; color: var(--success-color);"><i class="ki-outline ki-check-circle fs-7"></i> Valid</span>' :
                                '<span style="font-size: 11px; color: var(--warning-color);"><i class="ki-outline ki-information-2 fs-7"></i> Over limit</span>'}
                        </div>
                    </div>
                `;
            });

            componentHTML += `
                    </div>
                </div>
            `;
        });

        card.innerHTML = componentHTML;
        resultsPanel.appendChild(card);

        // Add copy event listeners
        resultsPanel.querySelectorAll('.copy-btn-inline').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.dataset.text;
                navigator.clipboard.writeText(text).then(() => {
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<i class="ki-outline ki-check fs-6"></i>';
                    btn.style.color = 'var(--success-color)';
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.style.color = '';
                    }, 1500);
                });
            });
        });
    }

    clearResults() {
        const resultsPanel = document.getElementById('inline-results-panel');
        if (!resultsPanel) return;

        resultsPanel.innerHTML = `
            <div class="results-empty">
                <i class="ki-outline ki-message-text fs-3tx text-muted-foreground"></i>
                <p>Generate ad copy to see results here</p>
            </div>
        `;
    }

    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    updateBrandProfile(brandProfile) {
        this.brandProfile = brandProfile;
    }
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.TacticGrid = TacticGrid;
}
