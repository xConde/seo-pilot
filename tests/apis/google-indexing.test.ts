import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitGoogleIndexing } from '../../src/apis/google-indexing.js';

describe('submitGoogleIndexing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('should submit URLs successfully', async () => {
    const urls = ['https://example.com/page1', 'https://example.com/page2'];
    const accessToken = 'mock_access_token';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => name === 'content-type' ? 'multipart/mixed; boundary=batch_boundary' : null,
      },
      text: async () => `--batch_boundary
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"urlNotificationMetadata":{"url":"https://example.com/page1"}}
--batch_boundary
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"urlNotificationMetadata":{"url":"https://example.com/page2"}}
--batch_boundary--`,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await submitGoogleIndexing(urls, accessToken);

    expect(result.success).toBe(true);
    expect(result.urlCount).toBe(2);
    expect(result.errors).toEqual([]);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://indexing.googleapis.com/batch',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock_access_token',
          'Content-Type': 'multipart/mixed; boundary=batch_boundary',
        },
      })
    );
  });

  it('should handle partial failures in batch', async () => {
    const urls = ['https://example.com/page1', 'https://example.com/page2'];
    const accessToken = 'mock_access_token';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => name === 'content-type' ? 'multipart/mixed; boundary=batch_boundary' : null,
      },
      text: async () => `--batch_boundary
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"urlNotificationMetadata":{"url":"https://example.com/page1"}}
--batch_boundary
Content-Type: application/http

HTTP/1.1 403 Forbidden
Content-Type: application/json

{"error":{"code":403,"message":"Permission denied"}}
--batch_boundary--`,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await submitGoogleIndexing(urls, accessToken);

    expect(result.success).toBe(false);
    expect(result.urlCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Permission denied');
  });

  it('should handle batch request failure with retry', async () => {
    const urls = ['https://example.com/page1'];
    const accessToken = 'mock_access_token';

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
        headers: {
          get: (name: string) => name === 'content-type' ? 'multipart/mixed; boundary=batch_boundary' : null,
        },
        text: async () => `--batch_boundary
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"urlNotificationMetadata":{"url":"https://example.com/page1"}}
--batch_boundary--`,
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await submitGoogleIndexing(urls, accessToken);

    expect(result.success).toBe(true);
    expect(result.urlCount).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should extract boundary from Content-Type with trailing params', async () => {
    const urls = ['https://example.com/page1'];
    const accessToken = 'mock_access_token';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name === 'content-type'
            ? 'multipart/mixed; boundary=batch_foXbar123; charset=UTF-8'
            : null,
      },
      text: async () => `--batch_foXbar123
Content-Type: application/http

HTTP/1.1 200 OK
Content-Type: application/json

{"urlNotificationMetadata":{"url":"https://example.com/page1"}}
--batch_foXbar123--`,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await submitGoogleIndexing(urls, accessToken);

    expect(result.success).toBe(true);
    expect(result.urlCount).toBe(1);
  });

  it('should handle multiple batches', async () => {
    // Create 150 URLs to trigger multiple batches (100 per batch)
    const urls = Array.from(
      { length: 150 },
      (_, i) => `https://example.com/page${i + 1}`
    );
    const accessToken = 'mock_access_token';

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      const batchSize = callCount === 2 ? 50 : 100; // Second batch has 50 items
      const responses = Array.from({ length: batchSize }, () =>
        [
          '--batch_boundary',
          'Content-Type: application/http',
          '',
          'HTTP/1.1 200 OK',
          'Content-Type: application/json',
          '',
          '{"urlNotificationMetadata":{"url":"https://example.com/page1"}}',
        ].join('\n')
      ).join('\n');
      return {
        ok: true,
        headers: {
          get: (name: string) => name === 'content-type' ? 'multipart/mixed; boundary=batch_boundary' : null,
        },
        text: async () => responses + '\n--batch_boundary--',
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await submitGoogleIndexing(urls, accessToken);

    expect(result.success).toBe(true);
    expect(result.urlCount).toBe(150);
    expect(mockFetch).toHaveBeenCalledTimes(2); // 2 batches
  });
});
