/**
 * Context Agent - Fast prompt improvement using Claude Haiku
 * Generates targeted questions and answers to enhance generation prompts
 */

import { getCorsHeaders, jsonResponse, errorResponse } from './cors.js';
import {
  detectPlatformType,
  buildPlatformAdPrompt,
  parsePlatformAdResponse,
  isSocialPost,
  PLATFORM_LIMITS,
} from './platform-ads.js';

/**
 * Generate a unique ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get brand profile by ID
 */
async function getBrandProfile(brandProfileId, env) {
  const result = await env.DB.prepare(
    'SELECT * FROM brand_profiles WHERE id = ?'
  ).bind(brandProfileId).first();

  if (!result) return null;

  return {
    ...result,
    voice_personality: JSON.parse(result.voice_personality || '[]'),
    tone_sliders: JSON.parse(result.tone_sliders || '{}'),
    lexicon_preferred: JSON.parse(result.lexicon_preferred || '[]'),
    lexicon_avoid: JSON.parse(result.lexicon_avoid || '[]'),
    value_props: JSON.parse(result.value_props || '[]'),
    audience_needs: JSON.parse(result.audience_needs || '[]'),
    audience_pain_points: JSON.parse(result.audience_pain_points || '[]'),
  };
}

/**
 * System prompt for the Context Agent - question generation
 */
const QUESTION_GENERATION_PROMPT = `You are a prompt refinement assistant for marketing content generation. Your job is to analyze the user's prompt and generate 2-4 targeted clarifying questions that will help generate better content.

## Analysis Framework

When analyzing a prompt, identify gaps in:
1. **Audience Specificity** - Who exactly will see this content?
2. **Emotional Hooks** - What pain points or desires should we address?
3. **Differentiators** - What makes this offering unique?
4. **Context** - What's the situation, urgency, or use case?

## Question Categories

- \`audience\`: Questions about who the content is for
- \`tone\`: Questions about voice, style, energy level
- \`benefits\`: Questions about value propositions and outcomes
- \`constraints\`: Questions about limitations and requirements
- \`context\`: Questions about background, use case, timing

## Output Rules

1. Generate 2-4 questions maximum
2. Each question should target a different gap
3. Mark questions as \`suggestGenerate: true\` when the answer can likely be derived from brand context
4. Provide a clear \`generatePrompt\` that can be used to auto-generate the answer
5. Questions should be specific and actionable, not generic

Return JSON with this exact structure:
{
  "questions": [
    {
      "id": "q1",
      "question": "The question text",
      "purpose": "Brief explanation of why this helps",
      "suggestGenerate": true,
      "generatePrompt": "If suggestGenerate is true, the prompt to generate an answer",
      "category": "audience"
    }
  ],
  "detectedContext": {
    "templateType": "detected template type",
    "possibleAudiences": ["audience1", "audience2"],
    "suggestedTone": "suggested tone based on prompt"
  }
}`;

/**
 * System prompt for answer generation
 */
const ANSWER_GENERATION_PROMPT = `You are a marketing assistant helping to fill in context for content generation. Based on the brand profile and the question asked, generate a helpful, specific answer.

Rules:
1. Keep answers concise (1-3 sentences)
2. Use specific details from the brand profile when available
3. If inferring, make reasonable assumptions based on the brand's industry and audience
4. Write in a natural, helpful tone

Return ONLY the answer text, no JSON or formatting.`;

/**
 * Build brand context string for prompts
 */
function buildBrandContext(brandProfile) {
  if (!brandProfile) return '';

  return `
Brand: ${brandProfile.name || 'Unknown'}
Tagline: ${brandProfile.tagline || ''}
Positioning: ${brandProfile.positioning || ''}

Target Audience: ${brandProfile.audience_primary || ''}
Audience Needs: ${(brandProfile.audience_needs || []).join(', ')}
Pain Points: ${(brandProfile.audience_pain_points || []).join(', ')}

Value Propositions: ${(brandProfile.value_props || []).join(', ')}

Voice Personality: ${(brandProfile.voice_personality || []).join(', ')}
Preferred Phrases: ${(brandProfile.lexicon_preferred || []).join(', ')}
`.trim();
}

/**
 * POST /api/improve-prompt
 * Generate targeted questions to improve a prompt
 */
export async function handleImprovePrompt(request, env) {
  try {
    const body = await request.json();
    const { prompt, templateType, brandProfileId, existingContext } = body;

    if (!prompt || !prompt.trim()) {
      return errorResponse('Prompt is required', request, 400);
    }

    // Get brand profile if provided
    let brandProfile = null;
    if (brandProfileId) {
      brandProfile = await getBrandProfile(brandProfileId, env);
    }

    // Build the user message for question generation
    const userMessage = `Analyze this prompt and generate questions to improve it:

<user_prompt>
${prompt}
</user_prompt>

<template_type>${templateType || 'general'}</template_type>

${brandProfile ? `<brand_context>\n${buildBrandContext(brandProfile)}\n</brand_context>` : ''}

${existingContext ? `<existing_selections>
Selected Audiences: ${existingContext.selectedAudiences?.join(', ') || 'None'}
Selected Tone: ${existingContext.selectedTone || 'None'}
Talking Points: ${existingContext.talkingPoints?.join(', ') || 'None'}
</existing_selections>` : ''}

Generate 2-4 targeted questions that will help improve this content. Focus on gaps not already covered by existing selections.`;

    // Call Claude Haiku for fast response
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: userMessage
        }],
        system: QUESTION_GENERATION_PROMPT,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return errorResponse(`AI service error: ${response.status}`, request, 500);
    }

    const data = await response.json();
    const responseText = data.content[0].text;

    // Parse JSON from response
    let parsed;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse questions response:', parseError, responseText);
      // Return fallback questions
      parsed = {
        questions: [
          {
            id: 'q1',
            question: 'Who is the primary audience for this content?',
            purpose: 'Helps tailor the message to the right people',
            suggestGenerate: true,
            generatePrompt: 'Based on the brand profile, describe the ideal audience for this content',
            category: 'audience'
          },
          {
            id: 'q2',
            question: 'What specific benefit or outcome should we highlight?',
            purpose: 'Focuses the message on value',
            suggestGenerate: true,
            generatePrompt: 'Based on the brand value propositions, suggest the key benefit to highlight',
            category: 'benefits'
          }
        ],
        detectedContext: {
          templateType: templateType || 'general',
          possibleAudiences: brandProfile?.audience_primary ? [brandProfile.audience_primary] : [],
          suggestedTone: 'professional'
        }
      };
    }

    // Ensure all questions have IDs
    parsed.questions = parsed.questions.map((q, i) => ({
      ...q,
      id: q.id || `q${i + 1}`
    }));

    return jsonResponse(parsed, request);

  } catch (error) {
    console.error('Improve prompt error:', error);
    return errorResponse(error.message, request, 500);
  }
}

/**
 * POST /api/generate-answer
 * Auto-generate an answer to a context question
 */
export async function handleGenerateAnswer(request, env) {
  try {
    const body = await request.json();
    const { questionId, question, generatePrompt, brandProfileId, templateType, category } = body;

    if (!question || !generatePrompt) {
      return errorResponse('Question and generatePrompt are required', request, 400);
    }

    // Get brand profile if provided
    let brandProfile = null;
    if (brandProfileId) {
      brandProfile = await getBrandProfile(brandProfileId, env);
    }

    // Build the user message for answer generation
    const userMessage = `${brandProfile ? `<brand_profile>\n${buildBrandContext(brandProfile)}\n</brand_profile>\n\n` : ''}
<template_type>${templateType || 'general'}</template_type>

<question>${question}</question>

<task>${generatePrompt}</task>

Generate a helpful, specific answer (1-3 sentences).`;

    // Call Claude Haiku for fast response
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: userMessage
        }],
        system: ANSWER_GENERATION_PROMPT,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return errorResponse(`AI service error: ${response.status}`, request, 500);
    }

    const data = await response.json();
    const answer = data.content[0].text.trim();

    // Determine source based on whether we had brand profile data
    const source = brandProfile ? 'brand_profile' : 'generated';

    // Simple confidence heuristic
    const confidence = brandProfile ? 0.85 : 0.7;

    return jsonResponse({
      answer,
      confidence,
      source,
      questionId,
    }, request);

  } catch (error) {
    console.error('Generate answer error:', error);
    return errorResponse(error.message, request, 500);
  }
}

/**
 * POST /api/generate
 * Main content generation with SSE streaming for progressive UI
 */
export async function handleGenerate(request, env, ctx) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const body = await request.json();
    const {
      prompt,
      templateType,
      brandProfileId,
      variantCount = 3,
      selectedAudiences = [],
      selectedTone = 'professional',
      talkingPoints = [],
      contextAnswers = {},
      qualityMode = false, // Optional: enable extended thinking for higher quality
    } = body;

    if (!prompt || !prompt.trim()) {
      return errorResponse('Prompt is required', request, 400);
    }

    // Get brand profile
    let brandProfile = null;
    if (brandProfileId) {
      brandProfile = await getBrandProfile(brandProfileId, env);
    }

    // Detect if this is a Google Ads template
    const googleAdType = detectGoogleAdType(templateType);
    const isGoogleAds = googleAdType !== null;

    // Detect if this is another platform ad type
    const platformType = detectPlatformType(templateType);
    const isPlatformAd = platformType !== null && !isGoogleAds;

    // Build the appropriate prompt
    let enhancedPrompt;
    if (isGoogleAds) {
      enhancedPrompt = buildGoogleAdsPrompt({
        basePrompt: prompt,
        templateType,
        brandProfile,
        selectedAudiences,
        selectedTone,
        talkingPoints,
        contextAnswers,
        adType: googleAdType,
      });
    } else if (isPlatformAd) {
      enhancedPrompt = buildPlatformAdPrompt({
        basePrompt: prompt,
        platformType,
        templateType,
        brandProfile,
        selectedAudiences,
        selectedTone,
        talkingPoints,
        contextAnswers,
        variantCount,
      });
    } else {
      enhancedPrompt = buildEnhancedPrompt({
        basePrompt: prompt,
        templateType,
        brandProfile,
        selectedAudiences,
        selectedTone,
        talkingPoints,
        contextAnswers,
        variantCount,
      });
    }

    // Create streaming response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start the streaming response in the background
    const streamPromise = (async () => {
      let keepaliveInterval;
      let fullResponse = '';

      try {
        // Set up keepalive to prevent timeout
        keepaliveInterval = setInterval(() => {
          writer.write(encoder.encode(': keepalive\n\n'));
        }, 15000);

        // Send status update
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'status', message: 'Generating content...' })}\n\n`));

        // Build API request with structured outputs for clean JSON responses
        const apiBody = {
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8000,
          stream: true,
          messages: [{
            role: 'user',
            content: enhancedPrompt
          }],
          system: buildGenerationSystemPrompt(templateType),
        };

        // Only enable extended thinking in quality mode (adds ~10s latency)
        if (qualityMode) {
          apiBody.thinking = {
            type: 'enabled',
            budget_tokens: 5000,
          };
        }

        // API headers - include structured outputs beta for clean JSON
        const apiHeaders = {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        };

        // Call Claude with streaming
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify(apiBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Claude API error:', response.status, errorText);
          throw new Error(`AI service error: ${response.status}`);
        }

        // Process the stream - collecting JSON response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let variantsEmitted = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);

                // Handle content_block_delta events (text streaming)
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  const text = parsed.delta.text;
                  fullResponse += text;

                  // Stream progress indicator (don't stream raw JSON to UI)
                  // The UI will get variants when we parse the complete JSON
                }
              } catch (e) {
                // Skip non-JSON lines
              }
            }
          }
        }

        // Parse the response based on content type
        if (isGoogleAds) {
          // Parse Google Ads structured response
          const googleAdsData = parseGoogleAdsResponse(fullResponse, googleAdType);

          if (googleAdsData) {
            // Send Google Ads structured data
            await writer.write(encoder.encode(`data: ${JSON.stringify({
              type: 'google_ads',
              data: googleAdsData,
              templateType,
              templateName: templateType,
            })}\n\n`));

            // Send completion with Google Ads data
            await writer.write(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              isGoogleAds: true,
              googleAdsData,
              templateType
            })}\n\n`));
          } else {
            // Fallback to regular parsing if Google Ads parsing failed
            const allVariants = parseJsonVariants(fullResponse, variantCount);
            for (const variant of allVariants) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'variant', variant })}\n\n`));
            }
            await writer.write(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              variants: allVariants,
              templateType
            })}\n\n`));
          }
        } else if (isPlatformAd) {
          // Parse platform-specific ad response
          const platformData = parsePlatformAdResponse(fullResponse, platformType);

          if (platformData) {
            // Send platform ad structured data
            await writer.write(encoder.encode(`data: ${JSON.stringify({
              type: 'platform_ad',
              data: platformData,
              platformType,
              templateType,
              templateName: platformData.templateName,
            })}\n\n`));

            // Send completion with platform data
            await writer.write(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              isPlatformAd: true,
              platformData,
              platformType,
              templateType
            })}\n\n`));
          } else {
            // Fallback to regular parsing if platform parsing failed
            const allVariants = parseJsonVariants(fullResponse, variantCount);
            for (const variant of allVariants) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'variant', variant })}\n\n`));
            }
            await writer.write(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              variants: allVariants,
              templateType
            })}\n\n`));
          }
        } else {
          // Standard variant parsing
          const allVariants = parseJsonVariants(fullResponse, variantCount);

          // Emit all variants
          for (const variant of allVariants) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'variant', variant })}\n\n`));
          }

          // Send completion with all variants
          await writer.write(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            variants: allVariants,
            templateType
          })}\n\n`));
        }

        // Send done signal
        await writer.write(encoder.encode('data: [DONE]\n\n'));

      } catch (error) {
        console.error('Generate streaming error:', error);
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`));
      } finally {
        if (keepaliveInterval) clearInterval(keepaliveInterval);
        await writer.close();
      }
    })();

    // Use ctx.waitUntil if available, otherwise just start the promise
    if (ctx && ctx.waitUntil) {
      ctx.waitUntil(streamPromise);
    } else {
      streamPromise.catch(console.error);
    }

    // Return the streaming response with proper headers
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Generate error:', error);
    return errorResponse(error.message, request, 500);
  }
}

/**
 * Strip markdown formatting from content
 */
function stripMarkdown(text) {
  if (!text) return '';
  return text
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove headers
    .replace(/^#+\s*/gm, '')
    // Remove bullet points at start of lines
    .replace(/^[-*]\s*/gm, '')
    // Remove numbered lists
    .replace(/^\d+\.\s*/gm, '')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parse JSON variants from response text
 */
function parseJsonVariants(responseText, expectedCount) {
  const variants = [];

  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*"variants"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      if (parsed.variants && Array.isArray(parsed.variants)) {
        for (const v of parsed.variants) {
          // Strip any markdown that may have leaked through
          const cleanContent = stripMarkdown(v.content || '');

          if (cleanContent) {
            variants.push({
              id: generateId(),
              content: cleanContent,
              label: v.label || null, // Include label for grouping/display
              rationale: stripMarkdown(v.rationale || ''),
              charCount: cleanContent.length,
              performanceScore: Math.floor(70 + Math.random() * 25),
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to parse JSON variants:', e);
  }

  // Fallback: if JSON parsing failed, try to extract content manually
  if (variants.length === 0) {
    // Try splitting by common patterns
    const cleanedText = stripMarkdown(responseText);

    if (cleanedText.length > 50) {
      variants.push({
        id: generateId(),
        content: cleanedText,
        rationale: '',
        charCount: cleanedText.length,
        performanceScore: 75,
      });
    }
  }

  return variants;
}

/**
 * Google Ads character limits based on Google Ads specs
 */
const GOOGLE_ADS_LIMITS = {
  'google-app': {
    headline: 30,
    description: 90,
    maxHeadlines: 5,
    maxDescriptions: 5,
    idealHeadlineLength: 25,
    idealDescriptionLength: 70,
  },
  'google-rsa': {
    headline: 30,
    description: 90,
    maxHeadlines: 15,
    maxDescriptions: 4,
    idealHeadlineLength: 25,
    idealDescriptionLength: 80,
  },
  'google-demand-gen': {
    headline: 40,
    description: 90,
    maxHeadlines: 5,
    maxDescriptions: 5,
    idealHeadlineLength: 30,
    idealDescriptionLength: 70,
  },
  'google-display': {
    headline: 30,
    longHeadline: 90,
    description: 90,
    maxHeadlines: 5,
    maxLongHeadlines: 1,
    maxDescriptions: 5,
    idealHeadlineLength: 25,
    idealDescriptionLength: 70,
  },
  'google-pmax': {
    headline: 30,
    longHeadline: 90,
    description: 90,
    maxHeadlines: 15,
    maxLongHeadlines: 5,
    maxDescriptions: 5,
    idealHeadlineLength: 25,
    idealDescriptionLength: 70,
  },
};

/**
 * Detect if template is a Google Ads type and return the specific type
 */
function detectGoogleAdType(templateType) {
  if (!templateType) return null;
  const templateLower = templateType.toLowerCase();

  if (templateLower.includes('google-app') || templateLower.includes('app-ad')) {
    return 'google-app';
  }
  if (templateLower.includes('google-search') || templateLower.includes('google-rsa') || templateLower.includes('responsive-search')) {
    return 'google-rsa';
  }
  if (templateLower.includes('google-demand') || templateLower.includes('demand-gen')) {
    return 'google-demand-gen';
  }
  if (templateLower.includes('google-display') || templateLower.includes('responsive-display')) {
    return 'google-display';
  }
  if (templateLower.includes('google-pmax') || templateLower.includes('performance-max')) {
    return 'google-pmax';
  }

  return null;
}

/**
 * Build prompt specifically for Google Ads generation
 */
function buildGoogleAdsPrompt({
  basePrompt,
  templateType,
  brandProfile,
  selectedAudiences,
  selectedTone,
  talkingPoints,
  contextAnswers,
  adType,
}) {
  const limits = GOOGLE_ADS_LIMITS[adType];

  let prompt = `Generate Google Ads copy following strict character limits.

<ad_request>
${basePrompt}
</ad_request>

<ad_type>${templateType}</ad_type>

`;

  // Add brand context with STRONG enforcement
  if (brandProfile) {
    prompt += `<brand_profile>
${buildBrandContext(brandProfile)}

WORDS/PHRASES TO AVOID (NEVER USE):
${(brandProfile.lexicon_avoid || []).length > 0 ? brandProfile.lexicon_avoid.join(', ') : 'None specified'}
</brand_profile>

## BRAND VOICE REQUIREMENTS (CRITICAL)

You MUST write copy that embodies this brand's voice. This is not optional.

${brandProfile.voice_personality?.length > 0 ? `**Voice Personality Traits to Embody**: ${brandProfile.voice_personality.join(', ')}
Every headline and description must feel ${brandProfile.voice_personality.slice(0, 3).join(', ')}.` : ''}

${brandProfile.lexicon_preferred?.length > 0 ? `**Preferred Language**: Actively incorporate these phrases/words where natural:
${brandProfile.lexicon_preferred.map(p => `• "${p}"`).join('\n')}` : ''}

${brandProfile.lexicon_avoid?.length > 0 ? `**BANNED Language** (do NOT use any of these):
${brandProfile.lexicon_avoid.map(p => `• "${p}"`).join('\n')}` : ''}

${brandProfile.value_props?.length > 0 ? `**Key Value Propositions** (use these as messaging anchors):
${brandProfile.value_props.map((vp, i) => `${i + 1}. ${vp}`).join('\n')}` : ''}

${brandProfile.audience_pain_points?.length > 0 ? `**Pain Points to Address**:
${brandProfile.audience_pain_points.map(pp => `• ${pp}`).join('\n')}` : ''}

`;
  }

  // Add selected audiences
  if (selectedAudiences && selectedAudiences.length > 0) {
    prompt += `<target_audiences>
${selectedAudiences.join(', ')}
</target_audiences>

`;
  }

  // Add tone
  if (selectedTone) {
    prompt += `<tone_of_voice>${selectedTone}</tone_of_voice>

`;
  }

  // Add talking points
  if (talkingPoints && talkingPoints.length > 0) {
    prompt += `<key_talking_points>
${talkingPoints.map(tp => `- ${tp}`).join('\n')}
</key_talking_points>

`;
  }

  // Add context answers
  if (contextAnswers && Object.keys(contextAnswers).length > 0) {
    prompt += `<additional_context>
${Object.entries(contextAnswers).map(([key, value]) => `${key}: ${value}`).join('\n')}
</additional_context>

`;
  }

  // Add specific Google Ads requirements
  prompt += `## CHARACTER LIMITS (CRITICAL - MUST FOLLOW)

`;

  if (limits.headline) {
    prompt += `Headlines: MAXIMUM ${limits.headline} characters each. Ideal: ${limits.idealHeadlineLength} characters.
`;
  }
  if (limits.longHeadline) {
    prompt += `Long Headlines: MAXIMUM ${limits.longHeadline} characters each. Ideal: 70-80 characters.
`;
  }
  if (limits.description) {
    prompt += `Descriptions: MAXIMUM ${limits.description} characters each. Ideal: ${limits.idealDescriptionLength} characters.
`;
  }

  prompt += `
## QUANTITY REQUIREMENTS

Generate:
- ${limits.maxHeadlines} headlines (each UNDER ${limits.headline} characters)
`;

  if (limits.maxLongHeadlines) {
    prompt += `- ${limits.maxLongHeadlines} long headline${limits.maxLongHeadlines > 1 ? 's' : ''} (each UNDER ${limits.longHeadline} characters)
`;
  }

  prompt += `- ${limits.maxDescriptions} descriptions (each UNDER ${limits.description} characters)

## GOOGLE ADS BEST PRACTICES

1. Front-load benefits and key info in first 15-20 characters
2. Include strong CTAs (Get, Try, Start, Save, Discover)
3. Use numbers and specific data when possible
4. Each headline should work standalone AND in combination with others
5. Vary approaches: some benefit-focused, some feature-focused, some urgency-based
6. Avoid trademark issues - don't use competitor names
7. Include location if locally targeted
8. Test emotional vs rational appeals
9. MAINTAIN BRAND VOICE - copy should sound distinctly like this brand, not generic
10. Use the brand's preferred language and terminology where possible

## OUTPUT FORMAT

Return JSON with this exact structure:
{
  "adType": "${adType}",
  "headlines": [
    {
      "content": "Headline text here",
      "qualityScore": 75,
      "strategy": "benefit-focused"
    }
  ],
  ${limits.maxLongHeadlines ? `"longHeadlines": [
    {
      "content": "Long headline text here",
      "qualityScore": 75,
      "strategy": "benefit-focused"
    }
  ],
  ` : ''}"descriptions": [
    {
      "content": "Description text here",
      "qualityScore": 80,
      "strategy": "cta-driven"
    }
  ]
}

Quality Score Guidelines:
- 80-100: Perfect length, strong hook, clear CTA, uses brand's preferred language, matches voice personality
- 60-79: Good but could improve (generic phrasing, not using brand language, weak hook)
- Below 60: Issues (too long, completely generic, doesn't match brand voice, uses banned words)

CRITICAL: Every headline MUST be under ${limits.headline} characters. Every description MUST be under ${limits.description} characters. Count characters carefully!`;

  return prompt;
}

/**
 * Parse Google Ads structured response
 */
function parseGoogleAdsResponse(responseText, adType) {
  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*"headlines"[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const limits = GOOGLE_ADS_LIMITS[adType];

    // Process headlines
    const headlines = (parsed.headlines || []).map((h, i) => ({
      id: `headline-${i + 1}-${Date.now()}`,
      type: 'headline',
      content: (h.content || '').trim(),
      qualityScore: calculateQualityScore(h.content, limits.headline, limits.idealHeadlineLength, h.qualityScore),
      strategy: h.strategy || 'general',
      isSaved: false,
    }));

    // Process long headlines if applicable
    const longHeadlines = limits.maxLongHeadlines ? (parsed.longHeadlines || []).map((h, i) => ({
      id: `long-headline-${i + 1}-${Date.now()}`,
      type: 'longHeadline',
      content: (h.content || '').trim(),
      qualityScore: calculateQualityScore(h.content, limits.longHeadline, 75, h.qualityScore),
      strategy: h.strategy || 'general',
      isSaved: false,
    })) : [];

    // Process descriptions
    const descriptions = (parsed.descriptions || []).map((d, i) => ({
      id: `description-${i + 1}-${Date.now()}`,
      type: 'description',
      content: (d.content || '').trim(),
      qualityScore: calculateQualityScore(d.content, limits.description, limits.idealDescriptionLength, d.qualityScore),
      strategy: d.strategy || 'general',
      isSaved: false,
    }));

    return {
      isGoogleAds: true,
      adType,
      headlines,
      longHeadlines,
      descriptions,
    };
  } catch (e) {
    console.error('Failed to parse Google Ads response:', e);
    return null;
  }
}

/**
 * Calculate quality score based on content length and limits
 */
function calculateQualityScore(content, maxLength, idealLength, suggestedScore) {
  if (!content) return 0;

  const length = content.length;

  // Penalize heavily if over limit
  if (length > maxLength) {
    return Math.max(10, 50 - (length - maxLength) * 2);
  }

  // Start with suggested score or default
  let score = suggestedScore || 70;

  // Bonus for hitting ideal length range
  if (length >= idealLength * 0.8 && length <= idealLength * 1.1) {
    score = Math.min(100, score + 10);
  }

  // Slight penalty for being too short
  if (length < idealLength * 0.5) {
    score = Math.max(50, score - 10);
  }

  return Math.round(score);
}

/**
 * Get template-specific label examples based on the template type
 * This ensures generated content is labeled appropriately for the selected template
 */
function getTemplateLabelExamples(templateType) {
  if (!templateType || templateType === 'general') {
    return ['Content Variant'];
  }

  const templateLower = templateType.toLowerCase();

  // Email templates
  if (templateLower.includes('email')) {
    if (templateLower.includes('discount') || templateLower.includes('promo')) {
      return ['Email Subject Line', 'Email Preview Text', 'Email Body - Offer Section', 'Email CTA'];
    }
    if (templateLower.includes('newsletter')) {
      return ['Newsletter Subject', 'Newsletter Opening', 'Newsletter Body Section'];
    }
    if (templateLower.includes('welcome') || templateLower.includes('drip')) {
      return ['Welcome Email Subject', 'Welcome Email Body', 'Welcome Email CTA'];
    }
    if (templateLower.includes('cold') || templateLower.includes('outreach')) {
      return ['Cold Email Subject', 'Cold Email Opening Hook', 'Cold Email Body'];
    }
    if (templateLower.includes('subject')) {
      return ['Email Subject Line A', 'Email Subject Line B', 'Email Subject Line C'];
    }
    // Default email
    return ['Email Subject Line', 'Email Body', 'Email CTA'];
  }

  // Social media templates
  if (templateLower.includes('instagram')) {
    return ['Instagram Caption', 'Instagram Opening Hook', 'Instagram Hashtags'];
  }
  if (templateLower.includes('facebook')) {
    return ['Facebook Post', 'Facebook Caption', 'Facebook CTA'];
  }
  if (templateLower.includes('linkedin')) {
    return ['LinkedIn Post Opening', 'LinkedIn Post Body', 'LinkedIn CTA'];
  }
  if (templateLower.includes('x-') || templateLower.includes('twitter')) {
    return ['Tweet', 'Tweet Thread Hook', 'Tweet CTA'];
  }

  // Google Ads templates
  if (templateLower.includes('google-search') || templateLower.includes('google-rsa')) {
    return ['Google Ad Headline 1', 'Google Ad Headline 2', 'Google Ad Description'];
  }
  if (templateLower.includes('google-display')) {
    return ['Display Ad Headline', 'Display Ad Description', 'Display Ad CTA'];
  }
  if (templateLower.includes('google-video') || templateLower.includes('youtube')) {
    return ['Video Ad Hook', 'Video Ad Script Opening', 'Video Ad CTA'];
  }
  if (templateLower.includes('google-shopping')) {
    return ['Product Title', 'Product Description', 'Promotional Text'];
  }
  if (templateLower.includes('google-pmax') || templateLower.includes('google-demand')) {
    return ['Ad Headline', 'Ad Long Headline', 'Ad Description'];
  }
  if (templateLower.includes('google')) {
    return ['Google Ad Headline', 'Google Ad Description'];
  }

  // Meta Ads templates
  if (templateLower.includes('meta-image') || templateLower.includes('meta-carousel')) {
    return ['Meta Ad Primary Text', 'Meta Ad Headline', 'Meta Ad Description'];
  }
  if (templateLower.includes('meta-video') || templateLower.includes('meta-reel')) {
    return ['Reels Caption', 'Reels Hook', 'Reels CTA'];
  }
  if (templateLower.includes('meta')) {
    return ['Meta Ad Primary Text', 'Meta Ad Headline', 'Meta Ad Link Description'];
  }

  // Landing page templates
  if (templateLower.includes('landing') || templateLower.includes('hero')) {
    return ['Landing Page Headline', 'Landing Page Subheadline', 'Landing Page CTA'];
  }

  // Website templates
  if (templateLower.includes('website') || templateLower.includes('homepage')) {
    return ['Website Headline', 'Website Subheadline', 'Website Body Copy'];
  }

  // Fallback
  return ['Content Variant'];
}

/**
 * Build enhanced prompt with all context
 */
function buildEnhancedPrompt({
  basePrompt,
  templateType,
  brandProfile,
  selectedAudiences,
  selectedTone,
  talkingPoints,
  contextAnswers,
  variantCount,
}) {
  let enhancedPrompt = `Generate ${variantCount} unique variations of marketing content.

<original_request>
${basePrompt}
</original_request>

<content_type>${templateType || 'general marketing content'}</content_type>

`;

  // Add brand context
  if (brandProfile) {
    enhancedPrompt += `<brand_profile>
${buildBrandContext(brandProfile)}
</brand_profile>

`;
  }

  // Add selected audiences
  if (selectedAudiences.length > 0) {
    enhancedPrompt += `<target_audiences>
${selectedAudiences.join(', ')}
</target_audiences>

`;
  }

  // Add tone
  if (selectedTone) {
    enhancedPrompt += `<tone_of_voice>${selectedTone}</tone_of_voice>

`;
  }

  // Add talking points
  if (talkingPoints.length > 0) {
    enhancedPrompt += `<key_talking_points>
${talkingPoints.map(tp => `- ${tp}`).join('\n')}
</key_talking_points>

`;
  }

  // Add context answers from improve flow
  if (Object.keys(contextAnswers).length > 0) {
    enhancedPrompt += `<additional_context>
${Object.entries(contextAnswers).map(([key, value]) => `${key}: ${value}`).join('\n')}
</additional_context>

`;
  }

  // Get template-specific label examples
  const labelExamples = getTemplateLabelExamples(templateType);
  const labelExamplesStr = labelExamples.join("', '");

  enhancedPrompt += `Generate ${variantCount} distinct variations. Each variation should have different angles, hooks, and approaches.

IMPORTANT: You are generating content for "${templateType || 'general marketing content'}".
Labels MUST be appropriate for this content type. Use labels like: '${labelExamplesStr}'.
Do NOT use labels for other content types (e.g., if generating email content, do NOT label as "Landing Page" or "Social Media").

For each variant provide:
- The main content (clean text, no markdown formatting)
- A brief rationale explaining the approach

Return your response as a JSON object with this exact structure:
{
  "variants": [
    {
      "label": "A label appropriate for ${templateType || 'the content type'} (e.g., '${labelExamples[0]}')",
      "content": "The content text here, no markdown. Preserve paragraph breaks with newlines.",
      "rationale": "Brief explanation of the approach"
    }
  ]
}`;

  return enhancedPrompt;
}

/**
 * Universal Marketing Principles (from agents/base/marketing-principles.md)
 * These rules apply to ALL content generation
 */
const UNIVERSAL_MARKETING_PRINCIPLES = `
## Core Marketing Principles

1. **Clarity over Cleverness**: Clear communication always beats clever wordplay
2. **Benefits before Features**: Lead with transformation, support with specs
3. **Specificity Builds Trust**: "Increase leads by 40%" > "Get more leads"
4. **Urgency without Pressure**: Create FOMO naturally, not artificially
5. **Social Proof Integration**: Weave in proof points authentically
6. **Emotional then Logical**: Hook with emotion, close with logic

## MANDATORY Grammar & Style Rules

### Sentence Structure
- **Maximum 19 words per sentence** - Break longer sentences into two
- **Less than 9% passive voice** - Use active voice 91%+ of the time
- Vary sentence length for rhythm (mix short punchy with medium)

### CRITICAL Punctuation Rules

**NEVER USE:**
- Em dashes (—) - Use commas, periods, or colons instead
- En dashes (–) for emphasis - Use commas or restructure
- Semicolons for casual content - Break into separate sentences
- Ellipsis (...) unless indicating trailing off

**ALWAYS USE:**
- Commas for natural pauses
- Periods for clear sentence endings
- Colons to introduce lists or explanations

### Dangling Modifiers - AVOID AT ALL COSTS

A dangling modifier modifies something not clearly stated in the sentence.

**WRONG:** "Walking to the store, the rain started falling." (Who is walking?)
**CORRECT:** "Walking to the store, I noticed the rain starting to fall."

**The Rule:** The subject immediately following an introductory phrase MUST be the one performing the action.

### Active vs Passive Voice

**PASSIVE (Avoid):** "The project was completed by our team."
**ACTIVE (Preferred):** "Our team completed the project."

### Contractions
Use contractions to sound human: we're, don't, can't, won't, you'll, they're, it's

### Words to Avoid
- "Very", "Really", "Just", "Actually", "Literally", "Basically"
- "In order to" → use "to"
- "Due to the fact that" → use "because"

## Question Policy

### Question Budget (Channel-Dependent)
- Google Search RSA: 0-1 only when mirroring search intent
- Meta Feed/Reels: 0-1 pattern interrupts only
- Email subjects: 0-1 if it mirrors user thought
- Display/YouTube: 0 (visual does the interrupt)
- SMS: 0 (feels spammy)

### Banned Question Templates - NEVER USE:
- "Why choose us?"
- "Still thinking about...?" / "Still putting off...?"
- "What are you waiting for?"
- "Ready to...?" / "Are you ready to...?"
- "Looking for...?" (only allowed in Search if mirroring keyword)
- "Here's your sign..."
- "Dream X is calling..."

If you use a question, it MUST:
1. Mirror a real user thought
2. Be specific (concrete situation/outcome)
3. Be short (3-8 words)
4. Be immediately answered in the next sentence

## Humanization Techniques

### DO:
- Use contractions naturally
- Vary sentence length and structure
- Add specific details and examples
- Include occasional interjections (Well, Indeed, Certainly)

### DON'T:
- Repeat the same phrases
- Use robotic, formulaic patterns
- Use the same sentence structure repeatedly
- Sound overly formal or stiff
`;

/**
 * Get current date context for time-sensitive content
 */
function getDateContext() {
  const now = new Date();
  return `## Current Date Context
Today's Date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Current Year: ${now.getFullYear()}
Current Month: ${now.toLocaleDateString('en-US', { month: 'long' })}
Current Quarter: Q${Math.ceil((now.getMonth() + 1) / 3)}

IMPORTANT: Use this date information for all time-sensitive content. When mentioning years, holidays, seasons, or upcoming events, ensure they are accurate relative to today's date. For example:
- A "New Year's sale" in December should reference the UPCOMING year (${now.getFullYear() + 1}), not the current year
- Holiday promotions should reference the correct upcoming holiday dates
- Seasonal content should match the current or upcoming season
- Never use outdated year references`;
}

/**
 * Build system prompt for generation with full marketing principles
 */
function buildGenerationSystemPrompt(templateType) {
  return `You are an expert marketing copywriter. Generate compelling, brand-aligned content that drives action.

${getDateContext()}

${UNIVERSAL_MARKETING_PRINCIPLES}

## Brand Voice Requirements

- **Match the brand's tone and personality exactly** as specified in the brand profile
- **NEVER use words listed in the brand's "words to avoid"**
- **Actively incorporate the brand's preferred phrases**
- Address the target audience's pain points directly
- Weave value propositions naturally into content

## Output Requirements

- Return plain text content only
- No markdown formatting, no asterisks, no bold, no headers
- Just clean, readable copy that sounds human
- Create distinct variations with different angles

CRITICAL: Before outputting, verify:
- All sentences under 19 words
- NO em dashes anywhere
- NO dangling modifiers
- Active voice throughout
- NO banned question templates`;
}

