/**
 * File Upload Handlers for Brand AI
 * Handles file uploads to R2 with metadata stored in D1
 */

import { jsonResponse, errorResponse, getCorsHeaders } from './cors.js';

// Configuration
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES_PER_MESSAGE = 10;
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

// Allowed file types with categories
const ALLOWED_TYPES = {
  'image/jpeg': { category: 'image', ext: 'jpg' },
  'image/png': { category: 'image', ext: 'png' },
  'image/gif': { category: 'image', ext: 'gif' },
  'application/pdf': { category: 'pdf', ext: 'pdf' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { category: 'document', ext: 'docx' },
  'text/plain': { category: 'text', ext: 'txt' },
  'text/csv': { category: 'text', ext: 'csv' },
  'text/html': { category: 'text', ext: 'html' },
  'text/css': { category: 'text', ext: 'css' },
  'text/xml': { category: 'text', ext: 'xml' },
  'application/xml': { category: 'text', ext: 'xml' },
  'application/javascript': { category: 'text', ext: 'js' },
  'text/javascript': { category: 'text', ext: 'js' },
};

/**
 * Generate a unique ID
 */
function generateId() {
  return `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get file category and extension from MIME type
 */
function getFileInfo(mimeType) {
  return ALLOWED_TYPES[mimeType] || null;
}

/**
 * Handle file upload
 * POST /api/uploads
 * Session-based: sessionId is required, conversationId is optional
 */
export async function handleUpload(request, env) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const sessionId = formData.get('sessionId');         // REQUIRED - client-generated
    const conversationId = formData.get('conversationId'); // OPTIONAL - null for new chats
    const originalFilename = formData.get('originalFilename') || file?.name || 'unknown';
    const extractedText = formData.get('extractedText'); // For DOCX/text files

    // Validate required fields
    if (!file) {
      return errorResponse('No file provided', request, 400);
    }

    if (!sessionId) {
      return errorResponse('sessionId is required', request, 400);
    }

    // Validate file type
    const fileInfo = getFileInfo(file.type);
    if (!fileInfo) {
      return errorResponse(`Unsupported file type: ${file.type}. Allowed: JPG, PNG, GIF, PDF, DOCX, CSV, TXT, XML, JS, CSS, HTML`, request, 415);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`, request, 413);
    }

    // Check existing uploads for this session
    const existingUploads = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM file_uploads
      WHERE session_id = ? AND message_id IS NULL
    `).bind(sessionId).first();

    if (existingUploads && existingUploads.count >= MAX_FILES_PER_MESSAGE) {
      return errorResponse(`Maximum ${MAX_FILES_PER_MESSAGE} files per message`, request, 400);
    }

    // Generate unique filename and R2 key (use sessionId for path)
    const uploadId = generateId();
    const storedFilename = `${uploadId}.${fileInfo.ext}`;
    const r2Key = `uploads/${sessionId}/${storedFilename}`;

    // Store file in R2
    const arrayBuffer = await file.arrayBuffer();
    await env.UPLOADS.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        originalFilename,
        sessionId,
        uploadId,
      },
    });

    // Generate API URL for file access (works for all file types, no R2 public access needed)
    // The URL will be served via the /api/uploads/file/:id endpoint
    const requestUrl = new URL(request.url);
    const apiBase = `${requestUrl.protocol}//${requestUrl.host}`;
    const publicUrl = `${apiBase}/api/uploads/file/${uploadId}`;

    // Calculate expiration timestamp (30 days from now)
    const expiresAt = Math.floor(Date.now() / 1000) + THIRTY_DAYS_SECONDS;

    // Store metadata in D1 (session_id required, conversation_id optional)
    await env.DB.prepare(`
      INSERT INTO file_uploads (
        id, session_id, conversation_id, original_filename, stored_filename,
        file_type, file_size, file_category, r2_key, public_url,
        extracted_text, upload_status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?)
    `).bind(
      uploadId,
      sessionId,
      conversationId || null,
      originalFilename,
      storedFilename,
      file.type,
      file.size,
      fileInfo.category,
      r2Key,
      publicUrl,
      extractedText || null,
      expiresAt
    ).run();

    return jsonResponse({
      id: uploadId,
      filename: originalFilename,
      fileType: file.type,
      fileSize: file.size,
      fileCategory: fileInfo.category,
      publicUrl,
      status: 'uploaded',
    }, request, 201);

  } catch (error) {
    console.error('Upload error:', error);
    return errorResponse(error.message || 'Failed to upload file', request, 500);
  }
}

/**
 * Delete a pending upload
 * DELETE /api/uploads/:id
 */
export async function handleDeleteUpload(request, env, uploadId) {
  try {
    // Get upload metadata
    const upload = await env.DB.prepare(`
      SELECT * FROM file_uploads WHERE id = ? AND message_id IS NULL
    `).bind(uploadId).first();

    if (!upload) {
      return errorResponse('Upload not found or already attached to a message', request, 404);
    }

    // Delete from R2
    await env.UPLOADS.delete(upload.r2_key);

    // Delete from D1
    await env.DB.prepare(`
      DELETE FROM file_uploads WHERE id = ?
    `).bind(uploadId).run();

    return jsonResponse({ success: true }, request);

  } catch (error) {
    console.error('Delete upload error:', error);
    return errorResponse(error.message || 'Failed to delete upload', request, 500);
  }
}

/**
 * List pending uploads for a session
 * GET /api/uploads/:sessionId
 */
export async function handleListUploads(request, env, sessionId) {
  try {
    const uploads = await env.DB.prepare(`
      SELECT id, original_filename as filename, file_type as fileType,
             file_size as fileSize, file_category as fileCategory,
             public_url as publicUrl, upload_status as status,
             created_at as createdAt
      FROM file_uploads
      WHERE session_id = ? AND message_id IS NULL
      ORDER BY created_at ASC
    `).bind(sessionId).all();

    return jsonResponse(uploads.results || [], request);

  } catch (error) {
    console.error('List uploads error:', error);
    return errorResponse(error.message || 'Failed to list uploads', request, 500);
  }
}

/**
 * Link session uploads to a conversation
 * POST /api/uploads/link
 * Called when conversation is created after file uploads
 */
export async function handleLinkUploads(request, env) {
  try {
    const { sessionId, conversationId } = await request.json();

    if (!sessionId || !conversationId) {
      return errorResponse('sessionId and conversationId are required', request, 400);
    }

    // Update all uploads with this sessionId that don't have a conversation yet
    const result = await env.DB.prepare(`
      UPDATE file_uploads
      SET conversation_id = ?
      WHERE session_id = ? AND conversation_id IS NULL
    `).bind(conversationId, sessionId).run();

    return jsonResponse({
      success: true,
      linkedCount: result.meta?.changes || 0
    }, request);

  } catch (error) {
    console.error('Link uploads error:', error);
    return errorResponse(error.message || 'Failed to link uploads', request, 500);
  }
}

/**
 * Get uploads by session ID (for internal use)
 */
export async function getUploadsBySessionId(sessionId, env) {
  const result = await env.DB.prepare(`
    SELECT * FROM file_uploads WHERE session_id = ?
  `).bind(sessionId).all();
  return result.results || [];
}

/**
 * Get uploads by IDs (for chat.js to retrieve attachment data)
 */
export async function getUploadsByIds(uploadIds, env) {
  if (!uploadIds || uploadIds.length === 0) return [];

  const placeholders = uploadIds.map(() => '?').join(',');
  const result = await env.DB.prepare(`
    SELECT * FROM file_uploads WHERE id IN (${placeholders})
  `).bind(...uploadIds).all();

  return result.results || [];
}

/**
 * Link uploads to a message (called after message is saved)
 */
export async function linkUploadsToMessage(uploadIds, messageId, env) {
  if (!uploadIds || uploadIds.length === 0) return;

  const placeholders = uploadIds.map(() => '?').join(',');
  await env.DB.prepare(`
    UPDATE file_uploads SET message_id = ? WHERE id IN (${placeholders})
  `).bind(messageId, ...uploadIds).run();
}

/**
 * Get file content from R2 (for sending to Claude)
 */
export async function getFileContent(r2Key, env) {
  const object = await env.UPLOADS.get(r2Key);
  if (!object) return null;
  return object;
}

/**
 * Serve a file from R2
 * GET /api/uploads/file/:id
 * This provides a CORS-friendly way to access uploaded files
 */
export async function handleServeFile(request, env, uploadId) {
  try {
    // Get upload metadata
    const upload = await env.DB.prepare(`
      SELECT r2_key, file_type, original_filename FROM file_uploads WHERE id = ?
    `).bind(uploadId).first();

    if (!upload) {
      return errorResponse('File not found', request, 404);
    }

    // Get file from R2
    const object = await env.UPLOADS.get(upload.r2_key);
    if (!object) {
      return errorResponse('File not found in storage', request, 404);
    }

    // Return file with proper headers
    // Encode filename to handle special characters (RFC 5987)
    const safeFilename = encodeURIComponent(upload.original_filename).replace(/['()]/g, escape);
    const corsHeaders = getCorsHeaders(request);
    return new Response(object.body, {
      headers: {
        'Content-Type': upload.file_type,
        'Content-Disposition': `inline; filename*=UTF-8''${safeFilename}`,
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Serve file error:', error);
    return errorResponse(error.message || 'Failed to serve file', request, 500);
  }
}
