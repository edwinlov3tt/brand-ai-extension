/**
 * Brand Modal Component
 * Modal for editing brand identity with tone sliders
 */

class BrandModal {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this.brandProfile = null;
        this.selectedTones = [];
        this.toneSliders = {};
        this.onSave = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Edit brand button
        const editBtn = document.getElementById('edit-brand-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.open());
        }

        // Close buttons
        const closeBtn = document.getElementById('modal-close-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.close());
        }

        // Save button
        const saveBtn = document.getElementById('modal-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.save());
        }

        // Close on overlay click
        const overlay = document.getElementById('brand-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.close();
                }
            });
        }
    }

    open() {
        if (!this.brandProfile) {
            alert('Please select a brand first');
            return;
        }

        this.renderForm();

        const modal = document.getElementById('brand-modal-overlay');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    close() {
        const modal = document.getElementById('brand-modal-overlay');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    renderForm() {
        const body = document.getElementById('brand-modal-body');
        if (!body || !this.brandProfile) return;

        // Initialize selected tones
        this.selectedTones = this.brandProfile.voice?.personality || [];

        // Initialize tone sliders
        this.toneSliders = this.brandProfile.voice?.toneSliders || {
            formal: 50,
            playful: 50,
            premium: 50,
            technical: 50,
            energetic: 50
        };

        body.innerHTML = `
            <div class="form-group">
                <label>Tone Selection</label>
                <div class="tone-tags" id="tone-tags">
                    ${this.renderToneTags()}
                </div>
            </div>

            <div class="tone-sliders">
                ${this.renderToneSlider('formal', 'Casual', 'Formal')}
                ${this.renderToneSlider('playful', 'Serious', 'Playful')}
                ${this.renderToneSlider('premium', 'Simple', 'Premium')}
                ${this.renderToneSlider('technical', 'Personal', 'Technical')}
                ${this.renderToneSlider('energetic', 'Calm', 'Energetic')}
            </div>

            <div class="form-group">
                <label for="brand-purpose">What is your brand purpose?</label>
                <textarea id="brand-purpose" class="form-textarea" rows="3" placeholder="Describe your brand's purpose...">${this.brandProfile.brand?.mission || ''}</textarea>
            </div>

            <div class="form-group">
                <label for="brand-overview">Brand Overview</label>
                <textarea id="brand-overview" class="form-textarea" rows="3" placeholder="Brief overview of your brand...">${this.brandProfile.brand?.story || ''}</textarea>
            </div>

            <div class="form-group">
                <label for="target-audience">Target Audience</label>
                <textarea id="target-audience" class="form-textarea" rows="2" placeholder="Describe your target audience...">${this.brandProfile.audience?.primary || ''}</textarea>
            </div>
        `;

        // Setup tone tag listeners
        body.querySelectorAll('.tone-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                const tone = tag.dataset.tone;
                if (tag.classList.contains('selected')) {
                    tag.classList.remove('selected');
                    this.selectedTones = this.selectedTones.filter(t => t !== tone);
                } else {
                    tag.classList.add('selected');
                    if (!this.selectedTones.includes(tone)) {
                        this.selectedTones.push(tone);
                    }
                }
            });
        });

        // Setup slider listeners
        Object.keys(this.toneSliders).forEach(key => {
            const slider = body.querySelector(`#slider-${key}`);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    this.toneSliders[key] = parseInt(e.target.value);
                    this.updateSliderDisplay(key, this.toneSliders[key]);
                });
            }
        });
    }

    renderToneTags() {
        const allTones = [
            'Professional', 'Persuasive', 'Enthusiastic', 'Confident',
            'Inspirational', 'Passionate', 'Friendly', 'Authoritative',
            'Innovative', 'Trustworthy', 'Bold', 'Empathetic'
        ];

        return allTones.map(tone => {
            const selected = this.selectedTones.includes(tone.toLowerCase());
            return `<div class="tone-tag ${selected ? 'selected' : ''}" data-tone="${tone.toLowerCase()}">${tone}</div>`;
        }).join('');
    }

    renderToneSlider(key, leftLabel, rightLabel) {
        const value = this.toneSliders[key];
        return `
            <div class="slider-row">
                <div class="slider-labels">
                    <span>${leftLabel}</span>
                    <span>${rightLabel}</span>
                </div>
                <div class="slider-track">
                    <input type="range" min="0" max="100" value="${value}" class="slider-input" id="slider-${key}">
                    <div class="slider-fill" id="slider-fill-${key}" style="width: ${value}%"></div>
                    <div class="slider-value" id="slider-value-${key}">${value}%</div>
                </div>
            </div>
        `;
    }

    updateSliderDisplay(key, value) {
        const fill = document.getElementById(`slider-fill-${key}`);
        const valueDisplay = document.getElementById(`slider-value-${key}`);

        if (fill) {
            fill.style.width = `${value}%`;
        }

        if (valueDisplay) {
            valueDisplay.textContent = `${value}%`;
        }
    }

    async save() {
        if (!this.brandProfile) return;

        // Collect form data
        const purpose = document.getElementById('brand-purpose')?.value || '';
        const overview = document.getElementById('brand-overview')?.value || '';
        const audience = document.getElementById('target-audience')?.value || '';

        // Update brand profile
        const updatedProfile = {
            ...this.brandProfile,
            brand: {
                ...this.brandProfile.brand,
                mission: purpose,
                story: overview
            },
            voice: {
                ...this.brandProfile.voice,
                personality: this.selectedTones,
                toneSliders: this.toneSliders
            },
            audience: {
                ...this.brandProfile.audience,
                primary: audience
            }
        };

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/brand-profile/${this.brandProfile.metadata.domain}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ profile: updatedProfile })
            });

            if (!response.ok) {
                throw new Error('Failed to save brand profile');
            }

            this.brandProfile = updatedProfile;

            // Trigger callback
            if (this.onSave) {
                this.onSave(updatedProfile);
            }

            alert('Brand profile updated successfully!');
            this.close();

        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save brand profile. Please try again.');
        }
    }

    setBrandProfile(brandProfile) {
        this.brandProfile = brandProfile;
    }
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.BrandModal = BrandModal;
}
