# Strategic Audit — 2026-02-26

## Momentum & Zombies

**Momentum**: All 6 commands built, 165 tests green, red-team hardened, TypeScript strict clean. The CLI is production-ready but has no distribution mechanism.

**Zombies**: None. Previous audit items (hardcoded discover queries, no-op setup validation, boundary regex, Bing retry storms, sitemap index count) are all resolved. Zero TODO/FIXME/HACK comments in codebase.

**Abandoned work**: `feat/initial-implementation` branch exists but is fully merged. No stashes.

## The Gap

**seo-pilot has no CI/CD pipeline and no way to be consumed by other repos.**

The tool is complete but trapped on a developer's machine. There is:
- No GitHub Actions workflow (test, typecheck, build)
- No automated release/publish pipeline
- No reusable workflow for consuming repos (e.g., bmtgradweek)

Meanwhile, bmtgradweek.com has strong on-page SEO (meta, schema, sitemap, robots.txt, structured data) but **zero organic growth automation**:
- No active index submission (IndexNow, Google, Bing)
- No rank tracking for core keywords (BMT graduation, Lackland AFB, etc.)
- No indexing status inspection
- No automated on-page audit
- No forum/directory discovery

All 5 gaps map 1:1 to seo-pilot's commands. The blocker is that seo-pilot can't be run in CI.

## The Battle Plan

- [x] **1. Add GitHub Actions CI workflow** — Test, typecheck, build as 3 parallel jobs on push/PR to main.
- [x] **2. Add npm publish workflow** — On `v*` tag push, full test suite → npm publish → GitHub Release.
- [x] **3. Add reusable SEO workflow** — `workflow_call` workflow for consuming repos to run seo-pilot commands post-deploy.
- [x] **4. Add Claude PR review workflow** — Auto-review on PR open/sync, @claude mention support. Mirrors bmtgradweek setup.
- [x] **5. Create bmtgradweek integration config** — Integration guide with config, workflow snippets, secrets checklist, and rollout plan. See `docs/bmtgradweek-integration.md`.
