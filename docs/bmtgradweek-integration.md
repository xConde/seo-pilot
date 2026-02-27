# bmtgradweek × seo-pilot Integration

## Gap Analysis

bmtgradweek.com has strong on-page SEO (meta tags, OpenGraph, 8 JSON-LD schema types, sitemap, robots.txt, canonical URLs). What it lacks is **organic growth automation**:

| Gap | seo-pilot Command | Impact |
|-----|-------------------|--------|
| No active index submission | `index` | New/updated pages indexed in hours, not weeks |
| No rank tracking | `rank` | Detect keyword drift, algo penalties early |
| No indexing status checks | `inspect` | Catch deindexed pages before traffic drops |
| No automated on-page audit | `audit` | Prevent broken meta/schema/links from shipping |
| No community discovery | `discover` | Find backlink opportunities in military forums |

## Config

Copy this to `seo-pilot.config.json` in the bmtgradweek repo root.

API blocks use `${VAR:-}` (optional) syntax so the config loads even when
only some secrets are configured. Commands gracefully skip unconfigured APIs.

```json
{
  "version": "1",
  "site": {
    "url": "https://bmtgradweek.com",
    "sitemap": "https://bmtgradweek.com/sitemap.xml"
  },
  "keywords": [
    "BMT graduation",
    "Lackland AFB graduation",
    "JBSA graduation",
    "Air Force basic training graduation",
    "BMT family guide",
    "JBSA-Lackland",
    "BMT graduation schedule 2026",
    "hotels near Lackland AFB",
    "BMT grad week",
    "Lackland gate hours"
  ],
  "apis": {
    "indexnow": {
      "key": "${INDEXNOW_KEY:-}"
    },
    "google": {
      "serviceAccountPath": "${GOOGLE_SERVICE_ACCOUNT_PATH:-}",
      "siteUrl": "https://bmtgradweek.com"
    },
    "bing": {
      "apiKey": "${BING_WEBMASTER_API_KEY:-}",
      "siteUrl": "https://bmtgradweek.com"
    },
    "customSearch": {
      "apiKey": "${GOOGLE_CUSTOM_SEARCH_KEY:-}",
      "engineId": "${GOOGLE_CSE_ID:-}"
    }
  },
  "discover": {
    "sites": ["reddit.com", "quora.com", "rallypoint.com", "militaryonesource.mil"],
    "resultsPerKeyword": 5
  }
}
```

## Prerequisites

### IndexNow Key File (required for `index` command)

IndexNow requires your key to be hosted at `https://bmtgradweek.com/{key}.txt`.
For a static Next.js site, add the key file to `public/`:

```bash
# Generate a key (any UUID or random string works)
echo "your-indexnow-key-here" > public/your-indexnow-key-here.txt
```

The key in `public/{key}.txt` must match the `INDEXNOW_KEY` secret value exactly.
Without this file, IndexNow submissions are silently rejected by search engines.

### Google Service Account (required for `inspect`, `rank`, `index` via Google)

1. Create a service account in Google Cloud Console
2. Download the JSON key file
3. Grant the service account access to your Search Console property
4. In GitHub repo settings, add the **entire JSON contents** as secret `GOOGLE_SERVICE_ACCOUNT_JSON`

The CI workflow writes this secret to a `.credentials/google-sa.json` file at runtime
and sets `GOOGLE_SERVICE_ACCOUNT_PATH` automatically. You do NOT need to commit the
key file to the repo.

## GitHub Actions Integration

Add this job to bmtgradweek's `.github/workflows/ci.yml`, after the deploy job:

```yaml
  seo-index:
    name: Submit URLs to Search Engines
    needs: deploy
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - name: Write Google service account
        if: env.GOOGLE_SA != ''
        run: |
          mkdir -p .credentials
          echo "$GOOGLE_SA" > .credentials/google-sa.json
          echo "GOOGLE_SERVICE_ACCOUNT_PATH=.credentials/google-sa.json" >> .env.local
        env:
          GOOGLE_SA: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON }}
      - name: Write API keys
        run: |
          echo "INDEXNOW_KEY=${{ secrets.INDEXNOW_KEY }}" >> .env.local
          echo "BING_WEBMASTER_API_KEY=${{ secrets.BING_WEBMASTER_API_KEY }}" >> .env.local
      - run: npx seo-pilot index --config seo-pilot.config.json
```

Or use the reusable workflow from seo-pilot:

```yaml
  seo:
    needs: deploy
    if: github.ref == 'refs/heads/main'
    uses: xConde/seo-pilot/.github/workflows/seo-post-deploy.yml@main
    with:
      config-path: seo-pilot.config.json
      commands: "index audit"
    secrets:
      INDEXNOW_KEY: ${{ secrets.INDEXNOW_KEY }}
      BING_WEBMASTER_API_KEY: ${{ secrets.BING_WEBMASTER_API_KEY }}
      GOOGLE_SERVICE_ACCOUNT_JSON: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON }}
```

## Required Secrets (in bmtgradweek repo settings)

| Secret | Required For | How to Get |
|--------|-------------|------------|
| `INDEXNOW_KEY` | `index` (IndexNow) | Generate any UUID; must match `public/{key}.txt` filename |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | `index` (Google), `inspect`, `rank` | Google Cloud Console → Service Account → JSON key (full contents) |
| `BING_WEBMASTER_API_KEY` | `index` (Bing) | [Bing Webmaster Tools](https://www.bing.com/webmasters) → API Access |
| `GOOGLE_CUSTOM_SEARCH_KEY` | `discover` | Google Cloud Console → Credentials → API Key |
| `GOOGLE_CSE_ID` | `discover` | [Programmable Search Engine](https://programmablesearchengine.google.com) |

## Priority Rollout

1. **Week 1**: Generate IndexNow key, add `public/{key}.txt`, set `INDEXNOW_KEY` + `BING_WEBMASTER_API_KEY` secrets. Add `seo-index` job to CI. Every deploy auto-submits URLs.
2. **Week 2**: Create Google Service Account, grant Search Console access, add `GOOGLE_SERVICE_ACCOUNT_JSON` secret. Enable `inspect` + `rank` as weekly cron jobs.
3. **Week 3**: Add Custom Search API. Enable `discover` for monthly community scanning.

## Known Limitations

- **CI state is ephemeral**: seo-pilot writes history to `.seo-pilot/` for deduplication. In CI this directory is wiped every run. The `discover` command will rediscover the same URLs each run. For `index` this is fine (IndexNow is idempotent).
- **Audit runs against live URLs**: The `audit` command fetches from the production site. Use `--base-url` to audit staging/preview deployments instead.
