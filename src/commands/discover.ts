import { loadConfig } from '../config/loader.js';
import { customSearch, type SearchResult } from '../apis/google-custom-search.js';
import { appendHistory, readHistory } from '../state/history.js';
import { log } from '../utils/logger.js';

interface DiscoverHistoryEntry {
  timestamp: string;
  url: string;
  keyword?: string;
  type: 'forum' | 'directory';
}

const DIRECTORY_QUERIES = [
  '"military family resources" + "submit" OR "add your site"',
  '"Air Force" "graduation" "resources" "links"',
  '"military spouse" "directory" OR "resource list"',
  '"JBSA" OR "Lackland" "resources" "links"',
  '"best military family websites"',
  '"BMT graduation" "helpful links" OR "useful resources"',
];

async function getDedupedUrls(cutoffDays: number): Promise<Set<string>> {
  const history = await readHistory<DiscoverHistoryEntry>('discover-history.json');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - cutoffDays);

  const seenUrls = new Set<string>();
  history.forEach((entry) => {
    const entryDate = new Date(entry.timestamp);
    if (entryDate >= cutoff) {
      seenUrls.add(entry.url);
    }
  });

  return seenUrls;
}

export async function runDiscover(
  flags: Record<string, string | boolean>
): Promise<void> {
  try {
    // Load config
    const configPath =
      typeof flags.config === 'string' ? flags.config : undefined;
    const config = loadConfig(configPath);

    // Check customSearch config
    if (!config.apis.customSearch) {
      log.error('Google Custom Search API not configured');
      log.info('Run "seo-pilot setup" to configure Custom Search API');
      process.exit(1);
    }

    const { apiKey, engineId } = config.apis.customSearch;
    const resultsPerKeyword = config.discover.resultsPerKeyword ?? 5;

    // Get deduplication set
    const seenUrls = await getDedupedUrls(30);

    // Determine type
    const type =
      typeof flags.type === 'string' ? flags.type : 'forums';

    // Get keyword filter if provided
    const keywordFilter =
      typeof flags.keyword === 'string' ? flags.keyword : undefined;

    let totalCalls = 0;
    const quota = 100;
    const newEntries: DiscoverHistoryEntry[] = [];

    // Forums mode
    if (type === 'forums' || type === 'all') {
      log.info('Running discovery for forums...');

      const keywords = keywordFilter
        ? config.keywords.filter((k) => k === keywordFilter)
        : config.keywords;

      if (keywords.length === 0 && keywordFilter) {
        log.warn(`Keyword "${keywordFilter}" not found in config`);
        return;
      }

      const resultsByKeyword = new Map<string, SearchResult[]>();

      forumSearch: for (const keyword of keywords) {
        resultsByKeyword.set(keyword, []);

        for (const site of config.discover.sites) {
          if (totalCalls >= quota) {
            log.warn(`Approaching Custom Search quota (${quota}/day) - stopping`);
            break forumSearch;
          }

          const query = `site:${site} "${keyword}"`;
          log.info(`Searching: ${query}`);

          const results = await customSearch(
            query,
            apiKey,
            engineId,
            { num: resultsPerKeyword }
          );

          totalCalls++;

          // Filter out seen URLs
          const newResults = results.filter((r) => !seenUrls.has(r.url));

          // Add to results
          resultsByKeyword.get(keyword)!.push(...newResults);

          // Track new URLs
          newResults.forEach((r) => {
            seenUrls.add(r.url);
            newEntries.push({
              timestamp: new Date().toISOString(),
              url: r.url,
              keyword,
              type: 'forum',
            });
          });
        }
      }

      // Output forums results
      if (resultsByKeyword.size > 0) {
        log.info('\nForum Discovery Results:');
        for (const [keyword, results] of resultsByKeyword) {
          if (results.length > 0) {
            console.log(`\n${keyword}:`);
            const headers = ['URL', 'Title', 'Snippet'];
            const rows = results.map((r) => [
              r.url,
              r.title,
              r.snippet.substring(0, 80) + (r.snippet.length > 80 ? '...' : ''),
            ]);
            log.table(headers, rows);
          }
        }
      } else {
        log.info('No new forum results found');
      }
    }

    // Directories mode
    if (type === 'directories' || type === 'all') {
      if (type === 'all') {
        console.log('\n');
      }
      log.info('Running discovery for directories...');

      const directoryResults: Array<SearchResult & { type: string }> = [];

      for (const query of DIRECTORY_QUERIES) {
        if (totalCalls >= quota) {
          log.warn(`Approaching Custom Search quota (${quota}/day) - stopping`);
          break;
        }

        log.info(`Searching: ${query}`);

        const results = await customSearch(
          query,
          apiKey,
          engineId,
          { num: resultsPerKeyword }
        );

        totalCalls++;

        // Filter out seen URLs and categorize
        const newResults = results.filter((r) => !seenUrls.has(r.url));

        newResults.forEach((r) => {
          // Categorize based on content
          let resultType = 'directory';
          if (r.title.toLowerCase().includes('resource') || r.snippet.toLowerCase().includes('resource')) {
            resultType = 'resource-list';
          }
          if (r.title.toLowerCase().includes('best') || r.snippet.toLowerCase().includes('roundup')) {
            resultType = 'roundup';
          }

          directoryResults.push({ ...r, type: resultType });
          seenUrls.add(r.url);
          newEntries.push({
            timestamp: new Date().toISOString(),
            url: r.url,
            type: 'directory',
          });
        });
      }

      // Output directory results
      if (directoryResults.length > 0) {
        log.info('\nDirectory Discovery Results:');
        const headers = ['URL', 'Title', 'Snippet', 'Type'];
        const rows = directoryResults.map((r) => [
          r.url,
          r.title,
          r.snippet.substring(0, 60) + (r.snippet.length > 60 ? '...' : ''),
          r.type,
        ]);
        log.table(headers, rows);
      } else {
        log.info('No new directory results found');
      }
    }

    // Save to history
    if (newEntries.length > 0) {
      await appendHistory('discover-history.json', newEntries);
      log.success(`Saved ${newEntries.length} new results to history`);
    }

    // Summary
    log.info(`\nTotal API calls: ${totalCalls}/${quota}`);
    if (totalCalls >= quota * 0.9) {
      log.warn('You are approaching the daily quota limit');
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Discover command failed: ${message}`);
    process.exit(1);
  }
}
