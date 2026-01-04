/**
 * Platform Ads Module
 *
 * Handles platform detection, prompt building, and response parsing
 * for all ad platforms (Meta, X, Pinterest, Snapchat, TikTok, LinkedIn)
 * and social posts.
 */

/**
 * Platform character limits based on official documentation
 */
export const PLATFORM_LIMITS = {
  // Meta Ads
  'meta-image': {
    primaryText: { max: 2200, recommended: 125 },
    headline: { max: 40, recommended: 27 },
    description: { max: 30, recommended: 27 },
  },
  'meta-carousel': {
    primaryText: { max: 2200, recommended: 125 },
    cardHeadline: { max: 45, recommended: 32 },
    cardDescription: { max: 30, recommended: 18 },
  },
  'meta-stories': {
    primaryText: { max: 125, recommended: 125 },
    headline: { max: 40, recommended: 40 },
  },
  'meta-reels': {
    primaryText: { max: 72, recommended: 72 },
    headline: { max: 10, recommended: 10 },
  },
  'meta-video': {
    primaryText: { max: 2200, recommended: 125 },
    headline: { max: 40, recommended: 27 },
    description: { max: 30, recommended: 27 },
  },

  // X/Twitter Ads
  'x-image': {
    tweetText: { max: 280, recommended: 100 },
    cardHeadline: { max: 70, recommended: 50 },
  },
  'x-video': {
    tweetText: { max: 280, recommended: 100 },
    cardHeadline: { max: 70, recommended: 50 },
  },
  'x-carousel': {
    tweetText: { max: 280, recommended: 100 },
    cardHeadline: { max: 70, recommended: 50 },
  },

  // Pinterest Ads
  'pinterest-standard': {
    title: { max: 100, recommended: 40 },
    description: { max: 800, recommended: 50 },
  },
  'pinterest-video': {
    title: { max: 100, recommended: 40 },
    description: { max: 800, recommended: 50 },
  },
  'pinterest-carousel': {
    title: { max: 100, recommended: 40 },
    description: { max: 800, recommended: 50 },
    cardTitle: { max: 100, recommended: 40 },
  },

  // Snapchat Ads
  'snapchat-single': {
    brandName: { max: 25, recommended: 25 },
    headline: { max: 34, recommended: 34 },
  },
  'snapchat-story': {
    brandName: { max: 25, recommended: 25 },
    headline: { max: 34, recommended: 34 },
    storyTitle: { max: 55, recommended: 55 },
  },

  // TikTok Ads
  'tiktok-infeed': {
    displayName: { max: 20, recommended: 10 },
    caption: { max: 100, recommended: 60 },
  },
  'tiktok-spark': {
    displayName: { max: 20, recommended: 10 },
    caption: { max: 150, recommended: 60 },
  },

  // LinkedIn Ads
  'linkedin-image': {
    introText: { max: 600, recommended: 150 },
    headline: { max: 200, recommended: 70 },
  },

  // Social Posts (Organic)
  'instagram-post': {
    caption: { max: 2200, recommended: 125 },
  },
  'facebook-post': {
    postText: { max: 63206, recommended: 80 },
  },
  'x-post': {
    tweet: { max: 280, recommended: 100 },
  },
  'linkedin-post': {
    postText: { max: 3000, recommended: 150 },
  },
  'tiktok-post': {
    caption: { max: 2200, recommended: 150 },
  },

  // Email Marketing
  'email-marketing': {
    subjectLine: { max: 988, recommended: 50, truncation: 33 },
    previewText: { max: 140, recommended: 80, truncation: 35 },
    ctaText: { max: 35, recommended: 25 },
  },

  // Landing Page / Website
  'landing-page': {
    headlineH1: { max: 70, recommended: 60, truncation: 50 },
    subheadlineH2: { max: 70, recommended: 60 },
    metaDescription: { max: 158, recommended: 120, truncation: 120 },
    titleTag: { max: 70, recommended: 55, truncation: 51 },
    ctaButton: { max: 35, recommended: 25 },
    faqAnswer: { max: 350, recommended: 280 },
  },
};

/**
 * CTA options by platform
 */
export const PLATFORM_CTAS = {
  meta: ['learn_more', 'shop_now', 'sign_up', 'book_now', 'contact_us', 'download', 'get_offer', 'order_now', 'subscribe', 'apply_now', 'watch_more', 'send_message', 'call_now', 'install_now', 'donate_now', 'get_directions', 'see_menu'],
  pinterest: ['learn_more', 'shop_now', 'sign_up', 'book_now', 'download', 'get_offer', 'order_now', 'apply_now', 'buy_now', 'contact_us', 'get_quote', 'visit_site', 'watch_now', 'subscribe'],
  x: ['shop_now', 'learn_more', 'sign_up', 'visit_site', 'download', 'get_started', 'watch_now', 'book_now', 'install', 'open', 'play'],
  snapchat: ['shop_now', 'shop', 'buy_now', 'order_now', 'book_now', 'learn_more', 'sign_up', 'apply_now', 'subscribe', 'download', 'install_now', 'get', 'play', 'try', 'open'],
  tiktok: ['learn_more', 'shop_now', 'sign_up', 'download', 'install_now', 'apply_now', 'book_now', 'contact_us', 'order_now', 'subscribe', 'watch_now', 'play_game', 'visit_store'],
  linkedin: ['learn_more', 'apply_now', 'download', 'get_quote', 'sign_up', 'subscribe', 'register', 'request_demo', 'contact_us', 'visit_website'],
};

/**
 * Detect platform type from template string
 */
export function detectPlatformType(templateType) {
  if (!templateType) return null;
  const t = templateType.toLowerCase();

  // Meta platforms
  if (t.includes('meta-image') || t.includes('facebook-image') || t.includes('instagram-image') ||
      (t.includes('meta') && t.includes('single'))) {
    return 'meta-image';
  }
  if (t.includes('meta-carousel') || t.includes('facebook-carousel') || t.includes('instagram-carousel')) {
    return 'meta-carousel';
  }
  if (t.includes('meta-stories') || t.includes('instagram-stories') || t.includes('facebook-stories') ||
      (t.includes('stories') && (t.includes('meta') || t.includes('instagram') || t.includes('facebook')))) {
    return 'meta-stories';
  }
  if (t.includes('meta-reels') || t.includes('instagram-reels') || t.includes('facebook-reels') ||
      (t.includes('reels'))) {
    return 'meta-reels';
  }
  if (t.includes('meta-video') || t.includes('facebook-video') || t.includes('instagram-video') ||
      ((t.includes('meta') || t.includes('facebook') || t.includes('instagram')) && t.includes('video') && t.includes('ad'))) {
    return 'meta-video';
  }

  // X/Twitter platforms
  if ((t.includes('x-') || t.includes('twitter')) && t.includes('image') && t.includes('ad')) {
    return 'x-image';
  }
  if ((t.includes('x-') || t.includes('twitter')) && t.includes('video') && t.includes('ad')) {
    return 'x-video';
  }
  if ((t.includes('x-') || t.includes('twitter')) && t.includes('carousel')) {
    return 'x-carousel';
  }

  // Pinterest platforms
  if (t.includes('pinterest') && t.includes('video')) {
    return 'pinterest-video';
  }
  if (t.includes('pinterest') && t.includes('carousel')) {
    return 'pinterest-carousel';
  }
  if (t.includes('pinterest') && (t.includes('standard') || t.includes('pin') || t.includes('ad'))) {
    return 'pinterest-standard';
  }

  // Snapchat platforms
  if (t.includes('snapchat') && t.includes('story')) {
    return 'snapchat-story';
  }
  if (t.includes('snapchat') && (t.includes('single') || t.includes('image') || t.includes('video') || t.includes('ad'))) {
    return 'snapchat-single';
  }

  // TikTok platforms
  if (t.includes('tiktok') && t.includes('spark')) {
    return 'tiktok-spark';
  }
  if (t.includes('tiktok') && (t.includes('infeed') || t.includes('in-feed') || t.includes('ad'))) {
    return 'tiktok-infeed';
  }

  // LinkedIn platforms
  if (t.includes('linkedin') && (t.includes('image') || t.includes('sponsored') || t.includes('ad'))) {
    return 'linkedin-image';
  }

  // Social Posts
  if (t.includes('instagram') && (t.includes('post') || t.includes('caption'))) {
    return 'instagram-post';
  }
  if (t.includes('facebook') && (t.includes('post') || t.includes('status'))) {
    return 'facebook-post';
  }
  if ((t.includes('x-post') || t.includes('twitter-post') || t.includes('tweet')) && !t.includes('ad')) {
    return 'x-post';
  }
  if (t.includes('linkedin') && (t.includes('post') || t.includes('update'))) {
    return 'linkedin-post';
  }
  if (t.includes('tiktok') && (t.includes('post') || t.includes('caption')) && !t.includes('ad')) {
    return 'tiktok-post';
  }

  // Email Marketing - match any email content type
  if (t.includes('email')) {
    // Match specific email types
    if (t.includes('marketing') || t.includes('campaign') || t.includes('newsletter') ||
        t.includes('promotional') || t.includes('promotion') || t.includes('discount') ||
        t.includes('cold') || t.includes('outreach') || t.includes('drip') || t.includes('sequence') ||
        t.includes('welcome') || t.includes('onboarding') || t.includes('transactional') ||
        t.includes('cart') || t.includes('abandon') || t.includes('sale') || t.includes('offer') ||
        t.includes('announcement') || t.includes('launch') || t.includes('follow') || t.includes('nurture') ||
        t.includes('re-engagement') || t.includes('winback') || t.includes('reminder') ||
        t.includes('subject') || t.includes('body') || t.includes('copy')) {
      return 'email-marketing';
    }
    // Also match generic "email" templates that don't specify ads
    if (!t.includes('ad') && !t.includes('image') && !t.includes('video')) {
      return 'email-marketing';
    }
  }

  // Landing Page / Website
  if (t.includes('landing') && t.includes('page')) {
    return 'landing-page';
  }
  if (t.includes('website') && (t.includes('copy') || t.includes('content') || t.includes('headline'))) {
    return 'landing-page';
  }
  if (t.includes('homepage') || t.includes('home page')) {
    return 'landing-page';
  }

  return null;
}

/**
 * Check if a platform type is a social post (not ad)
 */
export function isSocialPost(platformType) {
  return platformType?.endsWith('-post');
}

/**
 * Get the best CTA recommendation based on content and platform
 */
function recommendCTA(platformType, brandProfile, prompt) {
  const platform = platformType.split('-')[0];
  const ctas = PLATFORM_CTAS[platform] || PLATFORM_CTAS.meta;

  // Simple keyword matching for CTA recommendation
  const promptLower = (prompt || '').toLowerCase();

  if (promptLower.includes('shop') || promptLower.includes('buy') || promptLower.includes('purchase') || promptLower.includes('product')) {
    return ctas.includes('shop_now') ? 'shop_now' : ctas[0];
  }
  if (promptLower.includes('sign up') || promptLower.includes('register') || promptLower.includes('join')) {
    return ctas.includes('sign_up') ? 'sign_up' : ctas[0];
  }
  if (promptLower.includes('download') || promptLower.includes('app')) {
    return ctas.includes('download') ? 'download' : ctas[0];
  }
  if (promptLower.includes('book') || promptLower.includes('appointment') || promptLower.includes('schedule')) {
    return ctas.includes('book_now') ? 'book_now' : ctas[0];
  }
  if (promptLower.includes('contact') || promptLower.includes('call') || promptLower.includes('reach')) {
    return ctas.includes('contact_us') ? 'contact_us' : ctas[0];
  }
  if (promptLower.includes('subscribe') || promptLower.includes('newsletter')) {
    return ctas.includes('subscribe') ? 'subscribe' : ctas[0];
  }

  // Default to learn_more
  return ctas.includes('learn_more') ? 'learn_more' : ctas[0];
}

/**
 * Build brand context string
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
Words to AVOID: ${(brandProfile.lexicon_avoid || []).join(', ')}
`.trim();
}

/**
 * Build platform-specific ad prompt
 */
export function buildPlatformAdPrompt({
  basePrompt,
  platformType,
  templateType,
  brandProfile,
  selectedAudiences,
  selectedTone,
  talkingPoints,
  contextAnswers,
  variantCount = 3,
}) {
  const limits = PLATFORM_LIMITS[platformType];
  if (!limits) return null;

  const recommendedCta = recommendCTA(platformType, brandProfile, basePrompt);
  const isSocial = isSocialPost(platformType);

  let prompt = `Generate ${isSocial ? 'social post' : 'ad'} copy for ${platformType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}.

<request>
${basePrompt}
</request>

<platform>${platformType}</platform>

`;

  // Add brand context
  if (brandProfile) {
    prompt += `<brand_profile>
${buildBrandContext(brandProfile)}
</brand_profile>

## BRAND VOICE (CRITICAL)
${brandProfile.voice_personality?.length > 0 ? `Voice Traits: ${brandProfile.voice_personality.join(', ')}` : ''}
${brandProfile.lexicon_preferred?.length > 0 ? `Use These Phrases: ${brandProfile.lexicon_preferred.join(', ')}` : ''}
${brandProfile.lexicon_avoid?.length > 0 ? `NEVER Use: ${brandProfile.lexicon_avoid.join(', ')}` : ''}

`;
  }

  // Add audiences
  if (selectedAudiences?.length > 0) {
    prompt += `<target_audiences>${selectedAudiences.join(', ')}</target_audiences>\n\n`;
  }

  // Add tone
  if (selectedTone) {
    prompt += `<tone>${selectedTone}</tone>\n\n`;
  }

  // Add talking points
  if (talkingPoints?.length > 0) {
    prompt += `<talking_points>\n${talkingPoints.map(tp => `- ${tp}`).join('\n')}\n</talking_points>\n\n`;
  }

  // Add context answers
  if (contextAnswers && Object.keys(contextAnswers).length > 0) {
    prompt += `<context>\n${Object.entries(contextAnswers).map(([k, v]) => `${k}: ${v}`).join('\n')}\n</context>\n\n`;
  }

  // Platform-specific instructions
  prompt += buildPlatformInstructions(platformType, limits, variantCount, recommendedCta);

  return prompt;
}

/**
 * Build platform-specific instructions and output format
 */
function buildPlatformInstructions(platformType, limits, variantCount, recommendedCta) {
  let instructions = `## CHARACTER LIMITS (MUST FOLLOW)\n\n`;

  // Add limit instructions based on platform
  for (const [field, limit] of Object.entries(limits)) {
    const fieldName = field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    instructions += `${fieldName}: MAX ${limit.max} chars (ideal: ${limit.recommended})\n`;
  }

  instructions += `\n## QUANTITY\n\nGenerate ${variantCount} variations for each field type.\n\n`;

  // Platform-specific best practices
  instructions += getPlatformBestPractices(platformType);

  // Output format
  instructions += `\n## OUTPUT FORMAT\n\nReturn JSON with this structure:\n`;
  instructions += getOutputFormat(platformType, recommendedCta);

  return instructions;
}

/**
 * Get platform-specific best practices
 */
function getPlatformBestPractices(platformType) {
  const practices = {
    'meta-image': `## META IMAGE AD BEST PRACTICES
- Lead with the hook in first 125 chars (truncation point)
- Headlines should be punchy and benefit-focused
- Descriptions only show on desktop
- Use social proof when possible`,

    'meta-carousel': `## META CAROUSEL BEST PRACTICES
- Each card should tell part of a story
- First card must hook attention
- Headlines per card should be varied but cohesive
- Primary text shared across all cards`,

    'meta-stories': `## META STORIES BEST PRACTICES
- Keep text minimal - visual-first format
- Safe zones: leave 250px top, 340px bottom
- Front-load the message
- Use bold, clear text`,

    'meta-reels': `## META REELS BEST PRACTICES
- Caption truncates at 72 chars on mobile
- Headlines only show on Facebook (not Instagram)
- Keep it casual and authentic
- Hook in first 2 seconds`,

    'meta-video': `## META VIDEO AD BEST PRACTICES
- Hook viewers in first 3 seconds
- Caption viewers who watch without sound
- 15-60 seconds recommended length
- Front-load key message`,

    'x-image': `## X IMAGE AD BEST PRACTICES
- Keep tweets concise and engaging
- 1-2 hashtags maximum
- Card headlines appear below the image
- Include clear CTA`,

    'x-video': `## X VIDEO AD BEST PRACTICES
- Under 15 seconds for best engagement
- Include captions (most watch muted)
- Hook in first 3 seconds
- Keep tweet text punchy`,

    'x-carousel': `## X CAROUSEL BEST PRACTICES
- Use 2-6 cards to tell a story
- Each card can link differently
- Consistent visual style
- Progressive disclosure works well`,

    'pinterest-standard': `## PINTEREST PIN BEST PRACTICES
- SEO-rich descriptions with keywords
- First 50 chars most visible
- Clear, actionable titles
- Include relevant keywords naturally`,

    'pinterest-video': `## PINTEREST VIDEO BEST PRACTICES
- 6-15 seconds optimal
- Vertical format (2:3 or 9:16)
- Hook in first 2 seconds
- Include keywords in description`,

    'pinterest-carousel': `## PINTEREST CAROUSEL BEST PRACTICES
- 2-5 cards for tutorials/storytelling
- Each card should build on previous
- Maintain visual consistency
- Strong opening card`,

    'snapchat-single': `## SNAPCHAT SINGLE AD BEST PRACTICES
- Authentic, casual tone
- Vertical format required (9:16)
- Sound-on is common
- No emojis in brand name`,

    'snapchat-story': `## SNAPCHAT STORY AD BEST PRACTICES
- Story titles can use emojis
- 3-20 snaps per story
- Attention-grabbing tile title
- Each snap should add value`,

    'tiktok-infeed': `## TIKTOK IN-FEED BEST PRACTICES
- Native-feeling content
- Hook in first 3 seconds
- Trending sounds help
- Keep captions short`,

    'tiktok-spark': `## TIKTOK SPARK AD BEST PRACTICES
- Amplifies organic content
- Original engagement carries over
- Authentic creator style
- Longer captions allowed`,

    'linkedin-image': `## LINKEDIN IMAGE AD BEST PRACTICES
- Professional tone
- Lead with value proposition
- First 150 chars visible before "see more"
- B2B decision-maker focus`,

    'instagram-post': `## INSTAGRAM POST BEST PRACTICES
- Hook in first line (before "more" cutoff ~125 chars)
- 3-5 relevant hashtags at end
- Use line breaks for readability
- Engaging questions drive comments`,

    'facebook-post': `## FACEBOOK POST BEST PRACTICES
- 40-80 chars get 86% more engagement
- Questions and CTAs drive comments
- Use line breaks for long posts
- Native video gets priority`,

    'x-post': `## X POST BEST PRACTICES
- 71-100 chars get most engagement
- 1-2 hashtags maximum
- Questions and polls drive replies
- Thread hooks for longer content`,

    'linkedin-post': `## LINKEDIN POST BEST PRACTICES
- 1,200-2,000 chars perform best
- Line breaks for readability
- Personal stories drive engagement
- Professional but human tone`,

    'tiktok-post': `## TIKTOK POST BEST PRACTICES
- Under 150 chars visible
- Trending hashtags (stay relevant)
- Emojis help express tone
- Hook ties to video content`,

    'email-marketing': `## EMAIL MARKETING BEST PRACTICES
- Subject lines under 33 chars display fully on Android Gmail
- Preview text prevents email clients from pulling body text
- First-person CTAs ("Get my discount") convert 90% better than second-person
- Max 1 emoji, placed at start OR end only (not both)
- Subject + Preview should work together as a teaser
- Avoid ALL CAPS and excessive punctuation!!!
- Keep body copy scannable with short paragraphs`,

    'landing-page': `## LANDING PAGE BEST PRACTICES
- H1 headlines with numbers get 70%+ more engagement
- Keep meta descriptions under 120 chars for mobile safety
- Title tags of 51-55 chars avoid Google rewrites
- First-person CTAs ("Start my trial") outperform second-person
- FAQ answers should be 40-60 words for featured snippets
- Subheadlines should expand on H1, not repeat it
- Use power words: "free", "new", "proven", "guaranteed"`,
  };

  return practices[platformType] || '';
}

/**
 * Get output format for platform
 */
function getOutputFormat(platformType, recommendedCta) {
  const isSocial = isSocialPost(platformType);

  if (isSocial) {
    // Social post format
    const fieldMap = {
      'instagram-post': 'captions',
      'facebook-post': 'posts',
      'x-post': 'tweets',
      'linkedin-post': 'posts',
      'tiktok-post': 'captions',
    };
    const field = fieldMap[platformType] || 'content';

    return `{
  "platformType": "${platformType}",
  "${field}": [
    {
      "content": "Post content here",
      "qualityScore": 80,
      "strategy": "hook-focused"
    }
  ]
}

Quality Score: 80-100 (excellent), 60-79 (good), below 60 (needs work)`;
  }

  // Ad format based on platform
  if (platformType.startsWith('meta-')) {
    if (platformType === 'meta-carousel') {
      return `{
  "platformType": "${platformType}",
  "primaryTexts": [
    { "content": "Primary text here", "qualityScore": 80, "strategy": "benefit-focused" }
  ],
  "cards": [
    {
      "headline": { "content": "Card 1 headline", "qualityScore": 80 },
      "description": { "content": "Card 1 description", "qualityScore": 80 }
    }
  ],
  "recommendedCta": "${recommendedCta}"
}`;
    }
    if (platformType === 'meta-reels') {
      return `{
  "platformType": "${platformType}",
  "primaryTexts": [
    { "content": "Caption here", "qualityScore": 80, "strategy": "hook-focused" }
  ],
  "headlines": [
    { "content": "Headline (FB only)", "qualityScore": 80 }
  ],
  "recommendedCta": "${recommendedCta}"
}`;
    }
    if (platformType === 'meta-stories') {
      return `{
  "platformType": "${platformType}",
  "primaryTexts": [
    { "content": "Primary text here", "qualityScore": 80, "strategy": "hook-focused" }
  ],
  "headlines": [
    { "content": "Headline here", "qualityScore": 80 }
  ],
  "recommendedCta": "${recommendedCta}"
}`;
    }
    // meta-image, meta-video
    return `{
  "platformType": "${platformType}",
  "primaryTexts": [
    { "content": "Primary text here", "qualityScore": 80, "strategy": "benefit-focused" }
  ],
  "headlines": [
    { "content": "Headline here", "qualityScore": 80, "strategy": "hook-focused" }
  ],
  "descriptions": [
    { "content": "Description here", "qualityScore": 80, "strategy": "cta-driven" }
  ],
  "recommendedCta": "${recommendedCta}"
}`;
  }

  if (platformType.startsWith('x-')) {
    if (platformType === 'x-carousel') {
      return `{
  "platformType": "${platformType}",
  "tweetTexts": [
    { "content": "Tweet text here", "qualityScore": 80, "strategy": "hook-focused" }
  ],
  "cards": [
    { "headline": { "content": "Card headline", "qualityScore": 80 } }
  ],
  "recommendedCta": "${recommendedCta}"
}`;
    }
    return `{
  "platformType": "${platformType}",
  "tweetTexts": [
    { "content": "Tweet text here", "qualityScore": 80, "strategy": "hook-focused" }
  ],
  "cardHeadlines": [
    { "content": "Card headline here", "qualityScore": 80 }
  ],
  "recommendedCta": "${recommendedCta}"
}`;
  }

  if (platformType.startsWith('pinterest-')) {
    if (platformType === 'pinterest-carousel') {
      return `{
  "platformType": "${platformType}",
  "titles": [
    { "content": "Pin title here", "qualityScore": 80, "strategy": "seo-focused" }
  ],
  "descriptions": [
    { "content": "SEO description with keywords", "qualityScore": 80 }
  ],
  "cards": [
    { "title": { "content": "Card title", "qualityScore": 80 } }
  ],
  "recommendedCta": "${recommendedCta}"
}`;
    }
    return `{
  "platformType": "${platformType}",
  "titles": [
    { "content": "Pin title here", "qualityScore": 80, "strategy": "seo-focused" }
  ],
  "descriptions": [
    { "content": "SEO description with keywords", "qualityScore": 80 }
  ],
  "recommendedCta": "${recommendedCta}"
}`;
  }

  if (platformType.startsWith('snapchat-')) {
    if (platformType === 'snapchat-story') {
      return `{
  "platformType": "${platformType}",
  "brandNames": [
    { "content": "Brand name", "qualityScore": 80 }
  ],
  "headlines": [
    { "content": "Headline here", "qualityScore": 80 }
  ],
  "storyTitles": [
    { "content": "Story title (emojis ok)", "qualityScore": 80 }
  ],
  "recommendedCta": "${recommendedCta}"
}`;
    }
    return `{
  "platformType": "${platformType}",
  "brandNames": [
    { "content": "Brand name", "qualityScore": 80 }
  ],
  "headlines": [
    { "content": "Headline here", "qualityScore": 80 }
  ],
  "recommendedCta": "${recommendedCta}"
}`;
  }

  if (platformType.startsWith('tiktok-')) {
    return `{
  "platformType": "${platformType}",
  "displayNames": [
    { "content": "Display name", "qualityScore": 80 }
  ],
  "captions": [
    { "content": "Caption here", "qualityScore": 80, "strategy": "hook-focused" }
  ],
  "recommendedCta": "${recommendedCta}"
}`;
  }

  if (platformType === 'linkedin-image') {
    return `{
  "platformType": "${platformType}",
  "introTexts": [
    { "content": "Intro text here", "qualityScore": 80, "strategy": "value-prop" }
  ],
  "headlines": [
    { "content": "Headline here", "qualityScore": 80 }
  ],
  "recommendedCta": "${recommendedCta}"
}`;
  }

  // Email Marketing
  if (platformType === 'email-marketing') {
    return `{
  "platformType": "${platformType}",
  "subjectLines": [
    { "content": "Subject line here (33-50 chars ideal)", "qualityScore": 80, "strategy": "curiosity-gap" }
  ],
  "previewTexts": [
    { "content": "Preview text here (40-80 chars ideal)", "qualityScore": 80, "strategy": "teaser" }
  ],
  "bodyContents": [
    { "content": "Email body content here. Keep scannable with short paragraphs.", "qualityScore": 80, "strategy": "benefit-focused" }
  ],
  "ctaTexts": [
    { "content": "Get My [Benefit]", "qualityScore": 80, "strategy": "first-person" }
  ]
}

IMPORTANT for CTAs: Use first-person voice ("Get my discount", "Start my trial") - converts 90% better.
Max 1 emoji per subject line, placed at start OR end only.`;
  }

  // Landing Page
  if (platformType === 'landing-page') {
    return `{
  "platformType": "${platformType}",
  "headlines": [
    { "content": "H1 Headline here (20-70 chars, 6-7 words ideal)", "qualityScore": 80, "strategy": "benefit-focused" }
  ],
  "subheadlines": [
    { "content": "H2 Subheadline expanding on H1 (50-60 chars)", "qualityScore": 80, "strategy": "clarifying" }
  ],
  "metaDescriptions": [
    { "content": "Meta description for SEO (120-158 chars, 120 for mobile safety)", "qualityScore": 80, "strategy": "seo-focused" }
  ],
  "titleTags": [
    { "content": "Title Tag | Brand (51-55 chars to avoid rewrites)", "qualityScore": 80, "strategy": "seo-focused" }
  ],
  "ctaButtons": [
    { "content": "Start My Free Trial", "qualityScore": 80, "strategy": "first-person" }
  ],
  "faqAnswers": [
    { "content": "FAQ answer here (40-60 words for featured snippets)", "qualityScore": 80, "strategy": "informative" }
  ]
}

IMPORTANT for CTAs: Use first-person voice ("Start my trial", "Get my quote") - outperforms second-person.
Headlines with numbers get 70%+ more engagement.`;
  }

  // Generic fallback
  return `{
  "platformType": "${platformType}",
  "content": [
    { "content": "Content here", "qualityScore": 80 }
  ]
}`;
}

/**
 * Parse platform ad response
 */
export function parsePlatformAdResponse(responseText, platformType) {
  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const limits = PLATFORM_LIMITS[platformType];

    // Add IDs to all items
    const addIds = (items, prefix) => {
      if (!items || !Array.isArray(items)) return [];
      return items.map((item, i) => ({
        id: `${prefix}-${i + 1}-${Date.now()}`,
        content: (item.content || '').trim(),
        qualityScore: calculateQualityScore(item.content, limits, prefix, item.qualityScore),
        strategy: item.strategy || 'general',
      }));
    };

    // Build normalized response based on platform
    const result = {
      platformType,
      templateName: platformType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    };

    // Copy over all array fields with IDs added
    const arrayFields = ['primaryTexts', 'headlines', 'descriptions', 'longHeadlines',
      'tweetTexts', 'cardHeadlines', 'titles', 'brandNames', 'storyTitles',
      'displayNames', 'captions', 'introTexts', 'posts', 'tweets',
      // Email Marketing fields
      'subjectLines', 'previewTexts', 'bodyContents', 'ctaTexts',
      // Landing Page fields
      'subheadlines', 'metaDescriptions', 'titleTags', 'ctaButtons', 'faqAnswers', 'bodyContent'];

    for (const field of arrayFields) {
      if (parsed[field]) {
        result[field] = addIds(parsed[field], field.replace(/s$/, ''));
      }
    }

    // Handle cards separately (nested structure)
    if (parsed.cards && Array.isArray(parsed.cards)) {
      result.cards = parsed.cards.map((card, i) => {
        const processedCard = {
          id: `card-${i + 1}-${Date.now()}`,
        };
        if (card.headline) {
          processedCard.headline = {
            id: `card-headline-${i + 1}-${Date.now()}`,
            content: (card.headline.content || card.headline || '').trim(),
            qualityScore: card.headline.qualityScore || 75,
          };
        }
        if (card.description) {
          processedCard.description = {
            id: `card-description-${i + 1}-${Date.now()}`,
            content: (card.description.content || card.description || '').trim(),
            qualityScore: card.description.qualityScore || 75,
          };
        }
        if (card.title) {
          processedCard.title = {
            id: `card-title-${i + 1}-${Date.now()}`,
            content: (card.title.content || card.title || '').trim(),
            qualityScore: card.title.qualityScore || 75,
          };
        }
        return processedCard;
      });
    }

    // Copy CTA recommendation
    if (parsed.recommendedCta) {
      result.recommendedCta = parsed.recommendedCta;
    }

    return result;
  } catch (e) {
    console.error('Failed to parse platform ad response:', e);
    return null;
  }
}

/**
 * Calculate quality score based on content and limits
 */
function calculateQualityScore(content, limits, fieldType, suggestedScore) {
  if (!content) return 0;

  // Find the relevant limit
  let limit;
  for (const [key, val] of Object.entries(limits)) {
    if (fieldType.toLowerCase().includes(key.toLowerCase().replace(/([A-Z])/g, ''))) {
      limit = val;
      break;
    }
  }

  if (!limit) {
    return suggestedScore || 75;
  }

  const length = content.length;

  // Penalize heavily if over max
  if (length > limit.max) {
    return Math.max(10, 50 - (length - limit.max) * 2);
  }

  // Start with suggested score or default
  let score = suggestedScore || 75;

  // Bonus for hitting ideal length range
  if (length >= limit.recommended * 0.7 && length <= limit.recommended * 1.2) {
    score = Math.min(100, score + 10);
  }

  // Penalty for being too short
  if (length < limit.recommended * 0.3) {
    score = Math.max(50, score - 15);
  }

  return Math.round(score);
}
