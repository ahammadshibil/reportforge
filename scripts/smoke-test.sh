#!/usr/bin/env bash
# Smoke-test a BYOR deployment end-to-end.
#
# Usage:
#   BASE=http://localhost:5000 ./scripts/smoke-test.sh
#   BASE=https://byor-shibil-production.up.railway.app \
#     EMAIL=admin@x.com PASSWORD=xxx ./scripts/smoke-test.sh
#
# Exits 0 if all pass, 1 if any fail. Suitable for CI / cron / pre-deploy check.

set -uo pipefail

BASE="${BASE:-http://localhost:5000}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"
COOKIE=$(mktemp -t byor-smoke-XXXXXX.txt)
trap 'rm -f "$COOKIE"' EXIT

pass=0
fail=0

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
dim()   { printf '\033[2m%s\033[0m' "$1"; }

expect_code() {
  local name="$1" url="$2" want="$3" auth="${4:-}"
  local args=(-s -o /dev/null -w '%{http_code}' --max-time 15)
  [ -n "$auth" ] && args+=(-b "$auth")
  local got
  got=$(curl "${args[@]}" "$url" 2>/dev/null || echo "000")
  if [ "$got" = "$want" ]; then
    pass=$((pass + 1))
    printf "  %s %-44s %s\n" "$(green '✓')" "$name" "$(dim "$got")"
  else
    fail=$((fail + 1))
    printf "  %s %-44s %s\n" "$(red '✗')" "$name" "$(red "got=$got want=$want")"
  fi
}

expect_body_contains() {
  local name="$1" url="$2" needle="$3" auth="${4:-}"
  local args=(-s --max-time 15)
  [ -n "$auth" ] && args+=(-b "$auth")
  local body
  body=$(curl "${args[@]}" "$url" 2>/dev/null || echo "")
  if echo "$body" | grep -qF "$needle"; then
    pass=$((pass + 1))
    printf "  %s %-44s %s\n" "$(green '✓')" "$name" "$(dim "found '$needle'")"
  else
    fail=$((fail + 1))
    printf "  %s %-44s %s\n" "$(red '✗')" "$name" "$(red "'$needle' not in body")"
  fi
}

echo
echo "BYOR smoke test"
echo "─────────────────────────────────────────────────────────────"
echo "  base: $BASE"
[ -n "$EMAIL" ] && echo "  auth: $EMAIL"
echo

# Public endpoints (no auth required)
echo "Public endpoints"
expect_code "GET /api/brand"                    "$BASE/api/brand" "200"
expect_code "GET /api/recipes/public"           "$BASE/api/recipes/public" "200"
expect_body_contains "  body contains 'name'"   "$BASE/api/brand" "name"
expect_body_contains "  recipes count > 0"      "$BASE/api/recipes/public" "founder-monthly-update"

# Auth boundary
echo
echo "Auth boundary"
expect_code "GET /api/recipes without cookie  (401)"    "$BASE/api/recipes" "401"
expect_code "GET /api/workspaces without cookie (401)"  "$BASE/api/workspaces" "401"

# Login + authenticated checks
if [ -n "$EMAIL" ] && [ -n "$PASSWORD" ]; then
  echo
  echo "Login + authenticated paths"
  login_body=$(curl -s -X POST -H "Content-Type: application/json" -c "$COOKIE" --max-time 15 \
    "$BASE/api/auth/login" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" 2>/dev/null || echo "")
  if echo "$login_body" | grep -q '"user"'; then
    pass=$((pass + 1))
    printf "  %s %-44s %s\n" "$(green '✓')" "POST /api/auth/login" "$(dim 'session cookie issued')"
  else
    fail=$((fail + 1))
    printf "  %s %-44s %s\n" "$(red '✗')" "POST /api/auth/login" "$(red "login failed: $login_body")"
    echo
    echo "Result: $pass pass / $fail fail"
    exit 1
  fi

  expect_code "GET /api/auth/me"                  "$BASE/api/auth/me" "200" "$COOKIE"
  expect_code "GET /api/recipes (authed)"         "$BASE/api/recipes" "200" "$COOKIE"
  expect_code "GET /api/llm/status"               "$BASE/api/llm/status" "200" "$COOKIE"
  expect_code "GET /api/workspaces"               "$BASE/api/workspaces" "200" "$COOKIE"
  expect_code "GET /api/connections/types"        "$BASE/api/connections/types" "200" "$COOKIE"
  expect_code "GET /api/connections/mcp/presets"  "$BASE/api/connections/mcp/presets" "200" "$COOKIE"
  expect_code "POST /api/admin/cleanup"           "$BASE/api/admin/cleanup" "200" "$COOKIE"
else
  echo
  echo "$(dim 'Skipping authed checks — set EMAIL + PASSWORD env to include them.')"
fi

# Result
echo
echo "─────────────────────────────────────────────────────────────"
if [ "$fail" -eq 0 ]; then
  printf "  Result: %s pass / %s fail  %s\n" "$(green "$pass")" "$fail" "$(green '✓ all healthy')"
  exit 0
else
  printf "  Result: %s pass / %s fail  %s\n" "$pass" "$(red "$fail")" "$(red '✗ failures present')"
  exit 1
fi
