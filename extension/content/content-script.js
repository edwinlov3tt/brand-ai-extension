/**
 * Brand Inspector - Content Script
 * Injected into web pages to enable element inspection and brand extraction
 */

// Prevent multiple injections
if (!window.__BRAND_INSPECTOR_LOADED__) {
    window.__BRAND_INSPECTOR_LOADED__ = true;

    console.log('Brand Inspector content script loaded');

    class BrandInspectorContent {
        constructor() {
            this.inspectorActive = false;
            this.currentMode = null;
            this.overlay = null;
            this.tooltip = null;

            this.init();
        }

        /**
         * Initialize content script
         */
        init() {
            // Listen for messages from service worker and side panel
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.handleMessage(message, sender, sendResponse);
                return true; // Keep channel open
            });

            // Listen for keyboard events
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.inspectorActive) {
                    this.deactivateInspector();
                }
            });

            console.log('Brand Inspector content script initialized');
        }

        /**
         * Handle incoming messages
         */
        handleMessage(message, sender, sendResponse) {
            console.log('Content script received message:', message.action);

            switch (message.action) {
                case 'ACTIVATE_INSPECTOR':
                    this.activateInspector(message.mode);
                    sendResponse({ activated: true });
                    break;

                case 'DEACTIVATE_INSPECTOR':
                    this.deactivateInspector();
                    sendResponse({ deactivated: true });
                    break;

                case 'EXTRACT_BRAND_DATA':
                    this.extractBrandData().then(data => {
                        sendResponse({ extracted: true, data });
                    });
                    return true; // Async response

                default:
                    console.warn('Unknown message action:', message.action);
                    sendResponse({ error: 'Unknown action' });
            }
        }

        /**
         * Activate inspector mode
         */
        activateInspector(mode) {
            console.log(`Activating inspector in ${mode} mode`);

            this.inspectorActive = true;
            this.currentMode = mode;

            // Create overlay and tooltip
            this.createInspectorUI();

            // Add event listeners
            document.addEventListener('mouseover', this.handleMouseOver.bind(this));
            document.addEventListener('mouseout', this.handleMouseOut.bind(this));
            document.addEventListener('click', this.handleClick.bind(this), true);

            // Change cursor
            document.body.style.cursor = 'crosshair';

            // Notify service worker
            chrome.runtime.sendMessage({
                action: 'INSPECTOR_ACTIVATED',
                mode: mode
            });
        }

        /**
         * Deactivate inspector mode
         */
        deactivateInspector() {
            console.log('Deactivating inspector');

            this.inspectorActive = false;
            this.currentMode = null;

            // Remove UI elements
            if (this.overlay) {
                this.overlay.remove();
                this.overlay = null;
            }
            if (this.tooltip) {
                this.tooltip.remove();
                this.tooltip = null;
            }

            // Remove event listeners
            document.removeEventListener('mouseover', this.handleMouseOver.bind(this));
            document.removeEventListener('mouseout', this.handleMouseOut.bind(this));
            document.removeEventListener('click', this.handleClick.bind(this), true);

            // Reset cursor
            document.body.style.cursor = '';

            // Notify service worker
            chrome.runtime.sendMessage({
                action: 'INSPECTOR_DEACTIVATED'
            });
        }

        /**
         * Create inspector UI elements
         */
        createInspectorUI() {
            // Create overlay div for highlighting elements
            this.overlay = document.createElement('div');
            this.overlay.id = '__brand-inspector-overlay__';
            this.overlay.style.cssText = `
                position: absolute;
                pointer-events: none;
                z-index: 2147483646;
                border: 2px dashed #4A90E2;
                background: rgba(74, 144, 226, 0.1);
                display: none;
            `;
            document.body.appendChild(this.overlay);

            // Create tooltip for showing element info
            this.tooltip = document.createElement('div');
            this.tooltip.id = '__brand-inspector-tooltip__';
            this.tooltip.style.cssText = `
                position: absolute;
                pointer-events: none;
                z-index: 2147483647;
                background: #fff;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 8px 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                display: none;
                max-width: 300px;
            `;
            document.body.appendChild(this.tooltip);
        }

        /**
         * Handle mouse over event
         */
        handleMouseOver(e) {
            if (!this.inspectorActive) return;

            const element = e.target;

            // Skip inspector UI elements
            if (element.id?.startsWith('__brand-inspector-')) return;

            // Highlight element
            this.highlightElement(element);

            // Show tooltip
            this.showTooltip(element, e.clientX, e.clientY);
        }

        /**
         * Handle mouse out event
         */
        handleMouseOut(e) {
            if (!this.inspectorActive) return;

            // Hide overlay and tooltip
            if (this.overlay) this.overlay.style.display = 'none';
            if (this.tooltip) this.tooltip.style.display = 'none';
        }

        /**
         * Handle click event
         */
        handleClick(e) {
            if (!this.inspectorActive) return;

            e.preventDefault();
            e.stopPropagation();

            const element = e.target;

            // Skip inspector UI elements
            if (element.id?.startsWith('__brand-inspector-')) return;

            // Extract element data based on mode
            const data = this.extractElementData(element, this.currentMode);

            // Send to service worker
            chrome.runtime.sendMessage({
                action: 'ELEMENT_SELECTED',
                element: data,
                mode: this.currentMode
            });

            // Deactivate inspector
            this.deactivateInspector();
        }

        /**
         * Highlight an element
         */
        highlightElement(element) {
            const rect = element.getBoundingClientRect();

            this.overlay.style.display = 'block';
            this.overlay.style.top = (rect.top + window.scrollY) + 'px';
            this.overlay.style.left = (rect.left + window.scrollX) + 'px';
            this.overlay.style.width = rect.width + 'px';
            this.overlay.style.height = rect.height + 'px';
        }

        /**
         * Show tooltip with element info
         */
        showTooltip(element, x, y) {
            const style = window.getComputedStyle(element);

            let content = `<strong>${element.tagName.toLowerCase()}</strong>`;

            if (this.currentMode === 'color') {
                const bgColor = style.backgroundColor;
                const color = style.color;
                content += `<br>Background: <span style="color: ${bgColor}">${bgColor}</span>`;
                content += `<br>Text: <span style="color: ${color}">${color}</span>`;
            } else if (this.currentMode === 'font') {
                content += `<br>Font: ${style.fontFamily}`;
                content += `<br>Size: ${style.fontSize}`;
                content += `<br>Weight: ${style.fontWeight}`;
            } else if (this.currentMode === 'text') {
                const text = element.textContent?.trim().slice(0, 50);
                content += `<br>Text: "${text}..."`;
            }

            this.tooltip.innerHTML = content;
            this.tooltip.style.display = 'block';
            this.tooltip.style.top = (y + 10) + 'px';
            this.tooltip.style.left = (x + 10) + 'px';
        }

        /**
         * Extract element data based on mode
         */
        extractElementData(element, mode) {
            const style = window.getComputedStyle(element);

            if (mode === 'color') {
                return {
                    hex: this.rgbToHex(style.backgroundColor),
                    rgb: style.backgroundColor,
                    role: 'custom'
                };
            } else if (mode === 'font') {
                return {
                    family: style.fontFamily.split(',')[0].replace(/["']/g, ''),
                    size: style.fontSize,
                    weight: style.fontWeight,
                    role: 'custom'
                };
            } else if (mode === 'text') {
                return {
                    text: element.textContent?.trim() || '',
                    font: {
                        family: style.fontFamily.split(',')[0].replace(/["']/g, ''),
                        size: style.fontSize,
                        weight: style.fontWeight,
                        color: style.color
                    },
                    category: 'uncategorized'
                };
            } else if (mode === 'image') {
                // Extract image asset data
                const assetExtractor = new AssetExtractor();
                const rect = element.getBoundingClientRect();

                // Determine asset type and URL
                let url = '';
                let type = 'image';

                if (element.tagName === 'IMG') {
                    url = element.src;
                    type = 'image';
                } else if (element.tagName === 'SVG') {
                    const svgData = new XMLSerializer().serializeToString(element);
                    url = 'data:image/svg+xml;base64,' + btoa(svgData);
                    type = 'svg';
                } else {
                    // Background image
                    const bgImage = style.backgroundImage;
                    const urlMatch = bgImage.match(/url\(['"]?(.+?)['"]?\)/);
                    if (urlMatch) {
                        url = new URL(urlMatch[1], window.location.href).href;
                        type = 'background';
                    }
                }

                return {
                    type: type,
                    format: assetExtractor.getImageFormat(url),
                    url: url,
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    naturalWidth: element.naturalWidth || Math.round(rect.width),
                    naturalHeight: element.naturalHeight || Math.round(rect.height),
                    alt: element.alt || '',
                    fileName: assetExtractor.getFileName(url),
                    fileSize: null,
                    isLogo: assetExtractor.isLikelyLogo(element, rect),
                    isFavicon: false,
                    element: element.tagName.toLowerCase()
                };
            }

            return {};
        }

        /**
         * Extract brand data from page
         */
        async extractBrandData() {
            console.log('Extracting brand data from page...');

            // Extract assets using AssetExtractor
            const assetExtractor = new AssetExtractor();
            const assets = await assetExtractor.extractAssets(document);

            const data = {
                colors: this.extractColors(),
                fonts: this.extractFonts(),
                assets: assets, // Add extracted assets
                metadata: {
                    url: window.location.href,
                    title: document.title,
                    timestamp: new Date().toISOString()
                }
            };

            // Send to service worker
            chrome.runtime.sendMessage({
                action: 'BRAND_EXTRACTED',
                data: data
            });

            return data;
        }

        /**
         * Extract colors from page (basic implementation)
         */
        extractColors() {
            const colors = new Set();
            const elements = document.querySelectorAll('*');

            // Sample first 100 elements for performance
            const sample = Array.from(elements).slice(0, 100);

            sample.forEach(el => {
                const style = window.getComputedStyle(el);
                const bgColor = style.backgroundColor;
                const textColor = style.color;

                if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                    colors.add(bgColor);
                }
                if (textColor) {
                    colors.add(textColor);
                }
            });

            // Convert to array and limit to 5 colors
            return Array.from(colors).slice(0, 5).map(color => ({
                hex: this.rgbToHex(color),
                rgb: color,
                role: 'detected'
            }));
        }

        /**
         * Extract fonts from page (basic implementation)
         */
        extractFonts() {
            const fonts = new Set();
            const elements = document.querySelectorAll('h1, h2, h3, p');

            // Sample first 20 text elements
            const sample = Array.from(elements).slice(0, 20);

            sample.forEach(el => {
                const style = window.getComputedStyle(el);
                const fontFamily = style.fontFamily.split(',')[0].replace(/["']/g, '');
                fonts.add(fontFamily);
            });

            return Array.from(fonts).map(font => ({
                family: font,
                role: 'detected'
            }));
        }

        /**
         * Convert RGB to Hex
         */
        rgbToHex(rgb) {
            if (!rgb || rgb === 'transparent') return '#000000';

            const match = rgb.match(/\d+/g);
            if (!match || match.length < 3) return '#000000';

            const r = parseInt(match[0]);
            const g = parseInt(match[1]);
            const b = parseInt(match[2]);

            return '#' + [r, g, b].map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
        }
    }

    // Initialize content script
    window.__brandInspector__ = new BrandInspectorContent();
}
