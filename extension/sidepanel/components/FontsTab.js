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
                <h3 class="fonts-count" data-count="0">Fonts</h3>
                <div class="fonts-actions">
                    <button class="add-font-btn" title="Pick font from page (Alt+Shift+F)">
                        <i data-lucide="case-sensitive" class="icon-sm"></i>
                        Pick Font
                    </button>
                    <button class="add-text-btn" id="add-text-btn" title="Capture Text (Alt+Shift+T)">
                        <i data-lucide="file-text" class="icon-sm"></i>
                        Add Text
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
            const countElement = controls.querySelector('.fonts-count');
            countElement.setAttribute('data-count', this.fonts.length);
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

        const instances = font.instances || font.count || 1;
        const fontSize = font.size || '16px';
        const lineHeight = font.lineHeight || 'normal';
        const weight = font.weight || '400';
        const letterSpacing = font.letterSpacing || 'normal';
        const textColor = font.color || '#FFFFFF';
        const contrast = font.contrast || 'N/A';

        card.innerHTML = `
            <div class="font-card-header">
                <div class="font-header-info">
                    <div class="font-name">${font.family}</div>
                    <div class="font-instances">${instances} instance${instances !== 1 ? 's' : ''}</div>
                </div>
                <button class="font-delete-btn" title="Remove font">
                    <i data-lucide="trash-2" class="icon-sm"></i>
                </button>
            </div>
            <div class="font-preview" style="font-family: '${font.family}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: ${fontSize}; font-weight: ${weight};">
                AaBbCcDdEe
            </div>
            <button class="font-details-toggle">
                <span class="toggle-text">More details</span>
                <i data-lucide="chevron-down" class="icon-sm toggle-icon"></i>
            </button>
            <div class="font-details-panel hidden">
                <div class="detail-row">
                    <span class="detail-label">Font family</span>
                    <span class="detail-value">${font.family}</span>
                </div>
                ${font.fontUrl ? `
                <div class="detail-row">
                    <span class="detail-label">Google Fonts</span>
                    <div class="detail-value font-url-value">
                        <a href="${font.fontUrl}" target="_blank" rel="noopener noreferrer" class="font-url-link" title="Open Google Fonts link">
                            <i data-lucide="external-link" class="icon-xs"></i>
                            View Font
                        </a>
                        <button class="copy-url-btn" data-url="${font.fontUrl}" title="Copy URL">
                            <i data-lucide="copy" class="icon-xs"></i>
                        </button>
                    </div>
                </div>
                ` : ''}
                <div class="detail-row">
                    <span class="detail-label">Font size</span>
                    <span class="detail-value">${fontSize}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Line height</span>
                    <span class="detail-value">${lineHeight}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Weight</span>
                    <span class="detail-value">${weight}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Letter spacing</span>
                    <span class="detail-value">${letterSpacing}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Text color</span>
                    <div class="detail-value color-value">
                        <span class="color-swatch" style="background-color: ${textColor}"></span>
                        <span>${textColor}</span>
                    </div>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Contrast</span>
                    <span class="detail-value">${contrast}</span>
                </div>
            </div>
        `;

        // Delete button
        const deleteBtn = card.querySelector('.font-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteFont(font);
        });

        // Details toggle
        const toggleBtn = card.querySelector('.font-details-toggle');
        const detailsPanel = card.querySelector('.font-details-panel');
        const toggleIcon = card.querySelector('.toggle-icon');
        const toggleText = card.querySelector('.toggle-text');

        toggleBtn.addEventListener('click', () => {
            detailsPanel.classList.toggle('hidden');
            toggleIcon.style.transform = detailsPanel.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
            toggleText.textContent = detailsPanel.classList.contains('hidden') ? 'More details' : 'Hide details';
        });

        // Copy URL button
        const copyUrlBtn = card.querySelector('.copy-url-btn');
        if (copyUrlBtn) {
            copyUrlBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = copyUrlBtn.dataset.url;
                navigator.clipboard.writeText(url).then(() => {
                    // Visual feedback
                    const icon = copyUrlBtn.querySelector('i');
                    const originalIcon = icon.getAttribute('data-lucide');
                    icon.setAttribute('data-lucide', 'check');
                    if (typeof lucide !== 'undefined') lucide.createIcons();

                    setTimeout(() => {
                        icon.setAttribute('data-lucide', originalIcon);
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy URL:', err);
                });
            });
        }

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
