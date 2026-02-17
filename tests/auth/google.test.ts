import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { readFile } from 'node:fs/promises';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
  },
}));

describe('getGoogleAccessToken', () => {
  const mockServiceAccount = {
    client_email: 'test@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    // Reset module to clear cache
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should generate and return access token', async () => {
    const { getGoogleAccessToken } = await import('../../src/auth/google.js');

    const mockReadFile = vi.mocked(readFile);
    mockReadFile.mockResolvedValue(JSON.stringify(mockServiceAccount));

    const mockSign = vi.mocked(jwt.sign);
    mockSign.mockReturnValue('mock.jwt.token' as any);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'mock_access_token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const token = await getGoogleAccessToken('/path/to/service-account.json', [
      'https://www.googleapis.com/auth/indexing',
    ]);

    expect(token).toBe('mock_access_token');
    expect(mockReadFile).toHaveBeenCalledWith(
      '/path/to/service-account.json',
      'utf-8'
    );
    expect(mockSign).toHaveBeenCalledWith(
      expect.objectContaining({
        iss: mockServiceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/indexing',
        aud: 'https://oauth2.googleapis.com/token',
      }),
      mockServiceAccount.private_key,
      { algorithm: 'RS256' }
    );
    expect(mockFetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=mock.jwt.token',
      })
    );
  });

  it('should cache token until expiry', async () => {
    const { getGoogleAccessToken } = await import('../../src/auth/google.js');

    const mockReadFile = vi.mocked(readFile);
    mockReadFile.mockResolvedValue(JSON.stringify(mockServiceAccount));

    const mockSign = vi.mocked(jwt.sign);
    mockSign.mockReturnValue('mock.jwt.token' as any);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'cached_token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const token1 = await getGoogleAccessToken(
      '/path/to/service-account.json',
      ['https://www.googleapis.com/auth/indexing']
    );
    const token2 = await getGoogleAccessToken(
      '/path/to/service-account.json',
      ['https://www.googleapis.com/auth/indexing']
    );

    expect(token1).toBe('cached_token');
    expect(token2).toBe('cached_token');
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once due to caching
  });

  it('should use separate cache entries for different scopes', async () => {
    const { getGoogleAccessToken } = await import('../../src/auth/google.js');

    const mockReadFile = vi.mocked(readFile);
    mockReadFile.mockResolvedValue(JSON.stringify(mockServiceAccount));

    const mockSign = vi.mocked(jwt.sign);
    mockSign.mockReturnValue('mock.jwt.token' as any);

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        access_token: `token_${++callCount}`,
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    }));
    vi.stubGlobal('fetch', mockFetch);

    const indexingToken = await getGoogleAccessToken(
      '/path/to/sa.json',
      ['https://www.googleapis.com/auth/indexing']
    );
    const webmastersToken = await getGoogleAccessToken(
      '/path/to/sa.json',
      ['https://www.googleapis.com/auth/webmasters']
    );
    // Same scope again — should hit cache
    const indexingAgain = await getGoogleAccessToken(
      '/path/to/sa.json',
      ['https://www.googleapis.com/auth/indexing']
    );

    expect(indexingToken).toBe('token_1');
    expect(webmastersToken).toBe('token_2');
    expect(indexingAgain).toBe('token_1'); // cached
    expect(mockFetch).toHaveBeenCalledTimes(2); // only 2 fetches, not 3
  });

  it('should throw error on invalid service account file', async () => {
    const { getGoogleAccessToken } = await import('../../src/auth/google.js');

    const mockReadFile = vi.mocked(readFile);
    mockReadFile.mockRejectedValue(new Error('ENOENT: file not found'));

    await expect(
      getGoogleAccessToken('/invalid/path.json', [
        'https://www.googleapis.com/auth/indexing',
      ])
    ).rejects.toThrow('ENOENT: file not found');
  });

  it('should throw error on token exchange failure', async () => {
    const { getGoogleAccessToken } = await import('../../src/auth/google.js');

    const mockReadFile = vi.mocked(readFile);
    mockReadFile.mockResolvedValue(JSON.stringify(mockServiceAccount));

    const mockSign = vi.mocked(jwt.sign);
    mockSign.mockReturnValue('mock.jwt.token' as any);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      getGoogleAccessToken('/path/to/service-account.json', [
        'https://www.googleapis.com/auth/indexing',
      ])
    ).rejects.toThrow('Failed to get access token: 401 Unauthorized');
  });
});
