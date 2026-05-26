import { pool, generateId } from '../db.js';
import { createHash } from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'medrem_dev_secret';

function hashPassword(password) {
  return createHash('sha256').update(password + 'medrem_salt').digest('hex');
}

function generateAdminToken(adminId, username) {
  return jwt.sign({ adminId, username, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
}

async function requireAdmin(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Admin authentication required' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access only' });
    }
    request.admin = decoded;
  } catch (err) {
    return reply.status(401).send({ error: 'Invalid or expired admin token' });
  }
}

export async function adminRoutes(fastify) {
  // ── POST /api/admin/login ─────────────────────────────────────
  fastify.post('/api/admin/login', async (request, reply) => {
    const { username, password } = request.body || {};
    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password required' });
    }
    const hash = hashPassword(password);
    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1 AND password_hash = $2',
      [username, hash]
    );
    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const admin = result.rows[0];
    const token = generateAdminToken(admin.id, admin.username);
    return reply.send({ token, username: admin.username });
  });

  // ── GET /api/admin/users ──────────────────────────────────────
  fastify.get('/api/admin/users', { preHandler: requireAdmin }, async (request, reply) => {
    const { search = '', page = 1, limit = 20 } = request.query;
    const offset = (page - 1) * limit;
    const searchPattern = `%${search}%`;

    let query = `SELECT u.id, u.phone, u.name, u.language, u.is_disabled, u.consecutive_misses, u.created_at,
              COUNT(DISTINCT m.id) AS medicine_count,
              SUM(CASE WHEN dl.status IN ('success','partial_success') THEN 1 ELSE 0 END) AS doses_taken,
              SUM(CASE WHEN dl.status = 'pending' AND dl.scheduled_date < date('now') THEN 1 ELSE 0 END) AS doses_missed
       FROM users u
       LEFT JOIN medicines m ON m.user_id = u.id AND m.is_active = 1
       LEFT JOIN dose_logs dl ON dl.user_id = u.id`;

    let params = [limit, offset];

    if (search.trim()) {
      query += ` WHERE (u.name LIKE $1 OR u.phone LIKE $1)`;
      params = [searchPattern, limit, offset];
    }

    query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const users = await pool.query(query, params);

    // Count total matching users
    let countQuery = 'SELECT COUNT(*) as count FROM users';
    let countParams = [];

    if (search.trim()) {
      countQuery += ' WHERE name LIKE $1 OR phone LIKE $1';
      countParams = [searchPattern];
    }

    const total = await pool.query(countQuery, countParams);

    return reply.send({
      users: users.rows,
      total: total.rows[0]?.count || 0,
      page: Number(page),
      limit: Number(limit),
    });
  });

  // ── GET /api/admin/users/:id ──────────────────────────────────
  fastify.get('/api/admin/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params;

    const user = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!user.rows[0]) return reply.status(404).send({ error: 'User not found' });

    const meds = await pool.query(
      'SELECT * FROM medicines WHERE user_id = $1 ORDER BY created_at DESC',
      [id]
    );

    const logs = await pool.query(
      `SELECT dl.*, m.name as medicine_name
       FROM dose_logs dl
       JOIN medicines m ON m.id = dl.medicine_id
       WHERE dl.user_id = $1
       ORDER BY dl.scheduled_date DESC, dl.session ASC
       LIMIT 30`,
      [id]
    );

    return reply.send({
      user: user.rows[0],
      medicines: meds.rows,
      recent_logs: logs.rows,
    });
  });

  // ── PATCH /api/admin/users/:id ────────────────────────────────
  fastify.patch('/api/admin/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params;
    const { is_disabled } = request.body || {};

    if (is_disabled === undefined) {
      return reply.status(400).send({ error: 'is_disabled field required' });
    }

    await pool.query(
      'UPDATE users SET is_disabled = $1 WHERE id = $2',
      [is_disabled ? 1 : 0, id]
    );

    return reply.send({ ok: true, is_disabled: Boolean(is_disabled) });
  });

  // ── DELETE /api/admin/users/:id ───────────────────────────────
  fastify.delete('/api/admin/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return reply.send({ ok: true });
  });

  // ── GET /api/admin/stats ──────────────────────────────────────
  fastify.get('/api/admin/stats', { preHandler: requireAdmin }, async (request, reply) => {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users)                          AS total_users,
        (SELECT COUNT(*) FROM users WHERE is_disabled = 0)   AS active_users,
        (SELECT COUNT(*) FROM users
          WHERE created_at >= datetime('now', '-7 days'))     AS new_this_week,
        (SELECT COUNT(*) FROM medicines WHERE is_active = 1) AS active_medicines,
        (SELECT COUNT(*) FROM dose_logs
          WHERE status IN ('success','partial_success'))      AS total_doses_taken,
        (SELECT COUNT(*) FROM dose_logs
          WHERE status = 'pending'
            AND scheduled_date < date('now'))                 AS total_doses_missed
    `);

    return reply.send(stats.rows[0] || {});
  });

  // ── GET /api/admin/me ─────────────────────────────────────────
  fastify.get('/api/admin/me', { preHandler: requireAdmin }, async (request, reply) => {
    return reply.send({ adminId: request.admin.adminId, username: request.admin.username });
  });

  // ── GET /api/admin/users/:id/photos ────────────────────────────
  fastify.get('/api/admin/users/:id/photos', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params;
    const { dateRange = 'last7days' } = request.query;

    let dateFilter;
    if (dateRange === 'today') {
      dateFilter = `date('now')`;
    } else if (dateRange === 'last7days') {
      dateFilter = `date('now', '-7 days')`;
    } else if (dateRange === 'last30days') {
      dateFilter = `date('now', '-30 days')`;
    } else {
      return reply.status(400).send({ error: 'Invalid date range' });
    }

    const user = await pool.query('SELECT id, name, phone FROM users WHERE id = $1', [id]);
    if (!user.rows[0]) return reply.status(404).send({ error: 'User not found' });

    const photos = await pool.query(
      `SELECT dl.id, dl.session, dl.status, dl.photo_path, dl.submitted_at,
              dl.scheduled_date, dl.ai_validation_result, m.name as medicine_name, m.dosage,
              m.id as medicine_id
       FROM dose_logs dl
       JOIN medicines m ON m.id = dl.medicine_id
       WHERE dl.user_id = $1 AND dl.photo_path IS NOT NULL
         AND dl.scheduled_date >= date(${dateFilter})
       ORDER BY dl.scheduled_date DESC, dl.session ASC`,
      [id]
    );

    return reply.send({
      user: user.rows[0],
      dateRange,
      totalPhotos: photos.rows.length,
      photos: photos.rows.map(row => ({
        doseId: row.id,
        date: row.scheduled_date,
        session: row.session,
        status: row.status,
        medicine: {
          id: row.medicine_id,
          name: row.medicine_name,
          dosage: row.dosage,
        },
        photoPath: row.photo_path,
        submittedAt: row.submitted_at,
        validation: row.ai_validation_result ? JSON.parse(row.ai_validation_result) : null,
      })),
    });
  });
}
