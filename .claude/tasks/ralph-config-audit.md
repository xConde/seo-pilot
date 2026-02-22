# Ralph-Loop: Config Audit

> Usage: `/ralph-loop "$(cat .claude/tasks/ralph-config-audit.md)" --max-iterations 15 --completion-promise 'CONFIG AUDIT COMPLETE'`

## Per-Iteration Process

1. Pick the next production service file (not test, not config) that has hardcoded numeric literals.
2. Find hardcoded numbers that represent thresholds, weights, or tuning parameters (NOT array indices, HTTP status codes, or mathematical constants).
3. For each hardcoded number found:
   - Check if an equivalent config entry already exists in BiasRegistry or a `*.config.ts` file.
   - If yes: replace the hardcoded value with the config reference.
   - If no config exists yet: create the config entry, then replace.
4. Run tests. If green, commit: `refactor: wire [file] hardcoded thresholds to config`
5. If tests fail, revert and document in `.claude/ralph-loop.local.md`.

## Dump Pile (Files to Skip)

- `*.test.ts` — test assertions use literal values intentionally
- `*.config.ts` — these ARE the config files
- `*.enum.ts` — enum values are constants by design

## Stop Condition

All production service files audited, OR 3 consecutive iterations with no findings.

## State File

Track progress in `.claude/ralph-loop.local.md`:

```markdown
# Config Audit Progress
## Completed
- [ ] file1.ts — 3 values migrated
## Skipped (no findings)
## Blocked (test failures)
```
