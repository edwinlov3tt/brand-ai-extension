/**
 * Brand Inspector - Content Script
 * Injected into web pages to enable element inspection and brand extraction
 */

// Prevent multiple injections
if (!window.__BRAND_INSPECTOR_LOADED__) {
    window.__BRAND_INSPECTOR_LOADED__ = true;

    class BrandInspectorContent {
        constructor() {
            this.inspectorActive = false;
            this.currentMode = null;
            this.overlay = null;
            this.tooltip = null;
            this.analysisAborted = false; // Flag to stop ongoing analysis

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
        }

        /**
         * Handle incoming messages
         */
        handleMessage(message, sender, sendResponse) {
            switch (message.action) {
                case 'PING':
                    sendResponse({ ready: true });
                    break;

                case 'ACTIVATE_INSPECTOR':
                    this.activateInspector(message.mode);
                    sendResponse({ activated: true });
                    break;

                case 'DEACTIVATE_INSPECTOR':
                    this.deactivateInspector();
                    sendResponse({ deactivated: true });
                    break;

                case 'STOP_ANALYSIS':
                    this.stopAnalysis();
                    sendResponse({ stopped: true });
                    break;

                case 'EXTRACT_BRAND_DATA':
                    this.extractBrandData()
                        .then(data => {
                            sendResponse({ extracted: true, data });
                        })
                        .catch(error => {
                            console.error('Brand extraction failed:', error);
                            sendResponse({ extracted: false, error: error.message });
                        });
                    return true; // Async response

                case 'EXTRACT_METADATA_ONLY':
                    this.extractMetadataOnly()
                        .then(data => {
                            sendResponse({ extracted: true, data });
                        })
                        .catch(error => {
                            console.error('Metadata extraction failed:', error);
                            sendResponse({ extracted: false, error: error.message });
                        });
                    return true; // Async response

                case 'EXTRACT_PAGE_CONTENT_FOR_PROFILE':
                    const content = this.extractPageContentForProfile();
                    sendResponse({ content });
                    break;

                case 'extractPageContent':
                    const pageData = this.extractPageContent();
                    sendResponse(pageData);
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        }

        /**
         * Activate inspector mode
         */
        activateInspector(mode) {
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
         * Stop all ongoing analysis
         */
        stopAnalysis() {
            this.analysisAborted = true;
            this.deactivateInspector();
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
                border: 2px solid #FF0000;
                background: rgba(255, 0, 0, 0.1);
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
                    url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
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
            // Reset abort flag when starting new analysis
            this.analysisAborted = false;

            // Check if analysis was aborted
            if (this.analysisAborted) return null;

            // Extract assets using AssetExtractor
            const assetExtractor = new AssetExtractor();
            const assets = await assetExtractor.extractAssets(document);

            // Check again after async operation
            if (this.analysisAborted) return null;

            const data = {
                colors: this.extractColors(),
                fonts: this.extractFonts(),
                assets: assets, // Add extracted assets
                metadata: this.extractMetadata()
            };

            // Check before sending
            if (this.analysisAborted) return null;

            // Send to service worker
            chrome.runtime.sendMessage({
                action: 'BRAND_EXTRACTED',
                data: data
            });

            return data;
        }

        /**
         * Extract only metadata (for incremental updates on same-site navigation)
         * Much faster than full extraction (~50ms vs ~200ms)
         */
        async extractMetadataOnly() {

            const data = {
                metadata: this.extractMetadata()
            };

            // Send to service worker
            chrome.runtime.sendMessage({
                action: 'BRAND_EXTRACTED',
                data: data,
                incremental: true
            });

            return data;
        }

        /**
         * Extract page metadata (title, description, logo, favicon, tagline)
         */
        extractMetadata() {
            const metadata = {
                url: window.location.href,
                title: document.title,
                timestamp: new Date().toISOString()
            };

            // Extract description from meta tags
            const descriptionMeta = document.querySelector('meta[name="description"], meta[property="og:description"]');
            if (descriptionMeta) {
                metadata.description = descriptionMeta.getAttribute('content');
            }

            // Extract meta image (og:image, twitter:image)
            const metaImageSelectors = [
                'meta[property="og:image"]',
                'meta[name="twitter:image"]',
                'meta[itemprop="image"]'
            ];

            for (const selector of metaImageSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const content = element.getAttribute('content');
                    if (content) {
                        // Make sure it's an absolute URL
                        metadata.metaImage = new URL(content, window.location.href).href;
                        break;
                    }
                }
            }

            // Extract tagline (look for common patterns)
            const taglineSelectors = [
                'meta[property="og:description"]',
                '.tagline',
                '.subtitle',
                '.slogan',
                'h2:first-of-type',
                'p.lead'
            ];

            for (const selector of taglineSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const text = element.getAttribute ? element.getAttribute('content') : element.textContent?.trim();
                    if (text && text.length > 10 && text.length < 200) {
                        metadata.tagline = text;
                        break;
                    }
                }
            }

            // Extract logo from header - must be in header/nav area
            const headerElement = document.querySelector('header, nav, [role="banner"]');
            if (headerElement) {
                const logoSelectors = [
                    'img[alt*="logo" i]',
                    'img[class*="logo" i]',
                    'img[id*="logo" i]',
                    'a[class*="logo" i] img',
                    'a[id*="logo" i] img',
                    '.brand img',
                    '.navbar-brand img',
                    'img[src*="logo" i]'
                ];

                for (const selector of logoSelectors) {
                    const element = headerElement.querySelector(selector);
                    if (element && element.src) {
                        // Verify it's a reasonable size for a logo (not too small)
                        const rect = element.getBoundingClientRect();
                        if (rect.width >= 40 && rect.height >= 20) {
                            metadata.logo = element.src;
                            break;
                        }
                    }
                }

                // Fallback: first image in header if it's a reasonable size
                if (!metadata.logo) {
                    const firstImg = headerElement.querySelector('img');
                    if (firstImg && firstImg.src) {
                        const rect = firstImg.getBoundingClientRect();
                        if (rect.width >= 40 && rect.height >= 20 && rect.width <= 400) {
                            metadata.logo = firstImg.src;
                        }
                    }
                }
            }

            // Extract favicon
            const faviconSelectors = [
                'link[rel="icon"]',
                'link[rel="shortcut icon"]',
                'link[rel="apple-touch-icon"]'
            ];

            for (const selector of faviconSelectors) {
                const element = document.querySelector(selector);
                if (element && element.href) {
                    metadata.favicon = element.href;
                    break;
                }
            }

            // Fallback: check for default favicon
            if (!metadata.favicon) {
                const origin = new URL(window.location.href).origin;
                metadata.favicon = origin + '/favicon.ico';
            }

            // Extract social media links
            metadata.social = this.extractSocialLinks();

            // Extract contact information
            metadata.contact = this.extractContactInfo();

            return metadata;
        }

        /**
         * Extract social media links
         */
        extractSocialLinks() {
            const social = {
                facebook: null,
                instagram: null,
                twitter: null,
                youtube: null,
                linkedin: null,
                googleBusiness: null
            };

            const links = document.querySelectorAll('a[href]');

            links.forEach(link => {
                const href = link.href.toLowerCase();

                // Facebook
                if (!social.facebook && (href.includes('facebook.com') || href.includes('fb.com'))) {
                    social.facebook = link.href;
                }

                // Instagram
                if (!social.instagram && href.includes('instagram.com')) {
                    social.instagram = link.href;
                }

                // Twitter/X
                if (!social.twitter && (href.includes('twitter.com') || href.includes('x.com'))) {
                    social.twitter = link.href;
                }

                // YouTube
                if (!social.youtube && href.includes('youtube.com')) {
                    social.youtube = link.href;
                }

                // LinkedIn
                if (!social.linkedin && href.includes('linkedin.com')) {
                    social.linkedin = link.href;
                }

                // Google Business
                if (!social.googleBusiness && (href.includes('g.page') || href.includes('google.com/maps'))) {
                    social.googleBusiness = link.href;
                }
            });

            return social;
        }

        /**
         * Extract contact information (email and phone)
         */
        extractContactInfo() {
            const contact = {
                emails: [],
                phones: []
            };

            const links = document.querySelectorAll('a[href]');

            links.forEach(link => {
                const href = link.href.toLowerCase();

                // Email (mailto links)
                if (href.startsWith('mailto:')) {
                    const email = link.href.replace('mailto:', '').split('?')[0];
                    if (email && !contact.emails.includes(email)) {
                        contact.emails.push(email);
                    }
                }

                // Phone (tel links)
                if (href.startsWith('tel:')) {
                    const phone = link.href.replace('tel:', '').split('?')[0];
                    if (phone && !contact.phones.includes(phone)) {
                        contact.phones.push(phone);
                    }
                }
            });

            return contact;
        }

        /**
         * Extract colors from page with weighting system
         */
        extractColors() {
            const colorData = new Map(); // hex -> { rgb, weight, usedIn, elements }

            // Role weights based on BRAND_EXTRACTION_V2.md
            const roleWeights = {
                header: 5,
                hero: 4,
                cta: 4,
                main: 0.8,
                footer: 0.5,
                small: 0.3,
                background: 0.2
            };

            const elements = document.querySelectorAll('*');
            const viewportHeight = window.innerHeight;

            elements.forEach(el => {
                // Skip extension's own UI elements
                if (el.id?.startsWith('__brand-inspector-')) return;
                if (el.closest('[id^="__brand-inspector-"]')) return;

                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();

                // Skip invisible elements
                if (rect.width === 0 || rect.height === 0) return;
                if (style.display === 'none' || style.visibility === 'hidden') return;

                // Skip elements with opacity 0
                if (parseFloat(style.opacity) === 0) return;

                const area = rect.width * rect.height;
                const viewportArea = window.innerWidth * viewportHeight;

                // Determine element role
                let role = 'main';
                const tagName = el.tagName.toLowerCase();

                if (tagName === 'header' || el.closest('header')) {
                    role = 'header';
                } else if (el.classList.contains('hero') || rect.top < 100 && area > viewportArea * 0.3) {
                    role = 'hero';
                } else if (tagName === 'button' || el.classList.contains('btn') || el.classList.contains('cta')) {
                    role = 'cta';
                } else if (tagName === 'footer' || el.closest('footer')) {
                    role = 'footer';
                } else if (area > viewportArea * 0.5) {
                    role = 'background'; // Large elements are backgrounds
                } else if (parseInt(style.fontSize) < 12) {
                    role = 'small';
                }

                // Extract background color
                const bgColor = style.backgroundColor;
                if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                    const hex = this.rgbToHex(bgColor);
                    const weight = area * roleWeights[role];

                    if (!colorData.has(hex)) {
                        colorData.set(hex, {
                            rgb: bgColor,
                            weight: 0,
                            usedIn: new Set(),
                            count: 0
                        });
                    }

                    const data = colorData.get(hex);
                    data.weight += weight;
                    data.usedIn.add(role);
                    data.count += 1;
                }

                // Extract text color
                const textColor = style.color;
                if (textColor && textColor !== 'rgba(0, 0, 0, 0)') {
                    const hex = this.rgbToHex(textColor);
                    const weight = area * roleWeights[role] * 0.5; // Text colors weighted less

                    if (!colorData.has(hex)) {
                        colorData.set(hex, {
                            rgb: textColor,
                            weight: 0,
                            usedIn: new Set(),
                            count: 0
                        });
                    }

                    const data = colorData.get(hex);
                    data.weight += weight;
                    data.usedIn.add(role);
                    data.count += 1;
                }
            });

            // Detect framework/theme to filter default colors
            const isElementorSite = () => {
                return document.querySelector('[data-elementor-type]') !== null ||
                       document.querySelector('.elementor-section') !== null ||
                       document.querySelectorAll('[class*="elementor-"]').length > 10;
            };

            // Framework theme color blocklist
            const THEME_COLOR_BLOCKLIST = {
                elementor: [
                    '#cc3366', // Hello Elementor default accent
                    '#CC3366', // Case variation
                    '#61ce70', // Elementor default green
                    '#4054b2'  // Elementor default blue
                ]
            };

            // Build set of framework colors to check
            const frameworkColors = new Set();
            if (isElementorSite()) {
                THEME_COLOR_BLOCKLIST.elementor.forEach(color => {
                    frameworkColors.add(color.toLowerCase());
                });
            }

            // Calculate total weight for coverage percentage
            const totalWeight = Array.from(colorData.values()).reduce((sum, d) => sum + d.weight, 0);

            // Filter out near-white, near-black, and grays (unless heavily used)
            const filteredColors = Array.from(colorData.entries()).filter(([hex, data]) => {
                // Parse hex to check lightness
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);

                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const lightness = (max + min) / 2;
                const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));

                // Filter out very light colors (>235) unless heavily used
                if (lightness > 235 && data.count < 20) return false;

                // Filter out very dark colors (<30) unless heavily used and high saturation
                if (lightness < 30 && (data.count < 20 || saturation < 0.15)) return false;

                // Filter out low saturation grays (<0.15) unless heavily used
                if (saturation < 0.15 && lightness > 25 && lightness < 230 && data.count < 25) return false;

                // Require minimum saturation for brand colors (0.2) unless in header/hero/cta
                if (saturation < 0.2 && !data.usedIn.has('header') && !data.usedIn.has('hero') && !data.usedIn.has('cta')) {
                    return false;
                }

                // Filter framework theme colors UNLESS heavily used as actual brand colors
                if (frameworkColors.has(hex.toLowerCase())) {
                    const coverage = totalWeight > 0 ? data.weight / totalWeight : 0;

                    // Keep if: heavily used (30+ instances) OR in header/hero OR >5% coverage
                    if (data.count >= 30 ||
                        data.usedIn.has('header') ||
                        data.usedIn.has('hero') ||
                        coverage >= 0.05) {
                        return true;
                    }

                    return false;
                }

                return true;
            });

            // Sort by weight and take top 5
            const sortedColors = filteredColors
                .sort((a, b) => b[1].weight - a[1].weight)
                .slice(0, 5);

            // Assign roles based on weight ranking
            return sortedColors.map(([hex, data], index) => {
                let role = 'detected';
                if (index === 0) role = 'primary';
                else if (index === 1) role = 'secondary';
                else if (data.usedIn.has('cta')) role = 'accent';

                return {
                    hex: hex,
                    rgb: data.rgb,
                    role: role,
                    frequency: data.count,
                    usedIn: Array.from(data.usedIn)
                };
            });
        }

        /**
         * Extract Google Fonts links from stylesheets
         */
        extractGoogleFontsLinks() {
            const fontLinks = new Map(); // family -> URL
            const allGoogleFontsUrls = [];
            const fontFaceUrls = new Map(); // family -> src URL from @font-face

            // Method 1: Check link elements for Google Fonts
            const linkElements = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
            linkElements.forEach(link => {
                const href = link.href;
                allGoogleFontsUrls.push(href);
                this.parseFontUrl(href, fontLinks);
            });

            // Method 2: Check style tags for @import statements
            const styleElements = document.querySelectorAll('style');
            styleElements.forEach(style => {
                const content = style.textContent || '';

                // Look for @import statements
                const importMatches = content.matchAll(/@import\s+url\(['"]?(https:\/\/fonts\.googleapis\.com[^'")\s]+)['"]?\)/g);
                for (const match of importMatches) {
                    const href = match[1];
                    allGoogleFontsUrls.push(href);
                    this.parseFontUrl(href, fontLinks);
                }
            });

            // Method 3: Check CSS rules in stylesheets for @import and @font-face
            try {
                Array.from(document.styleSheets).forEach(sheet => {
                    try {
                        Array.from(sheet.cssRules || []).forEach(rule => {
                            // @import rules
                            if (rule.type === CSSRule.IMPORT_RULE && rule.href?.includes('fonts.googleapis.com')) {
                                const href = rule.href;
                                allGoogleFontsUrls.push(href);
                                this.parseFontUrl(href, fontLinks);
                            }

                            // @font-face rules (extract family name and src)
                            if (rule.type === CSSRule.FONT_FACE_RULE) {
                                const familyName = rule.style.fontFamily?.replace(/['"]/g, '').trim();
                                const src = rule.style.src;

                                if (familyName && src) {
                                    // Check if src contains Google Fonts URL
                                    const googleFontMatch = src.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/);
                                    if (googleFontMatch) {
                                        const fontUrl = googleFontMatch[1];
                                        fontFaceUrls.set(familyName, fontUrl);
                                    }
                                }
                            }
                        });
                    } catch (e) {
                        // CORS or access error, skip this stylesheet
                    }
                });
            } catch (e) {
                console.warn('Failed to access stylesheets:', e);
            }

            // If we found @font-face declarations but no main Google Fonts links,
            // generate a Google Fonts URL for each font
            if (fontFaceUrls.size > 0 && fontLinks.size === 0) {
                for (const [family, srcUrl] of fontFaceUrls.entries()) {
                    // Generate a Google Fonts URL for this font family
                    const encodedFamily = family.replace(/ /g, '+');
                    const generatedUrl = `https://fonts.googleapis.com/css2?family=${encodedFamily}`;
                    fontLinks.set(family, generatedUrl);
                }
            }


            return fontLinks;
        }

        /**
         * Parse a Google Fonts URL and extract font families
         */
        parseFontUrl(href, fontLinks) {
            try {
                const url = new URL(href);
                const familyParam = url.searchParams.get('family');

                if (familyParam) {
                    // Handle both old and new Google Fonts API formats
                    // New format: "Roboto:wght@400;700" or "Roboto:ital,wght@0,400;1,700"
                    // Old format: "Roboto|Open+Sans"

                    // Split by & for multiple family params
                    const familyParams = familyParam.split('&');

                    familyParams.forEach(param => {
                        // Split by | for legacy format
                        const families = param.split('|');

                        families.forEach(familyStr => {
                            // Remove everything after : (weights, styles, etc)
                            const familyName = familyStr.split(':')[0]
                                .replace(/\+/g, ' ')  // Replace + with space
                                .trim();

                            if (familyName) {
                                fontLinks.set(familyName, href);
                            }
                        });
                    });
                }
            } catch (e) {
                console.warn('Failed to parse Google Fonts URL:', e);
            }
        }

        /**
         * Extract fonts from page with hierarchy detection
         */
        extractFonts() {
            const fontData = new Map(); // family -> { weights, sizes, usedIn, coverage, count }

            // Extract Google Fonts links first
            const googleFontsLinks = this.extractGoogleFontsLinks();

            // Define font role selectors
            const selectors = {
                display: 'h1, h2, .hero, .headline, [class*="display"], [class*="hero"]',
                heading: 'h3, h4, h5, h6, [class*="heading"], [class*="title"]',
                body: 'p, div, span, li, td, a'
            };

            // Extract fonts by role
            Object.entries(selectors).forEach(([role, selector]) => {
                const elements = document.querySelectorAll(selector);

                elements.forEach(el => {
                    // Skip extension's own UI elements
                    if (el.id?.startsWith('__brand-inspector-')) return;
                    if (el.closest('[id^="__brand-inspector-"]')) return;

                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();

                    // Skip invisible elements
                    if (rect.width === 0 || rect.height === 0) return;
                    if (style.display === 'none' || style.visibility === 'hidden') return;
                    if (parseFloat(style.opacity) === 0) return;

                    // Get font family (first in stack)
                    const fontFamily = style.fontFamily.split(',')[0].replace(/["']/g, '').trim();

                    // Skip generic fonts
                    const genericFonts = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];
                    if (genericFonts.includes(fontFamily.toLowerCase())) return;

                    const fontSize = parseInt(style.fontSize);
                    const fontWeight = style.fontWeight;
                    const area = rect.width * rect.height;

                    if (!fontData.has(fontFamily)) {
                        fontData.set(fontFamily, {
                            weights: new Set(),
                            sizes: [],
                            usedIn: new Set(),
                            coverage: 0,
                            count: 0,
                            avgSize: 0
                        });
                    }

                    const data = fontData.get(fontFamily);
                    data.weights.add(fontWeight);
                    data.sizes.push(fontSize);
                    data.usedIn.add(role);
                    data.coverage += area;
                    data.count += 1;
                });
            });

            // Calculate average sizes and assign primary roles
            const fonts = Array.from(fontData.entries()).map(([family, data]) => {
                const avgSize = data.sizes.reduce((a, b) => a + b, 0) / data.sizes.length;

                // Determine primary role based on usage and size
                let primaryRole = 'detected';
                if (data.usedIn.has('display') || avgSize > 24) {
                    primaryRole = 'display';
                } else if (data.usedIn.has('heading') || avgSize > 16) {
                    primaryRole = 'heading';
                } else if (data.usedIn.has('body')) {
                    primaryRole = 'body';
                }

                // Try to find Google Fonts URL for this font
                let fontUrl = null;

                // Exact match
                if (googleFontsLinks.has(family)) {
                    fontUrl = googleFontsLinks.get(family);
                } else {
                    // Try case-insensitive match
                    for (const [linkFamily, url] of googleFontsLinks.entries()) {
                        if (linkFamily.toLowerCase() === family.toLowerCase()) {
                            fontUrl = url;
                            break;
                        }
                    }

                    // Try partial match (e.g., "Roboto" in "Roboto Condensed")
                    if (!fontUrl) {
                        for (const [linkFamily, url] of googleFontsLinks.entries()) {
                            if (family.toLowerCase().includes(linkFamily.toLowerCase()) ||
                                linkFamily.toLowerCase().includes(family.toLowerCase())) {
                                fontUrl = url;
                                break;
                            }
                        }
                    }

                    if (!fontUrl) {
                    }
                }

                return {
                    family: family,
                    role: primaryRole,
                    weights: Array.from(data.weights),
                    size: Math.round(avgSize) + 'px',
                    weight: data.weights.values().next().value,
                    usedIn: Array.from(data.usedIn),
                    coverage: data.coverage,
                    count: data.count,
                    fontUrl: fontUrl // Google Fonts link
                };
            });

            // Sort by coverage (most used first)
            fonts.sort((a, b) => b.coverage - a.coverage);

            // Ensure Google Fonts are always included if detected
            const googleFonts = fonts.filter(f => f.fontUrl !== null);
            const nonGoogleFonts = fonts.filter(f => f.fontUrl === null);

            // Take top 3 non-Google fonts + all Google Fonts (up to 10 total)
            const selectedFonts = [
                ...nonGoogleFonts.slice(0, 3),
                ...googleFonts
            ].slice(0, 10);


            return selectedFonts;
        }

        /**
         * Extract page content for brand profile generation
         * Returns all necessary data for LLM analysis
         */
        extractPageContentForProfile() {

            // Get domain and URL
            const domain = window.location.hostname;
            const url = window.location.href;

            // Get title
            const title = document.title;

            // Get description from meta tag
            const descriptionMeta = document.querySelector('meta[name="description"], meta[property="og:description"]');
            const description = descriptionMeta ? descriptionMeta.getAttribute('content') : '';

            // Get all headings
            const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
                .map(h => h.textContent.trim())
                .filter(h => h.length > 0)
                .slice(0, 20); // Limit to first 20 headings

            // Get main page text (limit to 50,000 chars)
            const bodyText = document.body.innerText || document.body.textContent || '';
            const text = bodyText.substring(0, 50000);

            // Get existing metadata if available
            const metadata = this.extractMetadata();

            return {
                domain,
                url,
                title,
                description,
                text,
                headings,
                metadata
            };
        }

        /**
         * Extract page content for saving as product/service
         * Returns metadata and full text content for AI summary generation
         */
        extractPageContent() {

            // Get title
            const title = document.title;

            // Get description from meta tag
            const descriptionMeta = document.querySelector('meta[name="description"], meta[property="og:description"]');
            const description = descriptionMeta ? descriptionMeta.getAttribute('content') : '';

            // Get meta image (og:image or twitter:image)
            const metaImageEl = document.querySelector('meta[property="og:image"], meta[name="twitter:image"]');
            const metaImage = metaImageEl ? metaImageEl.getAttribute('content') : '';

            // Get main page text content (combine visible text)
            const bodyText = document.body.innerText || document.body.textContent || '';

            // Extract main content (try to exclude header/footer/sidebar)
            let pageContent = bodyText;
            const mainContent = document.querySelector('main, article, [role="main"], .main-content, #main-content, #content');
            if (mainContent) {
                pageContent = mainContent.innerText || mainContent.textContent || bodyText;
            }

            // Limit to 50,000 characters to avoid token limits
            pageContent = pageContent.substring(0, 50000);

            return {
                title: title || '',
                description: description || '',
                metaImage: metaImage || '',
                pageContent: pageContent
            };
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
