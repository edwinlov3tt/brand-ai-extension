/**
 * Fonts Tab Component
 * Manages font display, categorization, and samples
 */

class FontsTab {
    constructor() {
        this.fonts = [];
        this.init();
    }

    /**
     * Initialize Fonts tab
     */
    init() {
        this.setupFontControls();
    }

    /**
     * Setup font management controls
     */
    setupFontControls() {
        const fontsTab = document.getElementById('fonts-tab');
        if (!fontsTab) return;

        // Check if controls already exist
        if (fontsTab.querySelector('.fonts-controls')) return;

        // Create controls container
        const controls = document.createElement('div');
        controls.className = 'fonts-controls';
        controls.innerHTML = `
            <div class="fonts-header">
                <h3 class="fonts-count">0 fonts</h3>
                <div class="fonts-actions">
                    <button class="add-text-btn" id="add-text-btn" title="Capture Text (Alt+Shift+T)">
                        <i data-lucide="file-text" class="icon-sm"></i>
                        Add Text
                    </button>
                    <button class="add-font-btn" title="Pick font from page">
                        <i data-lucide="plus" class="icon-sm"></i>
                        Add Font
                    </button>
                </div>
            </div>
        `;

        // Insert at top of tab
        const emptyState = fontsTab.querySelector('.empty-state');
        fontsTab.insertBefore(controls, emptyState);

        // Hide controls initially
        controls.style.display = 'none';

        // Setup event listeners
        controls.querySelector('.add-font-btn').addEventListener('click', () => {
            this.openFontPicker();
        });

        controls.querySelector('.add-text-btn').addEventListener('click', () => {
            this.openTextCapture();
        });

        // Initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Open text capture mode
     */
    openTextCapture() {
        // Dispatch event to activate inspector in text mode
        window.dispatchEvent(new CustomEvent('activateTextCapture'));
    }

    /**
     * Update fonts display
     */
    updateFonts(fonts) {
        this.fonts = fonts || [];

        const fontsTab = document.getElementById('fonts-tab');
        if (!fontsTab) return;

        const emptyState = fontsTab.querySelector('.empty-state');
        const controls = fontsTab.querySelector('.fonts-controls');

        if (this.fonts.length === 0) {
            // Show empty state
            emptyState.classList.remove('hidden');
            if (controls) controls.style.display = 'none';
            return;
        }

        // Hide empty state, show controls
        emptyState.classList.add('hidden');
        if (controls) {
            controls.style.display = 'block';
            controls.querySelector('.fonts-count').textContent = `${this.fonts.length} fonts`;
        }

        // Create or update fonts list
        this.renderFonts();
    }

    /**
     * Render fonts in list
     */
    renderFonts() {
        const fontsTab = document.getElementById('fonts-tab');
        if (!fontsTab) return;

        // Remove existing list
        const existingList = fontsTab.querySelector('.fonts-list');
        if (existingList) existingList.remove();

        // Create new list
        const list = document.createElement('div');
        list.className = 'fonts-list';

        // Group fonts by role
        const grouped = this.groupFontsByRole(this.fonts);

        // Render each role group
        Object.entries(grouped).forEach(([role, roleFonts]) => {
            if (roleFonts.length === 0) return;

            const section = document.createElement('div');
            section.className = 'font-role-section';

            const header = document.createElement('h4');
            header.className = 'font-role-header';
            header.textContent = this.formatRoleName(role);
            section.appendChild(header);

            const fontList = document.createElement('div');
            fontList.className = 'font-role-list';

            roleFonts.forEach(font => {
                const card = this.createFontCard(font);
                fontList.appendChild(card);
            });

            section.appendChild(fontList);
            list.appendChild(section);
        });

        fontsTab.appendChild(list);

        // Re-initialize icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Create font card element
     */
    createFontCard(font) {
        const card = document.createElement('div');
        card.className = 'font-card';

        // Font sample text
        const sampleText = 'The quick brown fox jumps over the lazy dog';

        card.innerHTML = `
            <div class="font-preview" style="font-family: ${font.family}">
                ${sampleText}
            </div>
            <div class="font-info">
                <div class="font-name">${font.family}</div>
                <div class="font-details">
                    ${font.size ? `<span class="font-size">${font.size}</span>` : ''}
                    ${font.weight ? `<span class="font-weight">Weight: ${font.weight}</span>` : ''}
                </div>
            </div>
            <div class="font-actions">
                <button class="font-action-btn copy-font-btn" title="Copy font name" data-family="${font.family}">
                    <i data-lucide="copy" class="icon-sm"></i>
                </button>
                <button class="font-action-btn delete-font-btn" title="Remove font">
                    <i data-lucide="trash-2" class="icon-sm"></i>
                </button>
            </div>
        `;

        // Copy button
        const copyBtn = card.querySelector('.copy-font-btn');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyFontToClipboard(font.family);
        });

        // Delete button
        const deleteBtn = card.querySelector('.delete-font-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteFont(font);
        });

        return card;
    }

    /**
     * Group fonts by role
     */
    groupFontsByRole(fonts) {
        const groups = {
            display: [],
            heading: [],
            body: [],
            detected: [],
            custom: []
        };

        fonts.forEach(font => {
            const role = font.role || 'detected';
            if (groups[role]) {
                groups[role].push(font);
            } else {
                groups.detected.push(font);
            }
        });

        return groups;
    }

    /**
     * Format role name for display
     */
    formatRoleName(role) {
        const names = {
            display: 'Display Fonts',
            heading: 'Heading Fonts',
            body: 'Body Fonts',
            detected: 'Detected Fonts',
            custom: 'Custom Fonts'
        };
        return names[role] || role.charAt(0).toUpperCase() + role.slice(1);
    }

    /**
     * Copy font name to clipboard
     */
    async copyFontToClipboard(fontFamily) {
        try {
            await navigator.clipboard.writeText(fontFamily);
            console.log(`Copied ${fontFamily} to clipboard`);
            // TODO: Show toast notification
        } catch (err) {
            console.error('Failed to copy font:', err);
        }
    }

    /**
     * Delete font
     */
    deleteFont(font) {
        // Dispatch event to parent controller
        window.dispatchEvent(new CustomEvent('deleteFont', { detail: font }));
    }

    /**
     * Open font picker
     */
    openFontPicker() {
        // Dispatch event to activate inspector in font mode
        window.dispatchEvent(new CustomEvent('activateFontPicker'));
    }
}

// Export for use in sidepanel
if (typeof window !== 'undefined') {
    window.FontsTab = FontsTab;
}
