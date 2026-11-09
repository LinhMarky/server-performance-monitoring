\set ON_ERROR_STOP on
\timing on
\if :{?student_count}
\else
  \getenv student_count STUDENT_COUNT
  \if :{?student_count}
  \else
    \set student_count 200000
  \endif
\endif
\if :{?reset_baseline}
\else
  \set reset_baseline false
\endif

BEGIN;
SELECT set_config('seed.student_count', :'student_count', true);
SELECT set_config('seed.reset_baseline', :'reset_baseline', true);
DO $$
BEGIN
  IF current_setting('seed.student_count') !~ '^[0-9]+$'
    OR current_setting('seed.student_count')::bigint NOT BETWEEN 100 AND 1000000 THEN
    RAISE EXCEPTION 'student_count must be an integer between 100 and 1000000';
  END IF;
END $$;
LOCK TABLE students, subjects, grades IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF NOT current_setting('seed.reset_baseline')::boolean
     AND (EXISTS (SELECT 1 FROM students) OR EXISTS (SELECT 1 FROM grades) OR EXISTS (SELECT 1 FROM subjects)) THEN
    RAISE EXCEPTION 'Database is not empty. Seed refused. Backup first; use scripts/seed.sh --reset-baseline RESET_BASELINE explicitly.';
  END IF;
  IF current_setting('seed.reset_baseline')::boolean THEN
    DROP INDEX IF EXISTS idx_students_code;
    TRUNCATE TABLE grades, students, subjects;
  END IF;
  -- Reject even expression/covering indexes or unexpected indexes on students.
  IF EXISTS (SELECT 1 FROM pg_index WHERE indrelid = 'students'::regclass AND NOT indisprimary) THEN
    RAISE EXCEPTION 'BASELINE requires students PRIMARY KEY only. Inspect and remove unexpected indexes manually.';
  END IF;
END $$;

INSERT INTO subjects (id, subject_code, subject_name, credits)
SELECT ordinality::int, 'MH' || lpad(ordinality::text, 3, '0'), name,
       CASE WHEN ordinality IN (13,14,15,16,17,18) THEN 2 ELSE 3 END
FROM unnest(ARRAY[
  'Cơ sở dữ liệu', 'Cấu trúc dữ liệu và giải thuật', 'Lập trình hướng đối tượng',
  'Nhập môn lập trình', 'Mạng máy tính', 'Hệ điều hành', 'Lập trình Web',
  'Nhập môn công nghệ phần mềm', 'Trí tuệ nhân tạo', 'An toàn thông tin',
  'Kiến trúc máy tính', 'Phân tích thiết kế hệ thống', 'Đại số tuyến tính',
  'Giải tích', 'Xác suất thống kê', 'Toán rời rạc', 'Tiếng Anh chuyên ngành',
  'Kỹ năng làm việc nhóm', 'Lập trình Java', 'Lập trình Python', 'Lập trình C++',
  'Phát triển ứng dụng di động', 'Điện toán đám mây', 'Hệ phân tán',
  'Kiểm thử phần mềm', 'Quản lý dự án phần mềm', 'Thiết kế giao diện người dùng',
  'Khai phá dữ liệu', 'Học máy', 'Xử lý ảnh', 'Xử lý ngôn ngữ tự nhiên',
  'Internet vạn vật', 'Quản trị hệ thống Linux', 'Nhập môn công nghệ nền tảng',
  'Cơ sở dữ liệu phân tán', 'Lập trình mạng', 'Phân tích dữ liệu',
  'Tối ưu hóa thuật toán', 'Đạo đức nghề nghiệp', 'Đồ án chuyên ngành'
]) WITH ORDINALITY AS subject(name, ordinality);

INSERT INTO students (id, student_code, full_name, class_name, major, enrollment_year, email, created_at)
SELECT n, 'SV' || lpad(n::text, 7, '0'),
  (ARRAY['Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Phan','Vũ','Đặng','Bùi'])[((n-1)%10+1)::int]
    || ' ' || (ARRAY['Minh','Ngọc','Thanh','Gia','Anh','Bảo','Quang','Hải'])[(((n-1)/10)%8+1)::int]
    || ' ' || (ARRAY['An','Bình','Chi','Dũng','Hà','Huy','Linh','Nam','Phương','Quân','Trang','Tú'])[(((n-1)/80)%12+1)::int],
  'D' || (year % 100)::text || (ARRAY['CNTT','KTPM','HTTT','ATTT','KHMT'])[(major_id+1)::int]
    || lpad((((n-1)/20)%10+1)::text, 2, '0'),
  (ARRAY['Công nghệ thông tin','Kỹ thuật phần mềm','Hệ thống thông tin','An toàn thông tin','Khoa học máy tính'])[(major_id+1)::int],
  year, 'sv' || lpad(n::text, 7, '0') || '@example.test', TIMESTAMP '2026-01-01 00:00:00'
FROM (
  SELECT n, (2021 + ((n-1)%4))::int AS year, ((n-1)/4)%5 AS major_id
  FROM generate_series(1::bigint, :student_count::bigint) AS series(n)
) AS generated;

INSERT INTO grades (id, student_id, subject_id, semester, midterm_score, final_score, total_score)
SELECT (student_id-1)*6 + course_slot + 1, student_id, subject_id, '2025-2026-HK2',
  midterm, final, round(midterm * 0.4 + final * 0.6, 2)
FROM (
  SELECT s.id AS student_id, slot AS course_slot, ((s.id-1)*7 + slot*3)%40+1 AS subject_id,
    ((s.id*17 + slot*13)%101)::numeric/10 AS midterm,
    ((s.id*23 + slot*19)%101)::numeric/10 AS final
  FROM students s CROSS JOIN generate_series(0,5) AS slots(slot)
) AS generated;

\set expected_mode baseline
\ir validate-data.sql
ANALYZE students;
ANALYZE subjects;
ANALYZE grades;
COMMIT;
\echo 'Seed committed successfully. BASELINE is ready.'
\ir database-stats.sql
