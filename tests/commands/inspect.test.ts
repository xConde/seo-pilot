import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runInspect } from '../../src/commands/inspect.js';

// Mock modules
vi.mock('../../src/config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../../src/utils/sitemap.js', () => ({
  fetchSitemapUrls: vi.fn(),
}));

vi.mock('../../src/auth/google.js', () => ({
  getGoogleAccessToken: vi.fn(),
}));

vi.mock('../../src/apis/google-inspection.js', () => ({
  inspectUrl: vi.fn(),
}));

vi.mock('../../src/state/history.js', () => ({
  appendHistory: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  log: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    table: vi.fn(),
  },
}));

import { loadConfig } from '../../src/config/loader.js';
import { fetchSitemapUrls } from '../../src/utils/sitemap.js';
import { getGoogleAccessToken } from '../../src/auth/google.js';
import { inspectUrl } from '../../src/apis/google-inspection.js';
import { appendHistory } from '../../src/state/history.js';
import { log } from '../../src/utils/logger.js';

describe('runInspect', () => {
  const mockConfig = {
    site: {
      url: 'https://example.com',
      sitemap: 'https://example.com/sitemap.xml',
    },
    apis: {
      google: {
        serviceAccountPath: '/path/to/service-account.json',
        siteUrl: 'https://example.com',
      },
    },
  };

  const mockUrls = [
    'https://example.com/page1',
    'https://example.com/page2',
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue(mockConfig as any);
    vi.mocked(fetchSitemapUrls).mockResolvedValue(mockUrls);
    vi.mocked(getGoogleAccessToken).mockResolvedValue('test-token');
    vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  it('should exit if Google is not configured', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      ...mockConfig,
      apis: {},
    } as any);

    await expect(runInspect({})).rejects.toThrow('process.exit(1)');

    expect(log.error).toHaveBeenCalledWith('Google Search Console is not configured');
    expect(log.info).toHaveBeenCalledWith('Run "seo-pilot setup" to configure Google integration');
  });

  it('should inspect a single URL when --url flag is provided', async () => {
    vi.mocked(inspectUrl).mockResolvedValue({
      url: 'https://example.com/test',
      verdict: 'PASS',
      lastCrawlTime: '2026-02-15T10:00:00Z',
      indexingState: 'INDEXING_ALLOWED',
      mobileUsability: 'MOBILE_FRIENDLY',
    });

    await runInspect({ url: 'https://example.com/test' });

    expect(fetchSitemapUrls).not.toHaveBeenCalled();
    expect(inspectUrl).toHaveBeenCalledTimes(1);
    expect(inspectUrl).toHaveBeenCalledWith(
      'https://example.com/test',
      'https://example.com',
      'test-token'
    );
  });

  it('should inspect all sitemap URLs when no --url flag', async () => {
    vi.mocked(inspectUrl).mockResolvedValue({
      url: 'https://example.com/page1',
      verdict: 'PASS',
      lastCrawlTime: '2026-02-15T10:00:00Z',
      indexingState: 'INDEXING_ALLOWED',
      mobileUsability: 'MOBILE_FRIENDLY',
    });

    await runInspect({});

    expect(fetchSitemapUrls).toHaveBeenCalledWith('https://example.com/sitemap.xml');
    expect(inspectUrl).toHaveBeenCalledTimes(2);
  });

  it('should display results table and save to history', async () => {
    const inspectionResults = [
      {
        url: 'https://example.com/page1',
        verdict: 'PASS',
        lastCrawlTime: '2026-02-15T10:00:00Z',
        indexingState: 'INDEXING_ALLOWED',
        mobileUsability: 'MOBILE_FRIENDLY',
      },
      {
        url: 'https://example.com/page2',
        verdict: 'NEUTRAL',
        lastCrawlTime: '2026-02-14T12:00:00Z',
        indexingState: 'INDEXING_ALLOWED',
        mobileUsability: 'MOBILE_FRIENDLY',
      },
    ];

    vi.mocked(inspectUrl).mockResolvedValueOnce(inspectionResults[0]);
    vi.mocked(inspectUrl).mockResolvedValueOnce(inspectionResults[1]);

    await runInspect({});

    expect(log.table).toHaveBeenCalledWith(
      ['URL', 'Verdict', 'Last Crawl', 'Indexing State', 'Mobile OK'],
      [
        [
          'https://example.com/page1',
          'PASS',
          '2026-02-15T10:00:00Z',
          'INDEXING_ALLOWED',
          'MOBILE_FRIENDLY',
        ],
        [
          'https://example.com/page2',
          'NEUTRAL',
          '2026-02-14T12:00:00Z',
          'INDEXING_ALLOWED',
          'MOBILE_FRIENDLY',
        ],
      ]
    );

    expect(appendHistory).toHaveBeenCalledWith(
      'inspect-history.json',
      expect.arrayContaining([
        expect.objectContaining({
          timestamp: expect.any(String),
          url: 'https://example.com/page1',
          verdict: 'PASS',
        }),
        expect.objectContaining({
          timestamp: expect.any(String),
          url: 'https://example.com/page2',
          verdict: 'NEUTRAL',
        }),
      ])
    );

    expect(log.success).toHaveBeenCalledWith(
      'Inspected 2 URLs and saved to .seo-pilot/inspect-history.json'
    );
  });

  it('should handle errors for individual URLs (partial failure)', async () => {
    vi.mocked(inspectUrl)
      .mockResolvedValueOnce({
        url: 'https://example.com/page1',
        verdict: 'PASS',
        lastCrawlTime: '2026-02-15T10:00:00Z',
        indexingState: 'INDEXING_ALLOWED',
        mobileUsability: 'MOBILE_FRIENDLY',
      })
      .mockRejectedValueOnce(new Error('API Error: 403 Forbidden'));

    await runInspect({});

    expect(log.error).toHaveBeenCalledWith(
      'Failed to inspect https://example.com/page2: API Error: 403 Forbidden'
    );
    expect(log.warn).toHaveBeenCalledWith('1 URLs failed inspection:');
  });

  it('should exit 1 when all URLs fail', async () => {
    vi.mocked(inspectUrl)
      .mockRejectedValueOnce(new Error('API Error: 403 Forbidden'))
      .mockRejectedValueOnce(new Error('API Error: 500 Server Error'));

    await expect(runInspect({})).rejects.toThrow('process.exit(1)');

    expect(log.error).toHaveBeenCalledWith('All 2 URLs failed inspection:');
  });

  it('should warn when no URLs to inspect', async () => {
    vi.mocked(fetchSitemapUrls).mockResolvedValue([]);

    await runInspect({});

    expect(log.warn).toHaveBeenCalledWith('No URLs to inspect');
    expect(inspectUrl).not.toHaveBeenCalled();
  });

  it('should respect custom config path', async () => {
    vi.mocked(inspectUrl).mockResolvedValue({
      url: 'https://example.com/page1',
      verdict: 'PASS',
      lastCrawlTime: '2026-02-15T10:00:00Z',
      indexingState: 'INDEXING_ALLOWED',
      mobileUsability: 'MOBILE_FRIENDLY',
    });

    await runInspect({ config: '/custom/config.json' });

    expect(loadConfig).toHaveBeenCalledWith('/custom/config.json');
  });

  it('should authenticate with correct scope', async () => {
    vi.mocked(inspectUrl).mockResolvedValue({
      url: 'https://example.com/page1',
      verdict: 'PASS',
      lastCrawlTime: '2026-02-15T10:00:00Z',
      indexingState: 'INDEXING_ALLOWED',
      mobileUsability: 'MOBILE_FRIENDLY',
    });

    await runInspect({});

    expect(getGoogleAccessToken).toHaveBeenCalledWith(
      '/path/to/service-account.json',
      ['https://www.googleapis.com/auth/webmasters']
    );
  });

  it('should handle config loading errors', async () => {
    vi.mocked(loadConfig).mockImplementation(() => {
      throw new Error('Config not found');
    });

    await expect(runInspect({})).rejects.toThrow('process.exit(1)');

    expect(log.error).toHaveBeenCalledWith('Inspect command failed: Config not found');
  });
});
