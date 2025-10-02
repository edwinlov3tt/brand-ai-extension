/**
 * Advanced Logo Detector with Perceptual Hashing and Deduplication
 * Uses image analysis to find and deduplicate brand logos
 */

class LogoDetector {
    constructor() {
        this.MIN_IMAGE_SIZE = 80; // Increased from 50 - logos shouldn't be tiny
        this.MAX_IMAGE_SIZE = 500; // Reduced from 800 - logos are rarely huge
        this.IDEAL_LOGO_RATIO = [1, 5]; // Width:height ratio range (1:1 to 5:1)
        this.MIN_LOGO_SCORE = 80; // Increased from 60 - MUCH stricter detection
        this.LOGO_SELECTORS = [
            'img[alt*="logo" i]',
            'img[class*="logo" i]',
            'img[id*="logo" i]',
            'a[class*="logo" i] img',
            'a[id*="logo" i] img',
            'header img',
            'nav img',
            '.header img',
            '.navbar img',
            '.branding img',
            'img[src*="logo" i]'
        ];
        this.FAVICON_SELECTORS = [
            'link[rel="icon"]',
            'link[rel="shortcut icon"]',
            'link[rel="apple-touch-icon"]',
            'link[rel="apple-touch-icon-precomposed"]'
        ];
        // NEW: Patterns that DISQUALIFY images from being logos (stored as strings for serialization)
        this.EXCLUDE_PATTERN_STRINGS = [
            'coupon', 'promo', 'sale', 'deal', 'discount', 'special', 'offer',
            'badge', 'award', 'certification', 'accreditation', 'certified',
            'gallery', 'portfolio', 'project', 'testimonial', 'review',
            'people', 'person', 'team', 'staff', 'employee', 'headshot',
            'banner', 'hero', 'slide', 'carousel', 'feature',
            'partner', 'sponsor', 'client', 'customer',
            'product', 'service', 'work', 'case-study'
        ];
    }

    /**
     * Detect and extract brand logos from page
     */
    async detectLogos(page, baseUrl) {
        console.log('🎯 Starting logo detection...');

        const logoData = await page.evaluate((config) => {
            const results = {
                candidates: [],
                favicons: [],
                metadata: {
                    totalImages: 0,
                    candidatesFound: 0
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

            // Helper: Check if element is in footer
            const isInFooter = (el) => {
                let parent = el.parentElement;
                while (parent) {
                    const tag = parent.tagName?.toLowerCase() || '';
                    const className = parent.className?.toLowerCase() || '';

                    if (tag === 'footer' || className.includes('footer')) {
                        return true;
                    }
                    parent = parent.parentElement;
                }
                return false;
            };

            // Helper: Check if image matches exclude patterns
            const matchesExcludePattern = (img) => {
                const alt = img.alt?.toLowerCase() || '';
                const className = img.className?.toLowerCase() || '';
                const id = img.id?.toLowerCase() || '';
                const src = img.src?.toLowerCase() || '';
                const combinedText = `${alt} ${className} ${id} ${src}`;

                // Convert string patterns to regex
                return config.EXCLUDE_PATTERN_STRINGS.some(patternStr => {
                    return combinedText.includes(patternStr);
                });
            };

            // Helper: Check if element is in promotional section
            const isInPromoSection = (el) => {
                let parent = el.parentElement;
                while (parent) {
                    const className = parent.className?.toLowerCase() || '';
                    const id = parent.id?.toLowerCase() || '';

                    if (/(promo|sale|deal|offer|coupon|banner|hero|slide|carousel)/.test(className) ||
                        /(promo|sale|deal|offer|coupon|banner|hero|slide|carousel)/.test(id)) {
                        return true;
                    }
                    parent = parent.parentElement;
                }
                return false;
            };

            // Helper: Calculate logo score with strict header/footer requirement
            const calculateLogoScore = (img, rect, inHeader, hasLogoKeyword) => {
                // IMMEDIATE DISQUALIFICATION: Check exclude patterns first
                if (matchesExcludePattern(img)) {
                    return 0; // Not a logo - promotional/team/gallery image
                }

                // IMMEDIATE DISQUALIFICATION: In promotional section
                if (isInPromoSection(img)) {
                    return 0; // Not a logo - promotional banner/coupon
                }

                let score = 0;
                const inFooter = isInFooter(img);
                const windowHeight = window.innerHeight;

                // STRICT REQUIREMENT: Must be in header, footer, or top/bottom 250px
                if (!inHeader && !inFooter && rect.top > 250 && rect.top < windowHeight - 250) {
                    return 0; // Automatically disqualify middle-page images
                }

                // Header/footer/nav scoring (REQUIRED)
                if (inHeader) {
                    score += 40; // Increased from 20
                }
                if (inFooter) {
                    score += 30; // NEW: Footer logos
                }

                // Position scoring (must be at top or bottom)
                if (rect.top < 200) {
                    score += 30; // Increased from 25 - top of page
                } else if (rect.top > windowHeight - 300) {
                    score += 25; // NEW: Bottom logos (footer)
                } else if (rect.top < 250) {
                    score += 20; // Still near top
                } else {
                    return 0; // Disqualify if not at top/bottom
                }

                // Logo keyword scoring (HIGHLY WEIGHTED)
                if (hasLogoKeyword) {
                    score += 40; // Increased from 30
                } else {
                    score -= 20; // Penalty for missing logo keyword
                }

                // Size scoring (prefer smaller, actual logo sizes 50-300px)
                const avgSize = (rect.width + rect.height) / 2;
                if (avgSize >= 50 && avgSize <= 300) {
                    score += 30; // Sweet spot for logos
                } else if (avgSize >= 30 && avgSize <= 400) {
                    score += 20;
                } else if (avgSize >= 20 && avgSize <= 600) {
                    score += 10;
                } else {
                    score -= 10; // Too large or too small
                }

                // Aspect ratio scoring (prefer horizontal or square logos)
                const ratio = rect.width / rect.height;
                if (ratio >= 0.8 && ratio <= 5) {
                    score += 20;
                } else {
                    score -= 10; // Unusual aspect ratio
                }

                // Left alignment scoring (logos typically on left)
                if (rect.left < 300) {
                    score += 20; // Increased from 10
                } else if (rect.left > window.innerWidth - 300) {
                    score += 10; // Right-aligned (some sites)
                }

                return score;
            };

            // Helper: Check if element is in header/nav
            const isInHeaderOrNav = (el) => {
                let parent = el.parentElement;
                while (parent) {
                    const tag = parent.tagName?.toLowerCase() || '';
                    const className = parent.className?.toLowerCase() || '';

                    if (tag === 'header' || tag === 'nav' ||
                        className.includes('header') ||
                        className.includes('navbar') ||
                        className.includes('branding')) {
                        return true;
                    }
                    parent = parent.parentElement;
                }
                return false;
            };

            // Helper: Check for logo keywords
            const hasLogoKeywords = (img) => {
                const alt = img.alt?.toLowerCase() || '';
                const className = img.className?.toLowerCase() || '';
                const id = img.id?.toLowerCase() || '';
                const src = img.src?.toLowerCase() || '';

                return alt.includes('logo') ||
                       className.includes('logo') ||
                       id.includes('logo') ||
                       src.includes('logo') ||
                       alt.includes('brand');
            };

            // Step 1: Find all images
            const allImages = document.querySelectorAll('img');
            results.metadata.totalImages = allImages.length;

            allImages.forEach(img => {
                if (!isVisible(img)) return;

                const rect = img.getBoundingClientRect();

                // Filter by size
                if (rect.width < config.MIN_IMAGE_SIZE || rect.height < config.MIN_IMAGE_SIZE) {
                    return;
                }
                if (rect.width > config.MAX_IMAGE_SIZE || rect.height > config.MAX_IMAGE_SIZE) {
                    return;
                }

                // Check aspect ratio
                const ratio = rect.width / rect.height;
                if (ratio < 1 / config.IDEAL_LOGO_RATIO[1] || ratio > config.IDEAL_LOGO_RATIO[1]) {
                    return;
                }

                const inHeader = isInHeaderOrNav(img);
                const hasKeyword = hasLogoKeywords(img);
                const score = calculateLogoScore(img, rect, inHeader, hasKeyword);

                // Only include candidates with high score (stricter threshold)
                if (score >= config.MIN_LOGO_SCORE) {
                    results.candidates.push({
                        src: img.src,
                        alt: img.alt || '',
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        aspectRatio: parseFloat(ratio.toFixed(2)),
                        position: {
                            top: Math.round(rect.top),
                            left: Math.round(rect.left)
                        },
                        inHeader,
                        hasLogoKeyword: hasKeyword,
                        score,
                        className: img.className || '',
                        id: img.id || ''
                    });
                }
            });

            // Sort by score
            results.candidates.sort((a, b) => b.score - a.score);
            results.metadata.candidatesFound = results.candidates.length;

            // Step 2: Find favicon
            config.FAVICON_SELECTORS.forEach(selector => {
                const link = document.querySelector(selector);
                if (link) {
                    const href = link.getAttribute('href');
                    const sizes = link.getAttribute('sizes') || '';
                    const type = link.getAttribute('type') || '';

                    if (href) {
                        results.favicons.push({
                            url: href,
                            rel: link.rel,
                            sizes,
                            type
                        });
                    }
                }
            });

            return results;
        }, {
            MIN_IMAGE_SIZE: this.MIN_IMAGE_SIZE,
            MAX_IMAGE_SIZE: this.MAX_IMAGE_SIZE,
            IDEAL_LOGO_RATIO: this.IDEAL_LOGO_RATIO,
            MIN_LOGO_SCORE: this.MIN_LOGO_SCORE,
            FAVICON_SELECTORS: this.FAVICON_SELECTORS,
            EXCLUDE_PATTERN_STRINGS: this.EXCLUDE_PATTERN_STRINGS
        });

        console.log(`   ✅ Found ${logoData.candidates.length} logo candidates from ${logoData.metadata.totalImages} images`);

        // Step 3: Resolve relative URLs
        logoData.candidates = logoData.candidates.map(candidate => {
            candidate.src = this.resolveUrl(candidate.src, baseUrl);
            return candidate;
        });

        logoData.favicons = logoData.favicons.map(favicon => {
            favicon.url = this.resolveUrl(favicon.url, baseUrl);
            return favicon;
        });

        // Step 3.5: Filter and validate favicons
        logoData.favicons = await this.filterAndValidateFavicons(logoData.favicons, baseUrl);

        // Step 4: Deduplicate using perceptual hashing (simulated)
        const deduplicated = this.deduplicateLogos(logoData.candidates);

        // Step 5: Extract colors from top logo (if available)
        let logoColors = null;
        if (deduplicated.length > 0) {
            try {
                logoColors = await this.extractLogoColors(page, deduplicated[0].src);
            } catch (e) {
                console.log(`   ⚠️  Could not extract colors from logo: ${e.message}`);
            }
        }

        return {
            primary: deduplicated.length > 0 ? deduplicated[0] : null,
            alternates: deduplicated.slice(1, 5),
            favicons: logoData.favicons,
            logoColors,
            metadata: {
                ...logoData.metadata,
                afterDeduplication: deduplicated.length
            }
        };
    }

    /**
     * Deduplicate logos using simplified perceptual hashing
     * (In production, use actual image hashing like pHash or dHash)
     */
    deduplicateLogos(candidates) {
        const unique = [];
        const seen = new Set();

        for (const candidate of candidates) {
            // Simple deduplication by URL
            const urlKey = candidate.src.split('?')[0]; // Remove query params

            if (!seen.has(urlKey)) {
                seen.add(urlKey);
                unique.push(candidate);
            }
        }

        return unique;
    }

    /**
     * Extract dominant colors from logo image
     */
    async extractLogoColors(page, logoSrc) {
        return await page.evaluate((src) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';

                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        canvas.width = img.width;
                        canvas.height = img.height;

                        ctx.drawImage(img, 0, 0);

                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;

                        // Simple color extraction (sample every 10th pixel)
                        const colorMap = new Map();
                        const WHITE_THRESHOLD = 240;
                        const BLACK_THRESHOLD = 30;

                        for (let i = 0; i < data.length; i += 40) { // Sample every 10th pixel (4 bytes each)
                            const r = data[i];
                            const g = data[i + 1];
                            const b = data[i + 2];
                            const a = data[i + 3];

                            // Skip transparent or near-transparent pixels
                            if (a < 50) continue;

                            // Skip near-white or near-black
                            const avg = (r + g + b) / 3;
                            if (avg > WHITE_THRESHOLD || avg < BLACK_THRESHOLD) continue;

                            const hex = '#' + [r, g, b].map(x => {
                                const h = x.toString(16);
                                return h.length === 1 ? '0' + h : h;
                            }).join('');

                            colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
                        }

                        // Get top 5 colors
                        const colors = Array.from(colorMap.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([hex, count]) => ({
                                hex,
                                frequency: count
                            }));

                        resolve(colors);
                    } catch (e) {
                        reject(e);
                    }
                };

                img.onerror = () => {
                    reject(new Error('Failed to load image'));
                };

                img.src = src;
            });
        }, logoSrc);
    }

    /**
     * Filter and validate favicons
     * Removes data URIs, about:blank, and validates that favicons exist
     */
    async filterAndValidateFavicons(favicons, baseUrl) {
        const axios = require('axios');

        // Step 1: Filter out invalid favicons
        let filtered = favicons.filter(fav => {
            if (!fav.url) return false;

            // Remove data URIs
            if (fav.url.startsWith('data:')) {
                console.log(`   🚫 Skipping data URI favicon`);
                return false;
            }

            // Remove about:blank and other non-http URLs
            if (fav.url.includes('about:') || (!fav.url.startsWith('http'))) {
                console.log(`   🚫 Skipping invalid favicon URL: ${fav.url}`);
                return false;
            }

            // Remove lazy loading placeholders (nitro-empty-id, etc.)
            if (fav.url.includes('nitro-empty-id') || fav.url.includes('lazy-')) {
                console.log(`   🚫 Skipping lazy loading placeholder`);
                return false;
            }

            return true;
        });

        // Step 2: Validate that favicons actually exist
        const validated = [];

        for (const fav of filtered) {
            try {
                const response = await axios.head(fav.url, {
                    timeout: 3000,
                    maxRedirects: 3,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                if (response.status === 200) {
                    validated.push({
                        ...fav,
                        valid: true
                    });
                }
            } catch (error) {
                console.log(`   ⚠️  Favicon not accessible: ${fav.url}`);
            }
        }

        // Step 3: If no valid favicons, try /favicon.ico
        if (validated.length === 0) {
            console.log(`   🔍 No valid favicons found, trying /favicon.ico...`);

            try {
                const faviconUrl = new URL('/favicon.ico', baseUrl).href;
                const response = await axios.head(faviconUrl, {
                    timeout: 3000,
                    maxRedirects: 3,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                if (response.status === 200) {
                    console.log(`   ✅ Found default favicon at /favicon.ico`);
                    validated.push({
                        url: faviconUrl,
                        rel: 'icon',
                        sizes: '',
                        type: 'image/x-icon',
                        valid: true
                    });
                }
            } catch (error) {
                console.log(`   ❌ No /favicon.ico available`);
            }
        }

        console.log(`   ✅ ${validated.length} valid favicon(s) found`);
        return validated;
    }

    /**
     * Resolve relative URLs to absolute
     */
    resolveUrl(url, baseUrl) {
        if (!url) return null;

        try {
            // Already absolute
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }

            // Protocol-relative
            if (url.startsWith('//')) {
                return 'https:' + url;
            }

            // Relative to base
            const base = new URL(baseUrl);

            // Absolute path
            if (url.startsWith('/')) {
                return `${base.protocol}//${base.host}${url}`;
            }

            // Relative path
            return `${base.protocol}//${base.host}${base.pathname}${url}`;
        } catch (e) {
            return url;
        }
    }
}

module.exports = LogoDetector;