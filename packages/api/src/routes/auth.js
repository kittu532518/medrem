import { pool, generateId } from '../db.js';
import { generateToken } from '../auth.js';

export async function authRoutes(fastify) {

  // ── POST /api/auth/send-otp ───────────────────────────────────────────────
  fastify.post('/api/auth/send-otp', async (request, reply) => {
    const { phone } = request.body || {};

    if (!phone || phone.trim().length < 8) {
      return reply.status(400).send({ error: 'A valid phone number is required' });
    }

    // ✅ NEW: Validate phone number exists in database
    const userResult = await pool.query(
      'SELECT id, is_disabled FROM users WHERE phone = $1',
      [phone]
    );

    if (!userResult.rows[0]) {
      // Phone not registered in system
      return reply.status(404).send({
        error: 'Phone number not registered',
        message: 'Please complete registration first',
        code: 'PHONE_NOT_REGISTERED',
      });
    }

    // Check if account is disabled
    if (userResult.rows[0].is_disabled) {
      return reply.status(403).send({
        error: 'Account disabled',
        message: 'Please contact support',
        code: 'ACCOUNT_DISABLED',
      });
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

    // ✅ NEW: Find user - must exist (no auto-creation)
    let result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    let user   = result.rows[0];

    if (!user) {
      // User doesn't exist - shouldn't happen if send-otp validation worked
      return reply.status(404).send({
        error: 'User not found',
        message: 'Please register first',
        code: 'USER_NOT_FOUND',
      });
    }

    if (user.is_disabled) {
      return reply.status(403).send({
        error: 'Account disabled',
        message: 'Please contact support',
        code: 'ACCOUNT_DISABLED',
      });
    }

    // ✅ NEW: Validate user has medicines (properly registered)
    const medicinesResult = await pool.query(
      'SELECT COUNT(*) as count FROM medicines WHERE user_id = $1 AND is_active = 1',
      [user.id]
    );

    const hasMedicines = medicinesResult.rows[0]?.count > 0;

    if (!hasMedicines) {
      // User registered but hasn't added any medicines yet
      return reply.status(403).send({
        error: 'Incomplete profile',
        message: 'Please complete your registration to add medicines',
        code: 'NO_MEDICINES',
        userId: user.id, // Return so they can navigate to onboarding
      });
    }

    const token = generateToken(user.id);

    return reply.send({
      token,
      user: {
        id:        user.id,
        phone:     user.phone,
        name:      user.name,
        language:  user.language,
        hasMedicines: true,
      },
    });
  });
}
