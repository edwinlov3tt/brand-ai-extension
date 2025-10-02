/**
 * Advanced Font Analyzer for Brand Typography Extraction
 * Detects H1-H6 hierarchy, display, body, and accent fonts with area-based weighting
 */

const FontLinkFinder = require('./font-link-finder');

class FontAnalyzer {
    constructor() {
        this.MIN_TEXT_LENGTH = 3; // Minimum characters to consider
        this.MIN_ELEMENT_AREA = 50; // Minimum pixel area
        this.HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    }

    /**
     * Extract brand fonts from page with hierarchy detection
     */
    async extractBrandFonts(page, url = null) {
        console.log('🔤 Starting advanced font extraction...');

        // Wait for fonts to load
        await page.evaluateHandle('document.fonts.ready');

        const fontData = await page.evaluate((config) => {
            const results = {
                headings: {},
                bodyFonts: new Map(),
                displayFonts: new Map(),
                accentFonts: new Map(),
                allFonts: new Map(),
                metadata: {
                    totalElements: 0,
                    fontSources: new Set()
                }
            };

            // Helper: Check if element is visible
            const isVisible = (el) => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();

                return style.display !== 'none' &&
                       style.visibility !== 'hidden' &&
                       style.opacity !== '0' &&
                       rect.width > 0 &&
                       rect.height > 0;
            };

            // Helper: Calculate rendered area (visual weight)
            const calculateTextArea = (el, text, style) => {
                const fontSize = parseFloat(style.fontSize) || 16;
                const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2;
                const rect = el.getBoundingClientRect();

                // Area = character count × font size × line height
                const charCount = text.trim().length;
                const estimatedLines = Math.ceil(rect.width > 0 ? (charCount * fontSize * 0.6) / rect.width : 1);

                return charCount * fontSize * lineHeight * estimatedLines;
            };

            // Helper: Parse font family (remove quotes, get first font)
            const parseFontFamily = (fontFamily) => {
                if (!fontFamily) return null;

                // System font KEYWORDS that should be skipped (not actual font names)
                const systemKeywords = [
                    '-apple-system',      // Apple system font keyword
                    'BlinkMacSystemFont', // Chrome on macOS keyword
                    'system-ui',          // Generic system UI font keyword
                    'sans-serif',         // Generic fallback
                    'serif',              // Generic fallback
                    'monospace',          // Generic fallback
                    'cursive',            // Generic fallback
                    'fantasy'             // Generic fallback
                ];

                // Split by comma, find first non-system-keyword font
                const fonts = fontFamily.split(',').map(f => f.trim());

                for (let font of fonts) {
                    // Remove quotes
                    font = font.replace(/['"]/g, '');

                    // Check if it's a system keyword (case-insensitive)
                    const isSystemKeyword = systemKeywords.some(keyword =>
                        font.toLowerCase() === keyword.toLowerCase()
                    );

                    // If not a system keyword, use this font
                    if (!isSystemKeyword) {
                        return font;
                    }
                }

                // If all fonts are system keywords, return null (skip this element)
                return null;
            };

            // Helper: Detect font source
            const detectFontSource = (fontFamily) => {
                const lower = fontFamily.toLowerCase();

                if (lower.includes('google') || document.querySelector('link[href*="fonts.googleapis.com"]')) {
                    return 'Google Fonts';
                }
                if (lower.includes('adobe') || document.querySelector('link[href*="typekit.net"]') ||
                    document.querySelector('link[href*="use.typekit.com"]')) {
                    return 'Adobe Fonts';
                }
                if (document.querySelector('link[href*="fonts.com"]')) {
                    return 'Fonts.com';
                }
                if (document.querySelector('link[href*="cloud.typography.com"]')) {
                    return 'Cloud.typography';
                }

                // Check for @font-face rules
                try {
                    for (const sheet of document.styleSheets) {
                        for (const rule of sheet.cssRules || []) {
                            if (rule instanceof CSSFontFaceRule) {
                                const family = rule.style.fontFamily?.replace(/['"]/g, '');
                                if (family === fontFamily) {
                                    return 'Self-hosted';
                                }
                            }
                        }
                    }
                } catch (e) {
                    // CORS or other access error
                }

                return 'System';
            };

            // Helper: Categorize element role
            const categorizeElement = (el, tag) => {
                const className = el.className?.toLowerCase() || '';
                const rect = el.getBoundingClientRect();

                // Hero sections
                if (className.includes('hero') || className.includes('banner') ||
                    className.includes('jumbotron') || (rect.top < 200 && rect.height > 200)) {
                    return 'hero';
                }

                // CTA buttons
                if (tag === 'button' || tag === 'a' && (className.includes('btn') ||
                    className.includes('cta') || className.includes('button'))) {
                    return 'cta';
                }

                // Quotes/blockquotes
                if (tag === 'blockquote' || tag === 'q' || className.includes('quote')) {
                    return 'quote';
                }

                // Navigation
                if (tag === 'nav' || className.includes('nav') || className.includes('menu')) {
                    return 'navigation';
                }

                // Body paragraphs
                if (tag === 'p' || tag === 'div' || tag === 'span') {
                    return 'body';
                }

                // Links
                if (tag === 'a') {
                    return 'link';
                }

                return 'other';
            };

            // Step 1: Extract all heading fonts (H1-H6)
            config.HEADING_TAGS.forEach(tag => {
                const headings = document.querySelectorAll(tag);
                const fontData = [];

                headings.forEach(heading => {
                    if (!isVisible(heading)) return;

                    const text = heading.textContent?.trim() || '';
                    if (text.length < config.MIN_TEXT_LENGTH) return;

                    const style = window.getComputedStyle(heading);
                    const rect = heading.getBoundingClientRect();

                    if (rect.width * rect.height < config.MIN_ELEMENT_AREA) return;

                    const fontFamily = parseFontFamily(style.fontFamily);
                    if (!fontFamily) return;

                    const fontSize = parseFloat(style.fontSize) || 16;
                    const fontWeight = style.fontWeight || '400';
                    const area = calculateTextArea(heading, text, style);

                    fontData.push({
                        family: fontFamily,
                        size: Math.round(fontSize),
                        weight: fontWeight,
                        area,
                        text: text.substring(0, 100), // Sample text
                        position: Math.round(rect.top)
                    });
                });

                // Find most common font for this heading level
                if (fontData.length > 0) {
                    const fontMap = new Map();

                    fontData.forEach(f => {
                        const key = `${f.family}|${f.weight}`;
                        if (!fontMap.has(key)) {
                            fontMap.set(key, {
                                family: f.family,
                                weight: f.weight,
                                sizes: [],
                                totalArea: 0,
                                count: 0,
                                examples: []
                            });
                        }

                        const data = fontMap.get(key);
                        data.sizes.push(f.size);
                        data.totalArea += f.area;
                        data.count++;
                        if (data.examples.length < 3) {
                            data.examples.push(f.text);
                        }
                    });

                    // Get font with largest area
                    const sorted = Array.from(fontMap.values())
                        .sort((a, b) => b.totalArea - a.totalArea);

                    const primary = sorted[0];
                    const avgSize = Math.round(primary.sizes.reduce((a, b) => a + b, 0) / primary.sizes.length);

                    results.headings[tag] = {
                        family: primary.family,
                        weight: primary.weight,
                        size: avgSize,
                        count: primary.count,
                        examples: primary.examples,
                        coverage: primary.totalArea
                    };
                }
            });

            // Step 2: Collect all text elements with categorization
            const allElements = document.querySelectorAll('p, div, span, a, button, blockquote, q, li, td, th, label');

            allElements.forEach(el => {
                if (!isVisible(el)) return;

                const text = el.textContent?.trim() || '';
                if (text.length < config.MIN_TEXT_LENGTH) return;

                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();

                if (rect.width * rect.height < config.MIN_ELEMENT_AREA) return;

                const fontFamily = parseFontFamily(style.fontFamily);
                if (!fontFamily) return;

                const tag = el.tagName.toLowerCase();
                const category = categorizeElement(el, tag);
                const fontSize = parseFloat(style.fontSize) || 16;
                const fontWeight = style.fontWeight || '400';
                const area = calculateTextArea(el, text, style);

                const key = `${fontFamily}|${fontWeight}`;

                // Track by category
                let targetMap;
                if (category === 'hero' || category === 'cta') {
                    targetMap = results.displayFonts;
                } else if (category === 'quote' || category === 'navigation') {
                    targetMap = results.accentFonts;
                } else if (category === 'body') {
                    targetMap = results.bodyFonts;
                } else {
                    targetMap = results.allFonts;
                }

                if (!targetMap.has(key)) {
                    targetMap.set(key, {
                        family: fontFamily,
                        weight: fontWeight,
                        totalArea: 0,
                        count: 0,
                        categories: new Set(),
                        sizes: [],
                        source: null
                    });
                }

                const fontData = targetMap.get(key);
                fontData.totalArea += area;
                fontData.count++;
                fontData.categories.add(category);
                fontData.sizes.push(fontSize);

                // Track in all fonts too
                if (targetMap !== results.allFonts) {
                    if (!results.allFonts.has(key)) {
                        results.allFonts.set(key, {
                            family: fontFamily,
                            weight: fontWeight,
                            totalArea: 0,
                            count: 0,
                            categories: new Set(),
                            sizes: [],
                            source: null
                        });
                    }
                    const allData = results.allFonts.get(key);
                    allData.totalArea += area;
                    allData.count++;
                    allData.categories.add(category);
                }

                results.metadata.totalElements++;
            });

            // Convert maps to arrays
            results.bodyFontsArray = Array.from(results.bodyFonts.values())
                .map(f => ({
                    ...f,
                    categories: Array.from(f.categories),
                    avgSize: Math.round(f.sizes.reduce((a, b) => a + b, 0) / f.sizes.length)
                }))
                .sort((a, b) => b.totalArea - a.totalArea);

            results.displayFontsArray = Array.from(results.displayFonts.values())
                .map(f => ({
                    ...f,
                    categories: Array.from(f.categories),
                    avgSize: Math.round(f.sizes.reduce((a, b) => a + b, 0) / f.sizes.length)
                }))
                .sort((a, b) => b.totalArea - a.totalArea);

            results.accentFontsArray = Array.from(results.accentFonts.values())
                .map(f => ({
                    ...f,
                    categories: Array.from(f.categories),
                    avgSize: Math.round(f.sizes.reduce((a, b) => a + b, 0) / f.sizes.length)
                }))
                .sort((a, b) => b.totalArea - a.totalArea);

            results.allFontsArray = Array.from(results.allFonts.values())
                .map(f => ({
                    ...f,
                    categories: Array.from(f.categories),
                    avgSize: Math.round(f.sizes.reduce((a, b) => a + b, 0) / f.sizes.length),
                    source: detectFontSource(f.family)
                }))
                .sort((a, b) => b.totalArea - a.totalArea);

            // Track font sources
            results.allFontsArray.forEach(f => {
                if (f.source) {
                    results.metadata.fontSources.add(f.source);
                }
            });

            results.metadata.fontSources = Array.from(results.metadata.fontSources);

            return results;
        }, {
            HEADING_TAGS: this.HEADING_TAGS,
            MIN_TEXT_LENGTH: this.MIN_TEXT_LENGTH,
            MIN_ELEMENT_AREA: this.MIN_ELEMENT_AREA
        });

        console.log(`   ✅ Analyzed ${fontData.metadata.totalElements} text elements`);

        // Step 3: Assign roles deterministically
        const typography = this.assignTypographyRoles(fontData);

        // Step 4: Find font links (Google Fonts, Adobe Fonts)
        if (url) {
            console.log('   🔗 Finding font provider links...');
            const fontLinkFinder = new FontLinkFinder();

            // Collect all font families to search
            const fontFamilies = [
                typography.display?.family,
                typography.body?.family,
                typography.accent?.family,
                ...Object.values(typography.headings).map(h => h.family)
            ].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i); // Deduplicate

            if (fontFamilies.length > 0) {
                typography.fontLinks = await fontLinkFinder.findFontLinks(page, fontFamilies);
                console.log(`   ✅ Found links for ${Object.keys(typography.fontLinks).length} fonts`);
            } else {
                typography.fontLinks = {};
            }
        } else {
            typography.fontLinks = {};
        }

        return typography;
    }

    /**
     * Assign display, body, and accent fonts based on usage patterns
     */
    assignTypographyRoles(fontData) {
        const result = {
            display: null,
            headings: fontData.headings,
            body: null,
            accent: null,
            metadata: fontData.metadata
        };

        // Calculate total area for coverage percentages
        const totalArea = fontData.allFontsArray.reduce((sum, f) => sum + f.totalArea, 0);

        // Display font: Most prominent in display/hero/H1/H2
        const displayCandidates = fontData.displayFontsArray.length > 0
            ? fontData.displayFontsArray
            : fontData.allFontsArray.filter(f => f.avgSize > 24);

        if (displayCandidates.length > 0) {
            const primary = displayCandidates[0];
            const coverage = (primary.totalArea / totalArea * 100).toFixed(1) + '%';
            const confidence = Math.min(0.99, 0.6 + (primary.count / 50) + (primary.totalArea / totalArea * 0.3));

            result.display = {
                family: primary.family,
                weights: [primary.weight],
                usedIn: primary.categories,
                avgSize: primary.avgSize,
                coverage,
                confidence: parseFloat(confidence.toFixed(2)),
                source: primary.source
            };

            // Collect all weights for this font family
            const allWeights = fontData.allFontsArray
                .filter(f => f.family === primary.family)
                .map(f => f.weight);
            result.display.weights = [...new Set(allWeights)].sort();
        }

        // Body font: Most prominent in body paragraphs
        const bodyCandidates = fontData.bodyFontsArray.length > 0
            ? fontData.bodyFontsArray
            : fontData.allFontsArray.filter(f => f.avgSize >= 14 && f.avgSize <= 20);

        if (bodyCandidates.length > 0) {
            const primary = bodyCandidates[0];

            // Skip if same as display
            if (!result.display || primary.family !== result.display.family) {
                const coverage = (primary.totalArea / totalArea * 100).toFixed(1) + '%';
                const confidence = Math.min(0.99, 0.7 + (primary.count / 100) + (primary.totalArea / totalArea * 0.2));

                result.body = {
                    family: primary.family,
                    weights: [primary.weight],
                    usedIn: primary.categories,
                    avgSize: primary.avgSize,
                    coverage,
                    confidence: parseFloat(confidence.toFixed(2)),
                    source: primary.source
                };

                // Collect all weights
                const allWeights = fontData.allFontsArray
                    .filter(f => f.family === primary.family)
                    .map(f => f.weight);
                result.body.weights = [...new Set(allWeights)].sort();
            } else if (bodyCandidates.length > 1) {
                // Use second candidate if first is same as display
                const secondary = bodyCandidates[1];
                const coverage = (secondary.totalArea / totalArea * 100).toFixed(1) + '%';
                const confidence = Math.min(0.99, 0.7 + (secondary.count / 100) + (secondary.totalArea / totalArea * 0.2));

                result.body = {
                    family: secondary.family,
                    weights: [secondary.weight],
                    usedIn: secondary.categories,
                    avgSize: secondary.avgSize,
                    coverage,
                    confidence: parseFloat(confidence.toFixed(2)),
                    source: secondary.source
                };

                const allWeights = fontData.allFontsArray
                    .filter(f => f.family === secondary.family)
                    .map(f => f.weight);
                result.body.weights = [...new Set(allWeights)].sort();
            }
        }

        // Accent font: Used in quotes, navigation, or distinctive elements
        const accentCandidates = fontData.accentFontsArray.filter(f => {
            return (!result.display || f.family !== result.display.family) &&
                   (!result.body || f.family !== result.body.family);
        });

        if (accentCandidates.length > 0) {
            const primary = accentCandidates[0];
            const coverage = (primary.totalArea / totalArea * 100).toFixed(1) + '%';
            const confidence = Math.min(0.99, 0.5 + (primary.count / 30) + (primary.totalArea / totalArea * 0.2));

            result.accent = {
                family: primary.family,
                weights: [primary.weight],
                usedIn: primary.categories,
                avgSize: primary.avgSize,
                coverage,
                confidence: parseFloat(confidence.toFixed(2)),
                source: primary.source
            };

            // Collect all weights
            const allWeights = fontData.allFontsArray
                .filter(f => f.family === primary.family)
                .map(f => f.weight);
            result.accent.weights = [...new Set(allWeights)].sort();
        }

        return result;
    }
}

module.exports = FontAnalyzer;