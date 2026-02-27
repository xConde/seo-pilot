import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runRank } from '../../src/commands/rank.js';

// Mock modules
vi.mock('../../src/config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../../src/auth/google.js', () => ({
  getGoogleAccessToken: vi.fn(),
}));

vi.mock('../../src/apis/google-search-console.js', () => ({
  queryPerformance: vi.fn(),
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
import { getGoogleAccessToken } from '../../src/auth/google.js';
import { queryPerformance } from '../../src/apis/google-search-console.js';
import { appendHistory } from '../../src/state/history.js';
import { log } from '../../src/utils/logger.js';

describe('runRank', () => {
  const mockConfig = {
    site: {
      url: 'https://example.com',
      sitemap: 'https://example.com/sitemap.xml',
    },
    keywords: ['typescript tutorial', 'node.js guide'],
    apis: {
      google: {
        serviceAccountPath: '/path/to/service-account.json',
        siteUrl: 'https://example.com',
      },
    },
  };

  const mockPerformanceData = [
    {
      keyword: 'typescript tutorial',
      page: 'https://example.com/ts',
      clicks: 100,
      impressions: 2000,
      ctr: 0.05,
      position: 5.2,
    },
    {
      keyword: 'node.js guide',
      page: 'https://example.com/node',
      clicks: 50,
      impressions: 1000,
      ctr: 0.05,
      position: 8.5,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue(mockConfig as any);
    vi.mocked(getGoogleAccessToken).mockResolvedValue('test-token');
    vi.mocked(queryPerformance).mockResolvedValue(mockPerformanceData);
    vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  it('should warn and return if Google is not configured', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      ...mockConfig,
      apis: {},
    } as any);

    await expect(runRank({})).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledWith('Google is not configured — skipping rank');
    expect(log.info).toHaveBeenCalledWith('Run "seo-pilot setup" to configure Google integration');
    expect(getGoogleAccessToken).not.toHaveBeenCalled();
  });

  it('should query performance data with default 28 days', async () => {
    await runRank({});

    expect(queryPerformance).toHaveBeenCalledWith(
      'https://example.com',
      'test-token',
      {
        days: 28,
        keywords: ['typescript tutorial', 'node.js guide'],
      }
    );
  });

  it('should query performance data with custom days flag', async () => {
    await runRank({ days: '7' });

    expect(queryPerformance).toHaveBeenCalledWith(
      'https://example.com',
      'test-token',
      {
        days: 7,
        keywords: ['typescript tutorial', 'node.js guide'],
      }
    );
  });

  it('should filter by single keyword when --keyword flag is provided', async () => {
    await runRank({ keyword: 'typescript tutorial' });

    expect(queryPerformance).toHaveBeenCalledWith(
      'https://example.com',
      'test-token',
      {
        days: 28,
        keywords: ['typescript tutorial'],
      }
    );
  });

  it('should query all keywords when no keywords in config', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      ...mockConfig,
      keywords: [],
    } as any);

    await runRank({});

    expect(queryPerformance).toHaveBeenCalledWith(
      'https://example.com',
      'test-token',
      {
        days: 28,
        keywords: undefined,
      }
    );
  });

  it('should display results table and save to history', async () => {
    await runRank({});

    expect(log.table).toHaveBeenCalledWith(
      ['Keyword', 'Page', 'Clicks', 'Impressions', 'Avg Position', 'CTR'],
      [
        ['typescript tutorial', 'https://example.com/ts', '100', '2000', '5.2', '5.00%'],
        ['node.js guide', 'https://example.com/node', '50', '1000', '8.5', '5.00%'],
      ]
    );

    expect(appendHistory).toHaveBeenCalledWith(
      'rank-history.json',
      expect.arrayContaining([
        expect.objectContaining({
          timestamp: expect.any(String),
          keyword: 'typescript tutorial',
          page: 'https://example.com/ts',
          clicks: 100,
          impressions: 2000,
          ctr: 0.05,
          position: 5.2,
        }),
        expect.objectContaining({
          timestamp: expect.any(String),
          keyword: 'node.js guide',
          page: 'https://example.com/node',
          clicks: 50,
          impressions: 1000,
          ctr: 0.05,
          position: 8.5,
        }),
      ])
    );

    expect(log.success).toHaveBeenCalledWith(
      'Retrieved 2 performance rows and saved to .seo-pilot/rank-history.json'
    );
  });

  it('should warn when no performance data found', async () => {
    vi.mocked(queryPerformance).mockResolvedValue([]);

    await runRank({});

    expect(log.warn).toHaveBeenCalledWith('No performance data found');
    expect(appendHistory).not.toHaveBeenCalled();
  });

  it('should respect custom config path', async () => {
    await runRank({ config: '/custom/config.json' });

    expect(loadConfig).toHaveBeenCalledWith('/custom/config.json');
  });

  it('should authenticate with correct scope', async () => {
    await runRank({});

    expect(getGoogleAccessToken).toHaveBeenCalledWith(
      '/path/to/service-account.json',
      ['https://www.googleapis.com/auth/webmasters']
    );
  });

  it('should handle config loading errors', async () => {
    vi.mocked(loadConfig).mockImplementation(() => {
      throw new Error('Config not found');
    });

    await expect(runRank({})).rejects.toThrow('process.exit(1)');

    expect(log.error).toHaveBeenCalledWith('Rank command failed: Config not found');
  });

  it('should handle API query errors', async () => {
    vi.mocked(queryPerformance).mockRejectedValue(new Error('API Error: 403 Forbidden'));

    await expect(runRank({})).rejects.toThrow('process.exit(1)');

    expect(log.error).toHaveBeenCalledWith('Rank command failed: API Error: 403 Forbidden');
  });

  it('should format CTR as percentage in table', async () => {
    vi.mocked(queryPerformance).mockResolvedValue([
      {
        keyword: 'test',
        page: 'https://example.com/test',
        clicks: 10,
        impressions: 1000,
        ctr: 0.01234,
        position: 10.5,
      },
    ]);

    await runRank({});

    expect(log.table).toHaveBeenCalledWith(
      expect.any(Array),
      [['test', 'https://example.com/test', '10', '1000', '10.5', '1.23%']]
    );
  });
});
