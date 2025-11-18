/**
 * Pages View Component
 * Displays saved product/service pages with AI summaries
 */

class PagesView {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this.pages = [];
        this.brandProfileId = null;
        this.editModal = null;
        this.init();
    }

    init() {
        // EditModal will be initialized by manage.js
    }

    setEditModal(modal) {
        this.editModal = modal;
    }

    async loadPages(brandProfileId) {
        this.brandProfileId = brandProfileId;

        if (!brandProfileId) {
            this.pages = [];
            this.renderPages();
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/pages/${brandProfileId}`);
            if (response.ok) {
                const data = await response.json();
                this.pages = data.pages || [];
                this.renderPages();
            } else {
                throw new Error('Failed to load pages');
            }
        } catch (error) {
            console.error('Failed to load pages:', error);
            this.pages = [];
            this.renderPages();
        }
    }

    renderPages() {
        const grid = document.getElementById('pages-grid');
        if (!grid) return;

        if (this.pages.length === 0) {
            grid.innerHTML = `
                <div class="pages-empty">
                    <i class="ki-outline ki-file-down"></i>
                    <h3>No pages saved yet</h3>
                    <p>Save product or service pages from the extension to see them here.</p>
                </div>
            `;
            return;
        }

        // Create pages list container
        const listContainer = document.createElement('div');
        listContainer.className = 'pages-list';

        this.pages.forEach(page => {
            const card = this.createPageCard(page);
            listContainer.appendChild(card);
        });

        grid.innerHTML = '';
        grid.appendChild(listContainer);
    }

    createPageCard(page) {
        const card = document.createElement('div');
        card.className = 'page-card';

        const typeIcon = page.type === 'product' ? 'box' : 'briefcase';
        const typeBadge = page.type.charAt(0).toUpperCase() + page.type.slice(1);
        const createdDate = new Date(page.createdAt * 1000).toLocaleDateString();

        card.innerHTML = `
            <div class="page-card-header">
                <div class="page-header-row">
                    <span class="page-type-badge ${page.type}">
                        <i class="ki-outline ki-${typeIcon}"></i>
                        ${typeBadge}
                    </span>
                    <span class="page-date">${createdDate}</span>
                </div>
                <h3 class="page-title">${this.escapeHtml(page.title || 'Untitled')}</h3>
                <p class="page-description">${this.escapeHtml(this.truncate(page.description || page.summary || 'No description', 150))}</p>
            </div>

            <div class="page-card-content">
                ${page.summary ? `
                    <div class="page-section">
                        <div class="page-section-header">
                            <i class="ki-outline ki-abstract-41"></i>
                            <h5 class="page-section-title">Summary</h5>
                        </div>
                        <div class="page-section-content">
                            <p>${this.escapeHtml(page.summary)}</p>
                        </div>
                    </div>
                ` : ''}

                ${page.valuePropositions && page.valuePropositions.length > 0 ? `
                    <div class="page-section">
                        <div class="page-section-header">
                            <i class="ki-outline ki-star"></i>
                            <h5 class="page-section-title">Value Propositions</h5>
                        </div>
                        <div class="page-section-content">
                            <ul class="page-section-list">
                                ${page.valuePropositions.map(vp => `<li>${this.escapeHtml(vp)}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                ` : ''}

                ${page.features && page.features.length > 0 ? `
                    <div class="page-section">
                        <div class="page-section-header">
                            <i class="ki-outline ki-setting-3"></i>
                            <h5 class="page-section-title">Features</h5>
                        </div>
                        <div class="page-section-content">
                            <ul class="page-section-list">
                                ${page.features.map(f => `<li>${this.escapeHtml(f)}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                ` : ''}

                ${page.benefits && page.benefits.length > 0 ? `
                    <div class="page-section">
                        <div class="page-section-header">
                            <i class="ki-outline ki-like"></i>
                            <h5 class="page-section-title">Benefits</h5>
                        </div>
                        <div class="page-section-content">
                            <ul class="page-section-list">
                                ${page.benefits.map(b => `<li>${this.escapeHtml(b)}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                ` : ''}

                ${page.targetAudience ? `
                    <div class="page-section">
                        <div class="page-section-header">
                            <i class="ki-outline ki-profile-user"></i>
                            <h5 class="page-section-title">Target Audience</h5>
                        </div>
                        <div class="page-section-content">
                            <p>${this.escapeHtml(page.targetAudience)}</p>
                        </div>
                    </div>
                ` : ''}

                <a href="${page.url}" target="_blank" rel="noopener noreferrer" class="page-link">
                    <i class="ki-outline ki-exit-right-corner"></i>
                    View Original Page
                </a>
            </div>

            <div class="page-card-footer">
                <button class="page-action-btn page-edit-btn" data-page-id="${page.id}">
                    <i class="ki-outline ki-pencil"></i>
                    Edit Summary
                </button>
                <button class="page-action-btn danger page-delete-btn" data-page-id="${page.id}">
                    <i class="ki-outline ki-trash"></i>
                    Delete
                </button>
            </div>
        `;

        // Edit button
        const editBtn = card.querySelector('.page-edit-btn');
        editBtn.addEventListener('click', () => this.openEditModal(page));

        // Delete button
        const deleteBtn = card.querySelector('.page-delete-btn');
        deleteBtn.addEventListener('click', () => this.deletePage(page));

        return card;
    }

    openEditModal(page) {
        if (this.editModal) {
            this.editModal.open(page, async (updatedPage) => {
                // Callback when page is updated
                await this.updatePageInList(updatedPage);
            });
        } else {
            console.error('Edit modal not initialized');
        }
    }

    async updatePageInList(updatedPage) {
        // Find and update page in list
        const index = this.pages.findIndex(p => p.id === updatedPage.id);
        if (index !== -1) {
            this.pages[index] = { ...this.pages[index], ...updatedPage };
            this.renderPages();
        }
    }

    async deletePage(page) {
        if (!confirm(`Delete "${page.title}"? This action cannot be undone.`)) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/pages/${page.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.pages = this.pages.filter(p => p.id !== page.id);
                this.renderPages();
                this.showNotification('Page deleted successfully', 'success');
            } else {
                throw new Error('Failed to delete page');
            }
        } catch (error) {
            console.error('Failed to delete page:', error);
            this.showNotification('Failed to delete page', 'error');
        }
    }

    truncate(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // TODO: Implement toast notification system
        alert(message);
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.PagesView = PagesView;
}
