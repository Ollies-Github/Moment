#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${1:-http://localhost:4000}"

curl -sS -X POST "${API_BASE_URL}/dev/simulate/reset" -H "content-type: application/json" -d '{}' >/dev/null
curl -sS -X POST "${API_BASE_URL}/dev/simulate/starter-event" -H "content-type: application/json" -d '{"sport":"Football","event_type":"var_review"}' >/dev/null
curl -sS -X POST "${API_BASE_URL}/dev/simulate/starter-event" -H "content-type: application/json" -d '{"sport":"F1","event_type":"pit_window_call"}' >/dev/null

echo "Seeded markets into ${API_BASE_URL}"
