/**
 * Agent Tools - Tool definitions for Brand AI to call specialized agents
 *
 * Each tool maps to an agent that handles specific content generation.
 * When Brand AI (no agent selected) receives a request, it can use these tools
 * to delegate work to specialized agents.
 */

/**
 * Tool definitions for Claude API
 * Each tool includes the agentId for routing to the correct agent
 */
export const AGENT_TOOLS = [
  {
    name: 'generate_meta_ads',
    agentId: 'ads-meta',
    description:
      'Generate Meta (Facebook/Instagram) ad copy variations. Use when the user requests Facebook ads, Instagram ads, Meta ads, or social media advertising copy. Returns structured ad variations with primary text, headlines, descriptions, and CTAs formatted for the Meta Ads platform.',
    input_schema: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description:
            "The user's full request for ad copy, including any specific requirements like tone, offers, promotions, target audience details, or product/service information",
        },
        variation_count: {
          type: 'integer',
          description: 'Number of ad variations to generate (default: 3)',
          default: 3,
        },
        framework: {
          type: 'string',
          enum: ['HSL', 'PAS', 'AIDA', 'BAB', '4Ps'],
          description:
            'Optional copywriting framework to structure the ad copy',
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'generate_google_ads',
    agentId: 'ads-google',
    description:
      'Generate Google Search ad copy variations. Use when the user requests Google ads, search ads, PPC ads, or SEM copy. Returns structured responsive search ad (RSA) variations with headlines (max 30 characters each) and descriptions (max 90 characters each).',
    input_schema: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description:
            "The user's request for ad copy, including keywords to target, landing page info, campaign goals, or specific offers",
        },
        variation_count: {
          type: 'integer',
          description: 'Number of ad variations to generate (default: 3)',
          default: 3,
        },
        ad_type: {
          type: 'string',
          enum: ['search', 'local', 'spark'],
          description:
            'Type of Google ad to generate (search is most common)',
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'generate_email',
    agentId: 'email-marketer',
    description:
      'Generate email marketing content. Use when the user requests email copy, newsletters, email campaigns, email sequences, subject lines, or any email-related marketing content.',
    input_schema: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description:
            "The user's request for email content, including the purpose, audience, offers, or key messages",
        },
        email_type: {
          type: 'string',
          enum: [
            'promotional',
            'newsletter',
            'welcome',
            'abandoned_cart',
            'follow_up',
            'announcement',
          ],
          description: 'Type of email to generate',
        },
        include_subject_lines: {
          type: 'boolean',
          description: 'Whether to include subject line options (default: true)',
          default: true,
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'generate_landing_page',
    agentId: 'landing-page',
    description:
      'Generate landing page copy sections. Use when the user requests landing page content, hero sections, value propositions, feature sections, CTAs, or conversion-focused web copy.',
    input_schema: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description:
            "The user's request for landing page content, including the product/service, target audience, and conversion goal",
        },
        sections: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'hero',
              'features',
              'benefits',
              'testimonials',
              'cta',
              'faq',
              'pricing',
            ],
          },
          description: 'Specific sections to generate (generates all if not specified)',
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'generate_copy',
    agentId: 'copywriter',
    description:
      'Generate general marketing copy, taglines, slogans, value propositions, or brand messaging. Use for general copywriting tasks that do not fit a specific ad platform or format.',
    input_schema: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description:
            "The user's request for copy, including context about the brand, audience, and purpose",
        },
        copy_type: {
          type: 'string',
          enum: [
            'tagline',
            'slogan',
            'value_proposition',
            'product_description',
            'brand_story',
            'social_post',
          ],
          description: 'Type of copy to generate',
        },
      },
      required: ['request'],
    },
  },
];

/**
 * Get tool definitions formatted for Claude API (excludes internal agentId)
 * @returns {Array} Tool definitions without agentId
 */
export function getToolDefinitions() {
  return AGENT_TOOLS.map(({ agentId, ...tool }) => tool);
}

/**
 * Get the agent ID associated with a tool
 * @param {string} toolName - The name of the tool
 * @returns {string|null} The agent ID or null if not found
 */
export function getAgentForTool(toolName) {
  const tool = AGENT_TOOLS.find((t) => t.name === toolName);
  return tool?.agentId || null;
}

/**
 * Get tool definition by name
 * @param {string} toolName - The name of the tool
 * @returns {object|null} The full tool definition or null
 */
export function getTool(toolName) {
  return AGENT_TOOLS.find((t) => t.name === toolName) || null;
}

/**
 * Check if a tool name is valid
 * @param {string} toolName - The name to check
 * @returns {boolean} Whether the tool exists
 */
export function isValidTool(toolName) {
  return AGENT_TOOLS.some((t) => t.name === toolName);
}
