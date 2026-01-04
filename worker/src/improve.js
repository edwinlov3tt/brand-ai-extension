/**
 * Content Improvement Handler
 *
 * Generates improved versions of existing content using Claude
 * with SSE streaming for real-time output
 */

import Anthropic from '@anthropic-ai/sdk';
import { getCorsHeaders } from './cors.js';
import { deserializeBrandProfile } from './schema.js';

/**
 * POST /api/improve-content
 * Generate improved content with SSE streaming
 */
export async function handleImproveContent(request, env, ctx) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const body = await request.json();
    const {
      contentType,
      originalContent,
      improvements,
      brandProfileId,
      variantCount = 3,
    } = body;

    if (!contentType || !originalContent || !improvements) {
      return jsonResponse({
        error: 'Missing required fields: contentType, originalContent, improvements'
      }, 400, corsHeaders);
    }

    // Get brand profile if provided
    let brandProfile = null;
    if (brandProfileId) {
      const result = await env.DB.prepare(
        'SELECT * FROM brand_profiles WHERE id = ?'
      ).bind(brandProfileId).first();

      if (result) {
        brandProfile = deserializeBrandProfile(result);
      }
    }

    // Build the improvement prompt
    const systemPrompt = buildSystemPrompt(contentType, brandProfile);
    const userPrompt = buildUserPrompt(originalContent, improvements, variantCount, contentType);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const client = new Anthropic({
            apiKey: env.ANTHROPIC_API_KEY,
          });

          // Keep track of full response for parsing
          let fullResponse = '';

          // Create streaming request
          const streamResponse = client.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          });

          // Send keepalive to prevent timeout
          const keepalive = setInterval(() => {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          }, 15000);

          // Handle stream events
          streamResponse.on('text', (text) => {
            fullResponse += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`));
          });

          // Wait for completion
          const finalMessage = await streamResponse.finalMessage();

          clearInterval(keepalive);

          // Parse the full response to extract variants
          const variants = parseImprovedContent(fullResponse, contentType, variantCount);

          // Send the parsed variants
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            variants,
            usage: finalMessage.usage,
          })}\n\n`));

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

        } catch (error) {
          console.error('Improve content error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: error.message
          })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('Improve content error:', error);
    return jsonResponse({
      error: 'Failed to improve content',
      details: error.message
    }, 500, corsHeaders);
  }
}

/**
 * Get current date context for time-sensitive content
 */
function getDateContext() {
  const now = new Date();
  return `Current Date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Current Year: ${now.getFullYear()}

Note: Ensure any date references in the content are accurate. For time-sensitive content, update outdated year references to be current.`;
}

/**
 * Build the system prompt based on content type and brand profile
 */
function buildSystemPrompt(contentType, brandProfile) {
  let prompt = `You are an expert copywriter and content strategist. Your task is to improve existing marketing content while maintaining its core message and purpose.

${getDateContext()}

You excel at:
- Fixing grammar, spelling, and punctuation errors
- Adjusting tone of voice to match brand guidelines
- Expanding or condensing content while preserving key messages
- Making content more engaging and compelling
- Updating outdated date references to be current
`;

  if (brandProfile) {
    prompt += `\n## Brand Context

**Brand Name:** ${brandProfile.name}
**Tagline:** ${brandProfile.tagline || 'Not specified'}

**Brand Voice:** ${(brandProfile.voice_personality || []).join(', ') || 'Professional and friendly'}

**Preferred Terms:** ${(brandProfile.lexicon_preferred || []).join(', ') || 'None specified'}

**Terms to Avoid:** ${(brandProfile.lexicon_avoid || []).join(', ') || 'None specified'}

Ensure all improvements align with this brand's voice and style guidelines.
`;
  }

  prompt += `\n## Content Type: ${getContentTypeName(contentType)}

Generate improvements appropriate for this specific content format and platform.`;

  return prompt;
}

/**
 * Build the user prompt with original content and improvement instructions
 */
function buildUserPrompt(originalContent, improvements, variantCount, contentType) {
  // Format original content
  let contentDescription = '';
  for (const [field, value] of Object.entries(originalContent)) {
    if (value && typeof value === 'string' && value.trim()) {
      const fieldLabel = field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      contentDescription += `**${fieldLabel}:**\n${value}\n\n`;
    }
  }

  // Build improvement instructions
  let improvementInstructions = [];

  if (improvements.fixGrammar) {
    improvementInstructions.push('- Fix all spelling, grammar, and punctuation errors');
  }

  if (improvements.changeTone) {
    const toneDescriptions = {
      'neutral': 'Neutral and matter-of-fact',
      'advisor': 'Authoritative, confident, and expert',
      'motivator': 'Enthusiastic, inspiring, and action-oriented',
      'entertainer': 'Fun, playful, and engaging',
      'empathetic': 'Warm, caring, and understanding',
      'trendsetter': 'Modern, social media-savvy, and current',
      'innovator': 'Forward-thinking and visionary',
      'educator': 'Clear, informative, and helpful',
    };
    const toneDesc = toneDescriptions[improvements.changeTone] || improvements.changeTone;
    improvementInstructions.push(`- Change the tone of voice to be: ${toneDesc}`);
  }

  if (improvements.makeLength === 'shorter') {
    improvementInstructions.push('- Make the content more concise while preserving key messages');
  } else if (improvements.makeLength === 'longer') {
    improvementInstructions.push('- Expand the content with additional details and persuasive elements');
  }

  if (improvements.customInstructions && improvements.customInstructions.trim()) {
    improvementInstructions.push(`- Custom instructions: ${improvements.customInstructions.trim()}`);
  }

  const prompt = `## Original Content to Improve

${contentDescription}

## Improvement Instructions

${improvementInstructions.join('\n')}

## Output Format

Generate ${variantCount} improved version${variantCount > 1 ? 's' : ''} of this content.

For each variant, output in this exact format:

---VARIANT 1---
${getFieldsForContentType(contentType)}
---END VARIANT 1---

${variantCount > 1 ? `---VARIANT 2---
${getFieldsForContentType(contentType)}
---END VARIANT 2---` : ''}

${variantCount > 2 ? `---VARIANT 3---
${getFieldsForContentType(contentType)}
---END VARIANT 3---` : ''}

Ensure each variant is distinctly different while meeting all improvement requirements.`;

  return prompt;
}

/**
 * Get field names for a specific content type
 */
function getFieldsForContentType(contentType) {
  const fieldMappings = {
    'email': '[Subject Line]\n[your improved subject line]\n\n[Preview Text]\n[your improved preview text]\n\n[Body]\n[your improved email body]',
    'facebook-post': '[Post]\n[your improved post text]',
    'instagram-post': '[Caption]\n[your improved caption]',
    'linkedin-post': '[Post]\n[your improved post text]',
    'x-post': '[Post]\n[your improved post text - max 280 characters]',
    'google-ad': '[Headlines]\n[3 headlines, one per line, max 30 chars each]\n\n[Descriptions]\n[2 descriptions, one per line, max 90 chars each]',
    'meta-ad': '[Primary Text]\n[your improved primary text]\n\n[Headline]\n[your improved headline]\n\n[Description]\n[your improved description]',
    'linkedin-ad': '[Intro Text]\n[your improved intro text]\n\n[Headline]\n[your improved headline]',
    'pinterest-ad': '[Title]\n[your improved pin title]\n\n[Description]\n[your improved description]',
    'x-ad': '[Tweet Text]\n[your improved tweet text]\n\n[Card Headline]\n[your improved card headline]',
    'webpage': '[Content]\n[your improved webpage content]',
    'blog-article': '[Title]\n[your improved title]\n\n[Content]\n[your improved article content]',
    'white-paper': '[Title]\n[your improved title]\n\n[Content]\n[your improved content]',
  };

  return fieldMappings[contentType] || '[Content]\n[your improved content]';
}

/**
 * Parse the improved content from Claude's response
 */
function parseImprovedContent(response, contentType, variantCount) {
  const variants = [];

  // Extract each variant using regex
  for (let i = 1; i <= variantCount; i++) {
    const variantRegex = new RegExp(`---VARIANT ${i}---([\\s\\S]*?)---END VARIANT ${i}---`, 'i');
    const match = response.match(variantRegex);

    if (match) {
      const variantContent = match[1].trim();
      const parsed = parseVariantContent(variantContent, contentType);
      variants.push({
        id: `variant-${i}`,
        ...parsed,
      });
    }
  }

  // If no structured variants found, try to create one from the full response
  if (variants.length === 0 && response.trim()) {
    variants.push({
      id: 'variant-1',
      content: response.trim(),
    });
  }

  return variants;
}

/**
 * Parse individual variant content into structured fields
 */
function parseVariantContent(content, contentType) {
  const result = {};

  // Generic field extraction
  const fieldPatterns = [
    { key: 'subjectLine', pattern: /\[Subject Line\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'previewText', pattern: /\[Preview Text\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'body', pattern: /\[Body\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'postText', pattern: /\[Post\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'caption', pattern: /\[Caption\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'headlines', pattern: /\[Headlines\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'descriptions', pattern: /\[Descriptions\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'primaryText', pattern: /\[Primary Text\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'headline', pattern: /\[Headline\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'description', pattern: /\[Description\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'introText', pattern: /\[Intro Text\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'title', pattern: /\[Title\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'tweetText', pattern: /\[Tweet Text\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'cardHeadline', pattern: /\[Card Headline\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
    { key: 'content', pattern: /\[Content\]\s*([\s\S]*?)(?=\[|\n---|\n\n\[|$)/i },
  ];

  for (const { key, pattern } of fieldPatterns) {
    const match = content.match(pattern);
    if (match) {
      result[key] = match[1].trim();
    }
  }

  // If no fields matched, use the whole content
  if (Object.keys(result).length === 0) {
    result.content = content;
  }

  return result;
}

/**
 * Get human-readable content type name
 */
function getContentTypeName(contentType) {
  const names = {
    'webpage': 'Webpage',
    'blog-article': 'Blog/Article',
    'facebook-post': 'Facebook Post',
    'instagram-post': 'Instagram Post',
    'linkedin-post': 'LinkedIn Post',
    'x-post': 'X (Twitter) Post',
    'google-ad': 'Google Ad',
    'meta-ad': 'Meta Ad',
    'linkedin-ad': 'LinkedIn Ad',
    'pinterest-ad': 'Pinterest Ad',
    'x-ad': 'X (Twitter) Ad',
    'email': 'Email',
    'white-paper': 'White Paper/Research',
    'other': 'Other Content',
  };
  return names[contentType] || contentType;
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
