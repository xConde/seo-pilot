import { withRetry } from '../utils/retry.js';

export interface IndexNowResult {
  success: boolean;
  urlCount: number;
  error?: string;
}

const MAX_URLS_PER_BATCH = 10000;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/**
 * Submit URLs to IndexNow API for indexing
 * @param urls - Array of URLs to submit
 * @param key - IndexNow API key
 * @param siteUrl - Base site URL
 * @returns Result of the submission
 */
export async function submitIndexNow(
  urls: string[],
  key: string,
  siteUrl: string
): Promise<IndexNowResult> {
  if (urls.length === 0) {
    return { success: true, urlCount: 0 };
  }

  // Extract host from siteUrl
  const host = new URL(siteUrl).hostname;
  const keyLocation = `https://${host}/${key}.txt`;

  // Split into batches if needed
  const batches: string[][] = [];
  for (let i = 0; i < urls.length; i += MAX_URLS_PER_BATCH) {
    batches.push(urls.slice(i, i + MAX_URLS_PER_BATCH));
  }

  // Submit each batch
  const errors: string[] = [];
  let successCount = 0;

  for (const batch of batches) {
    try {
      const response = await withRetry(async () => {
        const res = await fetch(INDEXNOW_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            host,
            key,
            keyLocation,
            urlList: batch,
          }),
        });

        if (!res.ok && res.status !== 202) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        return res;
      });

      if (response.ok || response.status === 202) {
        successCount += batch.length;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Batch failed: ${message}`);
    }
  }

  return {
    success: successCount === urls.length,
    urlCount: successCount,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}
