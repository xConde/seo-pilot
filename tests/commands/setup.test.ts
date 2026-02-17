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
      expect.stringContaining('"version": "1.0.0"'),
      'utf-8'
    );

    // Verify .env.local was written
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('.env.local'),
      expect.stringContaining('BING_API_KEY=bing-api-key-123'),
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
      version: '1.0.0',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      keywords: ['keyword1', 'keyword2'],
      apis: {},
    });

    expect(mockReadline.close).toHaveBeenCalled();
  });
});
