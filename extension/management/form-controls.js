/**
 * Form Controls for Inline Generation View
 * Handles collapsible sections, character counter, and interactions
 */

// Setup collapsible sections
function setupCollapsibleSections() {
    const outputSettingsHeader = document.getElementById('output-settings-header');
    const outputSettingsContent = document.getElementById('output-settings-content');

    if (outputSettingsHeader && outputSettingsContent) {
        outputSettingsHeader.addEventListener('click', () => {
            const isHidden = outputSettingsContent.classList.contains('hidden');

            if (isHidden) {
                outputSettingsContent.classList.remove('hidden');
                outputSettingsHeader.classList.remove('collapsed');
            } else {
                outputSettingsContent.classList.add('hidden');
                outputSettingsHeader.classList.add('collapsed');
            }
        });
    }
}

// Setup character counter for textarea
function setupCharacterCounter() {
    const textarea = document.getElementById('inline-tactic-objective');
    const counter = document.getElementById('objective-char-count');

    if (textarea && counter) {
        textarea.addEventListener('input', () => {
            const count = textarea.value.length;
            counter.textContent = count;
        });
    }
}

// Update variations counter display in section header
function updateVariationsDisplay(count) {
    const valueDisplay = document.querySelector('.settings-section-value');
    if (valueDisplay) {
        valueDisplay.textContent = `${count} variation${count !== 1 ? 's' : ''}`;
    }
}

// Setup number controls for variations
function setupNumberControls() {
    const decreaseBtn = document.getElementById('inline-decrease-variations');
    const increaseBtn = document.getElementById('inline-increase-variations');
    const input = document.getElementById('inline-tactic-variations');

    if (decreaseBtn && increaseBtn && input) {
        decreaseBtn.addEventListener('click', () => {
            const currentValue = parseInt(input.value);
            const min = parseInt(input.min) || 1;
            if (currentValue > min) {
                input.value = currentValue - 1;
                updateVariationsDisplay(currentValue - 1);
            }
        });

        increaseBtn.addEventListener('click', () => {
            const currentValue = parseInt(input.value);
            const max = parseInt(input.max) || 10;
            if (currentValue < max) {
                input.value = currentValue + 1;
                updateVariationsDisplay(currentValue + 1);
            }
        });

        // Initialize display
        updateVariationsDisplay(parseInt(input.value));
    }
}

// Initialize all form controls
function initFormControls() {
    setupCollapsibleSections();
    setupCharacterCounter();
    setupNumberControls();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormControls);
} else {
    initFormControls();
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.formControls = {
        init: initFormControls,
        updateVariationsDisplay
    };
}
