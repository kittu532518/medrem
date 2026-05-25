import { pool } from '../db.js';
import { authenticate } from '../auth.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

export async function userRoutes(fastify) {
  // GET /api/users/me
  fastify.get('/api/users/me', { preHandler: authenticate }, async (request, reply) => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [request.user.id]);
    const user = result.rows[0];
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return reply.send({
      id: user.id, phone: user.phone, name: user.name,
      date_of_birth: user.date_of_birth, language: user.language,
      caregiver_phone: user.caregiver_phone, caregiver_name: user.caregiver_name,
      has_face_photo: !!user.face_photo_path,
      created_at: user.created_at,
    });
  });

  // PUT /api/users/me
  fastify.put('/api/users/me', { preHandler: authenticate }, async (request, reply) => {
    const { name, date_of_birth, language, caregiver_phone, caregiver_name } = request.body;
    const userId = request.user.id;

    const validLanguages = ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr'];
    if (language && !validLanguages.includes(language))
      return reply.status(400).send({ error: `Invalid language. Must be one of: ${validLanguages.join(', ')}` });

    const fields = { name, date_of_birth, language, caregiver_phone, caregiver_name };
    const sets = [], vals = [];
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); }
    }
    if (sets.length > 0) {
      await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...vals, userId]);
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    return reply.send({
      id: user.id, phone: user.phone, name: user.name,
      date_of_birth: user.date_of_birth, language: user.language,
      caregiver_phone: user.caregiver_phone, caregiver_name: user.caregiver_name,
      has_face_photo: !!user.face_photo_path,
    });
  });

  // POST /api/users/face-photo  — upload patient reference selfie
  fastify.post('/api/users/face-photo', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No photo uploaded' });

    const fileDir = path.join(UPLOADS_DIR, userId, 'face');
    fs.mkdirSync(fileDir, { recursive: true });
    const fileExt = data.mimetype?.includes('png') ? '.png' : '.jpg';
    const filePath = path.join(fileDir, `reference${fileExt}`);
    const buf = await data.toBuffer();
    fs.writeFileSync(filePath, buf);

    await pool.query('UPDATE users SET face_photo_path = $1 WHERE id = $2', [filePath, userId]);

    return reply.send({ message: 'Face photo saved', has_face_photo: true });
  });
}
