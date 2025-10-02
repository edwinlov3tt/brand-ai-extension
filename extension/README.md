# Brand Inspector Chrome Extension

A Chrome extension that extracts and analyzes brand assets (colors, fonts, logos) from any website. Sync to your web app for ad creation and brand management.

## Features

- **Color Extraction**: Auto-detect brand colors with WCAG contrast checking
- **Typography Analysis**: Identify display, body, and heading fonts
- **Logo Detection**: Find and extract brand logos and favicons
- **Interactive Inspector**: Click-to-pick colors, fonts, and text
- **Web App Sync**: Sync captured assets to your web app database
- **Export**: Export brand profiles in multiple formats (JSON, CSS, SCSS)

## Installation (Development)

1. **Clone or download this repository**

2. **Open Chrome and navigate to**:
   ```
   chrome://extensions/
   ```

3. **Enable "Developer mode"** (toggle in top-right corner)

4. **Click "Load unpacked"**

5. **Select the `/extension` directory** from this project

6. **Verify the extension appears** in your extensions list

7. **Pin the extension** to your toolbar for easy access

## Usage

### Opening the Side Panel

- Click the Brand Inspector icon in your Chrome toolbar
- The side panel will open on the right side of your browser

### Automatic Extraction

- Navigate to any website
- The extension will automatically detect brand colors, fonts, and logos
- Results appear in the **Overview** tab

### Manual Capture

Use the picker tools to manually select elements:

- **Pick Color** (`Alt+Shift+C`): Click any element to capture its color
- **Pick Font** (`Alt+Shift+F`): Click any text to capture its font
- **Add Text** (`Alt+Shift+T`): Select and categorize text snippets

### Navigating Tabs

- **Overview**: Summary of all detected brand assets
- **Colors**: Detailed color palette with WCAG analysis
- **Fonts**: Typography hierarchy and font details
- **Assets**: Logos, images, and brand icons
- **Profile**: Complete brand profile summary

### Exporting Data

- Click **Export** in the action bar
- Choose your format (JSON, CSS, SCSS, etc.)
- Download or copy to clipboard

### Syncing to Web App

- Click **Sync to App** in the action bar
- Authenticate with your web app account
- Captured assets will sync to your brand profile

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+C` | Activate color picker |
| `Alt+Shift+F` | Activate font picker |
| `Alt+Shift+T` | Activate text capture |
| `Alt+Shift+I` | Activate image picker |
| `Escape` | Deactivate any picker |

## Development

### Phase 1: Foundation (Current)
- Extension structure and manifest
- Side panel with 5 tabs
- Service worker
- Basic content script

### Phase 2: Inspector (Next)
- Element hover inspector
- Click-to-select functionality
- Keyboard shortcuts
- Message passing

### Phase 3: Auto-Detection
- Advanced color extraction
- Font hierarchy detection
- Logo detection
- Overview tab population

### Phase 4: Interactive Tabs
- Colors tab with grouping
- Fonts tab with samples
- Assets tab with previews
- Brand profile tab

### Phase 5: WCAG & Export
- WCAG 2.0 contrast checker
- Color pairing matrix
- Multiple export formats
- Color relationship visualization

### Phase 6: Web App Integration
- OAuth 2.0 authentication
- Real-time sync
- Offline queue
- Conflict resolution

## Project Structure

```
extension/
├── manifest.json              # Extension configuration
├── background/
│   └── service-worker.js     # Background service worker
├── content/
│   ├── content-script.js     # DOM inspection logic
│   ├── inspector.js          # Element picker (Phase 2)
│   ├── extractor.js          # Asset extraction (Phase 3)
│   └── content.css           # Injected styles
├── sidepanel/
│   ├── sidepanel.html        # Side panel UI
│   ├── sidepanel.js          # Side panel controller
│   ├── sidepanel.css         # Side panel styles
│   ├── components/           # Tab components (Phase 4)
│   └── utils/                # Utilities (WCAG, API client)
└── assets/
    └── icons/                # Extension icons
```

## Testing

### Test Sites
- Simple HTML sites
- React/Vue/Angular SPAs
- Sites with custom fonts (Google Fonts, Adobe Fonts)
- Sites with prominent branding
- Sites with Shadow DOM components

### Manual Testing
1. Load extension in `chrome://extensions/`
2. Navigate to test website
3. Open side panel
4. Verify auto-detection works
5. Test picker tools
6. Check all 5 tabs
7. Test export functionality

## Troubleshooting

### Extension won't load
- Check `chrome://extensions/` for errors
- Verify manifest.json is valid
- Ensure all file paths are correct

### Side panel won't open
- Check service worker logs in `chrome://extensions/`
- Verify `sidePanel` permission in manifest
- Try reloading the extension

### Inspector not working
- Check console for content script errors
- Verify content script injected (inspect page → Console)
- Try refreshing the page

### No data detected
- Ensure page is fully loaded
- Check if site blocks content scripts (CSP)
- Try manual capture with picker tools

## Requirements

- Chrome 100+ or Edge Chromium 100+
- Manifest V3 support
- Active internet connection for web app sync

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
- Create an issue on GitHub
- Check IMPLEMENTATION_ROADMAP.md for development progress
- Review PRD.md for feature specifications

---

**Current Version**: 1.0.0 (Phase 1 Complete)
**Last Updated**: 2025-10-01
