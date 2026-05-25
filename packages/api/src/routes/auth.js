import { pool, generateId } from '../db.js';
import { generateToken } from '../auth.js';

export async function authRoutes(fastify) {

  // ── POST /api/auth/send-otp ───────────────────────────────────────────────
  fastify.post('/api/auth/send-otp', async (request, reply) => {
    const { phone } = request.body || {};

    if (!phone || phone.trim().length < 8) {
      return reply.status(400).send({ error: 'A valid phone number is required' });
    }

    // Generate 6-digit OTP and store in DB (persists across server restarts)
    const otp      = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Upsert: delete old OTP for this phone, insert fresh one
    await pool.query('DELETE FROM otp_tokens WHERE phone = $1', [phone]);
    await pool.query(
      'INSERT INTO otp_tokens (id, phone, otp, expires_at) VALUES ($1, $2, $3, $4)',
      [generateId(), phone, otp, expiresAt]
    );

    // Always log to server console so you can copy it from Cloud logs
    console.log(`[OTP] ☎  ${phone}  →  ${otp}  (valid 10 min)`);

    // ── Twilio (uncomment + npm install twilio when ready) ──────────────────
    // import twilio from 'twilio';
    // const tw = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await tw.messages.create({ body: `Your MedRem OTP: ${otp}`, from: process.env.TWILIO_PHONE_NUMBER, to: phone });

    return reply.send({
      message: 'OTP generated',
      // Always return OTP in response until real SMS is wired up.
      // Remove this line once Twilio is configured.
      otp,
    });
  });

  // ── POST /api/auth/verify-otp ─────────────────────────────────────────────
  fastify.post('/api/auth/verify-otp', async (request, reply) => {
    const { phone, otp } = request.body || {};

    if (!phone || !otp) {
      return reply.status(400).send({ error: 'Phone and OTP are required' });
    }

    // Universal test bypass — always works (remove once Twilio is live)
    const MASTER_OTP = process.env.MASTER_OTP || '123456';
    let isValid = otp === MASTER_OTP;

    if (!isValid) {
      // Check DB-persisted OTP
      const result = await pool.query(
        `SELECT otp, expires_at FROM otp_tokens
         WHERE phone = $1 AND expires_at > datetime('now')
         ORDER BY expires_at DESC LIMIT 1`,
        [phone]
      );
      const row = result.rows[0];
      if (row && row.otp === otp) {
        isValid = true;
        await pool.query('DELETE FROM otp_tokens WHERE phone = $1', [phone]);
      }
    }

    if (!isValid) {
      // Return 400, NOT 401 — a 401 would trigger the global redirect interceptor
      return reply.status(400).send({ error: 'Invalid or expired OTP. Please try again.' });
    }

    // Find existing user or create new one
    let result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    let user   = result.rows[0];

    if (!user) {
      const id = generateId();
      await pool.query('INSERT INTO users (id, phone) VALUES ($1, $2)', [id, phone]);
      result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      user   = result.rows[0];
    }

    if (user.is_disabled) {
      return reply.status(403).send({ error: 'Account disabled. Please contact support.' });
    }

    const token = generateToken(user.id);

    return reply.send({
      token,
      user: {
        id:        user.id,
        phone:     user.phone,
        name:      user.name,
        language:  user.language,
        isNewUser: !user.name,
      },
    });
  });
}
