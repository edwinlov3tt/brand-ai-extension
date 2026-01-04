/**
 * AI Helper Functions
 *
 * Provides AI-powered generation for audiences and tone detection
 */

import Anthropic from '@anthropic-ai/sdk';
import { getCorsHeaders } from './cors.js';
import { deserializeBrandProfile } from './schema.js';

/**
 * Generate a structured audience from a description
 * POST /api/ai/generate-audience
 */
export async function handleGenerateAudience(request, env) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const body = await request.json();
    const { description, brandId } = body;

    if (!description || description.trim().length < 10) {
      return jsonResponse({
        error: 'Please provide a description of at least 10 characters'
      }, 400, corsHeaders);
    }

    // Get brand context if provided
    let brandContext = '';
    if (brandId) {
      const result = await env.DB.prepare(
        'SELECT name, positioning, audience_primary FROM brand_profiles WHERE id = ?'
      ).bind(brandId).first();

      if (result) {
        brandContext = `\nBrand Context:\n- Brand Name: ${result.name}\n- Positioning: ${result.positioning || 'Not specified'}\n- Primary Audience: ${result.audience_primary || 'Not specified'}`;
      }
    }

    const client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });

    const systemPrompt = `You are an expert marketing strategist who creates detailed target audience personas.

Given a description of a target audience, generate a structured persona with the following fields:
- name: A short, memorable persona name (2-4 words, e.g., "Young Professionals", "Health-Conscious Parents")
- gender: One of "female", "male", or "any"
- ageRange: An object with "min" and "max" age values (integers)
- painPoints: An array of 3-5 specific pain points this audience experiences

Respond ONLY with valid JSON in this exact format:
{
  "name": "Persona Name",
  "gender": "any",
  "ageRange": { "min": 25, "max": 45 },
  "painPoints": ["Pain point 1", "Pain point 2", "Pain point 3"]
}`;

    const userPrompt = `Generate a target audience persona based on this description:

"${description.trim()}"${brandContext}

Remember to respond with ONLY valid JSON.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Parse the response
    const content = response.content[0]?.text || '';

    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const audience = JSON.parse(jsonStr);

    // Validate the response structure
    if (!audience.name || !audience.gender || !audience.ageRange || !audience.painPoints) {
      throw new Error('Invalid audience structure returned');
    }

    // Ensure proper types
    const result = {
      name: String(audience.name),
      gender: ['female', 'male', 'any'].includes(audience.gender) ? audience.gender : 'any',
      ageRange: {
        min: parseInt(audience.ageRange.min) || 18,
        max: parseInt(audience.ageRange.max) || 65
      },
      painPoints: Array.isArray(audience.painPoints)
        ? audience.painPoints.map(p => String(p))
        : []
    };

    return jsonResponse(result, 200, corsHeaders);

  } catch (error) {
    console.error('Error generating audience:', error);
    return jsonResponse({
      error: error.message || 'Failed to generate audience'
    }, 500, corsHeaders);
  }
}

/**
 * Detect tone of voice from text
 * POST /api/ai/detect-tone
 */
export async function handleDetectTone(request, env) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const body = await request.json();
    const { text, mode } = body;

    if (!text || text.trim().length < 10) {
      return jsonResponse({
        error: 'Please provide text of at least 10 characters'
      }, 400, corsHeaders);
    }

    if (!['describe', 'example'].includes(mode)) {
      return jsonResponse({
        error: 'Mode must be either "describe" or "example"'
      }, 400, corsHeaders);
    }

    const client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });

    const availableTraits = [
      'Professional', 'Casual', 'Friendly', 'Formal', 'Authoritative',
      'Conversational', 'Enthusiastic', 'Empathetic', 'Confident',
      'Persuasive', 'Informative', 'Playful', 'Sincere', 'Bold',
      'Warm', 'Direct', 'Sophisticated', 'Approachable'
    ];

    let systemPrompt, userPrompt;

    if (mode === 'describe') {
      systemPrompt = `You are an expert in brand voice and tone analysis.

Given a description of a desired tone of voice, identify the key characteristics and provide a structured response.

Available tone traits to choose from: ${availableTraits.join(', ')}

Respond ONLY with valid JSON in this exact format:
{
  "name": "Short name for this tone (2-3 words)",
  "traits": ["Trait1", "Trait2", "Trait3"],
  "description": "A brief description of how to write in this tone"
}

Select 2-4 traits that best match the described tone.`;

      userPrompt = `Based on this description, identify the tone of voice:

"${text.trim()}"

Respond with ONLY valid JSON.`;

    } else {
      // Example mode - analyze the writing style
      systemPrompt = `You are an expert in brand voice and tone analysis.

Given an example of written content, analyze its tone and style to identify the key characteristics.

Available tone traits to choose from: ${availableTraits.join(', ')}

Respond ONLY with valid JSON in this exact format:
{
  "name": "Short name for this tone (2-3 words)",
  "traits": ["Trait1", "Trait2", "Trait3"],
  "description": "A brief description of the detected writing style"
}

Select 2-4 traits that best describe the example's tone.`;

      userPrompt = `Analyze the tone of voice in this example text:

"${text.trim()}"

Respond with ONLY valid JSON.`;
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Parse the response
    const content = response.content[0]?.text || '';

    // Extract JSON from response
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const tone = JSON.parse(jsonStr);

    // Validate the response structure
    if (!tone.name || !tone.traits || !tone.description) {
      throw new Error('Invalid tone structure returned');
    }

    // Ensure traits are from allowed list
    const validTraits = tone.traits.filter(t =>
      availableTraits.some(at => at.toLowerCase() === t.toLowerCase())
    );

    const result = {
      name: String(tone.name),
      traits: validTraits.length > 0 ? validTraits : ['Professional'],
      description: String(tone.description)
    };

    return jsonResponse(result, 200, corsHeaders);

  } catch (error) {
    console.error('Error detecting tone:', error);
    return jsonResponse({
      error: error.message || 'Failed to detect tone'
    }, 500, corsHeaders);
  }
}

/**
 * Helper to create JSON response
 */
function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
