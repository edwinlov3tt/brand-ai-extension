/**
 * Brand Inspector Cloudflare Worker
 * Main entry point for API endpoints
 */

import { generateBrandProfile } from './brand-profile.js';
import { generateAdCopy } from './ad-copy.js';
import { AD_TACTICS, getTacticsByCategory } from './tactics.js';
import { serializeBrandProfile, deserializeBrandProfile } from './schema.js';
import { generatePageSummary, generateId } from './page-summary.js';
import {
  handleStreamChat,
  createConversation,
  listConversations,
  getConversation,
  getConversationMessages,
  updateConversation,
  deleteConversation,
} from './chat.js';
import {
  handleImprovePrompt,
  handleGenerateAnswer,
  handleGenerate,
} from './context-agent.js';
import {
  handleUpload,
  handleDeleteUpload,
  handleListUploads,
  handleLinkUploads,
  handleServeFile,
} from './uploads.js';
import { handleScheduled } from './cleanup.js';
import { getCorsHeaders, handleOptions } from './cors.js';
import { listAgents } from './agents/index.js';
import { handleScrapeUrl } from './scrape.js';
import { handleImproveContent } from './improve.js';
import { handleGenerateAudience, handleDetectTone } from './ai-helpers.js';
import {
  handleListHistory,
  handleGetHistoryItem,
  handleSaveHistory,
  handleDeleteHistory
} from './history.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Get CORS headers based on request origin
    const corsHeaders = getCorsHeaders(request);

    // Handle OPTIONS request for CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
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

      // Alias for brand-profiles (used by webapp generate page)
      if (path === '/api/brand-profiles' && request.method === 'GET') {
        return await handleGetBrands(env, corsHeaders);
      }

      // GET /api/brand-profiles/:id - Get brand profile by ID
      if (path.match(/^\/api\/brand-profiles\/[^\/]+$/) && request.method === 'GET') {
        const brandId = path.split('/')[3];
        return await handleGetBrandProfileById(brandId, env, corsHeaders);
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

      // =====================================================
      // CHAT API ENDPOINTS
      // =====================================================

      // POST /api/chat - Stream chat response (SSE)
      if (path === '/api/chat' && request.method === 'POST') {
        return await handleStreamChat(request, env, ctx);
      }

      // POST /api/conversations - Create new conversation
      if (path === '/api/conversations' && request.method === 'POST') {
        return await createConversation(request, env);
      }

      // GET /api/conversations/:brandProfileId - List conversations for brand
      if (path.match(/^\/api\/conversations\/[^\/]+$/) && request.method === 'GET') {
        const brandProfileId = path.split('/')[3];
        return await listConversations(request, env, brandProfileId);
      }

      // GET /api/conversations/:id/messages - Get messages for conversation
      if (path.match(/^\/api\/conversations\/[^\/]+\/messages$/) && request.method === 'GET') {
        const conversationId = path.split('/')[3];
        return await getConversationMessages(request, env, conversationId);
      }

      // GET /api/conversations/:id - Get single conversation metadata (for agent restoration)
      if (path.match(/^\/api\/conversations\/[^\/]+$/) && request.method === 'GET') {
        const conversationId = path.split('/')[3];
        return await getConversation(request, env, conversationId);
      }

      // PUT /api/conversations/:id - Update conversation (title, pin)
      if (path.match(/^\/api\/conversations\/[^\/]+$/) && request.method === 'PUT') {
        const conversationId = path.split('/')[3];
        return await updateConversation(request, env, conversationId);
      }

      // DELETE /api/conversations/:id - Delete conversation
      if (path.match(/^\/api\/conversations\/[^\/]+$/) && request.method === 'DELETE') {
        const conversationId = path.split('/')[3];
        return await deleteConversation(request, env, conversationId);
      }

      // =====================================================
      // CONTEXT AGENT & GENERATION API ENDPOINTS
      // =====================================================

      // POST /api/improve-prompt - Generate questions to improve prompt
      if (path === '/api/improve-prompt' && request.method === 'POST') {
        return await handleImprovePrompt(request, env);
      }

      // POST /api/generate-answer - Auto-generate answer to context question
      if (path === '/api/generate-answer' && request.method === 'POST') {
        return await handleGenerateAnswer(request, env);
      }

      // POST /api/generate - Main content generation with SSE streaming
      if (path === '/api/generate' && request.method === 'POST') {
        return await handleGenerate(request, env, ctx);
      }

      // =====================================================
      // CONTENT IMPROVER API ENDPOINTS
      // =====================================================

      // POST /api/scrape-url - Scrape content from a URL
      if (path === '/api/scrape-url' && request.method === 'POST') {
        return await handleScrapeUrl(request, env);
      }

      // POST /api/improve-content - Generate improved content with SSE streaming
      if (path === '/api/improve-content' && request.method === 'POST') {
        return await handleImproveContent(request, env, ctx);
      }

      // =====================================================
      // FILE UPLOAD API ENDPOINTS
      // =====================================================

      // POST /api/uploads - Upload a file
      if (path === '/api/uploads' && request.method === 'POST') {
        return await handleUpload(request, env);
      }

      // POST /api/uploads/link - Link session uploads to conversation
      if (path === '/api/uploads/link' && request.method === 'POST') {
        return await handleLinkUploads(request, env);
      }

      // GET /api/uploads/file/:id - Serve a file from R2
      if (path.match(/^\/api\/uploads\/file\/[^\/]+$/) && request.method === 'GET') {
        const uploadId = path.split('/')[4];
        return await handleServeFile(request, env, uploadId);
      }

      // GET /api/uploads/:sessionId - List pending uploads for session
      if (path.match(/^\/api\/uploads\/[^\/]+$/) && request.method === 'GET') {
        const sessionId = path.split('/')[3];
        return await handleListUploads(request, env, sessionId);
      }

      // DELETE /api/uploads/:id - Delete a pending upload
      if (path.match(/^\/api\/uploads\/[^\/]+$/) && request.method === 'DELETE') {
        const uploadId = path.split('/')[3];
        return await handleDeleteUpload(request, env, uploadId);
      }

      // GET /api/agents - List all agents
      if (path === '/api/agents' && request.method === 'GET') {
        return handleGetAgents(corsHeaders);
      }

      // =====================================================
      // PROMPTS API ENDPOINTS
      // =====================================================

      // GET /api/prompts - List all prompts (system + user)
      if (path === '/api/prompts' && request.method === 'GET') {
        return await handleGetPrompts(env, corsHeaders);
      }

      // POST /api/prompts - Create a new user prompt
      if (path === '/api/prompts' && request.method === 'POST') {
        return await handleCreatePrompt(request, env, corsHeaders);
      }

      // PUT /api/prompts/:id - Update a prompt
      if (path.match(/^\/api\/prompts\/[^\/]+$/) && request.method === 'PUT') {
        const promptId = path.split('/')[3];
        return await handleUpdatePrompt(promptId, request, env, corsHeaders);
      }

      // DELETE /api/prompts/:id - Delete a prompt
      if (path.match(/^\/api\/prompts\/[^\/]+$/) && request.method === 'DELETE') {
        const promptId = path.split('/')[3];
        return await handleDeletePrompt(promptId, env, corsHeaders);
      }

      // POST /api/prompts/:id/favorite - Toggle favorite
      if (path.match(/^\/api\/prompts\/[^\/]+\/favorite$/) && request.method === 'POST') {
        const promptId = path.split('/')[3];
        return await handleToggleFavorite(promptId, request, env, corsHeaders);
      }

      // =====================================================
      // BRAND INSTRUCTIONS API ENDPOINTS
      // =====================================================

      // POST /api/brand-profile/:domain/instructions - Add new instruction
      if (path.match(/^\/api\/brand-profile\/[^\/]+\/instructions$/) && request.method === 'POST') {
        const domain = path.split('/')[3];
        return await handleAddInstruction(domain, request, env, corsHeaders);
      }

      // PUT /api/brand-profile/:domain/instructions/:id - Update instruction
      if (path.match(/^\/api\/brand-profile\/[^\/]+\/instructions\/[^\/]+$/) && request.method === 'PUT') {
        const domain = path.split('/')[3];
        const instructionId = path.split('/')[5];
        return await handleUpdateInstruction(domain, instructionId, request, env, corsHeaders);
      }

      // DELETE /api/brand-profile/:domain/instructions/:id - Delete instruction
      if (path.match(/^\/api\/brand-profile\/[^\/]+\/instructions\/[^\/]+$/) && request.method === 'DELETE') {
        const domain = path.split('/')[3];
        const instructionId = path.split('/')[5];
        return await handleDeleteInstruction(domain, instructionId, env, corsHeaders);
      }

      // =====================================================
      // SAVED AUDIENCES API ENDPOINTS
      // =====================================================

      // GET /api/brands/:brandId/audiences - List saved audiences for a brand
      if (path.match(/^\/api\/brands\/[^\/]+\/audiences$/) && request.method === 'GET') {
        const brandId = path.split('/')[3];
        return await handleListAudiences(brandId, env, corsHeaders);
      }

      // POST /api/brands/:brandId/audiences - Save a new audience
      if (path.match(/^\/api\/brands\/[^\/]+\/audiences$/) && request.method === 'POST') {
        const brandId = path.split('/')[3];
        return await handleCreateAudience(brandId, request, env, corsHeaders);
      }

      // PUT /api/brands/:brandId/audiences/:id - Update an audience
      if (path.match(/^\/api\/brands\/[^\/]+\/audiences\/[^\/]+$/) && request.method === 'PUT') {
        const brandId = path.split('/')[3];
        const audienceId = path.split('/')[5];
        return await handleUpdateAudience(brandId, audienceId, request, env, corsHeaders);
      }

      // DELETE /api/brands/:brandId/audiences/:id - Delete an audience
      if (path.match(/^\/api\/brands\/[^\/]+\/audiences\/[^\/]+$/) && request.method === 'DELETE') {
        const brandId = path.split('/')[3];
        const audienceId = path.split('/')[5];
        return await handleDeleteAudience(brandId, audienceId, env, corsHeaders);
      }

      // =====================================================
      // SAVED TONES API ENDPOINTS
      // =====================================================

      // GET /api/brands/:brandId/tones - List saved tones for a brand
      if (path.match(/^\/api\/brands\/[^\/]+\/tones$/) && request.method === 'GET') {
        const brandId = path.split('/')[3];
        return await handleListTones(brandId, env, corsHeaders);
      }

      // POST /api/brands/:brandId/tones - Save a new tone
      if (path.match(/^\/api\/brands\/[^\/]+\/tones$/) && request.method === 'POST') {
        const brandId = path.split('/')[3];
        return await handleCreateTone(brandId, request, env, corsHeaders);
      }

      // PUT /api/brands/:brandId/tones/:id - Update a tone
      if (path.match(/^\/api\/brands\/[^\/]+\/tones\/[^\/]+$/) && request.method === 'PUT') {
        const brandId = path.split('/')[3];
        const toneId = path.split('/')[5];
        return await handleUpdateTone(brandId, toneId, request, env, corsHeaders);
      }

      // DELETE /api/brands/:brandId/tones/:id - Delete a tone
      if (path.match(/^\/api\/brands\/[^\/]+\/tones\/[^\/]+$/) && request.method === 'DELETE') {
        const brandId = path.split('/')[3];
        const toneId = path.split('/')[5];
        return await handleDeleteTone(brandId, toneId, env, corsHeaders);
      }

      // =====================================================
      // AI HELPER ENDPOINTS
      // =====================================================

      // POST /api/ai/generate-audience - Generate audience from description
      if (path === '/api/ai/generate-audience' && request.method === 'POST') {
        return await handleGenerateAudience(request, env);
      }

      // POST /api/ai/detect-tone - Detect tone from text
      if (path === '/api/ai/detect-tone' && request.method === 'POST') {
        return await handleDetectTone(request, env);
      }

      // ==========================================
      // History Endpoints
      // ==========================================

      // GET /api/history - List history (with optional search)
      if (path === '/api/history' && request.method === 'GET') {
        return await handleListHistory(request, env);
      }

      // POST /api/history - Save a generation to history
      if (path === '/api/history' && request.method === 'POST') {
        return await handleSaveHistory(request, env);
      }

      // GET /api/history/:id - Get a specific history item
      if (path.match(/^\/api\/history\/[\w-]+$/) && request.method === 'GET') {
        const id = path.split('/')[3];
        return await handleGetHistoryItem(request, env, id);
      }

      // DELETE /api/history/:id - Delete a history item
      if (path.match(/^\/api\/history\/[\w-]+$/) && request.method === 'DELETE') {
        const id = path.split('/')[3];
        return await handleDeleteHistory(request, env, id);
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

  // Cron handler for cleanup tasks
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env, ctx));
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
 * GET /api/brand-profiles/:id
 * Retrieve saved brand profile by ID
 */
async function handleGetBrandProfileById(brandId, env, corsHeaders) {
  const result = await env.DB.prepare(
    'SELECT * FROM brand_profiles WHERE id = ?'
  ).bind(brandId).first();

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
 * GET /api/agents
 * List all agents (from file-based registry)
 */
function handleGetAgents(corsHeaders) {
  // Use file-based agent registry (includes chipSelectors and starterMessage)
  const agents = listAgents();
  return jsonResponse({ agents }, 200, corsHeaders);
}

// =====================================================
// PROMPTS HANDLERS
// =====================================================

/**
 * GET /api/prompts
 * List all prompts (system + user)
 */
async function handleGetPrompts(env, corsHeaders) {
  const result = await env.DB.prepare(`
    SELECT id, is_system, title, description, prompt_text, tags, category, icon, is_favorite, created_at, updated_at
    FROM prompts
    ORDER BY is_favorite DESC, is_system DESC, title ASC
  `).all();

  const prompts = (result.results || []).map(row => ({
    id: row.id,
    isSystem: row.is_system === 1,
    title: row.title,
    description: row.description,
    promptText: row.prompt_text,
    tags: row.tags ? JSON.parse(row.tags) : [],
    category: row.category,
    icon: row.icon,
    isFavorite: row.is_favorite === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return jsonResponse({ prompts }, 200, corsHeaders);
}

/**
 * POST /api/prompts
 * Create a new user prompt
 */
async function handleCreatePrompt(request, env, corsHeaders) {
  const body = await request.json();
  const { title, description, promptText, tags, category, icon } = body;

  if (!title || !promptText) {
    return jsonResponse({ error: 'Missing required fields: title, promptText' }, 400, corsHeaders);
  }

  const id = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  await env.DB.prepare(`
    INSERT INTO prompts (id, is_system, title, description, prompt_text, tags, category, icon)
    VALUES (?, 0, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    title,
    description || '',
    promptText,
    JSON.stringify(tags || []),
    category || 'custom',
    icon || 'FileText'
  ).run();

  const prompt = {
    id,
    isSystem: false,
    title,
    description: description || '',
    promptText,
    tags: tags || [],
    category: category || 'custom',
    icon: icon || 'FileText',
    isFavorite: false,
  };

  return jsonResponse({ prompt }, 201, corsHeaders);
}

/**
 * PUT /api/prompts/:id
 * Update a prompt (only user prompts can be fully edited)
 */
async function handleUpdatePrompt(promptId, request, env, corsHeaders) {
  const body = await request.json();
  const { title, description, promptText, tags, category, icon } = body;

  // Check if prompt exists and is not a system prompt
  const existing = await env.DB.prepare(
    'SELECT is_system FROM prompts WHERE id = ?'
  ).bind(promptId).first();

  if (!existing) {
    return jsonResponse({ error: 'Prompt not found' }, 404, corsHeaders);
  }

  if (existing.is_system === 1) {
    return jsonResponse({ error: 'System prompts cannot be edited' }, 403, corsHeaders);
  }

  await env.DB.prepare(`
    UPDATE prompts SET
      title = ?,
      description = ?,
      prompt_text = ?,
      tags = ?,
      category = ?,
      icon = ?,
      updated_at = strftime('%s', 'now')
    WHERE id = ?
  `).bind(
    title,
    description || '',
    promptText,
    JSON.stringify(tags || []),
    category || 'custom',
    icon || 'FileText',
    promptId
  ).run();

  return jsonResponse({ success: true }, 200, corsHeaders);
}

/**
 * DELETE /api/prompts/:id
 * Delete a prompt (only user prompts)
 */
async function handleDeletePrompt(promptId, env, corsHeaders) {
  // Check if prompt exists and is not a system prompt
  const existing = await env.DB.prepare(
    'SELECT is_system FROM prompts WHERE id = ?'
  ).bind(promptId).first();

  if (!existing) {
    return jsonResponse({ error: 'Prompt not found' }, 404, corsHeaders);
  }

  if (existing.is_system === 1) {
    return jsonResponse({ error: 'System prompts cannot be deleted' }, 403, corsHeaders);
  }

  await env.DB.prepare('DELETE FROM prompts WHERE id = ?').bind(promptId).run();

  return jsonResponse({ success: true }, 200, corsHeaders);
}

/**
 * POST /api/prompts/:id/favorite
 * Toggle favorite status for a prompt
 */
async function handleToggleFavorite(promptId, request, env, corsHeaders) {
  const body = await request.json();
  const { isFavorite } = body;

  // Check if prompt exists
  const existing = await env.DB.prepare(
    'SELECT id FROM prompts WHERE id = ?'
  ).bind(promptId).first();

  if (!existing) {
    return jsonResponse({ error: 'Prompt not found' }, 404, corsHeaders);
  }

  await env.DB.prepare(
    'UPDATE prompts SET is_favorite = ? WHERE id = ?'
  ).bind(isFavorite ? 1 : 0, promptId).run();

  return jsonResponse({ success: true, isFavorite }, 200, corsHeaders);
}

// =====================================================
// BRAND INSTRUCTIONS HANDLERS
// =====================================================

/**
 * POST /api/brand-profile/:domain/instructions
 * Add a new instruction to brand profile
 */
async function handleAddInstruction(domain, request, env, corsHeaders) {
  const body = await request.json();
  const { text, source = 'manual' } = body;

  if (!text || !text.trim()) {
    return jsonResponse({ error: 'Missing required field: text' }, 400, corsHeaders);
  }

  // Get current brand profile
  const result = await env.DB.prepare(
    'SELECT id, additional_instructions FROM brand_profiles WHERE domain = ?'
  ).bind(domain).first();

  if (!result) {
    return jsonResponse({ error: 'Brand profile not found' }, 404, corsHeaders);
  }

  // Parse existing instructions
  const instructions = JSON.parse(result.additional_instructions || '[]');

  // Create new instruction
  const newInstruction = {
    id: `instr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text: text.trim(),
    createdAt: Date.now(),
    source: source === 'chat' ? 'chat' : 'manual'
  };

  // Add to array
  instructions.push(newInstruction);

  // Update database
  await env.DB.prepare(
    'UPDATE brand_profiles SET additional_instructions = ?, updated_at = ? WHERE domain = ?'
  ).bind(JSON.stringify(instructions), Date.now(), domain).run();

  return jsonResponse({ instruction: newInstruction }, 201, corsHeaders);
}

/**
 * PUT /api/brand-profile/:domain/instructions/:id
 * Update an existing instruction
 */
async function handleUpdateInstruction(domain, instructionId, request, env, corsHeaders) {
  const body = await request.json();
  const { text } = body;

  if (!text || !text.trim()) {
    return jsonResponse({ error: 'Missing required field: text' }, 400, corsHeaders);
  }

  // Get current brand profile
  const result = await env.DB.prepare(
    'SELECT additional_instructions FROM brand_profiles WHERE domain = ?'
  ).bind(domain).first();

  if (!result) {
    return jsonResponse({ error: 'Brand profile not found' }, 404, corsHeaders);
  }

  // Parse existing instructions
  const instructions = JSON.parse(result.additional_instructions || '[]');

  // Find and update instruction
  const index = instructions.findIndex(i => i.id === instructionId);
  if (index === -1) {
    return jsonResponse({ error: 'Instruction not found' }, 404, corsHeaders);
  }

  instructions[index].text = text.trim();

  // Update database
  await env.DB.prepare(
    'UPDATE brand_profiles SET additional_instructions = ?, updated_at = ? WHERE domain = ?'
  ).bind(JSON.stringify(instructions), Date.now(), domain).run();

  return jsonResponse({ instruction: instructions[index] }, 200, corsHeaders);
}

/**
 * DELETE /api/brand-profile/:domain/instructions/:id
 * Delete an instruction
 */
async function handleDeleteInstruction(domain, instructionId, env, corsHeaders) {
  // Get current brand profile
  const result = await env.DB.prepare(
    'SELECT additional_instructions FROM brand_profiles WHERE domain = ?'
  ).bind(domain).first();

  if (!result) {
    return jsonResponse({ error: 'Brand profile not found' }, 404, corsHeaders);
  }

  // Parse existing instructions
  const instructions = JSON.parse(result.additional_instructions || '[]');

  // Find instruction
  const index = instructions.findIndex(i => i.id === instructionId);
  if (index === -1) {
    return jsonResponse({ error: 'Instruction not found' }, 404, corsHeaders);
  }

  // Remove instruction
  instructions.splice(index, 1);

  // Update database
  await env.DB.prepare(
    'UPDATE brand_profiles SET additional_instructions = ?, updated_at = ? WHERE domain = ?'
  ).bind(JSON.stringify(instructions), Date.now(), domain).run();

  return jsonResponse({ success: true }, 200, corsHeaders);
}

// =====================================================
// SAVED AUDIENCES HANDLERS
// =====================================================

/**
 * GET /api/brands/:brandId/audiences
 * List all saved audiences for a brand
 */
async function handleListAudiences(brandId, env, corsHeaders) {
  const result = await env.DB.prepare(`
    SELECT id, brand_profile_id, name, gender, age_min, age_max, pain_points, source, created_at
    FROM saved_audiences
    WHERE brand_profile_id = ?
    ORDER BY created_at DESC
  `).bind(brandId).all();

  const audiences = (result.results || []).map(row => ({
    id: row.id,
    brandProfileId: row.brand_profile_id,
    name: row.name,
    gender: row.gender,
    ageRange: { min: row.age_min, max: row.age_max },
    painPoints: JSON.parse(row.pain_points || '[]'),
    source: row.source,
    createdAt: row.created_at,
  }));

  return jsonResponse({ audiences }, 200, corsHeaders);
}

/**
 * POST /api/brands/:brandId/audiences
 * Create a new saved audience
 */
async function handleCreateAudience(brandId, request, env, corsHeaders) {
  const body = await request.json();
  const { name, gender, ageRange, painPoints, source = 'manual' } = body;

  if (!name || !gender || !ageRange) {
    return jsonResponse({ error: 'Missing required fields: name, gender, ageRange' }, 400, corsHeaders);
  }

  if (!['female', 'male', 'any'].includes(gender)) {
    return jsonResponse({ error: 'Gender must be "female", "male", or "any"' }, 400, corsHeaders);
  }

  const id = `aud-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  await env.DB.prepare(`
    INSERT INTO saved_audiences (id, brand_profile_id, name, gender, age_min, age_max, pain_points, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    brandId,
    name,
    gender,
    ageRange.min || 18,
    ageRange.max || 65,
    JSON.stringify(painPoints || []),
    source === 'ai_suggested' ? 'ai_suggested' : 'manual'
  ).run();

  const audience = {
    id,
    brandProfileId: brandId,
    name,
    gender,
    ageRange: { min: ageRange.min || 18, max: ageRange.max || 65 },
    painPoints: painPoints || [],
    source: source === 'ai_suggested' ? 'ai_suggested' : 'manual',
    createdAt: Math.floor(Date.now() / 1000),
  };

  return jsonResponse({ audience }, 201, corsHeaders);
}

/**
 * PUT /api/brands/:brandId/audiences/:id
 * Update an existing audience
 */
async function handleUpdateAudience(brandId, audienceId, request, env, corsHeaders) {
  const body = await request.json();
  const { name, gender, ageRange, painPoints } = body;

  // Check if audience exists
  const existing = await env.DB.prepare(
    'SELECT id FROM saved_audiences WHERE id = ? AND brand_profile_id = ?'
  ).bind(audienceId, brandId).first();

  if (!existing) {
    return jsonResponse({ error: 'Audience not found' }, 404, corsHeaders);
  }

  if (gender && !['female', 'male', 'any'].includes(gender)) {
    return jsonResponse({ error: 'Gender must be "female", "male", or "any"' }, 400, corsHeaders);
  }

  // Build update query dynamically based on provided fields
  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (gender !== undefined) {
    updates.push('gender = ?');
    values.push(gender);
  }
  if (ageRange !== undefined) {
    updates.push('age_min = ?, age_max = ?');
    values.push(ageRange.min || 18, ageRange.max || 65);
  }
  if (painPoints !== undefined) {
    updates.push('pain_points = ?');
    values.push(JSON.stringify(painPoints));
  }

  if (updates.length === 0) {
    return jsonResponse({ error: 'No fields to update' }, 400, corsHeaders);
  }

  values.push(audienceId, brandId);

  await env.DB.prepare(`
    UPDATE saved_audiences SET ${updates.join(', ')}
    WHERE id = ? AND brand_profile_id = ?
  `).bind(...values).run();

  return jsonResponse({ success: true }, 200, corsHeaders);
}

/**
 * DELETE /api/brands/:brandId/audiences/:id
 * Delete an audience
 */
async function handleDeleteAudience(brandId, audienceId, env, corsHeaders) {
  const result = await env.DB.prepare(
    'DELETE FROM saved_audiences WHERE id = ? AND brand_profile_id = ?'
  ).bind(audienceId, brandId).run();

  if (result.changes === 0) {
    return jsonResponse({ error: 'Audience not found' }, 404, corsHeaders);
  }

  return jsonResponse({ success: true }, 200, corsHeaders);
}

// =====================================================
// SAVED TONES CRUD HANDLERS
// =====================================================

/**
 * GET /api/brands/:brandId/tones
 * List all saved tones for a brand
 */
async function handleListTones(brandId, env, corsHeaders) {
  const result = await env.DB.prepare(`
    SELECT id, name, traits, description, source, created_at
    FROM saved_tones
    WHERE brand_profile_id = ?
    ORDER BY created_at DESC
  `).bind(brandId).all();

  const tones = (result.results || []).map(row => ({
    id: row.id,
    name: row.name,
    traits: JSON.parse(row.traits || '[]'),
    description: row.description,
    source: row.source,
    createdAt: row.created_at
  }));

  return jsonResponse({ tones }, 200, corsHeaders);
}

/**
 * POST /api/brands/:brandId/tones
 * Save a new tone
 */
async function handleCreateTone(brandId, request, env, corsHeaders) {
  const body = await request.json();
  const { name, traits, description, source = 'manual' } = body;

  if (!name || !traits || !Array.isArray(traits)) {
    return jsonResponse({
      error: 'Name and traits (array) are required'
    }, 400, corsHeaders);
  }

  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO saved_tones (id, brand_profile_id, name, traits, description, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, brandId, name, JSON.stringify(traits), description || '', source).run();

  return jsonResponse({
    id,
    name,
    traits,
    description: description || '',
    source,
    createdAt: Math.floor(Date.now() / 1000)
  }, 201, corsHeaders);
}

/**
 * PUT /api/brands/:brandId/tones/:id
 * Update a tone
 */
async function handleUpdateTone(brandId, toneId, request, env, corsHeaders) {
  const body = await request.json();
  const { name, traits, description } = body;

  // Check if tone exists
  const existing = await env.DB.prepare(
    'SELECT id FROM saved_tones WHERE id = ? AND brand_profile_id = ?'
  ).bind(toneId, brandId).first();

  if (!existing) {
    return jsonResponse({ error: 'Tone not found' }, 404, corsHeaders);
  }

  // Build update query dynamically
  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (traits !== undefined) {
    updates.push('traits = ?');
    values.push(JSON.stringify(traits));
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }

  if (updates.length === 0) {
    return jsonResponse({ error: 'No fields to update' }, 400, corsHeaders);
  }

  values.push(toneId, brandId);

  await env.DB.prepare(`
    UPDATE saved_tones SET ${updates.join(', ')}
    WHERE id = ? AND brand_profile_id = ?
  `).bind(...values).run();

  return jsonResponse({ success: true }, 200, corsHeaders);
}

/**
 * DELETE /api/brands/:brandId/tones/:id
 * Delete a tone
 */
async function handleDeleteTone(brandId, toneId, env, corsHeaders) {
  const result = await env.DB.prepare(
    'DELETE FROM saved_tones WHERE id = ? AND brand_profile_id = ?'
  ).bind(toneId, brandId).run();

  if (result.changes === 0) {
    return jsonResponse({ error: 'Tone not found' }, 404, corsHeaders);
  }

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
