\set ON_ERROR_STOP on
SELECT (SELECT count(*) FROM students) AS total_students,
       (SELECT count(*) FROM subjects) AS total_subjects,
       (SELECT count(*) FROM grades) AS total_grades;
SELECT relname AS table_name,
       pg_size_pretty(pg_relation_size(oid)) AS heap_size,
       pg_size_pretty(pg_indexes_size(oid)) AS indexes_size,
       pg_size_pretty(pg_total_relation_size(oid)) AS total_size
FROM pg_class WHERE oid IN ('students'::regclass, 'subjects'::regclass, 'grades'::regclass);
SELECT CASE WHEN to_regclass('public.idx_students_code') IS NULL THEN 'ABSENT'
            ELSE pg_size_pretty(pg_relation_size(to_regclass('public.idx_students_code'))) END AS experimental_index_size;
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename IN ('students','grades') ORDER BY tablename,indexname;
