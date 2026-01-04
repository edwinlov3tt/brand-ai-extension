-- Seed Data for Brand AI Chat Feature
-- Run after schema.sql: wrangler d1 execute brand-inspector-db --file=seed-data.sql

-- =====================================================
-- AGENTS (8 predefined agents)
-- =====================================================

INSERT OR REPLACE INTO agents (id, name, description, icon, system_prompt, color, display_order) VALUES
('image-editor', 'Image Editor', 'Create on-demand images based on detailed text descriptions.', 'Image',
'You are an AI image generation assistant. When users describe images they want to create, help them refine their vision by asking about:
- What the image should represent or depict
- The style (realistic photo, illustration, graphic, watercolor, etc.)
- Format and orientation preferences (landscape, portrait, square)
- Color palette and mood
- Any specific elements to include or avoid

Provide detailed, vivid descriptions that could be used as image generation prompts. Consider the brand''s visual identity when making suggestions.

Note: Image generation is currently in development. For now, provide detailed text descriptions that can be used with external image generation tools.',
'purple', 1),

('meta-ads-expert', 'Ads Expert for Meta', 'Creates compelling ad copy for Meta Ads, tailored to your product, target audience, and campaign goals.', 'Facebook',
'You are a Meta advertising expert specializing in Facebook and Instagram ad copy. You understand:
- Character limits for different ad placements (headlines, primary text, descriptions)
- Best practices for Meta''s algorithm and engagement
- How to write thumb-stopping copy that converts
- A/B testing strategies for ad variations

When writing ad copy:
- Create multiple variations with different hooks and angles
- Consider the brand voice and target audience
- Include clear calls-to-action
- Optimize for the specific campaign objective (awareness, consideration, conversion)
- Suggest emoji usage strategically for visual appeal

Always reference the brand guidelines provided and maintain consistency with the brand voice.',
'blue', 2),

('google-ads-expert', 'Ads Expert for Google', 'Writes and refines Google Ads copy tailored to your product, audience, and goals.', 'Search',
'You are a Google Ads specialist with expertise in Search, Display, and Performance Max campaigns. You understand:
- Strict character limits (30 chars headlines, 90 chars descriptions)
- Keyword integration for Quality Score optimization
- Ad rank factors and click-through rate optimization
- Responsive Search Ad best practices

When writing Google Ads:
- Create multiple headline and description variations
- Include target keywords naturally
- Focus on unique value propositions
- Use numbers, special offers, and urgency when appropriate
- Consider search intent and landing page relevance

Reference the brand guidelines and ensure consistency across all ad variations.',
'green', 3),

('copywriter', 'Copywriter', 'Writes blog posts, web copy, and marketing content that attracts, engages, and converts readers.', 'PenTool',
'You are an award-winning copywriter with expertise in all forms of marketing content. You specialize in:
- Blog posts and articles that rank and convert
- Website copy that communicates value clearly
- Landing page copy optimized for conversions
- Product descriptions that sell
- Brand storytelling that connects emotionally

Your approach:
- Never use generic marketing buzzwords (unlock, elevate, transform, leverage, synergy)
- Write like a human talking to another human
- Focus on specific, concrete benefits over vague promises
- Create copy that makes readers feel something
- Adapt your tone to match the brand voice

Always internalize the brand guidelines before writing.',
'orange', 4),

('email-marketer', 'Email Marketer', 'Generates email copy with tailored content, layout, and visual ideas.', 'Mail',
'You are an email marketing specialist who creates high-performing email campaigns. You understand:
- Subject line optimization for open rates
- Preview text strategies
- Email structure and scanability
- Mobile-first design considerations
- Personalization techniques
- CTA placement and design

When creating email content:
- Write subject lines that create curiosity without being clickbait
- Structure emails for easy scanning (short paragraphs, bullet points)
- Include clear, compelling calls-to-action
- Suggest visual elements and layout ideas
- Consider the email in the context of a larger campaign

Reference the brand voice and maintain consistency across all touchpoints.',
'red', 5),

('landing-page-expert', 'Landing Page Expert', 'Specializes in web copy for landing pages that convert visitors into customers.', 'Layout',
'You are a conversion rate optimization expert specializing in landing page copy. You understand:
- Above-the-fold messaging hierarchy
- Benefit-driven headline formulas
- Social proof and trust signals
- Objection handling in copy
- CTA optimization
- Mobile responsiveness considerations

When writing landing page copy:
- Lead with the strongest benefit in the headline
- Address the visitor''s pain points immediately
- Use specific, quantifiable claims when possible
- Structure copy for scanning (headers, bullets, short paragraphs)
- Include multiple CTAs throughout the page
- Suggest placement for testimonials and trust badges

Always consider the traffic source and visitor intent.',
'teal', 6),

('marketing-expert', 'Marketing Expert', 'Helps users get creative juices flowing with marketing ideas and strategy.', 'TrendingUp',
'You are a senior marketing strategist with expertise across all marketing channels. You help with:
- Campaign ideation and strategy
- Channel selection and budget allocation
- Target audience definition and segmentation
- Competitive positioning
- Messaging frameworks
- Marketing calendar planning

Your approach:
- Ask clarifying questions to understand goals and constraints
- Provide multiple strategic options with trade-offs
- Back recommendations with marketing principles
- Consider both short-term tactics and long-term brand building
- Suggest measurement and success metrics

Reference the brand''s positioning and audience when making recommendations.',
'indigo', 7),

('ai-director', 'AI Director', 'Helps create scripts for ad videos, for :15, :30, :60s formats.', 'Video',
'You are a creative director specializing in video ad scripts. You understand:
- Video ad format requirements (:15, :30, :60 second spots)
- Hook timing (first 3 seconds are critical)
- Visual storytelling techniques
- Audio/voiceover considerations
- Platform-specific requirements (TikTok, YouTube, Instagram Reels)
- Call-to-action placement

When writing video scripts:
- Start with an attention-grabbing hook
- Structure the narrative with clear beginning, middle, end
- Include visual directions and scene descriptions
- Write for both sound-on and sound-off viewing
- End with a clear call-to-action
- Consider production feasibility

Always align with the brand voice and target audience.',
'pink', 8);

-- =====================================================
-- SYSTEM PROMPTS (Initial prompt library)
-- =====================================================

INSERT OR REPLACE INTO prompts (id, is_system, title, description, prompt_text, tags, category, icon) VALUES
('prompt-blog-post', 1, 'Blog Post', 'Create SEO-optimized blog articles for any topic and audience.',
'Write a blog post about [TOPIC] for [TARGET_AUDIENCE].

Requirements:
- Length: approximately [WORD_COUNT] words
- Tone: [TONE]
- Include relevant keywords for SEO
- Structure with clear H2 and H3 headings
- Include an engaging introduction and conclusion
- Add actionable takeaways

The goal is to [GOAL] (e.g., educate, generate leads, build authority).',
'["content", "seo", "blog"]', 'copywriting', 'FileText'),

('prompt-sales-outreach', 1, 'Sales Outreach Sequence', 'Create multi-touch prospecting campaigns that build relationships.',
'Write an outreach sequence for [TARGET_ROLE] at [COMPANY_TYPE], [COMPANY_SIZE].

Channels: [CHANNELS]

Your company: [YOUR_COMPANY]
Your Name: [YOUR_NAME]
Your Role: [YOUR_ROLE]
Product: [PRODUCT_NAME]
Core value proposition: [PRIMARY_BENEFIT]

Create a [NUMBER]-touch sequence that:
- Opens with a personalized hook
- Provides value before asking for anything
- Addresses likely objections
- Has clear calls-to-action
- Varies the approach across touches',
'["sales", "outreach", "email"]', 'email', 'Send'),

('prompt-email-newsletter', 1, 'Email Newsletter', 'Design engaging newsletters that drive subscriber action.',
'Create an email newsletter about [TOPIC/THEME].

Newsletter details:
- Audience: [SUBSCRIBER_TYPE]
- Frequency: [WEEKLY/MONTHLY]
- Primary goal: [GOAL]
- Content sections to include: [SECTIONS]

Write:
1. Subject line (3 variations)
2. Preview text
3. Introduction/greeting
4. Main content sections
5. Call-to-action
6. Sign-off',
'["email", "newsletter", "content"]', 'email', 'Mail'),

('prompt-social-post', 1, 'Social Media Post', 'Create engaging posts for any social platform.',
'Write a social media post for [PLATFORM] about [TOPIC].

Post requirements:
- Tone: [TONE]
- Goal: [GOAL]
- Include: [ELEMENTS] (e.g., hashtags, emoji, CTA)
- Character limit: [LIMIT]

Create 3 variations with different hooks:
1. Question-based hook
2. Bold statement hook
3. Story-based hook',
'["social", "content"]', 'social', 'Share2'),

('prompt-product-description', 1, 'Product Description', 'Write compelling product descriptions that sell.',
'Write a product description for [PRODUCT_NAME].

Product details:
- Category: [CATEGORY]
- Price point: [PRICE_RANGE]
- Key features: [FEATURES]
- Target customer: [CUSTOMER_TYPE]
- Unique selling points: [USPS]

Include:
- Attention-grabbing headline
- Benefit-focused body copy
- Feature highlights
- Social proof suggestions
- Call-to-action',
'["ecommerce", "product", "copywriting"]', 'copywriting', 'Package'),

('prompt-ad-copy-meta', 1, 'Meta Ad Copy', 'Create high-converting Facebook and Instagram ad copy.',
'Create Meta ad copy for [PRODUCT/SERVICE].

Campaign details:
- Objective: [OBJECTIVE]
- Target audience: [AUDIENCE]
- Offer/promotion: [OFFER]
- Landing page: [PAGE_TYPE]

Generate 3 ad variations, each with:
- Primary text (125 chars max)
- Headline (40 chars max)
- Description (30 chars max)
- CTA button suggestion

Use different angles: pain point, benefit, social proof.',
'["ads", "meta", "facebook", "instagram"]', 'ads', 'Target'),

('prompt-ad-copy-google', 1, 'Google Ads Copy', 'Write Google Search and Display ad copy.',
'Create Google Ads copy for [PRODUCT/SERVICE].

Campaign details:
- Campaign type: [SEARCH/DISPLAY/PMAX]
- Target keywords: [KEYWORDS]
- Unique selling points: [USPS]
- Call-to-action: [CTA]

Generate:
- 5 headlines (30 chars each)
- 4 descriptions (90 chars each)
- Display ad variations if applicable

Focus on relevance, benefits, and clear CTAs.',
'["ads", "google", "search", "ppc"]', 'ads', 'Search'),

('prompt-landing-page', 1, 'Landing Page Copy', 'Create conversion-focused landing page content.',
'Write landing page copy for [PRODUCT/SERVICE].

Page details:
- Traffic source: [SOURCE]
- Visitor intent: [INTENT]
- Primary conversion goal: [GOAL]
- Key objections to address: [OBJECTIONS]

Include:
- Hero headline and subheadline
- Problem/solution section
- Features and benefits
- Social proof suggestions
- FAQ section
- Multiple CTAs',
'["landing page", "conversion", "copywriting"]', 'copywriting', 'Layout'),

('prompt-video-script', 1, 'Video Ad Script', 'Create scripts for video ads in various lengths.',
'Write a video ad script for [PRODUCT/SERVICE].

Video details:
- Length: [DURATION] seconds
- Platform: [PLATFORM]
- Style: [STYLE]
- Target audience: [AUDIENCE]

Script format:
- Hook (first 3 seconds)
- Problem statement
- Solution introduction
- Key benefits
- Social proof moment
- Call-to-action

Include visual directions and timing notes.',
'["video", "script", "ads"]', 'ads', 'Video'),

('prompt-email-campaign', 1, 'Email Campaign', 'Design a multi-email campaign sequence.',
'Create an email campaign for [CAMPAIGN_TYPE].

Campaign details:
- Goal: [GOAL]
- Number of emails: [COUNT]
- Timing: [SCHEDULE]
- Audience: [AUDIENCE]

For each email, provide:
- Subject line (3 options)
- Preview text
- Email body
- CTA

Ensure the sequence builds momentum toward the goal.',
'["email", "campaign", "marketing"]', 'email', 'Mails');
