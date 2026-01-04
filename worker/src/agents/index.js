/**
 * Agent Registry - File-based agent system for Brand AI
 *
 * Each agent has a dedicated markdown file containing their system prompt.
 * This enables version control, prompt caching, and easy maintenance.
 */

// Import raw markdown as strings (Wrangler supports this with rules config)
import brandAi from './brand-ai.md';
import imageEditor from './image-editor.md';
import adsMeta from './ads-meta.md';
import adsGoogle from './ads-google.md';
import copywriter from './copywriter.md';
import emailMarketer from './email-marketer.md';
import landingPage from './landing-page.md';
import marketingExpert from './marketing-expert.md';
import aiDirector from './ai-director.md';

// Export Brand AI prompt for agentic loop
export const BRAND_AI_PROMPT = brandAi;

export const AGENTS = {
  'brand-ai': {
    id: 'brand-ai',
    name: 'Brand AI',
    description: 'Your intelligent marketing assistant with access to specialized tools.',
    icon: 'Sparkles',
    color: '#6366F1',
    systemPrompt: brandAi,
    chipSelectors: [],
    starterMessage: `Hi! I'm Brand AI, your marketing assistant. I can help you with:

• **Ad copy** - Facebook, Instagram, Google Search ads
• **Email marketing** - Campaigns, newsletters, sequences
• **Landing pages** - Conversion-focused web copy
• **General copywriting** - Taglines, product descriptions, brand messaging
• **Marketing strategy** - Campaign ideas and recommendations

What would you like to create today?`,
    isOrchestrator: true, // Flag to identify this as the orchestrator agent
  },
  'image-editor': {
    id: 'image-editor',
    name: 'Image Editor',
    description: 'Create on-demand images based on detailed text descriptions.',
    icon: 'Image',
    color: '#8B5CF6',
    systemPrompt: imageEditor,
    chipSelectors: [],
    starterMessage: `Hi! I'm ready to create your image. To get started, I need to know:

• What subject or scene would you like me to create?
• What is the primary purpose of this image (social media post, website hero, ad creative, etc.)?
• Are there any specific elements, colors, or brand assets that must be included?`,
  },
  'ads-meta': {
    id: 'ads-meta',
    name: 'Ads Expert for Meta',
    description: 'Creates compelling ad copy for Meta Ads (Facebook & Instagram).',
    icon: 'meta',
    color: '#2563EB',
    systemPrompt: adsMeta,
    chipSelectors: [
      { id: 'format', label: 'Ad Format', options: ['Single Image', 'Carousel', 'Video', 'Story'] },
      { id: 'objective', label: 'Campaign Objective', options: ['Awareness', 'Traffic', 'Conversions'] },
    ],
    starterMessage: `Hi! I'm ready to craft your Meta ad copy. Let me gather some details:

• What product or service are you promoting?
• What is your primary campaign goal (awareness, traffic, conversions, engagement)?
• What action do you want users to take after seeing this ad?`,
  },
  'ads-google': {
    id: 'ads-google',
    name: 'Ads Expert for Google',
    description: 'Writes Google Ads copy tailored to your goals and keywords.',
    icon: 'google',
    color: '#10B981',
    systemPrompt: adsGoogle,
    chipSelectors: [
      { id: 'type', label: 'Ad Type', options: ['Search', 'Local Search', 'Spark'] },
      { id: 'goal', label: 'Campaign Goal', options: ['Clicks', 'Conversions', 'Calls'] },
    ],
    starterMessage: `Hi! I'm ready to write your Google Ads copy. I need a few key details:

• What product or service are you advertising?
• What keywords or search terms are you targeting?
• What is the main action you want users to take (call, visit site, purchase, etc.)?`,
  },
  'copywriter': {
    id: 'copywriter',
    name: 'Copywriter',
    description: 'Writes blog posts, web copy, and marketing content.',
    icon: 'PenLine',
    color: '#10B981',
    systemPrompt: copywriter,
    chipSelectors: [
      { id: 'contentType', label: 'Content Type', options: ['Blog Post', 'Product Description', 'Web Copy'] },
      { id: 'length', label: 'Length', options: ['Short (~300 words)', 'Medium (~700 words)', 'Long (~1500 words)'] },
    ],
    starterMessage: `Hi! I'm ready to write compelling content for you. To start:

• What type of content do you need (blog post, product description, web page copy)?
• What is the main topic or message you want to communicate?
• Are there specific keywords, CTAs, or points that must be included?`,
  },
  'email-marketer': {
    id: 'email-marketer',
    name: 'Email Marketer',
    description: 'Generates email copy with tailored content and layout ideas.',
    icon: 'Mail',
    color: '#F97316',
    systemPrompt: emailMarketer,
    chipSelectors: [
      { id: 'emailType', label: 'Email Type', options: ['Newsletter', 'Promotional', 'Welcome Series', 'Abandoned Cart'] },
      { id: 'length', label: 'Length', options: ['Brief', 'Standard', 'Detailed'] },
    ],
    starterMessage: `Hi! I'm ready to start working, but I will need some information:

• What is the topic and goal of your email — for example, a product promotion, newsletter, or outreach campaign?
• Who is the audience or recipient group for this email?
• Would you like me to create only the email copy, or also include layout and visual recommendations?`,
  },
  'landing-page': {
    id: 'landing-page',
    name: 'Landing Page Expert',
    description: 'Specializes in web copy for high-converting landing pages.',
    icon: 'Layout',
    color: '#06B6D4',
    systemPrompt: landingPage,
    chipSelectors: [
      { id: 'goal', label: 'Page Goal', options: ['Lead Generation', 'Product Sale', 'Event Registration', 'Sign-up'] },
      { id: 'industry', label: 'Industry Focus', options: ['SaaS', 'E-commerce', 'B2B Services', 'Local Business'] },
      { id: 'style', label: 'Style', options: ['Minimalist', 'Feature-Rich', 'Storytelling'] },
    ],
    starterMessage: `Hi! I'm ready to design your landing page copy. Let's start with:

• What is the primary goal of this landing page (generate leads, sell a product, schedule consultations)?
• What offer or value proposition should be the focus?
• What sections would you like included (hero, benefits, testimonials, FAQ, etc.)?`,
  },
  'marketing-expert': {
    id: 'marketing-expert',
    name: 'Marketing Expert',
    description: 'Helps get creative juices flowing with marketing ideas.',
    icon: 'Lightbulb',
    color: '#EAB308',
    systemPrompt: marketingExpert,
    chipSelectors: [
      { id: 'campaignType', label: 'Campaign Type', options: ['Social Media', 'Email', 'Content Marketing', 'Paid Ads'] },
      { id: 'businessStage', label: 'Business Stage', options: ['Startup', 'Growth', 'Established'] },
      { id: 'focus', label: 'Focus Area', options: ['Brand Awareness', 'Lead Generation', 'Customer Retention'] },
    ],
    starterMessage: `Hi! I'm ready to help spark some creative marketing ideas. Tell me:

• What are you trying to achieve (increase awareness, drive sales, launch a new product)?
• What marketing channels are you currently using or considering?
• Are there any constraints I should know about (budget, timeline, resources)?`,
  },
  'ai-director': {
    id: 'ai-director',
    name: 'AI Director',
    description: 'Creates scripts for ad videos (:15, :30, :60s).',
    icon: 'Film',
    color: '#EF4444',
    systemPrompt: aiDirector,
    chipSelectors: [
      { id: 'length', label: 'Video Length', options: ['15s', '30s', '60s'] },
      { id: 'platform', label: 'Platform', options: ['Social Media', 'YouTube', 'STV'] },
      { id: 'style', label: 'Style', options: ['Product Demo', 'Testimonial', 'Narrative/Story', 'Fast-Cut/Dynamic'] },
    ],
    starterMessage: `Hi! I'm ready to script your video ad. Let me get the details:

• What is the core message or offer you want to communicate?
• Who is the target viewer for this ad?
• What tone or style do you envision (emotional, humorous, straightforward, aspirational)?`,
  },
};

/**
 * Get a single agent by ID
 * @param {string} agentId - The agent ID
 * @returns {object|null} The agent object or null if not found
 */
export function getAgent(agentId) {
  return AGENTS[agentId] || null;
}

/**
 * Get just the system prompt for an agent
 * @param {string} agentId - The agent ID
 * @returns {string|null} The system prompt or null if not found
 */
export function getAgentPrompt(agentId) {
  return AGENTS[agentId]?.systemPrompt || null;
}

/**
 * List all agents without their system prompts (for API response)
 * @returns {Array} Array of agent objects without systemPrompt
 */
export function listAgents() {
  return Object.values(AGENTS).map(({ systemPrompt, ...agent }) => agent);
}
