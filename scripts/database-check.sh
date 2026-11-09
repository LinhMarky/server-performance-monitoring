#!/usr/bin/env bash
# Explicit functional test in a disposable database; NEVER changes the demo database.
set -euo pipefail
cd "$(dirname "$0")/.."
test_db="student_check_$(date +%s)_$$"
docker compose exec -T db sh -ec 'exec createdb -U "$POSTGRES_USER" "$1"' sh "$test_db"
cleanup() { docker compose exec -T db sh -ec 'exec dropdb -U "$POSTGRES_USER" --if-exists --force "$1"' sh "$test_db"; }
trap cleanup EXIT
psql_test() {
  docker compose exec -T db sh -ec 'database="$1"; shift; exec psql -X -U "$POSTGRES_USER" -d "$database" -v ON_ERROR_STOP=1 "$@"' sh "$test_db" "$@"
}
fingerprint() { psql_test -Atc "SELECT md5(string_agg(row_to_json(s)::text, '' ORDER BY id)) FROM students s"; }
echo "Isolated database: $test_db (automatically removed on exit)"
psql_test -f /sql/schema.sql
psql_test -v student_count=1000 -f /sql/seed.sql
before=$(fingerprint)
echo 'BASELINE plan (1000 students):'
psql_test -v code=SV0000999 -f /sql/explain.sql
if psql_test -v student_count=1000 -f /sql/seed.sql; then
  echo 'FAIL: ordinary seed unexpectedly overwrote existing data' >&2; exit 1
fi
echo 'PASS ordinary seed refused existing data'
psql_test -f /sql/create-index.sql
psql_test -v student_count=1000 -v expected_mode=optimized -f /sql/validate-data.sql
echo 'OPTIMIZED plan (1000 students):'
psql_test -v code=SV0000999 -f /sql/explain.sql
[ "$(fingerprint)" = "$before" ]
echo 'PASS index creation preserves student response data'
if psql_test -v student_count=99 -v reset_baseline=true -f /sql/seed.sql; then
  echo 'FAIL: invalid seed count accepted' >&2; exit 1
fi
[ "$(fingerprint)" = "$before" ]
psql_test -v student_count=1000 -v expected_mode=optimized -f /sql/validate-data.sql
echo 'PASS rejected reset preserved data and experimental index'
if psql_test -c "INSERT INTO grades VALUES (6001,1,1,'2025-2026-HK2',11,5,7)"; then
  echo 'FAIL: out-of-range score accepted' >&2; exit 1
fi
if psql_test -c "INSERT INTO grades VALUES (6001,999999,1,'2025-2026-HK2',5,5,5)"; then
  echo 'FAIL: orphan grade accepted' >&2; exit 1
fi
echo 'PASS CHECK and foreign key constraints reject invalid data'
psql_test -v student_count=1000 -v reset_baseline=true -f /sql/seed.sql
[ "$(fingerprint)" = "$before" ]
echo 'PASS explicit reset is deterministic and removes experimental index'
psql_test -f /sql/create-index.sql
psql_test -f /sql/drop-index.sql
psql_test -v student_count=1000 -f /sql/validate-data.sql
[ "$(fingerprint)" = "$before" ]
echo 'PASS create/drop leaves data unchanged; final state BASELINE'
