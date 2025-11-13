/**
 * Colors Tab Component
 * Manages color display, categorization, and editing
 */

class ColorsTab {
    constructor() {
        this.colors = [];
        this.init();
    }

    /**
     * Initialize Colors tab
     */
    init() {
        this.setupColorControls();
    }

    /**
     * Setup color management controls
     */
    setupColorControls() {
        const colorsTab = document.getElementById('colors-tab');
        if (!colorsTab) return;

        // Check if controls already exist
        if (colorsTab.querySelector('.colors-controls')) return;

        // Create controls container
        const controls = document.createElement('div');
        controls.className = 'colors-controls';
        controls.innerHTML = `
            <div class="colors-header">
                <h3 class="colors-count" data-count="0">Colors</h3>
                <button class="add-color-btn" title="Add custom color">
                    <i data-lucide="plus" class="icon-sm"></i>
                    Add Color
                </button>
            </div>
        `;

        // Insert at top of tab
        const emptyState = colorsTab.querySelector('.empty-state');
        colorsTab.insertBefore(controls, emptyState);

        // Hide controls initially
        controls.style.display = 'none';

        // Setup event listeners
        controls.querySelector('.add-color-btn').addEventListener('click', () => {
            this.openColorPicker();
        });

        // Initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Update colors display
     */
    updateColors(colors) {
        this.colors = colors || [];

        const colorsTab = document.getElementById('colors-tab');
        if (!colorsTab) return;

        const emptyState = colorsTab.querySelector('.empty-state');
        const controls = colorsTab.querySelector('.colors-controls');

        if (this.colors.length === 0) {
            // Show empty state
            emptyState.classList.remove('hidden');
            if (controls) controls.style.display = 'none';
            return;
        }

        // Hide empty state, show controls
        emptyState.classList.add('hidden');
        if (controls) {
            controls.style.display = 'block';
            const countElement = controls.querySelector('.colors-count');
            countElement.setAttribute('data-count', this.colors.length);
        }

        // Create or update colors grid
        this.renderColors();
    }

    /**
     * Render colors in grid
     */
    renderColors() {
        const colorsTab = document.getElementById('colors-tab');
        if (!colorsTab) return;

        // Remove existing grid
        const existingGrid = colorsTab.querySelector('.colors-grid');
        if (existingGrid) existingGrid.remove();

        // Create new grid
        const grid = document.createElement('div');
        grid.className = 'colors-grid';

        // Group colors by role
        const grouped = this.groupColorsByRole(this.colors);

        // Render each role group
        Object.entries(grouped).forEach(([role, roleColors]) => {
            if (roleColors.length === 0) return;

            const section = document.createElement('div');
            section.className = 'color-role-section';

            const header = document.createElement('h4');
            header.className = 'color-role-header';
            header.textContent = this.formatRoleName(role);
            section.appendChild(header);

            const colorList = document.createElement('div');
            colorList.className = 'color-role-list';

            roleColors.forEach(color => {
                const card = this.createColorCard(color);
                colorList.appendChild(card);
            });

            section.appendChild(colorList);
            grid.appendChild(section);
        });

        colorsTab.appendChild(grid);

        // Re-initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Create color card element
     */
    createColorCard(color) {
        const card = document.createElement('div');
        card.className = 'color-card';

        // Apply background color to the card
        card.style.backgroundColor = color.hex;

        const instances = color.frequency || color.instances || color.count || 0;

        card.innerHTML = `
            <div class="color-info">
                <div class="color-hex">${color.hex}</div>
                <div class="color-instances">${instances} instance${instances === 1 ? '' : 's'}</div>
            </div>
            <button class="color-copy-btn" title="Copy hex code">
                <i data-lucide="copy" class="icon-sm"></i>
            </button>
        `;

        // Copy button click handler
        const copyBtn = card.querySelector('.color-copy-btn');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyColorToClipboard(color.hex, copyBtn);
        });

        return card;
    }

    /**
     * Group colors by role
     */
    groupColorsByRole(colors) {
        const groups = {
            primary: [],
            secondary: [],
            accent: [],
            detected: [],
            custom: []
        };

        colors.forEach(color => {
            const role = color.role || 'detected';
            if (groups[role]) {
                groups[role].push(color);
            } else {
                groups.detected.push(color);
            }
        });

        return groups;
    }

    /**
     * Format role name for display
     */
    formatRoleName(role) {
        const names = {
            primary: 'Primary Colors',
            secondary: 'Secondary Colors',
            accent: 'Accent Colors',
            detected: 'Detected Colors',
            custom: 'Custom Colors'
        };
        return names[role] || role.charAt(0).toUpperCase() + role.slice(1);
    }

    /**
     * Copy color to clipboard
     */
    async copyColorToClipboard(hex, button) {
        try {
            await navigator.clipboard.writeText(hex);
            console.log(`Copied ${hex} to clipboard`);

            // Visual feedback - simple approach
            if (button) {
                const originalContent = button.innerHTML;
                button.classList.add('copied');
                button.innerHTML = '<i data-lucide="check" class="icon-sm"></i>';

                // Reinitialize icons
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }

                setTimeout(() => {
                    button.innerHTML = originalContent;
                    button.classList.remove('copied');

                    // Reinitialize icons again
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                    }
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to copy color:', err);
        }
    }

    /**
     * Delete color
     */
    deleteColor(color) {
        // Dispatch event to parent controller
        window.dispatchEvent(new CustomEvent('deleteColor', { detail: color }));
    }

    /**
     * Open color picker to add custom color
     */
    openColorPicker() {
        // Dispatch event to activate inspector in color mode
        window.dispatchEvent(new CustomEvent('activateColorPicker'));
    }

    /**
     * Convert HEX to RGB string
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return 'rgb(0, 0, 0)';

        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);

        return `rgb(${r}, ${g}, ${b})`;
    }
}

// Export for use in sidepanel
if (typeof window !== 'undefined') {
    window.ColorsTab = ColorsTab;
}
