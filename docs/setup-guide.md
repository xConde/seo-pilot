# API Setup Guide

This is the manual alternative to `seo-pilot setup`. Each section walks through credential creation for one API integration. Follow the sections below for the services you want to integrate.

## IndexNow

IndexNow enables instant URL submission to participating search engines (Bing, Yandex, etc.).

1. Generate a 32-character hex key:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

2. Create a file named `{key}.txt` in your site's public directory containing just the key

3. Deploy so it's accessible at `https://yoursite.com/{key}.txt`

4. Add to config:
```json
"indexnow": {
  "key": "your-32-char-hex-key"
}
```

## Google Cloud

Google Cloud powers three key commands: `index`, `inspect`, and `rank`. You'll need a service account with appropriate API access.

### Enable Required APIs

1. Create a project at https://console.cloud.google.com/projectcreate

2. Enable these APIs in the API Library:
   - **Web Search Indexing API** — for `index` command
   - **Google Search Console API** — for `inspect` and `rank` commands
   - **Custom Search API** — for `discover` command

### Create Service Account

1. Navigate to IAM & Admin → Service Accounts → Create

2. Name your service account (no roles needed — API access is granted per-site via Search Console)

3. Create key → JSON → download

4. Save to `.credentials/service-account.json` (this path is gitignored)

### Grant Search Console Access

1. Go to [Google Search Console](https://search.google.com/search-console)

2. Select your property → Settings → Users and permissions → Add user

3. Use the `client_email` from your JSON key file (looks like `name@project.iam.gserviceaccount.com`)

4. Set permission to **Owner** (required for indexing API)

### Add to Config

```json
"google": {
  "serviceAccountPath": "./.credentials/service-account.json",
  "siteUrl": "sc-domain:yoursite.com"
}
```

Note: `siteUrl` uses the `sc-domain:` prefix for domain properties. For URL-prefix properties, use `https://yoursite.com/`.

## Bing Webmaster

Bing Webmaster Tools provides URL submission and site inspection capabilities.

1. Add your site at https://www.bing.com/webmasters

2. Verify ownership using one of the available methods:
   - DNS record
   - Meta tag
   - XML file upload

3. Navigate to Settings → API Access → Generate API key

4. Add to `.env.local`:
```bash
BING_WEBMASTER_API_KEY=your-api-key
```

5. Add to config:
```json
"bing": {
  "apiKey": "${BING_WEBMASTER_API_KEY}",
  "siteUrl": "https://yoursite.com"
}
```

## Google Custom Search

The Custom Search API powers the `discover` command, which finds engagement opportunities across the web.

### Create Search Engine

1. Go to https://programmablesearchengine.google.com/

2. Create a new search engine

3. Under "Sites to search", select "Search the entire web"

4. Copy the **Search engine ID** from the overview page

### Get API Key

1. Navigate to [Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)

2. Create credentials → API key

3. Restrict to Custom Search API (recommended for security)

### Configure

Add to `.env.local`:
```bash
CUSTOM_SEARCH_API_KEY=your-api-key
CUSTOM_SEARCH_ENGINE_ID=your-engine-id
```

Add to config:
```json
"customSearch": {
  "apiKey": "${CUSTOM_SEARCH_API_KEY}",
  "engineId": "${CUSTOM_SEARCH_ENGINE_ID}"
}
```

## Environment Variables

This table shows which credentials go where and what commands use them:

| Variable | Where | Used By |
|----------|-------|---------|
| `BING_WEBMASTER_API_KEY` | `.env.local` | `index` (Bing submission) |
| `CUSTOM_SEARCH_API_KEY` | `.env.local` | `discover` (search queries) |
| `CUSTOM_SEARCH_ENGINE_ID` | `.env.local` | `discover` (search queries) |

### Config-Only Values

These values are specified directly in the config file (not environment variables):

- `indexnow.key` — the 32-character IndexNow key string
- `google.serviceAccountPath` — path to the JSON key file
- `google.siteUrl` — Search Console property URL

### Notes

- `.env.local` is gitignored and auto-loaded at runtime
- Config values using `${VAR}` syntax are substituted from the environment at load time
- Never commit `.env.local` or service account JSON files to version control
