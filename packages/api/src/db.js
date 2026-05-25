import { createClient } from '@libsql/client';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'medrem.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const client = createClient({ url: `file:${DB_PATH}` });

const JSON_COLS = new Set([
  'push_subscription', 'raw_ocr_json', 'ai_validation_result',
  'subscription', 'sessions',
]);

const toSqlite = sql => sql.replace(/\$\d+/g, '?');

const deserializeRow = row => {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (JSON_COLS.has(k) && typeof v === 'string') {
      try { out[k] = JSON.parse(v); } catch { out[k] = v; }
    } else {
      out[k] = v;
    }
  }
  return out;
};

const serializeArgs = args =>
  (args || []).map(a =>
    (a !== null && a !== undefined && typeof a === 'object') ? JSON.stringify(a) : a
  );

export const pool = {
  query: async (sql, params = []) => {
    const converted = toSqlite(sql);
    const args = serializeArgs(params);
    try {
      const result = await client.execute({ sql: converted, args });
      const rows = result.rows.map(deserializeRow);
      return { rows, rowCount: result.rowsAffected ?? rows.length };
    } catch (err) {
      console.error('[DB ERROR]', err.message, '\nSQL:', converted.substring(0, 200));
      throw err;
    }
  },
};

export const generateId = () => randomUUID();

export async function initDb() {
  await client.execute('PRAGMA journal_mode=WAL');
  await client.execute('PRAGMA foreign_keys=ON');

  await client.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      name TEXT,
      date_of_birth TEXT,
      language TEXT DEFAULT 'en',
      caregiver_phone TEXT,
      caregiver_name TEXT,
      push_subscription TEXT,
      face_photo_path TEXT,
      is_disabled INTEGER DEFAULT 0,
      consecutive_misses INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS otp_tokens (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      otp TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('chronic','temporary')),
      duration_days INTEGER,
      starts_at TEXT NOT NULL DEFAULT (date('now')),
      expires_at TEXT,
      image_path TEXT,
      raw_ocr_json TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      prescription_id TEXT REFERENCES prescriptions(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      dosage TEXT,
      form TEXT,
      special_instructions TEXT,
      sessions TEXT NOT NULL DEFAULT '[]',
      needs_review INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS dose_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
      scheduled_date TEXT NOT NULL,
      session TEXT NOT NULL CHECK(session IN ('morning','afternoon','evening','night')),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','success','partial_success','failure')),
      photo_path TEXT,
      ai_validation_result TEXT,
      submitted_at TEXT,
      override_reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(medicine_id, scheduled_date, session)
    )`,
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subscription TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ], 'write');

  // Migrate existing databases — safe no-op if column already exists
  const migrations = [
    `ALTER TABLE users ADD COLUMN face_photo_path TEXT`,
    `ALTER TABLE users ADD COLUMN is_disabled INTEGER DEFAULT 0`,
  ];
  for (const sql of migrations) {
    try { await client.execute(sql); } catch (_) {}
  }

  // Clean up expired OTPs on startup
  try {
    await client.execute(`DELETE FROM otp_tokens WHERE expires_at <= datetime('now')`);
  } catch (_) {}

  await seedDefaultAdmin();

  console.log('[DB] SQLite ready →', DB_PATH);
}

async function seedDefaultAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'medrem_admin_2024';
  const { createHash } = await import('crypto');
  const hash = createHash('sha256').update(password + 'medrem_salt').digest('hex');
  try {
    const existing = await client.execute({
      sql: 'SELECT id FROM admins WHERE username = ?',
      args: [username],
    });
    if (existing.rows.length === 0) {
      await client.execute({
        sql: 'INSERT INTO admins (id, username, password_hash) VALUES (?, ?, ?)',
        args: [randomUUID(), username, hash],
      });
      console.log(`[DB] Default admin created — username: "${username}"`);
    }
  } catch (_) {}
}
