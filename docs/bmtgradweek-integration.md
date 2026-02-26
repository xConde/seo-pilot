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

Copy this to `seo-pilot.config.json` in the bmtgradweek repo root:

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
      "key": "${INDEXNOW_KEY}"
    },
    "google": {
      "serviceAccountPath": "${GOOGLE_SERVICE_ACCOUNT_PATH}",
      "siteUrl": "https://bmtgradweek.com"
    },
    "bing": {
      "apiKey": "${BING_WEBMASTER_API_KEY}",
      "siteUrl": "https://bmtgradweek.com"
    },
    "customSearch": {
      "apiKey": "${GOOGLE_CUSTOM_SEARCH_KEY}",
      "engineId": "${GOOGLE_CSE_ID}"
    }
  },
  "discover": {
    "sites": ["reddit.com", "quora.com", "rallypoint.com", "militaryonesource.mil"],
    "resultsPerKeyword": 5
  }
}
```

## GitHub Actions Integration

Add this job to bmtgradweek's `.github/workflows/ci.yml`, after the deploy job:

```yaml
  seo-index:
    name: Submit URLs to Search Engines
    needs: deploy
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g seo-pilot
      - name: Write secrets
        run: |
          echo "INDEXNOW_KEY=${{ secrets.INDEXNOW_KEY }}" >> .env.local
          echo "BING_WEBMASTER_API_KEY=${{ secrets.BING_WEBMASTER_API_KEY }}" >> .env.local
      - run: seo-pilot index --config seo-pilot.config.json
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
      BING_WEBMASTER_API_KEY: ${{ secrets.BING_WEBMASTER_API_KEY }}
```

## Required Secrets (in bmtgradweek repo settings)

| Secret | Required For | How to Get |
|--------|-------------|------------|
| `INDEXNOW_KEY` | `index` (IndexNow) | Generate at [indexnow.org](https://www.indexnow.org) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | `index`, `inspect`, `rank` | Google Cloud Console → Service Account → JSON key |
| `BING_WEBMASTER_API_KEY` | `index` (Bing) | [Bing Webmaster Tools](https://www.bing.com/webmasters) → API Access |
| `GOOGLE_CUSTOM_SEARCH_KEY` | `discover` | Google Cloud Console → Credentials → API Key |
| `GOOGLE_CSE_ID` | `discover` | [Programmable Search Engine](https://programmablesearchengine.google.com) |

## Priority Rollout

1. **Week 1**: Set up IndexNow key + Bing API key. Add `seo-index` job to CI. Every deploy auto-submits URLs.
2. **Week 2**: Add Google Service Account. Enable `inspect` + `rank` as weekly cron jobs.
3. **Week 3**: Add Custom Search API. Enable `discover` for monthly community scanning.
