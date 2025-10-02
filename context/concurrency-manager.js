/**
 * Concurrency Manager
 * Manages concurrent requests with host-based queuing for polite crawling
 *
 * Features:
 * - 1 concurrent request per hostname (polite)
 * - 5 concurrent requests globally (across all hosts)
 * - Queue system for same-host requests
 * - Request timeout handling
 * - Statistics tracking
 */

class ConcurrencyManager {
    constructor(config = {}) {
        this.config = {
            maxConcurrentPerHost: config.maxConcurrentPerHost || 1,
            maxConcurrentTotal: config.maxConcurrentTotal || 5,
            requestTimeout: config.requestTimeout || 30000, // 30s
            queueTimeout: config.queueTimeout || 60000, // 60s max queue wait
            ...config
        };

        // Tracking
        this.activeRequests = new Map(); // hostname -> Set of request IDs
        this.requestQueue = new Map(); // hostname -> Array of { resolve, reject, enqueuedAt }
        this.totalActive = 0;
        this.globalQueue = []; // Queue for when global limit reached

        // Stats
        this.stats = {
            totalRequests: 0,
            totalQueued: 0,
            totalTimedOut: 0,
            totalCompleted: 0,
            totalErrors: 0,
            currentActive: 0,
            currentQueued: 0
        };
    }

    /**
     * Extract hostname from URL
     */
    extractHostname(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Acquire a slot for the given URL
     * Resolves when request can proceed, rejects on timeout
     */
    async acquire(url) {
        const hostname = this.extractHostname(url);
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.stats.totalRequests++;

        console.log(`🎫 Acquiring slot for ${hostname} (ID: ${requestId})`);
        console.log(`   Active: ${this.totalActive}/${this.config.maxConcurrentTotal} global, ${this.getHostActive(hostname)}/${this.config.maxConcurrentPerHost} for ${hostname}`);

        // Check if we can proceed immediately
        if (this.canProceed(hostname)) {
            this.markActive(hostname, requestId);
            return { requestId, hostname, queued: false };
        }

        // Need to queue
        return await this.enqueue(hostname, requestId);
    }

    /**
     * Check if request can proceed immediately
     */
    canProceed(hostname) {
        // Check global limit
        if (this.totalActive >= this.config.maxConcurrentTotal) {
            return false;
        }

        // Check per-host limit
        const hostActive = this.getHostActive(hostname);
        if (hostActive >= this.config.maxConcurrentPerHost) {
            return false;
        }

        return true;
    }

    /**
     * Get number of active requests for hostname
     */
    getHostActive(hostname) {
        const requests = this.activeRequests.get(hostname);
        return requests ? requests.size : 0;
    }

    /**
     * Mark request as active
     */
    markActive(hostname, requestId) {
        if (!this.activeRequests.has(hostname)) {
            this.activeRequests.set(hostname, new Set());
        }

        this.activeRequests.get(hostname).add(requestId);
        this.totalActive++;
        this.stats.currentActive = this.totalActive;

        console.log(`✓ Request ${requestId} active for ${hostname}`);
    }

    /**
     * Enqueue a request
     */
    async enqueue(hostname, requestId) {
        this.stats.totalQueued++;
        this.stats.currentQueued++;

        console.log(`⏳ Queuing request ${requestId} for ${hostname}`);

        return new Promise((resolve, reject) => {
            const queueEntry = {
                resolve,
                reject,
                requestId,
                hostname,
                enqueuedAt: Date.now()
            };

            // Add to host-specific queue
            if (!this.requestQueue.has(hostname)) {
                this.requestQueue.set(hostname, []);
            }
            this.requestQueue.get(hostname).push(queueEntry);

            // Set queue timeout
            const timeoutId = setTimeout(() => {
                this.handleQueueTimeout(hostname, requestId);
            }, this.config.queueTimeout);

            // Store timeout ID for cleanup
            queueEntry.timeoutId = timeoutId;
        });
    }

    /**
     * Handle queue timeout
     */
    handleQueueTimeout(hostname, requestId) {
        console.error(`❌ Queue timeout for ${requestId} (${hostname}) after ${this.config.queueTimeout}ms`);

        const queue = this.requestQueue.get(hostname);
        if (!queue) return;

        const index = queue.findIndex(entry => entry.requestId === requestId);
        if (index === -1) return;

        const entry = queue[index];
        queue.splice(index, 1);

        this.stats.totalTimedOut++;
        this.stats.currentQueued--;

        entry.reject(new Error(`Queue timeout after ${this.config.queueTimeout}ms`));
    }

    /**
     * Release a request slot
     */
    async release(requestId, hostname) {
        console.log(`🔓 Releasing slot for ${hostname} (ID: ${requestId})`);

        // Remove from active
        const requests = this.activeRequests.get(hostname);
        if (requests) {
            requests.delete(requestId);
            if (requests.size === 0) {
                this.activeRequests.delete(hostname);
            }
        }

        this.totalActive--;
        this.stats.currentActive = this.totalActive;
        this.stats.totalCompleted++;

        // Process next in queue
        await this.processQueue(hostname);
    }

    /**
     * Process queued requests
     */
    async processQueue(hostname) {
        // Try to process host-specific queue first
        const hostQueue = this.requestQueue.get(hostname);

        if (hostQueue && hostQueue.length > 0 && this.canProceed(hostname)) {
            const entry = hostQueue.shift();
            clearTimeout(entry.timeoutId);

            this.markActive(hostname, entry.requestId);
            this.stats.currentQueued--;

            const waitTime = Date.now() - entry.enqueuedAt;
            console.log(`✓ Dequeued ${entry.requestId} for ${hostname} (waited ${waitTime}ms)`);

            entry.resolve({ requestId: entry.requestId, hostname, queued: true, queueTime: waitTime });

            // Clean up empty queue
            if (hostQueue.length === 0) {
                this.requestQueue.delete(hostname);
            }

            return;
        }

        // Try to process other hosts' queues if global capacity available
        if (this.totalActive < this.config.maxConcurrentTotal) {
            for (const [otherHostname, queue] of this.requestQueue.entries()) {
                if (queue.length > 0 && this.canProceed(otherHostname)) {
                    const entry = queue.shift();
                    clearTimeout(entry.timeoutId);

                    this.markActive(otherHostname, entry.requestId);
                    this.stats.currentQueued--;

                    const waitTime = Date.now() - entry.enqueuedAt;
                    console.log(`✓ Dequeued ${entry.requestId} for ${otherHostname} (waited ${waitTime}ms)`);

                    entry.resolve({ requestId: entry.requestId, hostname: otherHostname, queued: true, queueTime: waitTime });

                    // Clean up empty queue
                    if (queue.length === 0) {
                        this.requestQueue.delete(otherHostname);
                    }

                    break;
                }
            }
        }
    }

    /**
     * Mark request as errored
     */
    async error(requestId, hostname) {
        console.error(`❌ Request ${requestId} errored for ${hostname}`);
        this.stats.totalErrors++;
        await this.release(requestId, hostname);
    }

    /**
     * Get current statistics
     */
    getStats() {
        return {
            ...this.stats,
            activeByHost: Array.from(this.activeRequests.entries()).map(([hostname, requests]) => ({
                hostname,
                active: requests.size
            })),
            queuedByHost: Array.from(this.requestQueue.entries()).map(([hostname, queue]) => ({
                hostname,
                queued: queue.length
            }))
        };
    }

    /**
     * Clear all queues (for testing/debugging)
     */
    clearAll() {
        for (const [hostname, queue] of this.requestQueue.entries()) {
            for (const entry of queue) {
                clearTimeout(entry.timeoutId);
                entry.reject(new Error('Queue cleared'));
            }
        }

        this.activeRequests.clear();
        this.requestQueue.clear();
        this.totalActive = 0;
        this.stats.currentActive = 0;
        this.stats.currentQueued = 0;
    }
}

// Singleton instance
let managerInstance = null;

module.exports = {
    /**
     * Get or create concurrency manager instance
     */
    getInstance(config) {
        if (!managerInstance) {
            managerInstance = new ConcurrencyManager(config);
        }
        return managerInstance;
    },

    /**
     * Acquire a slot for the given URL
     */
    async acquire(url) {
        const manager = module.exports.getInstance();
        return manager.acquire(url);
    },

    /**
     * Release a request slot
     */
    async release(requestId, hostname) {
        const manager = module.exports.getInstance();
        return manager.release(requestId, hostname);
    },

    /**
     * Mark request as errored
     */
    async error(requestId, hostname) {
        const manager = module.exports.getInstance();
        return manager.error(requestId, hostname);
    },

    /**
     * Get statistics
     */
    getStats() {
        if (!managerInstance) return null;
        return managerInstance.getStats();
    },

    /**
     * Clear all (for testing)
     */
    clearAll() {
        if (managerInstance) {
            managerInstance.clearAll();
        }
    }
};
