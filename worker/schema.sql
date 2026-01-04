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
  additional_instructions TEXT,   -- JSON array of instruction objects: [{id, text, createdAt, source}]
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

-- =====================================================
-- CHAT FEATURE TABLES
-- =====================================================

-- Chat Conversations Table (per-brand)
CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY,
  brand_profile_id TEXT NOT NULL,
  agent_id TEXT,                    -- NULL for general chat, agent ID for agent chats
  title TEXT NOT NULL,
  is_pinned INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (brand_profile_id) REFERENCES brand_profiles(id) ON DELETE CASCADE
);

-- Chat Messages Table (per-conversation)
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  attachments TEXT,                 -- JSON array of attachment objects
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
);

-- Prompts Library Table (global)
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  is_system INTEGER DEFAULT 0,      -- System prompts cannot be deleted
  title TEXT NOT NULL,
  description TEXT,
  prompt_text TEXT NOT NULL,        -- Contains [VARIABLE_NAME] syntax
  tags TEXT,                        -- JSON array of tag strings
  category TEXT,                    -- 'copywriting', 'marketing', 'email', etc.
  icon TEXT,                        -- Icon identifier for display
  is_favorite INTEGER DEFAULT 0,    -- User favorite flag
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Agents Table (predefined, seed data)
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,               -- Lucide icon name
  system_prompt TEXT NOT NULL,      -- Agent's behavior definition
  color TEXT,                       -- Badge/avatar color
  display_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- User Favorites Table (stars for prompts/agents)
CREATE TABLE IF NOT EXISTS user_favorites (
  id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL CHECK (item_type IN ('prompt', 'agent')),
  item_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(item_type, item_id)
);

-- =====================================================
-- FILE UPLOADS TABLE
-- =====================================================

-- File Uploads Table (attachments for chat messages)
-- Uses session_id for pre-conversation uploads, links to conversation when message is sent
CREATE TABLE IF NOT EXISTS file_uploads (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,           -- Client-generated UUID for pre-conversation uploads
  conversation_id TEXT,               -- NULL until conversation is created
  message_id TEXT,                    -- NULL until message is sent
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,      -- UUID-based filename in R2
  file_type TEXT NOT NULL,            -- MIME type
  file_size INTEGER NOT NULL,         -- Size in bytes
  file_category TEXT NOT NULL,        -- 'image', 'pdf', 'document', 'text'
  r2_key TEXT NOT NULL,               -- Full R2 object key
  public_url TEXT,                    -- Public R2 URL for images
  extracted_text TEXT,                -- For DOCX/text files: extracted content
  upload_status TEXT DEFAULT 'pending', -- 'pending', 'uploaded', 'processed', 'failed'
  error_message TEXT,                 -- Error details if failed
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  expires_at INTEGER,                 -- Cleanup timestamp (30 days from creation)
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Brand indexes
CREATE INDEX IF NOT EXISTS idx_brand_domain ON brand_profiles(domain);
CREATE INDEX IF NOT EXISTS idx_brand_updated ON brand_profiles(updated_at DESC);

-- Ad copy indexes
CREATE INDEX IF NOT EXISTS idx_ad_copy_brand ON ad_copies(brand_profile_id);
CREATE INDEX IF NOT EXISTS idx_ad_copy_created ON ad_copies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_copy_tactic ON ad_copies(tactic);

-- Page indexes
CREATE INDEX IF NOT EXISTS idx_page_brand ON pages(brand_profile_id);
CREATE INDEX IF NOT EXISTS idx_page_created ON pages(created_at DESC);

-- Chat conversation indexes
CREATE INDEX IF NOT EXISTS idx_conversation_brand ON chat_conversations(brand_profile_id);
CREATE INDEX IF NOT EXISTS idx_conversation_updated ON chat_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_agent ON chat_conversations(agent_id);

-- Chat message indexes
CREATE INDEX IF NOT EXISTS idx_message_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_created ON chat_messages(created_at ASC);

-- Prompt indexes
CREATE INDEX IF NOT EXISTS idx_prompt_category ON prompts(category);
CREATE INDEX IF NOT EXISTS idx_prompt_system ON prompts(is_system);

-- Favorites indexes
CREATE INDEX IF NOT EXISTS idx_favorites_type ON user_favorites(item_type, item_id);

-- File uploads indexes
CREATE INDEX IF NOT EXISTS idx_upload_session ON file_uploads(session_id);
CREATE INDEX IF NOT EXISTS idx_upload_conversation ON file_uploads(conversation_id);
CREATE INDEX IF NOT EXISTS idx_upload_message ON file_uploads(message_id);
CREATE INDEX IF NOT EXISTS idx_upload_expires ON file_uploads(expires_at);
CREATE INDEX IF NOT EXISTS idx_upload_status ON file_uploads(upload_status);
