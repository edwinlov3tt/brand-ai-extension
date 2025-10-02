# Brand Inspector Chrome Extension - Implementation Roadmap

## Overview

This document provides a detailed breakdown of the implementation phases for the Brand Inspector Chrome Extension. Each phase is organized by complexity level and includes specific tasks, acceptance criteria, and technical considerations.

---

## Phase 1: Foundation Setup
**Complexity**: Low
**Estimated Effort**: 1-2 development sessions
**Goal**: Create the basic extension structure and verify it loads in Chrome

### Tasks

#### 1.1 Project Structure
- [x] Create `/extension` directory
- [ ] Create subdirectories: `/background`, `/content`, `/sidepanel`, `/assets`, `/lib`
- [ ] Setup `.gitignore` for extension-specific files

#### 1.2 Manifest V3 Configuration
- [ ] Create `manifest.json` with:
  - Extension metadata (name, version, description)
  - Permissions: `activeTab`, `storage`, `sidePanel`
  - Host permissions for web app API
  - Service worker registration
  - Content script declaration
  - Side panel configuration
- [ ] Create icon assets (16x16, 48x48, 128x128)

#### 1.3 Basic Side Panel UI
- [ ] Create `sidepanel.html` with:
  - Tab navigation (5 tabs: Overview, Colors, Fonts, Assets, Brand Profile)
  - Header with extension name and status indicator
  - Main content area
  - Action bar with Sync/Export buttons
- [ ] Create `sidepanel.css` with:
  - Responsive layout (320px - 600px width)
  - Tab switching styles
  - Empty state placeholders
  - Dark/light theme variables
- [ ] Create `sidepanel.js` with:
  - Tab switching logic
  - Basic state management
  - Message listener setup

#### 1.4 Service Worker
- [ ] Create `background/service-worker.js` with:
  - Extension installation handler
  - Message passing setup
  - Side panel opening logic

### Acceptance Criteria
- Extension loads without errors in Chrome
- Side panel opens when extension icon is clicked
- All 5 tabs are visible and clickable
- Tab content areas are properly styled but empty
- No console errors

### Testing
```bash
# Load extension
1. Open chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select /extension directory
5. Verify extension appears in toolbar
6. Click extension icon → side panel opens
```

---

## Phase 2: Content Script & DOM Inspector
**Complexity**: Medium
**Estimated Effort**: 3-4 development sessions
**Goal**: Implement interactive element inspection on any webpage

### Tasks

#### 2.1 Content Script Setup
- [ ] Create `content/content-script.js` with:
  - Injection guard (run once per page)
  - Message listener from service worker
  - Inspector activation/deactivation
  - Communication channel to sidepanel
- [ ] Create `content/content.css` with:
  - Overlay styles for element highlighting
  - Tooltip styles for element info
  - Cursor changes for inspection mode

#### 2.2 Element Inspector
- [ ] Create `content/inspector.js` with:
  - Hover detection with `mouseover` events
  - Element highlighting with overlay div
  - Computed style extraction
  - Position calculation for overlays
  - Click-to-select functionality
  - Escape key to exit inspection mode

#### 2.3 Hover Tooltip
- [ ] Build floating tooltip that shows:
  - Element tag name
  - Colors (background, text, border)
  - Font family and size
  - Dimensions (width x height)
  - Copy buttons for each property
- [ ] Position tooltip near cursor without overflow
- [ ] Shadow DOM implementation to avoid site CSS conflicts

#### 2.4 Keyboard Shortcuts
- [ ] Implement global shortcuts:
  - `Alt+Shift+C`: Activate color picker
  - `Alt+Shift+F`: Activate font picker
  - `Alt+Shift+T`: Activate text capture
  - `Alt+Shift+I`: Activate image picker
  - `Escape`: Deactivate any picker

#### 2.5 Message Passing Architecture
- [ ] Content Script → Service Worker:
  - `ELEMENT_SELECTED`: Send selected element data
  - `INSPECTOR_ACTIVATED`: Notify inspector is on
  - `INSPECTOR_DEACTIVATED`: Notify inspector is off
- [ ] Service Worker → Side Panel:
  - `UPDATE_SELECTED_ELEMENT`: Display element info
  - `ADD_TO_PALETTE`: Add color to Colors tab
  - `ADD_TO_FONTS`: Add font to Fonts tab

### Acceptance Criteria
- Hovering over any element shows highlighting and tooltip
- Clicking an element captures its properties
- Keyboard shortcuts work on any website
- Inspector can be toggled on/off
- No interference with website's normal functionality
- Works on SPAs (React/Vue/Angular sites)

### Testing Scenarios
- Test on simple HTML page
- Test on React SPA (e.g., create-react-app demo)
- Test on site with iframes
- Test on site with Shadow DOM components
- Verify no CSS conflicts with popular sites

---

## Phase 3: Automated Asset Detection
**Complexity**: High
**Estimated Effort**: 5-7 development sessions
**Goal**: Automatically detect and extract brand assets on page load

### Tasks

#### 3.1 Port Backend Logic
- [ ] Create `content/extractor.js` with:
  - DOM-based color analysis (adapted from `color-analyzer.js`)
  - Font hierarchy detection (adapted from `font-analyzer.js`)
  - Logo detection (adapted from `logo-detector.js`)
  - Meta information extraction

#### 3.2 Color Extraction
- [ ] Implement weighted color extraction:
  - Element role detection (header, hero, CTA, main, footer)
  - Role-based weighting (header: 5x, hero: 4x, CTA: 4x, background: 0.2x)
  - Filter out white/black/gray colors
  - Cluster similar colors
  - Calculate WCAG contrast ratios
- [ ] Extract colors from:
  - Computed styles (background, text, border)
  - Logo images (using Color Thief)
  - Hero images
- [ ] Group colors by role (primary, secondary, accent)

#### 3.3 Typography Extraction
- [ ] Detect font hierarchy:
  - H1-H6 heading fonts
  - Display font (largest, most prominent)
  - Body font (paragraphs, content)
  - Accent font (quotes, special elements)
- [ ] Extract font metadata:
  - Font family and fallbacks
  - Weights used (400, 700, etc.)
  - Font sources (Google Fonts, Adobe Fonts, self-hosted)
  - Usage coverage (% of text using this font)
- [ ] Calculate font confidence scores

#### 3.4 Logo & Asset Detection
- [ ] Implement logo detection:
  - Header/footer image search
  - Scoring algorithm (position, size, keywords)
  - SVG detection
  - Favicon extraction
- [ ] Detect brand assets:
  - Hero images (large, top-of-page images)
  - Social media images (og:image)
  - Brand icons
- [ ] Extract metadata for each asset

#### 3.5 Overview Tab Population
- [ ] Display auto-detected assets in Overview tab:
  - Hero image (if found)
  - Primary logo
  - Tagline (from meta description or H1)
  - Favicon
  - Typography section (display + body fonts)
  - Color palette (5 main colors)
  - "Show all" buttons for each section

### Acceptance Criteria
- On page load, extension automatically extracts:
  - 5+ brand colors with accurate roles
  - Display and body fonts with confidence scores
  - Primary logo (if present)
  - Hero image (if present)
- Overview tab populates within 2 seconds of page load
- Color roles match visual inspection (primary = most prominent)
- Font detection works on sites with custom fonts
- Logo detection has <10% false positive rate

### Performance Requirements
- Extraction runs in < 2 seconds on average website
- Memory usage stays under 30MB
- No noticeable lag on page load
- Works on pages with 1000+ DOM elements

---

## Phase 4: Interactive Capture & Categorization
**Complexity**: Medium-High
**Estimated Effort**: 5-6 development sessions
**Goal**: Build fully interactive tabs with manual asset capture

### Tasks

#### 4.1 Colors Tab
- [ ] Create `sidepanel/components/ColorsTab.js`:
  - Display detected colors grouped by category
  - Color swatch with hex/rgb values
  - "Add Color" button to trigger inspector
  - "Copy" buttons (hex, rgb, hsl formats)
  - "Inspect" button to highlight where color is used on page
  - "Delete" button to remove from palette
  - Drag-and-drop reordering
- [ ] Category grouping:
  - Primary (1 color)
  - Secondary (1-2 colors)
  - Accent (2-3 colors)
  - Neutral (grays, whites)
  - Allow manual recategorization

#### 4.2 Fonts Tab
- [ ] Create `sidepanel/components/FontsTab.js`:
  - Display font hierarchy:
    - Display font section (with sample text)
    - Body font section (with sample text)
    - Heading fonts (H1-H6 breakdown)
  - Font metadata:
    - Font family name
    - Weights available
    - Source (Google Fonts with link, Adobe Fonts, etc.)
    - Usage coverage percentage
  - "Add Font" button to capture from page
  - "Copy font-family" button
  - "Download" button for web fonts (if available)

#### 4.3 Assets Tab
- [ ] Create `sidepanel/components/AssetsTab.js`:
  - Logo section:
    - Primary logo (large preview)
    - Alternate logos (grid view)
    - Favicon (small preview)
  - Hero images section
  - Brand icons section
  - For each asset:
    - Thumbnail preview
    - Metadata (dimensions, file size, format)
    - "Download" button
    - "Copy URL" button
    - "Delete" button
  - "Add Image" button to capture from page

#### 4.4 Text Capture Modal
- [ ] Create `sidepanel/components/TextCaptureModal.js`:
  - Trigger when user selects text on page
  - Show selected text preview
  - Category dropdown:
    - Tagline
    - CTA (Call-to-Action)
    - Value Proposition
    - Headline
    - Body Copy
    - Testimonial
  - Preserve formatting metadata:
    - Font family
    - Font size
    - Color
    - Font weight
  - "Save" button adds to Brand Profile tab
  - "Copy" button copies text to clipboard

#### 4.5 Brand Profile Tab
- [ ] Create `sidepanel/components/BrandProfileTab.js`:
  - Summary view of all captured assets:
    - Brand name (editable)
    - Domain
    - Capture date
  - Sections:
    - Text Content (grouped by category)
    - Color Palette (compact view)
    - Typography (display + body)
    - Logos & Assets (thumbnails)
  - "Export" button (opens export options)
  - "Sync to Web App" button (opens auth flow)

#### 4.6 Manual Capture from Inspector
- [ ] Update inspector to support:
  - Click color → add to Colors tab with category prompt
  - Click text → open text capture modal
  - Click image → add to Assets tab
  - Right-click menu with capture options

### Acceptance Criteria
- All 5 tabs are fully functional
- Can add assets via inspector or auto-detection
- Can categorize, edit, and delete captured assets
- Colors can be grouped and reordered
- Text content preserves formatting metadata
- Brand Profile tab shows complete summary

### UX Requirements
- Smooth animations for tab switching (<100ms)
- Instant feedback on button clicks
- Clear empty states with instructions
- Undo functionality for deletions
- Keyboard navigation support

---

## Phase 5: WCAG & Advanced Features
**Complexity**: High
**Estimated Effort**: 4-5 development sessions
**Goal**: Add professional color analysis and export capabilities

### Tasks

#### 5.1 WCAG Contrast Checker
- [ ] Create `sidepanel/utils/wcag-calculator.js`:
  - Implement WCAG 2.0 contrast ratio formula
  - AA compliance checker (4.5:1 normal, 3:1 large text)
  - AAA compliance checker (7:1 normal, 4.5:1 large text)
- [ ] Add to Colors Tab:
  - Contrast matrix (all colors vs all colors)
  - Visual indicators (✓ pass, ✗ fail, ⚠ warning)
  - Filter to show only AA/AAA compliant pairs
  - Recommended pairings section

#### 5.2 Color Pairing Matrix
- [ ] Build interactive matrix view:
  - Rows: Background colors
  - Columns: Text colors
  - Cells: Contrast ratio + compliance badge
  - Click cell → preview pairing
  - Hover cell → show example text

#### 5.3 Export Functionality
- [ ] Implement export formats:
  - **JSON**: Complete brand profile
  - **CSS Variables**: `:root { --primary: #...; }`
  - **SCSS Variables**: `$primary: #...;`
  - **Tailwind Config**: `colors: { primary: '#...' }`
  - **ASE (Adobe Swatch Exchange)**: For Adobe apps
  - **PDF**: Visual brand guideline
- [ ] Export modal with format selector
- [ ] Copy to clipboard or download file
- [ ] Include metadata (date, URL, confidence scores)

#### 5.4 Advanced Color Features
- [ ] Color picker for manual color entry
- [ ] Color name generator (AI-powered or database lookup)
- [ ] Color relationship visualization (analogous, complementary, triadic)
- [ ] Shade generator (tints/shades of each color)

#### 5.5 "Show All" Expanded Views
- [ ] Overview → Colors: Expand to show all detected colors (not just top 5)
- [ ] Overview → Fonts: Expand to show all heading levels
- [ ] Overview → Assets: Expand to show all images
- [ ] Implement accordion/collapsible sections

### Acceptance Criteria
- WCAG contrast ratios are accurate to 2 decimal places
- Contrast matrix updates in real-time as colors are added/removed
- At least 5 export formats are supported
- Exports include complete brand data
- Color relationships are visually displayed
- "Show all" views don't cause performance issues

### Technical Considerations
- Use TinyColor2 library for color calculations
- Run WCAG calculations on-demand (not continuously)
- Cache contrast calculations for performance
- PDF export may require external library or web app API

---

## Phase 6: Web App Integration
**Complexity**: Very High
**Estimated Effort**: 6-8 development sessions
**Goal**: Full two-way sync with web app backend

### Tasks

#### 6.1 Authentication Flow
- [ ] Implement OAuth 2.0 flow:
  - "Connect to Web App" button in Brand Profile tab
  - Opens web app login page in new tab
  - Redirect back to extension with auth token
  - Store token securely in Chrome Storage Sync
  - Token refresh logic
- [ ] User profile display:
  - Show logged-in user name/email
  - "Logout" button

#### 6.2 API Client
- [ ] Create `sidepanel/utils/api-client.js`:
  - Authentication header injection
  - Error handling and retry logic
  - Request queueing for offline mode
  - Response parsing and validation
- [ ] Implement API endpoints:
  - `POST /api/brands/{brandId}/captures`: Upload captured assets
  - `POST /api/brands/{brandId}/assets`: Upload individual assets
  - `GET /api/brands/{brandId}/profile`: Fetch existing profile
  - `POST /api/extract-brand`: Trigger backend extraction (for comparison)

#### 6.3 Sync Logic
- [ ] Real-time sync:
  - Auto-sync on asset capture (debounced, 2s delay)
  - Manual sync button in action bar
  - Sync status indicator (synced, syncing, error)
- [ ] Conflict resolution:
  - Detect conflicts when web app has newer data
  - Show merge UI with side-by-side comparison
  - User selects which version to keep (local, remote, merge)
- [ ] Offline queue:
  - Queue all changes when offline
  - Display "Offline mode" banner
  - Auto-sync when connection restored
  - Persist queue in Chrome Storage Local

#### 6.4 Brand Profile Management
- [ ] Fetch existing brand profiles from web app:
  - Dropdown to select existing brand or create new
  - Load captured assets from selected profile
  - Merge auto-detected assets with saved profile
- [ ] Create new brand profile:
  - Auto-populate from current URL
  - User can edit brand name
  - Sync to web app immediately

#### 6.5 Collaborative Editing
- [ ] Show indicators when other users are editing same profile:
  - "2 team members viewing" badge
  - Real-time updates via WebSocket or polling
- [ ] Comments/annotations:
  - Allow users to comment on specific assets
  - Display comments in sidepanel
  - Sync comments to web app

#### 6.6 Error Handling & Recovery
- [ ] Graceful error handling:
  - Network errors → offline mode
  - Auth errors → prompt re-login
  - Validation errors → show error message
- [ ] Retry logic:
  - Exponential backoff for failed requests
  - Max 3 retries before showing error
- [ ] Data integrity:
  - Validate data before sync
  - Rollback on sync failure
  - Local backup before sync

### Acceptance Criteria
- OAuth flow completes successfully
- Captured assets sync to web app within 2 seconds
- Offline mode queues changes and syncs on reconnect
- Conflict resolution UI is clear and easy to use
- Multiple users can work on same profile without data loss
- Sync success rate > 99%

### Security Requirements
- Auth tokens stored in Chrome Storage Sync (encrypted by Chrome)
- HTTPS-only communication
- Token expiration after 24 hours
- Logout clears all local data
- No sensitive data in extension logs

### Performance Requirements
- API calls complete in < 2 seconds
- Sync doesn't block UI interactions
- Queue handles up to 100 pending changes
- Memory usage stays under 50MB with large profiles

---

## Development Environment Setup

### Required Tools
```bash
# Chrome or Chromium-based browser
# Node.js (for build scripts, optional)
# Git for version control
# VS Code with extensions:
#   - ESLint
#   - Prettier
#   - Chrome Extension Development Tools
```

### Testing Workflow
1. Load unpacked extension in Chrome
2. Make code changes
3. Click "Reload" in chrome://extensions/
4. Test on target website
5. Check console for errors (DevTools → Console)
6. Inspect side panel (right-click panel → Inspect)

### Debugging Tips
- Use `console.log()` liberally in development
- Chrome DevTools for content script: Inspect page → Console → Select content script context
- Chrome DevTools for service worker: chrome://extensions/ → Service worker → Inspect
- Chrome DevTools for side panel: Right-click panel → Inspect

### Hot Reload Setup (Optional)
```bash
# Install extensions-reloader
npm install -g extensions-reloader

# Run watcher
extensions-reloader --watch extension/
```

---

## Recommended Libraries

### Essential (Include in `/lib`)
- **TinyColor2** (5KB): Color manipulation, WCAG calculations
  - https://github.com/bgrins/TinyColor
- **Color Thief** (5KB): Extract dominant colors from images
  - https://github.com/lokesh/color-thief

### Optional (Evaluate Need)
- **Preact** (3KB): Lightweight React alternative if component complexity grows
  - Only add if vanilla JS becomes unmanageable
- **DOMPurify** (20KB): Sanitize HTML if displaying user-generated content
- **JSZip** (100KB): For multi-file exports

### Avoid
- React/Vue/Angular: Too heavy for extension
- jQuery: Not needed with modern DOM APIs
- Lodash: Use native JS methods
- Moment.js: Use native Date APIs

---

## Performance Targets

### Memory Usage
- Idle: < 10MB
- Active inspection: < 30MB
- With large profile: < 50MB

### Timing
- Extension load: < 500ms
- Side panel open: < 200ms
- Inspector activate: < 100ms
- Asset extraction: < 2s
- Sync to web app: < 2s

### Compatibility
- Chrome 100+
- Edge Chromium 100+
- Works on 95% of websites
- No conflicts with popular extensions

---

## Testing Checklist

### Phase 1
- [ ] Extension installs without errors
- [ ] Side panel opens
- [ ] All tabs are clickable
- [ ] No console errors

### Phase 2
- [ ] Inspector highlights elements on hover
- [ ] Click captures element properties
- [ ] Keyboard shortcuts work
- [ ] Works on React/Vue/Angular sites
- [ ] No CSS conflicts

### Phase 3
- [ ] Auto-detects 5+ brand colors
- [ ] Identifies display and body fonts
- [ ] Finds primary logo (on sites with logos)
- [ ] Overview tab populates within 2s
- [ ] Accurate color roles

### Phase 4
- [ ] All tabs fully functional
- [ ] Can add/edit/delete assets
- [ ] Text capture preserves formatting
- [ ] Brand profile shows complete summary
- [ ] Smooth animations

### Phase 5
- [ ] WCAG contrast ratios are accurate
- [ ] Contrast matrix displays correctly
- [ ] Exports work in all formats
- [ ] Color relationships are visible
- [ ] "Show all" views perform well

### Phase 6
- [ ] OAuth login works
- [ ] Assets sync to web app
- [ ] Offline mode queues changes
- [ ] Conflict resolution UI works
- [ ] Sync success rate > 99%

---

## Known Challenges & Solutions

### Challenge 1: Content Security Policy (CSP) Violations
**Problem**: Some sites block extension scripts via CSP headers
**Solution**: Use `web_accessible_resources` in manifest and inject via `chrome.scripting.executeScript()`

### Challenge 2: Shadow DOM Inspection
**Problem**: Shadow DOM elements not accessible via standard DOM queries
**Solution**: Recursively traverse shadow roots, use `composedPath()` for event targets

### Challenge 3: Dynamic SPAs
**Problem**: DOM changes after initial extraction on React/Vue sites
**Solution**: Use MutationObserver to re-extract on DOM changes, debounce to avoid performance issues

### Challenge 4: CORS for API Calls
**Problem**: Direct API calls from content script blocked by CORS
**Solution**: Proxy all API calls through service worker with `fetch()` API

### Challenge 5: Large Profile Memory Usage
**Problem**: Storing 100+ assets in memory exceeds 50MB target
**Solution**: Lazy load asset thumbnails, compress images, use IndexedDB for large data

---

## Success Metrics

### Adoption (Post-Launch)
- 1,000 installs in first 3 months
- 60%+ install-to-active rate
- 40%+ DAU/MAU ratio

### Usage
- Average 15-20 assets captured per session
- 30+ min time to complete brand profile
- 70%+ users use all 5 tabs

### Quality
- < 5% support ticket rate
- 90%+ user-reported accuracy
- 99%+ sync success rate

---

## Next Steps

1. ✅ Review and approve roadmap
2. Begin Phase 1: Foundation Setup
3. Iterate through phases with user testing
4. Deploy to Chrome Web Store after Phase 4
5. Monitor metrics and iterate based on feedback

---

**Last Updated**: 2025-10-01
**Status**: Ready for Development
**Contact**: Development Team
