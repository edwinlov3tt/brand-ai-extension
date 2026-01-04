/**
 * URL Scraping Handler
 *
 * Uses Firecrawl API to extract content from URLs for the Content Improver
 */

import { getCorsHeaders } from './cors.js';

/**
 * POST /api/scrape-url
 * Scrape content from a URL using Firecrawl
 */
export async function handleScrapeUrl(request, env) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const body = await request.json();
    const { url, extractType } = body;

    if (!url) {
      return jsonResponse({ error: 'Missing required field: url' }, 400, corsHeaders);
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return jsonResponse({ error: 'Invalid URL format' }, 400, corsHeaders);
    }

    // Check for API key
    if (!env.FIRECRAWL_API_KEY) {
      return jsonResponse({
        error: 'Scraping service not configured',
        message: 'Please add FIRECRAWL_API_KEY to your worker secrets'
      }, 503, corsHeaders);
    }

    // Call Firecrawl API
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Firecrawl error:', response.status, errorData);
      return jsonResponse({
        error: 'Failed to scrape URL',
        details: errorData.message || `HTTP ${response.status}`
      }, response.status === 402 ? 402 : 500, corsHeaders);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      return jsonResponse({
        error: 'Failed to extract content from URL',
        details: data.error || 'Unknown error'
      }, 500, corsHeaders);
    }

    // Extract relevant content based on extract type
    const scraped = data.data;
    const content = extractContentByType(scraped, extractType);

    return jsonResponse({
      success: true,
      url,
      content,
      metadata: {
        title: scraped.metadata?.title || '',
        description: scraped.metadata?.description || '',
        ogImage: scraped.metadata?.ogImage || '',
        sourceUrl: scraped.metadata?.sourceURL || url,
      },
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Scrape error:', error);
    return jsonResponse({
      error: 'Failed to scrape URL',
      details: error.message
    }, 500, corsHeaders);
  }
}

/**
 * Extract content based on the type of content being improved
 */
function extractContentByType(scraped, extractType) {
  const markdown = scraped.markdown || '';
  const title = scraped.metadata?.title || '';
  const description = scraped.metadata?.description || '';

  // Default content extraction
  const content = {
    title: title,
    text: markdown,
    content: markdown,
  };

  // Type-specific extraction
  switch (extractType) {
    case 'webpage':
    case 'blog-article':
      return {
        title: title,
        content: markdown,
        description: description,
      };

    case 'email':
      // Try to extract email-like content
      return {
        subjectLine: title,
        previewText: description,
        body: markdown,
      };

    case 'facebook-post':
    case 'linkedin-post':
    case 'instagram-post':
    case 'x-post':
      // Social posts - use first paragraph or description
      const firstParagraph = markdown.split('\n\n')[0] || markdown.substring(0, 500);
      return {
        postText: firstParagraph,
        caption: firstParagraph,
        tweet: firstParagraph.substring(0, 280),
      };

    case 'google-ad':
      // Try to extract headlines and descriptions
      const lines = markdown.split('\n').filter(l => l.trim());
      const headlines = lines.slice(0, 3).map(l => l.substring(0, 30));
      const descriptions = lines.slice(3, 5).map(l => l.substring(0, 90));
      return {
        headlines: headlines.join('\n'),
        descriptions: descriptions.join('\n'),
      };

    case 'meta-ad':
    case 'linkedin-ad':
    case 'pinterest-ad':
    case 'x-ad':
      return {
        primaryText: markdown.substring(0, 500),
        introText: markdown.substring(0, 500),
        headline: title,
        description: description,
        tweetText: markdown.substring(0, 280),
        cardHeadline: title,
      };

    default:
      return content;
  }
}

/**
 * Helper function to create JSON response
 */
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}
