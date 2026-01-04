-- Migration: Add saved_tones table
-- This table stores custom tone of voice profiles for each brand

CREATE TABLE IF NOT EXISTS saved_tones (
  id TEXT PRIMARY KEY,
  brand_profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  traits TEXT NOT NULL,  -- JSON array of trait strings
  description TEXT,
  source TEXT DEFAULT 'manual',  -- 'manual' or 'ai_detected'
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (brand_profile_id) REFERENCES brand_profiles(id) ON DELETE CASCADE
);

-- Index for faster lookups by brand
CREATE INDEX IF NOT EXISTS idx_saved_tones_brand ON saved_tones(brand_profile_id);
