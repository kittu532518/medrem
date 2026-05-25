import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { initDb } from './db.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { prescriptionRoutes } from './routes/prescriptions.js';
import { doseRoutes } from './routes/doses.js';
import { scheduleRoutes } from './routes/schedule.js';
import { adherenceRoutes } from './routes/adherence.js';
import { pushRoutes } from './routes/push.js';
import { medicineRoutes } from './routes/medicines.js';
import { adminRoutes } from './routes/admin.js';
import { startScheduler } from './services/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const fastify = Fastify({
  logger: process.env.NODE_ENV === 'development' ? { level: 'info' } : false,
});

// Plugins
await fastify.register(cors, {
  origin: true,   // allow all origins (lock down in production via CORS_ORIGIN env)
  credentials: true,
});

await fastify.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

await fastify.register(staticFiles, {
  root: uploadsDir,
  prefix: '/uploads/',
});

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
await fastify.register(authRoutes);
await fastify.register(userRoutes);
await fastify.register(prescriptionRoutes);
await fastify.register(doseRoutes);
await fastify.register(scheduleRoutes);
await fastify.register(adherenceRoutes);
await fastify.register(pushRoutes);
await fastify.register(medicineRoutes);
await fastify.register(adminRoutes);

// Block disabled users at the auth middleware level
// (authenticate() in auth.js already checks user existence; is_disabled is checked per-route if needed)

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  console.error('Unhandled error:', error);
  reply.status(error.statusCode || 500).send({
    error: error.message || 'Internal server error',
    code: error.code,
  });
});

const PORT = parseInt(process.env.PORT || '8080');

try {
  await initDb();
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n🚀  MedRem API   → http://localhost:${PORT}`);
  console.log(`🏥  Admin panel  → http://localhost:5173/admin`);
  console.log(`❤️   Health      → http://localhost:${PORT}/health\n`);
  startScheduler();
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}
