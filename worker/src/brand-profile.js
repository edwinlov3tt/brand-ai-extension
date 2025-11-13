/**
 * Brand Profile Generation
 * Based on llm-synthesizer.js pattern
 */

import { validateBrandProfile } from './schema.js';

/**
 * Generate brand profile from page content using Claude API
 */
export async function generateBrandProfile(pageData, env, quickMode = false) {
  const { domain, url, title, description, text, headings, metadata } = pageData;

  // Build context for LLM
  const context = buildContext(domain, title, description, text, headings, metadata, quickMode);

  // Call Claude API
  const llmResponse = await callClaude(context, env.ANTHROPIC_API_KEY);

  // Parse and validate response
  const brandProfile = parseLLMResponse(llmResponse);

  // Validate against schema
  const validation = validateBrandProfile(brandProfile);
  if (!validation.valid) {
    console.warn('Brand profile validation failed:', validation.errors);
    // Apply fixes
    return fixBrandProfile(brandProfile);
  }

  return {
    ...brandProfile,
    metadata: {
      domain,
      url,
      generatedAt: Date.now(),
      quickMode
    }
  };
}

/**
 * Build context for Claude API
 */
function buildContext(domain, title, description, text, headings, metadata, quickMode) {
  // Limit text length for quick mode
  const maxTextLength = quickMode ? 10000 : 50000;
  const truncatedText = text ? text.substring(0, maxTextLength) : '';

  return {
    domain,
    title,
    description,
    text: truncatedText,
    headings: headings || [],
    metadata: metadata || {},
    quickMode
  };
}

/**
 * Call Claude API
 */
async function callClaude(context, apiKey) {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const prompt = buildPrompt(context);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      temperature: 0.3,
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
  return data.content[0].text;
}

/**
 * Build prompt for Claude
 */
function buildPrompt(context) {
  const headingsList = context.headings.length > 0
    ? context.headings.slice(0, 10).map(h => `- ${h}`).join('\n')
    : 'No headings extracted';

  return `You are a brand analysis expert. Analyze the following website content to create a comprehensive brand profile.

# WEBSITE DATA
Domain: ${context.domain}
Title: ${context.title || 'N/A'}
Description: ${context.description || 'N/A'}

## KEY HEADINGS
${headingsList}

## PAGE CONTENT
${context.text || 'No content extracted'}

# YOUR TASK
Create a structured brand profile in **valid JSON format** following this exact schema:

\`\`\`json
{
  "brand": {
    "name": "Brand Name",
    "tagline": "Their tagline or positioning statement",
    "story": "2-3 sentence brand origin/story if available",
    "mission": "Their mission statement if explicitly stated",
    "positioning": "1-2 sentences on how they position themselves in market",
    "valueProps": ["value prop 1", "value prop 2", "value prop 3"]
  },
  "voice": {
    "personality": ["trait1", "trait2", "trait3"],
    "toneSliders": {
      "formal": 0-100,
      "playful": 0-100,
      "premium": 0-100,
      "technical": 0-100,
      "energetic": 0-100
    },
    "lexicon": {
      "preferred": ["frequently used phrase 1", "phrase 2"],
      "avoid": ["words they don't use", "generic terms they avoid"]
    }
  },
  "audience": {
    "primary": "Description of primary target audience",
    "needs": ["need 1", "need 2", "need 3"],
    "painPoints": ["pain point 1", "pain point 2"]
  },
  "writingGuide": {
    "sentenceLength": "short|medium|long",
    "paragraphStyle": "Description of typical paragraph length and structure",
    "formatting": "How they use headlines, bullets, etc.",
    "avoid": ["Don't use emojis", "Avoid superlatives without proof"]
  }
}
\`\`\`

# INSTRUCTIONS
1. Analyze the page content for brand voice, tone, and positioning
2. Extract value propositions from the content
3. Identify target audience and problems they solve
4. Infer writing style from actual content (sentence length, formality, word choice)
5. Quote actual phrases from their content when identifying lexicon
6. Return ONLY the JSON object, no additional text or markdown formatting

Be specific and evidence-based.`;
}

/**
 * Parse LLM response
 */
function parseLLMResponse(response) {
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = response.trim();

  // Remove markdown code blocks
  jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*$/g, '');

  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse LLM response:', error);
    console.error('Response:', response);

    // Try to extract JSON from text
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        throw new Error('Could not parse brand profile JSON from LLM response');
      }
    }

    throw new Error('No valid JSON found in LLM response');
  }
}

/**
 * Fix brand profile with defaults
 */
function fixBrandProfile(profile) {
  return {
    brand: {
      name: profile.brand?.name || 'Unknown',
      tagline: profile.brand?.tagline || '',
      story: profile.brand?.story || '',
      mission: profile.brand?.mission || '',
      positioning: profile.brand?.positioning || '',
      valueProps: Array.isArray(profile.brand?.valueProps) ? profile.brand.valueProps : [],
    },
    voice: {
      personality: Array.isArray(profile.voice?.personality) ? profile.voice.personality : [],
      toneSliders: {
        formal: clamp(profile.voice?.toneSliders?.formal, 0, 100, 50),
        playful: clamp(profile.voice?.toneSliders?.playful, 0, 100, 50),
        premium: clamp(profile.voice?.toneSliders?.premium, 0, 100, 50),
        technical: clamp(profile.voice?.toneSliders?.technical, 0, 100, 50),
        energetic: clamp(profile.voice?.toneSliders?.energetic, 0, 100, 50),
      },
      lexicon: {
        preferred: Array.isArray(profile.voice?.lexicon?.preferred) ? profile.voice.lexicon.preferred : [],
        avoid: Array.isArray(profile.voice?.lexicon?.avoid) ? profile.voice.lexicon.avoid : [],
      },
    },
    audience: {
      primary: profile.audience?.primary || '',
      needs: Array.isArray(profile.audience?.needs) ? profile.audience.needs : [],
      painPoints: Array.isArray(profile.audience?.painPoints) ? profile.audience.painPoints : [],
    },
    writingGuide: {
      sentenceLength: profile.writingGuide?.sentenceLength || 'medium',
      paragraphStyle: profile.writingGuide?.paragraphStyle || '',
      formatting: profile.writingGuide?.formatting || '',
      avoid: Array.isArray(profile.writingGuide?.avoid) ? profile.writingGuide.avoid : [],
    },
  };
}

function clamp(value, min, max, defaultValue) {
  const num = Number(value);
  if (isNaN(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}
