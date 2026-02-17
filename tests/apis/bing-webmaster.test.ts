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

    const result = await submitBingUrls(urls, apiKey, siteUrl);

    expect(result.success).toBe(true);
    expect(result.urlCount).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(3);
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
});
