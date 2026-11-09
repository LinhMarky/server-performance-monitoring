#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-}" in
  stats) file=database-stats.sql ;;
  validate) file=validate-data.sql ;;
  explain) file=explain.sql ;;
  create-index) file=create-index.sql ;;
  drop-index) file=drop-index.sql ;;
  *) echo 'Usage: bash scripts/db.sh {stats|validate|explain|create-index|drop-index} [psql options such as -v code=SV0100000]' >&2; exit 1 ;;
esac
shift
docker compose exec -T db sh -ec 'file="$1"; shift; exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f "/sql/$file" "$@"' sh "$file" "$@"
