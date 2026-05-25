import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'medrem_dev_secret';

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function authenticate(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    const user = result.rows[0];
    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }
    if (user.is_disabled) {
      return reply.status(403).send({ error: 'Account disabled. Please contact support.' });
    }
    request.user = user;
  } catch (err) {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}
