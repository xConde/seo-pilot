export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error has status property with value 429
      const is429 =
        error !== null &&
        typeof error === 'object' &&
        'status' in error &&
        error.status === 429;

      // If not a 429, throw immediately
      if (!is429) {
        throw error;
      }

      // If we've exhausted retries, throw the error
      if (attempt >= maxRetries) {
        throw error;
      }

      // Calculate exponential backoff delay
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
