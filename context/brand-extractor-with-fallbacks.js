/**
 * Brand Extractor with Fallback Mechanisms
 * Handles Cloudflare blocking with proxy fallback, screenshot APIs, and static HTML analysis
 */

const BrandExtractor = require('./brand-extractor');
const CloudflareEvasion = require('./cloudflare-evasion');

class BrandExtractorWithFallbacks extends BrandExtractor {
    constructor() {
        super();
        this.cloudflareEvasion = new CloudflareEvasion();
        this.proxyManager = null;

        // Try to load proxy manager if available
        try {
            const ProxyManager = require('./proxy-config');
            this.proxyManager = new ProxyManager();
        } catch (e) {
            console.log('⚠️  Proxy manager not available, fallback options limited');
        }
    }

    /**
     * Extract brand with intelligent fallback mechanisms
     */
    async extractBrandWithFallbacks(initialPage, url, options = {}) {
        console.log('🎨 Starting brand extraction with fallback mechanisms...');

        let page = initialPage;
        let usingFallback = false;
        let fallbackMethod = null;

        try {
            // Step 1: Check if page is Cloudflare blocked
            const content = await page.content();
            const title = await page.title().catch(() => '');

            if (this.isCloudflareBlocked(content, title)) {
                console.log('🚫 Cloudflare robot detection detected (robot-suspicion.svg)');
                console.log('🔄 Attempting fallback extraction methods...');

                // Try fallback 1: Retry with proxy
                if (this.proxyManager) {
                    console.log('   Fallback 1: Trying with residential proxy...');
                    const proxyResult = await this.extractWithProxy(url, options);
                    if (proxyResult && proxyResult.success) {
                        console.log('   ✅ Proxy extraction successful!');
                        proxyResult.metadata.fallbackUsed = 'residential-proxy';
                        return proxyResult;
                    }
                    console.log('   ❌ Proxy extraction failed, trying next fallback...');
                }

                // Fallback 2: Static HTML analysis
                console.log('   Fallback 2: Trying static HTML extraction...');
                const staticResult = await this.extractFromStaticHTML(url, options);
                if (staticResult && staticResult.colors) {
                    console.log('   ✅ Static HTML extraction successful (limited data)');
                    staticResult.metadata.fallbackUsed = 'static-html';
                    staticResult.metadata.warnings = staticResult.metadata.warnings || [];
                    staticResult.metadata.warnings.push('Limited extraction due to bot protection - used static HTML fallback');
                    return staticResult;
                }
                console.log('   ❌ Static HTML extraction failed');

                // Fallback 3: Screenshot API suggestion
                return {
                    success: false,
                    error: 'Cloudflare robot detection active',
                    suggestions: {
                        screenshotApi: 'Consider using screenshot API services like ScreenshotOne, ApiFlash, or UrlBox',
                        logoApi: 'Consider using Clearbit Logo API or Brandfetch API',
                        recommendation: 'Use third-party APIs for better Cloudflare bypass: screenshot for colors, logo APIs for brand assets'
                    },
                    metadata: {
                        fallbackAttempted: true,
                        blockType: 'cloudflare-robot-suspicion'
                    }
                };
            }

            // No blocking detected, proceed normally
            console.log('✅ No bot protection detected, proceeding with full extraction');
            return await this.extractBrand(page, url, options);

        } catch (error) {
            console.error('❌ Brand extraction error:', error.message);

            // If error during extraction, try static fallback
            console.log('🔄 Attempting static HTML fallback due to error...');
            try {
                const staticResult = await this.extractFromStaticHTML(url, options);
                if (staticResult) {
                    staticResult.metadata.fallbackUsed = 'static-html-error-recovery';
                    staticResult.metadata.originalError = error.message;
                    return staticResult;
                }
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError.message);
            }

            throw error;
        }
    }

    /**
     * Check if page is Cloudflare blocked
     */
    isCloudflareBlocked(html, title) {
        return this.cloudflareEvasion.isCloudflareChallenge(html, title) ||
               this.cloudflareEvasion.isBotProtected(html, title);
    }

    /**
     * Extract brand using residential proxy
     */
    async extractWithProxy(url, options) {
        if (!this.proxyManager) {
            return null;
        }

        const puppeteer = require('puppeteer');
        let browser = null;

        try {
            const proxyConfig = this.proxyManager.getProxyForPuppeteer();

            console.log(`   🔌 Using proxy: ${proxyConfig.server}`);

            browser = await puppeteer.launch({
                headless: 'new',
                executablePath: '/usr/bin/google-chrome-stable',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-blink-features=AutomationControlled',
                    `--proxy-server=${proxyConfig.server}`
                ]
            });

            const page = await browser.newPage();

            // Authenticate proxy
            if (proxyConfig.username && proxyConfig.password) {
                await page.authenticate({
                    username: proxyConfig.username,
                    password: proxyConfig.password
                });
            }

            // Set stealth headers
            const stealthHeaders = this.cloudflareEvasion.getStealthHeaders(url);
            await page.setExtraHTTPHeaders(stealthHeaders);

            // Add UTM parameters for more natural appearance
            const urlWithUtm = this.cloudflareEvasion.addUtmParameters(url);

            await page.setViewport({ width: 1920, height: 1080 });
            await page.goto(urlWithUtm, {
                waitUntil: 'networkidle2',
                timeout: 45000
            });

            // Wait a bit to appear more human-like
            await page.waitForTimeout(2000);

            // Check if still blocked
            const content = await page.content();
            const title = await page.title().catch(() => '');

            if (this.isCloudflareBlocked(content, title)) {
                console.log('   ⚠️  Still blocked even with proxy');
                return null;
            }

            // Extract brand normally
            const result = await this.extractBrand(page, url, options);
            result.metadata.proxyUsed = true;
            result.metadata.proxyServer = proxyConfig.server.split(':')[0]; // Hide port for privacy

            return result;

        } catch (error) {
            console.error('   ❌ Proxy extraction error:', error.message);
            return null;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Extract brand from static HTML (no JavaScript execution)
     * Limited functionality but works when Puppeteer is blocked
     */
    async extractFromStaticHTML(url, options) {
        console.log('   📄 Fetching static HTML...');

        try {
            const axios = require('axios');
            const cheerio = require('cheerio');

            // Use stealth headers
            const headers = this.cloudflareEvasion.getStealthHeaders(url);
            const urlWithUtm = this.cloudflareEvasion.addUtmParameters(url);

            const response = await axios.get(urlWithUtm, {
                headers,
                timeout: 30000,
                maxRedirects: 5,
                validateStatus: (status) => status < 400
            });

            const html = response.data;
            const $ = cheerio.load(html);

            // Check if blocked
            if (this.isCloudflareBlocked(html, $('title').text())) {
                console.log('   ⚠️  Still blocked in static HTML fetch');
                return null;
            }

            // Extract what we can from static HTML
            const result = {
                url,
                timestamp: new Date().toISOString(),
                colors: this.extractColorsFromHTML($, html),
                typography: this.extractFontsFromHTML($),
                logos: this.extractLogosFromHTML($, url),
                metadata: {
                    extractionTime: 'N/A',
                    success: true,
                    method: 'static-html',
                    warnings: [
                        'Limited extraction: JavaScript-rendered content not available',
                        'Font detection limited to inline styles and CSS',
                        'Dynamic colors and logos may be missing'
                    ]
                }
            };

            return result;

        } catch (error) {
            console.error('   ❌ Static HTML extraction error:', error.message);
            return null;
        }
    }

    /**
     * Extract colors from static HTML using CSS and inline styles
     */
    extractColorsFromHTML($, html) {
        const colors = new Map();

        // Extract from inline styles
        $('[style]').each((i, el) => {
            const style = $(el).attr('style');
            this.extractColorsFromStyle(style, colors);
        });

        // Extract from style tags
        $('style').each((i, el) => {
            const css = $(el).html();
            this.extractColorsFromStyle(css, colors);
        });

        // Convert to palette format
        const palette = Array.from(colors.entries())
            .map(([hex, count]) => ({
                hex,
                rgb: this.hexToRgb(hex),
                role: 'brand',
                frequency: count,
                coverage: 'unknown',
                confidence: 0.5, // Lower confidence for static extraction
                usedIn: ['static-html'],
                types: ['color']
            }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 5);

        return { palette };
    }

    /**
     * Extract colors from CSS/style string
     */
    extractColorsFromStyle(style, colors) {
        if (!style) return;

        // Regex for hex colors
        const hexRegex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
        const matches = style.match(hexRegex) || [];

        matches.forEach(hex => {
            const normalized = hex.length === 4
                ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
                : hex;
            colors.set(normalized.toLowerCase(), (colors.get(normalized.toLowerCase()) || 0) + 1);
        });
    }

    /**
     * Extract fonts from static HTML
     */
    extractFontsFromHTML($) {
        const fonts = new Set();

        // Check font-family in inline styles
        $('[style*="font-family"]').each((i, el) => {
            const style = $(el).attr('style');
            const match = style.match(/font-family:\s*([^;]+)/i);
            if (match) {
                const family = match[1].replace(/['"]/g, '').split(',')[0].trim();
                fonts.add(family);
            }
        });

        // Check style tags
        $('style').each((i, el) => {
            const css = $(el).html();
            const matches = css.match(/font-family:\s*([^;]+)/gi) || [];
            matches.forEach(m => {
                const family = m.replace(/font-family:\s*/i, '').replace(/['"]/g, '').split(',')[0].trim();
                fonts.add(family);
            });
        });

        const fontArray = Array.from(fonts).slice(0, 3);

        return {
            display: fontArray[0] ? { family: fontArray[0], confidence: 0.4 } : null,
            body: fontArray[1] ? { family: fontArray[1], confidence: 0.4 } : null,
            headings: {},
            metadata: {
                totalElements: 0,
                fontSources: ['static-html']
            }
        };
    }

    /**
     * Extract logos from static HTML img tags
     */
    extractLogosFromHTML($, baseUrl) {
        const logos = [];

        $('img').each((i, el) => {
            const src = $(el).attr('src');
            const alt = $(el).attr('alt') || '';
            const className = $(el).attr('class') || '';

            // Look for logo-like images
            if (src && (alt.toLowerCase().includes('logo') ||
                        className.toLowerCase().includes('logo') ||
                        src.toLowerCase().includes('logo'))) {
                logos.push({
                    src: this.resolveUrl(src, baseUrl),
                    alt,
                    score: 50, // Medium confidence for static
                    method: 'static-html'
                });
            }
        });

        return {
            primary: logos[0] || null,
            alternates: logos.slice(1, 5),
            favicons: [],
            metadata: {
                totalImages: $('img').length,
                candidatesFound: logos.length
            }
        };
    }

    /**
     * Resolve relative URL to absolute
     */
    resolveUrl(url, baseUrl) {
        if (!url) return null;
        try {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }
            if (url.startsWith('//')) {
                return 'https:' + url;
            }
            const base = new URL(baseUrl);
            if (url.startsWith('/')) {
                return `${base.protocol}//${base.host}${url}`;
            }
            return `${base.protocol}//${base.host}${base.pathname}${url}`;
        } catch (e) {
            return url;
        }
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
        } : { r: 0, g: 0, b: 0 };
    }
}

module.exports = BrandExtractorWithFallbacks;