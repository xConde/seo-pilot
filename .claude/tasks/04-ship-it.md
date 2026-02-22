# Ship It — Pre-Merge Protocol

Run REPORT STATUS.

Open `STRATEGIC_AUDIT.md` and check the "Deployment Checklist".

## PATH A: Checklist Incomplete

IF items remain unchecked or tests are failing:

1. Acknowledge the gap.
2. CONTINUE EXECUTION immediately.
3. Do not ask for permission. Loop until the checklist is clear and tests are green.
4. When complete, proceed to PATH B.

## PATH B: Checklist Complete — Initiate Pre-Merge Protocol

IF (and only if) the checklist is 100% complete and tests pass:

### 1. Code Cleanup

```bash
# Remove debug artifacts
git diff main..HEAD -- '*.ts' | grep '+.*console\.log' | head -20
git diff main..HEAD -- '*.ts' | grep '+.*\(TODO\|FIXME\|HACK\|XXX\|TEMP\)' | head -20
```

Remove any temporary `console.log`, debug comments, or `TODO`s you added during this sprint. Run linter/formatter.

### 2. Convention Check

```bash
# Catch convention (error not e)
git diff main..HEAD -- '*.ts' | grep '+.*catch (e)' | grep -v 'catch (error)' | head -10

# Hardcoded numbers that should be config
git diff --name-only main..HEAD -- 'src/services/**/*.ts' | grep -v '.test.ts' | xargs grep -n '[^a-zA-Z_]0\.\([0-9]\{2,\}\)' 2>/dev/null | grep -v 'config\|Config\|CONFIG\|import\|\/\/' | head -20
```

Fix any violations found.

### 3. Final Test Pass

Run the full test suite one last time to ensure no regressions.

```bash
npm test 2>&1 | tail -30
```

**This is a hard gate.** Do not proceed if any tests fail.

### 4. Documentation

Create a file named `PR_DRAFT.md` in the project root with this exact format:

```markdown
# [Semantic PR Title]
> e.g., `feat: implement accuracy gate w/ auto-rollback`

## Summary
High-level "Executive Summary" of what changed and why. 2-3 sentences max.

## Technical Implementation
- File/logic changes as bullet points
- Group by feature area, not by file

## Smoke Test Walkthrough
Step-by-step guide for a HUMAN to verify this manually:

### If API/Backend:
1. Run `[command]`
2. Expect `[output]`
3. Verify `[condition]`

### If UI Exists:
1. Go to `[URL]`
2. Click `[Button]`
3. Verify `[Visual Result]`

## Test Results
> If test output exceeds 50 lines of green, summarize as:
> "✓ [N] suites, [M] tests passing, 0 failures"
> Do NOT paste full green output. Only include verbose output if there are failures.

[Paste summary or failure output here]

## Risk Assessment
- **Breaking changes:** None / [describe]
- **Rollback plan:** [how to revert safely]
- **Monitoring:** [what to watch post-deploy]
```

### 5. Signal Completion

When `PR_DRAFT.md` is written and verified:

1. Print: **"READY FOR REVIEW"**
2. Delete `PR_DRAFT.md` from the working tree (it served its purpose as a draft — the commit messages and STRATEGIC_AUDIT.md are the permanent record).
3. Push the branch: `git push origin HEAD`
4. Stop.
