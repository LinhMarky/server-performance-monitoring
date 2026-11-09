// This exact query is shared by BASELINE and OPTIMIZED. Do not add a named prepared statement.
export const STUDENT_SEARCH_SQL = `SELECT
    id,
    student_code,
    full_name,
    class_name,
    major,
    enrollment_year,
    email
FROM students
WHERE student_code = $1
LIMIT 1`;

export const studentJson = (row) => ({ ...row, id: Number(row.id) });
