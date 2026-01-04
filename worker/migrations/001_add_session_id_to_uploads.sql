-- Migration: Add session_id to file_uploads, make conversation_id nullable
-- Run with: wrangler d1 execute brand-inspector-db --file=migrations/001_add_session_id_to_uploads.sql

-- Drop existing table and recreate with new schema
DROP TABLE IF EXISTS file_uploads;

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

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_upload_session ON file_uploads(session_id);
CREATE INDEX IF NOT EXISTS idx_upload_conversation ON file_uploads(conversation_id);
CREATE INDEX IF NOT EXISTS idx_upload_message ON file_uploads(message_id);
CREATE INDEX IF NOT EXISTS idx_upload_expires ON file_uploads(expires_at);
CREATE INDEX IF NOT EXISTS idx_upload_status ON file_uploads(upload_status);
