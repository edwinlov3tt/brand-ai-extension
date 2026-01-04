-- Migration: Add generation_history table
-- Stores history of content generations for the chat UI

CREATE TABLE IF NOT EXISTS generation_history (
  id TEXT PRIMARY KEY,
  brand_profile_id TEXT,
  template_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  category_name TEXT,
  prompt_summary TEXT NOT NULL,  -- Short summary for display (e.g., "Email: Discount/Promotion")
  form_data TEXT NOT NULL,       -- JSON of form inputs
  output_data TEXT NOT NULL,     -- JSON of generated content
  output_type TEXT,              -- 'google-ads', 'platform-ads', 'email', 'landing-page', 'generic'
  variant_count INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (brand_profile_id) REFERENCES brand_profiles(id) ON DELETE SET NULL
);

-- Index for faster lookups by brand and date
CREATE INDEX IF NOT EXISTS idx_history_brand ON generation_history(brand_profile_id);
CREATE INDEX IF NOT EXISTS idx_history_created ON generation_history(created_at DESC);

-- Full-text search on prompt_summary and template_name
CREATE VIRTUAL TABLE IF NOT EXISTS generation_history_fts USING fts5(
  id,
  prompt_summary,
  template_name,
  content='generation_history',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS generation_history_ai AFTER INSERT ON generation_history BEGIN
  INSERT INTO generation_history_fts(id, prompt_summary, template_name)
  VALUES (new.id, new.prompt_summary, new.template_name);
END;

CREATE TRIGGER IF NOT EXISTS generation_history_ad AFTER DELETE ON generation_history BEGIN
  INSERT INTO generation_history_fts(generation_history_fts, id, prompt_summary, template_name)
  VALUES('delete', old.id, old.prompt_summary, old.template_name);
END;
