#!/usr/bin/env bash
# BYOR per-tenant provisioning script.
#
# Spins up a fresh Railway service for a new customer:
#   - new project + service named byor-<slug>
#   - persistent 1GB volume at /data
#   - all env secrets set (session, encryption, admin password)
#   - brand env vars seeded (customer can override later from UI)
#   - LLM keys defaulted to BYOR_DEFAULT_* values from your local env
#     so you don't have to hand-paste them every time
#   - public domain generated
#   - deploy kicked off
#
# Usage:
#   ./scripts/provision.sh <slug> "<Brand Name>" "<admin-email>" ["<accent-color>"]
#
# Example:
#   ./scripts/provision.sh acme "Acme Corp" admin@acme.com "#1d4ed8"
#
# Required:
#   - railway CLI installed + logged in (railway whoami)
#   - openssl on PATH (for secret generation)
#
# Optional env (set in your shell before running):
#   BYOR_DEFAULT_LLM_PROVIDER     default 'openai'
#   BYOR_DEFAULT_LLM_API_KEY      e.g. your Perplexity / OpenAI key
#   BYOR_DEFAULT_LLM_BASE_URL     e.g. https://api.perplexity.ai
#   BYOR_DEFAULT_LLM_MODEL        e.g. 'sonar' / 'gpt-4o-mini'
#   BYOR_DEFAULT_VISION_API_KEY   Gemini key for template extraction

set -euo pipefail

if [ $# -lt 3 ]; then
  echo "Usage: $0 <slug> \"<Brand Name>\" <admin-email> [<accent-color>]"
  echo "Example: $0 acme \"Acme Corp\" admin@acme.com \"#1d4ed8\""
  exit 1
fi

SLUG="$1"
BRAND_NAME="$2"
ADMIN_EMAIL="$3"
BRAND_COLOR="${4:-#0f766e}"

# Sanity check the slug — Railway service names are constrained
if ! [[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
  echo "❌ slug must be lowercase alphanumeric + hyphens, e.g. acme or acme-corp"
  exit 1
fi

PROJECT_NAME="byor-${SLUG}"
SESSION_SECRET=$(openssl rand -hex 32)
ENC_KEY=$(openssl rand -hex 32)
ADMIN_PW=$(openssl rand -base64 18 | tr -d "=+/" | cut -c1-22)
LOGO_TEXT=$(echo "$BRAND_NAME" | awk '{print toupper(substr($1,1,1) substr($2,1,1))}')
[ -z "$LOGO_TEXT" ] && LOGO_TEXT="${BRAND_NAME:0:2}"
LOGO_TEXT=$(echo "$LOGO_TEXT" | tr '[:lower:]' '[:upper:]')

echo "=================================================="
echo "Provisioning BYOR tenant"
echo "=================================================="
echo "  Project:   $PROJECT_NAME"
echo "  Brand:     $BRAND_NAME"
echo "  Logo:      $LOGO_TEXT"
echo "  Color:     $BRAND_COLOR"
echo "  Admin:     $ADMIN_EMAIL"
echo "  Password:  $ADMIN_PW  ← save this somewhere safe NOW"
echo "=================================================="
echo

# Confirm before running
read -p "Proceed? [y/N] " -n 1 -r REPLY < /dev/tty
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo
echo "→ Creating Railway project..."
railway init --name "$PROJECT_NAME"

echo "→ Uploading code + kicking off build..."
railway up --detach

echo "→ Linking service (named after the project)..."
railway service "$PROJECT_NAME" || true  # may need a moment to register

echo "→ Setting env secrets..."
MSYS_NO_PATHCONV=1 railway variables --service "$PROJECT_NAME" \
  --set "NODE_ENV=production" \
  --set "DATA_DIR=/data" \
  --set "SESSION_SECRET=$SESSION_SECRET" \
  --set "BYOR_ENCRYPTION_KEY=$ENC_KEY" \
  --set "ADMIN_EMAIL=$ADMIN_EMAIL" \
  --set "ADMIN_PASSWORD=$ADMIN_PW" \
  --set "BRAND_NAME=$BRAND_NAME" \
  --set "BRAND_TAGLINE=Your monthly report on autopilot" \
  --set "BRAND_COLOR=$BRAND_COLOR" \
  --set "BRAND_LOGO_TEXT=$LOGO_TEXT" \
  ${BYOR_DEFAULT_LLM_PROVIDER:+--set "LLM_PROVIDER=$BYOR_DEFAULT_LLM_PROVIDER"} \
  ${BYOR_DEFAULT_LLM_API_KEY:+--set "LLM_API_KEY=$BYOR_DEFAULT_LLM_API_KEY"} \
  ${BYOR_DEFAULT_LLM_BASE_URL:+--set "LLM_BASE_URL=$BYOR_DEFAULT_LLM_BASE_URL"} \
  ${BYOR_DEFAULT_LLM_MODEL:+--set "LLM_MODEL=$BYOR_DEFAULT_LLM_MODEL"} \
  ${BYOR_DEFAULT_VISION_API_KEY:+--set "VISION_LLM_PROVIDER=gemini" --set "VISION_LLM_API_KEY=$BYOR_DEFAULT_VISION_API_KEY" --set "VISION_LLM_MODEL=gemini-2.0-flash"} \
  >/dev/null

echo "→ Creating persistent volume..."
MSYS_NO_PATHCONV=1 railway volume add --mount-path /data >/dev/null 2>&1 || echo "  (volume add: skipped — may already exist or need manual setup)"

echo "→ Generating public domain..."
DOMAIN_OUT=$(railway domain 2>&1)
URL=$(echo "$DOMAIN_OUT" | grep -oE "https://[^ ]+\.up\.railway\.app" | head -1)

echo
echo "=================================================="
echo "✅ Tenant provisioned"
echo "=================================================="
echo "  URL:       ${URL:-(check railway dashboard)}"
echo "  Login:     $ADMIN_EMAIL"
echo "  Password:  $ADMIN_PW"
echo "=================================================="
echo
echo "Next steps for the customer:"
echo "  1. Log in"
echo "  2. Settings → rotate the password"
echo "  3. Settings → Tenant branding → upload logo, tweak copy"
echo "  4. Recipes → install the one that matches their workflow"
echo "  5. Connections → wire their data sources"
echo
echo "Build takes ~10min. Watch:"
echo "  railway logs --service $PROJECT_NAME --build"
