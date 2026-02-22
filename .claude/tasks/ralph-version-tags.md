# Ralph-Loop: Version Tag Sweep

> Usage: `/ralph-loop "$(cat .claude/tasks/ralph-version-tags.md)" --max-iterations 20 --completion-promise 'VERSION TAGS COMPLETE'`

## Per-Iteration Process

1. Pick the next service file that has a `@version` tag (or is missing one).
2. Read the git log for that file: `git log --oneline -5 -- [file]`
3. Update or add the `@version` tag to reflect the current semantic version based on recent changes.
4. Ensure the JSDoc header follows the project convention:
   ```typescript
   /**
    * @description Brief description of what this service does
    * @version X.Y.Z
    * @since YYYY-MM-DD
    */
   ```
5. Commit: `docs: update @version tag for [filename]`

## Stop Condition

All service files in `src/services/` have been checked, OR no remaining files found.

## State File

Track in `.claude/ralph-loop.local.md`:

```markdown
# Version Tag Sweep
## Completed
- [x] service-name.ts — v2.1.0
## Skipped (already current)
## Needs Review (unclear versioning)
```
