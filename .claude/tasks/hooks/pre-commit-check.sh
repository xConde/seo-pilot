#!/bin/bash
# pre-commit-check.sh — Heavier guardrail fired before commits
# Runs typecheck and quick test validation
#
# Exit 0 = pass (commit proceeds)
# Exit 1 = fail (agent sees error, commit blocked)

ERRORS=()

# 1. TypeScript compilation check (if tsconfig exists)
if [ -f "tsconfig.json" ]; then
  echo "Running typecheck..."
  TS_OUTPUT=$(npx tsc --noEmit 2>&1)
  TS_EXIT=$?
  if [ $TS_EXIT -ne 0 ]; then
    # Only show first 15 errors to save tokens
    ERRORS+=("⚠ TypeScript compilation failed:")
    ERRORS+=("$(echo "$TS_OUTPUT" | head -15)")
    if [ $(echo "$TS_OUTPUT" | wc -l) -gt 15 ]; then
      ERRORS+=("... and more errors (run npx tsc --noEmit for full output)")
    fi
    ERRORS+=("")
  else
    echo "✓ TypeScript compilation passed"
  fi
fi

# 2. Staged file checks — hardcoded numbers in non-test service files
STAGED_SERVICES=$(git diff --cached --name-only -- 'src/services/**/*.ts' 2>/dev/null | grep -v '.test.ts')
if [ -n "$STAGED_SERVICES" ]; then
  HARDCODED=$(echo "$STAGED_SERVICES" | xargs grep -n '[^a-zA-Z_]0\.\([0-9]\{2,\}\)' 2>/dev/null | grep -v 'config\|Config\|CONFIG\|import\|\/\/' | head -10)
  if [ -n "$HARDCODED" ]; then
    ERRORS+=("⚠ Possible hardcoded thresholds in staged service files (should these be in config?):")
    ERRORS+=("$HARDCODED")
    ERRORS+=("")
  fi
fi

# Report
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║  PRE-COMMIT CHECK FAILED             ║"
  echo "╚══════════════════════════════════════╝"
  printf '%s\n' "${ERRORS[@]}"
  echo "Fix these issues before committing."
  exit 1
fi

echo "✓ Pre-commit checks passed"
exit 0
