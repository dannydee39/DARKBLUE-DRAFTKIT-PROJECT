#!/usr/bin/env bash
set -u

PROJECT_DIR="/home/apple/DARKBLUE-DRAFTKIT-PROJECT"
PM2_BIN="/home/apple/.local/bin/pm2"
ECOSYSTEM_FILE="$PROJECT_DIR/ecosystem.darkblue.config.cjs"

required_processes=(
  "cloudflared"
  "darkblueapi-service"
  "darkbluevalue-site"
  "draftkit-app-api"
  "draftkit-web"
)

local_checks=(
  "http://127.0.0.1:3004/"
  "http://127.0.0.1:3006/health"
  "http://127.0.0.1:3003/"
  "http://127.0.0.1:3002/health"
)

public_checks=(
  "https://darkbluevalue.anythingavenue.com/"
  "https://darkblueapi.anythingavenue.com/health"
  "https://draft.anythingavenue.com/"
  "https://draftapi.anythingavenue.com/health"
)

needs_restore=0

cd "$PROJECT_DIR" || exit 1

for process_name in "${required_processes[@]}"; do
  if ! "$PM2_BIN" describe "$process_name" 2>/dev/null | grep -q "status.*online"; then
    echo "$(date -Is) missing-or-offline $process_name"
    needs_restore=1
  fi
done

for url in "${local_checks[@]}"; do
  if ! curl -fsS --max-time 10 "$url" >/dev/null; then
    echo "$(date -Is) local-check-failed $url"
    needs_restore=1
  fi
done

if [ "$needs_restore" -eq 1 ]; then
  "$PM2_BIN" startOrReload "$ECOSYSTEM_FILE" --update-env
  "$PM2_BIN" save --force
  sleep 8
fi

for url in "${public_checks[@]}"; do
  if ! curl -fsS --max-time 15 "$url" >/dev/null; then
    echo "$(date -Is) public-check-failed $url; restarting cloudflared"
    "$PM2_BIN" restart cloudflared --update-env
    "$PM2_BIN" save --force
    break
  fi
done
