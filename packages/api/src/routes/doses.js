import { pool, generateId } from '../db.js';
import { authenticate } from '../auth.js';
import { validateDosePhoto } from '../services/claude.js';
import { assignPhotoToSession } from '../services/sessionEngine.js';
import { sendCaregiverAlert } from '../services/sms.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function extractExifDate(buffer) {
  try {
    // Dynamic import for ESM module
    const exifr = await import('exifr');
    const exif = await exifr.default.parse(buffer, ['DateTimeOriginal', 'DateTime']);
    if (exif?.DateTimeOriginal) return new Date(exif.DateTimeOriginal);
    if (exif?.DateTime) return new Date(exif.DateTime);
    return null;
  } catch (err) {
    console.log('[EXIF] Could not extract date:', err.message);
    return null;
  }
}

export async function doseRoutes(fastify) {
  // POST /api/doses/:id/submit-photo
  fastify.post('/api/doses/:id/submit-photo', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const doseId = request.params.id;
    const language = request.user.language || 'en';

    // Fetch dose log + user's reference face photo
    const doseResult = await pool.query(
      `SELECT dl.*, m.name as medicine_name, m.dosage, m.sessions as medicine_sessions,
              u.caregiver_phone, u.caregiver_name, u.name as patient_name, u.face_photo_path
       FROM dose_logs dl
       JOIN medicines m ON m.id = dl.medicine_id
       JOIN users u ON u.id = dl.user_id
       WHERE dl.id = $1 AND dl.user_id = $2`,
      [doseId, userId]
    );

    if (doseResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Dose log not found' });
    }

    const dose = doseResult.rows[0];

    if (dose.status === 'success') {
      return reply.status(400).send({ error: 'This dose has already been verified successfully' });
    }

    // Get uploaded file
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No photo uploaded' });
    }

    const fileBuffer = await data.toBuffer();

    // Extract EXIF timestamp
    const exifTimestamp = await extractExifDate(fileBuffer);

    // Session assignment check
    const now = new Date();
    const sessionCheck = assignPhotoToSession(exifTimestamp, now, dose.session);

    // Rule 5: Wrong day
    if (sessionCheck.action === 'reject_wrong_day') {
      return reply.send({
        accepted: false,
        action: 'reject_wrong_day',
        message: sessionCheck.message,
        session: dose.session,
        exif_timestamp: exifTimestamp?.toISOString() || null,
      });
    }

    // Rule 3: After window, before next — reject, offer partial
    if (sessionCheck.action === 'reject') {
      return reply.send({
        accepted: false,
        action: 'reject',
        message: sessionCheck.message,
        session: dose.session,
        can_override: true,
        exif_timestamp: exifTimestamp?.toISOString() || null,
      });
    }

    // Rule 4: Assign to next session — mark current as FAILURE
    if (sessionCheck.action === 'assign_to_next') {
      // Mark current session as failure
      await pool.query(
        `UPDATE dose_logs SET status = 'failure' WHERE id = $1`,
        [doseId]
      );

      // Find or create dose log for next session
      const nextSession = sessionCheck.session;
      const today = now.toISOString().split('T')[0];

      await pool.query(
        `INSERT OR IGNORE INTO dose_logs (id, user_id, medicine_id, scheduled_date, session, status)
         VALUES ($1,$2,$3,$4,$5,'pending')`,
        [generateId(), userId, dose.medicine_id, today, nextSession]
      );

      const nextDoseResult = await pool.query(
        `SELECT id FROM dose_logs WHERE medicine_id = $1 AND scheduled_date = $2 AND session = $3`,
        [dose.medicine_id, today, nextSession]
      );

      if (nextDoseResult.rows.length === 0) {
        return reply.status(500).send({ error: 'Could not create next session dose log' });
      }

      return reply.send({
        accepted: false,
        action: 'assign_to_next',
        message: sessionCheck.message,
        missed_session: dose.session,
        next_session: nextSession,
        next_dose_id: nextDoseResult.rows[0].id,
        exif_timestamp: exifTimestamp?.toISOString() || null,
      });
    }

    // Action is 'accept' — save file and validate with Claude
    const date = now.toISOString().split('T')[0];
    const fileDir = path.join(UPLOADS_DIR, userId, date);
    ensureDir(fileDir);

    const fileExt = data.mimetype?.includes('png') ? '.png' : '.jpg';
    const fileName = `dose_${generateId()}${fileExt}`;
    const filePath = path.join(fileDir, fileName);
    fs.writeFileSync(filePath, fileBuffer);

    // Get expected medicines for this session
    // SQLite: sessions stored as JSON array string, use json_each to filter
    const medsResult = await pool.query(
      `SELECT name, dosage FROM medicines
       WHERE user_id = $1 AND is_active = 1
         AND json_extract(sessions, '$') LIKE $2`,
      [userId, `%"${dose.session}"%`]
    );

    const expectedMedicines = medsResult.rows;

    // Validate with Claude — pass reference face photo if the patient has one
    const validation = await validateDosePhoto(filePath, expectedMedicines, language, dose.face_photo_path || null);

    // Update dose log
    const newStatus = validation.passed ? 'success' : 'pending'; // still pending if failed (allow retries)

    await pool.query(
      `UPDATE dose_logs
       SET status = $1, photo_path = $2, ai_validation_result = $3, submitted_at = datetime('now')
       WHERE id = $4`,
      [newStatus, filePath, validation, doseId]
    );

    return reply.send({
      accepted: validation.passed,
      action: 'accept',
      status: newStatus,
      validation,
      session: dose.session,
      message: validation.passed
        ? 'Dose verified successfully!'
        : `Verification failed: ${validation.reason}`,
      exif_timestamp: exifTimestamp?.toISOString() || null,
      exif_used: sessionCheck.exifUsed,
    });
  });

  // POST /api/doses/:id/partial-override
  fastify.post('/api/doses/:id/partial-override', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const doseId = request.params.id;
    const { reason } = request.body || {};

    const doseResult = await pool.query(
      `SELECT dl.*, u.caregiver_phone, u.caregiver_name, u.name as patient_name
       FROM dose_logs dl
       JOIN users u ON u.id = dl.user_id
       WHERE dl.id = $1 AND dl.user_id = $2`,
      [doseId, userId]
    );

    if (doseResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Dose log not found' });
    }

    const dose = doseResult.rows[0];

    if (dose.status === 'success') {
      return reply.status(400).send({ error: 'Dose already marked as success' });
    }

    // Mark as partial_success
    await pool.query(
      `UPDATE dose_logs
       SET status = 'partial_success', override_reason = $1, submitted_at = datetime('now')
       WHERE id = $2`,
      [reason || 'Patient manually confirmed', doseId]
    );

    // Trigger caregiver SMS
    await sendCaregiverAlert(
      dose.caregiver_phone,
      dose.caregiver_name,
      dose.patient_name,
      'partial_success',
      null
    );

    return reply.send({
      status: 'partial_success',
      message: 'Dose marked as partially verified. Caregiver has been notified.',
    });
  });
}