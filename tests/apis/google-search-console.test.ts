import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryPerformance } from '../../src/apis/google-search-console.js';

describe('google-search-console', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should successfully query performance data', async () => {
    const mockResponse = {
      rows: [
        {
          keys: ['typescript tutorial', 'https://example.com/ts-guide'],
          clicks: 150,
          impressions: 3000,
          ctr: 0.05,
          position: 5.2,
        },
        {
          keys: ['node.js guide', 'https://example.com/node-guide'],
          clicks: 80,
          impressions: 1500,
          ctr: 0.053,
          position: 12.8,
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const results = await queryPerformance(
      'https://example.com',
      'test-token',
      { days: 28 }
    );

    expect(results).toEqual([
      {
        keyword: 'typescript tutorial',
        page: 'https://example.com/ts-guide',
        clicks: 150,
        impressions: 3000,
        ctr: 0.05,
        position: 5.2,
      },
      {
        keyword: 'node.js guide',
        page: 'https://example.com/node-guide',
        clicks: 80,
        impressions: 1500,
        ctr: 0.053,
        position: 12.8,
      },
    ]);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://searchconsole.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fexample.com/searchAnalytics/query',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      })
    );
  });

  it('should apply keyword filters', async () => {
    const mockResponse = { rows: [] };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    await queryPerformance('https://example.com', 'test-token', {
      days: 7,
      keywords: ['typescript', 'node.js'],
    });

    const callArgs = (global.fetch as any).mock.calls[0][1];
    const body = JSON.parse(callArgs.body);

    expect(body.dimensionFilterGroups).toEqual([
      {
        filters: [
          {
            dimension: 'query',
            operator: 'equals',
            expression: 'typescript',
          },
          {
            dimension: 'query',
            operator: 'equals',
            expression: 'node.js',
          },
        ],
      },
    ]);
  });

  it('should return empty array when no data', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    const results = await queryPerformance(
      'https://example.com',
      'test-token'
    );

    expect(results).toEqual([]);
  });

  it('should handle missing fields in rows', async () => {
    const mockResponse = {
      rows: [
        {
          keys: ['test'],
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const results = await queryPerformance(
      'https://example.com',
      'test-token'
    );

    expect(results).toEqual([
      {
        keyword: 'test',
        page: '',
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
      },
    ]);
  });

  it('should throw error on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as Response);

    await expect(
      queryPerformance('https://example.com', 'test-token')
    ).rejects.toThrow('Failed to query performance: 403 Forbidden');
  });

  it('should retry on 429 errors', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rows: [] }),
      } as Response);

    await queryPerformance('https://example.com', 'test-token');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
