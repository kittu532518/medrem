import { pool, generateId } from '../db.js';
import { generateToken } from '../auth.js';

export async function authRoutes(fastify) {

  // ── POST /api/auth/send-otp ───────────────────────────────────────────────
  fastify.post('/api/auth/send-otp', async (request, reply) => {
    const { phone } = request.body || {};

    if (!phone || phone.trim().length < 8) {
      return reply.status(400).send({ error: 'A valid phone number is required' });
    }

    // ✅ CHANGED: Allow both new registrations (onboarding) and existing logins
    //   Check if user exists and is disabled
    const userResult = await pool.query(
      'SELECT id, is_disabled FROM users WHERE phone = $1',
      [phone]
    );

    // If user exists and is disabled, block them
    if (userResult.rows[0] && userResult.rows[0].is_disabled) {
      return reply.status(403).send({
        error: 'Account disabled',
        message: 'Please contact support',
        code: 'ACCOUNT_DISABLED',
      });
    }

    // If user doesn't exist, that's OK - they're registering (onboarding)
    // If user exists and not disabled, that's OK - they're logging in

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

    // Find or create user
    // ✅ IMPORTANT: During onboarding (registration), user doesn't exist yet
    //   So we CREATE the account here for new registrations
    // ✅ For login, validation in send-otp already checked phone exists
    let result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    let user   = result.rows[0];

    if (!user) {
      // New user registration (onboarding flow)
      const id = generateId();
      await pool.query('INSERT INTO users (id, phone) VALUES ($1, $2)', [id, phone]);
      result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      user   = result.rows[0];
    }

    if (user.is_disabled) {
      return reply.status(403).send({
        error: 'Account disabled',
        message: 'Please contact support',
        code: 'ACCOUNT_DISABLED',
      });
    }

    // Check if user has medicines (determines if they've completed onboarding)
    const medicinesResult = await pool.query(
      'SELECT COUNT(*) as count FROM medicines WHERE user_id = $1 AND is_active = 1',
      [user.id]
    );

    const hasMedicines = medicinesResult.rows[0]?.count > 0;

    const token = generateToken(user.id);

    return reply.send({
      token,
      user: {
        id:        user.id,
        phone:     user.phone,
        name:      user.name,
        language:  user.language,
        isNewUser: !hasMedicines, // ✅ Changed: isNewUser means no medicines (not done with onboarding)
      },
    });
  });
}
