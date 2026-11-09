\set ON_ERROR_STOP on
\if :{?code}
\else
  \set code SV0199999
\endif
-- Keep the same columns, predicate and LIMIT as backend/src/utils/queries.js.
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    id,
    student_code,
    full_name,
    class_name,
    major,
    enrollment_year,
    email
FROM students
WHERE student_code = :'code'
LIMIT 1;
