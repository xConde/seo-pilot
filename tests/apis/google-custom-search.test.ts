import { describe, it, expect, vi, beforeEach } from 'vitest';
import { customSearch } from '../../src/apis/google-custom-search.js';

describe('google-custom-search', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return search results on success', async () => {
    const mockResponse = {
      items: [
        {
          link: 'https://example.com/page1',
          title: 'Test Page 1',
          snippet: 'This is a test snippet',
        },
        {
          link: 'https://example.com/page2',
          title: 'Test Page 2',
          snippet: 'Another test snippet',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const results = await customSearch(
      'test query',
      'test-api-key',
      'test-engine-id',
      { num: 5 }
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      url: 'https://example.com/page1',
      title: 'Test Page 1',
      snippet: 'This is a test snippet',
    });
    expect(results[1]).toEqual({
      url: 'https://example.com/page2',
      title: 'Test Page 2',
      snippet: 'Another test snippet',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('q=test%20query')
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('key=test-api-key')
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('cx=test-engine-id')
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('num=5')
    );
  });

  it('should return empty array when no results', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const results = await customSearch(
      'test query',
      'test-api-key',
      'test-engine-id'
    );

    expect(results).toEqual([]);
  });

  it('should use default num of 5 when not provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });

    await customSearch('test query', 'test-api-key', 'test-engine-id');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('num=5')
    );
  });

  it('should throw error on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    });

    await expect(
      customSearch('test query', 'test-api-key', 'test-engine-id')
    ).rejects.toThrow('Google Custom Search failed: Bad Request');
  });

  it('should retry on 429 status', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        };
      }
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              link: 'https://example.com/page1',
              title: 'Test Page 1',
              snippet: 'Test snippet',
            },
          ],
        }),
      };
    });

    const results = await customSearch(
      'test query',
      'test-api-key',
      'test-engine-id'
    );

    expect(callCount).toBe(2);
    expect(results).toHaveLength(1);
  });
});
