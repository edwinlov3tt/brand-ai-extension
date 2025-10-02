/**
 * Responsive Detector
 * Detects if a website uses responsive design to determine if mobile viewport testing is needed
 *
 * Detection Strategies:
 * 1. <picture> elements (responsive images)
 * 2. srcset attributes (responsive images)
 * 3. CSS media queries with mobile breakpoints
 * 4. viewport meta tag with device-width
 * 5. CSS Grid/Flexbox with responsive patterns
 */

class ResponsiveDetector {
    constructor() {
        this.mobileBreakpoints = [
            320, 375, 414, 428, // Common mobile widths
            480, 568, 667, 768, // Tablet/mobile landscape
            'mobile', 'phone', 'tablet', 'small'
        ];
    }

    /**
     * Detect if page uses responsive design
     * @param {Page} page - Puppeteer page object
     * @returns {Object} - { isResponsive, confidence, indicators, recommendation }
     */
    async detect(page) {
        console.log('🔍 Detecting responsive design patterns...');

        try {
            const indicators = await page.evaluate(() => {
                const results = {
                    hasPicture: false,
                    hasSrcset: false,
                    hasViewportMeta: false,
                    hasMediaQueries: false,
                    hasFlexbox: false,
                    hasGrid: false,
                    pictureCount: 0,
                    srcsetCount: 0,
                    mediaQueryBreakpoints: [],
                    viewportContent: null
                };

                // 1. Check for <picture> elements
                const pictures = document.querySelectorAll('picture');
                results.pictureCount = pictures.length;
                results.hasPicture = pictures.length > 0;

                // 2. Check for srcset attributes
                const imagesWithSrcset = document.querySelectorAll('img[srcset]');
                results.srcsetCount = imagesWithSrcset.length;
                results.hasSrcset = imagesWithSrcset.length > 0;

                // 3. Check for viewport meta tag
                const viewportMeta = document.querySelector('meta[name="viewport"]');
                if (viewportMeta) {
                    const content = viewportMeta.getAttribute('content');
                    results.viewportContent = content;
                    results.hasViewportMeta = content && (
                        content.includes('device-width') ||
                        content.includes('width=device')
                    );
                }

                // 4. Check for CSS media queries
                const styleSheets = Array.from(document.styleSheets);
                const mediaQueryPatterns = [];

                for (const sheet of styleSheets) {
                    try {
                        // Skip external stylesheets from different origins
                        if (sheet.href && !sheet.href.startsWith(window.location.origin)) {
                            continue;
                        }

                        const rules = Array.from(sheet.cssRules || sheet.rules || []);

                        for (const rule of rules) {
                            if (rule.type === CSSRule.MEDIA_RULE) {
                                const mediaText = rule.media.mediaText;
                                mediaQueryPatterns.push(mediaText);

                                // Extract breakpoint values
                                const breakpointMatch = mediaText.match(/(\d+)px/g);
                                if (breakpointMatch) {
                                    results.mediaQueryBreakpoints.push(...breakpointMatch.map(m => parseInt(m)));
                                }
                            }
                        }
                    } catch (e) {
                        // CORS or other access errors - skip this stylesheet
                    }
                }

                results.hasMediaQueries = mediaQueryPatterns.length > 0;

                // 5. Check for modern layout techniques (Flexbox/Grid)
                const computedStyles = window.getComputedStyle(document.body);
                results.hasFlexbox = computedStyles.display === 'flex' || computedStyles.display === 'inline-flex';
                results.hasGrid = computedStyles.display === 'grid' || computedStyles.display === 'inline-grid';

                // Also check for flex/grid in children
                if (!results.hasFlexbox || !results.hasGrid) {
                    const allElements = document.querySelectorAll('*');
                    for (let i = 0; i < Math.min(allElements.length, 100); i++) {
                        const style = window.getComputedStyle(allElements[i]);
                        if (style.display === 'flex' || style.display === 'inline-flex') {
                            results.hasFlexbox = true;
                        }
                        if (style.display === 'grid' || style.display === 'inline-grid') {
                            results.hasGrid = true;
                        }
                        if (results.hasFlexbox && results.hasGrid) break;
                    }
                }

                return results;
            });

            // Calculate confidence score
            const { isResponsive, confidence } = this.calculateResponsiveness(indicators);

            // Generate recommendation
            const recommendation = this.generateRecommendation(isResponsive, confidence, indicators);

            console.log('✓ Responsive detection complete:');
            console.log(`   Is Responsive: ${isResponsive}`);
            console.log(`   Confidence: ${confidence}%`);
            console.log(`   Indicators: picture=${indicators.pictureCount}, srcset=${indicators.srcsetCount}, mediaQueries=${indicators.hasMediaQueries}`);

            return {
                isResponsive,
                confidence,
                indicators,
                recommendation
            };

        } catch (error) {
            console.error('❌ Responsive detection failed:', error.message);

            // Default to responsive (safer to test mobile)
            return {
                isResponsive: true,
                confidence: 50,
                indicators: { error: error.message },
                recommendation: {
                    useMobile: true,
                    reason: 'Detection failed, defaulting to mobile testing for safety'
                }
            };
        }
    }

    /**
     * Calculate if site is responsive based on indicators
     */
    calculateResponsiveness(indicators) {
        let score = 0;
        const weights = {
            hasPicture: 25,
            hasSrcset: 20,
            hasViewportMeta: 30,
            hasMediaQueries: 20,
            hasFlexbox: 5,
            hasGrid: 5
        };

        // Add weighted scores
        if (indicators.hasPicture) score += weights.hasPicture;
        if (indicators.hasSrcset) score += weights.hasSrcset;
        if (indicators.hasViewportMeta) score += weights.hasViewportMeta;
        if (indicators.hasMediaQueries) score += weights.hasMediaQueries;
        if (indicators.hasFlexbox) score += weights.hasFlexbox;
        if (indicators.hasGrid) score += weights.hasGrid;

        // Bonus for multiple responsive images
        if (indicators.pictureCount > 3) score += 5;
        if (indicators.srcsetCount > 5) score += 5;

        // Check for mobile breakpoints in media queries
        const hasMobileBreakpoint = indicators.mediaQueryBreakpoints.some(bp =>
            bp <= 768 // Tablet and below
        );
        if (hasMobileBreakpoint) score += 10;

        const confidence = Math.min(score, 100);
        const isResponsive = confidence >= 50; // 50% threshold

        return { isResponsive, confidence };
    }

    /**
     * Generate viewport recommendation
     */
    generateRecommendation(isResponsive, confidence, indicators) {
        if (!isResponsive || confidence < 50) {
            return {
                useMobile: false,
                reason: 'Site does not appear to use responsive design',
                viewports: [{ width: 1920, height: 1080, name: 'desktop' }]
            };
        }

        // Strong indicators - test both
        if (confidence >= 75) {
            return {
                useMobile: true,
                reason: `Strong responsive indicators (${confidence}% confidence)`,
                viewports: [
                    { width: 1920, height: 1080, name: 'desktop' },
                    { width: 375, height: 667, name: 'mobile' }
                ]
            };
        }

        // Moderate indicators - test both but flag as optional
        if (confidence >= 50) {
            return {
                useMobile: true,
                reason: `Moderate responsive indicators (${confidence}% confidence)`,
                viewports: [
                    { width: 1920, height: 1080, name: 'desktop' },
                    { width: 375, height: 667, name: 'mobile' }
                ],
                mobileOptional: true
            };
        }

        // Default to desktop only
        return {
            useMobile: false,
            reason: 'Insufficient responsive indicators',
            viewports: [{ width: 1920, height: 1080, name: 'desktop' }]
        };
    }

    /**
     * Quick check - faster version that only checks HTML (no JS execution)
     * Use this for initial screening before launching Puppeteer
     */
    async quickCheck(html) {
        const indicators = {
            hasPicture: /<picture[\s>]/i.test(html),
            hasSrcset: /srcset\s*=/i.test(html),
            hasViewportMeta: /<meta[^>]+name=["']viewport["'][^>]+content=["'][^"']*device-width/i.test(html),
            hasMediaQuery: /@media[\s\S]*?(?:max-width|min-width|mobile|tablet|phone)/i.test(html)
        };

        const score = (
            (indicators.hasPicture ? 25 : 0) +
            (indicators.hasSrcset ? 25 : 0) +
            (indicators.hasViewportMeta ? 30 : 0) +
            (indicators.hasMediaQuery ? 20 : 0)
        );

        return {
            isResponsive: score >= 40,
            confidence: score,
            indicators,
            quick: true
        };
    }
}

module.exports = ResponsiveDetector;
