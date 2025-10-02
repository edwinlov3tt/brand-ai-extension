/**
 * Brand Extractor Orchestrator
 * Coordinates color, font, and logo analysis to extract comprehensive brand identity
 */

const ColorAnalyzer = require('./color-analyzer');
const FontAnalyzer = require('./font-analyzer');
const LogoDetector = require('./logo-detector');

class BrandExtractor {
    constructor() {
        this.colorAnalyzer = new ColorAnalyzer();
        this.fontAnalyzer = new FontAnalyzer();
        this.logoDetector = new LogoDetector();
    }

    /**
     * Extract comprehensive brand identity from website
     * @param {Page} page - Puppeteer page object
     * @param {string} url - Base URL of the website
     * @param {Object} options - Extraction options
     * @returns {Object} Complete brand analysis
     */
    async extractBrand(page, url, options = {}) {
        const {
            colorCount = 5,
            includeContrast = true,
            includeScreenshot = true,
            screenshotPath = null
        } = options;

        console.log('🎨 Starting comprehensive brand extraction...');
        console.log(`   URL: ${url}`);

        const startTime = Date.now();
        const results = {
            url,
            timestamp: new Date().toISOString(),
            colors: null,
            typography: null,
            logos: null,
            screenshot: null,
            metadata: {
                extractionTime: null,
                success: true,
                errors: []
            }
        };

        try {
            // Step 1: Extract colors
            console.log('\n1️⃣  Analyzing brand colors...');
            try {
                results.colors = await this.colorAnalyzer.extractBrandColors(page, {
                    colorCount,
                    includeContrast,
                    thirdPartyFilter: true
                });
                console.log(`   ✅ Extracted ${results.colors.palette.length} brand colors`);
            } catch (error) {
                console.error(`   ❌ Color extraction failed: ${error.message}`);
                results.metadata.errors.push({
                    stage: 'colors',
                    message: error.message
                });
            }

            // Step 2: Extract typography
            console.log('\n2️⃣  Analyzing brand typography...');
            try {
                results.typography = await this.fontAnalyzer.extractBrandFonts(page, url);

                const headingCount = Object.keys(results.typography.headings).length;
                const hasDisplay = results.typography.display !== null;
                const hasBody = results.typography.body !== null;

                console.log(`   ✅ Found ${headingCount} heading levels, display: ${hasDisplay}, body: ${hasBody}`);
            } catch (error) {
                console.error(`   ❌ Typography extraction failed: ${error.message}`);
                results.metadata.errors.push({
                    stage: 'typography',
                    message: error.message
                });
            }

            // Step 3: Detect logos
            console.log('\n3️⃣  Detecting brand logos...');
            try {
                results.logos = await this.logoDetector.detectLogos(page, url);

                const hasPrimaryLogo = results.logos.primary !== null;
                const alternateCount = results.logos.alternates.length;
                const faviconCount = results.logos.favicons.length;

                console.log(`   ✅ Primary logo: ${hasPrimaryLogo}, alternates: ${alternateCount}, favicons: ${faviconCount}`);
            } catch (error) {
                console.error(`   ❌ Logo detection failed: ${error.message}`);
                results.metadata.errors.push({
                    stage: 'logos',
                    message: error.message
                });
            }

            // Step 4: Capture screenshot (optional)
            if (includeScreenshot) {
                console.log('\n4️⃣  Capturing screenshot...');
                try {
                    const screenshot = await this.captureScreenshot(page, screenshotPath);
                    results.screenshot = screenshot;
                    console.log(`   ✅ Screenshot captured: ${screenshot.path || 'base64'}`);
                } catch (error) {
                    console.error(`   ❌ Screenshot capture failed: ${error.message}`);
                    results.metadata.errors.push({
                        stage: 'screenshot',
                        message: error.message
                    });
                }
            }

            // Step 5: Cross-validate colors with logo colors
            if (results.colors && results.logos && results.logos.logoColors) {
                console.log('\n5️⃣  Cross-validating logo colors...');
                this.enrichColorsWithLogoData(results.colors, results.logos.logoColors);
            }

        } catch (error) {
            console.error(`❌ Fatal error during brand extraction: ${error.message}`);
            results.metadata.success = false;
            results.metadata.errors.push({
                stage: 'fatal',
                message: error.message
            });
        }

        const endTime = Date.now();
        results.metadata.extractionTime = `${((endTime - startTime) / 1000).toFixed(2)}s`;

        console.log(`\n✨ Brand extraction complete in ${results.metadata.extractionTime}`);

        return results;
    }

    /**
     * Capture full-page screenshot with multi-strategy fallback
     */
    async captureScreenshot(page, outputPath = null) {
        console.log('   📸 Attempting screenshot capture...');

        // Strategy 1: Try fullPage with extended timeout
        try {
            // Wait for any lazy-loaded content
            await page.waitForTimeout(1000);

            const buffer = await page.screenshot({
                fullPage: true,
                type: 'png',
                timeout: 15000
            });

            console.log('   ✅ Full-page screenshot successful (Strategy 1)');

            if (outputPath) {
                require('fs').writeFileSync(outputPath, buffer);
                return {
                    path: outputPath,
                    type: 'file',
                    size: buffer.length,
                    strategy: 'fullPage'
                };
            } else {
                const base64 = buffer.toString('base64');
                return {
                    data: `data:image/png;base64,${base64}`,
                    type: 'base64',
                    size: buffer.length,
                    strategy: 'fullPage'
                };
            }
        } catch (error) {
            console.log(`   ⚠️  Full-page screenshot failed: ${error.message}`);
            console.log('   🔄 Trying Strategy 2: Calculate actual page height...');
        }

        // Strategy 2: Calculate actual page height and set viewport
        try {
            const bodyHeight = await page.evaluate(() => {
                return Math.max(
                    document.body.scrollHeight || 0,
                    document.body.offsetHeight || 0,
                    document.documentElement.clientHeight || 0,
                    document.documentElement.scrollHeight || 0,
                    document.documentElement.offsetHeight || 0
                );
            });

            console.log(`   📐 Calculated page height: ${bodyHeight}px`);

            // Puppeteer max height is 16384
            const cappedHeight = Math.min(bodyHeight, 16384);

            await page.setViewport({
                width: 1920,
                height: cappedHeight
            });

            // Wait a moment for viewport adjustment
            await page.waitForTimeout(500);

            const buffer = await page.screenshot({
                type: 'png',
                timeout: 10000
            });

            console.log('   ✅ Height-calculated screenshot successful (Strategy 2)');

            if (outputPath) {
                require('fs').writeFileSync(outputPath, buffer);
                return {
                    path: outputPath,
                    type: 'file',
                    size: buffer.length,
                    strategy: 'calculated-height',
                    actualHeight: bodyHeight,
                    capturedHeight: cappedHeight
                };
            } else {
                const base64 = buffer.toString('base64');
                return {
                    data: `data:image/png;base64,${base64}`,
                    type: 'base64',
                    size: buffer.length,
                    strategy: 'calculated-height',
                    actualHeight: bodyHeight,
                    capturedHeight: cappedHeight
                };
            }
        } catch (error) {
            console.log(`   ⚠️  Strategy 2 failed: ${error.message}`);
            console.log('   🔄 Trying Strategy 3: Standard viewport screenshot...');
        }

        // Strategy 3: Fallback to standard viewport screenshot
        try {
            // Reset to standard viewport
            await page.setViewport({ width: 1920, height: 1080 });

            const buffer = await page.screenshot({
                type: 'png',
                timeout: 5000
            });

            console.log('   ⚠️  Fallback to viewport-only screenshot (Strategy 3)');

            if (outputPath) {
                require('fs').writeFileSync(outputPath, buffer);
                return {
                    path: outputPath,
                    type: 'file',
                    size: buffer.length,
                    strategy: 'viewport-only',
                    warning: 'Only captured visible viewport, not full page'
                };
            } else {
                const base64 = buffer.toString('base64');
                return {
                    data: `data:image/png;base64,${base64}`,
                    type: 'base64',
                    size: buffer.length,
                    strategy: 'viewport-only',
                    warning: 'Only captured visible viewport, not full page'
                };
            }
        } catch (error) {
            console.error('   ❌ All screenshot strategies failed');
            throw new Error(`Screenshot capture failed: ${error.message}`);
        }
    }

    /**
     * Enrich color palette with logo color data
     * Increases confidence for colors that also appear in the logo
     */
    enrichColorsWithLogoData(colorData, logoColors) {
        if (!logoColors || logoColors.length === 0) return;

        console.log(`   🔍 Matching ${colorData.palette.length} palette colors with ${logoColors.length} logo colors...`);

        let matches = 0;

        colorData.palette.forEach(paletteColor => {
            logoColors.forEach(logoColor => {
                if (this.colorsAreSimilar(paletteColor.hex, logoColor.hex)) {
                    // Boost confidence if color appears in logo
                    paletteColor.confidence = Math.min(0.99, paletteColor.confidence + 0.1);
                    paletteColor.inLogo = true;
                    matches++;
                }
            });

            if (!paletteColor.inLogo) {
                paletteColor.inLogo = false;
            }
        });

        console.log(`   ✅ Found ${matches} color matches between palette and logo`);
    }

    /**
     * Check if two hex colors are similar (simplified)
     */
    colorsAreSimilar(hex1, hex2, threshold = 30) {
        const rgb1 = this.hexToRgb(hex1);
        const rgb2 = this.hexToRgb(hex2);

        if (!rgb1 || !rgb2) return false;

        const distance = Math.sqrt(
            Math.pow(rgb1.r - rgb2.r, 2) +
            Math.pow(rgb1.g - rgb2.g, 2) +
            Math.pow(rgb1.b - rgb2.b, 2)
        );

        return distance <= threshold;
    }

    /**
     * Convert hex to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * Generate brand summary
     */
    generateBrandSummary(brandData) {
        const summary = {
            url: brandData.url,
            timestamp: brandData.timestamp,
            primaryColor: null,
            displayFont: null,
            bodyFont: null,
            logo: null,
            confidence: 0
        };

        // Extract primary color
        if (brandData.colors && brandData.colors.palette.length > 0) {
            const primary = brandData.colors.palette.find(c => c.role === 'primary') || brandData.colors.palette[0];
            summary.primaryColor = {
                hex: primary.hex,
                confidence: primary.confidence
            };
        }

        // Extract display font
        if (brandData.typography && brandData.typography.display) {
            summary.displayFont = {
                family: brandData.typography.display.family,
                confidence: brandData.typography.display.confidence
            };
        }

        // Extract body font
        if (brandData.typography && brandData.typography.body) {
            summary.bodyFont = {
                family: brandData.typography.body.family,
                confidence: brandData.typography.body.confidence
            };
        }

        // Extract logo
        if (brandData.logos && brandData.logos.primary) {
            summary.logo = {
                url: brandData.logos.primary.src,
                score: brandData.logos.primary.score
            };
        }

        // Calculate overall confidence
        const confidences = [];
        if (summary.primaryColor) confidences.push(summary.primaryColor.confidence);
        if (summary.displayFont) confidences.push(summary.displayFont.confidence);
        if (summary.bodyFont) confidences.push(summary.bodyFont.confidence);
        if (summary.logo) confidences.push(summary.logo.score / 100);

        summary.confidence = confidences.length > 0
            ? parseFloat((confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(2))
            : 0;

        return summary;
    }
}

module.exports = BrandExtractor;