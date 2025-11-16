/**
 * Ad Tactics Configuration
 * Each tactic defines constraints and prompt templates for ad copy generation
 */

export const AD_TACTICS = {
  facebook_title: {
    id: 'facebook_title',
    name: 'Facebook Ad Title',
    description: 'Attention-grabbing title for Facebook ads',
    maxChars: 40,
    maxWords: 6,
    category: 'social',
    promptTemplate: (brandProfile, objective) => `You are writing a Facebook ad title for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Tone: Formal ${brandProfile.voice.toneSliders.formal}/100, Playful ${brandProfile.voice.toneSliders.playful}/100
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}
- Avoid: ${brandProfile.voice.lexicon.avoid.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}

CAMPAIGN OBJECTIVE: ${objective}

Create a compelling Facebook ad title that:
- Is MAX 40 characters and 6 words
- Uses emotional hooks and clear benefits
- Matches the brand voice and tone
- Addresses the campaign objective
- Grabs attention in a crowded feed

Return ONLY the title text, no quotes or explanations.`
  },

  google_headline: {
    id: 'google_headline',
    name: 'Google Search Headline',
    description: 'Keyword-focused headline for Google Search ads',
    maxChars: 30,
    maxWords: 5,
    category: 'search',
    promptTemplate: (brandProfile, objective) => `You are writing a Google Search ad headline for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}
PAIN POINTS: ${brandProfile.audience.painPoints.join(', ')}

CAMPAIGN OBJECTIVE: ${objective}

Create a Google Search ad headline that:
- Is MAX 30 characters and 5 words
- Includes relevant keywords for SEO
- Communicates immediate value
- Matches search intent
- Uses active, benefit-driven language

Return ONLY the headline text, no quotes or explanations.`
  },

  linkedin_intro: {
    id: 'linkedin_intro',
    name: 'LinkedIn Ad Intro',
    description: 'Professional ad introduction for LinkedIn',
    maxChars: 150,
    maxWords: 25,
    category: 'social',
    promptTemplate: (brandProfile, objective) => `You are writing a LinkedIn ad introduction for ${brandProfile.brand.name}.

BRAND POSITIONING: ${brandProfile.brand.positioning}

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Tone: Professional, Formal ${brandProfile.voice.toneSliders.formal}/100

TARGET AUDIENCE: ${brandProfile.audience.primary}
NEEDS: ${brandProfile.audience.needs.join(', ')}

CAMPAIGN OBJECTIVE: ${objective}

Create a LinkedIn ad intro that:
- Is MAX 150 characters and 25 words
- Maintains professional tone
- Addresses specific business needs
- Builds credibility
- Encourages engagement

Return ONLY the intro text, no quotes or explanations.`
  },

  instagram_caption: {
    id: 'instagram_caption',
    name: 'Instagram Caption',
    description: 'Engaging caption for Instagram posts',
    maxChars: 125,
    maxWords: 20,
    category: 'social',
    promptTemplate: (brandProfile, objective) => `You are writing an Instagram caption for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Tone: Playful ${brandProfile.voice.toneSliders.playful}/100, Energetic ${brandProfile.voice.toneSliders.energetic}/100
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}

CAMPAIGN OBJECTIVE: ${objective}

Create an Instagram caption that:
- Is MAX 125 characters and 20 words
- Is visually engaging and thumb-stopping
- Uses conversational, authentic language
- Encourages interaction (likes, comments, shares)
- Matches the brand's visual identity

Return ONLY the caption text, no quotes or explanations.`
  },

  email_subject: {
    id: 'email_subject',
    name: 'Email Subject Line',
    description: 'Compelling subject line for email campaigns',
    maxChars: 50,
    maxWords: 8,
    category: 'email',
    promptTemplate: (brandProfile, objective) => `You are writing an email subject line for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}
- Avoid: ${brandProfile.voice.lexicon.avoid.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}
PAIN POINTS: ${brandProfile.audience.painPoints.join(', ')}

CAMPAIGN OBJECTIVE: ${objective}

Create an email subject line that:
- Is MAX 50 characters and 8 words
- Creates urgency or curiosity
- Personalizes when possible
- Avoids spam triggers
- Drives opens

Return ONLY the subject line text, no quotes or explanations.`
  },

  twitter_post: {
    id: 'twitter_post',
    name: 'Twitter/X Post',
    description: 'Concise post for Twitter/X',
    maxChars: 280,
    maxWords: 45,
    category: 'social',
    promptTemplate: (brandProfile, objective) => `You are writing a Twitter/X post for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Tone: ${brandProfile.voice.toneSliders.energetic > 60 ? 'Energetic' : 'Measured'}
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}

CAMPAIGN OBJECTIVE: ${objective}

Create a Twitter/X post that:
- Is MAX 280 characters and 45 words
- Is concise and punchy
- Encourages retweets/engagement
- Uses conversational language
- Optionally includes a CTA

Return ONLY the post text, no quotes or explanations.`
  },

  // Multi-component tactics with grouped output
  facebook_ad_copy: {
    id: 'facebook_ad_copy',
    name: 'Facebook Ad Copy',
    description: 'Complete Facebook ad with post text, headline, description, and CTA',
    category: 'social',
    multiComponent: true,
    components: [
      { name: 'Post Text', maxChars: 125, count: 3 },
      { name: 'Headline', maxChars: 40, count: 3 },
      { name: 'Newsfeed Link Description', maxChars: 30, count: 3 },
      { name: 'Call to Action', maxChars: 20, count: 2 }
    ],
    ctaOptions: ['No Button', 'Get Quote', 'Get Showtimes', 'Listen Now', 'Request Time', 'See Menu', 'Shop Now', 'Sign Up', 'Subscribe', 'Watch More', 'Learn More', 'Apply Now', 'Book Now', 'Contact Us', 'Donate Now', 'Download', 'Get Offer'],
    promptTemplate: (brandProfile, objective, includeEmojis, emojiInstructions) => `You are creating a complete Facebook ad for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Tone: Formal ${brandProfile.voice.toneSliders.formal}/100, Playful ${brandProfile.voice.toneSliders.playful}/100
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}
- Avoid: ${brandProfile.voice.lexicon.avoid.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}

CAMPAIGN OBJECTIVE: ${objective}

${includeEmojis && emojiInstructions ? emojiInstructions : ''}

Create a complete Facebook ad with the following components:
1. Post Text (MAX 125 characters) - 3 variations
2. Headline (MAX 40 characters) - 3 variations
3. Newsfeed Link Description (MAX 30 characters) - 3 variations
4. Call to Action - Select 1 main and 1 alternate from: ${['No Button', 'Get Quote', 'Get Showtimes', 'Listen Now', 'Request Time', 'See Menu', 'Shop Now', 'Sign Up', 'Subscribe', 'Watch More', 'Learn More', 'Apply Now', 'Book Now', 'Contact Us', 'Donate Now', 'Download', 'Get Offer'].join(', ')}

Return your response as a JSON object with this EXACT structure (no markdown code blocks, just pure JSON):
{
  "components": [
    {
      "name": "Post Text",
      "variations": ["text1", "text2", "text3"]
    },
    {
      "name": "Headline",
      "variations": ["headline1", "headline2", "headline3"]
    },
    {
      "name": "Newsfeed Link Description",
      "variations": ["desc1", "desc2", "desc3"]
    },
    {
      "name": "Call to Action",
      "variations": ["main_cta", "alternate_cta"]
    }
  ]
}`
  },

  facebook_carousel_ad: {
    id: 'facebook_carousel_ad',
    name: 'Facebook Carousel Ad',
    description: 'Facebook carousel ad with multiple scrollable cards (2-10 images/videos)',
    category: 'social',
    multiComponent: true,
    components: [
      { name: 'Post Text', maxChars: 125, count: 3 },
      { name: 'Headline', maxChars: 40, count: 5 },
      { name: 'Newsfeed Link Description', maxChars: 30, count: 5 },
      { name: 'Call to Action', maxChars: 20, count: 2 }
    ],
    ctaOptions: ['No Button', 'Get Quote', 'Get Showtimes', 'Listen Now', 'Request Time', 'See Menu', 'Shop Now', 'Sign Up', 'Subscribe', 'Watch More', 'Learn More', 'Apply Now', 'Book Now', 'Contact Us', 'Donate Now', 'Download', 'Get Offer'],
    promptTemplate: (brandProfile, objective, includeEmojis, emojiInstructions) => `You are creating a Facebook carousel ad for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Tone: Formal ${brandProfile.voice.toneSliders.formal}/100, Playful ${brandProfile.voice.toneSliders.playful}/100
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}
- Avoid: ${brandProfile.voice.lexicon.avoid.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}

CAMPAIGN OBJECTIVE: ${objective}

${includeEmojis && emojiInstructions ? emojiInstructions : ''}

Create a Facebook carousel ad with multiple headline and description options:
1. Post Text (MAX 125 characters) - 3 variations
2. Headline (MAX 40 characters) - 5 variations (for different carousel cards)
3. Newsfeed Link Description (MAX 30 characters) - 5 variations
4. Call to Action - Select 1 main and 1 alternate from: ${['No Button', 'Get Quote', 'Get Showtimes', 'Listen Now', 'Request Time', 'See Menu', 'Shop Now', 'Sign Up', 'Subscribe', 'Watch More', 'Learn More', 'Apply Now', 'Book Now', 'Contact Us', 'Donate Now', 'Download', 'Get Offer'].join(', ')}

Return your response as a JSON object with this EXACT structure (no markdown code blocks, just pure JSON):
{
  "components": [
    {
      "name": "Post Text",
      "variations": ["text1", "text2", "text3"]
    },
    {
      "name": "Headline",
      "variations": ["headline1", "headline2", "headline3", "headline4", "headline5"]
    },
    {
      "name": "Newsfeed Link Description",
      "variations": ["desc1", "desc2", "desc3", "desc4", "desc5"]
    },
    {
      "name": "Call to Action",
      "variations": ["main_cta", "alternate_cta"]
    }
  ]
}`
  },

  tiktok_ad_copy: {
    id: 'tiktok_ad_copy',
    name: 'TikTok Ad Copy',
    description: 'TikTok ad text and call to action',
    category: 'social',
    multiComponent: true,
    components: [
      { name: 'Text', maxChars: 100, minChars: 12, count: 3 },
      { name: 'Call to Action', maxChars: 20, count: 2 }
    ],
    ctaOptions: ['Learn More', 'Pre-Order Now', 'Experience Now', 'Get Tickets Now', 'Listen Now', 'Interested', 'Subscribe', 'Get Showtimes', 'Get Quote', 'Order Now', 'Install Now', 'Read More', 'View More', 'Play Game', 'Watch Now', 'Apply Now', 'Book Now', 'Download', 'Show Now', 'Contact Us', 'Sign Up'],
    promptTemplate: (brandProfile, objective, includeEmojis, emojiInstructions) => `You are creating a TikTok ad for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Tone: Energetic ${brandProfile.voice.toneSliders.energetic}/100, Playful ${brandProfile.voice.toneSliders.playful}/100
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}

CAMPAIGN OBJECTIVE: ${objective}

${includeEmojis && emojiInstructions ? emojiInstructions : ''}

Create a TikTok ad with:
1. Text (12-100 characters) - 3 variations
2. Call to Action - Select 1 main and 1 alternate from: ${['Learn More', 'Pre-Order Now', 'Experience Now', 'Get Tickets Now', 'Listen Now', 'Interested', 'Subscribe', 'Get Showtimes', 'Get Quote', 'Order Now', 'Install Now', 'Read More', 'View More', 'Play Game', 'Watch Now', 'Apply Now', 'Book Now', 'Download', 'Show Now', 'Contact Us', 'Sign Up'].join(', ')}

Return your response as a JSON object with this EXACT structure (no markdown code blocks, just pure JSON):
{
  "components": [
    {
      "name": "Text",
      "variations": ["text1", "text2", "text3"]
    },
    {
      "name": "Call to Action",
      "variations": ["main_cta", "alternate_cta"]
    }
  ]
}`
  },

  snapchat_ad_copy: {
    id: 'snapchat_ad_copy',
    name: 'Snapchat Ad Copy',
    description: 'Snapchat ad headline and call to action',
    category: 'social',
    multiComponent: true,
    components: [
      { name: 'Headline', maxChars: 34, count: 3 },
      { name: 'Call to Action', maxChars: 20, count: 2 }
    ],
    ctaOptions: ['Apply Now', 'Book Now', 'Buy Tickets', 'Get Now', 'Listen', 'More', 'Order Now', 'Play', 'Read', 'Show Now', 'Show', 'Showtimes', 'Sign Up', 'View', 'Watch'],
    promptTemplate: (brandProfile, objective, includeEmojis, emojiInstructions) => `You are creating a Snapchat ad for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Tone: Playful ${brandProfile.voice.toneSliders.playful}/100
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}

CAMPAIGN OBJECTIVE: ${objective}

${includeEmojis && emojiInstructions ? emojiInstructions : ''}

Create a Snapchat ad with:
1. Headline (MAX 34 characters) - 3 variations
2. Call to Action - Select 1 main and 1 alternate from: ${['Apply Now', 'Book Now', 'Buy Tickets', 'Get Now', 'Listen', 'More', 'Order Now', 'Play', 'Read', 'Show Now', 'Show', 'Showtimes', 'Sign Up', 'View', 'Watch'].join(', ')}

Return your response as a JSON object with this EXACT structure (no markdown code blocks, just pure JSON):
{
  "components": [
    {
      "name": "Headline",
      "variations": ["headline1", "headline2", "headline3"]
    },
    {
      "name": "Call to Action",
      "variations": ["main_cta", "alternate_cta"]
    }
  ]
}`
  },

  linkedin_ad_copy: {
    id: 'linkedin_ad_copy',
    name: 'LinkedIn Ad Copy',
    description: 'Professional LinkedIn ad with intro text, title, and CTA',
    category: 'social',
    multiComponent: true,
    components: [
      { name: 'Introductory Text', maxChars: 150, count: 3 },
      { name: 'Title', maxChars: 70, count: 3 },
      { name: 'Call to Action', maxChars: 20, count: 2 }
    ],
    ctaOptions: ['Apply', 'Download', 'View Quote', 'Learn More', 'Sign Up', 'Subscribe', 'Register', 'Join', 'Attend'],
    promptTemplate: (brandProfile, objective, includeEmojis, emojiInstructions) => `You are creating a LinkedIn ad for ${brandProfile.brand.name}.

BRAND POSITIONING: ${brandProfile.brand.positioning}

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Tone: Professional, Formal ${brandProfile.voice.toneSliders.formal}/100
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}
NEEDS: ${brandProfile.audience.needs.join(', ')}

CAMPAIGN OBJECTIVE: ${objective}

${includeEmojis && emojiInstructions ? emojiInstructions : ''}

Create a LinkedIn ad with:
1. Introductory Text (MAX 150 characters) - 3 variations
2. Title (MAX 70 characters) - 3 variations
3. Call to Action - Select 1 main and 1 alternate from: ${['Apply', 'Download', 'View Quote', 'Learn More', 'Sign Up', 'Subscribe', 'Register', 'Join', 'Attend'].join(', ')}

Return your response as a JSON object with this EXACT structure (no markdown code blocks, just pure JSON):
{
  "components": [
    {
      "name": "Introductory Text",
      "variations": ["intro1", "intro2", "intro3"]
    },
    {
      "name": "Title",
      "variations": ["title1", "title2", "title3"]
    },
    {
      "name": "Call to Action",
      "variations": ["main_cta", "alternate_cta"]
    }
  ]
}`
  },

  pinterest_ad_copy: {
    id: 'pinterest_ad_copy',
    name: 'Pinterest Ad Copy',
    description: 'Pinterest ad title and description',
    category: 'social',
    multiComponent: true,
    components: [
      { name: 'Title', maxChars: 100, recommendedChars: 40, count: 3 },
      { name: 'Description', maxChars: 500, recommendedChars: 60, count: 3 }
    ],
    promptTemplate: (brandProfile, objective, includeEmojis, emojiInstructions) => `You are creating a Pinterest ad for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}

CAMPAIGN OBJECTIVE: ${objective}

${includeEmojis && emojiInstructions ? emojiInstructions : ''}

Create a Pinterest ad with:
1. Title (MAX 100 characters, recommended 40 characters) - 3 variations
2. Description (MAX 500 characters, recommended 50-60 characters) - 3 variations

Return your response as a JSON object with this EXACT structure (no markdown code blocks, just pure JSON):
{
  "components": [
    {
      "name": "Title",
      "variations": ["title1", "title2", "title3"]
    },
    {
      "name": "Description",
      "variations": ["desc1", "desc2", "desc3"]
    }
  ]
}`
  },

  nextdoor_display_ad: {
    id: 'nextdoor_display_ad',
    name: 'Nextdoor Display Ad',
    description: 'Nextdoor display ad with headline, body, offer, and CTA',
    category: 'local',
    multiComponent: true,
    components: [
      { name: 'Headline', maxChars: 70, count: 3 },
      { name: 'Body Text', maxChars: 800, recommendedChars: 90, count: 3 },
      { name: 'Offer Text', maxChars: 50, count: 3 },
      { name: 'Call to Action', maxChars: 20, count: 2 }
    ],
    ctaOptions: ['Learn more', 'Buy now', 'Shop now', 'Get quote', 'Sign up', 'Book now', 'Apply now', 'Contact us', 'Message', 'See menu', 'Subscribe', 'Listen now', 'Get coupon'],
    promptTemplate: (brandProfile, objective, includeEmojis, emojiInstructions) => `You are creating a Nextdoor display ad for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}

CAMPAIGN OBJECTIVE: ${objective}

${includeEmojis && emojiInstructions ? emojiInstructions : ''}

Create a Nextdoor display ad with:
1. Headline (MAX 70 characters) - 3 variations
2. Body Text (MAX 800 characters, best practice is 90 characters, 1-3 sentences) - 3 variations
3. Offer Text (MAX 50 characters, appears next to CTA) - 3 variations
4. Call to Action - Select 1 main and 1 alternate from: ${['Learn more', 'Buy now', 'Shop now', 'Get quote', 'Sign up', 'Book now', 'Apply now', 'Contact us', 'Message', 'See menu', 'Subscribe', 'Listen now', 'Get coupon'].join(', ')}

Return your response as a JSON object with this EXACT structure (no markdown code blocks, just pure JSON):
{
  "components": [
    {
      "name": "Headline",
      "variations": ["headline1", "headline2", "headline3"]
    },
    {
      "name": "Body Text",
      "variations": ["body1", "body2", "body3"]
    },
    {
      "name": "Offer Text",
      "variations": ["offer1", "offer2", "offer3"]
    },
    {
      "name": "Call to Action",
      "variations": ["main_cta", "alternate_cta"]
    }
  ]
}`
  },

  nextdoor_sale_ad: {
    id: 'nextdoor_sale_ad',
    name: 'Nextdoor For Sale/Free Ad',
    description: 'Nextdoor for sale or free item ad headline',
    category: 'local',
    multiComponent: true,
    components: [
      { name: 'Headline', maxChars: 70, count: 3 }
    ],
    promptTemplate: (brandProfile, objective, includeEmojis, emojiInstructions) => `You are creating a Nextdoor for sale/free ad for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}

CAMPAIGN OBJECTIVE: ${objective}

${includeEmojis && emojiInstructions ? emojiInstructions : ''}

Create a Nextdoor for sale/free ad with:
1. Headline (MAX 70 characters) - 3 variations

Return your response as a JSON object with this EXACT structure (no markdown code blocks, just pure JSON):
{
  "components": [
    {
      "name": "Headline",
      "variations": ["headline1", "headline2", "headline3"]
    }
  ]
}`
  },

  nextdoor_rail_ad: {
    id: 'nextdoor_rail_ad',
    name: 'Nextdoor Right-Hand Rail Ad',
    description: 'Nextdoor right-hand rail ad with headline and CTA',
    category: 'local',
    multiComponent: true,
    components: [
      { name: 'Headline', maxChars: 70, count: 3 },
      { name: 'Call to Action', maxChars: 20, count: 2 }
    ],
    ctaOptions: ['Learn more', 'Buy now', 'Shop now', 'Get quote', 'Sign up', 'Book now', 'Apply now', 'Contact us', 'Message', 'See menu', 'Subscribe', 'Listen now', 'Get coupon'],
    promptTemplate: (brandProfile, objective, includeEmojis, emojiInstructions) => `You are creating a Nextdoor right-hand rail ad for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}

CAMPAIGN OBJECTIVE: ${objective}

${includeEmojis && emojiInstructions ? emojiInstructions : ''}

Create a Nextdoor right-hand rail ad with:
1. Headline (MAX 70 characters) - 3 variations
2. Call to Action - Select 1 main and 1 alternate from: ${['Learn more', 'Buy now', 'Shop now', 'Get quote', 'Sign up', 'Book now', 'Apply now', 'Contact us', 'Message', 'See menu', 'Subscribe', 'Listen now', 'Get coupon'].join(', ')}

Return your response as a JSON object with this EXACT structure (no markdown code blocks, just pure JSON):
{
  "components": [
    {
      "name": "Headline",
      "variations": ["headline1", "headline2", "headline3"]
    },
    {
      "name": "Call to Action",
      "variations": ["main_cta", "alternate_cta"]
    }
  ]
}`
  },

  native_ad_copy: {
    id: 'native_ad_copy',
    name: 'Native Ad Copy',
    description: 'Native ad with enticing title and body text',
    category: 'native',
    multiComponent: true,
    components: [
      { name: 'Title/Headline', maxChars: 30, count: 3 },
      { name: 'Body Text', maxChars: 200, count: 3 }
    ],
    promptTemplate: (brandProfile, objective, includeEmojis, emojiInstructions) => `You are creating a native ad for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}

CAMPAIGN OBJECTIVE: ${objective}

${includeEmojis && emojiInstructions ? emojiInstructions : ''}

Create a native ad with:
1. Title/Headline (MAX 30 characters, must be enticing and stand alone, NOT just brand name) - 3 variations
2. Body Text (MAX 200 characters, must be enticing, stand alone, and include a call-to-action) - 3 variations

Return your response as a JSON object with this EXACT structure (no markdown code blocks, just pure JSON):
{
  "components": [
    {
      "name": "Title/Headline",
      "variations": ["title1", "title2", "title3"]
    },
    {
      "name": "Body Text",
      "variations": ["body1", "body2", "body3"]
    }
  ]
}`
  },

  email_marketing_copy: {
    id: 'email_marketing_copy',
    name: 'Email Marketing Copy',
    description: 'Email subject line and preview text',
    category: 'email',
    multiComponent: true,
    components: [
      { name: 'Subject Line', maxChars: 50, count: 3 },
      { name: 'Preview Text', maxChars: 100, count: 3 }
    ],
    promptTemplate: (brandProfile, objective, includeEmojis, emojiInstructions) => `You are creating email marketing copy for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}
- Avoid: ${brandProfile.voice.lexicon.avoid.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}
PAIN POINTS: ${brandProfile.audience.painPoints.join(', ')}

CAMPAIGN OBJECTIVE: ${objective}

${includeEmojis && emojiInstructions ? emojiInstructions : ''}

Create email marketing copy with:
1. Subject Line (MAX 50 characters) - 3 variations
2. Preview Text (MAX 100 characters) - 3 variations

Return your response as a JSON object with this EXACT structure (no markdown code blocks, just pure JSON):
{
  "components": [
    {
      "name": "Subject Line",
      "variations": ["subject1", "subject2", "subject3"]
    },
    {
      "name": "Preview Text",
      "variations": ["preview1", "preview2", "preview3"]
    }
  ]
}`
  },

  spark_ad_copy: {
    id: 'spark_ad_copy',
    name: 'Spark Ad Copy',
    description: 'Complete Spark ad with multiple headlines, descriptions, and business name',
    category: 'mobile',
    multiComponent: true,
    components: [
      { name: 'Short Headline', maxChars: 15, count: 1 },
      { name: 'Headline', maxChars: 30, count: 2 },
      { name: 'Long Headline', maxChars: 90, count: 1 },
      { name: 'Description', maxChars: 60, count: 1 },
      { name: 'Long Description', maxChars: 90, count: 1 },
      { name: 'Business Name', maxChars: 25, count: 1 }
    ],
    promptTemplate: (brandProfile, objective, includeEmojis, emojiInstructions) => `You are creating a Spark ad for ${brandProfile.brand.name}.

BRAND VOICE:
- Personality: ${brandProfile.voice.personality.join(', ')}
- Preferred phrases: ${brandProfile.voice.lexicon.preferred.join(', ')}

TARGET AUDIENCE: ${brandProfile.audience.primary}

CAMPAIGN OBJECTIVE: ${objective}

${includeEmojis && emojiInstructions ? emojiInstructions : ''}

Create a Spark ad with:
1. Short Headline (MAX 15 characters) - 1 variation
2. Headline (MAX 30 characters) - 2 variations
3. Long Headline (MAX 90 characters) - 1 variation
4. Description (MAX 60 characters) - 1 variation
5. Long Description (MAX 90 characters) - 1 variation
6. Business Name (MAX 25 characters) - 1 variation (use actual brand name: ${brandProfile.brand.name})

Return your response as a JSON object with this EXACT structure (no markdown code blocks, just pure JSON):
{
  "components": [
    {
      "name": "Short Headline",
      "variations": ["short_headline"]
    },
    {
      "name": "Headline",
      "variations": ["headline1", "headline2"]
    },
    {
      "name": "Long Headline",
      "variations": ["long_headline"]
    },
    {
      "name": "Description",
      "variations": ["description"]
    },
    {
      "name": "Long Description",
      "variations": ["long_description"]
    },
    {
      "name": "Business Name",
      "variations": ["${brandProfile.brand.name}"]
    }
  ]
}`
  }
};

/**
 * Get all tactics grouped by category
 */
export function getTacticsByCategory() {
  const categories = {};

  for (const [key, tactic] of Object.entries(AD_TACTICS)) {
    if (!categories[tactic.category]) {
      categories[tactic.category] = [];
    }
    categories[tactic.category].push(tactic);
  }

  return categories;
}

/**
 * Get tactic by ID
 */
export function getTactic(tacticId) {
  return AD_TACTICS[tacticId] || null;
}

/**
 * Validate generated copy against tactic constraints
 */
export function validateCopy(text, tacticId) {
  const tactic = getTactic(tacticId);
  if (!tactic) return { valid: false, error: 'Invalid tactic' };

  const charCount = text.length;
  const wordCount = text.trim().split(/\s+/).length;

  const errors = [];
  if (charCount > tactic.maxChars) {
    errors.push(`Exceeds max ${tactic.maxChars} characters (${charCount})`);
  }
  if (wordCount > tactic.maxWords) {
    errors.push(`Exceeds max ${tactic.maxWords} words (${wordCount})`);
  }

  return {
    valid: errors.length === 0,
    charCount,
    wordCount,
    errors
  };
}
