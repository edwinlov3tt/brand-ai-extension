/**
 * Advanced Color Analyzer for Brand Extraction
 * Uses frequency analysis, area weighting, clustering, and third-party filtering
 */

class ColorAnalyzer {
    constructor() {
        this.WHITE_THRESHOLD = 240; // RGB values above this are considered white
        this.BLACK_THRESHOLD = 30;  // RGB values below this are considered black
        this.MIN_AREA = 100;        // Minimum pixel area to consider
        this.CLUSTER_COUNT = 5;     // Target number of color clusters
        this.DELTA_E_THRESHOLD = 10; // Lab color difference threshold for similarity
    }

    /**
     * Extract brand colors from page with advanced techniques
     */
    async extractBrandColors(page, options = {}) {
        const {
            colorCount = 5,
            includeContrast = true,
            thirdPartyFilter = true
        } = options;

        console.log('🎨 Starting advanced color extraction...');

        const colorData = await page.evaluate((config) => {
            const results = {
                colors: [],
                roleWeights: {
                    header: 8,      // INCREASED - headers are critical
                    hero: 6,        // INCREASED - hero sections define brand
                    cta: 10,        // MAJOR INCREASE - CTAs show primary brand colors
                    main: 0.3,      // DECREASED - often just content/backgrounds
                    footer: 0.2,    // DECREASED - less visually important
                    small: 0.1,     // DECREASED - minimal influence
                    background: 0.05 // SEVERE PENALTY - almost always neutral
                },
                thirdPartyDomains: new Set(),
                viewportDimensions: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    area: window.innerWidth * window.innerHeight
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

            // Helper: Check if element is in viewport or near it
            const isInOrNearViewport = (rect) => {
                return rect.top < window.innerHeight * 2 &&
                       rect.bottom > -window.innerHeight;
            };

            // Helper: Determine element role for weighting
            const getElementRole = (el) => {
                const tag = el.tagName.toLowerCase();
                const className = (typeof el.className === 'string' ? el.className : '').toLowerCase();
                const rect = el.getBoundingClientRect();

                // Body background - special case
                if (tag === 'body') {
                    return 'background';
                }

                // Header elements
                if (tag === 'header' || tag === 'nav' || className.includes('header') ||
                    className.includes('navbar') || rect.top < 100) {
                    return 'header';
                }

                // Hero sections
                if (className.includes('hero') || className.includes('banner') ||
                    className.includes('jumbotron')) {
                    return 'hero';
                }

                // CTA buttons and interactive elements
                if (tag === 'button' || tag === 'a' && (className.includes('btn') ||
                    className.includes('cta') || className.includes('button'))) {
                    return 'cta';
                }

                // Footer
                if (tag === 'footer' || className.includes('footer')) {
                    return 'footer';
                }

                // Small text
                if (rect.height < 20 || rect.width < 50) {
                    return 'small';
                }

                // Check if element covers large portion of viewport (likely background)
                const elementArea = rect.width * rect.height;
                const viewportArea = results.viewportDimensions.area;
                if (elementArea > viewportArea * 0.5) {
                    return 'background';
                }

                // Main content
                return 'main';
            };

            // Helper: Parse RGB color to object
            const parseRgb = (color) => {
                const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
                if (match) {
                    return {
                        r: parseInt(match[1]),
                        g: parseInt(match[2]),
                        b: parseInt(match[3])
                    };
                }
                return null;
            };

            // Helper: Convert RGB to hex
            const rgbToHex = (r, g, b) => {
                return '#' + [r, g, b].map(x => {
                    const hex = x.toString(16);
                    return hex.length === 1 ? '0' + hex : hex;
                }).join('');
            };

            // Helper: Check if color is near white or black
            const isNearWhiteOrBlack = (rgb) => {
                const avg = (rgb.r + rgb.g + rgb.b) / 3;
                return avg > config.WHITE_THRESHOLD || avg < config.BLACK_THRESHOLD;
            };

            // Helper: Check if color is neutral/gray (low saturation)
            const isNeutralColor = (rgb) => {
                const max = Math.max(rgb.r, rgb.g, rgb.b);
                const min = Math.min(rgb.r, rgb.g, rgb.b);

                // Calculate saturation
                const saturation = max === 0 ? 0 : (max - min) / max;

                // Colors with saturation < 0.15 are considered gray/neutral
                if (saturation < 0.15) return true;

                // Also check lightness (very dark or very light colors)
                const lightness = (max + min) / 2;
                if (lightness > 220 || lightness < 40) return true;

                return false;
            };

            // Step 1: Identify third-party iframes
            if (config.thirdPartyFilter) {
                const iframes = document.querySelectorAll('iframe');
                const currentDomain = window.location.hostname;

                iframes.forEach(iframe => {
                    try {
                        const iframeSrc = iframe.src;
                        if (iframeSrc) {
                            const url = new URL(iframeSrc);
                            if (url.hostname !== currentDomain) {
                                results.thirdPartyDomains.add(url.hostname);
                            }
                        }
                    } catch (e) {
                        // Invalid URL or cross-origin
                    }
                });
            }

            // Step 2: Collect colors with weights
            const colorMap = new Map(); // color -> {frequency, totalArea, elements, role}

            const elements = document.querySelectorAll('*');
            let processedCount = 0;

            elements.forEach(el => {
                // Skip if not visible
                if (!isVisible(el)) return;

                // Skip if inside third-party iframe
                if (config.thirdPartyFilter) {
                    let parent = el.parentElement;
                    while (parent) {
                        if (parent.tagName === 'IFRAME') {
                            return; // Skip this element
                        }
                        parent = parent.parentElement;
                    }
                }

                const rect = el.getBoundingClientRect();

                // Skip if not in/near viewport or too small
                if (!isInOrNearViewport(rect) || rect.width * rect.height < config.MIN_AREA) {
                    return;
                }

                const style = window.getComputedStyle(el);
                const role = getElementRole(el);
                const roleWeight = results.roleWeights[role] || 1;
                const area = rect.width * rect.height;
                const weightedArea = area * roleWeight;

                // Extract colors
                const colors = [
                    { type: 'background', value: style.backgroundColor },
                    { type: 'color', value: style.color },
                    { type: 'border', value: style.borderColor }
                ];

                colors.forEach(({ type, value }) => {
                    if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') {
                        return;
                    }

                    // Skip body background colors entirely (almost always neutral/generic)
                    if (el.tagName.toLowerCase() === 'body' && type === 'background') {
                        return;
                    }

                    const rgb = parseRgb(value);
                    if (!rgb || isNearWhiteOrBlack(rgb)) {
                        return;
                    }

                    // Skip neutral/gray colors (low saturation)
                    if (isNeutralColor(rgb)) {
                        return;
                    }

                    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);


                    if (!colorMap.has(hex)) {
                        colorMap.set(hex, {
                            rgb,
                            hex,
                            frequency: 0,
                            totalArea: 0,
                            weightedArea: 0,
                            elements: [],
                            roles: new Set(),
                            types: new Set()
                        });
                    }

                    const colorData = colorMap.get(hex);
                    colorData.frequency++;
                    colorData.totalArea += area;
                    colorData.weightedArea += weightedArea;
                    colorData.roles.add(role);
                    colorData.types.add(type);

                    if (colorData.elements.length < 5) {
                        colorData.elements.push({
                            tag: el.tagName,
                            role,
                            area: Math.round(area)
                        });
                    }
                });

                processedCount++;
            });

            // Convert to array
            results.colors = Array.from(colorMap.values())
                .map(c => ({
                    ...c,
                    roles: Array.from(c.roles),
                    types: Array.from(c.types)
                }))
                .sort((a, b) => b.weightedArea - a.weightedArea);

            results.metadata = {
                elementsProcessed: processedCount,
                uniqueColors: results.colors.length,
                thirdPartyDomainsFiltered: Array.from(results.thirdPartyDomains)
            };

            return results;
        }, {
            WHITE_THRESHOLD: this.WHITE_THRESHOLD,
            BLACK_THRESHOLD: this.BLACK_THRESHOLD,
            MIN_AREA: this.MIN_AREA,
            thirdPartyFilter
        });

        console.log(`   ✅ Extracted ${colorData.colors.length} unique colors from ${colorData.metadata.elementsProcessed} elements`);

        // Step 3: Cluster colors
        const clustered = this.clusterColors(colorData.colors, colorCount);

        // Step 4: Assign semantic roles
        const labeled = this.labelColorRoles(clustered, colorData.colors);

        // Step 5: Calculate WCAG contrast if requested
        if (includeContrast) {
            this.addContrastScores(labeled);
        }

        // Step 6: Extract meta theme colors
        const metaColors = await this.extractMetaThemeColors(page);

        return {
            palette: labeled,
            meta: metaColors,
            analysis: {
                method: 'frequency+area+clustering',
                clustered: true,
                thirdPartyFiltered: thirdPartyFilter,
                originalColors: colorData.colors.length,
                clusteredColors: labeled.length,
                ...colorData.metadata
            }
        };
    }

    /**
     * Simple k-means-like clustering in RGB space
     * (For production, use Lab space with proper k-means library)
     */
    clusterColors(colors, targetCount) {
        if (colors.length <= targetCount) {
            return colors.slice(0, targetCount);
        }

        console.log(`   🔬 Clustering ${colors.length} colors into ${targetCount} groups...`);

        // Sort by weighted area (already sorted from extraction)
        // Take top colors by weight, ensuring diversity
        const clusters = [];
        const minDistance = 50; // Minimum RGB distance between clusters

        for (const color of colors) {
            if (clusters.length >= targetCount) break;

            // Check if this color is too similar to existing clusters
            const isSimilar = clusters.some(cluster => {
                const dist = this.colorDistance(color.rgb, cluster.rgb);
                return dist < minDistance;
            });

            if (!isSimilar) {
                clusters.push(color);
            }
        }

        // Fill remaining slots if needed
        while (clusters.length < targetCount && clusters.length < colors.length) {
            clusters.push(colors[clusters.length]);
        }

        return clusters;
    }

    /**
     * Calculate RGB color distance (simplified)
     */
    colorDistance(rgb1, rgb2) {
        return Math.sqrt(
            Math.pow(rgb1.r - rgb2.r, 2) +
            Math.pow(rgb1.g - rgb2.g, 2) +
            Math.pow(rgb1.b - rgb2.b, 2)
        );
    }

    /**
     * Assign semantic roles to colors
     */
    labelColorRoles(clusteredColors, allColors) {
        const labeled = [];

        // Calculate total weighted area for coverage percentages
        const totalWeightedArea = allColors.reduce((sum, c) => sum + c.weightedArea, 0);

        clusteredColors.forEach((color, index) => {
            let role = 'brand';

            // Determine role based on where it's used and its ranking
            if (index === 0) {
                role = 'primary';
            } else if (index === 1) {
                role = 'secondary';
            } else if (color.roles.includes('cta') || color.types.includes('background')) {
                role = 'accent';
            } else if (this.isLight(color.rgb)) {
                role = 'light';
            } else if (this.isDark(color.rgb)) {
                role = 'dark';
            }

            const coverage = (color.weightedArea / totalWeightedArea * 100).toFixed(1) + '%';
            const confidence = Math.min(0.99, 0.5 + (color.frequency / 100) + (color.weightedArea / totalWeightedArea * 0.3));

            labeled.push({
                hex: color.hex,
                rgb: color.rgb,
                role,
                frequency: color.frequency,
                coverage,
                confidence: parseFloat(confidence.toFixed(2)),
                usedIn: color.roles,
                types: color.types,
                examples: color.elements
            });
        });

        return labeled;
    }

    /**
     * Check if color is light
     */
    isLight(rgb) {
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness > 200;
    }

    /**
     * Check if color is dark
     */
    isDark(rgb) {
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness < 60;
    }

    /**
     * Add WCAG contrast scores
     */
    addContrastScores(colors) {
        colors.forEach(color => {
            color.wcagContrast = {
                'vs-white': this.calculateContrast(color.rgb, { r: 255, g: 255, b: 255 }),
                'vs-black': this.calculateContrast(color.rgb, { r: 0, g: 0, b: 0 })
            };

            // Add contrast against other brand colors
            colors.forEach(other => {
                if (other.hex !== color.hex && other.role === 'primary') {
                    color.wcagContrast[`vs-${other.role}`] = this.calculateContrast(color.rgb, other.rgb);
                }
            });
        });
    }

    /**
     * Calculate WCAG contrast ratio
     */
    calculateContrast(rgb1, rgb2) {
        const l1 = this.relativeLuminance(rgb1);
        const l2 = this.relativeLuminance(rgb2);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return parseFloat(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
    }

    /**
     * Calculate relative luminance for WCAG
     */
    relativeLuminance(rgb) {
        const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
            const normalized = val / 255;
            return normalized <= 0.03928
                ? normalized / 12.92
                : Math.pow((normalized + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    /**
     * Extract meta theme colors
     */
    async extractMetaThemeColors(page) {
        return await page.evaluate(() => {
            const metaTheme = document.querySelector('meta[name="theme-color"]');
            const manifestLink = document.querySelector('link[rel="manifest"]');

            return {
                themeColor: metaTheme?.getAttribute('content') || null,
                manifestUrl: manifestLink?.getAttribute('href') || null
            };
        });
    }
}

module.exports = ColorAnalyzer;