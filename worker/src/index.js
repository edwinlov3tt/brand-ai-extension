/**
 * Brand Inspector Cloudflare Worker
 * Main entry point for API endpoints
 */

import { generateBrandProfile } from './brand-profile.js';
import { generateAdCopy } from './ad-copy.js';
import { AD_TACTICS, getTacticsByCategory } from './tactics.js';
import { serializeBrandProfile, deserializeBrandProfile } from './schema.js';
import { generatePageSummary, generateId } from './page-summary.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for Chrome extension
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS request for CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API Route handling
      if (path === '/api/brand-profile' && request.method === 'POST') {
        return await handleGenerateBrandProfile(request, env, corsHeaders);
      }

      if (path.startsWith('/api/brand-profile/') && request.method === 'GET') {
        const domain = path.split('/')[3];
        return await handleGetBrandProfile(domain, env, corsHeaders);
      }

      if (path.startsWith('/api/brand-profile/') && request.method === 'PUT') {
        const domain = path.split('/')[3];
        return await handleUpdateBrandProfile(domain, request, env, corsHeaders);
      }

      if (path === '/api/generate-ad-copy' && request.method === 'POST') {
        return await handleGenerateAdCopy(request, env, corsHeaders);
      }

      if (path === '/api/tactics' && request.method === 'GET') {
        return handleGetTactics(corsHeaders);
      }

      if (path.match(/^\/api\/ad-copy\/[\w-]+\/rate$/) && request.method === 'POST') {
        const id = path.split('/')[3];
        return await handleRateAdCopy(id, request, env, corsHeaders);
      }

      if (path === '/api/brands' && request.method === 'GET') {
        return await handleGetBrands(env, corsHeaders);
      }

      if (path.startsWith('/api/ad-copies/') && request.method === 'GET') {
        const domain = path.split('/')[3];
        return await handleGetAdCopies(domain, env, corsHeaders);
      }

      // Pages API endpoints
      if (path === '/api/pages' && request.method === 'POST') {
        return await handleSavePage(request, env, corsHeaders);
      }

      if (path.match(/^\/api\/pages\/[^\/]+$/) && request.method === 'GET') {
        const brandProfileId = path.split('/')[3];
        return await handleGetPages(brandProfileId, env, corsHeaders);
      }

      if (path.match(/^\/api\/pages\/[^\/]+\/edit$/) && request.method === 'PUT') {
        const id = path.split('/')[3];
        return await handleUpdatePage(id, request, env, corsHeaders);
      }

      if (path.match(/^\/api\/pages\/[^\/]+$/) && request.method === 'DELETE') {
        const id = path.split('/')[3];
        return await handleDeletePage(id, env, corsHeaders);
      }

      // 404 for unknown routes
      return jsonResponse({ error: 'Not found' }, 404, corsHeaders);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse(
        { error: error.message || 'Internal server error' },
        500,
        corsHeaders
      );
    }
  },
};

/**
 * POST /api/brand-profile
 * Generate brand profile from page content
 */
async function handleGenerateBrandProfile(request, env, corsHeaders) {
  const body = await request.json();
  const { domain, url, title, description, text, headings, metadata, quickMode } = body;

  if (!domain || !text) {
    return jsonResponse({ error: 'Missing required fields: domain, text' }, 400, corsHeaders);
  }

  // Generate profile using Claude
  const brandProfile = await generateBrandProfile(
    { domain, url, title, description, text, headings, metadata },
    env,
    quickMode
  );

  // Save to D1
  const serialized = serializeBrandProfile(brandProfile);
  await env.DB.prepare(`
    INSERT INTO brand_profiles (
      id, domain, name, tagline, story, mission, positioning,
      value_props, voice_personality, tone_sliders,
      lexicon_preferred, lexicon_avoid, audience_primary,
      audience_needs, audience_pain_points, writing_guide
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(domain) DO UPDATE SET
      name = excluded.name,
      tagline = excluded.tagline,
      story = excluded.story,
      mission = excluded.mission,
      positioning = excluded.positioning,
      value_props = excluded.value_props,
      voice_personality = excluded.voice_personality,
      tone_sliders = excluded.tone_sliders,
      lexicon_preferred = excluded.lexicon_preferred,
      lexicon_avoid = excluded.lexicon_avoid,
      audience_primary = excluded.audience_primary,
      audience_needs = excluded.audience_needs,
      audience_pain_points = excluded.audience_pain_points,
      writing_guide = excluded.writing_guide,
      updated_at = strftime('%s', 'now')
  `).bind(
    serialized.id, serialized.domain, serialized.name, serialized.tagline,
    serialized.story, serialized.mission, serialized.positioning,
    serialized.value_props, serialized.voice_personality, serialized.tone_sliders,
    serialized.lexicon_preferred, serialized.lexicon_avoid, serialized.audience_primary,
    serialized.audience_needs, serialized.audience_pain_points, serialized.writing_guide
  ).run();

  // Get the actual profile from the database (to get the correct ID in case of conflict)
  const savedProfile = await env.DB.prepare(
    'SELECT * FROM brand_profiles WHERE domain = ?'
  ).bind(serialized.domain).first();

  // Deserialize and return the actual saved profile with correct ID
  const profileWithCorrectId = deserializeBrandProfile(savedProfile);

  return jsonResponse(profileWithCorrectId, 200, corsHeaders);
}

/**
 * GET /api/brand-profile/:domain
 * Retrieve saved brand profile
 */
async function handleGetBrandProfile(domain, env, corsHeaders) {
  const result = await env.DB.prepare(
    'SELECT * FROM brand_profiles WHERE domain = ?'
  ).bind(domain).first();

  if (!result) {
    return jsonResponse({ error: 'Brand profile not found' }, 404, corsHeaders);
  }

  const brandProfile = deserializeBrandProfile(result);
  return jsonResponse(brandProfile, 200, corsHeaders);
}

/**
 * POST /api/generate-ad-copy
 * Generate ad copy variations
 */
async function handleGenerateAdCopy(request, env, corsHeaders) {
  const body = await request.json();
  const { brandProfileId, domain, tactic, campaignObjective, variations = 3, includeEmojis = false, emojiInstructions, pageContext } = body;

  if (!tactic || !campaignObjective) {
    return jsonResponse({ error: 'Missing required fields: tactic, campaignObjective' }, 400, corsHeaders);
  }

  // Get brand profile
  let brandProfile;
  if (brandProfileId) {
    const result = await env.DB.prepare(
      'SELECT * FROM brand_profiles WHERE id = ?'
    ).bind(brandProfileId).first();
    if (result) {
      brandProfile = deserializeBrandProfile(result);
    }
  } else if (domain) {
    const result = await env.DB.prepare(
      'SELECT * FROM brand_profiles WHERE domain = ?'
    ).bind(domain).first();
    if (result) {
      brandProfile = deserializeBrandProfile(result);
    }
  }

  if (!brandProfile) {
    return jsonResponse({ error: 'Brand profile not found' }, 404, corsHeaders);
  }

  // Generate ad copy (supports both single and multi-component tactics)
  const adCopies = await generateAdCopy(
    brandProfile,
    tactic,
    campaignObjective,
    Math.min(variations, 5), // Max 5 variations
    env,
    includeEmojis,
    emojiInstructions,
    pageContext  // Pass pageContext to ad copy generation
  );

  // Save to D1 (handle both single and multi-component results)
  if (Array.isArray(adCopies)) {
    // Single component tactics - array of variations
    for (const copy of adCopies) {
      await env.DB.prepare(`
        INSERT INTO ad_copies (
          id, brand_profile_id, tactic, campaign_objective,
          copy_text, character_count, word_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        copy.id,
        brandProfile.id,
        copy.tactic,
        copy.objective,
        copy.text,
        copy.charCount,
        copy.wordCount
      ).run();
    }
  } else if (adCopies.multiComponent) {
    // Multi-component tactics - save as JSON
    await env.DB.prepare(`
      INSERT INTO ad_copies (
        id, brand_profile_id, tactic, campaign_objective,
        copy_text, character_count, word_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      adCopies.id,
      brandProfile.id,
      adCopies.tactic,
      adCopies.objective,
      JSON.stringify(adCopies.components), // Store as JSON string
      0, // Not applicable for multi-component
      0  // Not applicable for multi-component
    ).run();
  }

  return jsonResponse({ adCopies }, 200, corsHeaders);
}

/**
 * GET /api/tactics
 * Get all available ad tactics
 */
function handleGetTactics(corsHeaders) {
  const tactics = Object.values(AD_TACTICS).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    maxChars: t.maxChars,
    maxWords: t.maxWords,
    category: t.category
  }));

  return jsonResponse({ tactics }, 200, corsHeaders);
}

/**
 * POST /api/ad-copy/:id/rate
 * Rate ad copy (thumbs up/down)
 */
async function handleRateAdCopy(id, request, env, corsHeaders) {
  const body = await request.json();
  const { rating } = body; // 1 or -1

  if (rating !== 1 && rating !== -1) {
    return jsonResponse({ error: 'Rating must be 1 (up) or -1 (down)' }, 400, corsHeaders);
  }

  await env.DB.prepare(
    'UPDATE ad_copies SET rating = ? WHERE id = ?'
  ).bind(rating, id).run();

  return jsonResponse({ success: true }, 200, corsHeaders);
}

/**
 * GET /api/brands
 * List all saved brand profiles
 */
async function handleGetBrands(env, corsHeaders) {
  const result = await env.DB.prepare(`
    SELECT id, domain, name, tagline, created_at, updated_at
    FROM brand_profiles
    ORDER BY updated_at DESC
  `).all();

  const brands = result.results || [];
  return jsonResponse({ brands }, 200, corsHeaders);
}

/**
 * PUT /api/brand-profile/:domain
 * Update brand profile
 */
async function handleUpdateBrandProfile(domain, request, env, corsHeaders) {
  const body = await request.json();
  const { profile } = body;

  if (!profile) {
    return jsonResponse({ error: 'Missing profile data' }, 400, corsHeaders);
  }

  const serialized = serializeBrandProfile(profile);
  await env.DB.prepare(`
    UPDATE brand_profiles SET
      name = ?, tagline = ?, story = ?, mission = ?, positioning = ?,
      value_props = ?, voice_personality = ?, tone_sliders = ?,
      lexicon_preferred = ?, lexicon_avoid = ?, audience_primary = ?,
      audience_needs = ?, audience_pain_points = ?, writing_guide = ?,
      updated_at = ?
    WHERE domain = ?
  `).bind(
    serialized.name, serialized.tagline, serialized.story, serialized.mission, serialized.positioning,
    serialized.value_props, serialized.voice_personality, serialized.tone_sliders,
    serialized.lexicon_preferred, serialized.lexicon_avoid, serialized.audience_primary,
    serialized.audience_needs, serialized.audience_pain_points, serialized.writing_guide,
    Date.now(), domain
  ).run();

  return jsonResponse({ success: true, profile }, 200, corsHeaders);
}

/**
 * GET /api/ad-copies/:domain
 * Get all ad copies for a brand
 */
async function handleGetAdCopies(domain, env, corsHeaders) {
  const result = await env.DB.prepare(`
    SELECT
      ac.id, ac.tactic, ac.campaign_objective, ac.copy_text,
      ac.character_count, ac.word_count, ac.rating, ac.created_at
    FROM ad_copies ac
    JOIN brand_profiles bp ON ac.brand_profile_id = bp.id
    WHERE bp.domain = ?
    ORDER BY ac.created_at DESC
  `).bind(domain).all();

  const adCopies = (result.results || []).map(row => ({
    id: row.id,
    tactic: row.tactic,
    objective: row.campaign_objective,
    text: row.copy_text,
    charCount: row.character_count,
    wordCount: row.word_count,
    rating: row.rating,
    createdAt: row.created_at
  }));

  return jsonResponse({ adCopies }, 200, corsHeaders);
}

/**
 * POST /api/pages
 * Save a new page (product/service) with AI-generated summary
 */
async function handleSavePage(request, env, corsHeaders) {
  const body = await request.json();
  const { brandProfileId, url, title, description, metaImage, type, pageContent } = body;

  if (!brandProfileId || !url || !type || !pageContent) {
    return jsonResponse({ error: 'Missing required fields: brandProfileId, url, type, pageContent' }, 400, corsHeaders);
  }

  if (type !== 'product' && type !== 'service') {
    return jsonResponse({ error: 'Type must be "product" or "service"' }, 400, corsHeaders);
  }

  // Check page limit (10 pages per brand)
  const countResult = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM pages WHERE brand_profile_id = ?'
  ).bind(brandProfileId).first();

  if (countResult && countResult.count >= 10) {
    return jsonResponse({ error: 'Maximum of 10 pages per brand profile' }, 400, corsHeaders);
  }

  // Generate AI summary
  let summary;
  try {
    summary = await generatePageSummary({ title, description, pageContent, type }, env);
  } catch (error) {
    console.error('Failed to generate summary:', error);
    // Use fallback summary if AI generation fails
    summary = {
      summary: 'Summary generation failed. Please edit manually.',
      valuePropositions: [],
      features: [],
      benefits: [],
      targetAudience: '',
      tone: '',
      keywords: []
    };
  }

  // Generate unique ID
  const id = generateId();

  // Save to database
  await env.DB.prepare(`
    INSERT INTO pages (
      id, brand_profile_id, url, title, description, meta_image, type,
      summary, value_propositions, features, benefits, target_audience, tone, keywords,
      page_content
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    brandProfileId,
    url,
    title || '',
    description || '',
    metaImage || '',
    type,
    summary.summary,
    JSON.stringify(summary.valuePropositions),
    JSON.stringify(summary.features),
    JSON.stringify(summary.benefits),
    summary.targetAudience,
    summary.tone,
    JSON.stringify(summary.keywords),
    pageContent
  ).run();

  // Return saved page with summary
  const page = {
    id,
    brandProfileId,
    url,
    title: title || '',
    description: description || '',
    metaImage: metaImage || '',
    type,
    summary: summary.summary,
    valuePropositions: summary.valuePropositions,
    features: summary.features,
    benefits: summary.benefits,
    targetAudience: summary.targetAudience,
    tone: summary.tone,
    keywords: summary.keywords,
    createdAt: Date.now()
  };

  return jsonResponse({ page }, 200, corsHeaders);
}

/**
 * GET /api/pages/:brandProfileId
 * Get all pages for a brand profile
 */
async function handleGetPages(brandProfileId, env, corsHeaders) {
  const result = await env.DB.prepare(`
    SELECT
      id, brand_profile_id, url, title, description, meta_image, type,
      summary, value_propositions, features, benefits, target_audience, tone, keywords,
      created_at, updated_at
    FROM pages
    WHERE brand_profile_id = ?
    ORDER BY created_at DESC
  `).bind(brandProfileId).all();

  const pages = (result.results || []).map(row => ({
    id: row.id,
    brandProfileId: row.brand_profile_id,
    url: row.url,
    title: row.title,
    description: row.description,
    metaImage: row.meta_image,
    type: row.type,
    summary: row.summary,
    valuePropositions: row.value_propositions ? JSON.parse(row.value_propositions) : [],
    features: row.features ? JSON.parse(row.features) : [],
    benefits: row.benefits ? JSON.parse(row.benefits) : [],
    targetAudience: row.target_audience,
    tone: row.tone,
    keywords: row.keywords ? JSON.parse(row.keywords) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));

  return jsonResponse({ pages }, 200, corsHeaders);
}

/**
 * PUT /api/pages/:id/edit
 * Update page summary (manual edits)
 */
async function handleUpdatePage(id, request, env, corsHeaders) {
  const body = await request.json();
  const { summary, valuePropositions, features, benefits, targetAudience, tone, keywords } = body;

  if (!summary) {
    return jsonResponse({ error: 'Missing required field: summary' }, 400, corsHeaders);
  }

  // Update database
  await env.DB.prepare(`
    UPDATE pages SET
      summary = ?,
      value_propositions = ?,
      features = ?,
      benefits = ?,
      target_audience = ?,
      tone = ?,
      keywords = ?,
      updated_at = strftime('%s', 'now')
    WHERE id = ?
  `).bind(
    summary,
    JSON.stringify(valuePropositions || []),
    JSON.stringify(features || []),
    JSON.stringify(benefits || []),
    targetAudience || '',
    tone || '',
    JSON.stringify(keywords || []),
    id
  ).run();

  return jsonResponse({ success: true }, 200, corsHeaders);
}

/**
 * DELETE /api/pages/:id
 * Delete a page
 */
async function handleDeletePage(id, env, corsHeaders) {
  await env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true }, 200, corsHeaders);
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
