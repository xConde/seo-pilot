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
  const concurrency = 5;

  for (let i = 0; i < urls.length; i += concurrency) {
    const chunk = urls.slice(i, i + concurrency);
    let pending = chunk.map((url, idx) => ({ url, idx }));
    let attempt = 0;
    const maxRetries = 3;
    const baseDelayMs = 1000;

    while (pending.length > 0 && attempt <= maxRetries) {
      if (attempt > 0) {
        // Back off the entire chunk
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const results = await Promise.allSettled(
        pending.map(({ url }) => submitSingleUrl(url, apiKey, siteUrl))
      );

      const stillPending: typeof pending = [];

      results.forEach((result, idx) => {
        const item = pending[idx]!;
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          const is429 =
            result.reason !== null &&
            typeof result.reason === 'object' &&
            'status' in result.reason &&
            result.reason.status === 429;

          if (is429 && attempt < maxRetries) {
            stillPending.push(item);
          } else {
            const message = result.reason instanceof Error ? result.reason.message : 'Unknown error';
            errors.push(`URL ${item.url}: ${message}`);
          }
        }
      });

      pending = stillPending;
      attempt++;
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
