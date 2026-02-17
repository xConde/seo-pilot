# Strategic Audit — seo-pilot

## Red Team Critique

### 1. CRITICAL: `.env.local` is written but never loaded (show-stopper)

**Files:** `src/commands/setup.ts:283-291`, `src/config/loader.ts`

The setup wizard writes secrets to `.env.local` (Bing API key, Custom Search credentials) and references them in `seo-pilot.config.json` as `${BING_API_KEY}`, `${CUSTOM_SEARCH_API_KEY}`, etc. But **nothing in the codebase reads `.env.local` into `process.env`**. There is no `dotenv` dependency, no manual file read, nothing.

The result: a user completes the wizard, sees "Setup Complete!", runs `seo-pilot index`, and immediately gets:

```
✗ Index command failed: Environment variable "BING_API_KEY" is not set but referenced in config
```

This breaks the entire workflow the setup wizard promises. The config loader's `substituteEnvVars` substitutes from `process.env` only — `.env.local` files are not part of Node's `process.env` unless something explicitly loads them.

**Fix:** The config loader must read `.env.local` (if it exists) and merge into `process.env` before substitution. Or stop using env var references and inline secrets directly (worse for security). No new deps needed — just read the file and parse `KEY=VALUE` lines.

### 2. HIGH: Google auth token cache is scope-unaware

**File:** `src/auth/google.ts:20-30`

The token cache is a single module-level `let tokenCache: CachedToken | null`. It stores one token regardless of which scopes were requested. Different commands need different scopes:

- `index` → scope: `auth/indexing`
- `inspect`, `rank` → scope: `auth/webmasters`

If code ever calls `getGoogleAccessToken` with `indexing` scope, then calls it again with `webmasters` scope (e.g., a future pipeline, or the `index` command's Google submission followed by another command), the cached token from the first call is returned — **with the wrong scope**. Google will return 403 Forbidden.

Currently mitigated because each CLI invocation is a separate process. But this is a latent bug that will bite as soon as anyone imports these modules programmatically or adds a combined command.

**Fix:** Key the cache by the scope string (use a `Map<string, CachedToken>`).

### 3. HIGH: Search Console keyword filter uses AND instead of OR

**File:** `src/apis/google-search-console.ts:54-64`

When multiple keywords are passed, they're all placed in a single `dimensionFilterGroups[0].filters` array. Google's API applies AND logic within a filter group — meaning it returns rows matching ALL keywords simultaneously. Since a single search query can't equal "BMT graduation" AND "Lackland" at the same time, this returns **zero results**.

The config has 6 keywords. Running `seo-pilot rank` without `--keyword` passes all 6 to this filter, which guarantees an empty result set. Users will see "No performance data found" and think their site has no traffic.

**Fix:** Either use separate filter groups (one per keyword with OR semantics), or make individual API calls per keyword, or remove the filter entirely when all config keywords are requested (let the API return everything).

### Honorable Mentions

- **`(error as any).status`** in `google-inspection.ts:62` and `requestBody: any` in `google-search-console.ts:46` violate the "no `any`" rule.
- **`sitemap.ts:2`** doesn't check `response.ok` — a 404 sitemap silently returns empty/garbage URLs.
- **`appendHistory` read-then-write** is not atomic — concurrent processes can clobber each other's history.
- **`process.exit(1)` scattered through commands** prevents cleanup and makes programmatic use impossible.
