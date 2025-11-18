/**
 * Tactic Card Component
 * Individual tactic card with icon, name, and description
 */

class TacticCard {
    constructor(tactic, onClick) {
        this.tactic = tactic;
        this.onClick = onClick;
    }

    render() {
        const card = document.createElement('div');
        card.className = 'kt-card tactic-card';
        card.innerHTML = `
            <div class="tactic-card-body">
                <div class="tactic-card-header">
                    <div class="tactic-icon">
                        <i class="${this.getIconClass()}"></i>
                    </div>
                    <div class="tactic-info">
                        <h3 class="tactic-name">${this.tactic.name}</h3>
                        <p class="tactic-description">${this.tactic.description}</p>
                    </div>
                </div>
                <div class="tactic-footer">
                    <div class="tactic-meta">
                        ${this.tactic.multiComponent ? `
                            <span class="kt-badge kt-badge-secondary">
                                <i class="ki-outline ki-element-11 fs-7"></i>
                                ${this.tactic.components.length} components
                            </span>
                        ` : `
                            <span class="kt-badge kt-badge-secondary">
                                <i class="ki-outline ki-text fs-7"></i>
                                ${this.tactic.maxChars} chars
                            </span>
                            <span class="kt-badge kt-badge-secondary">
                                <i class="ki-outline ki-message-text fs-7"></i>
                                ${this.tactic.maxWords} words
                            </span>
                        `}
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            if (this.onClick) {
                this.onClick(this.tactic);
            }
        });

        return card;
    }

    getIconClass() {
        // Map tactic IDs to KeenIcon classes
        const icons = {
            facebook_title: 'ki-outline ki-facebook',
            google_headline: 'ki-outline ki-google',
            linkedin_intro: 'ki-outline ki-linkedin',
            instagram_caption: 'ki-outline ki-instagram',
            email_subject: 'ki-outline ki-sms',
            twitter_post: 'ki-outline ki-twitter'
        };
        return icons[this.tactic.id] || 'ki-outline ki-note-2';
    }
}

// Export for use in TacticGrid.js
if (typeof window !== 'undefined') {
    window.TacticCard = TacticCard;
}
