/**
 * AI-Powered Brand Page Discovery
 * Intelligently discovers and scrapes pages relevant for brand insights generation
 */

const AIWorker = require('./ai-worker');

class BrandPageDiscoverer {
    constructor() {
        this.aiWorker = new AIWorker();
        this.maxPagesDefault = 10;
        this.maxPagesLimit = 20;

        // Category definitions for brand insights
        this.categories = {
            'company-overview': {
                keywords: ['about', 'who-we-are', 'our-story', 'company', 'overview'],
                priority: 1
            },
            'brand-mission': {
                keywords: ['mission', 'vision', 'values', 'purpose', 'why-us', 'philosophy'],
                priority: 2
            },
            'services': {
                keywords: ['services', 'solutions', 'products', 'what-we-do', 'offerings'],
                priority: 3
            },
            'team': {
                keywords: ['team', 'people', 'leadership', 'staff', 'our-team', 'executives'],
                priority: 4
            },
            'awards': {
                keywords: ['awards', 'recognition', 'testimonials', 'reviews', 'press', 'accolades'],
                priority: 5
            },
            'service-area': {
                keywords: ['locations', 'areas-served', 'coverage', 'service-area', 'where-we-work'],
                priority: 6
            },
            'portfolio': {
                keywords: ['work', 'portfolio', 'case-studies', 'projects', 'showcase'],
                priority: 7
            }
        };
    }

    /**
     * Main entry point: Discover relevant brand pages with AI
     */
    async discoverBrandPages(url, options = {}) {
        const startTime = Date.now();
        const maxPages = Math.min(options.maxPages || this.maxPagesDefault, this.maxPagesLimit);
        const includeScraping = options.includeScraping !== false;
        const includeImages = options.includeImages || false;
        const maxImagesPerPage = Math.min(options.maxImagesPerPage || 5, 10);

        console.log(`🔍 Starting brand page discovery for: ${url}`);
        console.log(`   Max pages: ${maxPages}, Include scraping: ${includeScraping}, Include images: ${includeImages}`);

        try {
            // Step 1: Find sitemaps
            console.log('\n1️⃣  Finding sitemaps...');
            const sitemapUrls = await this.findSitemapUrls(url);
            console.log(`   ✅ Found ${sitemapUrls.length} sitemap(s)`);

            // Step 2: Extract all page URLs from sitemaps
            console.log('\n2️⃣  Extracting page URLs from sitemaps...');
            const allPageUrls = await this.extractAllPageUrls(sitemapUrls, url);
            console.log(`   ✅ Extracted ${allPageUrls.length} unique page URLs`);

            // Step 3: Rank pages by relevance using AI
            console.log('\n3️⃣  Ranking pages by relevance (AI-powered)...');
            const rankedPages = await this.rankPagesByRelevance(allPageUrls, maxPages, url);
            console.log(`   ✅ Selected top ${rankedPages.length} most relevant pages`);

            // Step 4: Scrape content from top pages (if enabled)
            let pagesWithContent = rankedPages;
            if (includeScraping || includeImages) {
                console.log('\n4️⃣  Scraping content from selected pages...');
                pagesWithContent = await this.scrapeMultiplePages(rankedPages, includeScraping, includeImages, maxImagesPerPage);
                const successCount = pagesWithContent.filter(p => p.textContent || (p.images && p.images.length > 0)).length;
                console.log(`   ✅ Successfully scraped ${successCount}/${pagesWithContent.length} pages`);
            }

            // Step 5: Generate insights summary
            const insights = this.generateInsightsSummary(pagesWithContent);

            const analysisTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`\n✨ Brand page discovery complete in ${analysisTime}s`);

            return {
                success: true,
                url,
                timestamp: new Date().toISOString(),
                discoveryMetadata: {
                    totalPagesFound: allPageUrls.length,
                    sitemapsAnalyzed: sitemapUrls,
                    aiModel: this.aiWorker.config.models.haiku,
                    analysisTime: `${analysisTime}s`,
                    scrapingEnabled: includeScraping
                },
                pages: pagesWithContent,
                insights
            };

        } catch (error) {
            console.error('❌ Brand page discovery error:', error.message);

            return {
                success: false,
                url,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Find sitemap URLs from robots.txt and common locations
     */
    async findSitemapUrls(baseUrl) {
        const sitemapUrls = [];
        const baseOrigin = new URL(baseUrl).origin;

        try {
            // Use existing parseRobotsTxt function from server.js
            const parseRobotsTxt = require('./server.js').parseRobotsTxt;

            // Try robots.txt first
            try {
                const robotsResult = await this.parseRobotsTxtLocal(baseUrl);
                if (robotsResult.sitemaps && robotsResult.sitemaps.length > 0) {
                    sitemapUrls.push(...robotsResult.sitemaps);
                    console.log(`   Found ${robotsResult.sitemaps.length} sitemap(s) in robots.txt`);
                }
            } catch (e) {
                console.log('   Could not parse robots.txt, trying common locations...');
            }

            // If no sitemaps found in robots.txt, try common locations
            if (sitemapUrls.length === 0) {
                const commonLocations = [
                    `${baseOrigin}/sitemap.xml`,
                    `${baseOrigin}/sitemap_index.xml`,
                    `${baseOrigin}/sitemap-index.xml`,
                    `${baseOrigin}/wp-sitemap.xml`
                ];

                for (const location of commonLocations) {
                    try {
                        const result = await this.fetchUrl(location);
                        if (result && result.data && (result.data.includes('<urlset') || result.data.includes('<sitemapindex'))) {
                            sitemapUrls.push(location);
                            console.log(`   Found sitemap at: ${location}`);
                            break; // Found one, stop searching
                        }
                    } catch (e) {
                        // Continue to next location
                    }
                }
            }

            // If still no sitemaps, fall back to homepage
            if (sitemapUrls.length === 0) {
                console.log('   ⚠️  No sitemaps found, will use homepage and common paths');
                return []; // Return empty, will trigger fallback
            }

            return sitemapUrls;

        } catch (error) {
            console.error('Error finding sitemaps:', error.message);
            return [];
        }
    }

    /**
     * Parse robots.txt locally (simplified version)
     */
    async parseRobotsTxtLocal(baseUrl) {
        const robotsUrl = new URL('/robots.txt', baseUrl).href;
        const sitemaps = [];

        try {
            const result = await this.fetchUrl(robotsUrl);
            if (result && result.data) {
                const sitemapMatches = result.data.match(/^Sitemap:\s*(.+)$/gmi) || [];

                for (const match of sitemapMatches) {
                    const sitemapUrl = match.replace(/^Sitemap:\s*/i, '').trim();
                    try {
                        const absoluteUrl = new URL(sitemapUrl, baseUrl).href;
                        sitemaps.push(absoluteUrl);
                    } catch (e) {
                        // Skip invalid URLs
                    }
                }

                return { sitemaps, robotsFound: true };
            }
        } catch (error) {
            console.log(`Could not fetch robots.txt: ${error.message}`);
        }

        return { sitemaps: [], robotsFound: false };
    }

    /**
     * Extract all page URLs from sitemaps (handles sitemap indexes)
     */
    async extractAllPageUrls(sitemapUrls, baseUrl) {
        const allUrls = new Set();
        const baseDomain = new URL(baseUrl).hostname;

        // If no sitemaps, use fallback strategy
        if (sitemapUrls.length === 0) {
            return await this.getFallbackPages(baseUrl);
        }

        for (const sitemapUrl of sitemapUrls) {
            try {
                const urls = await this.parseSitemapRecursively(sitemapUrl, baseDomain);
                urls.forEach(url => allUrls.add(url));
            } catch (error) {
                console.error(`Error parsing sitemap ${sitemapUrl}:`, error.message);
            }
        }

        return Array.from(allUrls);
    }

    /**
     * Recursively parse sitemap (handles sitemap indexes)
     */
    async parseSitemapRecursively(sitemapUrl, baseDomain, depth = 0) {
        const urls = new Set();
        const maxDepth = 3; // Prevent infinite recursion

        if (depth > maxDepth) {
            console.log(`   Max depth reached for ${sitemapUrl}`);
            return Array.from(urls);
        }

        try {
            const result = await this.fetchUrl(sitemapUrl);
            if (!result || !result.data) return Array.from(urls);

            const xml = result.data;

            // Check if this is a sitemap index
            if (xml.includes('<sitemapindex') || (xml.includes('<sitemap>') && xml.includes('</sitemap>'))) {
                console.log(`   Detected sitemap index at depth ${depth}`);

                // Extract child sitemap URLs
                const sitemapMatches = xml.match(/<loc[^>]*>([^<]+)<\/loc>/gi) || [];

                for (const match of sitemapMatches) {
                    const childUrl = match.replace(/<\/?loc[^>]*>/gi, '').trim();

                    try {
                        const urlObj = new URL(childUrl);
                        if (urlObj.hostname === baseDomain) {
                            // Recursively parse child sitemap
                            const childUrls = await this.parseSitemapRecursively(childUrl, baseDomain, depth + 1);
                            childUrls.forEach(url => urls.add(url));
                        }
                    } catch (e) {
                        // Skip invalid URLs
                    }
                }
            } else {
                // Regular sitemap - extract page URLs
                const urlMatches = xml.match(/<loc[^>]*>([^<]+)<\/loc>/gi) || [];

                for (const match of urlMatches) {
                    const pageUrl = match.replace(/<\/?loc[^>]*>/gi, '').trim();

                    try {
                        const urlObj = new URL(pageUrl);
                        // Only include URLs from same domain and not sitemap files
                        if (urlObj.hostname === baseDomain && !pageUrl.toLowerCase().includes('sitemap')) {
                            urls.add(pageUrl);
                        }
                    } catch (e) {
                        // Skip invalid URLs
                    }
                }
            }

            return Array.from(urls);

        } catch (error) {
            console.error(`Error in parseSitemapRecursively: ${error.message}`);
            return Array.from(urls);
        }
    }

    /**
     * Fallback: Get common brand pages when no sitemap is available
     */
    async getFallbackPages(baseUrl) {
        const baseOrigin = new URL(baseUrl).origin;
        const commonPaths = [
            '/',
            '/about',
            '/about-us',
            '/who-we-are',
            '/our-story',
            '/mission',
            '/vision',
            '/values',
            '/services',
            '/solutions',
            '/team',
            '/our-team',
            '/leadership',
            '/awards',
            '/testimonials',
            '/locations',
            '/service-areas',
            '/portfolio',
            '/work',
            '/case-studies'
        ];

        console.log('   Using fallback: common brand page paths');
        return commonPaths.map(path => `${baseOrigin}${path}`);
    }

    /**
     * Rank pages by relevance using AI
     */
    async rankPagesByRelevance(pageUrls, maxPages, baseUrl) {
        // If we have fewer pages than maxPages, return all
        if (pageUrls.length <= maxPages) {
            return pageUrls.map(url => ({
                url,
                relevanceScore: 0.8,
                category: this.categorizeUrl(url),
                reason: 'Included due to limited page count'
            }));
        }

        // Pre-filter obvious non-relevant pages if list is too large
        let filteredUrls = pageUrls;
        if (pageUrls.length > 200) {
            console.log(`   Pre-filtering ${pageUrls.length} URLs before AI analysis...`);
            filteredUrls = this.preFilterUrls(pageUrls);
            console.log(`   Reduced to ${filteredUrls.length} candidates`);
        }

        // Use AI to rank remaining pages
        try {
            const aiResult = await this.rankWithAI(filteredUrls, maxPages, baseUrl);
            if (aiResult.success) {
                return aiResult.rankedPages;
            } else {
                console.log('   ⚠️  AI ranking failed, using rule-based fallback');
                return this.rankWithRules(filteredUrls, maxPages);
            }
        } catch (error) {
            console.error('   ❌ AI ranking error:', error.message);
            console.log('   Using rule-based fallback');
            return this.rankWithRules(filteredUrls, maxPages);
        }
    }

    /**
     * Pre-filter URLs to remove obvious non-relevant pages
     */
    preFilterUrls(urls) {
        const excludePatterns = [
            /\/(blog|news|article|post)\/\d{4}\//, // Blog posts with dates
            /\/(product|item|listing)\/[^\/]+$/, // Individual products
            /\/(tag|category|archive)\//,  // Tag/category pages
            /\/(cart|checkout|account|login|register)/,  // E-commerce/account pages
            /\/(privacy|terms|legal|cookie|disclaimer)/,  // Legal pages
            /\.pdf$/,  // PDF files
            /\/(search|sitemap)/  // Search and sitemap pages
        ];

        return urls.filter(url => {
            // Exclude based on patterns
            for (const pattern of excludePatterns) {
                if (pattern.test(url)) return false;
            }
            return true;
        });
    }

    /**
     * AI-powered URL ranking
     */
    async rankWithAI(urls, maxPages, baseUrl) {
        const baseOrigin = new URL(baseUrl).origin;

        // Prepare URL list for AI (show relative paths for clarity)
        const urlList = urls.map((url, idx) => {
            try {
                const urlObj = new URL(url);
                const relativePath = urlObj.pathname + urlObj.search;
                return `${idx + 1}. ${relativePath} → ${url}`;
            } catch (e) {
                return `${idx + 1}. ${url}`;
            }
        }).join('\n');

        const prompt = `You are a brand intelligence analyst. Analyze this list of page URLs and rank them by relevance for generating comprehensive brand insights.

Website: ${baseUrl}

Target Information (in priority order):
1. Company overview and history (about, who-we-are, our-story)
2. Brand mission, vision, values (mission, purpose, why-us)
3. Unique selling points and services (services, solutions, what-we-do)
4. Team and leadership (team, people, leadership, staff)
5. Awards, recognition, testimonials (awards, recognition, press)
6. Service areas and geography (locations, areas-served, coverage)
7. Case studies and portfolio (work, portfolio, projects)

URLs to Analyze (${urls.length} total):
${urlList}

CRITICAL: You MUST return ONLY valid JSON, no other text.

Return the top ${maxPages} URLs as a JSON array with this EXACT format:
[
  {
    "url": "complete URL from the list above",
    "relevanceScore": 0.95,
    "category": "company-overview",
    "reason": "About page with company history"
  }
]

Categories: company-overview, brand-mission, services, team, awards, service-area, portfolio, other

Focus on URL patterns indicating brand information. Deprioritize: blog posts, individual products, legal pages, contact forms.`;

        try {
            const aiResponse = await this.aiWorker.callClaude(
                prompt,
                this.aiWorker.config.models.haiku,
                'You are a brand intelligence analyst. Return only valid JSON, no other text.'
            );

            if (!aiResponse.success) {
                throw new Error(aiResponse.error);
            }

            // Parse AI response
            const content = aiResponse.content.trim();

            // Try to extract JSON from response
            let jsonContent = content;

            // Remove markdown code blocks if present
            if (content.includes('```')) {
                const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
                if (jsonMatch) {
                    jsonContent = jsonMatch[1];
                }
            }

            const rankedPages = JSON.parse(jsonContent);

            // Validate response
            if (!Array.isArray(rankedPages)) {
                throw new Error('AI response is not an array');
            }

            console.log(`   ✅ AI ranked ${rankedPages.length} pages`);

            return {
                success: true,
                rankedPages: rankedPages.slice(0, maxPages)
            };

        } catch (error) {
            console.error('AI ranking parse error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Rule-based URL ranking (fallback when AI fails)
     */
    rankWithRules(urls, maxPages) {
        console.log('   Using rule-based ranking...');

        const scored = urls.map(url => {
            let score = 0;
            let category = 'other';
            const urlLower = url.toLowerCase();
            const pathname = new URL(url).pathname.toLowerCase();

            // Score based on category keywords
            for (const [cat, config] of Object.entries(this.categories)) {
                for (const keyword of config.keywords) {
                    if (pathname.includes(keyword)) {
                        score += (10 - config.priority) * 10; // Higher priority = higher score
                        category = cat;
                        break;
                    }
                }
            }

            // Bonus for short, top-level paths
            const pathDepth = pathname.split('/').filter(Boolean).length;
            if (pathDepth === 1) score += 20;
            if (pathDepth === 2) score += 10;

            // Penalty for very long URLs
            if (pathname.length > 100) score -= 20;

            return {
                url,
                relevanceScore: Math.min(score / 100, 1.0),
                category,
                reason: `Rule-based: matched ${category} pattern`
            };
        });

        // Sort by score and return top pages
        return scored
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, maxPages);
    }

    /**
     * Categorize URL using simple pattern matching
     */
    categorizeUrl(url) {
        const pathname = new URL(url).pathname.toLowerCase();

        for (const [category, config] of Object.entries(this.categories)) {
            for (const keyword of config.keywords) {
                if (pathname.includes(keyword)) {
                    return category;
                }
            }
        }

        return 'other';
    }

    /**
     * Scrape content from multiple pages concurrently
     */
    async scrapeMultiplePages(pages, includeScraping = true, includeImages = false, maxImagesPerPage = 5) {
        const maxConcurrent = 5;
        const results = [];

        // Process in batches
        for (let i = 0; i < pages.length; i += maxConcurrent) {
            const batch = pages.slice(i, i + maxConcurrent);
            const batchResults = await Promise.all(
                batch.map(page => {
                    if (includeImages) {
                        return this.scrapePageContentWithImages(page.url, maxImagesPerPage);
                    } else if (includeScraping) {
                        return this.scrapePageContent(page.url);
                    } else {
                        // No scraping at all - return minimal data
                        return Promise.resolve({
                            textContent: null,
                            title: null,
                            headings: [],
                            wordCount: 0,
                            images: [],
                            imageCount: 0,
                            scrapedAt: new Date().toISOString()
                        });
                    }
                })
            );

            // Merge results
            for (let j = 0; j < batch.length; j++) {
                results.push({
                    ...batch[j],
                    ...batchResults[j]
                });
            }
        }

        return results;
    }

    /**
     * Scrape text content from a single page
     */
    async scrapePageContent(url) {
        try {
            const result = await this.fetchUrl(url);
            if (!result || !result.data) {
                return {
                    textContent: null,
                    title: null,
                    headings: [],
                    wordCount: 0,
                    scrapedAt: new Date().toISOString(),
                    error: 'Failed to fetch page'
                };
            }

            const { title, headings, textContent, wordCount } = this.cleanHtmlToText(result.data);

            return {
                title,
                headings,
                textContent,
                wordCount,
                scrapedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error(`Error scraping ${url}:`, error.message);
            return {
                textContent: null,
                title: null,
                headings: [],
                wordCount: 0,
                scrapedAt: new Date().toISOString(),
                error: error.message
            };
        }
    }

    /**
     * Clean HTML and extract text content
     */
    cleanHtmlToText(html) {
        try {
            const cheerio = require('cheerio');
            const $ = cheerio.load(html);

            // Remove unwanted elements
            $('script, style, nav, header, footer, iframe, noscript, svg, img').remove();
            $('.navigation, .menu, .sidebar, .cookie, .popup, .ad, .advertisement').remove();

            // Extract title
            const title = $('title').text().trim() || $('h1').first().text().trim();

            // Extract headings
            const headings = [];
            $('h1, h2, h3').each((i, elem) => {
                const text = $(elem).text().trim();
                if (text && text.length < 200) { // Skip very long headings
                    headings.push(text);
                }
            });

            // Extract main content
            let textContent = '';

            // Try to find main content area
            const mainContent = $('main, article, .content, .main-content, #content, #main').first();
            if (mainContent.length > 0) {
                textContent = mainContent.text();
            } else {
                // Fallback to body
                textContent = $('body').text();
            }

            // Clean up text
            textContent = textContent
                .replace(/\s+/g, ' ') // Normalize whitespace
                .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
                .trim();

            // Limit text length (keep first 5000 words)
            const words = textContent.split(/\s+/);
            const wordCount = words.length;
            if (words.length > 5000) {
                textContent = words.slice(0, 5000).join(' ') + '... [truncated]';
            }

            return {
                title,
                headings: headings.slice(0, 20), // Limit to 20 headings
                textContent,
                wordCount
            };

        } catch (error) {
            console.error('Error parsing HTML:', error.message);
            return {
                title: null,
                headings: [],
                textContent: null,
                wordCount: 0
            };
        }
    }

    /**
     * Generate insights summary from discovered pages
     */
    generateInsightsSummary(pages) {
        const categoriesFound = new Set();
        const totalWordCount = pages.reduce((sum, p) => sum + (p.wordCount || 0), 0);
        const successfulScrapes = pages.filter(p => p.textContent).length;

        pages.forEach(page => {
            if (page.category) {
                categoriesFound.add(page.category);
            }
        });

        return {
            recommendedForAnalysis: Array.from(categoriesFound),
            totalWordCount,
            successfulScrapes,
            coverage: {
                hasCompanyOverview: categoriesFound.has('company-overview'),
                hasMission: categoriesFound.has('brand-mission'),
                hasServices: categoriesFound.has('services'),
                hasTeam: categoriesFound.has('team'),
                hasAwards: categoriesFound.has('awards'),
                hasServiceArea: categoriesFound.has('service-area'),
                hasPortfolio: categoriesFound.has('portfolio')
            }
        };
    }

    /**
     * Detect if the HTML contains bot protection/CAPTCHA
     */
    detectBotProtection(url, html) {
        // Validate input
        if (!html || typeof html !== 'string') {
            return { detected: true, type: 'invalid-html', reason: 'HTML is null or not a string' };
        }

        // Check HTML size (CAPTCHA pages are tiny)
        if (html.length < 500) {
            return { detected: true, type: 'minimal-html', reason: `HTML only ${html.length} bytes` };
        }

        // If HTML is large (>10KB), assume it's real content (may contain references to protection but isn't blocked)
        if (html.length > 10000) {
            // Only check for active redirect meta tags or challenge pages
            if (/<meta http-equiv="refresh".*(?:sgcaptcha|challenge|captcha)/i.test(html)) {
                return { detected: true, type: 'meta-redirect', reason: 'Meta refresh to CAPTCHA page' };
            }
            if (/robot-suspicion\.svg/i.test(html) && html.length < 50000) {
                return { detected: true, type: 'siteground-robot-check', reason: 'Robot suspicion image detected' };
            }
            // Large HTML with normal content - likely bypassed successfully
            return { detected: false };
        }

        // For medium-sized HTML (500-10000 bytes), check protection patterns
        const protectionPatterns = [
            { regex: /\.well-known\/(captcha|sgcaptcha)/i, type: 'captcha-redirect' },
            { regex: /robot-suspicion\.svg/i, type: 'siteground-robot-check' },
            { regex: /cf-challenge/i, type: 'cloudflare-challenge' },
            { regex: /checking.*security/i, type: 'security-check' },
            { regex: /<meta http-equiv="refresh".*sgcaptcha/i, type: 'siteground-redirect' },
            { regex: /cf-browser-verification/i, type: 'cloudflare-verification' }
        ];

        for (const pattern of protectionPatterns) {
            if (pattern.regex.test(html)) {
                return { detected: true, type: pattern.type, reason: `Matched pattern: ${pattern.type}` };
            }
        }

        return { detected: false };
    }

    /**
     * Fetch URL with Puppeteer for bot-protected sites
     */
    async fetchUrlWithPuppeteer(url, useProxy = false) {
        const puppeteer = require('puppeteer');
        const CloudflareEvasion = require('./cloudflare-evasion');

        console.log(`   🤖 Attempting Puppeteer fetch for: ${url}`);
        console.log(`      Using proxy: ${useProxy}`);

        let browser;
        try {
            // Browser launch options
            const launchOptions = {
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--window-size=1920,1080'
                ],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable'
            };

            // Add proxy if requested
            if (useProxy && process.env.BRIGHT_DATA_PROXY) {
                const proxyUrl = process.env.BRIGHT_DATA_PROXY;
                launchOptions.args.push(`--proxy-server=${proxyUrl}`);
                console.log(`      🔒 Using residential proxy`);
            }

            browser = await puppeteer.launch(launchOptions);
            const page = await browser.newPage();

            // Apply cloudflare evasion
            await CloudflareEvasion.applyEvasion(page);

            // Set realistic viewport
            await page.setViewport({ width: 1920, height: 1080 });

            // Navigate with extended timeout
            console.log(`      ⏳ Loading page (60s timeout for challenges)...`);
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            // Wait for potential challenges to resolve
            await page.waitForTimeout(5000);

            // Check if we're still on a challenge page
            const currentUrl = page.url();
            if (currentUrl.includes('sgcaptcha') || currentUrl.includes('challenge') || currentUrl.includes('captcha')) {
                console.log(`      ⚠️  Still on challenge page: ${currentUrl}`);
                console.log(`      ⏳ Waiting 20s for SiteGround proof-of-work challenge...`);
                // SiteGround requires longer wait for crypto challenge
                await page.waitForTimeout(20000);

                // Check again
                const finalUrl = page.url();
                if (finalUrl.includes('sgcaptcha') || finalUrl.includes('challenge')) {
                    console.log(`      ❌ Challenge still not resolved: ${finalUrl}`);
                } else {
                    console.log(`      ✅ Challenge resolved, now at: ${finalUrl}`);
                }
            }

            // Get final HTML
            const html = await page.content();
            console.log(`      ✅ Retrieved ${html.length} bytes via Puppeteer`);

            await browser.close();

            // Check if we actually bypassed protection
            const stillProtected = this.detectBotProtection(url, html);
            if (stillProtected.detected) {
                console.log(`      ❌ Still protected after Puppeteer: ${stillProtected.type}`);
                return null;
            }

            return {
                data: html,
                headers: {},
                method: useProxy ? 'puppeteer-proxy' : 'puppeteer'
            };

        } catch (error) {
            console.error(`      ❌ Puppeteer fetch failed: ${error.message}`);
            if (browser) {
                await browser.close();
            }
            return null;
        }
    }

    /**
     * Fetch URL with automatic bot protection detection and retry
     */
    async fetchUrl(url) {
        console.log(`Fetching: ${url}`);

        // TIER 1: Try fast static fetch first
        try {
            const axios = require('axios');
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const html = response.data;

            // Validate response data
            if (!html || typeof html !== 'string') {
                console.log(`   ⚠️  Invalid response type: ${typeof html}, retrying with Puppeteer...`);
                const puppeteerResult = await this.fetchUrlWithPuppeteer(url, false);
                if (puppeteerResult && puppeteerResult.data) {
                    return puppeteerResult;
                }
                return null;
            }

            // Check for bot protection
            const protection = this.detectBotProtection(url, html);

            if (protection.detected) {
                console.log(`   🛡️  Bot protection detected: ${protection.type}`);
                console.log(`      Reason: ${protection.reason}`);
                console.log(`      🔄 Retrying with Puppeteer...`);

                // TIER 2: Retry with Puppeteer (no proxy)
                const puppeteerResult = await this.fetchUrlWithPuppeteer(url, false);

                if (puppeteerResult && puppeteerResult.data) {
                    return puppeteerResult;
                }

                // TIER 3: Nuclear option - Puppeteer + Proxy
                if (process.env.BRIGHT_DATA_PROXY) {
                    console.log(`      🚀 Attempting with residential proxy...`);
                    const proxyResult = await this.fetchUrlWithPuppeteer(url, true);

                    if (proxyResult && proxyResult.data) {
                        return proxyResult;
                    }
                }

                console.log(`      ❌ All retry attempts failed for ${url}`);
                return null;
            }

            return {
                data: html,
                headers: response.headers,
                method: 'axios'
            };

        } catch (error) {
            console.error(`Fetch error for ${url}:`, error.message);

            // If static fetch fails, try Puppeteer anyway
            console.log(`   🔄 Static fetch failed, trying Puppeteer...`);
            const puppeteerResult = await this.fetchUrlWithPuppeteer(url, false);

            if (puppeteerResult && puppeteerResult.data) {
                return puppeteerResult;
            }

            return null;
        }
    }

    /**
     * Extract large brand images from a page (avoid logos/icons)
     */
    async extractImagesFromPage(url, html, maxImages = 5) {
        try {
            const cheerio = require('cheerio');
            let $;

            try {
                // Ensure HTML is a string
                const htmlString = typeof html === 'string' ? html : String(html);
                $ = cheerio.load(htmlString, null, false);  // Use simpler API: (html, options, isDocument)
            } catch (parseError) {
                console.error(`Error parsing HTML: ${parseError.message}`, parseError.stack);
                return [];
            }

            const baseUrl = new URL(url);
            const candidates = [];

            console.log(`   🖼️  Extracting images from ${url}...`);

            // 1. Extract Open Graph image (highest priority)
            const ogImage = $('meta[property="og:image"]').attr('content');
            if (ogImage) {
                const normalizedUrl = this.normalizeImageUrl(ogImage, baseUrl);
                if (normalizedUrl) {
                    candidates.push({
                        url: normalizedUrl,
                        source: 'og:image',
                        score: 30,
                        context: 'meta',
                        alt: $('meta[property="og:image:alt"]').attr('content') || ''
                    });
                }
            }

            // 2. Extract Twitter Card image
            const twitterImage = $('meta[name="twitter:image"]').attr('content') || $('meta[property="twitter:image"]').attr('content');
            if (twitterImage) {
                const normalizedUrl = this.normalizeImageUrl(twitterImage, baseUrl);
                if (normalizedUrl) {
                    candidates.push({
                        url: normalizedUrl,
                        source: 'twitter:image',
                        score: 30,
                        context: 'meta',
                        alt: $('meta[name="twitter:image:alt"]').attr('content') || ''
                    });
                }
            }

            // 3. Extract Schema.org images from JSON-LD
            $('script[type="application/ld+json"]').each((i, elem) => {
                try {
                    const jsonData = JSON.parse($(elem).html());
                    const images = this.extractSchemaImages(jsonData);
                    images.forEach(imgUrl => {
                        const normalizedUrl = this.normalizeImageUrl(imgUrl, baseUrl);
                        if (normalizedUrl) {
                            candidates.push({
                                url: normalizedUrl,
                                source: 'schema.org',
                                score: 25,
                                context: 'meta',
                                alt: ''
                            });
                        }
                    });
                } catch (e) {
                    // Skip invalid JSON-LD
                }
            });

            // 4. Extract img elements from main content (not header/footer/nav)
            $('main img, article img, section img, .content img, #content img, [role="main"] img').each((i, elem) => {
                try {
                    // Skip if in header/footer/nav
                    const parents = $(elem).parents().toArray();
                    const parentTags = parents.map(p => {
                        try {
                            return (p.tagName || p.name || '').toLowerCase();
                        } catch (e) {
                            return '';
                        }
                    }).join(' ');

                    const inExcludedArea = parentTags.includes('header') ||
                                          parentTags.includes('footer') ||
                                          parentTags.includes('nav');

                    if (inExcludedArea) return;

                    const src = $(elem).attr('src');
                    const srcset = $(elem).attr('srcset');
                    const alt = $(elem).attr('alt') || '';
                    const width = parseInt($(elem).attr('width') || '0');
                    const height = parseInt($(elem).attr('height') || '0');

                    if (src) {
                        const imgUrl = this.getLargestImageFromSrcset(src, srcset, baseUrl);
                        if (imgUrl) {
                            // Determine position (simplified - checking if in first 3 main children)
                            const position = i < 3 ? 'above-fold' : 'main-content';
                            const positionScore = position === 'above-fold' ? 20 : 15;

                            candidates.push({
                                url: imgUrl,
                                source: 'img',
                                score: 15 + positionScore,
                                alt,
                                context: position,
                                width,
                                height
                            });
                        }
                    }
                } catch (imgError) {
                    console.error(`Error processing img element: ${imgError.message}`);
                }
            });

            // 5. Extract CSS background images from hero/banner sections
            $('section, .hero, .banner, [class*="hero"], [class*="banner"]').each((i, elem) => {
                const style = $(elem).attr('style') || '';
                const bgMatch = style.match(/background-image:\s*url\(['"]?([^'"()]+)['"]?\)/i);

                if (bgMatch) {
                    const normalizedUrl = this.normalizeImageUrl(bgMatch[1], baseUrl);
                    if (normalizedUrl) {
                        candidates.push({
                            url: normalizedUrl,
                            source: 'css-background',
                            score: 10,
                            context: 'hero-section',
                            alt: ''
                        });
                    }
                }
            });

            console.log(`   📊 Found ${candidates.length} image candidates`);

            // 6. Filter candidates
            const filtered = this.filterImageCandidates(candidates, baseUrl);
            console.log(`   ✅ ${filtered.length} candidates after filtering`);

            // 7. Validate URLs (check for 404s) with fallback
            let validated = [];
            try {
                validated = await this.validateImageUrls(filtered);
                console.log(`   ✅ ${validated.length} validated images`);
            } catch (validationError) {
                console.warn(`   ⚠️  Image validation failed: ${validationError.message}`);
                console.log(`   📋 Falling back to unvalidated candidates (${filtered.length} images)`);

                // FALLBACK: Return filtered candidates without validation
                // Still safe because we filtered by URL patterns & extensions
                validated = filtered.map(candidate => ({
                    ...candidate,
                    validated: false,
                    validationSkipped: true,
                    validationError: validationError.message
                }));
            }

            // 8. If we have no images at all, try emergency extraction
            if (validated.length === 0 && candidates.length > 0) {
                console.log(`   🚨 No validated images, trying emergency extraction...`);
                validated = this.emergencyImageExtraction(url, html);
            }

            // 9. Deduplicate images (remove duplicates and similar images)
            const ImageDeduplicator = require('./image-deduplicator');
            const deduplicator = new ImageDeduplicator();
            const deduplicated = await deduplicator.deduplicateImages(validated);

            // 10. Rank and select top images
            const ranked = this.rankImages(deduplicated);

            return ranked.slice(0, maxImages);

        } catch (error) {
            console.error(`Error extracting images from ${url}:`, error.message);
            return [];
        }
    }

    /**
     * Extract images from Schema.org JSON-LD
     */
    extractSchemaImages(jsonData) {
        const images = [];

        const extract = (obj) => {
            if (!obj || typeof obj !== 'object') return;

            if (obj.image) {
                if (typeof obj.image === 'string') {
                    images.push(obj.image);
                } else if (Array.isArray(obj.image)) {
                    obj.image.forEach(img => {
                        if (typeof img === 'string') images.push(img);
                        else if (img.url) images.push(img.url);
                    });
                } else if (obj.image.url) {
                    images.push(obj.image.url);
                }
            }

            // Recursively check nested objects
            Object.values(obj).forEach(val => {
                if (typeof val === 'object') extract(val);
            });
        };

        extract(jsonData);
        return images;
    }

    /**
     * Normalize image URL (convert relative to absolute)
     */
    normalizeImageUrl(imgUrl, baseUrl) {
        try {
            if (!imgUrl) return null;

            // Skip data URIs and SVGs
            if (imgUrl.startsWith('data:') || imgUrl.toLowerCase().endsWith('.svg')) {
                return null;
            }

            // Convert relative to absolute
            const absoluteUrl = new URL(imgUrl, baseUrl.href);

            // Only allow same domain or common CDNs
            const sameDomain = absoluteUrl.hostname === baseUrl.hostname;
            const isCDN = /cdn|cloudfront|cloudinary|imgix|cloudflare|akamai/i.test(absoluteUrl.hostname);

            if (!sameDomain && !isCDN) {
                return null; // Skip third-party images
            }

            return absoluteUrl.href;
        } catch (e) {
            return null;
        }
    }

    /**
     * Parse srcset and return largest image URL
     */
    getLargestImageFromSrcset(src, srcset, baseUrl) {
        try {
            if (!srcset) {
                return this.normalizeImageUrl(src, baseUrl);
            }

            // Parse srcset: "image.jpg 1x, image@2x.jpg 2x" or "image-400.jpg 400w, image-800.jpg 800w"
            const candidates = srcset.split(',').map(s => s.trim());
            let largestUrl = src;
            let largestWidth = 0;

            candidates.forEach(candidate => {
                const parts = candidate.split(/\s+/);
                const url = parts[0];
                const descriptor = parts[1];

                if (descriptor) {
                    const width = descriptor.endsWith('w') ? parseInt(descriptor) : 0;
                    if (width > largestWidth) {
                        largestWidth = width;
                        largestUrl = url;
                    }
                }
            });

            return this.normalizeImageUrl(largestUrl, baseUrl);
        } catch (e) {
            return this.normalizeImageUrl(src, baseUrl);
        }
    }

    /**
     * Filter image candidates by size, format, and content
     */
    filterImageCandidates(candidates, baseUrl) {
        const excludePatterns = [
            /icon/i, /logo/i, /badge/i, /button/i, /arrow/i, /sprite/i,
            /avatar/i, /thumbnail/i, /thumb/i, /favicon/i, /banner-ad/i,
            // NEW: Promotional and badge patterns
            /coupon/i, /promo/i, /sale/i, /deal/i, /discount/i, /special/i, /offer/i,
            /certification/i, /award/i, /accreditation/i, /certified/i,
            /partner/i, /sponsor/i, /client-logo/i,
            // NEW: People/team patterns
            /headshot/i, /profile/i, /team-member/i, /employee/i, /staff/i
        ];

        return candidates.filter(candidate => {
            const url = candidate.url;
            if (!url) return false;

            // Check URL for excluded patterns
            const hasExcludedPattern = excludePatterns.some(pattern => pattern.test(url));
            if (hasExcludedPattern) return false;

            // NEW: Check alt text for excluded patterns (people, promo keywords)
            if (candidate.alt) {
                const altLower = candidate.alt.toLowerCase();
                const hasPromoKeywords = /coupon|sale|promo|deal|offer|discount|special/.test(altLower);
                const hasPeopleKeywords = /team|staff|employee|people|person|headshot|profile/.test(altLower);
                const hasBadgeKeywords = /badge|award|certification|accreditation|partner|sponsor/.test(altLower);

                if (hasPromoKeywords || hasPeopleKeywords || hasBadgeKeywords) {
                    return false;
                }
            }

            // Check file extension
            const ext = url.split('?')[0].split('.').pop().toLowerCase();
            const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
            if (!validExtensions.includes(ext)) return false;

            // Check for minimum dimensions (if available)
            if (candidate.width && candidate.height) {
                if (candidate.width < 400 || candidate.height < 300) return false;

                // Exclude very square small images (likely icons)
                const aspectRatio = candidate.width / candidate.height;
                if (candidate.width < 200 && aspectRatio > 0.9 && aspectRatio < 1.1) return false;
            }

            return true;
        });
    }

    /**
     * Validate image URLs with HEAD requests
     */
    async validateImageUrls(candidates) {
        const axios = require('axios');
        const validated = [];

        // Process in batches of 5
        const batchSize = 5;
        for (let i = 0; i < candidates.length; i += batchSize) {
            const batch = candidates.slice(i, i + batchSize);

            const results = await Promise.allSettled(
                batch.map(async (candidate) => {
                    try {
                        const response = await axios.head(candidate.url, {
                            timeout: 5000,
                            maxRedirects: 3,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        });

                        if (response.status === 200) {
                            // Extract dimensions from response headers if available
                            const contentType = response.headers['content-type'];
                            if (contentType && contentType.startsWith('image/')) {
                                return {
                                    ...candidate,
                                    validated: true,
                                    contentType,
                                    size: parseInt(response.headers['content-length'] || '0')
                                };
                            }
                        }
                        return null;
                    } catch (error) {
                        // URL returned 404 or timeout
                        return null;
                    }
                })
            );

            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    validated.push(result.value);
                }
            });
        }

        return validated;
    }

    /**
     * Rank images by score and quality
     */
    rankImages(images) {
        return images
            .map(img => {
                let score = img.score || 0;

                // Add size bonus (if we have dimensions)
                if (img.width) {
                    if (img.width >= 1200) score += 25;
                    else if (img.width >= 800) score += 20;
                    else if (img.width >= 600) score += 15;
                    else if (img.width >= 400) score += 10;
                }

                // Add format bonus
                const format = img.url.split('.').pop().toLowerCase().split('?')[0];
                if (format === 'webp') score += 10;
                else if (format === 'jpg' || format === 'jpeg') score += 8;
                else if (format === 'png') score += 6;

                // Add semantic bonus (keywords in alt text)
                if (img.alt) {
                    const brandKeywords = /team|office|product|service|work|people|building|company/i;
                    if (brandKeywords.test(img.alt)) score += 10;
                }

                return { ...img, finalScore: score };
            })
            .sort((a, b) => b.finalScore - a.finalScore);
    }

    /**
     * Emergency image extraction - no validation, just grab high-confidence candidates
     * Used when full extraction fails due to network/API issues
     */
    emergencyImageExtraction(url, html) {
        try {
            const cheerio = require('cheerio');
            const $ = cheerio.load(html, null, false);
            const baseUrl = new URL(url);
            const images = [];

            console.log(`   🚨 Emergency extraction mode for ${url}`);

            // Only grab meta tags (highest confidence, no validation needed)
            const ogImage = $('meta[property="og:image"]').attr('content');
            if (ogImage) {
                const normalized = this.normalizeImageUrl(ogImage, baseUrl);
                if (normalized) {
                    images.push({
                        url: normalized,
                        source: 'og:image',
                        score: 30,
                        finalScore: 30,
                        validated: false,
                        emergencyExtraction: true,
                        alt: $('meta[property="og:image:alt"]').attr('content') || ''
                    });
                }
            }

            const twitterImage = $('meta[name="twitter:image"]').attr('content') ||
                                $('meta[property="twitter:image"]').attr('content');
            if (twitterImage && twitterImage !== ogImage) {
                const normalized = this.normalizeImageUrl(twitterImage, baseUrl);
                if (normalized) {
                    images.push({
                        url: normalized,
                        source: 'twitter:image',
                        score: 30,
                        finalScore: 30,
                        validated: false,
                        emergencyExtraction: true,
                        alt: $('meta[name="twitter:image:alt"]').attr('content') || ''
                    });
                }
            }

            console.log(`   ✅ Emergency extraction found ${images.length} images`);
            return images;

        } catch (error) {
            console.error(`   ❌ Emergency extraction failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Scrape page content with images
     */
    async scrapePageContentWithImages(url, maxImages = 5) {
        try {
            const result = await this.fetchUrl(url);
            if (!result || !result.data) {
                return {
                    textContent: null,
                    title: null,
                    headings: [],
                    wordCount: 0,
                    images: [],
                    imageCount: 0,
                    scrapedAt: new Date().toISOString(),
                    error: 'Failed to fetch page'
                };
            }

            const { title, headings, textContent, wordCount } = this.cleanHtmlToText(result.data);

            // Extract images with comprehensive error handling
            let images = [];
            let imageError = null;

            try {
                console.log(`Extracting images from ${url}, HTML length: ${result.data.length}`);
                images = await this.extractImagesFromPage(url, result.data, maxImages);
                console.log(`✅ Extracted ${images.length} images from ${url}`);
            } catch (imageExtractionError) {
                console.error(`❌ Image extraction failed for ${url}:`, imageExtractionError.message);
                imageError = imageExtractionError.message;

                // Try emergency extraction as last resort
                try {
                    console.log(`   Attempting emergency extraction...`);
                    images = this.emergencyImageExtraction(url, result.data);
                } catch (emergencyError) {
                    console.error(`   Emergency extraction also failed:`, emergencyError.message);
                }
            }

            // VERIFICATION: Check if results are suspiciously empty
            const resultsLookSuspicious = (
                wordCount < 10 &&
                images.length === 0 &&
                result.data.length < 1000
            );

            if (resultsLookSuspicious) {
                console.warn(`   ⚠️  Results verification failed for ${url}`);
                console.log(`      wordCount: ${wordCount}, images: ${images.length}, HTML: ${result.data.length} bytes`);
                console.log(`      This may indicate bot protection that wasn't detected`);

                // Mark as potentially blocked
                imageError = (imageError || '') + ' (Possible undetected bot protection)';
            }

            return {
                title,
                headings,
                textContent,
                wordCount,
                images,
                imageCount: images.length,
                imageExtractionError: imageError,
                fetchMethod: result.method || 'unknown',
                scrapedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error(`Error scraping ${url}:`, error.message);
            return {
                textContent: null,
                title: null,
                headings: [],
                wordCount: 0,
                images: [],
                imageCount: 0,
                scrapedAt: new Date().toISOString(),
                error: error.message
            };
        }
    }
}

module.exports = BrandPageDiscoverer;