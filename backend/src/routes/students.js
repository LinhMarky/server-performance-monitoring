import { Router } from 'express';
import { performance } from 'node:perf_hooks';
import { studentCode, pageNumber } from '../utils/validation.js';
import { STUDENT_SEARCH_SQL, studentJson } from '../utils/queries.js';

export function studentsRouter(pool) {
  const router = Router();
  router.get('/search', async (req, res) => {
    const code = studentCode(req.query.code);
    const start = performance.now();
    const result = await pool.query(STUDENT_SEARCH_SQL, [code]);
    const dbMs = performance.now() - start;
    const student = result.rows[0] ? studentJson(result.rows[0]) : null;
    const apiMs = performance.now() - req.startedAt;
    const timing = { db_query_ms: Number(dbMs.toFixed(3)), api_processing_ms: Number(apiMs.toFixed(3)) };
    res.set('Server-Timing', `db;dur=${timing.db_query_ms}, app;dur=${timing.api_processing_ms}`);
    if (!student) {
      return res.status(404).json({ success: false, data: null,
        error: { code: 'STUDENT_NOT_FOUND', message: 'Không tìm thấy sinh viên với mã này.' }, performance: timing });
    }
    res.json({ success: true, data: student, performance: timing });
  });

  router.get('/', async (req, res) => {
    const page = pageNumber(req.query.page, 1, 1000000, 'page');
    const limit = pageNumber(req.query.limit, 20, 100, 'limit');
    const offset = (page - 1) * limit;
    const { rows } = await pool.query(`SELECT id, student_code, full_name, class_name, major, enrollment_year, email
      FROM students ORDER BY id LIMIT $1 OFFSET $2`, [limit + 1, offset]);
    res.json({ success: true, data: rows.slice(0, limit).map(studentJson),
      pagination: { page, limit, has_next: rows.length > limit, has_previous: page > 1 } });
  });
  return router;
}
