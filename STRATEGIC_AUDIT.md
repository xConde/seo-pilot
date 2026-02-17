# Strategic Audit — seo-pilot

## MOMENTUM & ZOMBIES

**Momentum**: Extremely high. 10 commits in one sprint, 2,500 LOC source + 3,500 LOC tests, all 6 commands built, 145 tests green, typecheck clean, red-team hardened. The skeleton is complete.

**Zombie Features** (code exists but isn't shipping):

1. **`discover` command directory queries are hardcoded to bmtgradweek.com's military niche.** Lines 14-21 of `discover.ts` contain literal strings like `"military family resources"`, `"JBSA" OR "Lackland"`, `"BMT graduation"`. The plan says "site-agnostic by design" — this violates it. A user configuring for a cooking blog gets military family directory results. The forum mode IS site-agnostic (it uses config keywords), but directory mode is a zombie that only works for one site.

2. **`setup` wizard `validateApis()` is a no-op.** Lines 294-320 check if config values are truthy and print "Configured" — zero actual API calls. It says "Validating API Configuration" but validates nothing. A user with a wrong API key sees green checkmarks.

3. **Build output is untested.** `tsc` compiles to `dist/` but nobody has verified `node dist/cli.js --help` works. The `bin` field in package.json points to `./dist/cli.js` but the shebang `#!/usr/bin/env node` only exists in the TypeScript source — need to verify it survives compilation.

4. **No CLAUDE.md for this repo.** Every other repo in the workspace has one. New contributors (or future Claude sessions) get no architectural context.

## THE GAP

**The `discover` command is architecturally broken for any site except bmtgradweek.com.**

This is the only command that violates the site-agnostic principle. Every other command derives its behavior from config (sitemap URLs, keywords, API keys). But `discover --type directories` has 6 hardcoded query templates that reference "military family", "Air Force graduation", "JBSA", "Lackland", "BMT". These are meaningless for any other domain.

This also blocks the CI integration story — you can't publish `seo-pilot` as a generic tool on npm when one of its commands is welded to a single niche.

The fix is architectural: directory discovery queries must be config-driven, with intelligent defaults generated from the site's keywords. The config schema needs a `discover.directoryQueries` field, and the setup wizard should auto-generate niche-relevant queries from the user's keyword list.

## THE BATTLE PLAN

- [ ] **1. Make discover site-agnostic** — Add `discover.directoryQueries` to config schema. Generate queries from keywords using templates like `"{keyword}" + "resources" OR "directory"`. Remove all hardcoded military strings. Update tests.
- [ ] **2. Make setup validation real** — `validateApis()` should make lightweight test calls: IndexNow key file fetch, Google token exchange, Bing API ping, Custom Search test query. Report actual pass/fail.
- [ ] **3. Verify build pipeline** — Test `node dist/cli.js --help` works after `tsc`. Verify shebang survives. Add `prepublishOnly` script.
- [ ] **4. Add repo CLAUDE.md** — Architecture overview, test commands, deploy strategy, conventions.

## Red Team Critique (Post-Hardening)

Three bugs introduced by the hardening commit itself:

1. **Boundary regex captures trailing Content-Type params (CRITICAL).** `google-indexing.ts` line 96: `/boundary=(.+)/` matches `batch_abc123; charset=utf-8` instead of just `batch_abc123`. The multipart split will never find the boundary in the response body. The fix we shipped for the hardcoded boundary regex is itself broken — we swapped one fragile regex for another.

2. **Bing concurrent retries amplify 429 storms (MEDIUM).** `bing-webmaster.ts`: 5 concurrent requests each with independent `withRetry`. If all 5 get rate-limited, all 5 retry simultaneously at the same backoff intervals — 20 wasted requests in 7 seconds. Concurrency without shared backoff is worse than sequential.

3. **Audit sitemap URL count wrong for sitemap indexes (LOW-MEDIUM).** `audit.ts` line 163: inline `<loc>` regex replaced the recursive `fetchSitemapUrls()` call. For sitemap indexes, `<loc>` values are child sitemap URLs, not page URLs. The reported count is wrong. We fixed the double-fetch but regressed the accuracy.

## Deployment Checklist

- [x] **1. Fix Bing 429 retry storm** — Chunk-level backoff: on 429, pause entire chunk, retry only failed URLs. Non-429 errors fail immediately.
- [x] **2. Fix audit sitemap index URL count** — Detect `<sitemapindex>` format, report "X child sitemaps" vs "X URLs". Skip HEAD sampling for child sitemaps.
- [x] **3. Final verification** — 165 tests green, typecheck clean, `npm run build && node dist/cli.js --help` works, shebang preserved.
