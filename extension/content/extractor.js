/**
 * Brand Inspector - Asset Extractor
 * Discovers and extracts images, logos, and icons from web pages
 */

class AssetExtractor {
    constructor() {
        this.MIN_IMAGE_SIZE = 40; // Minimum dimensions to consider
        this.MAX_ASSETS = 200; // Limit total assets extracted
    }

    /**
     * Extract all assets from the page
     */
    async extractAssets(page = document) {
        console.log('Extracting assets from page...');

        const assets = [];

        // Extract regular images
        const images = await this.extractImages(page);
        assets.push(...images);

        // Extract SVGs
        const svgs = await this.extractSVGs(page);
        assets.push(...svgs);

        // Extract background images
        const bgImages = await this.extractBackgroundImages(page);
        assets.push(...bgImages);

        // Extract favicons
        const favicons = await this.extractFavicons(page);
        assets.push(...favicons);

        // Filter out invalid assets (no URL, undefined fileName, etc.)
        const validAssets = assets.filter(asset => {
            return asset.url &&
                   asset.url !== 'undefined' &&
                   asset.url !== 'null' &&
                   !asset.url.includes('undefined') &&
                   asset.fileName &&
                   asset.fileName !== 'undefined' &&
                   asset.width > 0 &&
                   asset.height > 0;
        });

        // Deduplicate by URL
        const uniqueAssets = this.deduplicateAssets(validAssets);

        // Sort by size (largest first)
        uniqueAssets.sort((a, b) => (b.width * b.height) - (a.width * a.height));

        console.log(`Extracted ${uniqueAssets.length} unique assets`);

        return uniqueAssets.slice(0, this.MAX_ASSETS);
    }

    /**
     * Extract regular <img> elements
     */
    async extractImages(page) {
        const images = [];
        const imgElements = page.querySelectorAll('img');

        for (const img of imgElements) {
            try {
                // Skip if not visible
                if (!this.isVisible(img)) continue;

                const rect = img.getBoundingClientRect();

                // Skip if too small
                if (rect.width < this.MIN_IMAGE_SIZE || rect.height < this.MIN_IMAGE_SIZE) {
                    continue;
                }

                const asset = {
                    type: 'image',
                    format: this.getImageFormat(img.src),
                    url: this.getAbsoluteURL(img.src),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    alt: img.alt || '',
                    fileName: this.getFileName(img.src),
                    fileSize: null, // Will be calculated on download
                    isLogo: this.isLikelyLogo(img, rect),
                    isFavicon: false,
                    element: img.tagName.toLowerCase()
                };

                // Try to get file size from image
                asset.fileSize = await this.estimateImageSize(img);

                images.push(asset);
            } catch (err) {
                console.warn('Failed to process image:', err);
            }
        }

        return images;
    }

    /**
     * Extract inline SVG elements
     */
    async extractSVGs(page) {
        const svgs = [];
        const svgElements = page.querySelectorAll('svg');

        for (const svg of svgElements) {
            try {
                // Skip if not visible
                if (!this.isVisible(svg)) continue;

                const rect = svg.getBoundingClientRect();

                // Skip if too small
                if (rect.width < this.MIN_IMAGE_SIZE || rect.height < this.MIN_IMAGE_SIZE) {
                    continue;
                }

                // Convert SVG to data URL
                const svgData = new XMLSerializer().serializeToString(svg);

                // Use UTF-8 encoding for SVG data URL (handles special characters better)
                const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);

                // Get original file name (keep long names)
                let fileName = this.getSVGName(svg);

                const asset = {
                    type: 'svg',
                    format: 'svg',
                    url: dataUrl,
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    naturalWidth: Math.round(rect.width),
                    naturalHeight: Math.round(rect.height),
                    alt: svg.getAttribute('aria-label') || '',
                    fileName: fileName,
                    fileSize: new Blob([svgData]).size,
                    isLogo: this.isLikelyLogo(svg, rect),
                    isFavicon: false,
                    element: 'svg'
                };

                svgs.push(asset);
            } catch (err) {
                console.warn('Failed to process SVG:', err);
            }
        }

        return svgs;
    }

    /**
     * Extract CSS background images
     */
    async extractBackgroundImages(page) {
        const bgImages = [];
        const elements = page.querySelectorAll('*');

        for (const el of elements) {
            try {
                if (!this.isVisible(el)) continue;

                const style = window.getComputedStyle(el);
                const bgImage = style.backgroundImage;

                if (!bgImage || bgImage === 'none') continue;

                // Extract URL from background-image
                const urlMatch = bgImage.match(/url\(['"]?(.+?)['"]?\)/);
                if (!urlMatch) continue;

                const url = urlMatch[1];
                const rect = el.getBoundingClientRect();

                // Skip if too small
                if (rect.width < this.MIN_IMAGE_SIZE || rect.height < this.MIN_IMAGE_SIZE) {
                    continue;
                }

                const asset = {
                    type: 'background',
                    format: this.getImageFormat(url),
                    url: this.getAbsoluteURL(url),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    naturalWidth: null,
                    naturalHeight: null,
                    alt: '',
                    fileName: this.getFileName(url),
                    fileSize: null,
                    isLogo: false,
                    isFavicon: false,
                    element: el.tagName.toLowerCase()
                };

                bgImages.push(asset);
            } catch (err) {
                // Silently skip errors (CORS issues with computed styles)
            }
        }

        return bgImages;
    }

    /**
     * Extract favicon links
     */
    async extractFavicons(page) {
        const favicons = [];
        const iconLinks = page.querySelectorAll('link[rel*="icon"]');

        for (const link of iconLinks) {
            try {
                const href = link.getAttribute('href');
                if (!href) continue;

                const sizes = link.getAttribute('sizes');
                let width = 32, height = 32;

                if (sizes && sizes !== 'any') {
                    const [w, h] = sizes.split('x').map(n => parseInt(n));
                    width = w || 32;
                    height = h || 32;
                }

                const asset = {
                    type: 'favicon',
                    format: this.getImageFormat(href),
                    url: this.getAbsoluteURL(href),
                    width: width,
                    height: height,
                    naturalWidth: width,
                    naturalHeight: height,
                    alt: 'Favicon',
                    fileName: this.getFileName(href),
                    fileSize: null,
                    isLogo: false,
                    isFavicon: true,
                    element: 'link'
                };

                favicons.push(asset);
            } catch (err) {
                console.warn('Failed to process favicon:', err);
            }
        }

        return favicons;
    }

    /**
     * Check if element is visible
     */
    isVisible(el) {
        if (!el) return false;

        const style = window.getComputedStyle(el);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0';
    }

    /**
     * Check if image is likely a logo
     */
    isLikelyLogo(el, rect) {
        // Check position (header, top of page)
        if (rect.top < 150) return true;

        // Check for logo-related classes/IDs
        const className = (el.className || '').toString().toLowerCase();
        const id = (el.id || '').toLowerCase();
        const alt = (el.alt || '').toLowerCase();

        const logoKeywords = ['logo', 'brand', 'wordmark', 'icon'];
        return logoKeywords.some(keyword =>
            className.includes(keyword) ||
            id.includes(keyword) ||
            alt.includes(keyword)
        );
    }

    /**
     * Get descriptive name for SVG
     */
    getSVGName(svg) {
        // Try aria-label
        const ariaLabel = svg.getAttribute('aria-label');
        if (ariaLabel) return this.sanitizeFileName(ariaLabel) + '.svg';

        // Try title element
        const title = svg.querySelector('title');
        if (title?.textContent) return this.sanitizeFileName(title.textContent) + '.svg';

        // Try ID
        const id = svg.getAttribute('id');
        if (id) return this.sanitizeFileName(id) + '.svg';

        // Try class
        const className = svg.getAttribute('class');
        if (className) {
            const firstClass = className.split(' ')[0];
            return this.sanitizeFileName(firstClass) + '.svg';
        }

        // Default
        return 'icon.svg';
    }

    /**
     * Sanitize file name
     */
    sanitizeFileName(name) {
        return name
            .replace(/[^a-zA-Z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase()
            .slice(0, 50);
    }

    /**
     * Get file name from URL
     */
    getFileName(url) {
        if (!url) return 'unknown';

        // Remove query params
        const cleanUrl = url.split('?')[0];

        // Get last segment
        const segments = cleanUrl.split('/');
        let fileName = segments[segments.length - 1] || 'image';

        // Decode URI component
        try {
            fileName = decodeURIComponent(fileName);
        } catch (e) {
            // Keep as is
        }

        // Shorten if too long
        if (fileName.length > 50) {
            const ext = fileName.split('.').pop();
            fileName = fileName.slice(0, 40) + '...' + ext;
        }

        return fileName;
    }

    /**
     * Get image format from URL
     */
    getImageFormat(url) {
        if (!url) return 'unknown';

        const ext = url.split('.').pop().split('?')[0].toLowerCase();
        const formats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp'];

        return formats.includes(ext) ? ext : 'unknown';
    }

    /**
     * Get absolute URL
     */
    getAbsoluteURL(url) {
        if (!url) return '';

        try {
            return new URL(url, window.location.href).href;
        } catch (e) {
            return url;
        }
    }

    /**
     * Estimate image file size
     */
    async estimateImageSize(img) {
        try {
            // For data URLs, we can calculate directly
            if (img.src.startsWith('data:')) {
                const base64 = img.src.split(',')[1];
                return base64 ? Math.round(base64.length * 0.75) : null;
            }

            // For regular URLs, try to fetch headers
            const response = await fetch(img.src, { method: 'HEAD' });
            const contentLength = response.headers.get('content-length');
            return contentLength ? parseInt(contentLength) : null;
        } catch (e) {
            // CORS or network error, can't determine size
            return null;
        }
    }

    /**
     * Deduplicate assets by URL
     */
    deduplicateAssets(assets) {
        const seen = new Map();

        for (const asset of assets) {
            // Use URL as key, keep first occurrence (usually higher quality)
            if (!seen.has(asset.url)) {
                seen.set(asset.url, asset);
            }
        }

        return Array.from(seen.values());
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (!bytes) return 'Unknown';

        const units = ['B', 'KB', 'MB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AssetExtractor;
}
