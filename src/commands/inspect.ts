import { loadConfig } from '../config/loader.js';
import { fetchSitemapUrls } from '../utils/sitemap.js';
import { getGoogleAccessToken } from '../auth/google.js';
import { inspectUrl, type InspectionResult } from '../apis/google-inspection.js';
import { appendHistory } from '../state/history.js';
import { log } from '../utils/logger.js';

interface InspectHistoryEntry {
  timestamp: string;
  url: string;
  verdict: string;
  lastCrawlTime: string;
  indexingState: string;
  mobileUsability: string;
  [key: string]: unknown;
}

/**
 * Rate limiter: wait 1 second between requests
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runInspect(
  flags: Record<string, string | boolean>
): Promise<void> {
  try {
    // Load config
    const configPath =
      typeof flags.config === 'string' ? flags.config : undefined;
    const config = loadConfig(configPath);

    // Check if Google is configured
    if (!config.apis.google) {
      log.error('Google Search Console is not configured');
      log.info('Run "seo-pilot setup" to configure Google integration');
      process.exit(1);
    }

    // Get access token
    log.info('Authenticating with Google...');
    const accessToken = await getGoogleAccessToken(
      config.apis.google.serviceAccountPath,
      ['https://www.googleapis.com/auth/webmasters']
    );

    // Determine URLs to inspect
    let urls: string[];
    if (flags.url && typeof flags.url === 'string') {
      urls = [flags.url];
      log.info(`Inspecting single URL: ${flags.url}`);
    } else {
      log.info('Fetching URLs from sitemap...');
      urls = await fetchSitemapUrls(config.site.sitemap);
      log.info(`Found ${urls.length} URLs to inspect`);
    }

    if (urls.length === 0) {
      log.warn('No URLs to inspect');
      return;
    }

    // Inspect each URL with rate limiting
    const results: InspectionResult[] = [];
    const errors: string[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]!;
      try {
        log.info(`Inspecting ${i + 1}/${urls.length}: ${url}`);
        const result = await inspectUrl(
          url,
          config.apis.google.siteUrl,
          accessToken
        );
        results.push(result);

        // Rate limit: wait 1 second between requests (except for the last one)
        if (i < urls.length - 1) {
          await sleep(1000);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${url}: ${message}`);
        log.error(`Failed to inspect ${url}: ${message}`);
      }
    }

    // Display results table
    if (results.length > 0) {
      const headers = [
        'URL',
        'Verdict',
        'Last Crawl',
        'Indexing State',
        'Mobile OK',
      ];
      const rows = results.map((r) => [
        r.url,
        r.verdict,
        r.lastCrawlTime,
        r.indexingState,
        r.mobileUsability,
      ]);
      log.table(headers, rows);

      // Save to history
      const historyEntries: InspectHistoryEntry[] = results.map((r) => ({
        timestamp: new Date().toISOString(),
        url: r.url,
        verdict: r.verdict,
        lastCrawlTime: r.lastCrawlTime,
        indexingState: r.indexingState,
        mobileUsability: r.mobileUsability,
      }));

      await appendHistory('inspect-history.json', historyEntries);
      log.success(
        `Inspected ${results.length} URLs and saved to .seo-pilot/inspect-history.json`
      );
    }

    // Report errors
    if (errors.length > 0) {
      log.error(`Failed to inspect ${errors.length} URLs:`);
      errors.forEach((err) => log.error(`  ${err}`));
      process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Inspect command failed: ${message}`);
    process.exit(1);
  }
}
