import webpush from 'web-push';
import { pool as query } from '../db.js';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@medrem.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function sendPushToUser(userId, payload) {
  try {
    const result = await query(
      'SELECT subscription FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      console.log(`[PUSH] No subscriptions found for user ${userId}`);
      return;
    }

    const notifications = result.rows.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify(payload));
        console.log(`[PUSH] Sent to user ${userId}`);
      } catch (err) {
        console.error(`[PUSH] Failed to send notification:`, err.message);
        // If subscription is gone, remove it
        if (err.statusCode === 410) {
          await query(
            'DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription = $2',
            [userId, row.subscription]
          );
        }
      }
    });

    await Promise.allSettled(notifications);
  } catch (err) {
    console.error('[PUSH] Error sending push notification:', err.message);
  }
}

export async function sendReminderNotification(userId, sessionName, medicines) {
  const medList = medicines.map((m) => m.name).join(', ');
  return sendPushToUser(userId, {
    title: `Time for your ${sessionName} medicines`,
    body: `Medicines due: ${medList}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { session: sessionName, url: '/' },
  });
}
