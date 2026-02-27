# CLAUDE.md — seo-pilot

## Project Overview
seo-pilot is an organic SEO promotion CLI tool that automates indexing, rank tracking, on-page audits, and discovery of forum/directory engagement opportunities.
Production-ready, lightweight, zero-framework approach. Private repo: `xConde/seo-pilot`.

## Stack
- Node >= 20, TypeScript strict mode (`noUncheckedIndexedAccess`), ESM
- Vitest for tests (180 tests across 20 files)
- Zod for config validation
- Only 3 runtime deps: cheerio, jsonwebtoken, zod

## Commands

| Command | Description |
|---------|-------------|
| `setup` | Interactive credential setup wizard |
| `index` | Submit URLs to search engines (IndexNow, Google, Bing) |
| `inspect` | Check indexing status via Google URL Inspection API |
| `rank` | Track keyword positions via Search Console |
| `discover` | Find forum/directory engagement opportunities |
| `audit` | Validate on-page SEO (meta, schema, links, sitemap) |

## Documentation
- `README.md` — quickstart, commands, config shape, CI snippet
- `docs/setup-guide.md` — manual credential setup for all 4 APIs
- `seo-pilot.config.example.json` — copy-and-fill config template

## Development

```bash
npm test                        # vitest (180 tests)
npx tsc --noEmit                # typecheck
npx tsx src/cli.ts <command>    # run in dev
npm run build                   # compile to dist/
npm run test:coverage           # coverage report
```

## Architecture

```
src/
├── apis/        # Search engine API clients (IndexNow, Google, Bing)
├── auth/        # JWT generation for Google APIs
├── commands/    # CLI command implementations (setup, index, inspect, rank, discover, audit)
├── config/      # Zod schema and config loading with ${VAR} env substitution
├── state/       # State persistence (.seo-pilot/ history files)
└── utils/       # Arg parsing, logging, HTTP client, sitemap parsing
```

## Config
- Schema source of truth: `src/config/schema.ts`
- Supports `${VAR}` and `${VAR:-default}` env substitution in config values
- Auto-loads `.env.local` for local secrets
- Default config: `seo-pilot.config.json` (override with `--config`)

## Conventions
- TypeScript strict, no `any`
- Tests in `tests/` mirroring `src/` structure
- Conventional commit messages
- No heavy CLI frameworks — manual arg parsing in `utils/args.ts`
- Minimal deps: only cheerio, jsonwebtoken, zod at runtime

## Security
- Multiple red-team audits completed — input validation, URL sanitization, credential handling all hardened
- `.credentials/`, `.env.local`, `.seo-pilot/` are gitignored
