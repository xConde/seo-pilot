import { withRetry } from '../utils/retry.js';

export interface InspectionResult {
  url: string;
  verdict: string; // e.g., "PASS", "NEUTRAL", "FAIL"
  lastCrawlTime: string;
  indexingState: string; // e.g., "INDEXING_ALLOWED"
  mobileUsability: string; // e.g., "MOBILE_FRIENDLY"
}

interface InspectionApiResponse {
  inspectionResult?: {
    inspectionResultLink?: string;
    indexStatusResult?: {
      verdict?: string;
      lastCrawlTime?: string;
      coverageState?: string;
      robotsTxtState?: string;
      indexingState?: string;
      pageFetchState?: string;
    };
    mobileUsabilityResult?: {
      verdict?: string;
    };
  };
}

/**
 * Inspect a URL using Google Search Console's URL Inspection API
 * @param url - The URL to inspect
 * @param siteUrl - The site URL registered in Search Console
 * @param accessToken - Google OAuth 2.0 access token with webmasters scope
 * @returns Inspection result
 */
export async function inspectUrl(
  url: string,
  siteUrl: string,
  accessToken: string
): Promise<InspectionResult> {
  const endpoint =
    'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

  const response = await withRetry(async () => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        inspectionUrl: url,
        siteUrl,
        languageCode: 'en',
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      const error = new Error(
        `Failed to inspect URL: ${res.status} ${errorText}`
      );
      (error as any).status = res.status;
      throw error;
    }

    return res;
  });

  const data = await response.json() as InspectionApiResponse;

  const indexStatus = data.inspectionResult?.indexStatusResult;
  const mobileUsability = data.inspectionResult?.mobileUsabilityResult;

  return {
    url,
    verdict: indexStatus?.verdict ?? 'UNKNOWN',
    lastCrawlTime: indexStatus?.lastCrawlTime ?? 'Never',
    indexingState: indexStatus?.indexingState ?? 'UNKNOWN',
    mobileUsability: mobileUsability?.verdict ?? 'UNKNOWN',
  };
}
