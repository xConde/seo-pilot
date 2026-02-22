# Quick Sanity Check — Pre-Commit

> For when you want a fast gut-check before committing, not the full Red Team.

Run these checks against staged or recent changes. Report findings inline — no artifact updates needed.

## Automated Checks

```bash
# 1. Tests pass?
npm test 2>&1 | tail -5

# 2. Type safety?
npm run typecheck 2>&1 | tail -10

# 3. Debug artifacts left behind?
git diff --cached -- '*.ts' | grep '+.*console\.log' | head -10

# 4. TODO/FIXME introduced?
git diff --cached -- '*.ts' | grep '+.*\(TODO\|FIXME\|HACK\)' | head -10

# 5. Catch convention?
git diff --cached -- '*.ts' | grep '+.*catch (e)' | grep -v 'catch (error)'
```

## 30-Second Human Review

For each changed file, answer:
1. If this input were `undefined`, would the code throw or degrade gracefully?
2. Is there a new magic number that should be in config?
3. Did I update tests for the behavioral change?

If all checks pass and all three answers are clean: **CLEAR TO COMMIT.**

If any check fails: fix it before committing. Do not document, just fix.
