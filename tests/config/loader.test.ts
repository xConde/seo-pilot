import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../../src/config/loader.js';

const TEST_DIR = join(process.cwd(), 'tests/config/.tmp');
const TEST_CONFIG_PATH = join(TEST_DIR, 'test-config.json');

describe('loadConfig', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('loads a valid config file', () => {
    const config = {
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
    const result = loadConfig(TEST_CONFIG_PATH);

    expect(result.version).toBe('1');
    expect(result.site.url).toBe('https://example.com');
    expect(result.site.sitemap).toBe('https://example.com/sitemap.xml');
  });

  it('substitutes environment variables', () => {
    vi.stubEnv('TEST_URL', 'https://test.com');
    vi.stubEnv('TEST_API_KEY', 'secret-key');

    const config = {
      version: '1',
      site: {
        url: '${TEST_URL}',
        sitemap: '${TEST_URL}/sitemap.xml',
      },
      apis: {
        indexnow: {
          key: '${TEST_API_KEY}',
        },
      },
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
    const result = loadConfig(TEST_CONFIG_PATH);

    expect(result.site.url).toBe('https://test.com');
    expect(result.site.sitemap).toBe('https://test.com/sitemap.xml');
    expect(result.apis.indexnow?.key).toBe('secret-key');
  });

  it('substitutes environment variables in arrays', () => {
    vi.stubEnv('KEYWORD_1', 'seo');
    vi.stubEnv('KEYWORD_2', 'marketing');

    const config = {
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      keywords: ['${KEYWORD_1}', '${KEYWORD_2}'],
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
    const result = loadConfig(TEST_CONFIG_PATH);

    expect(result.keywords).toEqual(['seo', 'marketing']);
  });

  it('throws error when environment variable is missing', () => {
    const config = {
      version: '1',
      site: {
        url: '${MISSING_VAR}',
        sitemap: 'https://example.com/sitemap.xml',
      },
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

    expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
      'Environment variable "MISSING_VAR" is not set but referenced in config'
    );
  });

  it('throws error when config file is not found', () => {
    expect(() => loadConfig('/nonexistent/path/config.json')).toThrow(
      'Config file not found'
    );
  });

  it('throws error when config file contains invalid JSON', () => {
    writeFileSync(TEST_CONFIG_PATH, '{ invalid json }');

    expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
      'Invalid JSON in config file'
    );
  });

  it('throws error when config fails validation', () => {
    const invalidConfig = {
      version: '1',
      // missing required site field
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(invalidConfig));

    expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
      'Config validation failed'
    );
  });

  it('loads .env.local from config directory before substitution', () => {
    // Write .env.local alongside config
    const envPath = join(TEST_DIR, '.env.local');
    writeFileSync(envPath, 'MY_SECRET_KEY=loaded-from-env-file\n');

    const config = {
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      apis: {
        indexnow: {
          key: '${MY_SECRET_KEY}',
        },
      },
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
    const result = loadConfig(TEST_CONFIG_PATH);

    expect(result.apis.indexnow?.key).toBe('loaded-from-env-file');

    // Cleanup: remove from process.env so it doesn't leak
    delete process.env.MY_SECRET_KEY;
  });

  it('does not overwrite existing env vars with .env.local values', () => {
    vi.stubEnv('EXISTING_VAR', 'from-environment');

    const envPath = join(TEST_DIR, '.env.local');
    writeFileSync(envPath, 'EXISTING_VAR=from-env-file\n');

    const config = {
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      apis: {
        indexnow: {
          key: '${EXISTING_VAR}',
        },
      },
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
    const result = loadConfig(TEST_CONFIG_PATH);

    // Explicit env var wins over .env.local
    expect(result.apis.indexnow?.key).toBe('from-environment');
  });

  it('skips comments and blank lines in .env.local', () => {
    const envPath = join(TEST_DIR, '.env.local');
    writeFileSync(envPath, '# This is a comment\n\nENV_TEST_VAR=works\n');

    const config = {
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      apis: {
        indexnow: {
          key: '${ENV_TEST_VAR}',
        },
      },
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
    const result = loadConfig(TEST_CONFIG_PATH);

    expect(result.apis.indexnow?.key).toBe('works');

    delete process.env.ENV_TEST_VAR;
  });

  it('uses default path when no path is provided', () => {
    const defaultPath = join(process.cwd(), 'seo-pilot.config.json');
    const config = {
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
    };

    writeFileSync(defaultPath, JSON.stringify(config));

    try {
      const result = loadConfig();
      expect(result.version).toBe('1');
    } finally {
      unlinkSync(defaultPath);
    }
  });

  it('supports optional env vars with default syntax', () => {
    const config = {
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      apis: {
        indexnow: {
          key: '${OPTIONAL_KEY:-fallback-key}',
        },
      },
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
    const result = loadConfig(TEST_CONFIG_PATH);

    expect(result.apis.indexnow?.key).toBe('fallback-key');
  });

  it('uses env var value over default when var is set', () => {
    vi.stubEnv('SET_VAR', 'real-value');

    const config = {
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      apis: {
        indexnow: {
          key: '${SET_VAR:-fallback}',
        },
      },
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
    const result = loadConfig(TEST_CONFIG_PATH);

    expect(result.apis.indexnow?.key).toBe('real-value');
  });

  it('strips API blocks when ${VAR:-} resolves to empty string', () => {
    const config = {
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      apis: {
        indexnow: {
          key: '${EMPTY_DEFAULT:-}',
        },
      },
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
    const result = loadConfig(TEST_CONFIG_PATH);

    // Empty key means unconfigured — block should be stripped
    expect(result.apis.indexnow).toBeUndefined();
  });

  it('throws when service account file does not exist', () => {
    vi.stubEnv('GOOGLE_SA_PATH', '/nonexistent/service-account.json');

    const config = {
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      apis: {
        google: {
          serviceAccountPath: '${GOOGLE_SA_PATH}',
          siteUrl: 'https://example.com',
        },
      },
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

    expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
      'Google service account file not found'
    );
  });

  it('resolves relative serviceAccountPath from config directory', () => {
    // Create a fake service account file in the test dir
    const saPath = join(TEST_DIR, 'creds.json');
    writeFileSync(saPath, JSON.stringify({ type: 'service_account' }));

    const config = {
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      apis: {
        google: {
          serviceAccountPath: './creds.json',
          siteUrl: 'https://example.com',
        },
      },
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
    const result = loadConfig(TEST_CONFIG_PATH);

    // Should resolve relative to config dir, not cwd
    expect(result.apis.google?.serviceAccountPath).toBe(saPath);
  });

  it('strips API blocks with empty string values from optional env vars', () => {
    const config = {
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      apis: {
        indexnow: { key: '' },
        google: { serviceAccountPath: '', siteUrl: '' },
        bing: { apiKey: '', siteUrl: 'https://example.com' },
        customSearch: { apiKey: '', engineId: '' },
      },
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
    const result = loadConfig(TEST_CONFIG_PATH);

    // All API blocks should be stripped — empty strings mean unconfigured
    expect(result.apis.indexnow).toBeUndefined();
    expect(result.apis.google).toBeUndefined();
    expect(result.apis.bing).toBeUndefined();
    expect(result.apis.customSearch).toBeUndefined();
  });

  it('keeps API blocks with valid values alongside empty optional ones', () => {
    vi.stubEnv('REAL_KEY', 'my-indexnow-key');

    const config = {
      version: '1',
      site: {
        url: 'https://example.com',
        sitemap: 'https://example.com/sitemap.xml',
      },
      apis: {
        indexnow: { key: '${REAL_KEY}' },
        google: { serviceAccountPath: '', siteUrl: '' },
      },
    };

    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
    const result = loadConfig(TEST_CONFIG_PATH);

    // IndexNow should survive, Google should be stripped
    expect(result.apis.indexnow?.key).toBe('my-indexnow-key');
    expect(result.apis.google).toBeUndefined();
  });
});
