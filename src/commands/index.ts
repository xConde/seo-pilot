import { loadConfig } from '../config/loader.js';
import { fetchSitemapUrls } from '../utils/sitemap.js';
import { submitIndexNow } from '../apis/indexnow.js';
import { submitGoogleIndexing } from '../apis/google-indexing.js';
import { submitBingUrls } from '../apis/bing-webmaster.js';
import { getGoogleAccessToken } from '../auth/google.js';
import { appendHistory } from '../state/history.js';
import { log } from '../utils/logger.js';

interface IndexHistoryEntry {
  timestamp: string;
  service: string;
  urlCount: number;
  success: boolean;
  errors: string[];
}

export async function runIndex(
  flags: Record<string, string | boolean>
): Promise<void> {
  try {
    // Load config
    const configPath =
      typeof flags.config === 'string' ? flags.config : undefined;
    const config = loadConfig(configPath);

    // Fetch sitemap URLs
    log.info('Fetching URLs from sitemap...');
    const urls = await fetchSitemapUrls(config.site.sitemap);
    log.info(`Found ${urls.length} URLs`);

    // Check service flag
    const service =
      typeof flags.service === 'string' ? flags.service : 'all';

    // Dry run mode
    if (flags['dry-run']) {
      log.info('Dry run mode - URLs that would be submitted:');
      console.log(urls.join('\n'));
      return;
    }

    // Determine which services to use
    const useIndexNow = service === 'all' || service === 'indexnow';
    const useGoogle = service === 'all' || service === 'google';
    const useBing = service === 'all' || service === 'bing';

    const results: IndexHistoryEntry[] = [];
    const errors: string[] = [];

    // Submit to IndexNow if configured
    if (useIndexNow) {
      if (config.apis.indexnow) {
        log.info('Submitting to IndexNow...');
        const result = await submitIndexNow(
          urls,
          config.apis.indexnow.key,
          config.site.url
        );

        const entry: IndexHistoryEntry = {
          timestamp: new Date().toISOString(),
          service: 'indexnow',
          urlCount: result.urlCount,
          success: result.success,
          errors: result.error ? [result.error] : [],
        };

        results.push(entry);
        if (result.error) {
          errors.push(result.error);
        }

        // Save to history
        await appendHistory('index-history.json', entry);
      } else {
        log.warn('IndexNow not configured, skipping');
      }
    }

    // Submit to Google Indexing API if configured
    if (useGoogle) {
      if (config.apis.google) {
        log.info('Submitting to Google Indexing API...');
        try {
          const accessToken = await getGoogleAccessToken(
            config.apis.google.serviceAccountPath,
            ['https://www.googleapis.com/auth/indexing']
          );

          const result = await submitGoogleIndexing(urls, accessToken);

          const entry: IndexHistoryEntry = {
            timestamp: new Date().toISOString(),
            service: 'google',
            urlCount: result.urlCount,
            success: result.success,
            errors: result.errors,
          };

          results.push(entry);
          errors.push(...result.errors);

          // Save to history
          await appendHistory('index-history.json', entry);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          const errorMsg = `Google submission failed: ${message}`;
          errors.push(errorMsg);
          log.error(errorMsg);
        }
      } else {
        log.warn('Google Indexing API not configured, skipping');
      }
    }

    // Submit to Bing Webmaster if configured
    if (useBing) {
      if (config.apis.bing) {
        log.info('Submitting to Bing Webmaster API...');
        try {
          const result = await submitBingUrls(
            urls,
            config.apis.bing.apiKey,
            config.apis.bing.siteUrl
          );

          const entry: IndexHistoryEntry = {
            timestamp: new Date().toISOString(),
            service: 'bing',
            urlCount: result.urlCount,
            success: result.success,
            errors: result.errors,
          };

          results.push(entry);
          errors.push(...result.errors);

          // Save to history
          await appendHistory('index-history.json', entry);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          const errorMsg = `Bing submission failed: ${message}`;
          errors.push(errorMsg);
          log.error(errorMsg);
        }
      } else {
        log.warn('Bing Webmaster API not configured, skipping');
      }
    }

    // Print summary
    if (results.length > 0) {
      const headers = ['Service', 'URLs', 'Status'];
      const rows = results.map((r) => [
        r.service,
        r.urlCount.toString(),
        r.success ? 'Success' : 'Failed',
      ]);
      log.table(headers, rows);

      const allSuccessful = results.every((r) => r.success);
      if (allSuccessful) {
        log.success('All submissions completed successfully');
      } else {
        log.error('Some submissions failed:');
        errors.forEach((err) => log.error(`  ${err}`));
        process.exit(1);
      }
    } else {
      log.warn('No services configured or selected');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Index command failed: ${message}`);
    process.exit(1);
  }
}
