/**
 * Brand Selector Component
 * Manages brand selection dropdown populated from localStorage
 */

class BrandSelector {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this.currentBrand = null;
        this.brands = [];
        this.onBrandChange = null;
        this.init();
    }

    async init() {
        await this.loadBrands();
        this.setupEventListeners();

        // Check URL params for brand
        const urlParams = new URLSearchParams(window.location.search);
        const domain = urlParams.get('domain');
        if (domain) {
            await this.selectBrand(domain);
        }
    }

    async loadBrands() {
        try {
            // Try to load from extension localStorage if available
            if (window.chrome && chrome.storage) {
                const result = await chrome.storage.local.get(['brandData']);
                if (result.brandData?.profile) {
                    this.brands.push({
                        domain: result.brandData.profile.metadata.domain,
                        name: result.brandData.profile.brand.name
                    });
                }
            }

            // Also fetch from API
            const response = await fetch(`${this.apiBaseUrl}/api/brands`);
            if (response.ok) {
                const data = await response.json();
                // Merge and dedupe
                const existingDomains = new Set(this.brands.map(b => b.domain));
                data.brands.forEach(brand => {
                    if (!existingDomains.has(brand.domain)) {
                        this.brands.push(brand);
                    }
                });
            }

            this.renderDropdown();
        } catch (error) {
            console.error('Failed to load brands:', error);
        }
    }

    renderDropdown() {
        const dropdown = document.getElementById('brand-dropdown');
        if (!dropdown) return;

        // Clear existing options except first
        dropdown.innerHTML = '<option value="">Select a brand...</option>';

        // Add brand options
        this.brands.forEach(brand => {
            const option = document.createElement('option');
            option.value = brand.domain;
            option.textContent = brand.name || brand.domain;
            dropdown.appendChild(option);
        });
    }

    setupEventListeners() {
        const dropdown = document.getElementById('brand-dropdown');
        if (dropdown) {
            dropdown.addEventListener('change', (e) => {
                const domain = e.target.value;
                if (domain) {
                    this.selectBrand(domain);
                }
            });
        }
    }

    async selectBrand(domain) {
        try {
            // Fetch brand profile from API
            const response = await fetch(`${this.apiBaseUrl}/api/brand-profile/${domain}`);
            if (!response.ok) {
                throw new Error('Brand not found');
            }

            const data = await response.json();
            // API returns the brand profile directly, not wrapped in a 'profile' property
            this.currentBrand = data;

            // Update dropdown selection
            const dropdown = document.getElementById('brand-dropdown');
            if (dropdown) {
                dropdown.value = domain;
            }

            // Trigger callback
            if (this.onBrandChange) {
                this.onBrandChange(this.currentBrand);
            }

            // Update URL
            const url = new URL(window.location);
            url.searchParams.set('domain', domain);
            window.history.pushState({}, '', url);

        } catch (error) {
            console.error('Failed to load brand:', error);
            alert('Failed to load brand profile. Please try again.');
        }
    }

    getCurrentBrand() {
        return this.currentBrand;
    }
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.BrandSelector = BrandSelector;
}
