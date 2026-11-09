import { Router } from 'express';

export function statsRouter(pool) {
  const router = Router();
  router.get('/', async (req, res) => {
    const { rows } = await pool.query(`SELECT
      (SELECT COUNT(*) FROM students)::integer AS total_students,
      (SELECT COUNT(*) FROM subjects)::integer AS total_subjects,
      (SELECT COUNT(*) FROM grades)::integer AS total_grades`);
    res.json(rows[0]);
  });
  return router;
}
