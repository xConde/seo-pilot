import { loadConfig } from '../config/loader.js';
import { fetchSitemapUrls } from '../utils/sitemap.js';
import { submitIndexNow } from '../apis/indexnow.js';
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

    // Print summary
    if (results.length > 0) {
      log.table(
        results.map((r) => ({
          Service: r.service,
          URLs: r.urlCount,
          Status: r.success ? 'Success' : 'Failed',
        }))
      );

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
