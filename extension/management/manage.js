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
        this.init();
    }

    async init() {
        // Get Worker URL from Chrome storage
        const result = await chrome.storage.local.get(['workerUrl']);
        this.apiBaseUrl = result.workerUrl || 'https://brand-inspector-worker.edwin-6f1.workers.dev';

        // Initialize components
        this.brandSelector = new BrandSelector(this.apiBaseUrl);
        this.adCopyHistory = new AdCopyHistory(this.apiBaseUrl);
        this.brandModal = new BrandModal(this.apiBaseUrl);

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

        // Update brand modal
        this.brandModal.setBrandProfile(brandProfile);
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
