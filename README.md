# seo-pilot

CLI tool that automates organic SEO — indexing, rank tracking, on-page audits, and discovery of forum/directory engagement opportunities.

## Prerequisites

- Node >= 20
- API credentials for: IndexNow, Google Cloud (service account), Bing Webmaster, Google Custom Search
- See [Setup Guide](docs/setup-guide.md) for credential walkthrough, or run the interactive wizard below

## Quick Start

```bash
npm install
npx seo-pilot setup            # interactive credential wizard
npx seo-pilot index --dry-run  # preview URLs without submitting
```

## Commands

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `setup` | Interactive credential setup wizard | — |
| `index` | Submit URLs to search engines (IndexNow, Google, Bing) | `--service <name>`, `--dry-run` |
| `inspect` | Check indexing status via Google URL Inspection API | `--url <url>` |
| `rank` | Track keyword positions via Search Console | `--days <n>`, `--keyword <kw>` |
| `discover` | Find forum/directory engagement opportunities | `--type <type>`, `--keyword <kw>` |
| `audit` | Validate on-page SEO (meta, schema, links, sitemap) | `--url <url>`, `--checks <list>` |

All commands accept `--config <path>` (default: `seo-pilot.config.json`).

## Config

- Schema: `src/config/schema.ts` (Zod) — source of truth for all config fields
- Example: `seo-pilot.config.example.json` — copy and fill in your values
- Supports `${VAR}` substitution in config values (e.g., `"${BING_WEBMASTER_API_KEY}"`)
- Auto-loads `.env.local` for secrets (gitignored)

## State

`.seo-pilot/` directory (gitignored) stores operation history as JSON arrays:

| File | Purpose |
|------|---------|
| `index-history.json` | Indexing submission results |
| `inspect-history.json` | URL inspection results |
| `rank-history.json` | Keyword ranking snapshots |
| `discover-history.json` | Discovered opportunities (used to deduplicate) |
| `audit-history.json` | On-page audit results |

## CI Integration

GitHub Actions snippet for post-deploy indexing:

```yaml
- name: Notify search engines
  run: npx seo-pilot index --service indexnow
  env:
    BING_WEBMASTER_API_KEY: ${{ secrets.BING_WEBMASTER_API_KEY }}
```

## Development

```bash
npm test                        # vitest (165 tests)
npx tsc --noEmit                # typecheck
npx tsx src/cli.ts <command>    # run without building
npm run build                   # compile to dist/
```
