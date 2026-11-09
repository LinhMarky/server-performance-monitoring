\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE students (
    id BIGINT PRIMARY KEY,
    student_code VARCHAR(20) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    class_name VARCHAR(30) NOT NULL,
    major VARCHAR(100) NOT NULL,
    enrollment_year INT NOT NULL,
    email VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Deliberately no unique constraint / index on student_code in this experiment.
CREATE TABLE subjects (
    id INT PRIMARY KEY,
    subject_code VARCHAR(20) NOT NULL,
    subject_name VARCHAR(150) NOT NULL,
    credits INT NOT NULL CHECK (credits > 0)
);
CREATE TABLE grades (
    id BIGINT PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id),
    subject_id INT NOT NULL REFERENCES subjects(id),
    semester VARCHAR(20) NOT NULL,
    midterm_score NUMERIC(4,2) NOT NULL CHECK (midterm_score BETWEEN 0 AND 10),
    final_score NUMERIC(4,2) NOT NULL CHECK (final_score BETWEEN 0 AND 10),
    total_score NUMERIC(4,2) NOT NULL CHECK (total_score BETWEEN 0 AND 10)
);
CREATE INDEX idx_grades_student_id ON grades(student_id);
COMMIT;
