import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSitemapUrls } from '../../src/utils/sitemap.js';

describe('fetchSitemapUrls', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('extracts URLs from regular sitemap', async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
  </url>
  <url>
    <loc>https://example.com/page3</loc>
  </url>
</urlset>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockXml),
    });
    vi.stubGlobal('fetch', mockFetch);

    const urls = await fetchSitemapUrls('https://example.com/sitemap.xml');

    expect(urls).toEqual([
      'https://example.com/page1',
      'https://example.com/page2',
      'https://example.com/page3',
    ]);
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/sitemap.xml');
  });

  it('handles sitemap index files', async () => {
    const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap2.xml</loc>
  </sitemap>
</sitemapindex>`;

    const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
  </url>
</urlset>`;

    const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page2</loc>
  </url>
</urlset>`;

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(indexXml) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(sitemap1Xml) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(sitemap2Xml) });

    vi.stubGlobal('fetch', mockFetch);

    const urls = await fetchSitemapUrls('https://example.com/sitemap-index.xml');

    expect(urls).toEqual(['https://example.com/page1', 'https://example.com/page2']);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('deduplicates URLs', async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
  </url>
  <url>
    <loc>https://example.com/page1</loc>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
  </url>
</urlset>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockXml),
    });
    vi.stubGlobal('fetch', mockFetch);

    const urls = await fetchSitemapUrls('https://example.com/sitemap.xml');

    expect(urls).toEqual(['https://example.com/page1', 'https://example.com/page2']);
  });

  it('throws error on non-OK response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      fetchSitemapUrls('https://example.com/sitemap.xml')
    ).rejects.toThrow('Failed to fetch sitemap: https://example.com/sitemap.xml returned HTTP 404');
  });

  it('deduplicates URLs across multiple sitemaps in index', async () => {
    const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap2.xml</loc>
  </sitemap>
</sitemapindex>`;

    const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
  </url>
</urlset>`;

    const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page2</loc>
  </url>
  <url>
    <loc>https://example.com/page3</loc>
  </url>
</urlset>`;

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(indexXml) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(sitemap1Xml) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(sitemap2Xml) });

    vi.stubGlobal('fetch', mockFetch);

    const urls = await fetchSitemapUrls('https://example.com/sitemap-index.xml');

    expect(urls).toHaveLength(3);
    expect(urls).toContain('https://example.com/page1');
    expect(urls).toContain('https://example.com/page2');
    expect(urls).toContain('https://example.com/page3');
  });
});
