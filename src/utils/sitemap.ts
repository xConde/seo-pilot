export async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const response = await fetch(sitemapUrl);
  const text = await response.text();

  // Check if this is a sitemap index (contains <sitemap> elements)
  const sitemapIndexRegex = /<sitemap>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/g;
  const indexMatches = Array.from(text.matchAll(sitemapIndexRegex));

  if (indexMatches.length > 0) {
    // This is a sitemap index - fetch all child sitemaps
    const childSitemapUrls = indexMatches.map((match) => match[1]);
    const allUrls = await Promise.all(
      childSitemapUrls.map((url) => fetchSitemapUrls(url))
    );

    // Flatten and deduplicate
    return Array.from(new Set(allUrls.flat()));
  }

  // This is a regular sitemap - extract <loc> values
  const urlRegex = /<loc>(.*?)<\/loc>/g;
  const urls = Array.from(text.matchAll(urlRegex)).map((match) => match[1]);

  // Deduplicate
  return Array.from(new Set(urls));
}
