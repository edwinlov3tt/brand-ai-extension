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

        // History page filter
        const historyFilter = document.getElementById('history-tactic-filter');
        if (historyFilter) {
            historyFilter.addEventListener('change', (e) => {
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
        // Render to both history lists
        const lists = [
            document.getElementById('history-list'),
            document.getElementById('history-page-list')
        ];

        lists.forEach(list => {
            if (!list) return;

            // Filter copies
            let filtered = this.adCopies;
            if (this.currentFilter) {
                filtered = this.adCopies.filter(copy => copy.tactic === this.currentFilter);
            }

            // Sort by date (newest first)
            filtered.sort((a, b) => b.createdAt - a.createdAt);

            if (filtered.length === 0) {
                list.innerHTML = '<p class="history-empty">No ad copy generated yet.</p>';
                return;
            }

            list.innerHTML = '';

            filtered.forEach(copy => {
                const item = document.createElement('div');
                item.className = 'history-item';

                // Check if this is a multi-component entry
                const isMultiComponent = copy.text && copy.text.startsWith('[');

                if (isMultiComponent) {
                    try {
                        const components = JSON.parse(copy.text);
                        item.innerHTML = this.renderMultiComponentHistoryItem(copy, components);
                        item.classList.add('multi-component-card');

                        // Make entire card clickable to copy all content
                        item.style.cursor = 'pointer';
                        item.addEventListener('click', (e) => {
                            // Don't trigger if clicking on individual copy buttons
                            if (e.target.closest('.copy-btn-small')) {
                                return;
                            }

                            this.copyMultiComponentContent(item, components);
                        });
                    } catch (e) {
                        // Fallback to regular rendering if JSON parse fails
                        item.innerHTML = this.renderSingleComponentHistoryItem(copy);
                    }
                } else {
                    item.innerHTML = this.renderSingleComponentHistoryItem(copy);
                }

                list.appendChild(item);
            });

            // Add copy event listeners for both regular and small copy buttons
            list.querySelectorAll('.copy-btn, .copy-btn-small').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const text = btn.dataset.text;
                    const isSmall = btn.classList.contains('copy-btn-small');

                    navigator.clipboard.writeText(text).then(() => {
                        const originalHTML = btn.innerHTML;

                        if (isSmall) {
                            btn.innerHTML = '<i class="ki-outline ki-check fs-7"></i>';
                            btn.style.color = 'var(--success-color)';
                        } else {
                            btn.innerHTML = '<i class="ki-outline ki-check"></i> Copied!';
                            btn.classList.add('copied');
                        }

                        setTimeout(() => {
                            btn.innerHTML = originalHTML;
                            btn.style.color = '';
                            btn.classList.remove('copied');
                        }, 1500);
                    });
                });
            });
        });
    }

    updateFilterOptions() {
        const filters = [
            document.getElementById('tactic-filter'),
            document.getElementById('history-tactic-filter')
        ];

        // Get unique tactics
        const tactics = [...new Set(this.adCopies.map(copy => copy.tactic))];

        filters.forEach(filter => {
            if (!filter) return;

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
        });
    }

    renderSingleComponentHistoryItem(copy) {
        return `
            <div class="history-item-header">
                <div class="history-tactic">${this.getTacticName(copy.tactic)}</div>
                <button class="copy-btn" data-text="${copy.text.replace(/"/g, '&quot;')}">
                    <i class="ki-outline ki-copy"></i>
                    Copy
                </button>
            </div>
            <div class="history-item-text">${copy.text}</div>
            <div class="history-item-footer">
                <div class="history-meta">
                    <span><i class="ki-outline ki-text fs-7"></i> ${copy.charCount} chars</span>
                    <span><i class="ki-outline ki-message-text fs-7"></i> ${copy.wordCount} words</span>
                    <span><i class="ki-outline ki-time fs-7"></i> ${this.formatDate(copy.createdAt)}</span>
                </div>
            </div>
        `;
    }

    renderMultiComponentHistoryItem(copy, components) {
        let componentsHTML = '';

        components.forEach((component, index) => {
            const isLast = index === components.length - 1;
            componentsHTML += `
                <div class="history-component-group ${isLast ? '' : 'history-component-separator'}">
                    <div class="history-component-name">${component.name}</div>
                    <div class="history-component-variations">
            `;

            component.variations.forEach((variation, varIndex) => {
                const escapedText = variation.text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                const displayText = variation.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

                componentsHTML += `
                    <div class="history-variation-item">
                        <span class="history-variation-label">${component.variations.length > 1 ? `${varIndex + 1}.` : ''}</span>
                        <span class="history-variation-text">${displayText}</span>
                        <button class="copy-btn-small" data-text="${escapedText}" title="Copy">
                            <i class="ki-outline ki-copy fs-7"></i>
                        </button>
                        <span class="history-variation-chars">${variation.charCount} chars</span>
                    </div>
                `;
            });

            componentsHTML += `
                    </div>
                </div>
            `;
        });

        return `
            <div class="history-item-header">
                <div class="history-tactic">${this.getTacticName(copy.tactic)}</div>
                <span class="history-badge">Multi-Component</span>
            </div>
            <div class="history-multi-component">
                ${componentsHTML}
            </div>
            <div class="history-item-footer">
                <div class="history-meta">
                    <span><i class="ki-outline ki-time fs-7"></i> ${this.formatDate(copy.createdAt)}</span>
                </div>
            </div>
        `;
    }

    copyMultiComponentContent(cardElement, components) {
        // Format all components and variations into copyable text
        let copyText = '';

        components.forEach((component, compIndex) => {
            copyText += `${component.name}:\n`;

            component.variations.forEach((variation, varIndex) => {
                if (component.variations.length > 1) {
                    copyText += `${varIndex + 1}. ${variation.text}\n`;
                } else {
                    copyText += `${variation.text}\n`;
                }
            });

            // Add spacing between components (but not after the last one)
            if (compIndex < components.length - 1) {
                copyText += '\n';
            }
        });

        // Copy to clipboard
        navigator.clipboard.writeText(copyText.trim()).then(() => {
            // Visual feedback: green border and "Copied!" badge
            const badge = cardElement.querySelector('.history-badge');
            const originalBadgeText = badge.textContent;

            // Add success state
            cardElement.style.borderColor = 'var(--success-color)';
            badge.textContent = 'Copied!';
            badge.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
            badge.style.color = 'var(--success-color)';
            badge.style.borderColor = 'var(--success-color)';

            // Reset after 2 seconds
            setTimeout(() => {
                cardElement.style.borderColor = '';
                badge.textContent = originalBadgeText;
                badge.style.backgroundColor = '';
                badge.style.color = '';
                badge.style.borderColor = '';
            }, 2000);
        });
    }

    getTacticName(tacticId) {
        const names = {
            facebook_title: 'Facebook Ad Title',
            google_headline: 'Google Search Headline',
            facebook_ad_copy: 'Facebook Ad Copy',
            facebook_carousel_ad: 'Facebook Carousel Ad',
            tiktok_ad_copy: 'TikTok Ad Copy',
            snapchat_ad_copy: 'Snapchat Ad Copy',
            linkedin_ad_copy: 'LinkedIn Ad Copy',
            pinterest_ad_copy: 'Pinterest Ad Copy',
            nextdoor_display_ad: 'Nextdoor Display Ad',
            nextdoor_sale_ad: 'Nextdoor For Sale/Free Ad',
            nextdoor_rail_ad: 'Nextdoor Right-Hand Rail Ad',
            native_ad_copy: 'Native Ad Copy',
            email_marketing_copy: 'Email Marketing Copy',
            spark_ad_copy: 'Spark Ad Copy',
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
