# Browser Pool Implementation Guide

## Overview

This document describes the browser pooling system implemented to improve performance and reliability of the GTM Crawler.

---

## Components Created

### 1. **browser-pool.js** (350 lines)
**Purpose**: Maintain 2-3 warm Chrome instances for faster request handling

**Features**:
- Warm browser pool (2-3 instances)
- Context reuse (acquire/release pattern)
- Auto-recovery on crashes
- Health checks every 10 seconds
- Idle context cleanup (60s timeout)
- Graceful shutdown

**Usage**:
```javascript
const browserPool = require('./browser-pool');

// Acquire a context
const { browser, context, contextId } = await browserPool.acquire('example.com');
const page = await context.newPage();

// ... use page ...

// Release context (DON'T close browser!)
await browserPool.release(contextId);
```

**Statistics**:
```javascript
const stats = browserPool.getStats();
// {
//   totalAcquired: 125,
//   totalReleased: 120,
//   totalCrashes: 2,
//   totalRecoveries: 2,
//   browsers: 3,
//   activeContexts: 5,
//   totalContexts: 5
// }
```

---

### 2. **concurrency-manager.js** (280 lines)
**Purpose**: Polite crawling with host-based request queuing

**Features**:
- 1 concurrent request per hostname (polite)
- 5 concurrent requests globally
- Queue system for same-host requests
- 60 second queue timeout
- 30 second request timeout
- Statistics tracking

**Usage**:
```javascript
const concurrencyManager = require('./concurrency-manager');

// Acquire slot
const { requestId, hostname } = await concurrencyManager.acquire('https://example.com');

try {
  // ... crawl site ...
  await concurrencyManager.release(requestId, hostname);
} catch (error) {
  await concurrencyManager.error(requestId, hostname);
}
```

**Statistics**:
```javascript
const stats = concurrencyManager.getStats();
// {
//   totalRequests: 250,
//   totalQueued: 45,
//   totalTimedOut: 2,
//   totalCompleted: 248,
//   currentActive: 5,
//   currentQueued: 0,
//   activeByHost: [
//     { hostname: 'example.com', active: 1 },
//     { hostname: 'test.com', active: 1 }
//   ]
// }
```

---

### 3. **responsive-detector.js** (280 lines)
**Purpose**: Detect if site uses responsive design to avoid unnecessary mobile viewport testing

**Detection Strategies**:
1. `<picture>` elements (25 points)
2. `srcset` attributes (20 points)
3. Viewport meta tag with device-width (30 points)
4. CSS media queries with mobile breakpoints (20 points)
5. Flexbox/Grid layouts (5 points each)

**Usage**:
```javascript
const ResponsiveDetector = require('./responsive-detector');
const detector = new ResponsiveDetector();

// Full detection (requires Puppeteer page)
const result = await detector.detect(page);
// {
//   isResponsive: true,
//   confidence: 85,
//   indicators: {
//     hasPicture: true,
//     pictureCount: 5,
//     hasSrcset: true,
//     srcsetCount: 12,
//     hasViewportMeta: true,
//     hasMediaQueries: true,
//     mediaQueryBreakpoints: [768, 1024]
//   },
//   recommendation: {
//     useMobile: true,
//     reason: 'Strong responsive indicators (85% confidence)',
//     viewports: [
//       { width: 1920, height: 1080, name: 'desktop' },
//       { width: 375, height: 667, name: 'mobile' }
//     ]
//   }
// }

// Quick check (HTML only, no Puppeteer needed)
const quickResult = await detector.quickCheck(html);
```

---

## Migration Pattern

### Before (Old Pattern):
```javascript
async function crawlSite(url) {
  let browser = null;
  try {
    // Launch browser (2-3s startup)
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: '/usr/bin/google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Crawl...
    await page.goto(url);
    const content = await page.content();

    return content;

  } finally {
    if (browser) {
      await browser.close(); // Close entire browser
    }
  }
}
```

### After (New Pattern):
```javascript
const browserPool = require('./browser-pool');
const concurrencyManager = require('./concurrency-manager');

async function crawlSite(url) {
  // Acquire concurrency slot (queues if needed)
  const { requestId, hostname } = await concurrencyManager.acquire(url);

  try {
    // Acquire browser context (0.1s, reuses warm browser)
    const { browser, context, contextId } = await browserPool.acquire(hostname);
    const page = await context.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Crawl...
    await page.goto(url);
    const content = await page.content();

    // Release context (DON'T close browser!)
    await browserPool.release(contextId);
    await concurrencyManager.release(requestId, hostname);

    return content;

  } catch (error) {
    await concurrencyManager.error(requestId, hostname);
    throw error;
  }
}
```

---

## Performance Comparison

### Scenario: 10 Concurrent Requests to 5 Different Hosts

#### Before (No Pooling):
```
Request 1-10: Each launches Chrome (2.5s) + Crawls (10s) + Closes (0.5s)
Time per request: 13 seconds
Total time (5 hosts, 2 req each): 26 seconds (sequential per host)
Memory usage: 300MB × 10 = 3GB peak
```

#### After (With Pooling):
```
Request 1-10: Acquire context (0.1s) + Crawl (10s) + Release (0.1s)
Time per request: 10.2 seconds
Total time (5 hosts, 2 req each): 20.4 seconds (parallel across hosts, sequential per host)
Memory usage: 150MB × 3 browsers = 450MB stable
```

**Improvements**:
- **-22% latency** per request (13s → 10.2s)
- **-21% total time** (26s → 20.4s)
- **-85% memory** (3GB → 450MB)
- **Fewer 403 errors** (polite crawling, 1 req/host)

---

## Configuration

### Browser Pool Config:
```javascript
const browserPool = require('./browser-pool').getInstance({
  minInstances: 2,              // Keep 2 browsers warm
  maxInstances: 3,              // Scale to 3 if needed
  maxContextsPerBrowser: 5,     // 5 contexts per browser max
  contextIdleTimeout: 60000,    // Close idle contexts after 60s
  healthCheckInterval: 10000,   // Health check every 10s
  executablePath: '/usr/bin/google-chrome-stable'
});
```

### Concurrency Config:
```javascript
const concurrencyManager = require('./concurrency-manager').getInstance({
  maxConcurrentPerHost: 1,   // 1 request per host (polite)
  maxConcurrentTotal: 5,     // 5 requests globally
  requestTimeout: 30000,     // 30s per request
  queueTimeout: 60000        // 60s max queue wait
});
```

---

## Integration Points

### Files to Modify:
1. **server.js** (4 puppeteer.launch locations)
   - `/api/crawl` endpoint
   - `/api/analyze-website` endpoint
   - `/api/analyze-website-enhanced` endpoint
   - `/api/extract-brand` endpoint

2. **brand-page-discoverer.js** (1 location)
   - `fetchUrlWithPuppeteer()` method

3. **enhanced-website-analyzer.js** (1 location)
   - `launchBrowser()` method

4. **brand-extractor-with-fallbacks.js** (1 location)
   - Fallback extraction method

### Integration Steps:
1. Add feature flag to `.env`: `USE_BROWSER_POOL=true`
2. Wrap old pattern with conditional:
   ```javascript
   if (process.env.USE_BROWSER_POOL === 'true') {
     // New pattern
   } else {
     // Old pattern (fallback)
   }
   ```
3. Test with browser pool enabled
4. Monitor for issues
5. Remove old pattern once stable

---

## Testing

### Unit Tests:
```bash
# Test browser pool
node -e "
const pool = require('./browser-pool');
(async () => {
  const c1 = await pool.acquire('test.com');
  const c2 = await pool.acquire('test.com');
  console.log('Stats:', pool.getStats());
  await pool.release(c1.contextId);
  await pool.release(c2.contextId);
  await pool.shutdown();
})();
"

# Test concurrency manager
node -e "
const cm = require('./concurrency-manager');
(async () => {
  const r1 = await cm.acquire('https://test.com/1');
  const r2 = await cm.acquire('https://test.com/2'); // Should queue
  console.log('Stats:', cm.getStats());
  await cm.release(r1.requestId, r1.hostname);
})();
"
```

### Load Tests:
```bash
# Send 100 concurrent requests
for i in {1..100}; do
  curl -X POST http://localhost:3001/api/extract-brand \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://example${i}.com\"}" &
done
```

---

## Monitoring

### Health Check Endpoint:
Add to server.js:
```javascript
app.get('/api/pool-stats', (req, res) => {
  const browserStats = require('./browser-pool').getStats();
  const concurrencyStats = require('./concurrency-manager').getStats();

  res.json({
    browserPool: browserStats,
    concurrency: concurrencyStats,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

### Metrics to Monitor:
- **Browser pool**: crashes, recoveries, active contexts
- **Concurrency**: queue length, timeouts, errors per host
- **Memory**: heap usage should stabilize around 450MB
- **Response time**: should drop by 20-25%

---

## Troubleshooting

### Issue: "All browsers at capacity"
**Cause**: maxInstances too low or contexts not being released

**Fix**:
```javascript
// Check stats
const stats = browserPool.getStats();
console.log('Active contexts:', stats.activeContexts);

// Increase max instances
const browserPool = require('./browser-pool').getInstance({
  maxInstances: 5 // Increase from 3
});
```

### Issue: "Queue timeout after 60000ms"
**Cause**: Too many requests to same host

**Fix**:
```javascript
// Increase queue timeout or concurrent per host
const cm = require('./concurrency-manager').getInstance({
  maxConcurrentPerHost: 2, // Allow 2 per host
  queueTimeout: 120000      // 2 minute timeout
});
```

### Issue: Browser memory leak
**Cause**: Contexts not being released

**Fix**:
```javascript
// Enable auto-cleanup of idle contexts
const browserPool = require('./browser-pool').getInstance({
  contextIdleTimeout: 30000 // Close idle after 30s
});
```

---

## Rollback Plan

If issues occur:

1. **Set environment variable**:
   ```bash
   export USE_BROWSER_POOL=false
   docker-compose restart backend
   ```

2. **Browser pool gracefully shuts down**
3. **Falls back to old `puppeteer.launch()` pattern**
4. **No data loss, no downtime**

---

## Next Steps

1. ✅ Create browser-pool.js
2. ✅ Create concurrency-manager.js
3. ✅ Create responsive-detector.js
4. ✅ Upgrade Puppeteer to v24
5. ⏳ Integrate into server.js
6. ⏳ Integrate into brand-page-discoverer.js
7. ⏳ Test with concurrent requests
8. ⏳ Monitor performance in production
9. ⏳ Remove old pattern once stable

---

## References

- **Chrome Headless Docs**: https://developer.chrome.com/docs/chromium/headless
- **Puppeteer API**: https://pptr.dev/
- **Browser Context Docs**: https://pptr.dev/api/puppeteer.browsercontext

---

**Status**: Implementation ready, pending integration and testing
**Impact**: -22% latency, -85% memory, fewer 403s
**Risk**: Low (feature flag rollback available)
