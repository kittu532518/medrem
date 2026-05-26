/**
 * Google Cloud Storage synchronization for persistent database storage
 *
 * This module handles syncing the SQLite database and uploads folder
 * to/from Google Cloud Storage to persist data across Cloud Run deployments.
 *
 * Cloud Run containers are ephemeral - files are deleted on each redeploy.
 * This solution keeps data in GCS (persistent) and syncs to local disk for use.
 */

import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration from environment
const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const BUCKET_NAME = process.env.GCS_BUCKET || 'medrem-data-prod';
const LOCAL_DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'medrem.db');
const LOCAL_UPLOADS_PATH = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

let storage;
let bucket;

/**
 * Initialize GCS client
 * Only initializes if running on Google Cloud (PROJECT_ID available)
 */
function initGCS() {
  if (!PROJECT_ID) {
    console.log('[GCS] Not running on Google Cloud, skipping GCS initialization');
    return false;
  }

  try {
    storage = new Storage({ projectId: PROJECT_ID });
    bucket = storage.bucket(BUCKET_NAME);
    console.log(`[GCS] Initialized for project: ${PROJECT_ID}, bucket: ${BUCKET_NAME}`);
    return true;
  } catch (err) {
    console.error('[GCS] Failed to initialize:', err.message);
    return false;
  }
}

/**
 * Download database from Cloud Storage
 * Called on server startup to restore data from persistent storage
 */
export async function syncDatabaseFromCloud() {
  if (!initGCS()) return;

  try {
    console.log('[GCS] Syncing database from Cloud Storage...');

    const remoteDb = bucket.file('db/medrem.db');
    const [exists] = await remoteDb.exists();

    if (exists) {
      // Ensure local directory exists
      const dbDir = path.dirname(LOCAL_DB_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Download from cloud
      await remoteDb.download({ destination: LOCAL_DB_PATH });

      // Get file size for logging
      const stats = fs.statSync(LOCAL_DB_PATH);
      console.log(`[GCS] ✓ Database downloaded (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      console.log('[GCS] No remote database found, starting fresh');
    }
  } catch (err) {
    console.error('[GCS] Database sync failed:', err.message);
    console.log('[GCS] Continuing with local database...');
    // Don't fail startup - allow app to continue with local DB
  }
}

/**
 * Upload database to Cloud Storage
 * Called periodically and on graceful shutdown to back up data
 */
export async function syncDatabaseToCloud() {
  if (!initGCS()) return;

  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      console.log('[GCS] No local database found, skipping upload');
      return;
    }

    console.log('[GCS] Syncing database to Cloud Storage...');

    const fileContent = fs.readFileSync(LOCAL_DB_PATH);
    const remoteDb = bucket.file('db/medrem.db');

    // Save with resumable upload for reliability
    await remoteDb.save(fileContent, {
      resumable: true,
      metadata: {
        cacheControl: 'no-cache',
      },
    });

    const sizeInMB = (fileContent.length / 1024 / 1024).toFixed(2);
    console.log(`[GCS] ✓ Database uploaded (${sizeInMB} MB)`);
  } catch (err) {
    console.error('[GCS] Database upload failed:', err.message);
    // Don't fail - allow app to continue even if backup fails
  }
}

/**
 * Upload all files from uploads directory to Cloud Storage
 * Called periodically to back up user-uploaded photos
 */
export async function syncUploadsToCloud() {
  if (!initGCS()) return;

  try {
    if (!fs.existsSync(LOCAL_UPLOADS_PATH)) {
      console.log('[GCS] No uploads directory found');
      return;
    }

    console.log('[GCS] Syncing uploads to Cloud Storage...');

    // Count files
    let fileCount = 0;
    const countFiles = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          countFiles(fullPath);
        } else {
          fileCount++;
        }
      }
    };
    countFiles(LOCAL_UPLOADS_PATH);

    if (fileCount === 0) {
      console.log('[GCS] No files to upload');
      return;
    }

    // Upload directory
    await bucket.upload(LOCAL_UPLOADS_PATH, {
      prefix: 'uploads/',
      resumable: true,
      // Skip if file already exists in cloud (for speed)
      skipIfExists: true,
    });

    console.log(`[GCS] ✓ Uploaded ${fileCount} files`);
  } catch (err) {
    console.error('[GCS] Uploads sync failed:', err.message);
  }
}

/**
 * Start periodic sync to Cloud Storage
 * Runs every 5 minutes to ensure data is backed up
 * Also syncs on graceful shutdown
 */
export function startPeriodicSync() {
  if (!initGCS()) return;

  // Sync database every 5 minutes
  const syncInterval = setInterval(async () => {
    try {
      await syncDatabaseToCloud();
    } catch (err) {
      console.error('[GCS] Periodic sync failed:', err.message);
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Sync uploads every 10 minutes
  const uploadSyncInterval = setInterval(async () => {
    try {
      await syncUploadsToCloud();
    } catch (err) {
      console.error('[GCS] Upload sync failed:', err.message);
    }
  }, 10 * 60 * 1000); // 10 minutes

  // Graceful shutdown - sync before exit
  process.on('SIGTERM', async () => {
    console.log('[GCS] Graceful shutdown initiated, syncing data...');
    clearInterval(syncInterval);
    clearInterval(uploadSyncInterval);

    try {
      await syncDatabaseToCloud();
      await syncUploadsToCloud();
      console.log('[GCS] ✓ Data synced before shutdown');
    } catch (err) {
      console.error('[GCS] Shutdown sync failed:', err.message);
    }

    process.exit(0);
  });

  console.log('[GCS] Periodic sync started (every 5 minutes)');
}

/**
 * One-time setup for Cloud Storage bucket
 * Creates necessary directory structure
 */
export async function initializeBucket() {
  if (!initGCS()) return false;

  try {
    console.log('[GCS] Initializing bucket structure...');

    // Create placeholder files to establish directory structure
    const placeholders = [
      'db/medrem.db',
      'uploads/placeholder.txt',
    ];

    for (const placeholder of placeholders) {
      const file = bucket.file(placeholder);
      const [exists] = await file.exists();

      if (!exists && placeholder.includes('placeholder')) {
        await file.save('');
        console.log(`[GCS] Created: ${placeholder}`);
      }
    }

    console.log('[GCS] ✓ Bucket initialized');
    return true;
  } catch (err) {
    console.error('[GCS] Bucket initialization failed:', err.message);
    return false;
  }
}

/**
 * Health check - verify GCS connectivity
 */
export async function healthCheck() {
  if (!initGCS()) return false;

  try {
    const [exists] = await bucket.exists();
    return exists;
  } catch (err) {
    console.error('[GCS] Health check failed:', err.message);
    return false;
  }
}

/**
 * Get storage stats (for monitoring)
 */
export async function getStorageStats() {
  if (!initGCS()) return null;

  try {
    const [files] = await bucket.getFiles();

    let totalSize = 0;
    let dbSize = 0;
    let uploadsSize = 0;

    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const size = parseInt(metadata.size || 0);

      totalSize += size;

      if (file.name.startsWith('db/')) {
        dbSize += size;
      } else if (file.name.startsWith('uploads/')) {
        uploadsSize += size;
      }
    }

    return {
      totalFiles: files.length,
      totalSize,
      dbSize,
      uploadsSize,
      formattedSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
    };
  } catch (err) {
    console.error('[GCS] Stats retrieval failed:', err.message);
    return null;
  }
}
