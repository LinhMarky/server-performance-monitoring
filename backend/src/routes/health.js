import { Router } from 'express';

export function healthRouter(pool) {
  const router = Router();
  router.get('/', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'error', database: 'disconnected' });
    }
  });
  return router;
}
