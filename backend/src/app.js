import express from 'express';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { studentsRouter } from './routes/students.js';
import { gradesRouter } from './routes/grades.js';
import { healthRouter } from './routes/health.js';
import { statsRouter } from './routes/stats.js';
import { errorHandler } from './utils/errors.js';

export function createApp(pool) {
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.set('query parser', 'simple');
  app.use((req, res, next) => {
    req.startedAt = performance.now();
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
    next();
  });
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api/health', healthRouter(pool));
  app.use('/api/stats', statsRouter(pool));
  app.use('/api/students', studentsRouter(pool));
  app.use('/api/students', gradesRouter(pool));
  app.use('/api', (req, res) => res.status(404).json({ success: false,
    error: { code: 'NOT_FOUND', message: 'API không tồn tại.' } }));
  app.use(express.static(fileURLToPath(new URL('../../frontend/', import.meta.url)), { etag: false, maxAge: 0 }));
  app.use((req, res) => res.status(404).type('text').send('Không tìm thấy trang.'));
  app.use(errorHandler);
  return app;
}
