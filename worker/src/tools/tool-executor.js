/**
 * Tool Executor - Executes agent tools via nested Claude API calls
 *
 * When Brand AI decides to use a tool, this module handles:
 * 1. Mapping tool name to agent
 * 2. Building the agent's system prompt with brand context
 * 3. Making a nested Claude API call
 * 4. Returning the agent's response (with component blocks)
 */

import { getAgent } from '../agents/index.js';
import { getAgentForTool } from './agent-tools.js';

/**
 * Build a system prompt for the agent with brand context
 * Similar to buildSystemPrompt in chat.js but for tool execution
 */
function buildAgentSystemPrompt(agent, context) {
  let systemPrompt = agent.systemPrompt || '';

  // Add brand context if available
  if (context.brandProfile) {
    const bp = context.brandProfile;
    systemPrompt += `\n\n<brand_context>
You are working with the following brand:

<brand_identity>
  <name>${bp.name || 'Unknown Brand'}</name>
  <tagline>${bp.tagline || ''}</tagline>
  <positioning>${bp.positioning || ''}</positioning>
  <mission>${bp.mission || ''}</mission>
</brand_identity>

<brand_voice>
  <personality_traits>${(bp.voice_personality || []).join(', ')}</personality_traits>
  <tone>
    Formal: ${bp.tone_sliders?.formal || 50}/100
    Playful: ${bp.tone_sliders?.playful || 50}/100
    Energetic: ${bp.tone_sliders?.energetic || 50}/100
  </tone>
  <preferred_phrases>${(bp.lexicon_preferred || []).join('; ')}</preferred_phrases>
  <phrases_to_avoid>${(bp.lexicon_avoid || []).join('; ')}</phrases_to_avoid>
</brand_voice>

<target_audience>
  <primary>${bp.audience_primary || ''}</primary>
  <pain_points>${(bp.audience_pain_points || []).join('; ')}</pain_points>
  <needs>${(bp.audience_needs || []).join('; ')}</needs>
</target_audience>

IMPORTANT: Maintain this brand's voice and tone in all generated content.
</brand_context>`;

    // Add additional instructions if present
    if (bp.additional_instructions && bp.additional_instructions.length > 0) {
      const instructionsList = bp.additional_instructions
        .map((instruction) => `- ${instruction.text}`)
        .join('\n');

      systemPrompt += `\n\n<additional_instructions>
Follow these specific guidelines for this brand:
${instructionsList}
</additional_instructions>`;
    }
  }

  // Add page context if available
  if (context.pageContext && context.pageContext.title) {
    const pc = context.pageContext;
    systemPrompt += `\n\n<page_context>
Focus on this specific ${pc.type || 'page'}:

<${pc.type || 'page'}_details>
  <title>${pc.title}</title>
  ${pc.summary ? `<summary>${pc.summary}</summary>` : ''}
  ${pc.valuePropositions?.length > 0 ? `<value_propositions>\n    ${pc.valuePropositions.map((vp) => `- ${vp}`).join('\n    ')}\n  </value_propositions>` : ''}
  ${pc.features?.length > 0 ? `<features>\n    ${pc.features.map((f) => `- ${f}`).join('\n    ')}\n  </features>` : ''}
  ${pc.benefits?.length > 0 ? `<benefits>\n    ${pc.benefits.map((b) => `- ${b}`).join('\n    ')}\n  </benefits>` : ''}
</${pc.type || 'page'}_details>
</page_context>`;
  }

  // Add current date/time for seasonal context
  if (context.currentDateTime) {
    systemPrompt += `\n\n<current_context>
Current date/time: ${context.currentDateTime}
Use this for seasonally relevant suggestions.
</current_context>`;
  }

  return systemPrompt;
}

/**
 * Format tool input into a natural language request for the agent
 */
function formatToolRequest(toolName, toolInput) {
  let request = toolInput.request;

  // Add variation count if specified
  if (toolInput.variation_count && toolInput.variation_count !== 3) {
    request += `\n\nPlease generate ${toolInput.variation_count} variations.`;
  }

  // Add framework preference
  if (toolInput.framework) {
    request += `\n\nUse the ${toolInput.framework} copywriting framework.`;
  }

  // Add ad type for Google ads
  if (toolInput.ad_type) {
    request += `\n\nAd type: ${toolInput.ad_type}`;
  }

  // Add email type
  if (toolInput.email_type) {
    request += `\n\nEmail type: ${toolInput.email_type}`;
  }

  // Add sections for landing page
  if (toolInput.sections && toolInput.sections.length > 0) {
    request += `\n\nGenerate these sections: ${toolInput.sections.join(', ')}`;
  }

  // Add copy type
  if (toolInput.copy_type) {
    request += `\n\nCopy type: ${toolInput.copy_type}`;
  }

  return request;
}

/**
 * Execute an agent tool via nested Claude API call
 *
 * @param {string} toolName - The tool being called (e.g., "generate_meta_ads")
 * @param {object} toolInput - The input parameters from Brand AI
 * @param {object} context - Context including brandProfile, pageContext, currentDateTime
 * @param {object} env - Worker environment with API keys
 * @returns {Promise<string>} - The agent's response (with component blocks)
 */
export async function executeAgentTool(toolName, toolInput, context, env) {
  // Get the agent for this tool
  const agentId = getAgentForTool(toolName);
  if (!agentId) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const agent = getAgent(agentId);
  if (!agent) {
    throw new Error(`Agent not found for tool: ${toolName}`);
  }

  console.log(`[Tool Executor] Executing tool: ${toolName} with agent: ${agentId}`);

  // Build the system prompt with brand context
  const systemPrompt = buildAgentSystemPrompt(agent, context);

  // Format the request for the agent
  const userMessage = formatToolRequest(toolName, toolInput);

  // Make nested Claude API call (non-streaming for tool result)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Tool Executor] Claude API error: ${response.status}`, errorText);
    throw new Error(`Tool execution failed: ${response.status}`);
  }

  const data = await response.json();

  // Extract text content from response
  const textContent = data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  console.log(`[Tool Executor] Tool ${toolName} completed, response length: ${textContent.length}`);

  return textContent;
}

/**
 * Execute multiple tools in sequence (for complex requests)
 * Not currently used but available for future expansion
 */
export async function executeToolSequence(toolCalls, context, env) {
  const results = [];

  for (const { name, input } of toolCalls) {
    const result = await executeAgentTool(name, input, context, env);
    results.push({ name, result });
  }

  return results;
}
