import { withRetry } from '../utils/retry.js';

export interface GoogleIndexingResult {
  success: boolean;
  urlCount: number;
  errors: string[];
}

interface BatchItem {
  url: string;
  statusCode?: number;
  error?: string;
}

export async function submitGoogleIndexing(
  urls: string[],
  accessToken: string
): Promise<GoogleIndexingResult> {
  const errors: string[] = [];
  let successCount = 0;

  // Process URLs in batches of 100
  const batchSize = 100;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    try {
      const result = await withRetry(
        () => submitBatch(batch, accessToken),
        { maxRetries: 3, baseDelayMs: 1000 }
      );

      successCount += result.successCount;
      errors.push(...result.errors);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Batch failed: ${message}`);
    }
  }

  return {
    success: errors.length === 0,
    urlCount: successCount,
    errors,
  };
}

async function submitBatch(
  urls: string[],
  accessToken: string
): Promise<{ successCount: number; errors: string[] }> {
  const boundary = 'batch_boundary';
  const errors: string[] = [];
  let successCount = 0;

  // Build multipart request body
  const parts = urls.map((url, index) => {
    const body = JSON.stringify({
      url,
      type: 'URL_UPDATED',
    });

    return [
      `--${boundary}`,
      'Content-Type: application/http',
      `Content-ID: <item${index + 1}>`,
      '',
      'POST /v3/urlNotifications:publish HTTP/1.1',
      'Content-Type: application/json',
      '',
      body,
    ].join('\r\n');
  });

  const requestBody = parts.join('\r\n') + `\r\n--${boundary}--\r\n`;

  const response = await fetch('https://indexing.googleapis.com/batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/mixed; boundary=${boundary}`,
    },
    body: requestBody,
  });

  if (!response.ok) {
    const error = {
      status: response.status,
      message: await response.text(),
    };
    throw Object.assign(new Error(`Batch request failed: ${error.status}`), {
      status: error.status,
    });
  }

  // Parse multipart response
  const responseText = await response.text();
  const items = parseMultipartResponse(responseText);

  items.forEach((item, index) => {
    if (item.statusCode && item.statusCode >= 200 && item.statusCode < 300) {
      successCount++;
    } else {
      errors.push(
        `URL ${urls[index]}: ${item.error || `Status ${item.statusCode}`}`
      );
    }
  });

  return { successCount, errors };
}

function parseMultipartResponse(responseText: string): BatchItem[] {
  const items: BatchItem[] = [];
  const parts = responseText.split(/--batch_\w+/);

  for (const part of parts) {
    if (!part.trim() || part.trim() === '--') continue;

    // Extract HTTP status code
    const statusMatch = part.match(/HTTP\/\d\.\d (\d+)/);
    if (statusMatch) {
      const statusCode = parseInt(statusMatch[1], 10);

      // Try to extract JSON body for error details
      const jsonMatch = part.match(/\{[\s\S]*\}/);
      let error: string | undefined;

      if (jsonMatch) {
        try {
          const json = JSON.parse(jsonMatch[0]);
          if (json.error) {
            error = json.error.message || JSON.stringify(json.error);
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      items.push({
        url: '',
        statusCode,
        error,
      });
    }
  }

  return items;
}
