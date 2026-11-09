#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
reset=false
count=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --count) count="${2:?Provide the number of students}"; shift 2 ;;
    --reset-baseline)
      if [ "${2:-}" != RESET_BASELINE ]; then
        echo 'Destructive reset requires: --reset-baseline RESET_BASELINE' >&2
        exit 1
      fi
      reset=true; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done
if [ -n "$count" ] && ! [[ "$count" =~ ^[0-9]+$ ]]; then
  echo 'Count must contain only digits.' >&2; exit 1
fi
if [ "$reset" = true ]; then
  echo 'WARNING: explicitly replacing all demo students, subjects and grades; removing idx_students_code.'
fi
docker compose exec -T db sh -ec '
  count="${1:-$STUDENT_COUNT}"
  echo "Seeding $count students, 40 subjects and 6 grades/student."
  exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
    -v student_count="$count" -v reset_baseline="$2" -f /sql/seed.sql
' sh "$count" "$reset"
# Generate codes from the committed database count, not an outdated host setting.
actual_count=$(docker compose exec -T db sh -ec 'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM students"')
mkdir -p benchmark-data
temp=$(mktemp benchmark-data/student-codes.XXXXXX.tmp)
trap 'rm -f "$temp"' EXIT
docker compose exec -T web node /app/scripts/generate-benchmark-codes.js "$actual_count" --stdout > "$temp"
mv "$temp" benchmark-data/student-codes.json
echo "Seed and benchmark-data/student-codes.json are ready ($actual_count students)."
