# Strategic Audit — 2026-02-26 (Round 2)

## Momentum & Zombies

**Momentum**: 165 tests green, CI/CD pipelines added, Claude PR review wired up, bmtgradweek integration guide written. Previous sprint resolved all zombie features and red-team findings.

**Zombies**: None in source code. But the **npm distribution layer is broken** — the package would fail in CI if published today.

## The Gap

**seo-pilot cannot be consumed via `npx` without crashing on partial configuration.**

The CI/CD pipelines and integration config exist, but when bmtgradweek's CI runs `npx seo-pilot index --config seo-pilot.config.json`, it will crash because:

1. **Config loader throws on missing env vars** — If `${GOOGLE_SERVICE_ACCOUNT_PATH}` isn't set but is referenced in config, the loader crashes before the command even runs. The `index` command gracefully skips unconfigured services, but the loader kills the process first.

2. **No `files` field in package.json** — `npm publish` ships 414KB including tests, `.claude/`, `.github/`, and potentially `.credentials/`.

3. **Service account file path not validated** — Raw ENOENT crash with no actionable error message.

4. **Relative paths resolve from cwd** — `./creds.json` in config resolves from wherever the CLI is invoked, not from the config file's directory.

5. **Commands exit inconsistently on missing APIs** — `index` gracefully skips; `inspect`/`rank`/`discover` hard-exit with `process.exit(1)`.

6. **`audit` has no `--base-url` override** — Can only audit the live site URL from config; can't audit staging/preview deployments.

## The Battle Plan

- [x] **1. Support optional env vars in config** — `${VAR:-default}` returns fallback when unset; `${VAR:-}` returns empty string. Plain `${VAR}` still throws.
- [x] **2. Add `files` field to package.json** — Ships only `dist/` and `README.md`. Added `main`, `types` fields.
- [x] **3. Validate service account file at config load** — `existsSync()` check with clear error message instead of raw ENOENT.
- [x] **4. Resolve relative config paths from config directory** — `serviceAccountPath` resolved from config file's dirname, not cwd.
- [x] **5. Harmonize missing-API behavior** — inspect/rank/discover now warn-and-return instead of process.exit(1).
- [x] **6. Add `--base-url` flag to audit command** — Override site URL for staging/preview audit. `--sitemap` flag also added.

## Red Team Critique — 2026-02-26

### Finding 1: `--base-url` accepts arbitrary URLs — SSRF vector (HIGH)
**Location:** `src/commands/audit.ts:221-228`
**Risk:** `--base-url http://169.254.169.254/latest/meta-data/` would make the audit command fetch against AWS metadata or internal services. The Zod schema validates `site.url` at parse time, but `--base-url` bypasses it post-validation.
**Fix:** Added URL validation with `new URL()` + protocol check (`https:` or `http:` only). Invalid URLs now log an error and return. Same fix applied to `--sitemap`. 3 tests added covering `file://`, non-URL strings, and `ftp://`.

### Finding 2: `seo-post-deploy.yml` writes multi-line JSON to `.env.local` — parser corruption (MEDIUM)
**Location:** `.github/workflows/seo-post-deploy.yml:34`
**Risk:** `GOOGLE_SERVICE_ACCOUNT_JSON` is a multi-line JSON blob. `echo "KEY=$VALUE" >> .env.local` splits across newlines, and `loadEnvFile` reads line-by-line. Lines after the first get silently dropped. The service account value is truncated, causing auth failures with no clear error.
**Fix:** Redesigned workflow to write SA JSON to `.credentials/google-sa.json` file instead of `.env.local`. The `GOOGLE_SERVICE_ACCOUNT_PATH` env var is set to point to the file. This matches `src/auth/google.ts` which calls `readFile(serviceAccountPath)`.

### Finding 4: Empty env var fallback creates ghost API blocks (HIGH)
**Location:** `src/config/loader.ts` + `src/config/schema.ts`
**Risk:** When config uses `${VAR:-}` for optional APIs, empty strings pass Zod validation. Downstream commands check `if (!config.apis.google)` but the block IS present (with empty values). `inspect`/`rank` would try to authenticate with empty credentials.
**Fix:** Added post-validation stripping in `loadConfig()`: API blocks where required fields are empty strings are set to `undefined`. Tests confirm both full-strip and selective-strip behavior.

### Finding 3: `discover.ts` type narrowing is fragile (LOW)
**Location:** `src/commands/discover.ts:71-77`
**Risk:** The `if (!config.apis.customSearch) { return; }` guard narrows the type for the destructure on line 77. This works because both are inside the `try` block. If anyone moves the guard outside `try` (reasonable refactor), TypeScript will error. Not broken today but a maintenance hazard.
**Fix:** Acknowledged — not worth changing the control flow for a hypothetical refactor.

## Red Team Critique — 2026-02-26 (Round 2)

### Finding 5: Workflow writes SA file before directory exists (HIGH)
**Location:** `.github/workflows/seo-post-deploy.yml:37-40`
**Risk:** `echo "$JSON" > .credentials/google-sa.json` runs before `mkdir -p .credentials`. The step fails with `No such file or directory` every time Google SA secret is configured.
**Fix:** Added `mkdir -p .credentials` to the SA file write step itself.

### Finding 6: `--base-url` allows private/internal addresses (MEDIUM)
**Location:** `src/commands/audit.ts:221-230`
**Risk:** `http://localhost`, `http://127.0.0.1`, `http://169.254.169.254` all pass validation. In CI, this could expose internal services. However, this is a CLI tool (not a server-side proxy), and the attacker would need to control the CLI flags — which means they already have shell access. Accepted risk for a CLI tool.
**Fix:** Documented as known limitation. No code change needed.
