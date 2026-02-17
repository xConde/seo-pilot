# CLAUDE.md — seo-pilot

## Project Overview
seo-pilot is an organic SEO promotion CLI tool that automates indexing, rank tracking, on-page audits, and discovery of forum/directory engagement opportunities.
Production-ready, lightweight, zero-framework approach.

## Stack
- Node >= 20, TypeScript strict mode, ESM
- Vitest for tests
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
- User-facing docs: `README.md` (quickstart) and `docs/setup-guide.md` (credential setup)

## Development

```bash
# Run tests
npm test

# Typecheck
npx tsc --noEmit

# Run in dev
npx tsx src/cli.ts <command>

# Run compiled
npm run build && node dist/cli.js <command>

# Coverage
npm run test:coverage
```

## Architecture

```
src/
├── apis/        # Search engine API clients (IndexNow, Google, Bing)
├── auth/        # JWT generation for Google APIs
├── commands/    # CLI command implementations (setup, index, inspect, rank, discover, audit)
├── config/      # Zod schema and config loading with ${VAR} env substitution
├── state/       # State persistence for tracking operations
└── utils/       # Arg parsing, logging, HTTP client, sitemap parsing
```

## Config

- Config schema: `src/config/schema.ts` (Zod validation)
- Supports `${VAR}` env substitution in config values
- Auto-loads `.env.local` for local secrets
- Default config: `seo-pilot.config.json` (override with `--config`)

## Conventions

- TypeScript strict, no `any`, `noUncheckedIndexedAccess`
- Tests colocated in `tests/` mirroring `src/` structure
- Conventional commit messages
- No heavy CLI frameworks — manual arg parsing in `utils/args.ts`
- Minimal deps: only cheerio, jsonwebtoken, zod at runtime
