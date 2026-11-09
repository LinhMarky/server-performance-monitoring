\set ON_ERROR_STOP on
-- MANUAL ONLY, after the team finishes BASELINE measurements; stop workload first.
CREATE INDEX IF NOT EXISTS idx_students_code ON students USING btree(student_code);
SELECT indexname, indexdef, pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes WHERE schemaname='public' AND tablename='students';
