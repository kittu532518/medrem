import { pool, generateId } from '../db.js';
import { authenticate } from '../auth.js';
import { extractPrescriptionMedicines } from '../services/claude.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

const ensureDir = d => fs.mkdirSync(d, { recursive: true });

export async function prescriptionRoutes(fastify) {
  // POST /api/prescriptions/upload
  fastify.post('/api/prescriptions/upload', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const uRes = await pool.query('SELECT language FROM users WHERE id = $1', [userId]);
    const language = uRes.rows[0]?.language || 'en';

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const type = data.fields?.type?.value || 'chronic';
    const duration_days = data.fields?.duration_days?.value
      ? parseInt(data.fields.duration_days.value) : null;

    const date = new Date().toISOString().split('T')[0];
    const fileDir = path.join(UPLOADS_DIR, userId, date);
    ensureDir(fileDir);
    const fileExt = data.mimetype?.includes("png") ? ".png" : data.mimetype?.includes("webp") ? ".webp" : ".jpg";
    const fileName = `rx_${generateId()}${fileExt}`;
    const filePath = path.join(fileDir, fileName);
    const fileBuffer = await data.toBuffer();
    fs.writeFileSync(filePath, fileBuffer);

    let expires_at = null;
    if (type === 'temporary' && duration_days) {
      const d = new Date();
      d.setDate(d.getDate() + duration_days);
      expires_at = d.toISOString().split('T')[0];
    }

    const prescId = generateId();
    await pool.query(
      `INSERT INTO prescriptions (id, user_id, type, duration_days, expires_at, image_path)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [prescId, userId, type, duration_days, expires_at, filePath]
    );

    const ocrResult = await extractPrescriptionMedicines(filePath, language);
    await pool.query('UPDATE prescriptions SET raw_ocr_json = $1 WHERE id = $2', [ocrResult, prescId]);

    return reply.send({
      prescription_id: prescId, type, duration_days, expires_at,
      medicines: ocrResult.medicines,
      overall_confidence: ocrResult.overall_confidence,
      notes: ocrResult.notes,
      ocr_error: ocrResult.error || null,
    });
  });

  // GET /api/prescriptions
  fastify.get('/api/prescriptions', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const pRes = await pool.query(
      'SELECT * FROM prescriptions WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    const mRes = await pool.query(
      'SELECT * FROM medicines WHERE user_id = $1 ORDER BY name', [userId]);

    const medsByPrescId = {};
    for (const m of mRes.rows) {
      (medsByPrescId[m.prescription_id] = medsByPrescId[m.prescription_id] || []).push(m);
    }
    const rows = pRes.rows.map(p => ({ ...p, medicines: medsByPrescId[p.id] || [] }));
    return reply.send(rows);
  });

  // DELETE /api/prescriptions/:id
  fastify.delete('/api/prescriptions/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const prescriptionId = request.params.id;

    const existing = await pool.query(
      'SELECT id FROM prescriptions WHERE id = $1 AND user_id = $2', [prescriptionId, userId]);
    if (!existing.rows[0])
      return reply.status(404).send({ error: 'Prescription not found' });

    await pool.query('DELETE FROM prescriptions WHERE id = $1 AND user_id = $2', [prescriptionId, userId]);
    return reply.send({ message: 'Prescription deleted', id: prescriptionId });
  });

  // POST /api/prescriptions/:id/confirm
  fastify.post('/api/prescriptions/:id/confirm', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const prescriptionId = request.params.id;
    const { medicines } = request.body;

    if (!medicines || !Array.isArray(medicines))
      return reply.status(400).send({ error: 'medicines array is required' });

    const prescResult = await pool.query(
      'SELECT * FROM prescriptions WHERE id = $1 AND user_id = $2', [prescriptionId, userId]);
    if (!prescResult.rows[0])
      return reply.status(404).send({ error: 'Prescription not found' });

    await pool.query('DELETE FROM medicines WHERE prescription_id = $1', [prescriptionId]);

    const inserted = [];
    for (const med of medicines) {
      if (!med.name || !med.sessions?.length) continue;
      const validSessions = ['morning', 'afternoon', 'evening', 'night'];
      const sessions = med.sessions.filter(s => validSessions.includes(s));
      if (!sessions.length) continue;

      const medId = generateId();
      await pool.query(
        `INSERT INTO medicines
           (id, prescription_id, user_id, name, dosage, form, special_instructions, sessions, needs_review)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [medId, prescriptionId, userId, med.name,
          med.dosage || null, med.form || null, med.special_instructions || null,
          sessions, med.needs_review ? 1 : 0]
      );
      const r = await pool.query('SELECT * FROM medicines WHERE id = $1', [medId]);
      inserted.push(r.rows[0]);
    }

    await pool.query('UPDATE prescriptions SET is_active = 1 WHERE id = $1', [prescriptionId]);

    return reply.send({
      message: 'Prescription confirmed',
      prescription_id: prescriptionId,
      medicines_count: inserted.length,
      medicines: inserted,
    });
  });
}
