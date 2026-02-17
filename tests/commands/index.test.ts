import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runIndex } from '../../src/commands/index.js';

// Mock modules
vi.mock('../../src/config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../../src/utils/sitemap.js', () => ({
  fetchSitemapUrls: vi.fn(),
}));

vi.mock('../../src/apis/indexnow.js', () => ({
  submitIndexNow: vi.fn(),
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
import { submitIndexNow } from '../../src/apis/indexnow.js';
import { appendHistory } from '../../src/state/history.js';
import { log } from '../../src/utils/logger.js';

describe('runIndex', () => {
  const mockConfig = {
    site: {
      url: 'https://example.com',
      sitemap: 'https://example.com/sitemap.xml',
    },
    apis: {
      indexnow: {
        key: 'test-key-123',
      },
    },
  };

  const mockUrls = [
    'https://example.com/page1',
    'https://example.com/page2',
    'https://example.com/page3',
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue(mockConfig as any);
    vi.mocked(fetchSitemapUrls).mockResolvedValue(mockUrls);
    vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should perform dry run without submitting', async () => {
    await runIndex({ 'dry-run': true });

    expect(loadConfig).toHaveBeenCalled();
    expect(fetchSitemapUrls).toHaveBeenCalledWith(mockConfig.site.sitemap);
    expect(submitIndexNow).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(mockUrls.join('\n'));
  });

  it('should submit to IndexNow successfully', async () => {
    vi.mocked(submitIndexNow).mockResolvedValue({
      success: true,
      urlCount: 3,
    });

    await runIndex({});

    expect(submitIndexNow).toHaveBeenCalledWith(
      mockUrls,
      'test-key-123',
      'https://example.com'
    );
    expect(appendHistory).toHaveBeenCalledWith(
      'index-history.json',
      expect.objectContaining({
        service: 'indexnow',
        urlCount: 3,
        success: true,
        errors: [],
      })
    );
    expect(log.success).toHaveBeenCalledWith(
      'All submissions completed successfully'
    );
  });

  it('should skip IndexNow when not configured', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      ...mockConfig,
      apis: {},
    } as any);

    await runIndex({});

    expect(submitIndexNow).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith('IndexNow not configured, skipping');
    expect(log.warn).toHaveBeenCalledWith('No services configured or selected');
  });

  it('should handle submission errors', async () => {
    vi.mocked(submitIndexNow).mockResolvedValue({
      success: false,
      urlCount: 0,
      error: 'API Error: 500',
    });

    await expect(runIndex({})).rejects.toThrow('process.exit(1)');

    expect(appendHistory).toHaveBeenCalledWith(
      'index-history.json',
      expect.objectContaining({
        service: 'indexnow',
        success: false,
        errors: ['API Error: 500'],
      })
    );
    expect(log.error).toHaveBeenCalledWith('Some submissions failed:');
    expect(log.error).toHaveBeenCalledWith('  API Error: 500');
  });

  it('should respect service flag for indexnow', async () => {
    vi.mocked(submitIndexNow).mockResolvedValue({
      success: true,
      urlCount: 3,
    });

    await runIndex({ service: 'indexnow' });

    expect(submitIndexNow).toHaveBeenCalled();
  });

  it('should use all services by default', async () => {
    vi.mocked(submitIndexNow).mockResolvedValue({
      success: true,
      urlCount: 3,
    });

    await runIndex({});

    expect(submitIndexNow).toHaveBeenCalled();
  });

  it('should respect custom config path', async () => {
    await runIndex({ config: '/custom/path/config.json', 'dry-run': true });

    expect(loadConfig).toHaveBeenCalledWith('/custom/path/config.json');
  });

  it('should handle config loading errors', async () => {
    vi.mocked(loadConfig).mockImplementation(() => {
      throw new Error('Config not found');
    });

    await expect(runIndex({})).rejects.toThrow('process.exit(1)');

    expect(log.error).toHaveBeenCalledWith(
      'Index command failed: Config not found'
    );
  });

  it('should save history entry with timestamp', async () => {
    vi.mocked(submitIndexNow).mockResolvedValue({
      success: true,
      urlCount: 3,
    });

    const beforeTime = new Date().toISOString();
    await runIndex({});
    const afterTime = new Date().toISOString();

    expect(appendHistory).toHaveBeenCalledWith(
      'index-history.json',
      expect.objectContaining({
        timestamp: expect.any(String),
      })
    );

    const historyEntry = vi.mocked(appendHistory).mock.calls[0][1];
    expect(historyEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(historyEntry.timestamp >= beforeTime).toBe(true);
    expect(historyEntry.timestamp <= afterTime).toBe(true);
  });

  it('should display results table', async () => {
    vi.mocked(submitIndexNow).mockResolvedValue({
      success: true,
      urlCount: 3,
    });

    await runIndex({});

    expect(log.table).toHaveBeenCalledWith([
      {
        Service: 'indexnow',
        URLs: 3,
        Status: 'Success',
      },
    ]);
  });
});
