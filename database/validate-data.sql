\set ON_ERROR_STOP on
\if :{?student_count}
\else
  \getenv student_count STUDENT_COUNT
  \if :{?student_count}
  \else
    \set student_count 200000
  \endif
\endif
\if :{?expected_mode}
\else
  \set expected_mode baseline
\endif
SELECT set_config('validation.student_count', :'student_count', false);
SELECT set_config('validation.expected_mode', :'expected_mode', false);
DO $$
DECLARE
  expected bigint := current_setting('validation.student_count')::bigint;
  mode text := current_setting('validation.expected_mode');
BEGIN
  IF expected NOT BETWEEN 100 AND 1000000 THEN RAISE EXCEPTION 'Invalid expected student_count'; END IF;
  IF (SELECT count(*) FROM students) <> expected THEN RAISE EXCEPTION 'Incorrect student count'; END IF;
  IF (SELECT count(*) FROM subjects) <> 40 THEN RAISE EXCEPTION 'Incorrect subject count'; END IF;
  IF (SELECT count(*) FROM grades) <> expected*6 THEN RAISE EXCEPTION 'Incorrect grade count'; END IF;
  IF EXISTS (SELECT student_code FROM students GROUP BY student_code HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate student codes';
  END IF;
  IF EXISTS (SELECT 1 FROM students WHERE id NOT BETWEEN 1 AND expected
    OR student_code <> 'SV' || lpad(id::text,7,'0') OR email <> lower(student_code) || '@example.test') THEN
    RAISE EXCEPTION 'Student code/id/email mismatch';
  END IF;
  IF EXISTS (SELECT s.id FROM students s LEFT JOIN grades g ON g.student_id = s.id
    GROUP BY s.id HAVING count(g.id) <> 6 OR count(DISTINCT g.subject_id) <> 6) THEN
    RAISE EXCEPTION 'Each student must have six distinct subjects';
  END IF;
  IF EXISTS (SELECT 1 FROM grades WHERE midterm_score NOT BETWEEN 0 AND 10
    OR final_score NOT BETWEEN 0 AND 10 OR total_score NOT BETWEEN 0 AND 10
    OR total_score <> round(midterm_score * 0.4 + final_score * 0.6, 2)
    OR semester <> '2025-2026-HK2') THEN RAISE EXCEPTION 'Invalid scores, formula or semester'; END IF;
  IF EXISTS (SELECT 1 FROM grades g LEFT JOIN students s ON s.id=g.student_id
    LEFT JOIN subjects sub ON sub.id=g.subject_id WHERE s.id IS NULL OR sub.id IS NULL) THEN
    RAISE EXCEPTION 'Orphan grades';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid
    AND a.attnum=i.indkey[0] JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_am am ON am.oid=c.relam
    WHERE i.indrelid='grades'::regclass AND a.attname='student_id' AND am.amname='btree'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL) THEN
    RAISE EXCEPTION 'Missing usable grades(student_id) index';
  END IF;
  IF mode='baseline' THEN
    IF EXISTS (SELECT 1 FROM pg_index WHERE indrelid='students'::regclass AND NOT indisprimary) THEN
      RAISE EXCEPTION 'Unexpected students index: BASELINE permits only PRIMARY KEY';
    END IF;
  ELSIF mode='optimized' THEN
    IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
      JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
      JOIN pg_am am ON am.oid=c.relam
      WHERE i.indrelid='students'::regclass AND c.relname='idx_students_code' AND a.attname='student_code'
      AND am.amname='btree' AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indnatts=1) THEN
      RAISE EXCEPTION 'Missing valid idx_students_code';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_index WHERE indrelid='students'::regclass
      AND NOT indisprimary AND indexrelid <> 'idx_students_code'::regclass) THEN
      RAISE EXCEPTION 'Unexpected additional students index';
    END IF;
  ELSE RAISE EXCEPTION 'expected_mode must be baseline or optimized';
  END IF;
  RAISE NOTICE 'PASS: % students, 40 subjects, % grades; unique codes, six distinct subjects/student, scores, foreign keys, indexes (%).', expected, expected*6, mode;
END $$;
