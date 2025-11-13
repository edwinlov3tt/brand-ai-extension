// LLM Synthesizer - Converts scraped data into structured brand profile
import { validateBrandProfile } from './brand-profile-schema.js';

export async function synthesizeBrandProfile(data, env) {
  const { domain, pages, reviews, quickMode = false } = data;

  // Prepare context for LLM
  const context = buildContext(domain, pages, reviews, quickMode);

  // Call LLM (Claude or GPT)
  const llmResponse = await callLLM(context, env);

  // Parse and validate
  const brandProfile = parseLLMResponse(llmResponse);

  // Validate against schema
  const validation = validateBrandProfile(brandProfile);
  if (!validation.valid) {
    console.warn('Brand profile validation failed:', validation.errors);
    // Return with fixes
    return fixBrandProfile(brandProfile);
  }

  return brandProfile;
}

function buildContext(domain, pages, reviews, quickMode) {
  // Select top pages by priority
  const topPages = pages
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, quickMode ? 5 : 10);

  // Build page summaries
  const pageSummaries = topPages.map(page => `
**${page.pageType.toUpperCase()}** (${page.url})
Title: ${page.title || 'N/A'}
Description: ${page.description || 'N/A'}
Content: ${(page.text || '').substring(0, 1000)}${page.text?.length > 1000 ? '...' : ''}
`).join('\n\n');

  // Build review summary
  let reviewSummary = '';
  if (reviews && reviews.totalReviews > 0) {
    reviewSummary = `
## CUSTOMER REVIEWS (${reviews.totalReviews} total)

**Overall Rating:** ${reviews.overall.rating}/5

**Google Reviews:** ${reviews.google?.count || 0} reviews, ${reviews.google?.rating || 0}/5
Top themes: ${reviews.google?.themes?.join(', ') || 'N/A'}

**Yelp Reviews:** ${reviews.yelp?.count || 0} reviews, ${reviews.yelp?.rating || 0}/5
Top themes: ${reviews.yelp?.themes?.join(', ') || 'N/A'}

**Facebook Reviews:** ${reviews.facebook?.count || 0} reviews, ${reviews.facebook?.rating || 0}/5
Top themes: ${reviews.facebook?.themes?.join(', ') || 'N/A'}

**Customer Strengths:** ${reviews.strengths?.join(', ') || 'N/A'}
**Customer Concerns:** ${reviews.concerns?.join(', ') || 'N/A'}
`;
  }

  return {
    domain,
    pageSummaries,
    reviewSummary,
    quickMode,
  };
}

async function callLLM(context, env) {
  // Try Claude first (Anthropic), fallback to GPT (OpenAI)
  if (env.ANTHROPIC_API_KEY) {
    return await callClaude(context, env.ANTHROPIC_API_KEY);
  } else if (env.OPENAI_API_KEY) {
    return await callGPT(context, env.OPENAI_API_KEY);
  } else {
    throw new Error('No LLM API key configured (ANTHROPIC_API_KEY or OPENAI_API_KEY)');
  }
}

async function callClaude(context, apiKey) {
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

async function callGPT(context, apiKey) {
  const prompt = buildPrompt(context);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [{
        role: 'user',
        content: prompt,
      }],
      max_tokens: 4096,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GPT API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function buildPrompt(context) {
  return `You are a brand analysis expert. Analyze the following website data and customer reviews to create a comprehensive brand profile.

# WEBSITE DATA
Domain: ${context.domain}

## KEY PAGES
${context.pageSummaries}

${context.reviewSummary}

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
1. Analyze the page content for brand voice, tone, positioning
2. Extract their value propositions from service/about pages
3. Identify their target audience and what problems they solve
4. ${context.reviewSummary ? 'Incorporate customer feedback to validate brand strengths' : 'Focus on website content'}
5. Infer writing style from actual content (sentence length, formality, word choice)
6. Return ONLY the JSON object, no additional text

Be specific and evidence-based. Quote actual phrases from their content when identifying lexicon.`;
}

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

function fixBrandProfile(profile) {
  // Apply defaults for missing/invalid fields
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