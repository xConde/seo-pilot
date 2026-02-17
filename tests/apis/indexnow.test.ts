import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitIndexNow } from '../../src/apis/indexnow.js';

describe('submitIndexNow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully submit URLs', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });

    const urls = ['https://example.com/page1', 'https://example.com/page2'];
    const result = await submitIndexNow(
      urls,
      'test-key-123',
      'https://example.com'
    );

    expect(result).toEqual({
      success: true,
      urlCount: 2,
      error: undefined,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.indexnow.org/indexnow',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: 'example.com',
          key: 'test-key-123',
          keyLocation: 'https://example.com/test-key-123.txt',
          urlList: urls,
        }),
      })
    );
  });

  it('should handle 202 response as success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 202,
      statusText: 'Accepted',
    });

    const urls = ['https://example.com/page1'];
    const result = await submitIndexNow(
      urls,
      'test-key-123',
      'https://example.com'
    );

    expect(result.success).toBe(true);
    expect(result.urlCount).toBe(1);
  });

  it('should handle failed submission', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const urls = ['https://example.com/page1'];
    const result = await submitIndexNow(
      urls,
      'test-key-123',
      'https://example.com'
    );

    expect(result.success).toBe(false);
    expect(result.urlCount).toBe(0);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('500');
  });

  it('should batch URLs when exceeding 10K limit', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });

    // Create 15K URLs
    const urls = Array.from(
      { length: 15000 },
      (_, i) => `https://example.com/page${i}`
    );

    const result = await submitIndexNow(
      urls,
      'test-key-123',
      'https://example.com'
    );

    expect(result.success).toBe(true);
    expect(result.urlCount).toBe(15000);
    expect(global.fetch).toHaveBeenCalledTimes(2); // Should make 2 batches
  });

  it('should return success with 0 count for empty URL array', async () => {
    const result = await submitIndexNow(
      [],
      'test-key-123',
      'https://example.com'
    );

    expect(result).toEqual({
      success: true,
      urlCount: 0,
      error: undefined,
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle partial batch failures', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, status: 200 });
      }
      return Promise.resolve({ ok: false, status: 500, statusText: 'Error' });
    });

    const urls = Array.from(
      { length: 15000 },
      (_, i) => `https://example.com/page${i}`
    );

    const result = await submitIndexNow(
      urls,
      'test-key-123',
      'https://example.com'
    );

    expect(result.success).toBe(false);
    expect(result.urlCount).toBe(10000); // Only first batch succeeded
    expect(result.error).toBeDefined();
  });
});
