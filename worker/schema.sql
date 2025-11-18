-- Brand Inspector D1 Database Schema
-- Run with: wrangler d1 execute brand-inspector-db --file=schema.sql

-- Brand Profiles Table
CREATE TABLE IF NOT EXISTS brand_profiles (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  name TEXT,
  tagline TEXT,
  story TEXT,
  mission TEXT,
  positioning TEXT,
  value_props TEXT,              -- JSON array: ["prop1", "prop2"]
  voice_personality TEXT,         -- JSON array: ["trait1", "trait2"]
  tone_sliders TEXT,              -- JSON object: {formal: 50, playful: 30, ...}
  lexicon_preferred TEXT,         -- JSON array: ["phrase1", "phrase2"]
  lexicon_avoid TEXT,             -- JSON array: ["avoid1", "avoid2"]
  audience_primary TEXT,
  audience_needs TEXT,            -- JSON array
  audience_pain_points TEXT,      -- JSON array
  writing_guide TEXT,             -- JSON object: {sentenceLength, paragraphStyle, ...}
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Ad Copy History Table
CREATE TABLE IF NOT EXISTS ad_copies (
  id TEXT PRIMARY KEY,
  brand_profile_id TEXT NOT NULL,
  tactic TEXT NOT NULL,           -- 'facebook_title', 'google_headline', etc.
  campaign_objective TEXT,
  copy_text TEXT NOT NULL,
  character_count INTEGER,
  word_count INTEGER,
  rating INTEGER DEFAULT 0,       -- 1 (thumbs up), -1 (thumbs down), 0 (no rating)
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (brand_profile_id) REFERENCES brand_profiles(id) ON DELETE CASCADE
);

-- Pages Table (Products/Services)
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  brand_profile_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  meta_image TEXT,
  type TEXT NOT NULL,             -- 'product' or 'service'

  -- AI-generated summary fields
  summary TEXT,
  value_propositions TEXT,        -- JSON array: ["prop1", "prop2"]
  features TEXT,                  -- JSON array: ["feature1", "feature2"]
  benefits TEXT,                  -- JSON array: ["benefit1", "benefit2"]
  target_audience TEXT,
  tone TEXT,
  keywords TEXT,                  -- JSON array: ["keyword1", "keyword2"]

  -- Raw content for reprocessing
  page_content TEXT,

  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),

  FOREIGN KEY (brand_profile_id) REFERENCES brand_profiles(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_domain ON brand_profiles(domain);
CREATE INDEX IF NOT EXISTS idx_brand_updated ON brand_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_copy_brand ON ad_copies(brand_profile_id);
CREATE INDEX IF NOT EXISTS idx_ad_copy_created ON ad_copies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_copy_tactic ON ad_copies(tactic);
CREATE INDEX IF NOT EXISTS idx_page_brand ON pages(brand_profile_id);
CREATE INDEX IF NOT EXISTS idx_page_created ON pages(created_at DESC);
