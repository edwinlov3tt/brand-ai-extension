/**
 * Ad Copy Generation using Claude API
 */

import { getTactic, validateCopy } from './tactics.js';

/**
 * Generate ad copy variations
 */
export async function generateAdCopy(brandProfile, tacticId, campaignObjective, variations, env) {
  const tactic = getTactic(tacticId);
  if (!tactic) {
    throw new Error(`Invalid tactic: ${tacticId}`);
  }

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // Build prompt that requests multiple variations
  const basePrompt = tactic.promptTemplate(brandProfile, campaignObjective);
  const prompt = `${basePrompt}

Generate ${variations} DIFFERENT variations. Each variation should:
- Use different wording, angles, and hooks
- Vary the emotional appeal (urgency, curiosity, benefit, social proof, etc.)
- Maintain the same brand voice but explore different approaches
- Stay within the character and word limits

Return ONLY the ${variations} variations, one per line, numbered 1-${variations}. No explanations or additional text.`;

  try {
    const response = await callClaudeForCopy(prompt, env.ANTHROPIC_API_KEY);
    const variations = parseVariations(response);

    // Validate and format each variation
    const results = variations.map((copyText, index) => {
      const validation = validateCopy(copyText, tacticId);

      return {
        id: generateId(),
        text: copyText,
        charCount: validation.charCount,
        wordCount: validation.wordCount,
        valid: validation.valid,
        errors: validation.errors,
        tactic: tacticId,
        objective: campaignObjective,
        createdAt: Date.now() + index // Slight offset for unique timestamps
      };
    });

    if (results.length === 0) {
      throw new Error('Failed to parse any variations from response');
    }

    return results;
  } catch (error) {
    console.error('Failed to generate ad copy:', error);
    throw error;
  }
}

/**
 * Parse multiple variations from Claude response
 */
function parseVariations(response) {
  // Split by lines and filter out empty lines
  const lines = response.split('\n').map(line => line.trim()).filter(line => line);

  // Remove numbering (1., 2., etc.) and quotes
  const variations = lines.map(line => {
    return line
      .replace(/^\d+[\.\)]\s*/, '') // Remove "1. " or "1) "
      .replace(/^["']|["']$/g, '')  // Remove surrounding quotes
      .trim();
  }).filter(v => v.length > 0);

  return variations;
}

/**
 * Call Claude API for ad copy generation
 */
async function callClaudeForCopy(prompt, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      temperature: 0.7, // Higher temperature for creative variations
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

  // Remove quotes if Claude wrapped the response
  return text.replace(/^["']|["']$/g, '');
}

/**
 * Generate unique ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
