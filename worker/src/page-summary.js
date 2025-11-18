/**
 * Page Summary Generation using Claude API
 * Generates structured summaries for product/service pages
 */

/**
 * Generate AI summary for a page (product or service)
 */
export async function generatePageSummary(pageData, env) {
  const { title, description, pageContent, type } = pageData;

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // Truncate content to avoid token limits (keep first 8000 chars)
  const truncatedContent = pageContent ? pageContent.substring(0, 8000) : '';

  const prompt = buildSummaryPrompt(title, description, truncatedContent, type);

  try {
    const response = await callClaudeAPI(prompt, env.ANTHROPIC_API_KEY);
    const summary = parseJSONResponse(response);

    return summary;
  } catch (error) {
    console.error('Error generating page summary:', error);
    throw error;
  }
}

/**
 * Build prompt for Claude API
 */
function buildSummaryPrompt(title, description, pageContent, type) {
  const typeLabel = type === 'product' ? 'Product' : 'Service';

  return `Analyze this ${typeLabel.toLowerCase()} page and extract structured information.

Page Title: ${title || 'Not provided'}
Meta Description: ${description || 'Not provided'}
Page Content: ${pageContent}

Extract and return a JSON object with this EXACT structure (no markdown code blocks, just pure JSON):
{
  "summary": "A 2-3 sentence overview of what this ${type} is and what it does",
  "valuePropositions": ["unique value prop 1", "unique value prop 2", "unique value prop 3"],
  "features": ["key feature 1", "key feature 2", "key feature 3", "key feature 4"],
  "benefits": ["customer benefit 1", "customer benefit 2", "customer benefit 3"],
  "targetAudience": "Description of the ideal customer or user",
  "tone": "The tone/style of the content (e.g., professional, casual, technical, friendly)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Guidelines:
- Extract value propositions that are UNIQUE selling points, not generic benefits
- Features should be specific capabilities or characteristics
- Benefits should focus on customer outcomes and results
- Target audience should be specific and actionable
- Keywords should be relevant for marketing and SEO
- Keep each array item concise (1-2 sentences max)

Return ONLY the JSON object, no additional text or formatting.`;
}

/**
 * Call Claude API
 */
async function callClaudeAPI(prompt, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      temperature: 0.5, // Lower temperature for more deterministic extraction
      messages: [{
        role: 'user',
        content: prompt,
      }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.content[0].text.trim();

  return text;
}

/**
 * Parse JSON response with fallback handling
 */
function parseJSONResponse(response) {
  // Clean markdown code blocks if present
  let cleaned = response.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/, '');
  cleaned = cleaned.replace(/\s*```$/, '');
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (!parsed.summary || !Array.isArray(parsed.valuePropositions)) {
      throw new Error('Invalid response structure');
    }

    return {
      summary: parsed.summary || '',
      valuePropositions: parsed.valuePropositions || [],
      features: parsed.features || [],
      benefits: parsed.benefits || [],
      targetAudience: parsed.targetAudience || '',
      tone: parsed.tone || '',
      keywords: parsed.keywords || [],
    };
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
    console.error('Response was:', cleaned);

    // Return fallback structure
    return {
      summary: 'Failed to generate summary. Please try again or edit manually.',
      valuePropositions: [],
      features: [],
      benefits: [],
      targetAudience: '',
      tone: '',
      keywords: [],
    };
  }
}

/**
 * Generate unique ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
