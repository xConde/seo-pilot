# Red Team Quality Gate

STOP. Do not commit yet. We are initiating a "Red Team" quality gate.

Switch roles. You are no longer the Architect who built this; you are now the Lead Security & Reliability Engineer doing a hostile code review. Your goal is to find holes in the logic you just wrote.

## Phase 0: Scope Lock

Run `git diff --stat main..HEAD` first. Only review files that changed on this branch. Do NOT review unchanged code or suggest improvements outside the branch scope. This is a targeted review, not a codebase audit.

If the repo has Claude Code hooks configured, verify they are not being bypassed. Run `cat .claude/settings.json 2>/dev/null` and `ls .claude/hooks/ 2>/dev/null` — confirm all deterministic guardrails are wired and active. If hooks exist but are misconfigured, flag this as Finding 0 in your critique.

## Phase 1: The "Devil's Advocate" Interrogation

Review the changes with `git diff main..HEAD -- '*.ts'` (adjust extension as needed) with extreme skepticism. For each changed file, ask yourself:

1. **"Happy Path" Bias:** Did I write code that only works when inputs are perfect? Where does this break if data is missing, malformed, null, or at boundary values?
2. **The "3 AM" Test:** Is this implementation too clever? Will this be a nightmare to debug during an outage? Could a junior dev understand the flow?
3. **Integration Fragility:** Did I introduce a dependency or logic flow that conflicts with existing patterns in the codebase? Are there two sources of truth for the same value?
4. **Config Drift:** Are there values that MUST stay in sync across files but aren't derived from a single source? Hardcoded numbers that shadow config values?
5. **Silent Failures:** Are there code paths that swallow errors, return defaults that look valid, or degrade without any signal to the caller?

## Phase 2: Update Artifact

Append a new section to `STRATEGIC_AUDIT.md` (create it if it doesn't exist):

```markdown
## Red Team Critique — [Date]

### Finding 1: [Title] (SEVERITY)
**Location:** `file.ts:line`
**Risk:** What breaks, and under what conditions.
**Fix:** Concrete remediation.

### Finding 2: ...

### Finding 3: ...
```

List the top 2-3 specific weaknesses or "blind spots" you found. If you found nothing, you aren't looking hard enough — dig deeper into edge cases, error handling, or config synchronization.

## Phase 3: Hardening

1. Pick the single most critical weakness identified in your critique.
2. Fix it immediately in this branch.
3. Write or update tests that would have caught the issue.
4. Run the full test suite to confirm no regressions.
5. Show me the diff of the fix with `git diff`.

Do NOT commit the fix yet — I will review the diff first.
