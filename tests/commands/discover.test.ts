import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDiscover } from '../../src/commands/discover.js';
import * as configLoader from '../../src/config/loader.js';
import * as customSearchApi from '../../src/apis/google-custom-search.js';
import * as history from '../../src/state/history.js';

vi.mock('../../src/config/loader.js');
vi.mock('../../src/apis/google-custom-search.js');
vi.mock('../../src/state/history.js');

// Test the buildDirectoryQueries function by importing and testing it
// Since it's not exported, we'll test it indirectly through the discover command

describe('discover command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  it('should warn and return if customSearch not configured', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: ['test'],
      apis: {},
      discover: { sites: ['reddit.com'], resultsPerKeyword: 5 },
    });

    await expect(runDiscover({})).resolves.toBeUndefined();

    expect(customSearchApi.customSearch).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Google Custom Search API not configured — skipping discover')
    );
  });

  it('should run forums mode by default', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: ['test keyword'],
      apis: {
        customSearch: { apiKey: 'test-key', engineId: 'test-engine' },
      },
      discover: { sites: ['reddit.com'], resultsPerKeyword: 5 },
    });

    vi.mocked(history.readHistory).mockResolvedValue([]);
    vi.mocked(history.appendHistory).mockResolvedValue();

    vi.mocked(customSearchApi.customSearch).mockResolvedValue([
      {
        url: 'https://reddit.com/r/military/post1',
        title: 'Test Post',
        snippet: 'Test snippet',
      },
    ]);

    await runDiscover({});

    expect(customSearchApi.customSearch).toHaveBeenCalledWith(
      'site:reddit.com "test keyword"',
      'test-key',
      'test-engine',
      { num: 5 }
    );

    expect(history.appendHistory).toHaveBeenCalledWith(
      'discover-history.json',
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://reddit.com/r/military/post1',
          keyword: 'test keyword',
          type: 'forum',
        }),
      ])
    );
  });

  it('should filter by keyword flag', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: ['test keyword', 'another keyword'],
      apis: {
        customSearch: { apiKey: 'test-key', engineId: 'test-engine' },
      },
      discover: { sites: ['reddit.com'], resultsPerKeyword: 5 },
    });

    vi.mocked(history.readHistory).mockResolvedValue([]);
    vi.mocked(history.appendHistory).mockResolvedValue();
    vi.mocked(customSearchApi.customSearch).mockResolvedValue([]);

    await runDiscover({ keyword: 'another keyword' });

    expect(customSearchApi.customSearch).toHaveBeenCalledTimes(1);
    expect(customSearchApi.customSearch).toHaveBeenCalledWith(
      'site:reddit.com "another keyword"',
      'test-key',
      'test-engine',
      { num: 5 }
    );
  });

  it('should deduplicate results from history', async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 15);

    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: ['test'],
      apis: {
        customSearch: { apiKey: 'test-key', engineId: 'test-engine' },
      },
      discover: { sites: ['reddit.com'], resultsPerKeyword: 5 },
    });

    vi.mocked(history.readHistory).mockResolvedValue([
      {
        timestamp: thirtyDaysAgo.toISOString(),
        url: 'https://reddit.com/r/military/old-post',
        type: 'forum',
      },
    ]);

    vi.mocked(history.appendHistory).mockResolvedValue();

    vi.mocked(customSearchApi.customSearch).mockResolvedValue([
      {
        url: 'https://reddit.com/r/military/old-post',
        title: 'Old Post',
        snippet: 'Already seen',
      },
      {
        url: 'https://reddit.com/r/military/new-post',
        title: 'New Post',
        snippet: 'Not seen yet',
      },
    ]);

    await runDiscover({});

    expect(history.appendHistory).toHaveBeenCalledWith(
      'discover-history.json',
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://reddit.com/r/military/new-post',
        }),
      ])
    );

    const savedEntries = vi.mocked(history.appendHistory).mock.calls[0][1];
    expect(Array.isArray(savedEntries) ? savedEntries : [savedEntries]).toHaveLength(1);
  });

  it('should run directories mode with keywords', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: ['test'],
      apis: {
        customSearch: { apiKey: 'test-key', engineId: 'test-engine' },
      },
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    vi.mocked(history.readHistory).mockResolvedValue([]);
    vi.mocked(history.appendHistory).mockResolvedValue();

    vi.mocked(customSearchApi.customSearch).mockResolvedValue([
      {
        url: 'https://example.com/directory',
        title: 'Best Test Resources',
        snippet: 'A roundup of the best test resources',
      },
    ]);

    await runDiscover({ type: 'directories' });

    // Should call customSearch 4 times (1 keyword × 4 templates)
    expect(customSearchApi.customSearch).toHaveBeenCalledTimes(4);

    // Verify it's using generated queries from templates
    const calls = vi.mocked(customSearchApi.customSearch).mock.calls;
    expect(calls[0][0]).toContain('test');
    expect(calls[0][0]).toContain('resources');

    expect(history.appendHistory).toHaveBeenCalledWith(
      'discover-history.json',
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://example.com/directory',
          type: 'directory',
        }),
      ])
    );
  });

  it('should use custom directory queries when provided', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: ['test'],
      apis: {
        customSearch: { apiKey: 'test-key', engineId: 'test-engine' },
      },
      discover: {
        sites: [],
        resultsPerKeyword: 5,
        directoryQueries: ['custom query 1', 'custom query 2'],
      },
    });

    vi.mocked(history.readHistory).mockResolvedValue([]);
    vi.mocked(history.appendHistory).mockResolvedValue();
    vi.mocked(customSearchApi.customSearch).mockResolvedValue([]);

    await runDiscover({ type: 'directories' });

    // Should use custom queries instead of generated ones
    expect(customSearchApi.customSearch).toHaveBeenCalledTimes(2);
    expect(customSearchApi.customSearch).toHaveBeenCalledWith(
      'custom query 1',
      'test-key',
      'test-engine',
      { num: 5 }
    );
    expect(customSearchApi.customSearch).toHaveBeenCalledWith(
      'custom query 2',
      'test-key',
      'test-engine',
      { num: 5 }
    );
  });

  it('should warn when no keywords configured for directories', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: [],
      apis: {
        customSearch: { apiKey: 'test-key', engineId: 'test-engine' },
      },
      discover: { sites: [], resultsPerKeyword: 5 },
    });

    vi.mocked(history.readHistory).mockResolvedValue([]);
    vi.mocked(history.appendHistory).mockResolvedValue();

    await runDiscover({ type: 'directories' });

    // Should not call customSearch when no keywords
    expect(customSearchApi.customSearch).not.toHaveBeenCalled();
  });

  it('should run both modes when type is all', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: ['test'],
      apis: {
        customSearch: { apiKey: 'test-key', engineId: 'test-engine' },
      },
      discover: { sites: ['reddit.com'], resultsPerKeyword: 5 },
    });

    vi.mocked(history.readHistory).mockResolvedValue([]);
    vi.mocked(history.appendHistory).mockResolvedValue();
    vi.mocked(customSearchApi.customSearch).mockResolvedValue([]);

    await runDiscover({ type: 'all' });

    // Should be called for both forums and directories
    expect(customSearchApi.customSearch).toHaveBeenCalled();
    const calls = vi.mocked(customSearchApi.customSearch).mock.calls;

    // At least one forum search and directory searches
    expect(calls.length).toBeGreaterThan(1);
  });

  it('should warn when approaching quota', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: Array(51).fill('test'),
      apis: {
        customSearch: { apiKey: 'test-key', engineId: 'test-engine' },
      },
      discover: { sites: Array(2).fill('reddit.com'), resultsPerKeyword: 5 },
    });

    vi.mocked(history.readHistory).mockResolvedValue([]);
    vi.mocked(history.appendHistory).mockResolvedValue();
    vi.mocked(customSearchApi.customSearch).mockResolvedValue([]);

    await runDiscover({});

    // Should stop at quota (51 keywords × 2 sites = 102 potential calls, should stop at 100)
    expect(customSearchApi.customSearch).toHaveBeenCalledTimes(100);
    expect(customSearchApi.customSearch).not.toHaveBeenCalledTimes(102);
  });
});
