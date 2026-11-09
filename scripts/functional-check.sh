#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Runs with Node supplied by the image; no host Node install is necessary.
docker compose exec -T web node /app/scripts/functional-check.js "${1:-http://127.0.0.1:3000}" "${2:-}"
