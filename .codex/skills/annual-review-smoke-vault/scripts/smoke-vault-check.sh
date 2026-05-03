#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/Users/hong/code/Obsidian-Annual}"
VAULT_NAME="${VAULT_NAME:-install-smoke-vault}"
VAULT_PATH="${VAULT_PATH:-/Users/hong/code/obsidian-annual-workspaces/install-smoke-vault}"
OBSIDIAN_CLI="${OBSIDIAN_CLI:-/Applications/Obsidian.app/Contents/MacOS/obsidian-cli}"
YEAR="${YEAR:-2026}"
PLUGIN_ID="${PLUGIN_ID:-annual-review}"
REPORT_PATH="${REPORT_PATH:-Annual Reviews/${YEAR} Annual Review.md}"
GENERATE=0
DEPLOY=1

usage() {
  cat <<USAGE
Usage: smoke-vault-check.sh [--generate] [--no-deploy]

Deploys the current repo to the smoke vault, reloads the plugin, rebuilds the
index, then prints sanity checks for the generated annual report.

Environment overrides:
  REPO_ROOT      default: $REPO_ROOT
  VAULT_NAME     default: $VAULT_NAME
  VAULT_PATH     default: $VAULT_PATH
  OBSIDIAN_CLI   default: $OBSIDIAN_CLI
  YEAR           default: $YEAR
  REPORT_PATH    default: $REPORT_PATH

Options:
  --generate     Run the current interactive generate command. It may open a modal
                 until a headless/dev annual-review command exists.
  --no-deploy    Skip npm deploy; only use current vault/plugin state.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --generate) GENERATE=1 ;;
    --no-deploy) DEPLOY=0 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

REPORT_FILE="$VAULT_PATH/$REPORT_PATH"

if [[ ! -x "$OBSIDIAN_CLI" ]]; then
  echo "ERROR: Obsidian CLI not executable: $OBSIDIAN_CLI" >&2
  exit 1
fi

if [[ "$DEPLOY" == 1 ]]; then
  echo "==> Deploy plugin to smoke vault"
  (cd "$REPO_ROOT" && npm run deploy:smoke)
fi

echo "==> Enable/reload plugin and rebuild index"
"$OBSIDIAN_CLI" vault="$VAULT_NAME" plugin:enable id="$PLUGIN_ID" filter=community >/dev/null || true
"$OBSIDIAN_CLI" vault="$VAULT_NAME" plugin:reload id="$PLUGIN_ID" >/dev/null || true
"$OBSIDIAN_CLI" vault="$VAULT_NAME" command id=annual-review:rebuild-annual-review-index >/dev/null || true

if [[ "$GENERATE" == 1 ]]; then
  echo "==> Run generate command (currently may be interactive)"
  "$OBSIDIAN_CLI" vault="$VAULT_NAME" command id=annual-review:generate-annual-review || true
fi

echo "==> Available annual-review commands"
"$OBSIDIAN_CLI" vault="$VAULT_NAME" commands filter=annual || true

if [[ ! -f "$REPORT_FILE" ]]; then
  echo "ERROR: Report not found: $REPORT_FILE" >&2
  echo "If generation opened a modal, generate ${YEAR} manually or add a headless dev command." >&2
  exit 1
fi

echo "==> Report: $REPORT_FILE"
wc -c "$REPORT_FILE"

printf "\n==> Issue checks\n"

check_grep() {
  local label="$1"
  local pattern="$2"
  local mode="${3:-plain}"
  echo "-- $label"
  if [[ "$mode" == "table-alias" ]]; then
    awk '/^\|/ && /\[\[[^]]*\|[^]]*\]\]/ { print NR ":" $0 }' "$REPORT_FILE" | head -20 || true
  else
    grep -nE "$pattern" "$REPORT_FILE" | head -20 || true
  fi
}

check_grep "Month names used as quoted topics" '「([0-9]{1,2}月|20[0-9]{2}-[0-9]{2})」'
check_grep "Deprecated 更新笔记 column/text" '更新笔记'
check_grep "Wiki alias links inside Markdown table rows" '' table-alias
check_grep "SVG embeds without explicit width" '!\[\[.*\.svg\|[^]|]+\]\]'

echo "-- 建立 MOC repetition count"
grep -o '建立 MOC' "$REPORT_FILE" | wc -l | tr -d ' '
printf "\n"

printf "\n==> Obsidian link diagnostics\n"
"$OBSIDIAN_CLI" vault="$VAULT_NAME" unresolved counts format=json 2>/dev/null | head -80 || true
"$OBSIDIAN_CLI" vault="$VAULT_NAME" links path="$REPORT_PATH" 2>/dev/null | head -80 || true
