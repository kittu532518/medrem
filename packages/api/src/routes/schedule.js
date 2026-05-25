import { pool, generateId } from '../db.js';
import { authenticate } from '../auth.js';
import { SESSION_ORDER } from '../services/sessionEngine.js';

async function getScheduleForDate(userId, dateStr) {
  const medResult = await pool.query(
    `SELECT * FROM medicines WHERE user_id = $1 AND is_active = 1`, [userId]);

  const slots = [];
  for (const medicine of medResult.rows) {
    const sessions = Array.isArray(medicine.sessions) ? medicine.sessions : [];
    for (const session of sessions) {
      if (!SESSION_ORDER.includes(session)) continue;

      // Insert if not exists (SQLite: no ON CONFLICT ... DO NOTHING RETURNING)
      const existing = await pool.query(
        `SELECT * FROM dose_logs WHERE medicine_id=$1 AND scheduled_date=$2 AND session=$3`,
        [medicine.id, dateStr, session]);

      let dose = existing.rows[0];
      if (!dose) {
        const doseId = generateId();
        await pool.query(
          `INSERT OR IGNORE INTO dose_logs (id, user_id, medicine_id, scheduled_date, session, status)
           VALUES ($1,$2,$3,$4,$5,'pending')`,
          [doseId, userId, medicine.id, dateStr, session]);
        const r = await pool.query('SELECT * FROM dose_logs WHERE id=$1', [doseId]);
        dose = r.rows[0];
      }
      if (!dose) continue;

      slots.push({
        dose_id: dose.id, medicine_id: medicine.id,
        medicine_name: medicine.name, dosage: medicine.dosage,
        form: medicine.form, special_instructions: medicine.special_instructions,
        session, scheduled_date: dateStr, status: dose.status,
        submitted_at: dose.submitted_at,
        ai_validation_result: dose.ai_validation_result,
        photo_path: dose.photo_path, override_reason: dose.override_reason,
      });
    }
  }

  const grouped = {};
  for (const s of SESSION_ORDER) grouped[s] = slots.filter(x => x.session === s);
  return { date: dateStr, sessions: grouped, total_doses: slots.length };
}

export async function scheduleRoutes(fastify) {
  // GET /api/schedule/today
  fastify.get('/api/schedule/today', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const today = new Date().toISOString().split('T')[0];
    const schedule = await getScheduleForDate(userId, today);
    return reply.send(schedule);
  });

  // GET /api/schedule/date/:date
  fastify.get('/api/schedule/date/:date', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const { date } = request.params;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.status(400).send({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const schedule = await getScheduleForDate(userId, date);
    return reply.send(schedule);
  });
}
