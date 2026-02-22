# Claude Code Task Protocols

## Quick Decision Guide

| You just...                        | Run this              |
|------------------------------------|-----------------------|
| Started a new sprint/feature       | 01-sovereign-audit    |
| Finished coding, ready to review   | 02-red-team-gate      |
| Red team passed, need to finish up | 03-closer-protocol    |
| Think you're done                  | 04-ship-it            |
| About to commit something small    | quick-sanity          |
| Need repetitive file-by-file work  | ralph-* templates     |

### Minimum Viable Workflow

If you only use ONE prompt, use `02-red-team-gate.md` before every merge. Everything else is acceleration.

---

## The Sprint Lifecycle

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  1. RECON    │────▶│  2. RED TEAM  │────▶│  3. CLOSER  │────▶│  4. SHIP IT  │
│  sovereign   │     │  quality gate │     │  autonomous  │     │  pre-merge   │
│  audit       │     │  hostile      │     │  execution   │     │  protocol    │
│              │     │  review       │     │              │     │              │
│  Creates:    │     │  Appends:     │     │  Appends:    │     │  Creates:    │
│  STRATEGIC_  │     │  Red Team     │     │  Deployment  │     │  PR_DRAFT.md │
│  AUDIT.md    │     │  Critique     │     │  Checklist   │     │  then pushes │
│  + branch    │     │  + fix        │     │  + code      │     │              │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
```

## Hooks

The `hooks/` directory contains deterministic guardrail scripts that fire automatically via Claude Code hooks. These are NOT prompts — they are enforced checks the agent cannot skip.

| Hook Script            | Fires On         | What It Catches                          |
|------------------------|------------------|------------------------------------------|
| `post-write-check.sh`  | After file write | console.log, catch(e), TODO/FIXME/HACK   |
| `pre-commit-check.sh`  | Before commit    | TypeScript compilation, test health       |

To wire hooks into Claude Code, add to your `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "write|edit|MultiEdit",
        "hook": "bash .claude/hooks/post-write-check.sh $FILEPATH"
      }
    ]
  }
}
```

> **Note:** Verify the exact hooks config format against [Claude Code docs](https://docs.claude.com/en/docs/claude-code/overview) as the API may evolve. The shell scripts themselves are stable regardless of config format.

## Usage

Each file below is a standalone prompt. Copy-paste into Claude Code, or use with ralph-loop where noted.

| File | When | Duration | Autonomy |
|------|------|----------|----------|
| `01-sovereign-audit.md` | Start of sprint | Single shot | Creates branch, writes first code |
| `02-red-team-gate.md` | Before any merge | 1-3 iterations | Finds holes, fixes worst one |
| `03-closer-protocol.md` | After red team passes | Autonomous loop | Runs until checklist empty |
| `04-ship-it.md` | When you think it's done | Single shot | Merge gate → push |

## Quick Commands

```bash
# Full sprint (paste each when the previous completes)
cat .claude/tasks/01-sovereign-audit.md
cat .claude/tasks/02-red-team-gate.md
cat .claude/tasks/03-closer-protocol.md
cat .claude/tasks/04-ship-it.md

# Just the quality gate (most common standalone use)
cat .claude/tasks/02-red-team-gate.md

# Ralph-loop variants (for repetitive sub-tasks)
cat .claude/tasks/ralph-config-audit.md
cat .claude/tasks/ralph-version-tags.md
```

## Conventions

- `STRATEGIC_AUDIT.md` is the living document — every phase appends to it
- Commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Branch naming: `feat/velocity-[topic]` (from audit) or manual
- The red team gate is the most valuable standalone prompt — use it before ANY merge
