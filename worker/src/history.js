/**
 * Generation History API Handlers
 *
 * Provides endpoints for storing and retrieving content generation history
 */

import { getCorsHeaders } from './cors.js';

/**
 * List generation history with optional search and pagination
 * GET /api/history?search=&brandId=&limit=&offset=
 */
export async function handleListHistory(request, env) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim() || '';
    const brandId = url.searchParams.get('brandId') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let results;

    if (search) {
      // Use FTS for search
      const searchQuery = search.split(' ').map(term => `"${term}"*`).join(' OR ');
      results = await env.DB.prepare(`
        SELECT h.* FROM generation_history h
        JOIN generation_history_fts fts ON h.id = fts.id
        WHERE generation_history_fts MATCH ?
        ${brandId ? 'AND h.brand_profile_id = ?' : ''}
        ORDER BY h.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(
        searchQuery,
        ...(brandId ? [brandId] : []),
        limit,
        offset
      ).all();
    } else {
      // Simple list with optional brand filter
      if (brandId) {
        results = await env.DB.prepare(`
          SELECT * FROM generation_history
          WHERE brand_profile_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `).bind(brandId, limit, offset).all();
      } else {
        results = await env.DB.prepare(`
          SELECT * FROM generation_history
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `).bind(limit, offset).all();
      }
    }

    // Group by date
    const groupedHistory = groupByDate(results.results || []);

    return new Response(JSON.stringify({
      history: groupedHistory,
      total: results.results?.length || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error listing history:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Get a single history item by ID
 * GET /api/history/:id
 */
export async function handleGetHistoryItem(request, env, id) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const result = await env.DB.prepare(`
      SELECT * FROM generation_history WHERE id = ?
    `).bind(id).first();

    if (!result) {
      return new Response(JSON.stringify({ error: 'History item not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Parse JSON fields
    const item = {
      ...result,
      formData: JSON.parse(result.form_data || '{}'),
      outputData: JSON.parse(result.output_data || '{}')
    };

    return new Response(JSON.stringify(item), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error getting history item:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Save a generation to history
 * POST /api/history
 */
export async function handleSaveHistory(request, env) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const body = await request.json();
    const {
      brandProfileId,
      templateId,
      templateName,
      categoryName,
      promptSummary,
      formData,
      outputData,
      outputType,
      variantCount
    } = body;

    // Validate required fields
    if (!templateId || !templateName || !promptSummary || !outputData) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: templateId, templateName, promptSummary, outputData'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      INSERT INTO generation_history (
        id, brand_profile_id, template_id, template_name, category_name,
        prompt_summary, form_data, output_data, output_type, variant_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      brandProfileId || null,
      templateId,
      templateName,
      categoryName || null,
      promptSummary,
      JSON.stringify(formData || {}),
      JSON.stringify(outputData),
      outputType || 'generic',
      variantCount || 1,
      now
    ).run();

    return new Response(JSON.stringify({
      id,
      message: 'History saved successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error saving history:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Delete a history item
 * DELETE /api/history/:id
 */
export async function handleDeleteHistory(request, env, id) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const result = await env.DB.prepare(`
      DELETE FROM generation_history WHERE id = ?
    `).bind(id).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'History item not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ message: 'History deleted successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error deleting history:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Group history items by date
 */
function groupByDate(items) {
  const groups = {};

  items.forEach(item => {
    // Parse created_at timestamp
    const date = new Date(item.created_at * 1000);
    const dateKey = formatDateKey(date);

    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: dateKey,
        dateLabel: formatDateLabel(date),
        items: []
      };
    }

    groups[dateKey].items.push({
      id: item.id,
      templateId: item.template_id,
      templateName: item.template_name,
      categoryName: item.category_name,
      promptSummary: item.prompt_summary,
      outputType: item.output_type,
      variantCount: item.variant_count,
      createdAt: item.created_at
    });
  });

  // Convert to array sorted by date (most recent first)
  return Object.values(groups).sort((a, b) => {
    return new Date(b.items[0]?.createdAt * 1000) - new Date(a.items[0]?.createdAt * 1000);
  });
}

/**
 * Format date key for grouping (YYYY-MM-DD)
 */
function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Format date label for display (e.g., "Friday, December 19, 2025")
 */
function formatDateLabel(date) {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  return date.toLocaleDateString('en-US', options);
}
