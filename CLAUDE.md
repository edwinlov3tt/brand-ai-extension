# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Brand Inspector is a Chrome extension that extracts brand assets (colors, fonts, logos) from websites. The codebase includes both the Chrome extension (planned) and a Node.js backend API for brand extraction using Puppeteer.

**Primary Goal**: Build a Chrome extension that combines automated brand detection with user-guided curation, reducing brand profile creation time from 2-3 hours to 15-30 minutes.

## Repository Structure

```
brand-ai-extension/
├── context/              # Backend API modules (Node.js)
│   ├── brand-extractor.js              # Main orchestrator for brand extraction
│   ├── brand-extractor-with-fallbacks.js  # Cloudflare bypass system
│   ├── color-analyzer.js               # Color extraction with weighting
│   ├── font-analyzer.js                # Font detection with Google/Adobe Fonts
│   ├── logo-detector.js                # Strict logo detection
│   ├── browser-pool.js                 # Browser pooling for performance
│   ├── concurrency-manager.js          # Polite crawling with host-based queuing
│   ├── brand-page-discoverer.js        # Multi-page brand analysis
│   ├── brand-consolidator.js           # Consolidate brand data
│   └── responsive-detector.js          # Responsive design detection
├── PRD.md               # Product Requirements Document
└── app-context.md       # Empty context file
```

## Core Architecture

### Brand Extraction Pipeline

The brand extraction system follows a multi-stage pipeline:

1. **Page Loading** (browser-pool.js, concurrency-manager.js)
   - Reuses warm browser instances (2-3s startup → 0.1s context acquisition)
   - Polite crawling: 1 concurrent request per hostname, 5 globally
   - Cloudflare bypass using residential proxies

2. **Asset Extraction** (brand-extractor.js)
   - Orchestrates color, font, and logo extraction
   - Cross-validates colors between palette and logo
   - Generates confidence scores for each asset

3. **Color Analysis** (color-analyzer.js)
   - **Weighting system**: Header (5x), Hero (4x), CTA (4x), Background (0.2x)
   - **Key fix**: Large elements (>50% viewport) auto-classified as background
   - **Body tag penalty**: Explicit background color penalization
   - Clustering to group similar colors
   - WCAG contrast ratio calculations

4. **Font Detection** (font-analyzer.js)
   - Detects display vs. body fonts based on usage
   - **Google Fonts integration**: Checks page links → API catalog → common fonts
   - **Adobe Fonts detection**: Extracts Typekit/Adobe kit IDs
   - Returns ready-to-use font URLs with priority system

5. **Logo Detection** (logo-detector.js)
   - **Strict scoring**: Minimum 60 points (increased from 30)
   - **Header/footer requirement**: Middle-page images auto-disqualified (score = 0)
   - Position bonuses: Top 200px (+30), Bottom 300px (+25)
   - Keyword matching: +40 for logo/brand, -20 penalty if missing
   - Size preference: 50-300px sweet spot

6. **Screenshot Capture** (brand-extractor.js)
   - **3-strategy fallback system**:
     1. Full-page with 15s timeout + lazy-load wait
     2. Calculate actual page height, set viewport, capture (caps at 16384px)
     3. Fallback to 1920x1080 viewport

## API Endpoints

### POST /api/extract-brand

Primary brand extraction endpoint with all v2.0 enhancements.

**Request**:
```json
{
  "url": "https://example.com",
  "colorCount": 5,           // Optional: Number of colors (default: 5)
  "includeContrast": true,   // Optional: WCAG contrast (default: true)
  "includeScreenshot": true  // Optional: Capture screenshot (default: true)
}
```

**Response** includes:
- `colors.palette[]`: Weighted brand colors with roles (primary, secondary, accent)
- `typography`: Display/body fonts with Google/Adobe Fonts URLs
- `logos`: Primary + alternates with confidence scores
- `screenshot`: Base64 data with strategy used
- `summary`: High-level brand overview with overall confidence

### POST /api/analyze-website

Legacy endpoint with basic color/font/logo detection (less accurate).

## Development Commands

```bash
# Start backend server
npm start                    # Production mode
npm run dev                  # Development with nodemon

# Run tests
npm test                     # Jest test suite

# Linting
npm run lint                 # ESLint
```

## Environment Variables

```bash
# Google Fonts API (for font link detection)
GOOGLE_FONTS_API_KEY=<your-api-key>

# Bright Data Proxy (for Cloudflare bypass)
PROXY1_HOST=brd.superproxy.io
PROXY1_PORT=33335
PROXY1_USERNAME=brd-customer-<id>-zone-residential_proxy1
PROXY1_PASSWORD=<password>

# Browser Pool (optional)
USE_BROWSER_POOL=true        # Enable browser pooling
```

## Key Implementation Details

### Color Weighting Fix (v2.0)

**Problem**: Background colors dominated palette (70% dead space issue).

**Solution**:
```javascript
roleWeights: {
  header: 5,      // Headers get 5x multiplier
  hero: 4,        // Hero sections get 4x
  cta: 4,         // CTAs get 4x
  main: 0.8,      // Main content reduced to 0.8x
  footer: 0.5,    // Footer reduced to 0.5x
  background: 0.2 // Backgrounds heavily penalized (0.2x)
}
```

Elements covering >50% viewport automatically classified as background.

### Logo Detection Strictness (v2.0)

**Problem**: False positives from content images.

**Solution**:
- Minimum score increased from 30 → 60 points
- **Automatic disqualification**: Images not in header/footer or top/bottom 250px get score = 0
- Position-based scoring heavily favors header (top 200px: +30 points)

### Screenshot Reliability (v2.0)

**Problem**: Partial captures (only 40% of screen).

**Solution**: 3-strategy fallback system with Puppeteer max height handling (16384px cap).

### Browser Pooling System

**Performance improvements**:
- -22% latency per request (13s → 10.2s)
- -85% memory usage (3GB → 450MB)
- Fewer 403 errors via polite crawling

**Configuration**:
```javascript
// Browser pool: 2-3 warm Chrome instances
// Concurrency: 1 req/host, 5 globally
// Context reuse: acquire → use → release pattern
```

## Chrome Extension (Planned)

Per PRD.md, the extension will:
- Use Chrome Manifest V3 architecture
- Implement Side Panel API for persistent UI
- Provide visual element picker with hover preview
- Capture text content (taglines, CTAs, value props)
- Real-time sync with web app via POST /api/brands/{brandId}/captures
- Support keyboard shortcuts (Alt+Shift+[Key])

**Implementation phases**:
- Phase 1 (Weeks 1-6): MVP with basic inspection + web app sync
- Phase 2 (Weeks 7-10): Text categorization + WCAG analysis
- Phase 3 (Weeks 11-14): Auto-grouping + export functionality
- Phase 4 (Weeks 15-18): Team collaboration features

## Testing Brand Extraction

```bash
# Basic extraction
curl -X POST http://localhost:3001/api/extract-brand \
  -H "Content-Type: application/json" \
  -d '{"url": "https://stripe.com"}'

# With options
curl -X POST http://localhost:3001/api/extract-brand \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://stripe.com",
    "colorCount": 8,
    "includeContrast": true,
    "includeScreenshot": true
  }'

# Test font link detection
curl -s -X POST http://localhost:3001/api/extract-brand \
  -H "Content-Type: application/json" \
  -d '{"url": "https://getbootstrap.com"}' \
  | jq '.brand.typography.fontLinks'
```

## Performance Metrics

### Average Extraction Times
- Colors: 2-3 seconds
- Typography: 3-5 seconds (with font link detection)
- Logos: 1-2 seconds
- Screenshot: 5-15 seconds (varies by strategy)
- **Total**: 12-25 seconds for complete extraction

### Accuracy Improvements (v2.0)
- Color accuracy: +35% (background weighting fix)
- Screenshot reliability: +60% (strategy fallback system)
- Logo precision: +50% (strict header/footer requirement)
- Font integration: +100% (new feature)

## Common Pitfalls

1. **Don't close browsers manually**: Use browserPool.release(contextId) instead of browser.close()
2. **Color weighting**: Elements >50% viewport are auto-classified as background (low weight)
3. **Logo detection**: Images in middle of page (not header/footer/top/bottom 250px) automatically get score = 0
4. **Screenshot timeouts**: 3 strategies exist for reliability; check returned strategy field
5. **Font URLs**: Priority order is Google Fonts (1) > Adobe Fonts (2) > Self-hosted (3)

## Monitoring & Health Checks

```javascript
// Check browser pool stats
const stats = browserPool.getStats();
// { totalAcquired, totalReleased, totalCrashes, browsers, activeContexts }

// Check concurrency manager
const stats = concurrencyManager.getStats();
// { totalRequests, totalQueued, totalTimedOut, currentActive, activeByHost }
```

## Node.js Version

Requires Node.js >= 18.0.0 (specified in package.json engines)
