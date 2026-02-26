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

- [ ] **1. Support optional env vars in config** — `${VAR}` throws if missing; add `${VAR?}` or `${VAR:-default}` syntax for optional values. Alternatively, make the loader skip substitution for API blocks that aren't needed by the current command.
- [ ] **2. Add `files` field to package.json** — Ship only `dist/`, `README.md`, `LICENSE`. Add `main`, `exports`, `types` fields.
- [ ] **3. Validate service account file at config load** — Check `existsSync()` and throw a clear error instead of raw ENOENT.
- [ ] **4. Resolve relative config paths from config directory** — Use config file's dirname as base for relative paths like `serviceAccountPath`.
- [ ] **5. Harmonize missing-API behavior** — All commands should warn-and-skip (like `index`) instead of hard-exiting.
- [ ] **6. Add `--base-url` flag to audit command** — Override `site.url` for staging/preview audit in CI.
