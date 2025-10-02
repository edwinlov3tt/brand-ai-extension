# Brand Analysis API Documentation

## Overview
The `/api/analyze-website` endpoint extracts brand information including colors, fonts, logos, and metadata from websites using Puppeteer and advanced detection algorithms.

## Endpoint Details

**URL**: `POST /api/analyze-website`

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "url": "https://example.com",
  "includeTracking": true,          // Optional: Include GTM/GA tracking data
  "trackingMode": "javascript",      // Optional: "javascript" or "static"
  "multiPageAnalysis": false,        // Optional: Analyze multiple pages
  "includeAI": false                 // Optional: Add AI-powered insights
}
```

## Response Format

### Complete Response Structure

```json
{
  "url": "https://example.com",
  "timestamp": "2025-09-30T02:53:20.652Z",
  "processingTime": 15432,

  "colors": {
    "dominant": "#b0e0e9",
    "palette": ["#b0e0e9", "#226d7a", "#ffffff"],
    "total": 20
  },

  "logos": [
    {
      "src": "https://example.com/logo.png",
      "confidence": 85,
      "width": 200,
      "height": 60,
      "top": 20,
      "left": 50,
      "alt": "Company Logo",
      "reason": "Header position + logo keyword"
    },
    {
      "type": "svg",
      "confidence": 70,
      "width": 300,
      "height": 298,
      "top": 60,
      "left": 930,
      "reason": "SVG in header position"
    }
  ],

  "fonts": {
    "display": null,
    "body": null,
    "all": [
      {
        "family": "Open Sans",
        "source": "Google Fonts",
        "weights": ["400", "700"]
      },
      {
        "family": "Roboto",
        "source": "Google Fonts",
        "weights": ["700"]
      }
    ],
    "fontFaces": [
      {
        "family": "Open Sans",
        "weight": "400",
        "style": "normal",
        "src": "url(\"https://fonts.gstatic.com/...\")",
        "unicodeRange": "",
        "files": [
          {
            "url": "https://fonts.gstatic.com/s/opensans/v44/...",
            "source": "Google Fonts"
          }
        ]
      }
    ],
    "networkFiles": [
      {
        "url": "https://fonts.googleapis.com/css?family=Open+Sans",
        "source": "Google Fonts",
        "mimeType": "text/css",
        "status": 200
      }
    ]
  },

  "meta": {
    "title": "Company Name - Tagline",
    "description": "Company description...",
    "ogTitle": "Social Media Title",
    "ogDescription": "Social description...",
    "ogImage": "https://example.com/og-image.jpg"
  },

  "social": {
    "facebook": "https://facebook.com/company",
    "twitter": "https://twitter.com/company",
    "linkedin": "https://linkedin.com/company/name",
    "instagram": "https://instagram.com/company"
  },

  "screenshot": "https://screenshots.edwinlovett.com/...",

  "layout": {
    "viewport": { "width": 1920, "height": 1080 },
    "hasFixedHeader": true,
    "heroHeight": 600
  },

  "context": {
    "companyName": "Company Name",
    "industry": "detected industry",
    "primaryCTA": "Get Started"
  },

  "techStack": {
    "frameworks": [],
    "cms": [],
    "analytics": [],
    "enhanced": true
  },

  "analysisConfig": {
    "includeTracking": true,
    "trackingMode": "javascript",
    "multiPageAnalysis": false,
    "networkRequestsAnalyzed": 45,
    "pagesAnalyzed": 1
  }
}
```

## Color Detection System

### How Colors Are Extracted

The system extracts colors by:

1. **All Computed Styles**: Iterates through every DOM element
2. **Properties Analyzed**:
   - `background-color`
   - `color` (text color)
   - `border-color`

3. **Filtering**:
   - Removes transparent colors (`rgba(0, 0, 0, 0)`)
   - Removes fully transparent backgrounds
   - Converts RGB to hex format
   - Limits to top 20 colors

4. **Processing**:
   - **Dominant**: First non-white/black color
   - **Palette**: Top 8 filtered colors
   - **Total**: Count of unique colors found

### Current Limitations

❌ **Not brand-specific** - Extracts ALL colors from the page
❌ **No frequency analysis** - Doesn't count which colors appear most
❌ **No semantic understanding** - Doesn't identify button colors vs background colors
❌ **No color clustering** - Doesn't group similar shades
❌ **No brand color isolation** - Includes ads, widgets, embedded content

### What's Missing for Robust Brand Colors

1. **Frequency-based ranking**: Count occurrences of each color
2. **Element weighting**: Prioritize header, hero, CTA buttons
3. **Color clustering**: Group similar colors (e.g., #ff0000, #fe0101)
4. **Semantic labeling**: Identify "primary", "secondary", "accent"
5. **Logo color extraction**: Extract colors from detected logos
6. **Area calculation**: Weight by pixel coverage
7. **Third-party filtering**: Exclude iframe/widget colors

## Font Detection System

### How Fonts Are Extracted

The system uses multiple detection methods:

1. **@font-face Rules** (CSS Analysis):
   - Parses all stylesheets
   - Extracts `@font-face` declarations
   - Captures font files, weights, styles
   - Identifies source (Google Fonts, Adobe Fonts, self-hosted)

2. **Network Monitoring** (CDP - Chrome DevTools Protocol):
   - Tracks font file downloads
   - Detects `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`
   - Monitors Google Fonts, Adobe Fonts, Fonts.com requests
   - Records MIME types and response status

3. **Font Loading API**:
   - Checks `document.fonts` for loaded fonts
   - Filters out system fonts
   - Captures weights, styles, stretch values

4. **Declared Fonts**:
   - CSS `font-family` declarations
   - Inline style attributes
   - Computed styles

### Font Data Structure

```javascript
{
  "fonts": {
    // Primary fonts (currently null - not yet implemented)
    "display": null,    // Heading font
    "body": null,       // Body text font

    // All detected fonts with metadata
    "all": [
      {
        "family": "Roboto",
        "source": "Google Fonts",
        "weights": ["400", "700", "900"]
      }
    ],

    // Detailed @font-face declarations
    "fontFaces": [
      {
        "family": "Roboto",
        "weight": "700",
        "style": "normal",
        "src": "url(...)",
        "files": [...]
      }
    ],

    // Network-loaded font files
    "networkFiles": [
      {
        "url": "https://fonts.googleapis.com/...",
        "source": "Google Fonts",
        "mimeType": "text/css",
        "status": 200
      }
    ]
  }
}
```

### Current Limitations

❌ **No hierarchy detection** - `display` and `body` fonts are null
❌ **No usage frequency** - Doesn't track which fonts are actually used
❌ **No element association** - Can't tell what font is used for headings
❌ **No fallback chain** - Doesn't capture full font stack
❌ **Over-collection** - Includes every loaded font, not just brand fonts

### What's Missing for Robust Brand Fonts

1. **Hierarchy detection**: Identify display vs body fonts
2. **Usage analysis**: Measure font usage by element count/area
3. **Hero font detection**: Prioritize above-the-fold text
4. **Semantic labeling**: "heading", "body", "accent", "code"
5. **Weight distribution**: Most common weights used
6. **Fallback chains**: Complete font-family stacks
7. **Brand font identification**: Focus on custom/branded fonts

## Logo Detection System

### How Logos Are Detected

**Score-based system** with multiple signals:

1. **Position-based** (+40 points):
   - Top 200px of page
   - Left-aligned or centered

2. **Keyword-based** (+30 points):
   - Filename contains "logo", "brand", "icon"
   - Alt text contains "logo", "brand"
   - Class name contains "logo", "brand"

3. **Size-based** (+15 points each):
   - Width: 50-400px
   - Height: 20-150px

4. **SVG Detection** (70 points):
   - SVGs in header position
   - Reasonable size range

**Confidence threshold**: 30+ points to be considered a logo

### Current Strengths

✅ Multi-signal detection
✅ Confidence scoring
✅ Position tracking
✅ SVG support
✅ Size validation

### Limitations

❌ **No image analysis** - Doesn't analyze image content
❌ **False positives** - Social icons may score high
❌ **No deduplication** - May return variations of same logo
❌ **Limited context** - Doesn't understand brand vs product logos

## Recommendations for Robust Brand Analysis

### Priority 1: Enhanced Color Detection

```javascript
// Proposed enhancement
{
  "colors": {
    "brand": {
      "primary": "#ff6b35",
      "secondary": "#004e89",
      "accent": "#ffa600"
    },
    "usage": {
      "#ff6b35": {
        "frequency": 145,
        "area": "23%",
        "elements": ["header", "cta", "links"],
        "semantic": "primary-brand"
      }
    },
    "palette": [...],
    "analysis": {
      "method": "frequency+area+semantic",
      "confidence": 0.92
    }
  }
}
```

### Priority 2: Font Hierarchy

```javascript
// Proposed enhancement
{
  "fonts": {
    "display": {
      "family": "Montserrat",
      "weights": ["700", "800"],
      "usage": "h1, h2, hero",
      "confidence": 0.95
    },
    "body": {
      "family": "Open Sans",
      "weights": ["400", "600"],
      "usage": "p, div, span",
      "confidence": 0.98
    },
    "accent": {
      "family": "Playfair Display",
      "usage": "quotes, highlights",
      "confidence": 0.75
    }
  }
}
```

### Priority 3: Brand-Specific Extraction

Create a new endpoint: `POST /api/extract-brand`

Focus exclusively on brand assets:
- Logo variations (main, icon, wordmark)
- Brand colors (primary, secondary, accent)
- Brand fonts (display, body)
- Company name and tagline
- Social media handles
- Brand voice indicators

## Testing

```bash
# Basic analysis
curl -X POST http://localhost:3001/api/analyze-website \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Brand-focused with multi-page
curl -X POST http://localhost:3001/api/analyze-website \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "includeTracking": false,
    "multiPageAnalysis": true
  }'
```

## Summary

**Current State**:
- ✅ Basic color extraction (all colors)
- ✅ Comprehensive font detection (all fonts)
- ✅ Logo detection with scoring
- ❌ Not brand-specific
- ❌ No semantic understanding
- ❌ No hierarchy detection

**Needs Enhancement**:
1. Brand color identification (not all colors)
2. Font hierarchy (display vs body)
3. Semantic labeling (primary vs secondary)
4. Usage frequency analysis
5. Brand-specific filtering