import { pool, generateId } from '../db.js';
import { authenticate } from '../auth.js';
import { sendPushToUser } from '../services/push.js';

export async function pushRoutes(fastify) {
  // POST /api/push/subscribe
  fastify.post('/api/push/subscribe', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const { subscription } = request.body;

    if (!subscription?.endpoint)
      return reply.status(400).send({ error: 'Valid push subscription object required' });

    // Check if already subscribed (SQLite: no JSON operators, use LIKE)
    const existing = await pool.query(
      `SELECT id FROM push_subscriptions WHERE user_id=$1 AND subscription LIKE $2`,
      [userId, `%${subscription.endpoint}%`]
    );

    if (!existing.rows[0]) {
      await pool.query(
        'INSERT INTO push_subscriptions (id, user_id, subscription) VALUES ($1,$2,$3)',
        [generateId(), userId, subscription]
      );
    }

    await pool.query('UPDATE users SET push_subscription=$1 WHERE id=$2', [subscription, userId]);
    return reply.send({ message: 'Push subscription saved' });
  });

  // POST /api/push/test
  fastify.post('/api/push/test', { preHandler: authenticate }, async (request, reply) => {
    try {
      await sendPushToUser(request.user.id, {
        title: 'MedRem Test',
        body: 'Push notifications are working!',
        icon: '/icons/icon-192.png',
        data: { url: '/' },
      });
      return reply.send({ message: 'Test notification sent' });
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/push/vapid-key
  fastify.get('/api/push/vapid-key', async (_req, reply) =>
    reply.send({ publicKey: process.env.VAPID_PUBLIC_KEY || '' })
  );
}
