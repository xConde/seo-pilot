import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAudit } from '../../src/commands/audit.js';
import * as configLoader from '../../src/config/loader.js';
import * as sitemap from '../../src/utils/sitemap.js';
import * as history from '../../src/state/history.js';

vi.mock('../../src/config/loader.js');
vi.mock('../../src/utils/sitemap.js');
vi.mock('../../src/state/history.js');

describe('audit command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  it('should audit a single URL when --url flag provided', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Page - Example Site</title>
          <meta name="description" content="This is a test description for the page that is within the ideal length range of 120 to 160 characters total.">
          <meta property="og:title" content="Test Page">
          <meta property="og:description" content="Test description">
          <meta property="og:image" content="https://example.com/image.jpg">
          <script type="application/ld+json">
            {"@type": "WebPage", "name": "Test"}
          </script>
        </head>
        <body>
          <a href="https://example.com/page1">Link 1</a>
          <a href="https://example.com/page2">Link 2</a>
          <a href="https://example.com/page3">Link 3</a>
        </body>
      </html>
    `;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => htmlContent,
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ url: 'https://example.com/test' });

    expect(sitemap.fetchSitemapUrls).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/test');
    expect(history.appendHistory).toHaveBeenCalledWith(
      'audit-history.json',
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://example.com/test',
        }),
      ])
    );
  });

  it('should audit all sitemap URLs when no --url flag', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    vi.mocked(sitemap.fetchSitemapUrls).mockResolvedValue([
      'https://example.com/page1',
      'https://example.com/page2',
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><head><title>Test</title></head></html>',
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({});

    expect(sitemap.fetchSitemapUrls).toHaveBeenCalledWith('https://example.com/sitemap.xml');
  });

  it('should detect missing title tag', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    const htmlContent = '<html><head></head><body>No title</body></html>';

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => htmlContent,
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ url: 'https://example.com/test', checks: 'meta' });

    const savedEntries = vi.mocked(history.appendHistory).mock.calls[0][1];
    const entries = Array.isArray(savedEntries) ? savedEntries : [savedEntries];
    expect(entries[0].results.meta?.status).toBe('fail');
    expect(entries[0].results.meta?.messages).toContain('Missing <title> tag');
  });

  it('should warn on suboptimal title length', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    const htmlContent = `
      <html>
        <head>
          <title>Short</title>
          <meta name="description" content="This is a test description that is within the ideal length range of 120 to 160 characters for meta descriptions.">
        </head>
        <body></body>
      </html>
    `;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => htmlContent,
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ url: 'https://example.com/test', checks: 'meta' });

    const savedEntries = vi.mocked(history.appendHistory).mock.calls[0][1];
    const entries = Array.isArray(savedEntries) ? savedEntries : [savedEntries];
    expect(entries[0].results.meta?.status).toBe('warn');
    expect(entries[0].results.meta?.messages.some((m: string) => m.includes('Title length'))).toBe(true);
  });

  it('should detect missing meta description', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    const htmlContent = `
      <html>
        <head>
          <title>This is a test page title that is about 55 chars long</title>
        </head>
        <body></body>
      </html>
    `;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => htmlContent,
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ url: 'https://example.com/test', checks: 'meta' });

    const savedEntries = vi.mocked(history.appendHistory).mock.calls[0][1];
    const entries = Array.isArray(savedEntries) ? savedEntries : [savedEntries];
    expect(entries[0].results.meta?.status).toBe('fail');
    expect(entries[0].results.meta?.messages).toContain('Missing meta description');
  });

  it('should detect missing OG tags', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    const htmlContent = `
      <html>
        <head>
          <title>This is a test page title that is about 55 chars long</title>
          <meta name="description" content="This is a test description that is within the ideal length range of 120 to 160 characters for meta descriptions.">
        </head>
        <body></body>
      </html>
    `;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => htmlContent,
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ url: 'https://example.com/test', checks: 'meta' });

    const savedEntries = vi.mocked(history.appendHistory).mock.calls[0][1];
    const entries = Array.isArray(savedEntries) ? savedEntries : [savedEntries];
    expect(entries[0].results.meta?.status).toBe('warn');
    expect(entries[0].results.meta?.messages).toContain('Missing og:title');
    expect(entries[0].results.meta?.messages).toContain('Missing og:description');
    expect(entries[0].results.meta?.messages).toContain('Missing og:image');
  });

  it('should detect structured data schema', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    const htmlContent = `
      <html>
        <head>
          <script type="application/ld+json">
            {"@type": "Article", "headline": "Test Article"}
          </script>
        </head>
        <body></body>
      </html>
    `;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => htmlContent,
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ url: 'https://example.com/test', checks: 'schema' });

    const savedEntries = vi.mocked(history.appendHistory).mock.calls[0][1];
    const entries = Array.isArray(savedEntries) ? savedEntries : [savedEntries];
    expect(entries[0].results.schema?.status).toBe('pass');
    expect(entries[0].results.schema?.messages).toContain('Found schema: Article');
  });

  it('should warn on missing structured data', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    const htmlContent = '<html><head></head><body></body></html>';

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => htmlContent,
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ url: 'https://example.com/test', checks: 'schema' });

    const savedEntries = vi.mocked(history.appendHistory).mock.calls[0][1];
    const entries = Array.isArray(savedEntries) ? savedEntries : [savedEntries];
    expect(entries[0].results.schema?.status).toBe('warn');
    expect(entries[0].results.schema?.messages).toContain('No structured data found');
  });

  it('should count internal links', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    const htmlContent = `
      <html>
        <body>
          <a href="https://example.com/page1">Link 1</a>
          <a href="https://example.com/page2">Link 2</a>
          <a href="https://example.com/page3">Link 3</a>
          <a href="https://external.com/page">External</a>
        </body>
      </html>
    `;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => htmlContent,
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ url: 'https://example.com/test', checks: 'links' });

    const savedEntries = vi.mocked(history.appendHistory).mock.calls[0][1];
    const entries = Array.isArray(savedEntries) ? savedEntries : [savedEntries];
    expect(entries[0].results.links?.status).toBe('pass');
    expect(entries[0].results.links?.messages).toContain('Found 3 internal links');
  });

  it('should warn on few internal links', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    const htmlContent = `
      <html>
        <body>
          <a href="https://example.com/page1">Link 1</a>
        </body>
      </html>
    `;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => htmlContent,
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ url: 'https://example.com/test', checks: 'links' });

    const savedEntries = vi.mocked(history.appendHistory).mock.calls[0][1];
    const entries = Array.isArray(savedEntries) ? savedEntries : [savedEntries];
    expect(entries[0].results.links?.status).toBe('warn');
    expect(entries[0].results.links?.messages).toContain('Fewer than 3 internal links detected');
  });

  it('should validate sitemap', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/page1</loc></url>
      </urlset>`;

    vi.mocked(sitemap.fetchSitemapUrls).mockResolvedValue(['https://example.com/page1']);

    let fetchCallCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url) => {
      fetchCallCount++;
      if (url === 'https://example.com/sitemap.xml') {
        return {
          ok: true,
          text: async () => sitemapXml,
        };
      }
      // URL from sitemap
      return { ok: true, text: async () => '<html></html>' };
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ url: 'https://example.com/page1', checks: 'sitemap' });

    const savedEntries = vi.mocked(history.appendHistory).mock.calls[0][1];
    const entries = Array.isArray(savedEntries) ? savedEntries : [savedEntries];
    expect(entries[0].results.sitemap?.status).toBe('pass');
    expect(entries[0].results.sitemap?.messages.some((m: string) => m.includes('well-formed'))).toBe(true);
  });

  it('should run only specified checks', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    const htmlContent = `
      <html>
        <head>
          <title>Test Page Title That Is Within Ideal Range For SEO</title>
        </head>
        <body></body>
      </html>
    `;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => htmlContent,
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ url: 'https://example.com/test', checks: 'meta,schema' });

    const savedEntries = vi.mocked(history.appendHistory).mock.calls[0][1];
    const entries = Array.isArray(savedEntries) ? savedEntries : [savedEntries];
    expect(entries[0].results.meta).toBeDefined();
    expect(entries[0].results.schema).toBeDefined();
    expect(entries[0].results.links).toBeUndefined();
    expect(entries[0].results.sitemap).toBeUndefined();
  });

  it('should override site URL and derive sitemap when --base-url flag provided', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    const htmlContent = '<html><head><title>Test</title></head></html>';

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => htmlContent,
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ url: 'https://staging.example.com/test', 'base-url': 'https://staging.example.com' });

    // sitemap should have been derived from base-url
    expect(sitemap.fetchSitemapUrls).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith('https://staging.example.com/test');
  });

  it('should override sitemap URL when --sitemap flag provided', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    vi.mocked(sitemap.fetchSitemapUrls).mockResolvedValue(['https://example.com/page1']);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><head><title>Test</title></head></html>',
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ sitemap: 'https://example.com/custom-sitemap.xml' });

    expect(sitemap.fetchSitemapUrls).toHaveBeenCalledWith('https://example.com/custom-sitemap.xml');
  });

  it('should not override sitemap when --base-url and --sitemap are both provided', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    vi.mocked(sitemap.fetchSitemapUrls).mockResolvedValue(['https://staging.example.com/page1']);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><head><title>Test</title></head></html>',
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ 'base-url': 'https://staging.example.com', sitemap: 'https://staging.example.com/custom-sitemap.xml' });

    // explicit --sitemap should win over derived sitemap
    expect(sitemap.fetchSitemapUrls).toHaveBeenCalledWith('https://staging.example.com/custom-sitemap.xml');
  });

  it('should reject invalid --base-url (non-HTTP protocol)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    await runAudit({ 'base-url': 'file:///etc/passwd' });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid --base-url')
    );
    expect(sitemap.fetchSitemapUrls).not.toHaveBeenCalled();
  });

  it('should reject invalid --base-url (not a URL)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    await runAudit({ 'base-url': 'not-a-url' });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid --base-url')
    );
    expect(sitemap.fetchSitemapUrls).not.toHaveBeenCalled();
  });

  it('should reject invalid --sitemap URL', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    await runAudit({ sitemap: 'ftp://example.com/sitemap.xml' });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid --sitemap')
    );
    expect(sitemap.fetchSitemapUrls).not.toHaveBeenCalled();
  });

  it('should detect sitemap index and not check child sitemap URLs', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {},
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap-posts.xml</loc></sitemap>
        <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
        <sitemap><loc>https://example.com/sitemap-categories.xml</loc></sitemap>
      </sitemapindex>`;

    vi.mocked(sitemap.fetchSitemapUrls).mockResolvedValue(['https://example.com/page1']);

    const fetchCalls: string[] = [];
    global.fetch = vi.fn().mockImplementation(async (url) => {
      fetchCalls.push(url as string);
      if (url === 'https://example.com/sitemap.xml') {
        return {
          ok: true,
          text: async () => sitemapIndexXml,
        };
      }
      // Page URL from sitemap
      return { ok: true, text: async () => '<html></html>' };
    });

    vi.mocked(history.appendHistory).mockResolvedValue();

    await runAudit({ url: 'https://example.com/page1', checks: 'sitemap' });

    const savedEntries = vi.mocked(history.appendHistory).mock.calls[0][1];
    const entries = Array.isArray(savedEntries) ? savedEntries : [savedEntries];

    // Should report child sitemaps, not URLs
    expect(entries[0].results.sitemap?.messages.some((m: string) => m.includes('child sitemaps'))).toBe(true);
    expect(entries[0].results.sitemap?.messages.some((m: string) => m.includes('3 child sitemaps'))).toBe(true);

    // Should NOT attempt to HEAD check child sitemap URLs
    expect(fetchCalls.filter((url) => url.includes('sitemap-')).length).toBe(0);

    // Should NOT have sampling message
    expect(entries[0].results.sitemap?.messages.some((m: string) => m.includes('sampled URLs'))).toBe(false);
  });
});
