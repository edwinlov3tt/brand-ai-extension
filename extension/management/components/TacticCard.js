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
        card.className = 'tactic-card';
        card.innerHTML = `
            <div class="tactic-card-header">
                <div class="tactic-icon">
                    ${this.getIcon()}
                </div>
                <div class="tactic-info">
                    <div class="tactic-name">${this.tactic.name}</div>
                    <div class="tactic-description">${this.tactic.description}</div>
                    <div class="tactic-meta">
                        <span>Max ${this.tactic.maxChars} chars</span>
                        <span>Max ${this.tactic.maxWords} words</span>
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

    getIcon() {
        const icons = {
            facebook_title: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
            google_headline: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
            linkedin_intro: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>',
            instagram_caption: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
            email_subject: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
            twitter_post: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>'
        };
        return icons[this.tactic.id] || icons.facebook_title;
    }
}

// Export for use in TacticGrid.js
if (typeof window !== 'undefined') {
    window.TacticCard = TacticCard;
}
