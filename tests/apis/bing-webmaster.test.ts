import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitBingUrls } from '../../src/apis/bing-webmaster.js';

describe('submitBingUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('should submit URLs successfully with concurrency', async () => {
    const urls = ['https://example.com/page1', 'https://example.com/page2'];
    const apiKey = 'test_api_key';
    const siteUrl = 'https://example.com';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await submitBingUrls(urls, apiKey, siteUrl);

    expect(result.success).toBe(true);
    expect(result.urlCount).toBe(2);
    expect(result.errors).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(
      `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrl?apikey=${apiKey}`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteUrl,
          url: urls[0],
        }),
      })
    );
  });

  it('should handle individual URL failures', async () => {
    const urls = ['https://example.com/page1', 'https://example.com/page2'];
    const apiKey = 'test_api_key';
    const siteUrl = 'https://example.com';

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 403,
          text: async () => 'Forbidden',
        };
      }
      return {
        ok: true,
        text: async () => '',
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await submitBingUrls(urls, apiKey, siteUrl);

    expect(result.success).toBe(false);
    expect(result.urlCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('https://example.com/page1');
    expect(result.errors[0]).toContain('403');
  });

  it('should retry on 429 status', async () => {
    vi.useFakeTimers();
    const urls = ['https://example.com/page1'];
    const apiKey = 'test_api_key';
    const siteUrl = 'https://example.com';

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return {
          ok: false,
          status: 429,
          text: async () => 'Rate limited',
        };
      }
      return {
        ok: true,
        text: async () => '',
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const resultPromise = submitBingUrls(urls, apiKey, siteUrl);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.urlCount).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('should handle all URLs failing', async () => {
    const urls = ['https://example.com/page1', 'https://example.com/page2'];
    const apiKey = 'test_api_key';
    const siteUrl = 'https://example.com';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await submitBingUrls(urls, apiKey, siteUrl);

    expect(result.success).toBe(false);
    expect(result.urlCount).toBe(0);
    expect(result.errors).toHaveLength(2);
  });

  it('should not retry non-429 errors', async () => {
    const urls = ['https://example.com/page1'];
    const apiKey = 'test_api_key';
    const siteUrl = 'https://example.com';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await submitBingUrls(urls, apiKey, siteUrl);

    expect(result.success).toBe(false);
    expect(result.urlCount).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('403');
    // Should only be called once (no retry for non-429)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should back off entire chunk when any URL gets 429', async () => {
    vi.useFakeTimers();
    const urls = [
      'https://example.com/page1',
      'https://example.com/page2',
      'https://example.com/page3',
    ];
    const apiKey = 'test_api_key';
    const siteUrl = 'https://example.com';

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (_url, options) => {
      callCount++;
      const body = JSON.parse((options as { body?: string })?.body || '{}');
      const urlParam = body.url;

      // First attempt: page2 gets 429, others succeed
      if (callCount <= 3) {
        if (urlParam === 'https://example.com/page2') {
          return {
            ok: false,
            status: 429,
            text: async () => 'Rate limited',
          };
        }
        return {
          ok: true,
          text: async () => '',
        };
      }

      // Retry: page2 succeeds
      return {
        ok: true,
        text: async () => '',
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const resultPromise = submitBingUrls(urls, apiKey, siteUrl);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.urlCount).toBe(3);
    expect(result.errors).toEqual([]);
    // 3 initial calls + 1 retry for page2
    expect(mockFetch).toHaveBeenCalledTimes(4);

    vi.useRealTimers();
  });

  it('should give up after max retries on persistent 429', async () => {
    vi.useFakeTimers();
    const urls = ['https://example.com/page1'];
    const apiKey = 'test_api_key';
    const siteUrl = 'https://example.com';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    });
    vi.stubGlobal('fetch', mockFetch);

    const resultPromise = submitBingUrls(urls, apiKey, siteUrl);

    // Fast-forward through all delays
    await vi.runAllTimersAsync();

    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.urlCount).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('429');
    // Initial attempt + 3 retries = 4 total
    expect(mockFetch).toHaveBeenCalledTimes(4);

    vi.useRealTimers();
  });
});
