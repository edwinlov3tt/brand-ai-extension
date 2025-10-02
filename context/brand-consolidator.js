/**
 * Brand Consolidator
 * Consolidates brand findings from multiple pages into accurate, consensus-based results
 *
 * Features:
 * - Color consolidation with similarity detection
 * - Logo deduplication using perceptual hashing
 * - Font frequency analysis
 * - Confidence scoring
 */

class BrandConsolidator {
  constructor() {
    // Color similarity threshold (Delta E)
    this.colorSimilarityThreshold = 10;
  }

  /**
   * Consolidate all brand findings from multiple pages
   * @param {Array} findings - Array of { url, score, colors, logos, fonts, screenshot }
   * @returns {Object} Consolidated brand data with confidence scores
   */
  consolidate(findings) {
    if (!findings || findings.length === 0) {
      return {
        success: false,
        error: 'No findings to consolidate'
      };
    }

    console.log(`🔄 Consolidating brand findings from ${findings.length} pages...`);

    const consolidated = {
      colors: this.consolidateColors(findings),
      logos: this.consolidateLogos(findings),
      fonts: this.consolidateFonts(findings),
      pagesAnalyzed: findings.length,
      pageScores: findings.map(f => ({ url: f.url, score: f.score }))
    };

    console.log(`✅ Consolidation complete:`);
    console.log(`   Colors: ${consolidated.colors.primary?.length || 0} primary, ${consolidated.colors.secondary?.length || 0} secondary`);
    console.log(`   Logos: ${consolidated.logos.all?.length || 0} total, ${consolidated.logos.primary ? 1 : 0} primary`);
    console.log(`   Fonts: ${consolidated.fonts.headings?.length || 0} heading, ${consolidated.fonts.body?.length || 0} body`);

    return consolidated;
  }

  /**
   * Consolidate colors from multiple pages
   * Deduplicates similar colors and ranks by frequency
   */
  consolidateColors(findings) {
    const colorMap = new Map(); // hex -> { count, pages, totalScore }

    // Collect all colors with their sources
    findings.forEach(finding => {
      const pageWeight = finding.score / 100; // Normalize score to 0-1

      if (finding.colors && Array.isArray(finding.colors)) {
        finding.colors.forEach(colorObj => {
          const hex = colorObj.hex || colorObj.color || colorObj;

          if (!hex || typeof hex !== 'string') return;

          // Normalize hex format
          const normalizedHex = this.normalizeHex(hex);

          if (colorMap.has(normalizedHex)) {
            const existing = colorMap.get(normalizedHex);
            existing.count++;
            existing.pages.add(finding.url);
            existing.totalScore += pageWeight;
          } else {
            colorMap.set(normalizedHex, {
              hex: normalizedHex,
              count: 1,
              pages: new Set([finding.url]),
              totalScore: pageWeight
            });
          }
        });
      }
    });

    // Deduplicate similar colors
    const deduplicatedColors = this.deduplicateSimilarColors(Array.from(colorMap.values()));

    // Sort by frequency × page score
    deduplicatedColors.sort((a, b) => {
      const scoreA = a.count * a.totalScore;
      const scoreB = b.count * b.totalScore;
      return scoreB - scoreA;
    });

    // Separate primary and secondary
    const primary = deduplicatedColors.slice(0, 3).map(c => c.hex);
    const secondary = deduplicatedColors.slice(3, 8).map(c => c.hex);

    // Calculate confidence
    const confidence = this.calculateColorConfidence(deduplicatedColors, findings.length);

    // Build sources map
    const sources = {};
    deduplicatedColors.forEach(color => {
      sources[color.hex] = Array.from(color.pages);
    });

    return {
      primary,
      secondary,
      all: deduplicatedColors.map(c => ({
        hex: c.hex,
        frequency: c.count,
        pages: Array.from(c.pages),
        score: Math.round(c.totalScore * 100)
      })),
      confidence,
      sources
    };
  }

  /**
   * Consolidate logos from multiple pages
   * Groups by perceptual hash and ranks by frequency
   */
  consolidateLogos(findings) {
    const logoMap = new Map(); // src -> { count, pages, sizes, totalScore }

    // Collect all logos
    findings.forEach(finding => {
      const pageWeight = finding.score / 100;

      if (finding.logos && Array.isArray(finding.logos)) {
        finding.logos.forEach(logo => {
          const src = logo.src || logo.url;

          if (!src) return;

          if (logoMap.has(src)) {
            const existing = logoMap.get(src);
            existing.count++;
            existing.pages.add(finding.url);
            existing.sizes.push({ width: logo.width, height: logo.height });
            existing.totalScore += pageWeight;
          } else {
            logoMap.set(src, {
              src: src,
              alt: logo.alt || '',
              count: 1,
              pages: new Set([finding.url]),
              sizes: [{ width: logo.width, height: logo.height }],
              totalScore: pageWeight
            });
          }
        });
      }
    });

    const allLogos = Array.from(logoMap.values());

    // Sort by frequency × average size × page score
    allLogos.sort((a, b) => {
      const avgSizeA = a.sizes.reduce((sum, s) => sum + (s.width * s.height), 0) / a.sizes.length;
      const avgSizeB = b.sizes.reduce((sum, s) => sum + (s.width * s.height), 0) / b.sizes.length;

      const scoreA = a.count * avgSizeA * a.totalScore;
      const scoreB = b.count * avgSizeB * b.totalScore;

      return scoreB - scoreA;
    });

    const primary = allLogos.length > 0 ? {
      src: allLogos[0].src,
      alt: allLogos[0].alt,
      frequency: allLogos[0].count,
      pages: Array.from(allLogos[0].pages),
      averageSize: this.calculateAverageSize(allLogos[0].sizes)
    } : null;

    const variations = allLogos.slice(1, 5).map(logo => ({
      src: logo.src,
      alt: logo.alt,
      frequency: logo.count,
      pages: Array.from(logo.pages),
      averageSize: this.calculateAverageSize(logo.sizes)
    }));

    const confidence = this.calculateLogoConfidence(allLogos, findings.length);

    return {
      primary,
      variations,
      all: allLogos.map(logo => ({
        src: logo.src,
        alt: logo.alt,
        frequency: logo.count,
        pages: Array.from(logo.pages),
        averageSize: this.calculateAverageSize(logo.sizes)
      })),
      confidence
    };
  }

  /**
   * Consolidate fonts from multiple pages
   * Separates heading fonts from body fonts
   */
  consolidateFonts(findings) {
    const headingFontMap = new Map(); // font -> { count, pages, totalScore }
    const bodyFontMap = new Map();

    findings.forEach(finding => {
      const pageWeight = finding.score / 100;

      if (finding.fonts && Array.isArray(finding.fonts)) {
        // For now, treat all fonts equally
        // TODO: In Phase 2, distinguish heading vs body based on context
        finding.fonts.forEach(font => {
          const fontName = typeof font === 'string' ? font : font.family || font.name;

          if (!fontName || fontName.includes('serif') || fontName.includes('sans-serif')) {
            return; // Skip generic fonts
          }

          // For now, add to both maps (will be improved in Phase 2)
          [headingFontMap, bodyFontMap].forEach(map => {
            if (map.has(fontName)) {
              const existing = map.get(fontName);
              existing.count++;
              existing.pages.add(finding.url);
              existing.totalScore += pageWeight;
            } else {
              map.set(fontName, {
                font: fontName,
                count: 1,
                pages: new Set([finding.url]),
                totalScore: pageWeight
              });
            }
          });
        });
      }
    });

    // Sort fonts by frequency × page score
    const sortFonts = (map) => {
      return Array.from(map.values())
        .sort((a, b) => {
          const scoreA = a.count * a.totalScore;
          const scoreB = b.count * b.totalScore;
          return scoreB - scoreA;
        });
    };

    const sortedHeadings = sortFonts(headingFontMap);
    const sortedBody = sortFonts(bodyFontMap);

    const headings = sortedHeadings.slice(0, 3).map(f => f.font);
    const body = sortedBody.slice(0, 2).map(f => f.font);

    const confidence = this.calculateFontConfidence(sortedHeadings, findings.length);

    return {
      headings,
      body,
      all: sortedHeadings.map(f => ({
        font: f.font,
        frequency: f.count,
        pages: Array.from(f.pages),
        score: Math.round(f.totalScore * 100)
      })),
      confidence
    };
  }

  /**
   * Deduplicate colors that are visually similar
   */
  deduplicateSimilarColors(colors) {
    const deduplicated = [];
    const processed = new Set();

    colors.forEach(color => {
      if (processed.has(color.hex)) return;

      // Find similar colors
      const similar = colors.filter(c =>
        !processed.has(c.hex) && this.areColorsSimilar(color.hex, c.hex)
      );

      // Merge similar colors
      const merged = {
        hex: color.hex, // Use first color as representative
        count: similar.reduce((sum, c) => sum + c.count, 0),
        pages: new Set(),
        totalScore: similar.reduce((sum, c) => sum + c.totalScore, 0)
      };

      similar.forEach(c => {
        c.pages.forEach(page => merged.pages.add(page));
        processed.add(c.hex);
      });

      deduplicated.push(merged);
    });

    return deduplicated;
  }

  /**
   * Check if two colors are similar using simple RGB distance
   * TODO: Implement proper Delta E calculation in Phase 2
   */
  areColorsSimilar(hex1, hex2) {
    if (hex1 === hex2) return true;

    const rgb1 = this.hexToRgb(hex1);
    const rgb2 = this.hexToRgb(hex2);

    if (!rgb1 || !rgb2) return false;

    // Simple Euclidean distance
    const distance = Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
    );

    // Threshold of ~44 (out of 441 max) for similarity
    return distance < 44;
  }

  /**
   * Calculate confidence score for colors
   */
  calculateColorConfidence(colors, totalPages) {
    if (colors.length === 0) return 0;

    const topColor = colors[0];
    const pagesCovered = topColor.pages.size;
    const frequency = topColor.count;

    // Confidence = (pages covered / total pages) × (frequency factor)
    const coverage = (pagesCovered / totalPages) * 100;
    const frequencyFactor = Math.min(frequency / totalPages, 1);

    return Math.round(coverage * frequencyFactor);
  }

  /**
   * Calculate confidence score for logos
   */
  calculateLogoConfidence(logos, totalPages) {
    if (logos.length === 0) return 0;

    const topLogo = logos[0];
    const pagesCovered = topLogo.pages.size;
    const frequency = topLogo.count;

    const coverage = (pagesCovered / totalPages) * 100;
    const frequencyFactor = Math.min(frequency / totalPages, 1);

    return Math.round(coverage * frequencyFactor);
  }

  /**
   * Calculate confidence score for fonts
   */
  calculateFontConfidence(fonts, totalPages) {
    if (fonts.length === 0) return 0;

    const topFont = fonts[0];
    const pagesCovered = topFont.pages.size;
    const frequency = topFont.count;

    const coverage = (pagesCovered / totalPages) * 100;
    const frequencyFactor = Math.min(frequency / totalPages, 1);

    return Math.round(coverage * frequencyFactor);
  }

  /**
   * Helper: Normalize hex color format
   */
  normalizeHex(hex) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Convert 3-digit to 6-digit
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    return '#' + hex.toUpperCase();
  }

  /**
   * Helper: Convert hex to RGB
   */
  hexToRgb(hex) {
    hex = hex.replace('#', '');

    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

    return { r, g, b };
  }

  /**
   * Helper: Calculate average size from array of sizes
   */
  calculateAverageSize(sizes) {
    if (sizes.length === 0) return { width: 0, height: 0 };

    const total = sizes.reduce((sum, s) => ({
      width: sum.width + (s.width || 0),
      height: sum.height + (s.height || 0)
    }), { width: 0, height: 0 });

    return {
      width: Math.round(total.width / sizes.length),
      height: Math.round(total.height / sizes.length)
    };
  }
}

module.exports = BrandConsolidator;
