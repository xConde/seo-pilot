#!/bin/bash
# post-write-check.sh — Deterministic guardrail fired after every file write/edit
# This is NOT a prompt. The agent cannot skip this.
#
# Exit 0 = pass (agent continues)
# Exit 1 = fail (agent sees error output and must fix)

FILEPATH="$1"
ERRORS=()

# Only check TypeScript/JavaScript files
if [[ ! "$FILEPATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

# Skip test files for some checks (tests legitimately use console.log)
IS_TEST=false
if [[ "$FILEPATH" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]]; then
  IS_TEST=true
fi

# 1. console.log detection (non-test files only)
if [ "$IS_TEST" = false ]; then
  CONSOLE_HITS=$(grep -n 'console\.log' "$FILEPATH" 2>/dev/null | grep -v '\/\/' | head -5)
  if [ -n "$CONSOLE_HITS" ]; then
    ERRORS+=("⚠ console.log detected (remove before commit):")
    ERRORS+=("$CONSOLE_HITS")
    ERRORS+=("")
  fi
fi

# 2. catch(e) convention — should be catch(error)
CATCH_HITS=$(grep -n 'catch\s*(e)' "$FILEPATH" 2>/dev/null | head -5)
if [ -n "$CATCH_HITS" ]; then
  ERRORS+=("⚠ catch(e) should be catch(error) per convention:")
  ERRORS+=("$CATCH_HITS")
  ERRORS+=("")
fi

# 3. TODO/FIXME/HACK/XXX detection
TODO_HITS=$(grep -n '\(TODO\|FIXME\|HACK\|XXX\)' "$FILEPATH" 2>/dev/null | grep -v 'node_modules' | head -5)
if [ -n "$TODO_HITS" ]; then
  ERRORS+=("⚠ TODO/FIXME/HACK markers found (resolve or document):")
  ERRORS+=("$TODO_HITS")
  ERRORS+=("")
fi

# Report
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "╔══════════════════════════════════════╗"
  echo "║  GUARDRAIL CHECK FAILED: $FILEPATH"
  echo "╚══════════════════════════════════════╝"
  printf '%s\n' "${ERRORS[@]}"
  echo "Fix these issues before continuing."
  exit 1
fi

exit 0
