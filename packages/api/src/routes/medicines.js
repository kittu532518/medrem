import { pool, generateId } from '../db.js';
import { authenticate } from '../auth.js';

export async function medicineRoutes(fastify) {
  // GET /api/medicines
  fastify.get('/api/medicines', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const result = await pool.query(
      'SELECT * FROM medicines WHERE user_id = $1 ORDER BY name', [userId]);
    return reply.send(result.rows);
  });

  // POST /api/medicines  — manually add a medicine
  fastify.post('/api/medicines', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const { prescription_id, name, dosage, form, special_instructions, sessions } = request.body || {};

    if (!name) return reply.status(400).send({ error: 'name is required' });

    const validSessions = ['morning', 'afternoon', 'evening', 'night'];
    const validatedSessions = (sessions || ['morning']).filter(s => validSessions.includes(s));
    if (!validatedSessions.length)
      return reply.status(400).send({ error: 'At least one valid session required' });

    if (prescription_id) {
      const pr = await pool.query(
        'SELECT id FROM prescriptions WHERE id = $1 AND user_id = $2', [prescription_id, userId]);
      if (!pr.rows[0]) return reply.status(404).send({ error: 'Prescription not found' });
    }

    const medId = generateId();
    await pool.query(
      'INSERT INTO medicines (id, prescription_id, user_id, name, dosage, form, special_instructions, sessions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [medId, prescription_id || null, userId, name, dosage || null, form || null, special_instructions || null, validatedSessions]
    );

    const r = await pool.query('SELECT * FROM medicines WHERE id = $1', [medId]);
    return reply.status(201).send(r.rows[0]);
  });

  // PUT /api/medicines/:id
  fastify.put('/api/medicines/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const medicineId = request.params.id;
    const { name, dosage, form, special_instructions, sessions, is_active, needs_review } = request.body;

    const medResult = await pool.query(
      'SELECT * FROM medicines WHERE id = $1 AND user_id = $2', [medicineId, userId]);
    if (!medResult.rows[0]) return reply.status(404).send({ error: 'Medicine not found' });

    const validSessions = ['morning', 'afternoon', 'evening', 'night'];
    let validatedSessions = sessions;
    if (sessions) {
      validatedSessions = sessions.filter(s => validSessions.includes(s));
      if (!validatedSessions.length)
        return reply.status(400).send({ error: 'At least one valid session required' });
    }

    const fields = { name, dosage, form, special_instructions };
    if (validatedSessions) fields.sessions = validatedSessions;
    if (is_active !== undefined) fields.is_active = is_active ? 1 : 0;
    if (needs_review !== undefined) fields.needs_review = needs_review ? 1 : 0;

    const sets = [], vals = [];
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); }
    }
    if (sets.length) {
      await pool.query(
        `UPDATE medicines SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
        [...vals, medicineId, userId]
      );
    }

    const r = await pool.query('SELECT * FROM medicines WHERE id = $1', [medicineId]);
    return reply.send(r.rows[0]);
  });

  // DELETE /api/medicines/:id  (soft delete)
  fastify.delete('/api/medicines/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const medicineId = request.params.id;
    const r = await pool.query(
      'SELECT name FROM medicines WHERE id=$1 AND user_id=$2', [medicineId, userId]);
    if (!r.rows[0]) return reply.status(404).send({ error: 'Medicine not found' });
    await pool.query('UPDATE medicines SET is_active=0 WHERE id=$1 AND user_id=$2', [medicineId, userId]);
    return reply.send({ message: `Medicine "${r.rows[0].name}" deactivated`, id: medicineId });
  });
}
