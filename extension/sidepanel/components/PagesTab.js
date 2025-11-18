/**
 * Pages Tab Component
 * Manages saved product/service pages with AI-generated summaries
 */

class PagesTab {
    constructor() {
        this.pages = [];
        this.brandProfileId = null;
        this.currentDomain = null;
        this.maxPages = 10;
        this.init();
    }

    /**
     * Initialize Pages tab
     */
    init() {
        this.setupPageControls();
    }

    /**
     * Setup page management controls
     */
    setupPageControls() {
        const pagesTab = document.getElementById('pages-tab');
        if (!pagesTab) return;

        // Check if controls already exist
        if (pagesTab.querySelector('.pages-controls')) return;

        // Create controls container
        const controls = document.createElement('div');
        controls.className = 'pages-controls';
        controls.innerHTML = `
            <div class="pages-header">
                <h3 class="pages-count" data-count="0">Pages</h3>
                <div class="pages-header-actions">
                    <button class="copy-all-btn" id="copy-all-pages-btn" title="Copy all pages">
                        <i data-lucide="copy" class="icon-sm"></i>
                    </button>
                    <select class="page-type-select" id="page-type-select">
                        <option value="service">Service</option>
                        <option value="product">Product</option>
                    </select>
                </div>
            </div>
            <div class="pages-limit-note">Up to ${this.maxPages} pages per brand</div>
        `;

        // Insert at top of tab
        const emptyState = pagesTab.querySelector('.empty-state');
        pagesTab.insertBefore(controls, emptyState);

        // Initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Set brand profile ID
     */
    setBrandProfile(brandProfileId, domain) {
        this.brandProfileId = brandProfileId;
        this.currentDomain = domain;

        // Load pages for this brand
        if (brandProfileId) {
            this.loadPages();
        }
    }

    /**
     * Update page type dropdown based on URL detection
     */
    updatePageTypeDropdown(url) {
        const detectedType = this.detectPageType(url);
        const dropdown = document.getElementById('page-type-select');
        if (dropdown) {
            dropdown.value = detectedType;
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
     * Load pages from database via API
     */
    async loadPages() {
        if (!this.brandProfileId) return;

        try {
            const response = await fetch(`${window.WORKER_URL}/api/pages/${this.brandProfileId}`);
            const data = await response.json();

            if (data.pages) {
                this.pages = data.pages;
                this.updatePagesDisplay();
            }
        } catch (error) {
            console.error('Failed to load pages:', error);
            this.showError('Failed to load pages');
        }
    }

    /**
     * Save current page
     */
    async saveCurrentPage() {
        if (!this.brandProfileId) {
            this.showError('No brand profile loaded');
            return;
        }

        if (this.pages.length >= this.maxPages) {
            this.showError(`Maximum of ${this.maxPages} pages reached`);
            return;
        }

        // Get current tab info
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Auto-detect and update page type dropdown
        this.updatePageTypeDropdown(tab.url);

        const pageType = document.getElementById('page-type-select').value;

        try {

            // Extract page metadata and content
            const pageData = await chrome.tabs.sendMessage(tab.id, {
                action: 'extractPageContent',
                type: pageType
            });

            // Send to worker API
            const response = await fetch(`${window.WORKER_URL}/api/pages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brandProfileId: this.brandProfileId,
                    url: tab.url,
                    title: pageData.title,
                    description: pageData.description,
                    metaImage: pageData.metaImage,
                    type: pageType,
                    pageContent: pageData.pageContent
                })
            });

            const data = await response.json();

            if (data.page) {
                this.pages.unshift(data.page);
                this.updatePagesDisplay();
                this.showSuccess('Page saved successfully!');
            } else {
                throw new Error(data.error || 'Failed to save page');
            }
        } catch (error) {
            console.error('Failed to save page:', error);
            this.showError(error.message || 'Failed to save page');
        }
    }

    /**
     * Update pages display
     */
    updatePagesDisplay() {
        const pagesTab = document.getElementById('pages-tab');
        if (!pagesTab) return;

        const emptyState = pagesTab.querySelector('.empty-state');
        const controls = pagesTab.querySelector('.pages-controls');

        if (this.pages.length === 0) {
            // Show empty state
            emptyState.classList.remove('hidden');
            return;
        }

        // Hide empty state
        emptyState.classList.add('hidden');

        // Update count
        if (controls) {
            const countElement = controls.querySelector('.pages-count');
            countElement.setAttribute('data-count', this.pages.length);
            countElement.textContent = `Pages (${this.pages.length}/${this.maxPages})`;
        }

        // Render pages
        this.renderPages();
    }

    /**
     * Render pages list
     */
    renderPages() {
        const pagesTab = document.getElementById('pages-tab');
        if (!pagesTab) return;

        // Remove existing list
        const existingList = pagesTab.querySelector('.pages-list');
        if (existingList) existingList.remove();

        // Create new list
        const list = document.createElement('div');
        list.className = 'pages-list';

        this.pages.forEach(page => {
            const card = this.createPageCard(page);
            list.appendChild(card);
        });

        pagesTab.appendChild(list);

        // Re-initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Create page card element
     */
    createPageCard(page) {
        const card = document.createElement('div');
        card.className = 'page-card';

        const typeIcon = page.type === 'product' ? 'package' : 'briefcase';
        const typeBadge = page.type.charAt(0).toUpperCase() + page.type.slice(1);

        card.innerHTML = `
            <div class="page-card-header">
                ${page.metaImage ? `
                    <div class="page-image" style="background-image: url('${page.metaImage}')"></div>
                ` : `
                    <div class="page-image-placeholder">
                        <i data-lucide="${typeIcon}" class="icon-lg"></i>
                    </div>
                `}
            </div>
            <div class="page-card-content">
                <div class="page-meta">
                    <span class="page-type-badge ${page.type}">
                        <i data-lucide="${typeIcon}" class="icon-xs"></i>
                        ${typeBadge}
                    </span>
                </div>
                <h4 class="page-title">${this.truncate(page.title || 'Untitled', 60)}</h4>
                <p class="page-description">${this.truncate(page.description || page.summary || 'No description', 120)}</p>
                <a href="${page.url}" target="_blank" rel="noopener noreferrer" class="page-link">
                    <i data-lucide="external-link" class="icon-xs"></i>
                    View Page
                </a>
            </div>
            <div class="page-card-actions">
                <button class="page-copy-btn icon-only" title="Copy page details">
                    <i data-lucide="copy" class="icon-sm"></i>
                </button>
                <button class="page-details-btn" title="View AI summary">
                    <i data-lucide="file-text" class="icon-sm"></i>
                    Summary
                </button>
                <button class="page-delete-btn" title="Delete page">
                    <i data-lucide="trash-2" class="icon-sm"></i>
                    Delete
                </button>
            </div>
            <div class="page-summary-panel hidden">
                <div class="summary-section">
                    <h5>Summary</h5>
                    <p>${page.summary || 'No summary available'}</p>
                </div>
                ${page.valuePropositions && page.valuePropositions.length > 0 ? `
                    <div class="summary-section">
                        <h5>Value Propositions</h5>
                        <ul>
                            ${page.valuePropositions.map(vp => `<li>${vp}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${page.features && page.features.length > 0 ? `
                    <div class="summary-section">
                        <h5>Key Features</h5>
                        <ul>
                            ${page.features.map(f => `<li>${f}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${page.benefits && page.benefits.length > 0 ? `
                    <div class="summary-section">
                        <h5>Benefits</h5>
                        <ul>
                            ${page.benefits.map(b => `<li>${b}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${page.targetAudience ? `
                    <div class="summary-section">
                        <h5>Target Audience</h5>
                        <p>${page.targetAudience}</p>
                    </div>
                ` : ''}
                <div class="summary-note">
                    <i data-lucide="info" class="icon-xs"></i>
                    Edit summaries in the Management page
                </div>
            </div>
        `;

        // Details toggle
        const detailsBtn = card.querySelector('.page-details-btn');
        const summaryPanel = card.querySelector('.page-summary-panel');
        detailsBtn.addEventListener('click', () => {
            summaryPanel.classList.toggle('hidden');
            detailsBtn.innerHTML = summaryPanel.classList.contains('hidden')
                ? '<i data-lucide="file-text" class="icon-sm"></i> Summary'
                : '<i data-lucide="x" class="icon-sm"></i> Hide';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });

        // Delete button
        const deleteBtn = card.querySelector('.page-delete-btn');
        deleteBtn.addEventListener('click', () => this.deletePage(page));

        return card;
    }

    /**
     * Delete page
     */
    async deletePage(page) {
        if (!confirm(`Delete "${page.title}"?`)) return;

        try {
            const response = await fetch(`${window.WORKER_URL}/api/pages/${page.id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                this.pages = this.pages.filter(p => p.id !== page.id);
                this.updatePagesDisplay();
                this.showSuccess('Page deleted');
            } else {
                throw new Error(data.error || 'Failed to delete page');
            }
        } catch (error) {
            console.error('Failed to delete page:', error);
            this.showError('Failed to delete page');
        }
    }

    /**
     * Truncate text with ellipsis
     */
    truncate(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * Show error message
     */
    showError(message) {
        // TODO: Implement toast notification system
        console.error(message);
        alert(message);
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        // TODO: Implement toast notification system
    }

    /**
     * Get all pages as text for copying
     */
    getAllPagesText() {
        if (this.pages.length === 0) {
            return 'No pages saved';
        }

        let text = '';
        this.pages.forEach((page, index) => {
            text += `${index + 1}. ${page.title || 'Untitled'} (${page.type})\n`;
            text += `   URL: ${page.url}\n`;
            if (page.summary) {
                text += `   Summary: ${page.summary}\n`;
            }
            text += '\n';
        });

        return text;
    }

    /**
     * Get single page card text for copying
     */
    getPageCardText(button) {
        const card = button.closest('.page-card');
        if (!card) return '';

        // Find the page data from the card
        const title = card.querySelector('.page-title')?.textContent || 'Untitled';
        const description = card.querySelector('.page-description')?.textContent || '';
        const url = card.querySelector('.page-link')?.href || '';
        const type = card.querySelector('.page-type-badge')?.textContent?.trim() || '';

        let text = `${title} (${type})\n`;
        text += `URL: ${url}\n`;
        if (description) {
            text += `Description: ${description}\n`;
        }

        // Get summary if expanded
        const summaryPanel = card.querySelector('.page-summary-panel');
        if (summaryPanel && !summaryPanel.classList.contains('hidden')) {
            const summaryText = summaryPanel.querySelector('.summary-section p')?.textContent;
            if (summaryText) {
                text += `\nSummary:\n${summaryText}\n`;
            }
        }

        return text;
    }
}

// Export for use in sidepanel
if (typeof window !== 'undefined') {
    window.PagesTab = PagesTab;
}
