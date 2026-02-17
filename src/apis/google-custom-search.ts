import { withRetry } from '../utils/retry.js';

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

interface GoogleSearchResponse {
  items?: Array<{
    link: string;
    title: string;
    snippet: string;
  }>;
}

export async function customSearch(
  query: string,
  apiKey: string,
  engineId: string,
  options?: { num?: number }
): Promise<SearchResult[]> {
  const num = options?.num ?? 5;
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${engineId}&num=${num}`;

  return withRetry(async () => {
    const response = await fetch(url);

    if (!response.ok) {
      const error = new Error(`Google Custom Search failed: ${response.statusText}`) as Error & { status: number };
      error.status = response.status;
      throw error;
    }

    const data = (await response.json()) as GoogleSearchResponse;

    if (!data.items || data.items.length === 0) {
      return [];
    }

    return data.items.map((item) => ({
      url: item.link,
      title: item.title,
      snippet: item.snippet,
    }));
  });
}
