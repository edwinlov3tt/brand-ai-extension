/**
 * Page Edit Modal Component
 * Modal for editing AI-generated page summaries
 */

class PageEditModal {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this.currentPage = null;
        this.onSaveCallback = null;
        this.init();
    }

    init() {
        this.createModal();
    }

    createModal() {
        // Check if modal already exists
        if (document.getElementById('page-edit-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'page-edit-modal';
        modal.className = 'modal-overlay hidden';
        modal.innerHTML = `
            <div class="modal-container modal-lg">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="ki-outline ki-pencil fs-2"></i>
                        Edit Page Summary
                    </h2>
                    <button class="modal-close-btn" id="page-modal-close-btn">
                        <i class="ki-outline ki-cross fs-1"></i>
                    </button>
                </div>

                <div class="modal-body" id="page-modal-body">
                    <!-- Form will be injected here -->
                </div>

                <div class="modal-footer">
                    <button class="btn-secondary" id="page-modal-cancel-btn">Cancel</button>
                    <button class="btn-primary" id="page-modal-save-btn">
                        <i class="ki-outline ki-check fs-3"></i>
                        Save Changes
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup event listeners
        const closeBtn = modal.querySelector('#page-modal-close-btn');
        const cancelBtn = modal.querySelector('#page-modal-cancel-btn');
        const saveBtn = modal.querySelector('#page-modal-save-btn');

        closeBtn.addEventListener('click', () => this.close());
        cancelBtn.addEventListener('click', () => this.close());
        saveBtn.addEventListener('click', () => this.save());

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close();
            }
        });
    }

    open(page, onSaveCallback) {
        this.currentPage = page;
        this.onSaveCallback = onSaveCallback;
        this.renderForm();

        const modal = document.getElementById('page-edit-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    close() {
        const modal = document.getElementById('page-edit-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.currentPage = null;
        this.onSaveCallback = null;
    }

    renderForm() {
        const body = document.getElementById('page-modal-body');
        if (!body || !this.currentPage) return;

        const page = this.currentPage;

        body.innerHTML = `
            <div class="page-edit-form">
                <div class="form-group">
                    <label class="form-label">
                        <i class="ki-outline ki-abstract-41 fs-5"></i>
                        Summary
                    </label>
                    <textarea id="edit-summary" class="kt-input form-textarea" rows="4" placeholder="Brief overview of the product/service">${this.escapeHtml(page.summary || '')}</textarea>
                    <span class="form-hint">A 2-3 sentence overview of what this ${page.type} is and what it does</span>
                </div>

                <div class="form-group">
                    <label class="form-label">
                        <i class="ki-outline ki-star fs-5"></i>
                        Value Propositions
                    </label>
                    <div id="value-props-list" class="editable-list">
                        ${this.renderEditableList(page.valuePropositions || [], 'value-prop')}
                    </div>
                    <button type="button" class="btn-secondary btn-sm" id="add-value-prop-btn">
                        <i class="ki-outline ki-plus fs-5"></i>
                        Add Value Proposition
                    </button>
                </div>

                <div class="form-group">
                    <label class="form-label">
                        <i class="ki-outline ki-setting-3 fs-5"></i>
                        Key Features
                    </label>
                    <div id="features-list" class="editable-list">
                        ${this.renderEditableList(page.features || [], 'feature')}
                    </div>
                    <button type="button" class="btn-secondary btn-sm" id="add-feature-btn">
                        <i class="ki-outline ki-plus fs-5"></i>
                        Add Feature
                    </button>
                </div>

                <div class="form-group">
                    <label class="form-label">
                        <i class="ki-outline ki-badge fs-5"></i>
                        Benefits
                    </label>
                    <div id="benefits-list" class="editable-list">
                        ${this.renderEditableList(page.benefits || [], 'benefit')}
                    </div>
                    <button type="button" class="btn-secondary btn-sm" id="add-benefit-btn">
                        <i class="ki-outline ki-plus fs-5"></i>
                        Add Benefit
                    </button>
                </div>

                <div class="form-group">
                    <label class="form-label">
                        <i class="ki-outline ki-profile-user fs-5"></i>
                        Target Audience
                    </label>
                    <textarea id="edit-target-audience" class="kt-input form-textarea" rows="3" placeholder="Description of the ideal customer or user">${this.escapeHtml(page.targetAudience || '')}</textarea>
                </div>

                <div class="form-group">
                    <label class="form-label">
                        <i class="ki-outline ki-message-text-2 fs-5"></i>
                        Tone & Style
                    </label>
                    <input type="text" id="edit-tone" class="kt-input" placeholder="e.g., professional, casual, technical, friendly" value="${this.escapeHtml(page.tone || '')}">
                </div>

                <div class="form-group">
                    <label class="form-label">
                        <i class="ki-outline ki-tag fs-5"></i>
                        Keywords
                    </label>
                    <div id="keywords-list" class="editable-list">
                        ${this.renderEditableList(page.keywords || [], 'keyword')}
                    </div>
                    <button type="button" class="btn-secondary btn-sm" id="add-keyword-btn">
                        <i class="ki-outline ki-plus fs-5"></i>
                        Add Keyword
                    </button>
                </div>
            </div>
        `;

        // Setup add buttons
        document.getElementById('add-value-prop-btn').addEventListener('click', () => this.addListItem('value-props-list', 'value-prop'));
        document.getElementById('add-feature-btn').addEventListener('click', () => this.addListItem('features-list', 'feature'));
        document.getElementById('add-benefit-btn').addEventListener('click', () => this.addListItem('benefits-list', 'benefit'));
        document.getElementById('add-keyword-btn').addEventListener('click', () => this.addListItem('keywords-list', 'keyword'));
    }

    renderEditableList(items, className) {
        if (items.length === 0) {
            return `<div class="editable-list-item ${className}-item">
                <input type="text" class="kt-input" placeholder="Enter ${className.replace('-', ' ')}">
                <button type="button" class="delete-item-btn" title="Delete">
                    <i class="ki-outline ki-trash fs-5"></i>
                </button>
            </div>`;
        }

        return items.map(item => `
            <div class="editable-list-item ${className}-item">
                <input type="text" class="kt-input" value="${this.escapeHtml(item)}">
                <button type="button" class="delete-item-btn" title="Delete">
                    <i class="ki-outline ki-trash fs-5"></i>
                </button>
            </div>
        `).join('');
    }

    addListItem(listId, className) {
        const list = document.getElementById(listId);
        if (!list) return;

        const item = document.createElement('div');
        item.className = `editable-list-item ${className}-item`;
        item.innerHTML = `
            <input type="text" class="kt-input" placeholder="Enter ${className.replace('-', ' ')}">
            <button type="button" class="delete-item-btn" title="Delete">
                <i class="ki-outline ki-trash fs-5"></i>
            </button>
        `;

        const deleteBtn = item.querySelector('.delete-item-btn');
        deleteBtn.addEventListener('click', () => item.remove());

        list.appendChild(item);
        item.querySelector('input').focus();
    }

    async save() {
        if (!this.currentPage) return;

        // Collect form data
        const summary = document.getElementById('edit-summary').value.trim();
        const targetAudience = document.getElementById('edit-target-audience').value.trim();
        const tone = document.getElementById('edit-tone').value.trim();

        const valuePropositions = this.collectListValues('.value-prop-item input');
        const features = this.collectListValues('.feature-item input');
        const benefits = this.collectListValues('.benefit-item input');
        const keywords = this.collectListValues('.keyword-item input');

        // Validate
        if (!summary) {
            alert('Summary is required');
            return;
        }

        const updatedPage = {
            summary,
            valuePropositions,
            features,
            benefits,
            targetAudience,
            tone,
            keywords
        };

        // Show loading state
        const saveBtn = document.getElementById('page-modal-save-btn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="ki-outline ki-loading fs-3"></i> Saving...';

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/pages/${this.currentPage.id}/edit`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedPage)
            });

            if (response.ok) {
                this.close();
                if (this.onSaveCallback) {
                    this.onSaveCallback({ id: this.currentPage.id, ...updatedPage });
                }
            } else {
                throw new Error('Failed to save changes');
            }
        } catch (error) {
            console.error('Failed to save page:', error);
            alert('Failed to save changes. Please try again.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="ki-outline ki-check fs-3"></i> Save Changes';
        }
    }

    collectListValues(selector) {
        const inputs = document.querySelectorAll(selector);
        return Array.from(inputs)
            .map(input => input.value.trim())
            .filter(value => value.length > 0);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Setup delete button listeners when items are rendered
document.addEventListener('click', (e) => {
    if (e.target.closest('.delete-item-btn')) {
        e.target.closest('.editable-list-item').remove();
    }
});

// Make available globally
if (typeof window !== 'undefined') {
    window.PageEditModal = PageEditModal;
}
