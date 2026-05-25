import { pool, generateId } from '../db.js';
import { generateToken } from '../auth.js';

// In-memory OTP store (dev only — replace with Redis or DB for production)
const otpStore = new Map(); // phone -> { otp, expiresAt }

const IS_DEV = process.env.NODE_ENV !== 'production';

export async function authRoutes(fastify) {
  // POST /api/auth/send-otp
  fastify.post('/api/auth/send-otp', async (request, reply) => {
    const { phone } = request.body || {};

    if (!phone) {
      return reply.status(400).send({ error: 'Phone number is required' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(phone, { otp, expiresAt });

    // Log OTP to server console (visible in your terminal)
    console.log(`[OTP] Phone: ${phone} | OTP: ${otp} | Expires in 10 min`);

    // TODO: wire up Twilio to actually send the SMS:
    // import twilio from 'twilio';
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({ body: `Your MedRem OTP: ${otp}`, from: process.env.TWILIO_PHONE_NUMBER, to: phone });

    return reply.send({
      message: 'OTP sent successfully',
      // Only expose the OTP in the response in development — NEVER in production
      ...(IS_DEV && { debug_otp: otp }),
    });
  });

  // POST /api/auth/verify-otp
  fastify.post('/api/auth/verify-otp', async (request, reply) => {
    const { phone, otp } = request.body || {};

    if (!phone || !otp) {
      return reply.status(400).send({ error: 'Phone and OTP are required' });
    }

    // ⚠️  Dev shortcut: accept '123456' ONLY when NODE_ENV !== 'production'
    //     On public ngrok URL with NODE_ENV=production this bypass is DISABLED.
    let isValid = IS_DEV && otp === '123456';

    if (!isValid) {
      const stored = otpStore.get(phone);
      if (stored && stored.otp === otp && stored.expiresAt > Date.now()) {
        isValid = true;
        otpStore.delete(phone);
      }
    }

    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid or expired OTP' });
    }

    // Find existing user or create new one
    let result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    let user = result.rows[0];

    if (!user) {
      const id = generateId();
      await pool.query('INSERT INTO users (id, phone) VALUES ($1, $2)', [id, phone]);
      result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      user = result.rows[0];
    }

    // Reject disabled accounts at login
    if (user.is_disabled) {
      return reply.status(403).send({ error: 'Account disabled. Please contact support.' });
    }

    const token = generateToken(user.id);

    return reply.send({
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        language: user.language,
        isNewUser: !user.name,
      },
    });
  });
}
