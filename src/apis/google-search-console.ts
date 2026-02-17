import { withRetry } from '../utils/retry.js';

export interface PerformanceRow {
  keyword: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface PerformanceApiResponse {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }>;
}

/**
 * Query Search Console Performance API for keyword/page data
 * @param siteUrl - The site URL registered in Search Console
 * @param accessToken - Google OAuth 2.0 access token with webmasters scope
 * @param options - Query options (days, keywords filter)
 * @returns Array of performance rows
 */
export async function queryPerformance(
  siteUrl: string,
  accessToken: string,
  options: { days?: number; keywords?: string[] } = {}
): Promise<PerformanceRow[]> {
  const days = options.days ?? 28;

  // Calculate date range (yesterday back to N days ago)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]!;
  };

  interface SearchAnalyticsRequest {
    startDate: string;
    endDate: string;
    dimensions: string[];
    rowLimit: number;
    dimensionFilterGroups?: Array<{
      groupType: string;
      filters: Array<{
        dimension: string;
        operator: string;
        expression: string;
      }>;
    }>;
  }

  const requestBody: SearchAnalyticsRequest = {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    dimensions: ['query', 'page'],
    rowLimit: 1000,
  };

  // Add keyword filter if provided — one filter group per keyword with OR semantics.
  // Google's API applies AND within a filter group, so we use containsKeyword
  // with a regex OR pattern to match any of the keywords in a single request.
  if (options.keywords && options.keywords.length > 0) {
    requestBody.dimensionFilterGroups = [
      {
        groupType: 'and',
        filters: [
          {
            dimension: 'query',
            operator: 'includingRegex',
            expression: options.keywords
              .map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
              .join('|'),
          },
        ],
      },
    ];
  }

  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

  const response = await withRetry(async () => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw Object.assign(
        new Error(`Failed to query performance: ${res.status} ${errorText}`),
        { status: res.status }
      );
    }

    return res;
  });

  const data = await response.json() as PerformanceApiResponse;

  if (!data.rows || data.rows.length === 0) {
    return [];
  }

  return data.rows.map((row) => ({
    keyword: row.keys?.[0] ?? '',
    page: row.keys?.[1] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}
