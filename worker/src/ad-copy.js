/**
 * Ad Copy Generation using Claude API
 * Enhanced with structured prompts, full brand context, and creative examples
 */

import { getTactic, validateCopy } from './tactics.js';

/**
 * Build the complete brand profile context in XML format
 */
function buildBrandContext(brandProfile) {
  const brand = brandProfile.brand || {};
  const voice = brandProfile.voice || {};
  const audience = brandProfile.audience || {};
  const toneSliders = voice.toneSliders || {};
  const lexicon = voice.lexicon || {};

  return `<brand_profile>
  <brand_identity>
    <name>${brand.name || 'Unknown Brand'}</name>
    <tagline>${brand.tagline || ''}</tagline>
    <positioning>${brand.positioning || ''}</positioning>
    <industry>${brand.industry || ''}</industry>
    <value_propositions>${(brand.valuePropositions || []).join('; ')}</value_propositions>
  </brand_identity>

  <brand_voice>
    <personality_traits>${(voice.personality || []).join(', ')}</personality_traits>
    <tone_spectrum>
      <formal_casual>${toneSliders.formal || 50}/100 formal</formal_casual>
      <serious_playful>${toneSliders.playful || 50}/100 playful</serious_playful>
      <reserved_energetic>${toneSliders.energetic || 50}/100 energetic</reserved_energetic>
    </tone_spectrum>
    <language_preferences>
      <preferred_phrases>${(lexicon.preferred || []).join('; ')}</preferred_phrases>
      <phrases_to_avoid>${(lexicon.avoid || []).join('; ')}</phrases_to_avoid>
    </language_preferences>
  </brand_voice>

  <target_audience>
    <primary_audience>${audience.primary || ''}</primary_audience>
    <pain_points>${(audience.painPoints || []).join('; ')}</pain_points>
    <needs>${(audience.needs || []).join('; ')}</needs>
    <motivations>${(audience.motivations || []).join('; ')}</motivations>
  </target_audience>
</brand_profile>`;
}

/**
 * Build page/product context if available
 */
function buildPageContext(pageContext) {
  if (!pageContext) return '';

  return `<product_context>
  <product_name>${pageContext.title || ''}</product_name>
  <product_type>${pageContext.type || ''}</product_type>
  <summary>${pageContext.summary || ''}</summary>
  <value_propositions>${(pageContext.valuePropositions || []).join('; ')}</value_propositions>
  <features>${(pageContext.features || []).join('; ')}</features>
  <benefits>${(pageContext.benefits || []).join('; ')}</benefits>
  <target_audience>${pageContext.targetAudience || ''}</target_audience>
</product_context>`;
}

/**
 * Get creative writing examples - good vs bad copy
 */
function getCreativeExamples() {
  return `<examples>
  <example type="bad">
    <copy>Unlock Your Potential Today</copy>
    <why_bad>Generic, overused phrase. Could apply to any brand. No specific benefit or emotion.</why_bad>
  </example>
  <example type="good">
    <copy>Your morning routine, minus the chaos</copy>
    <why_good>Specific pain point (chaotic mornings), implies benefit, conversational tone.</why_good>
  </example>

  <example type="bad">
    <copy>Transform Your Business with Our Solutions</copy>
    <why_bad>Vague "solutions" buzzword. "Transform" is overused. No concrete outcome.</why_bad>
  </example>
  <example type="good">
    <copy>Close deals 40% faster. Yes, really.</copy>
    <why_good>Specific metric, addresses skepticism, confident and direct.</why_good>
  </example>

  <example type="bad">
    <copy>Elevate Your Experience</copy>
    <why_bad>Empty corporate speak. What experience? How is it elevated?</why_bad>
  </example>
  <example type="good">
    <copy>Finally, software that gets out of your way</copy>
    <why_good>Addresses frustration with complex tools, implies simplicity, relatable.</why_good>
  </example>
</examples>`;
}

/**
 * Build emoji instructions based on tactic type
 */
function buildEmojiInstructions(includeEmojis, tacticId, isMultiComponent = false) {
  if (!includeEmojis) return '';

  const isHeadlineType = ['facebook_title', 'google_headline', 'email_subject', 'instagram_caption'].includes(tacticId);

  if (isMultiComponent) {
    return `<emoji_instructions>
  <rule>Place a relevant emoji at the START of each Headline, Title, and Subject Line variation</rule>
  <rule>For body text, use 1-2 emojis strategically within the text</rule>
  <rule>Choose emojis that reinforce the emotion or action in the copy</rule>
  <good_examples>
    <example>🎯 Hit your Q4 targets</example>
    <example>💡 Fresh ideas, zero meetings</example>
    <example>🚀 Ship faster, stress less</example>
  </good_examples>
</emoji_instructions>`;
  }

  if (isHeadlineType) {
    return `<emoji_instructions>
  <rule>Place a relevant emoji at the START of each variation</rule>
  <rule>The emoji should reinforce the emotion or action in the copy</rule>
  <good_examples>
    <example>🎯 Hit your Q4 targets</example>
    <example>💡 Fresh ideas, zero meetings</example>
    <example>🚀 Ship faster, stress less</example>
  </good_examples>
</emoji_instructions>`;
  }

  return `<emoji_instructions>
  <rule>Include 1-2 relevant emojis that enhance the message</rule>
  <rule>Place strategically to draw attention without overwhelming</rule>
</emoji_instructions>`;
}

/**
 * Get current date context for time-sensitive content
 */
function getDateContext() {
  const now = new Date();
  return `Current Date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Current Year: ${now.getFullYear()}
Current Month: ${now.toLocaleDateString('en-US', { month: 'long' })}

IMPORTANT: When writing time-sensitive content (holiday sales, seasonal promotions, New Year campaigns, etc.), ensure all date references are accurate. For example, a "New Year's sale" in December should reference ${now.getFullYear() + 1}, not ${now.getFullYear()}.`;
}

/**
 * Get the system prompt for Claude as a creative copywriter
 */
function getSystemPrompt() {
  return `You are an award-winning creative copywriter with 15 years of experience at top advertising agencies. You specialize in writing punchy, memorable ad copy that cuts through the noise.

${getDateContext()}

Your approach:
- You never use generic marketing buzzwords like "unlock", "elevate", "transform", "solutions", "leverage", or "synergy"
- You write copy that sounds like a human talking to another human, not a corporation talking at customers
- You focus on specific, concrete benefits rather than vague promises
- You understand that great copy often breaks conventional rules - it can be incomplete sentences, unconventional punctuation, or provocative statements
- You create copy that makes people stop scrolling and actually feel something

When writing for a brand, you deeply internalize their voice, personality, and audience before writing a single word.`;
}

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

  // Use tactic's default emoji setting if not explicitly specified
  const useEmojis = includeEmojis !== undefined ? includeEmojis : (tactic.defaultEmojis || false);

  // Build structured prompt with full brand context
  const brandContext = buildBrandContext(brandProfile);
  const productContext = buildPageContext(pageContext);
  const emojiInstr = buildEmojiInstructions(useEmojis, tacticId);
  const examples = getCreativeExamples();

  const prompt = `<task>
Write ${variations} variations of a ${tactic.name} for the brand described below.
Campaign objective: ${campaignObjective}
</task>

${brandContext}

${productContext}

<constraints>
  <max_characters>${tactic.maxChars}</max_characters>
  <max_words>${tactic.maxWords || 'no limit'}</max_words>
</constraints>

${examples}

${emojiInstr}

<instructions>
1. Study the brand profile above. Internalize the brand's personality, voice, and audience.
2. Write ${variations} DISTINCTLY DIFFERENT variations - each should use a completely different angle:
   - Variation 1: Lead with a specific pain point the audience feels
   - Variation 2: Lead with a concrete benefit or outcome
   - Variation 3: Lead with curiosity or intrigue
   ${variations > 3 ? '- Additional variations: Mix urgency, social proof, or unexpected angles' : ''}
3. Make each variation sound like something a real human would say, not corporate marketing speak.
4. Stay within the character and word limits.
5. If a product context is provided, focus on that specific product/service.
</instructions>

<output_format>
Return only JSON with this structure:
{
  "variations": ["variation1", "variation2", ...]
}
</output_format>`;

  try {
    // Use structured outputs for guaranteed valid JSON
    const schema = getSingleComponentSchema(variations);
    const response = await callClaudeForCopy(prompt, env.ANTHROPIC_API_KEY, 1024, schema);
    const parsedResponse = JSON.parse(response);
    const variationsArray = parsedResponse.variations || [];

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

  // Use tactic's default emoji setting if not explicitly specified
  const useEmojis = includeEmojis !== undefined ? includeEmojis : (tactic.defaultEmojis || false);

  // Build structured prompt with full brand context
  const brandContext = buildBrandContext(brandProfile);
  const productContext = buildPageContext(pageContext);
  const emojiInstr = buildEmojiInstructions(useEmojis, tacticId, true);
  const examples = getCreativeExamples();

  // Build component requirements string
  const componentRequirements = tactic.components.map((comp, i) => {
    let req = `${i + 1}. ${comp.name}`;
    if (comp.maxChars) req += ` (max ${comp.maxChars} chars)`;
    if (comp.minChars) req += ` (min ${comp.minChars} chars)`;
    req += ` - ${comp.count} variation${comp.count > 1 ? 's' : ''}`;
    return req;
  }).join('\n   ');

  // Build the JSON structure example
  const jsonStructure = {
    components: tactic.components.map(comp => ({
      name: comp.name,
      variations: Array(comp.count).fill('').map((_, i) => `${comp.name.toLowerCase().replace(/\s+/g, '_')}_${i + 1}`)
    }))
  };

  const prompt = `<task>
Create a complete ${tactic.name} for the brand described below.
Campaign objective: ${campaignObjective}
</task>

${brandContext}

${productContext}

<components_required>
   ${componentRequirements}
</components_required>

${tactic.ctaOptions ? `<cta_options>${tactic.ctaOptions.join(', ')}</cta_options>` : ''}

${examples}

${emojiInstr}

<instructions>
1. Study the brand profile above. Internalize the brand's personality, voice, and audience.
2. For each component, write variations that:
   - Sound authentically human, not like corporate marketing speak
   - Use specific, concrete language over vague promises
   - Connect emotionally with the target audience's pain points or desires
3. Make each variation within a component distinctly different in angle and approach.
4. Headlines should be punchy and attention-grabbing.
5. Body text should expand on the headline's promise with specifics.
6. If a product context is provided, focus on that specific product/service.
7. Stay within all character limits.
</instructions>

<output_format>
Return only JSON with this exact structure:
${JSON.stringify(jsonStructure, null, 2)}
</output_format>`;

  try {
    // Use structured outputs for guaranteed valid JSON
    const schema = getMultiComponentSchema();
    const response = await callClaudeForCopy(prompt, env.ANTHROPIC_API_KEY, 2048, schema);
    const parsedData = JSON.parse(response);

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

// Note: parseVariations, parseJSONWithFallback, and parseStructuredText
// have been removed - structured outputs guarantee valid JSON responses

/**
 * Generate JSON schema for single-component variations
 */
function getSingleComponentSchema(variationCount) {
  return {
    type: 'object',
    properties: {
      variations: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['variations'],
    additionalProperties: false
  };
}

/**
 * Generate JSON schema for multi-component ad copy
 */
function getMultiComponentSchema() {
  return {
    type: 'object',
    properties: {
      components: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            variations: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['name', 'variations'],
          additionalProperties: false
        }
      }
    },
    required: ['components'],
    additionalProperties: false
  };
}

/**
 * Call Claude API for ad copy generation with structured outputs and system prompt
 */
async function callClaudeForCopy(prompt, apiKey, maxTokens = 512, outputSchema = null) {
  const requestBody = {
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: maxTokens,
    temperature: 0.9, // Higher temperature for more creative, varied output
    system: getSystemPrompt(), // Set Claude's persona as a creative copywriter
    messages: [{
      role: 'user',
      content: prompt,
    }],
  };

  // Add structured output format if schema provided
  if (outputSchema) {
    requestBody.output_format = {
      type: 'json_schema',
      schema: outputSchema
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  // Add beta header for structured outputs
  if (outputSchema) {
    headers['anthropic-beta'] = 'structured-outputs-2025-11-13';
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
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
