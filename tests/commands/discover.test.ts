import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDiscover } from '../../src/commands/discover.js';
import * as configLoader from '../../src/config/loader.js';
import * as customSearchApi from '../../src/apis/google-custom-search.js';
import * as history from '../../src/state/history.js';

vi.mock('../../src/config/loader.js');
vi.mock('../../src/apis/google-custom-search.js');
vi.mock('../../src/state/history.js');

describe('discover command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  it('should exit if customSearch not configured', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: ['test'],
      apis: {},
      discover: { sites: ['reddit.com'], resultsPerKeyword: 5 },
    });

    await expect(runDiscover({})).rejects.toThrow('process.exit called');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should run forums mode by default', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: ['military family'],
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
      'site:reddit.com "military family"',
      'test-key',
      'test-engine',
      { num: 5 }
    );

    expect(history.appendHistory).toHaveBeenCalledWith(
      'discover-history.json',
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://reddit.com/r/military/post1',
          keyword: 'military family',
          type: 'forum',
        }),
      ])
    );
  });

  it('should filter by keyword flag', async () => {
    vi.mocked(configLoader.loadConfig).mockReturnValue({
      version: '1',
      site: { url: 'https://example.com', sitemap: 'https://example.com/sitemap.xml' },
      keywords: ['military family', 'BMT graduation'],
      apis: {
        customSearch: { apiKey: 'test-key', engineId: 'test-engine' },
      },
      discover: { sites: ['reddit.com'], resultsPerKeyword: 5 },
    });

    vi.mocked(history.readHistory).mockResolvedValue([]);
    vi.mocked(history.appendHistory).mockResolvedValue();
    vi.mocked(customSearchApi.customSearch).mockResolvedValue([]);

    await runDiscover({ keyword: 'BMT graduation' });

    expect(customSearchApi.customSearch).toHaveBeenCalledTimes(1);
    expect(customSearchApi.customSearch).toHaveBeenCalledWith(
      'site:reddit.com "BMT graduation"',
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

  it('should run directories mode', async () => {
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

    vi.mocked(customSearchApi.customSearch).mockResolvedValue([
      {
        url: 'https://example.com/directory',
        title: 'Best Military Resources',
        snippet: 'A roundup of the best military family resources',
      },
    ]);

    await runDiscover({ type: 'directories' });

    // Should call customSearch multiple times for directory queries
    expect(customSearchApi.customSearch).toHaveBeenCalled();

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
