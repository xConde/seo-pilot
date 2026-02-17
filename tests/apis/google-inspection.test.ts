import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inspectUrl } from '../../src/apis/google-inspection.js';

describe('google-inspection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should successfully inspect a URL', async () => {
    const mockResponse = {
      inspectionResult: {
        indexStatusResult: {
          verdict: 'PASS',
          lastCrawlTime: '2026-02-15T10:30:00Z',
          indexingState: 'INDEXING_ALLOWED',
        },
        mobileUsabilityResult: {
          verdict: 'MOBILE_FRIENDLY',
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await inspectUrl(
      'https://example.com/page',
      'https://example.com',
      'test-token'
    );

    expect(result).toEqual({
      url: 'https://example.com/page',
      verdict: 'PASS',
      lastCrawlTime: '2026-02-15T10:30:00Z',
      indexingState: 'INDEXING_ALLOWED',
      mobileUsability: 'MOBILE_FRIENDLY',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          inspectionUrl: 'https://example.com/page',
          siteUrl: 'https://example.com',
          languageCode: 'en',
        }),
      })
    );
  });

  it('should handle missing fields gracefully', async () => {
    const mockResponse = {
      inspectionResult: {},
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await inspectUrl(
      'https://example.com/page',
      'https://example.com',
      'test-token'
    );

    expect(result).toEqual({
      url: 'https://example.com/page',
      verdict: 'UNKNOWN',
      lastCrawlTime: 'Never',
      indexingState: 'UNKNOWN',
      mobileUsability: 'UNKNOWN',
    });
  });

  it('should throw error on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as Response);

    await expect(
      inspectUrl(
        'https://example.com/page',
        'https://example.com',
        'test-token'
      )
    ).rejects.toThrow('Failed to inspect URL: 403 Forbidden');
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
        json: async () => ({
          inspectionResult: {
            indexStatusResult: {
              verdict: 'PASS',
            },
          },
        }),
      } as Response);

    const result = await inspectUrl(
      'https://example.com/page',
      'https://example.com',
      'test-token'
    );

    expect(result.verdict).toBe('PASS');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
