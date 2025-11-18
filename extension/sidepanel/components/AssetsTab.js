/**
 * Assets Tab Component
 * Manages asset display, grid/list toggle, and asset details
 */

class AssetsTab {
    constructor() {
        this.assets = [];
        this.viewMode = 'grid'; // 'grid' or 'list'
        this.selectedAsset = null;
        this.init();
    }

    /**
     * Initialize Assets tab
     */
    init() {
        this.setupViewToggle();
        this.setupAssetModal();
    }

    /**
     * Setup grid/list view toggle
     */
    setupViewToggle() {
        const assetsTab = document.getElementById('assets-tab');
        if (!assetsTab) return;

        // Check if controls already exist
        if (assetsTab.querySelector('.assets-controls')) return;

        // Create controls container
        const controls = document.createElement('div');
        controls.className = 'assets-controls';
        controls.innerHTML = `
            <div class="assets-header">
                <h3 class="assets-count" data-count="0">Assets</h3>
                <div class="assets-header-actions">
                    <button class="copy-all-btn" id="copy-all-assets-btn" title="Copy all asset links">
                        <i data-lucide="copy" class="icon-sm"></i>
                    </button>
                    <div class="view-toggle">
                        <button class="view-btn active" data-view="grid" title="Grid view">
                            <i data-lucide="grid-3x3" class="icon-sm"></i>
                        </button>
                        <button class="view-btn" data-view="list" title="List view">
                            <i data-lucide="list" class="icon-sm"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Insert at top of tab
        const emptyState = assetsTab.querySelector('.empty-state');
        assetsTab.insertBefore(controls, emptyState);

        // Hide controls initially
        controls.style.display = 'none';

        // Setup event listeners
        controls.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchView(btn.dataset.view);
            });
        });

        // Initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Setup asset detail modal
     */
    setupAssetModal() {
        // Check if modal already exists
        if (document.getElementById('asset-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'asset-modal';
        modal.className = 'asset-modal hidden';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <button class="modal-back-btn">
                        <i data-lucide="arrow-left" class="icon-sm"></i>
                        Inspector
                    </button>
                    <button class="modal-close-btn">
                        <i data-lucide="x" class="icon-sm"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="asset-type-label"></div>
                    <h2 class="asset-name"></h2>
                    <div class="asset-preview">
                        <img class="asset-preview-img" />
                    </div>
                    <div class="asset-properties">
                        <h3>Element properties</h3>
                        <div class="property-row">
                            <span class="property-label">File size</span>
                            <span class="property-value asset-file-size">-</span>
                        </div>
                        <div class="property-row">
                            <span class="property-label">Dimensions</span>
                            <span class="property-value asset-dimensions">-</span>
                        </div>
                    </div>
                    <button class="download-asset-btn">
                        <i data-lucide="download" class="icon-sm"></i>
                        Download Asset
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup event listeners
        modal.querySelector('.modal-backdrop').addEventListener('click', () => {
            this.closeAssetModal();
        });

        modal.querySelector('.modal-close-btn').addEventListener('click', () => {
            this.closeAssetModal();
        });

        modal.querySelector('.modal-back-btn').addEventListener('click', () => {
            this.closeAssetModal();
        });

        modal.querySelector('.download-asset-btn').addEventListener('click', () => {
            this.downloadSelectedAsset();
        });

        // Initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Update assets display
     */
    updateAssets(assets) {
        this.assets = assets || [];

        const assetsTab = document.getElementById('assets-tab');
        if (!assetsTab) return;

        const emptyState = assetsTab.querySelector('.empty-state');
        const controls = assetsTab.querySelector('.assets-controls');

        if (this.assets.length === 0) {
            // Show empty state
            emptyState.classList.remove('hidden');
            if (controls) controls.style.display = 'none';
            return;
        }

        // Hide empty state, show controls
        emptyState.classList.add('hidden');
        if (controls) {
            controls.style.display = 'block';
            const countElement = controls.querySelector('.assets-count');
            countElement.setAttribute('data-count', this.assets.length);
        }

        // Create or update assets grid
        this.renderAssets();
    }

    /**
     * Render assets in current view mode
     */
    renderAssets() {
        const assetsTab = document.getElementById('assets-tab');
        if (!assetsTab) return;

        // Remove existing grid/list
        const existingGrid = assetsTab.querySelector('.assets-grid');
        if (existingGrid) existingGrid.remove();

        // Create new grid
        const grid = document.createElement('div');
        grid.className = `assets-grid view-${this.viewMode}`;

        this.assets.forEach(asset => {
            const card = this.createAssetCard(asset);
            grid.appendChild(card);
        });

        assetsTab.appendChild(grid);

        // Re-initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Create asset card element
     */
    createAssetCard(asset) {
        const card = document.createElement('div');
        card.className = 'asset-card';
        card.dataset.assetUrl = asset.url;

        // Format file size
        const fileSize = asset.fileSize ?
            this.formatFileSize(asset.fileSize) :
            'Unknown';

        card.innerHTML = `
            <div class="asset-thumbnail">
                <img src="${asset.url}" alt="${asset.fileName}" loading="lazy" />
                ${asset.isLogo ? '<span class="asset-badge">Logo</span>' : ''}
                ${asset.isFavicon ? '<span class="asset-badge">Favicon</span>' : ''}
            </div>
            <div class="asset-info">
                <div class="asset-name" title="${asset.fileName}">${asset.fileName}</div>
                <div class="asset-meta">
                    <span class="asset-size">${fileSize}</span>
                    <span class="asset-dimensions">${asset.width}×${asset.height} px</span>
                </div>
            </div>
            <button class="asset-download-btn" title="Download asset">
                <i data-lucide="download" class="icon-sm"></i>
            </button>
        `;

        // Click card to show details
        const cardBody = card.querySelector('.asset-thumbnail, .asset-info');
        card.addEventListener('click', (e) => {
            // Don't open modal if download button was clicked
            if (!e.target.closest('.asset-download-btn')) {
                this.showAssetDetails(asset);
            }
        });

        // Download button
        const downloadBtn = card.querySelector('.asset-download-btn');
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.downloadAsset(asset);
        });

        return card;
    }

    /**
     * Switch between grid and list view
     */
    switchView(viewMode) {
        this.viewMode = viewMode;

        // Update button states
        const assetsTab = document.getElementById('assets-tab');
        assetsTab.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewMode);
        });

        // Re-render assets
        this.renderAssets();
    }

    /**
     * Show asset details modal
     */
    showAssetDetails(asset) {
        this.selectedAsset = asset;

        const modal = document.getElementById('asset-modal');
        if (!modal) return;

        // Update modal content
        modal.querySelector('.asset-type-label').textContent = asset.type.toUpperCase();
        modal.querySelector('.asset-name').textContent = asset.fileName;
        modal.querySelector('.asset-preview-img').src = asset.url;
        modal.querySelector('.asset-file-size').textContent =
            asset.fileSize ? this.formatFileSize(asset.fileSize) : 'Unknown';
        modal.querySelector('.asset-dimensions').textContent =
            `${asset.width}×${asset.height} px`;

        // Show modal
        modal.classList.remove('hidden');

        // Re-initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Close asset details modal
     */
    closeAssetModal() {
        const modal = document.getElementById('asset-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.selectedAsset = null;
    }

    /**
     * Download selected asset (from modal)
     */
    async downloadSelectedAsset() {
        if (!this.selectedAsset) return;
        await this.downloadAsset(this.selectedAsset);
    }

    /**
     * Download asset (works from card or modal)
     */
    async downloadAsset(asset) {
        if (!asset) return;

        try {
            // For data URLs (SVGs), we can download directly
            if (asset.url.startsWith('data:')) {
                this.downloadDataURL(asset.url, asset.fileName);
                return;
            }

            // For regular URLs, fetch and download
            const response = await fetch(asset.url);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            this.downloadURL(url, asset.fileName);

            // Clean up
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to download asset:', error);
            alert('Failed to download asset. It may be blocked by CORS.');
        }
    }

    /**
     * Download data URL
     */
    downloadDataURL(dataUrl, fileName) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
    }

    /**
     * Download URL
     */
    downloadURL(url, fileName) {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (!bytes) return 'Unknown';

        const units = ['B', 'KB', 'MB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
}

// Export for use in sidepanel
if (typeof window !== 'undefined') {
    window.AssetsTab = AssetsTab;
}
