\set ON_ERROR_STOP on
DROP INDEX IF EXISTS public.idx_students_code;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_index WHERE indrelid='students'::regclass AND NOT indisprimary) THEN
    RAISE EXCEPTION 'Other students indexes remain. Inspect them before claiming BASELINE.';
  END IF;
  RAISE NOTICE 'BASELINE verified: students has only its primary key index. Data unchanged.';
END $$;
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='students';
