-- Migration: Add saved_audiences table for AI-suggested and manual audiences
-- Created: 2025-12-15

CREATE TABLE IF NOT EXISTS saved_audiences (
  id TEXT PRIMARY KEY,
  brand_profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('female', 'male', 'any')),
  age_min INTEGER NOT NULL,
  age_max INTEGER NOT NULL,
  pain_points TEXT NOT NULL,  -- JSON array
  source TEXT DEFAULT 'manual', -- 'manual' | 'ai_suggested'
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (brand_profile_id) REFERENCES brand_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saved_audiences_brand ON saved_audiences(brand_profile_id);
