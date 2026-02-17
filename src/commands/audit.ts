import { loadConfig } from '../config/loader.js';
import { fetchSitemapUrls } from '../utils/sitemap.js';
import { appendHistory } from '../state/history.js';
import { log } from '../utils/logger.js';
import * as cheerio from 'cheerio';

interface AuditResult {
  url: string;
  checks: {
    meta?: CheckResult;
    schema?: CheckResult;
    links?: CheckResult;
    sitemap?: CheckResult;
  };
}

interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  messages: string[];
}

interface AuditHistoryEntry {
  timestamp: string;
  url: string;
  results: AuditResult['checks'];
  [key: string]: unknown;
}

async function auditMetaTags(html: string): Promise<CheckResult> {
  const $ = cheerio.load(html);
  const messages: string[] = [];
  let hasFail = false;
  let hasWarn = false;

  // Title check
  const title = $('title').text();
  if (!title) {
    messages.push('Missing <title> tag');
    hasFail = true;
  } else if (title.length < 50 || title.length > 60) {
    messages.push(`Title length ${title.length} chars (ideal: 50-60)`);
    hasWarn = true;
  } else {
    messages.push('Title length optimal');
  }

  // Description check
  const description = $('meta[name="description"]').attr('content');
  if (!description) {
    messages.push('Missing meta description');
    hasFail = true;
  } else if (description.length < 120 || description.length > 160) {
    messages.push(`Description length ${description.length} chars (ideal: 120-160)`);
    hasWarn = true;
  } else {
    messages.push('Description length optimal');
  }

  // OG tags check
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDescription = $('meta[property="og:description"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');

  if (!ogTitle) {
    messages.push('Missing og:title');
    hasWarn = true;
  }
  if (!ogDescription) {
    messages.push('Missing og:description');
    hasWarn = true;
  }
  if (!ogImage) {
    messages.push('Missing og:image');
    hasWarn = true;
  }

  const status = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';
  return { status, messages };
}

async function auditSchema(html: string): Promise<CheckResult> {
  const $ = cheerio.load(html);
  const messages: string[] = [];
  let status: 'pass' | 'warn' | 'fail' = 'pass';

  const schemas = $('script[type="application/ld+json"]');

  if (schemas.length === 0) {
    messages.push('No structured data found');
    return { status: 'warn', messages };
  }

  schemas.each((i, elem) => {
    const content = $(elem).html();
    if (content) {
      try {
        const data = JSON.parse(content);
        if (data['@type']) {
          messages.push(`Found schema: ${data['@type']}`);
        } else {
          messages.push('Schema missing @type property');
          status = 'warn';
        }
      } catch {
        messages.push('Invalid JSON in structured data');
        status = 'warn';
      }
    }
  });

  return { status, messages };
}

async function auditLinks(html: string, baseUrl: string): Promise<CheckResult> {
  const $ = cheerio.load(html);
  const messages: string[] = [];
  let status: 'pass' | 'warn' | 'fail' = 'pass';

  const baseDomain = new URL(baseUrl).hostname;
  const links = $('a[href]');

  let internalCount = 0;
  links.each((i, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      try {
        const url = new URL(href, baseUrl);
        if (url.hostname === baseDomain) {
          internalCount++;
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });

  messages.push(`Found ${internalCount} internal links`);
  if (internalCount < 3) {
    messages.push('Fewer than 3 internal links detected');
    status = 'warn';
  }

  return { status, messages };
}

async function auditSitemap(sitemapUrl: string): Promise<CheckResult> {
  const messages: string[] = [];
  let status: 'pass' | 'warn' | 'fail' = 'pass';

  try {
    const response = await fetch(sitemapUrl);
    if (!response.ok) {
      messages.push(`Sitemap HTTP ${response.status}`);
      return { status: 'fail', messages };
    }

    const text = await response.text();

    // Check if well-formed XML (supports both urlset and sitemapindex)
    if (!text.includes('<?xml') || (!text.includes('</urlset>') && !text.includes('</sitemapindex>'))) {
      messages.push('Sitemap is not well-formed XML');
      status = 'warn';
    } else {
      messages.push('Sitemap is well-formed');
    }

    // Extract URLs from the fetched text (avoid re-fetching)
    const urlRegex = /<loc>(.*?)<\/loc>/g;
    const urls = Array.from(text.matchAll(urlRegex))
      .map((match) => match[1])
      .filter((url): url is string => !!url);
    messages.push(`Sitemap contains ${urls.length} URLs`);

    // Sample up to 10 URLs to check they return 200
    const samplesToCheck = urls.slice(0, Math.min(10, urls.length));
    let validCount = 0;

    for (const url of samplesToCheck) {
      try {
        const urlResponse = await fetch(url, { method: 'HEAD' });
        if (urlResponse.ok) {
          validCount++;
        }
      } catch {
        // Ignore errors, just count failures
      }
    }

    messages.push(`${validCount}/${samplesToCheck.length} sampled URLs returned 200`);
    if (validCount < samplesToCheck.length) {
      status = 'warn';
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    messages.push(`Sitemap check failed: ${message}`);
    status = 'fail';
  }

  return { status, messages };
}

export async function runAudit(
  flags: Record<string, string | boolean>
): Promise<void> {
  try {
    // Load config
    const configPath =
      typeof flags.config === 'string' ? flags.config : undefined;
    const config = loadConfig(configPath);

    // Get URLs to audit
    let urls: string[];
    if (typeof flags.url === 'string') {
      urls = [flags.url];
    } else {
      log.info('Fetching URLs from sitemap...');
      urls = await fetchSitemapUrls(config.site.sitemap);
      log.info(`Found ${urls.length} URLs in sitemap`);
    }

    // Parse checks flag
    const checksFlag = typeof flags.checks === 'string' ? flags.checks : 'all';
    let checksToRun = checksFlag === 'all'
      ? ['meta', 'schema', 'links', 'sitemap']
      : checksFlag.split(',').map((c) => c.trim());

    // Don't run sitemap check if single URL provided (unless explicitly requested)
    const singleUrlMode = typeof flags.url === 'string';
    if (singleUrlMode && checksFlag === 'all') {
      checksToRun = checksToRun.filter((c) => c !== 'sitemap');
    }

    const results: AuditResult[] = [];
    const historyEntries: AuditHistoryEntry[] = [];

    // Run sitemap check once (not per URL)
    let sitemapResult: CheckResult | undefined;
    if (checksToRun.includes('sitemap')) {
      log.info('Auditing sitemap...');
      sitemapResult = await auditSitemap(config.site.sitemap);
    }

    // Audit each URL
    for (const url of urls) {
      log.info(`Auditing ${url}...`);

      const auditResult: AuditResult = {
        url,
        checks: {},
      };

      try {
        const response = await fetch(url);
        if (!response.ok) {
          log.warn(`  HTTP ${response.status} - skipping checks`);
          continue;
        }

        const html = await response.text();

        // Run selected checks
        if (checksToRun.includes('meta')) {
          auditResult.checks.meta = await auditMetaTags(html);
        }

        if (checksToRun.includes('schema')) {
          auditResult.checks.schema = await auditSchema(html);
        }

        if (checksToRun.includes('links')) {
          auditResult.checks.links = await auditLinks(html, url);
        }

        // Sitemap check is shared across all URLs
        if (sitemapResult && checksToRun.includes('sitemap')) {
          auditResult.checks.sitemap = sitemapResult;
        }

        results.push(auditResult);

        // Add to history
        historyEntries.push({
          timestamp: new Date().toISOString(),
          url,
          results: auditResult.checks,
        });

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.error(`  Failed to audit: ${message}`);
      }
    }

    // Output report
    log.info('\nAudit Report:');
    for (const result of results) {
      console.log(`\n${result.url}`);

      for (const [checkName, checkResult] of Object.entries(result.checks)) {
        if (checkResult) {
          const icon = checkResult.status === 'pass' ? '✓' : checkResult.status === 'warn' ? '⚠' : '✗';
          console.log(`  ${icon} ${checkName}:`);
          checkResult.messages.forEach((msg) => console.log(`    - ${msg}`));
        }
      }
    }

    // Summary
    const totalChecks = results.reduce((sum, r) => sum + Object.keys(r.checks).length, 0);
    const passCount = results.reduce(
      (sum, r) => sum + Object.values(r.checks).filter((c) => c?.status === 'pass').length,
      0
    );
    const warnCount = results.reduce(
      (sum, r) => sum + Object.values(r.checks).filter((c) => c?.status === 'warn').length,
      0
    );
    const failCount = results.reduce(
      (sum, r) => sum + Object.values(r.checks).filter((c) => c?.status === 'fail').length,
      0
    );

    console.log('\nSummary:');
    const headers = ['Status', 'Count'];
    const rows = [
      ['Pass', passCount.toString()],
      ['Warn', warnCount.toString()],
      ['Fail', failCount.toString()],
      ['Total', totalChecks.toString()],
    ];
    log.table(headers, rows);

    // Save to history
    if (historyEntries.length > 0) {
      await appendHistory('audit-history.json', historyEntries);
      log.success('Audit results saved to history');
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Audit command failed: ${message}`);
    process.exit(1);
  }
}
