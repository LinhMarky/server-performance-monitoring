import { Router } from 'express';
import { studentCode } from '../utils/validation.js';
import { STUDENT_SEARCH_SQL, studentJson } from '../utils/queries.js';
import { HttpError } from '../utils/errors.js';

export function gradesRouter(pool) {
  const router = Router();
  router.get('/:studentCode/transcript', async (req, res) => {
    const code = studentCode(req.params.studentCode);
    const found = await pool.query(STUDENT_SEARCH_SQL, [code]);
    if (!found.rows[0]) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Không tìm thấy sinh viên với mã này.');
    const student = studentJson(found.rows[0]);
    const { rows } = await pool.query(`SELECT s.subject_code, s.subject_name, s.credits, g.semester,
      g.midterm_score, g.final_score, g.total_score
      FROM grades g JOIN subjects s ON s.id = g.subject_id
      WHERE g.student_id = $1 ORDER BY s.id`, [student.id]);
    const grades = rows.map(row => ({ ...row, midterm_score: Number(row.midterm_score),
      final_score: Number(row.final_score), total_score: Number(row.total_score) }));
    const credits = grades.reduce((sum, grade) => sum + grade.credits, 0);
    const weightedCents = grades.reduce((sum, grade) => sum + Math.round(grade.total_score * 100) * grade.credits, 0);
    res.json({ success: true, data: { student, grades, summary: {
      total_subjects: grades.length, total_credits: credits,
      gpa_10: credits ? Math.round(weightedCents / credits) / 100 : null
    } } });
  });
  return router;
}
