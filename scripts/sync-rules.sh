#!/usr/bin/env bash
set -euo pipefail

# Sync RULES.md → tool-specific AI config files.
# Run via: mise run rules:sync

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RULES="$REPO_ROOT/RULES.md"

if [ ! -f "$RULES" ]; then
  echo "ERROR: RULES.md not found at $RULES" >&2
  exit 1
fi

HEADER_CLAUDE="<!-- AUTO-GENERATED from RULES.md — do not edit directly. Run: mise run rules:sync -->"
HEADER_CURSOR="# AUTO-GENERATED from RULES.md — do not edit directly. Run: mise run rules:sync"
HEADER_COPILOT="<!-- AUTO-GENERATED from RULES.md — do not edit directly. Run: mise run rules:sync -->"

# Strip the "source of truth" note from RULES.md since it's redundant in generated files
CONTENT=$(sed '/^> \*\*This is the single source of truth/d; /^> Run `mise run rules:sync`/d' "$RULES")

# CLAUDE.md
echo "$HEADER_CLAUDE" > "$REPO_ROOT/CLAUDE.md"
echo "" >> "$REPO_ROOT/CLAUDE.md"
echo "$CONTENT" >> "$REPO_ROOT/CLAUDE.md"

# .cursorrules
echo "$HEADER_CURSOR" > "$REPO_ROOT/.cursorrules"
echo "" >> "$REPO_ROOT/.cursorrules"
echo "$CONTENT" >> "$REPO_ROOT/.cursorrules"

# .github/copilot-instructions.md
mkdir -p "$REPO_ROOT/.github"
echo "$HEADER_COPILOT" > "$REPO_ROOT/.github/copilot-instructions.md"
echo "" >> "$REPO_ROOT/.github/copilot-instructions.md"
echo "$CONTENT" >> "$REPO_ROOT/.github/copilot-instructions.md"

echo "Synced RULES.md →"
echo "  CLAUDE.md"
echo "  .cursorrules"
echo "  .github/copilot-instructions.md"
