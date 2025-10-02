/**
 * Browser Pool Manager
 * Maintains warm Puppeteer browser instances for faster request handling
 *
 * Features:
 * - 2-3 warm browser instances
 * - Context reuse (acquire/release pattern)
 * - Auto-recovery on browser crashes
 * - Graceful shutdown
 * - Health checks
 */

const puppeteer = require('puppeteer');

class BrowserPool {
    constructor(config = {}) {
        this.config = {
            minInstances: config.minInstances || 2,
            maxInstances: config.maxInstances || 3,
            maxContextsPerBrowser: config.maxContextsPerBrowser || 5,
            contextIdleTimeout: config.contextIdleTimeout || 60000, // 60s
            healthCheckInterval: config.healthCheckInterval || 10000, // 10s
            executablePath: config.executablePath || '/usr/bin/google-chrome-stable',
            ...config
        };

        // Pool state
        this.browsers = []; // { browser, contexts: [], createdAt, lastHealthCheck }
        this.activeContexts = new Map(); // contextId -> { context, browser, acquiredAt, hostname }

        // Initialization state
        this.initialized = false;
        this.initializing = false;
        this.healthCheckTimer = null;

        // Stats
        this.stats = {
            totalAcquired: 0,
            totalReleased: 0,
            totalCrashes: 0,
            totalRecoveries: 0
        };

        // Graceful shutdown handler
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }

    /**
     * Initialize the browser pool
     */
    async initialize() {
        if (this.initialized || this.initializing) {
            return;
        }

        this.initializing = true;
        console.log('🚀 Initializing browser pool...');
        console.log(`   Min instances: ${this.config.minInstances}`);
        console.log(`   Max instances: ${this.config.maxInstances}`);

        try {
            // Launch minimum number of browsers
            for (let i = 0; i < this.config.minInstances; i++) {
                await this.launchBrowser(i);
            }

            this.initialized = true;
            console.log(`✅ Browser pool initialized with ${this.browsers.length} instances`);

            // Start health checks
            this.startHealthChecks();

        } catch (error) {
            console.error('❌ Failed to initialize browser pool:', error.message);
            this.initializing = false;
            throw error;
        }

        this.initializing = false;
    }

    /**
     * Launch a new browser instance
     */
    async launchBrowser(index) {
        console.log(`   Launching browser instance ${index + 1}...`);

        const browser = await puppeteer.launch({
            headless: 'new',
            executablePath: this.config.executablePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const browserInfo = {
            browser,
            contexts: [],
            createdAt: Date.now(),
            lastHealthCheck: Date.now(),
            index
        };

        this.browsers.push(browserInfo);

        // Handle browser disconnect
        browser.on('disconnected', () => {
            console.warn(`⚠️  Browser ${index} disconnected`);
            this.handleBrowserCrash(browserInfo);
        });

        return browserInfo;
    }

    /**
     * Acquire a browser context for use
     * @param {string} hostname - Hostname for context isolation (optional)
     */
    async acquire(hostname = 'default') {
        if (!this.initialized) {
            await this.initialize();
        }

        // Find browser with available capacity
        let browserInfo = this.browsers.find(b =>
            b.contexts.length < this.config.maxContextsPerBrowser &&
            b.browser.isConnected()
        );

        // Scale up if needed
        if (!browserInfo && this.browsers.length < this.config.maxInstances) {
            console.log('📈 Scaling up browser pool...');
            browserInfo = await this.launchBrowser(this.browsers.length);
        }

        // If still no browser, wait and retry
        if (!browserInfo) {
            console.warn('⏳ All browsers at capacity, waiting...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            return this.acquire(hostname);
        }

        // Create new context
        const context = await browserInfo.browser.createBrowserContext();
        const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Track context
        browserInfo.contexts.push(contextId);
        this.activeContexts.set(contextId, {
            context,
            browser: browserInfo.browser,
            acquiredAt: Date.now(),
            hostname
        });

        this.stats.totalAcquired++;

        console.log(`✓ Acquired context ${contextId} for ${hostname} (browser ${browserInfo.index}, ${browserInfo.contexts.length}/${this.config.maxContextsPerBrowser} contexts)`);

        return { browser: browserInfo.browser, context, contextId };
    }

    /**
     * Release a browser context back to the pool
     * @param {string} contextId - Context ID to release
     */
    async release(contextId) {
        const contextInfo = this.activeContexts.get(contextId);

        if (!contextInfo) {
            console.warn(`⚠️  Context ${contextId} not found in active contexts`);
            return;
        }

        try {
            // Close all pages in context
            const pages = await contextInfo.context.pages();
            await Promise.all(pages.map(p => p.close().catch(e => console.warn('Page close error:', e.message))));

            // Close context
            await contextInfo.context.close();

            // Remove from tracking
            this.activeContexts.delete(contextId);

            // Remove from browser's context list
            const browserInfo = this.browsers.find(b => b.browser === contextInfo.browser);
            if (browserInfo) {
                browserInfo.contexts = browserInfo.contexts.filter(id => id !== contextId);
            }

            this.stats.totalReleased++;

            console.log(`✓ Released context ${contextId} (${contextInfo.hostname})`);

        } catch (error) {
            console.error(`❌ Error releasing context ${contextId}:`, error.message);
        }
    }

    /**
     * Handle browser crash and attempt recovery
     */
    async handleBrowserCrash(browserInfo) {
        this.stats.totalCrashes++;
        console.error(`💥 Browser ${browserInfo.index} crashed`);

        // Remove crashed browser
        this.browsers = this.browsers.filter(b => b !== browserInfo);

        // Release all contexts from crashed browser
        for (const [contextId, contextInfo] of this.activeContexts.entries()) {
            if (contextInfo.browser === browserInfo.browser) {
                this.activeContexts.delete(contextId);
                console.log(`   Released context ${contextId} from crashed browser`);
            }
        }

        // Attempt recovery if below minimum
        if (this.browsers.length < this.config.minInstances) {
            console.log('🔄 Attempting browser recovery...');
            try {
                await this.launchBrowser(browserInfo.index);
                this.stats.totalRecoveries++;
                console.log('✅ Browser recovered successfully');
            } catch (error) {
                console.error('❌ Browser recovery failed:', error.message);
            }
        }
    }

    /**
     * Start periodic health checks
     */
    startHealthChecks() {
        this.healthCheckTimer = setInterval(async () => {
            for (const browserInfo of this.browsers) {
                try {
                    const isConnected = browserInfo.browser.isConnected();

                    if (!isConnected) {
                        console.warn(`⚠️  Browser ${browserInfo.index} not connected during health check`);
                        await this.handleBrowserCrash(browserInfo);
                        continue;
                    }

                    browserInfo.lastHealthCheck = Date.now();

                    // Clean up idle contexts
                    await this.cleanupIdleContexts(browserInfo);

                } catch (error) {
                    console.error(`❌ Health check failed for browser ${browserInfo.index}:`, error.message);
                }
            }
        }, this.config.healthCheckInterval);
    }

    /**
     * Clean up contexts that have been idle too long
     */
    async cleanupIdleContexts(browserInfo) {
        const now = Date.now();
        const idleThreshold = this.config.contextIdleTimeout;

        for (const contextId of browserInfo.contexts) {
            const contextInfo = this.activeContexts.get(contextId);

            if (contextInfo && (now - contextInfo.acquiredAt) > idleThreshold) {
                console.log(`🧹 Cleaning up idle context ${contextId} (idle for ${Math.round((now - contextInfo.acquiredAt) / 1000)}s)`);
                await this.release(contextId);
            }
        }
    }

    /**
     * Get pool statistics
     */
    getStats() {
        return {
            ...this.stats,
            browsers: this.browsers.length,
            activeContexts: this.activeContexts.size,
            totalContexts: this.browsers.reduce((sum, b) => sum + b.contexts.length, 0)
        };
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('🛑 Shutting down browser pool...');

        // Stop health checks
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }

        // Close all active contexts
        console.log(`   Closing ${this.activeContexts.size} active contexts...`);
        for (const [contextId] of this.activeContexts.entries()) {
            await this.release(contextId);
        }

        // Close all browsers
        console.log(`   Closing ${this.browsers.length} browser instances...`);
        await Promise.all(
            this.browsers.map(async (browserInfo) => {
                try {
                    await browserInfo.browser.close();
                    console.log(`   ✓ Closed browser ${browserInfo.index}`);
                } catch (error) {
                    console.error(`   ❌ Error closing browser ${browserInfo.index}:`, error.message);
                }
            })
        );

        this.browsers = [];
        this.initialized = false;

        console.log('✅ Browser pool shutdown complete');
    }
}

// Singleton instance
let poolInstance = null;

module.exports = {
    /**
     * Get or create browser pool instance
     */
    getInstance(config) {
        if (!poolInstance) {
            poolInstance = new BrowserPool(config);
        }
        return poolInstance;
    },

    /**
     * Acquire a browser context
     */
    async acquire(hostname) {
        const pool = module.exports.getInstance();
        return pool.acquire(hostname);
    },

    /**
     * Release a browser context
     */
    async release(contextId) {
        const pool = module.exports.getInstance();
        return pool.release(contextId);
    },

    /**
     * Get pool statistics
     */
    getStats() {
        if (!poolInstance) return null;
        return poolInstance.getStats();
    },

    /**
     * Shutdown the pool
     */
    async shutdown() {
        if (poolInstance) {
            await poolInstance.shutdown();
            poolInstance = null;
        }
    }
};
