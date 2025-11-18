/**
 * Ad Copy Generation using Claude API
 */

import { getTactic, validateCopy } from './tactics.js';

/**
 * Generate ad copy variations (single component tactics)
 */
export async function generateAdCopy(brandProfile, tacticId, campaignObjective, variations, env, includeEmojis, emojiInstructions, pageContext) {
  const tactic = getTactic(tacticId);
  if (!tactic) {
    throw new Error(`Invalid tactic: ${tacticId}`);
  }

  // Check if this is a multi-component tactic
  if (tactic.multiComponent) {
    return await generateMultiComponentAdCopy(brandProfile, tacticId, campaignObjective, env, includeEmojis, emojiInstructions, pageContext);
  }

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // Build prompt that requests multiple variations
  const basePrompt = tactic.promptTemplate(brandProfile, campaignObjective);

  // Add page context if provided
  let pageContextSection = '';
  if (pageContext) {
    pageContextSection = `
SPECIFIC PRODUCT/SERVICE CONTEXT:
${pageContext.title ? `- Product/Service: ${pageContext.title}` : ''}
${pageContext.type ? `- Type: ${pageContext.type}` : ''}
${pageContext.summary ? `- Summary: ${pageContext.summary}` : ''}
${pageContext.valuePropositions && pageContext.valuePropositions.length > 0 ? `- Value Propositions: ${pageContext.valuePropositions.join(', ')}` : ''}
${pageContext.features && pageContext.features.length > 0 ? `- Features: ${pageContext.features.join(', ')}` : ''}
${pageContext.benefits && pageContext.benefits.length > 0 ? `- Benefits: ${pageContext.benefits.join(', ')}` : ''}
${pageContext.targetAudience ? `- Target Audience: ${pageContext.targetAudience}` : ''}

IMPORTANT: Focus this ad copy specifically on the above product/service, not just the general brand.
`;
  }

  const prompt = `${basePrompt}
${pageContextSection}
Generate ${variations} DIFFERENT variations. Each variation should:
- Use different wording, angles, and hooks
- Vary the emotional appeal (urgency, curiosity, benefit, social proof, etc.)
- Maintain the same brand voice but explore different approaches
- Stay within the character and word limits

${includeEmojis && emojiInstructions ? emojiInstructions : ''}

Return ONLY the ${variations} variations, one per line, numbered 1-${variations}. No explanations or additional text.`;

  try {
    const response = await callClaudeForCopy(prompt, env.ANTHROPIC_API_KEY);
    const variationsArray = parseVariations(response);

    // Validate and format each variation
    const results = variationsArray.map((copyText, index) => {
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
 * Generate multi-component ad copy (e.g., Facebook ad with headline, body, CTA)
 */
export async function generateMultiComponentAdCopy(brandProfile, tacticId, campaignObjective, env, includeEmojis, emojiInstructions, pageContext) {
  const tactic = getTactic(tacticId);
  if (!tactic || !tactic.multiComponent) {
    throw new Error(`Invalid multi-component tactic: ${tacticId}`);
  }

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // Build prompt using the tactic's template
  let prompt = tactic.promptTemplate(brandProfile, campaignObjective, includeEmojis, emojiInstructions);

  // Add page context if provided
  if (pageContext) {
    const pageContextSection = `

SPECIFIC PRODUCT/SERVICE CONTEXT:
${pageContext.title ? `- Product/Service: ${pageContext.title}` : ''}
${pageContext.type ? `- Type: ${pageContext.type}` : ''}
${pageContext.summary ? `- Summary: ${pageContext.summary}` : ''}
${pageContext.valuePropositions && pageContext.valuePropositions.length > 0 ? `- Value Propositions: ${pageContext.valuePropositions.join(', ')}` : ''}
${pageContext.features && pageContext.features.length > 0 ? `- Features: ${pageContext.features.join(', ')}` : ''}
${pageContext.benefits && pageContext.benefits.length > 0 ? `- Benefits: ${pageContext.benefits.join(', ')}` : ''}
${pageContext.targetAudience ? `- Target Audience: ${pageContext.targetAudience}` : ''}

IMPORTANT: Focus this ad copy specifically on the above product/service, not just the general brand.
`;

    // Insert page context before the JSON format instructions
    // (usually at the end of multi-component prompts)
    const jsonInstructionIndex = prompt.indexOf('Return your response');
    if (jsonInstructionIndex > 0) {
      prompt = prompt.slice(0, jsonInstructionIndex) + pageContextSection + '\n' + prompt.slice(jsonInstructionIndex);
    } else {
      prompt = prompt + pageContextSection;
    }
  }

  try {
    const response = await callClaudeForCopy(prompt, env.ANTHROPIC_API_KEY, 2048); // Higher token limit for multi-component
    const parsedData = parseJSONWithFallback(response, tactic);

    // Validate each component
    const validatedComponents = parsedData.components.map(component => {
      const validatedVariations = component.variations.map(text => {
        const componentDef = tactic.components.find(c => c.name === component.name);
        const charCount = text.length;
        const errors = [];

        if (componentDef) {
          if (componentDef.maxChars && charCount > componentDef.maxChars) {
            errors.push(`Exceeds max ${componentDef.maxChars} characters (${charCount})`);
          }
          if (componentDef.minChars && charCount < componentDef.minChars) {
            errors.push(`Below min ${componentDef.minChars} characters (${charCount})`);
          }
        }

        return {
          text,
          charCount,
          valid: errors.length === 0,
          errors
        };
      });

      return {
        name: component.name,
        variations: validatedVariations
      };
    });

    return {
      id: generateId(),
      tactic: tacticId,
      objective: campaignObjective,
      multiComponent: true,
      components: validatedComponents,
      createdAt: Date.now()
    };
  } catch (error) {
    console.error('Failed to generate multi-component ad copy:', error);
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
 * Parse JSON response with fallback to text parsing
 */
function parseJSONWithFallback(response, tactic) {
  // Step 1: Clean markdown code blocks
  let cleaned = response.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/,'');
  cleaned = cleaned.replace(/\s*```$/,'');
  cleaned = cleaned.trim();

  // Step 2: Try JSON.parse()
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.components && Array.isArray(parsed.components)) {
      return parsed;
    }
    throw new Error('Invalid JSON structure - missing components array');
  } catch (jsonError) {
    console.warn('JSON parsing failed, attempting text fallback:', jsonError.message);

    // Step 3: Fallback to regex-based text parsing
    return parseStructuredText(cleaned, tactic);
  }
}

/**
 * Fallback parser for structured text when JSON parsing fails
 */
function parseStructuredText(text, tactic) {
  const components = [];

  for (const componentDef of tactic.components) {
    const variations = [];

    // Try to find section with component name
    const sectionRegex = new RegExp(`${componentDef.name}[:\\s]*([\\s\\S]*?)(?=(?:\\n[A-Z][^:]*:|$))`, 'i');
    const sectionMatch = text.match(sectionRegex);

    if (sectionMatch && sectionMatch[1]) {
      const sectionText = sectionMatch[1];

      // Extract numbered items or quoted strings
      const itemRegex = /(?:^\d+[\.\)]\s*["\']?(.+?)["\']?$)|(?:["'](.+?)["'])/gm;
      let match;

      while ((match = itemRegex.exec(sectionText)) && variations.length < componentDef.count) {
        const item = (match[1] || match[2] || '').trim();
        if (item && !item.match(/^[A-Z][a-z]+:/)) { // Skip headers
          variations.push(item);
        }
      }
    }

    // If we didn't get enough variations, pad with empty strings
    while (variations.length < componentDef.count) {
      variations.push(`[${componentDef.name} ${variations.length + 1}]`);
    }

    components.push({
      name: componentDef.name,
      variations: variations.slice(0, componentDef.count)
    });
  }

  return { components };
}

/**
 * Call Claude API for ad copy generation
 */
async function callClaudeForCopy(prompt, apiKey, maxTokens = 512) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
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
