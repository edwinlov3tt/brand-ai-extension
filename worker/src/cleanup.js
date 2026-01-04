/**
 * Cleanup Handler for File Uploads
 * Triggered daily via cron to:
 * 1. Remove expired files (30+ days old)
 * 2. Remove orphaned session uploads (24+ hours old, no conversation)
 */

const BATCH_SIZE = 100; // Process files in batches
const ONE_DAY_SECONDS = 24 * 60 * 60;

/**
 * Delete uploads from R2 and D1
 */
async function deleteUploads(uploads, env) {
  let deleted = 0;
  for (const upload of uploads) {
    try {
      // Delete from R2
      if (upload.r2_key) {
        await env.UPLOADS.delete(upload.r2_key);
      }

      // Delete from D1
      await env.DB.prepare(
        'DELETE FROM file_uploads WHERE id = ?'
      ).bind(upload.id).run();

      deleted++;
    } catch (error) {
      console.error(`Failed to cleanup upload ${upload.id}:`, error);
    }
  }
  return deleted;
}

/**
 * Handle scheduled cron event
 * Deletes expired and orphaned file uploads from R2 and D1
 */
export async function handleScheduled(event, env, ctx) {
  console.log('Running file upload cleanup...');

  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - ONE_DAY_SECONDS;
  let totalDeleted = 0;

  // 1. Clean expired uploads (30+ days old)
  let hasMore = true;
  while (hasMore) {
    const expired = await env.DB.prepare(`
      SELECT id, r2_key
      FROM file_uploads
      WHERE expires_at < ?
      LIMIT ?
    `).bind(now, BATCH_SIZE).all();

    const results = expired.results || [];
    if (results.length === 0) {
      hasMore = false;
      break;
    }

    totalDeleted += await deleteUploads(results, env);

    if (results.length < BATCH_SIZE) {
      hasMore = false;
    }
  }
  console.log(`Deleted ${totalDeleted} expired uploads.`);

  // 2. Clean orphaned session uploads (24+ hours old, no conversation)
  let orphanDeleted = 0;
  hasMore = true;
  while (hasMore) {
    const orphaned = await env.DB.prepare(`
      SELECT id, r2_key
      FROM file_uploads
      WHERE conversation_id IS NULL AND created_at < ?
      LIMIT ?
    `).bind(oneDayAgo, BATCH_SIZE).all();

    const results = orphaned.results || [];
    if (results.length === 0) {
      hasMore = false;
      break;
    }

    orphanDeleted += await deleteUploads(results, env);

    if (results.length < BATCH_SIZE) {
      hasMore = false;
    }
  }
  console.log(`Deleted ${orphanDeleted} orphaned session uploads.`);

  totalDeleted += orphanDeleted;
  console.log(`Cleanup complete. Total deleted: ${totalDeleted}`);
  return { deleted: totalDeleted, orphanDeleted };
}
