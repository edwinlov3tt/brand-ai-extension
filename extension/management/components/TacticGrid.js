/**
 * Tactic Grid Component
 * Renders grid of tactic cards and handles generation modal
 */

class TacticGrid {
    constructor(apiBaseUrl, brandProfile) {
        this.apiBaseUrl = apiBaseUrl;
        this.brandProfile = brandProfile;
        this.tactics = [];
        this.currentTactic = null;
        this.onAdCopyGenerated = null;
        this.init();
    }

    async init() {
        await this.loadTactics();
        this.renderGrid();
        this.setupModalEvents();
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
        const grid = document.getElementById('tactics-grid');
        if (!grid) return;

        grid.innerHTML = '';

        this.tactics.forEach(tactic => {
            const card = new TacticCard(tactic, (tactic) => this.openTacticModal(tactic));
            grid.appendChild(card.render());
        });
    }

    openTacticModal(tactic) {
        this.currentTactic = tactic;

        const modal = document.getElementById('tactic-modal-overlay');
        const title = document.getElementById('tactic-modal-title');

        if (title) {
            title.textContent = tactic.name;
        }

        // Clear previous results
        this.clearResults();

        modal.classList.remove('hidden');
    }

    setupModalEvents() {
        // Close button
        const closeBtn = document.getElementById('tactic-modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeTacticModal());
        }

        // Close on overlay click
        const overlay = document.getElementById('tactic-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeTacticModal();
                }
            });
        }

        // Generate button
        const generateBtn = document.getElementById('generate-tactic-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateAdCopy());
        }
    }

    closeTacticModal() {
        const modal = document.getElementById('tactic-modal-overlay');
        modal.classList.add('hidden');
        this.currentTactic = null;

        // Clear form
        document.getElementById('tactic-objective').value = '';
        document.getElementById('tactic-variations').value = '3';
        this.clearResults();
    }

    async generateAdCopy() {
        if (!this.currentTactic || !this.brandProfile) {
            alert('Please select a brand first');
            return;
        }

        const objective = document.getElementById('tactic-objective').value.trim();
        if (!objective) {
            alert('Please enter a campaign objective');
            return;
        }

        const variations = parseInt(document.getElementById('tactic-variations').value);

        // Show loading
        this.showLoading();

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/generate-ad-copy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    domain: this.brandProfile.metadata.domain,
                    tactic: this.currentTactic.id,
                    campaignObjective: objective,
                    variations
                })
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
        const resultsPanel = document.getElementById('tactic-results-panel');
        if (!resultsPanel) return;

        resultsPanel.innerHTML = '';

        adCopies.forEach((copy, index) => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <div class="result-header">
                    <span style="font-size: 12px; color: var(--text-muted);">Variation ${index + 1}</span>
                    <button class="copy-btn" data-text="${copy.text.replace(/"/g, '&quot;')}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copy
                    </button>
                </div>
                <div class="result-text">${copy.text}</div>
                <div class="result-meta">
                    <span>Characters: ${copy.charCount}</span>
                    <span>Words: ${copy.wordCount}</span>
                    ${copy.valid ?
                        '<span style="color: var(--success-color);">✓ Valid</span>' :
                        '<span style="color: var(--warning-color);">! Over limit</span>'}
                </div>
            `;
            resultsPanel.appendChild(card);
        });

        // Add copy event listeners
        resultsPanel.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.dataset.text;
                navigator.clipboard.writeText(text).then(() => {
                    btn.textContent = 'Copied!';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy`;
                        btn.classList.remove('copied');
                    }, 2000);
                });
            });
        });
    }

    clearResults() {
        const resultsPanel = document.getElementById('tactic-results-panel');
        if (!resultsPanel) return;

        resultsPanel.innerHTML = `
            <div class="results-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
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
