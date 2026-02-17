import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { runSetup } from '../../src/commands/setup.js';

// Mock modules
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('node:readline/promises', () => ({
  createInterface: vi.fn(),
}));

vi.mock('../../src/auth/google.js', () => ({
  getGoogleAccessToken: vi.fn(),
}));

describe('setup command', () => {
  const mockReadline = {
    question: vi.fn(),
    close: vi.fn(),
  };

  const mockFetch = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    // @ts-expect-error - mocking readline
    const { createInterface } = await import('node:readline/promises');
    vi.mocked(createInterface).mockReturnValue(mockReadline as any);
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('completes full setup with all services configured', async () => {
    const mockWriteFile = vi.mocked((await import('node:fs/promises')).writeFile);
    const mockReadFile = vi.mocked((await import('node:fs/promises')).readFile);

    // Mock user inputs
    const answers = [
      'https://example.com', // site URL
      'https://example.com/sitemap.xml', // sitemap URL
      'keyword1, keyword2, keyword3', // keywords
      'y', // configure IndexNow
      'y', // deployed key file
      'y', // configure Google Cloud
      '/path/to/service-account.json', // service account path
      'sc-domain:example.com', // Search Console site URL
      'y', // configure Bing
      'bing-api-key-123', // Bing API key
      'y', // configure Custom Search
      'custom-search-api-key', // Custom Search API key
      'custom-search-engine-id', // Custom Search Engine ID
    ];

    let answerIndex = 0;
    mockReadline.question.mockImplementation(() => {
      return Promise.resolve(answers[answerIndex++]);
    });

    // Mock fetch responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('sitemap.xml') || url === 'https://example.com') {
        return Promise.resolve({ ok: true, status: 200 });
      }
      // IndexNow key file validation
      if (url.includes('.txt')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(url.split('/').pop()?.replace('.txt', '') || ''),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    // Mock service account file read
    mockReadFile.mockResolvedValue(JSON.stringify({
      client_email: 'test@example.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
    }));

    await runSetup();

    // Verify config file was written
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('seo-pilot.config.json'),
      expect.stringContaining('"version": "1"'),
      'utf-8'
    );

    // Verify .env.local was written
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('.env.local'),
      expect.stringContaining('BING_WEBMASTER_API_KEY=bing-api-key-123'),
      'utf-8'
    );

    expect(mockReadline.close).toHaveBeenCalled();
  });

  it('allows skipping optional services', async () => {
    const mockWriteFile = vi.mocked((await import('node:fs/promises')).writeFile);

    const answers = [
      'https://example.com', // site URL
      'https://example.com/sitemap.xml', // sitemap URL
      'keyword1', // keywords
      'n', // skip IndexNow
      'n', // skip Google Cloud
      'n', // skip Bing
      'n', // skip Custom Search
    ];

    let answerIndex = 0;
    mockReadline.question.mockImplementation(() => {
      return Promise.resolve(answers[answerIndex++]);
    });

    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await runSetup();

    // Verify config file was written with minimal config
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('seo-pilot.config.json'),
      expect.stringMatching(/"site":\s*{/),
      'utf-8'
    );

    // Verify .env.local was NOT written (no secrets)
    const envCalls = mockWriteFile.mock.calls.filter(call =>
      call[0].toString().includes('.env.local')
    );
    expect(envCalls).toHaveLength(0);

    expect(mockReadline.close).toHaveBeenCalled();
  });

  it('handles invalid site URL and retries', async () => {
    const mockWriteFile = vi.mocked((await import('node:fs/promises')).writeFile);

    const answers = [
      'https://invalid-site.com', // invalid site URL
      'https://example.com', // valid site URL
      'https://example.com/sitemap.xml', // sitemap URL
      '', // empty keywords
      'n', // skip IndexNow
      'n', // skip Google Cloud
      'n', // skip Bing
      'n', // skip Custom Search
    ];

    let answerIndex = 0;
    mockReadline.question.mockImplementation(() => {
      return Promise.resolve(answers[answerIndex++]);
    });

    let fetchCallCount = 0;
    mockFetch.mockImplementation(() => {
      fetchCallCount++;
      // First call (invalid site) fails, subsequent calls succeed
      if (fetchCallCount === 1) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ ok: true, status: 200 });
    });

    await runSetup();

    expect(mockWriteFile).toHaveBeenCalled();
    expect(mockReadline.close).toHaveBeenCalled();
    expect(fetchCallCount).toBeGreaterThan(1);
  });

  it('writes config with correct structure', async () => {
    const mockWriteFile = vi.mocked((await import('node:fs/promises')).writeFile);

    const answers = [
      'https://example.com',
      'https://example.com/sitemap.xml',
      'keyword1, keyword2',
      'n', // skip all APIs
      'n',
      'n',
      'n',
    ];

    let answerIndex = 0;
    mockReadline.question.mockImplementation(() => {
      return Promise.resolve(answers[answerIndex++]);
    });

    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await runSetup();

    const configCall = mockWriteFile.mock.calls.find(call =>
      call[0].toString().includes('seo-pilot.config.json')
    );

    expect(configCall).toBeDefined();
    const configContent = configCall![1] as string;
    const config = JSON.parse(configContent);

    expect(config).toMatchObject({
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      keywords: ['keyword1', 'keyword2'],
      apis: {},
    });

    expect(mockReadline.close).toHaveBeenCalled();
  });

  describe('API validation', () => {
    it('validates IndexNow by fetching key file', async () => {
      const mockWriteFile = vi.mocked((await import('node:fs/promises')).writeFile);

      const answers = [
        'https://example.com',
        'https://example.com/sitemap.xml',
        'keyword1',
        'y', // configure IndexNow
        'y', // deployed key file
        'n', // skip other services
        'n',
        'n',
      ];

      let answerIndex = 0;
      mockReadline.question.mockImplementation(() => {
        return Promise.resolve(answers[answerIndex++]);
      });

      let keyFileUrl = '';
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('sitemap.xml') || url === 'https://example.com') {
          return Promise.resolve({ ok: true, status: 200 });
        }
        if (url.includes('.txt')) {
          keyFileUrl = url;
          const key = url.split('/').pop()?.replace('.txt', '') || '';
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(key),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      await runSetup();

      // Verify key file was fetched twice: once during setup, once during validation
      expect(keyFileUrl).toMatch(/^https:\/\/example\.com\/[a-f0-9]{32}\.txt$/);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/\.txt$/));
      expect(mockReadline.close).toHaveBeenCalled();
    });

    it('validates Google credentials by getting access token', async () => {
      const mockWriteFile = vi.mocked((await import('node:fs/promises')).writeFile);
      const mockReadFile = vi.mocked((await import('node:fs/promises')).readFile);
      const { getGoogleAccessToken } = await import('../../src/auth/google.js');
      const mockGetAccessToken = vi.mocked(getGoogleAccessToken);

      const answers = [
        'https://example.com',
        'https://example.com/sitemap.xml',
        'keyword1',
        'n', // skip IndexNow
        'y', // configure Google
        '/path/to/service-account.json',
        'sc-domain:example.com',
        'n', // skip other services
        'n',
      ];

      let answerIndex = 0;
      mockReadline.question.mockImplementation(() => {
        return Promise.resolve(answers[answerIndex++]);
      });

      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      mockReadFile.mockResolvedValue(JSON.stringify({
        client_email: 'test@example.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
      }));

      mockGetAccessToken.mockResolvedValue('mock-access-token');

      await runSetup();

      // Verify getGoogleAccessToken was called during validation
      expect(mockGetAccessToken).toHaveBeenCalledWith(
        '/path/to/service-account.json',
        ['https://www.googleapis.com/auth/indexing']
      );
      expect(mockReadline.close).toHaveBeenCalled();
    });

    it('validates Bing API key using GetQueryStats endpoint', async () => {
      const mockWriteFile = vi.mocked((await import('node:fs/promises')).writeFile);

      const answers = [
        'https://example.com',
        'https://example.com/sitemap.xml',
        'keyword1',
        'n', // skip IndexNow
        'n', // skip Google
        'y', // configure Bing
        'bing-api-key-123',
        'n', // skip Custom Search
      ];

      let answerIndex = 0;
      mockReadline.question.mockImplementation(() => {
        return Promise.resolve(answers[answerIndex++]);
      });

      let bingApiCalled = false;
      mockFetch.mockImplementation((url: string, options?: any) => {
        if (url.includes('sitemap.xml') || url === 'https://example.com') {
          return Promise.resolve({ ok: true, status: 200 });
        }
        if (url.includes('bing.com/webmaster/api.svc')) {
          bingApiCalled = true;
          expect(url).toContain('bing-api-key-123');
          expect(url).toContain('GetQueryStats');
          expect(url).toContain(encodeURIComponent('https://example.com'));
          expect(options?.method).toBe('GET');
          return Promise.resolve({ ok: true, status: 200 });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      await runSetup();

      expect(bingApiCalled).toBe(true);
      expect(mockReadline.close).toHaveBeenCalled();
    });

    it('validates Custom Search by making test query', async () => {
      const mockWriteFile = vi.mocked((await import('node:fs/promises')).writeFile);

      const answers = [
        'https://example.com',
        'https://example.com/sitemap.xml',
        'keyword1',
        'n', // skip IndexNow
        'n', // skip Google
        'n', // skip Bing
        'y', // configure Custom Search
        'custom-search-api-key',
        'custom-search-engine-id',
      ];

      let answerIndex = 0;
      mockReadline.question.mockImplementation(() => {
        return Promise.resolve(answers[answerIndex++]);
      });

      let customSearchCalled = false;
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('sitemap.xml') || url === 'https://example.com') {
          return Promise.resolve({ ok: true, status: 200 });
        }
        if (url.includes('googleapis.com/customsearch')) {
          customSearchCalled = true;
          expect(url).toContain('custom-search-api-key');
          expect(url).toContain('custom-search-engine-id');
          expect(url).toContain('site%3Aexample.com');
          return Promise.resolve({ ok: true, status: 200 });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      await runSetup();

      expect(customSearchCalled).toBe(true);
      expect(mockReadline.close).toHaveBeenCalled();
    });

    it('continues validation even when individual services fail', async () => {
      const mockWriteFile = vi.mocked((await import('node:fs/promises')).writeFile);
      const mockReadFile = vi.mocked((await import('node:fs/promises')).readFile);
      const { getGoogleAccessToken } = await import('../../src/auth/google.js');
      const mockGetAccessToken = vi.mocked(getGoogleAccessToken);

      const answers = [
        'https://example.com',
        'https://example.com/sitemap.xml',
        'keyword1',
        'y', // configure IndexNow
        'y', // deployed key file
        'y', // configure Google
        '/path/to/service-account.json',
        'sc-domain:example.com',
        'y', // configure Bing
        'invalid-bing-key',
        'y', // configure Custom Search
        'invalid-custom-search-key',
        'invalid-engine-id',
      ];

      let answerIndex = 0;
      mockReadline.question.mockImplementation(() => {
        return Promise.resolve(answers[answerIndex++]);
      });

      // Mock different failures for each service
      mockFetch.mockImplementation((url: string, options?: any) => {
        if (url.includes('sitemap.xml') || url === 'https://example.com') {
          return Promise.resolve({ ok: true, status: 200 });
        }
        if (url.includes('.txt')) {
          const key = url.split('/').pop()?.replace('.txt', '') || '';
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(key),
          });
        }
        if (url.includes('bing.com/webmaster')) {
          // Bing fails with 401
          return Promise.resolve({
            ok: false,
            status: 401,
            text: () => Promise.resolve('Invalid API key'),
          });
        }
        if (url.includes('googleapis.com/customsearch')) {
          // Custom Search fails with 403
          return Promise.resolve({
            ok: false,
            status: 403,
            text: () => Promise.resolve('Invalid credentials'),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      mockReadFile.mockResolvedValue(JSON.stringify({
        client_email: 'test@example.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
      }));

      // Google fails with authentication error
      mockGetAccessToken.mockRejectedValue(new Error('Invalid service account credentials'));

      await runSetup();

      // Verify all services were attempted despite failures
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('.txt'));
      expect(mockGetAccessToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('bing.com/webmaster'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('customsearch'));
      expect(mockReadline.close).toHaveBeenCalled();
    });
  });
});
