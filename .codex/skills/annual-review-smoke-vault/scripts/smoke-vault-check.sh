#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO_ROOT="$(cd -- "$SCRIPT_DIR/../../../.." && pwd)"
REPO_ROOT="${REPO_ROOT:-$DEFAULT_REPO_ROOT}"
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
  --generate     Run the smoke-only headless command for YEAR.
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

if [[ ! -d "$REPO_ROOT" ]]; then
  echo "ERROR: Repo root not found: $REPO_ROOT" >&2
  exit 1
fi

if [[ ! -d "$VAULT_PATH" ]]; then
  echo "ERROR: Smoke vault not found: $VAULT_PATH" >&2
  exit 1
fi

if [[ ! -d "$VAULT_PATH/.obsidian" ]]; then
  echo "ERROR: Smoke vault is missing .obsidian directory: $VAULT_PATH/.obsidian" >&2
  exit 1
fi

if [[ ! -x "$OBSIDIAN_CLI" ]]; then
  echo "ERROR: Obsidian CLI not executable: $OBSIDIAN_CLI" >&2
  exit 1
fi

if [[ "$DEPLOY" == 1 ]]; then
  echo "==> Deploy plugin to smoke vault"
  (cd "$REPO_ROOT" && npm run dev:deploy-smoke)
fi

echo "==> Enable/reload plugin and rebuild index"
"$OBSIDIAN_CLI" vault="$VAULT_NAME" plugin:enable id="$PLUGIN_ID" filter=community >/dev/null
"$OBSIDIAN_CLI" vault="$VAULT_NAME" plugin:reload id="$PLUGIN_ID" >/dev/null
"$OBSIDIAN_CLI" vault="$VAULT_NAME" command id=annual-review:rebuild-annual-review-index >/dev/null

if [[ "$GENERATE" == 1 ]]; then
  echo "==> Run smoke-only headless ${YEAR} generate command"
  "$OBSIDIAN_CLI" vault="$VAULT_NAME" command id="annual-review:generate-annual-review-${YEAR}"
fi

echo "==> Available annual-review commands"
"$OBSIDIAN_CLI" vault="$VAULT_NAME" commands filter=annual

if [[ ! -f "$REPORT_FILE" ]]; then
  echo "ERROR: Report not found: $REPORT_FILE" >&2
  echo "Run with --generate after deploying smoke commands, or inspect Obsidian CLI command failures above." >&2
  exit 1
fi

echo "==> Report: $REPORT_FILE"
wc -c "$REPORT_FILE"

printf "\n==> Issue checks\n"

echo "-- Local Codex availability from this runtime"
command -v codex || true
if [[ -x "/Users/hong/.npm-global/bin/codex" ]]; then
  /Users/hong/.npm-global/bin/codex --version || true
else
  echo "/Users/hong/.npm-global/bin/codex is not executable"
fi

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

fail_if_grep() {
  local label="$1"
  local pattern="$2"
  echo "-- $label"
  if grep -nE "$pattern" "$REPORT_FILE" | head -20; then
    echo "ERROR: $label found in report" >&2
    exit 1
  fi
}

check_grep "Month names used as quoted topics" '「([0-9]{1,2}月|20[0-9]{2}-[0-9]{2})」'
check_grep "Deprecated 更新笔记 column/text" '更新笔记'
check_grep "Wiki alias links inside Markdown table rows" '' table-alias
check_grep "SVG embeds without explicit width" '!\[\[.*\.svg\|[^]|]+\]\]'
fail_if_grep "AI summary unavailable" 'AI summary unavailable'
fail_if_grep "Codex command not found" 'codex: command not found|bash: codex: command not found'

echo "-- 建立 MOC repetition count"
{ grep -o '建立 MOC' "$REPORT_FILE" || true; } | wc -l | tr -d ' '
printf "\n"

printf "\n==> Obsidian link diagnostics\n"
"$OBSIDIAN_CLI" vault="$VAULT_NAME" unresolved counts format=json 2>/dev/null | head -80 || true
"$OBSIDIAN_CLI" vault="$VAULT_NAME" links path="$REPORT_PATH" 2>/dev/null | head -80 || true
