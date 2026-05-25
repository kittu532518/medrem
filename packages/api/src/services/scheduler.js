import cron from 'node-cron';
import { pool } from '../db.js';
import { sendReminderNotification } from './push.js';
import { sendCaregiverAlert } from './sms.js';
import { todayString, SESSION_ORDER, SESSIONS } from './sessionEngine.js';

/**
 * Mark all pending doses as FAILURE when their session window closes.
 * Runs every minute.
 */
async function markExpiredDoses() {
  const now = new Date();
  const today = todayString();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const sessionName of SESSION_ORDER) {
    const session = SESSIONS[sessionName];
    const endMinutes = session.end[0] * 60 + session.end[1];

    // Just past the window end (within the last minute)
    if (currentMinutes >= endMinutes && currentMinutes < endMinutes + 1) {
      try {
        const result = await pool.query(
          `UPDATE dose_logs
           SET status = 'failure'
           WHERE scheduled_date = $1
             AND session = $2
             AND status = 'pending'`,
          [today, sessionName]
        );

        if (result.rowCount > 0) {
          console.log(`[SCHEDULER] Marked ${result.rowCount} ${sessionName} doses as FAILURE`);

          // Fetch affected user IDs for escalation check
          const affected = await pool.query(
            `SELECT DISTINCT user_id FROM dose_logs
             WHERE scheduled_date = $1 AND session = $2 AND status = 'failure'`,
            [today, sessionName]
          );
          for (const row of affected.rows) {
            await checkEscalation(row.user_id);
          }
        }
      } catch (err) {
        console.error(`[SCHEDULER] Error marking expired ${sessionName} doses:`, err.message);
      }
    }
  }
}

/**
 * Check consecutive failures and trigger escalation SMS.
 */
async function checkEscalation(userId) {
  try {
    const result = await pool.query(
      `SELECT dl.status, u.caregiver_phone, u.caregiver_name, u.name as patient_name
       FROM dose_logs dl
       JOIN users u ON u.id = dl.user_id
       WHERE dl.user_id = $1
       ORDER BY dl.scheduled_date DESC, dl.session DESC
       LIMIT 10`,
      [userId]
    );

    if (result.rows.length === 0) return;

    const { caregiver_phone, caregiver_name, patient_name } = result.rows[0];

    let consecutiveFailures = 0;
    for (const row of result.rows) {
      if (row.status === 'failure') consecutiveFailures++;
      else break;
    }

    if (consecutiveFailures === 5) {
      await sendCaregiverAlert(caregiver_phone, caregiver_name, patient_name,
        'consecutive_failure_5', `${consecutiveFailures} consecutive missed doses`);
    } else if (consecutiveFailures === 2) {
      await sendCaregiverAlert(caregiver_phone, caregiver_name, patient_name,
        'consecutive_failure_2', null);
    }
  } catch (err) {
    console.error('[SCHEDULER] Escalation check error:', err.message);
  }
}

/**
 * Send push reminders at session start times.
 * Runs every minute.
 */
async function sendSessionReminders() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const sessionName of SESSION_ORDER) {
    const session = SESSIONS[sessionName];
    const startMinutes = session.start[0] * 60 + session.start[1];

    if (currentMinutes === startMinutes) {
      try {
        // SQLite-compatible: use json_each to match session inside the JSON array
        // Also exclude disabled users
        const result = await pool.query(
          `SELECT DISTINCT m.user_id, m.name, m.dosage
           FROM medicines m
           JOIN users u ON u.id = m.user_id,
           json_each(m.sessions) sess
           WHERE m.is_active = 1
             AND u.is_disabled = 0
             AND sess.value = $1`,
          [sessionName]
        );

        const userMedicines = {};
        for (const row of result.rows) {
          if (!userMedicines[row.user_id]) userMedicines[row.user_id] = [];
          userMedicines[row.user_id].push({ name: row.name, dosage: row.dosage });
        }

        for (const [userId, medicines] of Object.entries(userMedicines)) {
          await sendReminderNotification(userId, sessionName, medicines);
        }

        if (Object.keys(userMedicines).length > 0) {
          console.log(`[SCHEDULER] Sent ${sessionName} reminders to ${Object.keys(userMedicines).length} users`);
        }
      } catch (err) {
        console.error(`[SCHEDULER] Error sending ${sessionName} reminders:`, err.message);
      }
    }
  }
}

export function startScheduler() {
  console.log('[SCHEDULER] Starting cron jobs...');
  cron.schedule('* * * * *', async () => {
    await markExpiredDoses();
    await sendSessionReminders();
  });
  console.log('[SCHEDULER] Cron jobs started ✓');
}
