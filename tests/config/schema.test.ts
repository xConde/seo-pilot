import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../../src/config/schema.js';

describe('ConfigSchema', () => {
  it('validates a minimal valid config', () => {
    const config = {
      version: '1.0.0',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.keywords).toEqual([]);
      expect(result.data.apis).toEqual({});
      expect(result.data.discover.sites).toEqual(['reddit.com', 'quora.com']);
      expect(result.data.discover.resultsPerKeyword).toBe(5);
    }
  });

  it('validates a full config with all optional fields', () => {
    const config = {
      version: '1.0.0',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      keywords: ['seo', 'marketing'],
      apis: {
        indexnow: {
          key: 'abc123',
        },
        google: {
          serviceAccountPath: '/path/to/credentials.json',
          siteUrl: 'https://example.com',
        },
        bing: {
          apiKey: 'bing-key',
          siteUrl: 'https://example.com',
        },
        customSearch: {
          apiKey: 'search-key',
          engineId: 'engine-123',
        },
      },
      discover: {
        sites: ['custom.com'],
        resultsPerKeyword: 10,
        directoryQueries: ['custom directory query'],
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('fails when version is missing', () => {
    const config = {
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('fails when site.url is missing', () => {
    const config = {
      version: '1.0.0',
      site: {
        sitemap: 'https://example.com/sitemap.xml',
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('fails when site.sitemap is missing', () => {
    const config = {
      version: '1.0.0',
      site: {
        url: 'https://example.com',
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('fails when site.url is not a valid URL', () => {
    const config = {
      version: '1.0.0',
      site: {
        url: 'not-a-url',
        sitemap: 'https://example.com/sitemap.xml',
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('fails when discover.resultsPerKeyword is not positive', () => {
    const config = {
      version: '1.0.0',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      discover: {
        resultsPerKeyword: -1,
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('applies default values for optional sections', () => {
    const config = {
      version: '1.0.0',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.keywords).toEqual([]);
      expect(result.data.apis).toEqual({});
      expect(result.data.discover).toEqual({
        sites: ['reddit.com', 'quora.com'],
        resultsPerKeyword: 5,
      });
    }
  });

  it('validates discover.directoryQueries as optional array of strings', () => {
    const config = {
      version: '1.0.0',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      discover: {
        directoryQueries: ['query 1', 'query 2', 'query 3'],
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.discover.directoryQueries).toEqual(['query 1', 'query 2', 'query 3']);
    }
  });

  it('allows discover.directoryQueries to be omitted', () => {
    const config = {
      version: '1.0.0',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      discover: {
        sites: ['reddit.com'],
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.discover.directoryQueries).toBeUndefined();
    }
  });
});
