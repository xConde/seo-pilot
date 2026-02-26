import { loadConfig } from '../config/loader.js';
import { getGoogleAccessToken } from '../auth/google.js';
import { queryPerformance, type PerformanceRow } from '../apis/google-search-console.js';
import { appendHistory } from '../state/history.js';
import { log } from '../utils/logger.js';

interface RankHistoryEntry {
  timestamp: string;
  keyword: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  [key: string]: unknown;
}

export async function runRank(
  flags: Record<string, string | boolean>
): Promise<void> {
  try {
    // Load config
    const configPath =
      typeof flags.config === 'string' ? flags.config : undefined;
    const config = loadConfig(configPath);

    // Check if Google is configured
    if (!config.apis.google) {
      log.warn('Google is not configured — skipping rank');
      log.info('Run "seo-pilot setup" to configure Google integration');
      return;
    }

    // Get access token
    log.info('Authenticating with Google...');
    const accessToken = await getGoogleAccessToken(
      config.apis.google.serviceAccountPath,
      ['https://www.googleapis.com/auth/webmasters']
    );

    // Parse flags
    const days =
      typeof flags.days === 'string' ? parseInt(flags.days, 10) : 28;
    const keywordFilter =
      typeof flags.keyword === 'string' ? [flags.keyword] : undefined;

    // Use keywords from config if no filter specified
    const keywords =
      keywordFilter || (config.keywords.length > 0 ? config.keywords : undefined);

    log.info(
      `Querying Search Console performance for last ${days} days${
        keywords ? ` (filtering by ${keywords.length} keywords)` : ''
      }...`
    );

    // Query performance data
    const results = await queryPerformance(
      config.apis.google.siteUrl,
      accessToken,
      { days, keywords }
    );

    if (results.length === 0) {
      log.warn('No performance data found');
      return;
    }

    // Display results table
    const headers = [
      'Keyword',
      'Page',
      'Clicks',
      'Impressions',
      'Avg Position',
      'CTR',
    ];
    const rows = results.map((r) => [
      r.keyword,
      r.page,
      r.clicks.toString(),
      r.impressions.toString(),
      r.position.toFixed(1),
      (r.ctr * 100).toFixed(2) + '%',
    ]);
    log.table(headers, rows);

    // Save to history
    const historyEntries: RankHistoryEntry[] = results.map((r) => ({
      timestamp: new Date().toISOString(),
      keyword: r.keyword,
      page: r.page,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));

    await appendHistory('rank-history.json', historyEntries);
    log.success(
      `Retrieved ${results.length} performance rows and saved to .seo-pilot/rank-history.json`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Rank command failed: ${message}`);
    process.exit(1);
  }
}
