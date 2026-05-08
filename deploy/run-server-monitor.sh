#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${MONEY_MONEY_COME_ENV:-$ROOT_DIR/deploy/server.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  echo "Copy deploy/server.env.example to deploy/server.env and fill OKX / Telegram values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

cd "$ROOT_DIR"
mkdir -p data logs

echo "[money-money-come] starting monitor"
echo "[money-money-come] profiles: ${SMART_WALLET_PROFILES_PATH:-data/smart_wallet_profiles_bsc.json}"
echo "[money-money-come] groups: ${SMART_WALLET_GROUPS_PATH:-data/smart_wallet_groups_bsc.json}"
exec node scripts/monitor_bsc_signals.mjs
