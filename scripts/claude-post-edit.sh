#!/bin/sh
# Claude Code PostToolUse hook: formats the edited file, then feeds lint problems back to the agent (exit 2).
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
root=${CLAUDE_PROJECT_DIR:-$(pwd)}

case "$f" in
  "" | "$root"/node_modules/*) exit 0 ;;
  "$root"/*.ts | "$root"/*.css | "$root"/*.html | "$root"/*.json | "$root"/*.md) ;;
  *) exit 0 ;;
esac

cd "$root" || exit 0
./node_modules/.bin/oxfmt --no-error-on-unmatched-pattern "$f" >/dev/null 2>&1

case "$f" in
  *.ts)
    if ! out=$(./node_modules/.bin/oxlint --deny-warnings --format=unix "$f" 2>&1); then
      printf 'oxlint found problems in %s:\n%s\n' "$f" "$out" >&2
      exit 2
    fi
    ;;
esac
exit 0
