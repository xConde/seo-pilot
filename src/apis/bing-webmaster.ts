import { withRetry } from '../utils/retry.js';

export interface BingSubmitResult {
  success: boolean;
  urlCount: number;
  errors: string[];
}

export async function submitBingUrls(
  urls: string[],
  apiKey: string,
  siteUrl: string
): Promise<BingSubmitResult> {
  const errors: string[] = [];
  let successCount = 0;

  // Submit each URL individually
  for (const url of urls) {
    try {
      await withRetry(
        () => submitSingleUrl(url, apiKey, siteUrl),
        { maxRetries: 3, baseDelayMs: 1000 }
      );
      successCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`URL ${url}: ${message}`);
    }
  }

  return {
    success: errors.length === 0,
    urlCount: successCount,
    errors,
  };
}

async function submitSingleUrl(
  url: string,
  apiKey: string,
  siteUrl: string
): Promise<void> {
  const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrl?apikey=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      siteUrl,
      url,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = {
      status: response.status,
      message: errorText,
    };
    throw Object.assign(
      new Error(`Failed to submit URL: ${error.status} ${errorText}`),
      { status: error.status }
    );
  }

  // Bing returns 200 OK with no body on success
}
