/**
 * Ad Copy History Component
 * Displays all generated ad copies with filtering
 */

class AdCopyHistory {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this.adCopies = [];
        this.currentDomain = null;
        this.currentFilter = '';
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const filter = document.getElementById('tactic-filter');
        if (filter) {
            filter.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                this.renderHistory();
            });
        }
    }

    async loadHistory(domain) {
        this.currentDomain = domain;

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/ad-copies/${domain}`);
            if (response.ok) {
                const data = await response.json();
                this.adCopies = data.adCopies || [];
                this.renderHistory();
                this.updateFilterOptions();
            }
        } catch (error) {
            console.error('Failed to load ad copy history:', error);
            this.adCopies = [];
            this.renderHistory();
        }
    }

    renderHistory() {
        const list = document.getElementById('history-list');
        if (!list) return;

        // Filter copies
        let filtered = this.adCopies;
        if (this.currentFilter) {
            filtered = this.adCopies.filter(copy => copy.tactic === this.currentFilter);
        }

        // Sort by date (newest first)
        filtered.sort((a, b) => b.createdAt - a.createdAt);

        if (filtered.length === 0) {
            list.innerHTML = '<p class="history-empty">No ad copy generated yet. Start by selecting a tactic above.</p>';
            return;
        }

        list.innerHTML = '';

        filtered.forEach(copy => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="history-item-header">
                    <div class="history-tactic">${this.getTacticName(copy.tactic)}</div>
                    <button class="copy-btn" data-text="${copy.text.replace(/"/g, '&quot;')}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copy
                    </button>
                </div>
                <div class="history-item-text">${copy.text}</div>
                <div class="history-item-footer">
                    <div class="history-meta">
                        <span>${copy.charCount} chars</span>
                        <span>${copy.wordCount} words</span>
                        <span>${this.formatDate(copy.createdAt)}</span>
                    </div>
                </div>
            `;
            list.appendChild(item);
        });

        // Add copy event listeners
        list.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.dataset.text;
                navigator.clipboard.writeText(text).then(() => {
                    btn.textContent = 'Copied!';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy`;
                        btn.classList.remove('copied');
                    }, 2000);
                });
            });
        });
    }

    updateFilterOptions() {
        const filter = document.getElementById('tactic-filter');
        if (!filter) return;

        // Get unique tactics
        const tactics = [...new Set(this.adCopies.map(copy => copy.tactic))];

        // Preserve current selection
        const currentValue = filter.value;

        filter.innerHTML = '<option value="">All Tactics</option>';

        tactics.forEach(tacticId => {
            const option = document.createElement('option');
            option.value = tacticId;
            option.textContent = this.getTacticName(tacticId);
            filter.appendChild(option);
        });

        filter.value = currentValue;
    }

    getTacticName(tacticId) {
        const names = {
            facebook_title: 'Facebook Ad Title',
            google_headline: 'Google Search Headline',
            linkedin_intro: 'LinkedIn Ad Intro',
            instagram_caption: 'Instagram Caption',
            email_subject: 'Email Subject Line',
            twitter_post: 'Twitter/X Post'
        };
        return names[tacticId] || tacticId;
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        // Less than 1 minute
        if (diff < 60000) {
            return 'Just now';
        }

        // Less than 1 hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        }

        // Less than 1 day
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        }

        // Less than 7 days
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days}d ago`;
        }

        // Otherwise show date
        return date.toLocaleDateString();
    }

    refresh() {
        if (this.currentDomain) {
            this.loadHistory(this.currentDomain);
        }
    }
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.AdCopyHistory = AdCopyHistory;
}
