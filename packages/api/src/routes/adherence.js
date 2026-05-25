import { pool } from '../db.js';
import { authenticate } from '../auth.js';

export async function adherenceRoutes(fastify) {
  // GET /api/adherence/history
  fastify.get('/api/adherence/history', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;

    const result = await pool.query(
      `SELECT
         dl.scheduled_date,
         dl.session,
         dl.status,
         dl.submitted_at,
         dl.ai_validation_result,
         dl.override_reason,
         m.name as medicine_name,
         m.dosage
       FROM dose_logs dl
       JOIN medicines m ON m.id = dl.medicine_id
       WHERE dl.user_id = $1
         AND dl.scheduled_date >= date('now','-30 days')
       ORDER BY dl.scheduled_date DESC, dl.session`,
      [userId]
    );

    // Group by date
    const grouped = {};
    for (const row of result.rows) {
      const dateKey = typeof row.scheduled_date === 'string'
        ? row.scheduled_date : row.scheduled_date.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          sessions: {},
          summary: { success: 0, partial_success: 0, failure: 0, pending: 0, total: 0 },
        };
      }

      if (!grouped[dateKey].sessions[row.session]) {
        grouped[dateKey].sessions[row.session] = [];
      }

      grouped[dateKey].sessions[row.session].push({
        medicine_name: row.medicine_name,
        dosage: row.dosage,
        status: row.status,
        submitted_at: row.submitted_at,
        override_reason: row.override_reason,
      });

      grouped[dateKey].summary[row.status]++;
      grouped[dateKey].summary.total++;
    }

    // Compute adherence percentage per day
    const days = Object.values(grouped).map((day) => {
      const { success, partial_success, total } = day.summary;
      day.adherence_pct = total > 0 ? Math.round(((success + partial_success * 0.5) / total) * 100) : null;
      return day;
    });

    return reply.send({ days, total_days: days.length });
  });

  // GET /api/adherence/stats
  fastify.get('/api/adherence/stats', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;

    const result = await pool.query(
      `SELECT
         SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as success_count,
         SUM(CASE WHEN status='partial_success' THEN 1 ELSE 0 END) as partial_count,
         SUM(CASE WHEN status='failure' THEN 1 ELSE 0 END) as failure_count,
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending_count,
         COUNT(*) as total_count
       FROM dose_logs
       WHERE user_id = $1
         AND scheduled_date >= date('now','-7 days')`,
      [userId]
    );

    const stats = result.rows[0];
    const total = parseInt(stats.total_count) || 0;
    const success = parseInt(stats.success_count) || 0;
    const partial = parseInt(stats.partial_count) || 0;

    return reply.send({
      period: '7 days',
      success_count: success,
      partial_count: partial,
      failure_count: parseInt(stats.failure_count) || 0,
      pending_count: parseInt(stats.pending_count) || 0,
      total_count: total,
      adherence_pct: total > 0 ? Math.round(((success + partial * 0.5) / total) * 100) : null,
    });
  });
}
