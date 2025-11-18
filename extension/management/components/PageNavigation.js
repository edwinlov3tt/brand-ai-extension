/**
 * Page Navigation Component
 * Handles navigation between Home, Tactics, History, and Settings pages
 */

class PageNavigation {
    constructor() {
        this.currentPage = 'tactics';
        this.setupNavigation();
    }

    setupNavigation() {
        // Sidebar navigation
        const navItems = document.querySelectorAll('.kt-sidebar-nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateToPage(page);
            });
        });
    }

    navigateToPage(pageName) {
        this.currentPage = pageName;

        // Close inline generation view if open
        const inlineGenerationView = document.getElementById('inline-generation-view');
        if (inlineGenerationView && !inlineGenerationView.classList.contains('hidden')) {
            inlineGenerationView.classList.add('hidden');
            // Show the page views
            document.querySelectorAll('.page-view').forEach(page => {
                page.classList.remove('hidden');
            });
        }

        // Update sidebar active state
        document.querySelectorAll('.kt-sidebar-nav-item').forEach(item => {
            if (item.dataset.page === pageName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Hide all pages
        document.querySelectorAll('.page-view').forEach(page => {
            page.classList.add('hidden');
        });

        // Show selected page
        const targetPage = document.getElementById(`page-${pageName}`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    getCurrentPage() {
        return this.currentPage;
    }
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.PageNavigation = PageNavigation;
}
