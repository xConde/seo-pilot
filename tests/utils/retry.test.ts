import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../src/utils/retry.js';

describe('withRetry', () => {
  it('returns result on successful execution', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 error and succeeds', async () => {
    const error429 = { status: 429, message: 'Too Many Requests' };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error429)
      .mockRejectedValueOnce(error429)
      .mockResolvedValue('success');

    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws immediately on non-429 error', async () => {
    const error500 = { status: 500, message: 'Server Error' };
    const fn = vi.fn().mockRejectedValue(error500);

    await expect(withRetry(fn)).rejects.toEqual(error500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after max retries exhausted', async () => {
    const error429 = { status: 429, message: 'Too Many Requests' };
    const fn = vi.fn().mockRejectedValue(error429);

    await expect(withRetry(fn, { maxRetries: 2 })).rejects.toEqual(error429);
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('uses custom retry options', async () => {
    const error429 = { status: 429, message: 'Too Many Requests' };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error429)
      .mockResolvedValue('success');

    const result = await withRetry(fn, { maxRetries: 1, baseDelayMs: 100 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('applies exponential backoff delay', async () => {
    const error429 = { status: 429, message: 'Too Many Requests' };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error429)
      .mockRejectedValueOnce(error429)
      .mockResolvedValue('success');

    const startTime = Date.now();
    await withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });
    const duration = Date.now() - startTime;

    // Should have delays of ~100ms and ~200ms (exponential backoff)
    // Total should be at least 300ms
    expect(duration).toBeGreaterThanOrEqual(300);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
