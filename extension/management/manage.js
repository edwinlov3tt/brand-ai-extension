/**
 * Main Application Controller
 * Coordinates all components and manages application state
 */

class App {
    constructor() {
        this.apiBaseUrl = null;
        this.brandSelector = null;
        this.tacticGrid = null;
        this.adCopyHistory = null;
        this.brandModal = null;
        this.pageNavigation = null;
        this.pagesView = null;
        this.pageEditModal = null;
        this.init();
    }

    async init() {
        // Get Worker URL from Chrome storage
        const result = await chrome.storage.local.get(['workerUrl']);
        this.apiBaseUrl = result.workerUrl || 'https://brand-inspector-worker.edwin-6f1.workers.dev';

        // Initialize page navigation first
        this.pageNavigation = new PageNavigation();
        window.pageNavigation = this.pageNavigation; // Make it globally available

        // Initialize components
        this.brandSelector = new BrandSelector(this.apiBaseUrl);
        this.adCopyHistory = new AdCopyHistory(this.apiBaseUrl);
        this.brandModal = new BrandModal(this.apiBaseUrl);
        this.pagesView = new PagesView(this.apiBaseUrl);
        this.pageEditModal = new PageEditModal(this.apiBaseUrl);

        // Connect pages view with edit modal
        this.pagesView.setEditModal(this.pageEditModal);

        // Setup callbacks
        this.brandSelector.onBrandChange = (brandProfile) => {
            this.onBrandSelected(brandProfile);
        };

        this.brandModal.onSave = (brandProfile) => {
            this.onBrandUpdated(brandProfile);
        };
    }

    onBrandSelected(brandProfile) {
        // Show content area
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('content-area').classList.remove('hidden');

        // Initialize tactic grid if not already created
        if (!this.tacticGrid) {
            this.tacticGrid = new TacticGrid(this.apiBaseUrl, brandProfile);
            this.tacticGrid.onAdCopyGenerated = () => {
                this.adCopyHistory.refresh();
            };
        } else {
            this.tacticGrid.updateBrandProfile(brandProfile);
        }

        // Load ad copy history
        this.adCopyHistory.loadHistory(brandProfile.metadata.domain);

        // Load saved pages
        if (this.pagesView && brandProfile.id) {
            this.pagesView.loadPages(brandProfile.id);
        }

        // Update brand modal
        this.brandModal.setBrandProfile(brandProfile);

        // Display brand profile in settings page
        this.displayBrandProfileSettings(brandProfile);
    }

    displayBrandProfileSettings(brandProfile) {
        const container = document.getElementById('profile-brand-details');
        if (!container) return;

        // Get saved additional guidelines from storage
        chrome.storage.local.get(['additionalGuidelines_' + brandProfile.metadata?.domain], (result) => {
            const savedGuidelines = result['additionalGuidelines_' + brandProfile.metadata?.domain] || '';

            container.innerHTML = `
                <div class="kt-card" style="padding: var(--spacing-xl); margin-bottom: var(--spacing-lg);">
                    <h3 style="margin-bottom: var(--spacing-lg); color: var(--text-primary);">Brand Information</h3>
                    <div style="display: grid; gap: var(--spacing-md);">
                        <div>
                            <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 4px;">Domain</label>
                            <p style="color: var(--text-primary); margin: 0;">${brandProfile.metadata?.domain || 'N/A'}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 4px;">Brand Name</label>
                            <p style="color: var(--text-primary); margin: 0;">${brandProfile.brand?.name || 'N/A'}</p>
                        </div>
                        ${brandProfile.brand?.mission ? `
                            <div>
                                <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 4px;">Mission</label>
                                <p style="color: var(--text-primary); margin: 0;">${brandProfile.brand.mission}</p>
                            </div>
                        ` : ''}
                        ${brandProfile.brand?.positioning ? `
                            <div>
                                <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 4px;">Positioning</label>
                                <p style="color: var(--text-primary); margin: 0;">${brandProfile.brand.positioning}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="kt-card" style="padding: var(--spacing-xl); margin-bottom: var(--spacing-lg);">
                    <h3 style="margin-bottom: var(--spacing-lg); color: var(--text-primary);">Voice & Personality</h3>
                    <div style="display: grid; gap: var(--spacing-md);">
                        ${brandProfile.voice?.personality?.length ? `
                            <div>
                                <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 4px;">Personality Traits</label>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                                    ${brandProfile.voice.personality.map(trait => `
                                        <span style="background: var(--bg-tertiary); color: var(--text-primary); padding: 4px 12px; border-radius: var(--radius-md); font-size: var(--font-size-sm); border: 1px solid rgba(255, 255, 255, 0.08);">${trait}</span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        ${brandProfile.voice?.toneSliders ? `
                            <div>
                                <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 8px;">Tone Characteristics</label>
                                <div style="display: grid; gap: 12px;">
                                    ${Object.entries(brandProfile.voice.toneSliders).map(([key, value]) => `
                                        <div>
                                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                                <span style="color: var(--text-secondary); font-size: var(--font-size-sm); text-transform: capitalize;">${key}</span>
                                                <span style="color: var(--text-primary); font-size: var(--font-size-sm); font-weight: 600;">${value}/100</span>
                                            </div>
                                            <div style="height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">
                                                <div style="height: 100%; background: var(--primary-color); width: ${value}%;"></div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="kt-card" style="padding: var(--spacing-xl); margin-bottom: var(--spacing-lg);">
                    <h3 style="margin-bottom: var(--spacing-lg); color: var(--text-primary);">Lexicon</h3>
                    <div style="display: grid; gap: var(--spacing-lg);">
                        ${brandProfile.voice?.lexicon?.preferred?.length ? `
                            <div>
                                <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 8px;">
                                    <i class="ki-outline ki-check-circle" style="color: #28A745;"></i>
                                    Preferred Phrases
                                </label>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    ${brandProfile.voice.lexicon.preferred.map(phrase => `
                                        <span style="background: rgba(40, 167, 69, 0.1); color: #28A745; padding: 6px 12px; border-radius: var(--radius-md); font-size: var(--font-size-sm); border: 1px solid rgba(40, 167, 69, 0.2);">${phrase}</span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        ${brandProfile.voice?.lexicon?.avoid?.length ? `
                            <div>
                                <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 8px;">
                                    <i class="ki-outline ki-cross-circle" style="color: #DC3545;"></i>
                                    Avoid
                                </label>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    ${brandProfile.voice.lexicon.avoid.map(phrase => `
                                        <span style="background: rgba(220, 53, 69, 0.1); color: #DC3545; padding: 6px 12px; border-radius: var(--radius-md); font-size: var(--font-size-sm); border: 1px solid rgba(220, 53, 69, 0.2);">${phrase}</span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="kt-card" style="padding: var(--spacing-xl); margin-bottom: var(--spacing-lg);">
                    <h3 style="margin-bottom: var(--spacing-lg); color: var(--text-primary);">Target Audience</h3>
                    <div style="display: grid; gap: var(--spacing-md);">
                        ${brandProfile.audience?.primary ? `
                            <div>
                                <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 4px;">Primary Audience</label>
                                <p style="color: var(--text-primary); margin: 0;">${brandProfile.audience.primary}</p>
                            </div>
                        ` : ''}
                        ${brandProfile.audience?.needs?.length ? `
                            <div>
                                <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 8px;">Needs</label>
                                <ul style="margin: 0; padding-left: 20px; color: var(--text-primary);">
                                    ${brandProfile.audience.needs.map(need => `<li style="margin-bottom: 4px;">${need}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${brandProfile.audience?.painPoints?.length ? `
                            <div>
                                <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 8px;">Pain Points</label>
                                <ul style="margin: 0; padding-left: 20px; color: var(--text-primary);">
                                    ${brandProfile.audience.painPoints.map(point => `<li style="margin-bottom: 4px;">${point}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="kt-card" style="padding: var(--spacing-xl); margin-bottom: var(--spacing-lg);">
                    <h3 style="margin-bottom: var(--spacing-lg); color: var(--text-primary);">Brand Colors</h3>
                    <div style="display: flex; gap: var(--spacing-md); flex-wrap: wrap;">
                        ${(brandProfile.colors?.palette || []).map(color => `
                            <div style="text-align: center;">
                                <div style="width: 60px; height: 60px; background-color: ${color.hex}; border-radius: var(--radius-md); border: 1px solid #3D3D3D;"></div>
                                <span style="display: block; margin-top: 4px; font-size: var(--font-size-xs); color: var(--text-secondary);">${color.hex}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="kt-card" style="padding: var(--spacing-xl); margin-bottom: var(--spacing-lg);">
                    <h3 style="margin-bottom: var(--spacing-lg); color: var(--text-primary);">Typography</h3>
                    <div style="display: grid; gap: var(--spacing-md);">
                        ${brandProfile.typography?.displayFont ? `
                            <div>
                                <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 4px;">Display Font</label>
                                <p style="color: var(--text-primary); margin: 0;">${brandProfile.typography.displayFont.family}</p>
                            </div>
                        ` : ''}
                        ${brandProfile.typography?.bodyFont ? `
                            <div>
                                <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 4px;">Body Font</label>
                                <p style="color: var(--text-primary); margin: 0;">${brandProfile.typography.bodyFont.family}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="kt-card" style="padding: var(--spacing-xl);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg);">
                        <h3 style="margin: 0; color: var(--text-primary);">Additional AI Guidelines</h3>
                        <button class="btn-secondary" id="save-guidelines-btn" style="padding: 8px 16px; font-size: var(--font-size-sm);">
                            <i class="ki-outline ki-check"></i>
                            Save
                        </button>
                    </div>
                    <div>
                        <label style="color: var(--text-muted); font-size: var(--font-size-xs); display: block; margin-bottom: 8px;">Custom instructions for AI-generated content</label>
                        <textarea id="additional-guidelines" class="kt-input" rows="6" placeholder="E.g., Always mention our free trial, avoid using exclamation marks, focus on ROI and business outcomes..." style="width: 100%; font-size: var(--font-size-sm); line-height: 1.6;">${savedGuidelines}</textarea>
                        <span class="form-hint" style="display: block; margin-top: 8px;">These guidelines will be included in all AI generation prompts for this brand</span>
                    </div>
                </div>
            `;

            // Add save button listener
            const saveBtn = document.getElementById('save-guidelines-btn');
            const guidelinesTextarea = document.getElementById('additional-guidelines');

            if (saveBtn && guidelinesTextarea) {
                saveBtn.addEventListener('click', () => {
                    const guidelines = guidelinesTextarea.value;
                    const storageKey = 'additionalGuidelines_' + brandProfile.metadata?.domain;

                    chrome.storage.local.set({ [storageKey]: guidelines }, () => {
                        // Visual feedback
                        saveBtn.innerHTML = '<i class="ki-outline ki-check-circle"></i> Saved!';
                        saveBtn.style.background = '#28A745';
                        saveBtn.style.borderColor = '#28A745';

                        setTimeout(() => {
                            saveBtn.innerHTML = '<i class="ki-outline ki-check"></i> Save';
                            saveBtn.style.background = '';
                            saveBtn.style.borderColor = '';
                        }, 2000);
                    });
                });
            }
        });
    }

    onBrandUpdated(brandProfile) {
        // Update tactic grid with new brand profile
        if (this.tacticGrid) {
            this.tacticGrid.updateBrandProfile(brandProfile);
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new App();
    });
} else {
    new App();
}
