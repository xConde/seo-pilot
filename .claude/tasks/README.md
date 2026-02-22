# Claude Code Task Protocols

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
