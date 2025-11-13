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
