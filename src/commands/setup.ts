import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { writeFile, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { log } from '../utils/logger.js';
import { getGoogleAccessToken } from '../auth/google.js';

interface SetupConfig {
  siteUrl: string;
  sitemapUrl: string;
  keywords: string[];
  indexnowKey?: string;
  googleServiceAccountPath?: string;
  googleSiteUrl?: string;
  bingApiKey?: string;
  customSearchApiKey?: string;
  customSearchEngineId?: string;
}

async function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

async function validateUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function promptSiteConfig(rl: ReturnType<typeof createInterface>): Promise<Pick<SetupConfig, 'siteUrl' | 'sitemapUrl'>> {
  log.info('\n=== Site Configuration ===\n');

  let siteUrl = '';
  while (!siteUrl) {
    const url = await prompt(rl, 'Site URL (e.g., https://example.com): ');
    if (!url) {
      log.error('Site URL is required');
      continue;
    }

    log.info('Validating site URL...');
    if (await validateUrl(url)) {
      log.success('Site URL is reachable');
      siteUrl = url;
    } else {
      log.error('Site URL is not reachable (expected 200 response)');
    }
  }

  let sitemapUrl = '';
  while (!sitemapUrl) {
    const url = await prompt(rl, 'Sitemap URL (e.g., https://example.com/sitemap.xml): ');
    if (!url) {
      log.error('Sitemap URL is required');
      continue;
    }

    log.info('Validating sitemap URL...');
    if (await validateUrl(url)) {
      log.success('Sitemap URL is reachable');
      sitemapUrl = url;
    } else {
      log.error('Sitemap URL is not reachable (expected 200 response)');
    }
  }

  return { siteUrl, sitemapUrl };
}

async function promptKeywords(rl: ReturnType<typeof createInterface>): Promise<string[]> {
  log.info('\n=== Target Keywords ===\n');

  const input = await prompt(rl, 'Target keywords (comma-separated): ');
  if (!input) {
    return [];
  }

  return input.split(',').map(k => k.trim()).filter(Boolean);
}

async function promptIndexNow(rl: ReturnType<typeof createInterface>, siteUrl: string): Promise<string | undefined> {
  log.info('\n=== IndexNow Configuration ===\n');

  const configure = await prompt(rl, 'Configure IndexNow? (y/n): ');
  if (configure.toLowerCase() !== 'y') {
    return undefined;
  }

  const key = randomBytes(16).toString('hex');
  const host = new URL(siteUrl).host;
  const keyFileUrl = `https://${host}/${key}.txt`;

  log.info(`\nGenerated IndexNow key: ${key}`);
  log.info(`\nPlease add a file named "${key}.txt" to your site's public directory.`);
  log.info(`The file should contain just: ${key}`);
  log.info(`It should be accessible at: ${keyFileUrl}\n`);

  let confirmed = false;
  while (!confirmed) {
    const deployed = await prompt(rl, 'Have you deployed the key file? (y/n): ');
    if (deployed.toLowerCase() !== 'y') {
      log.warn('Skipping IndexNow configuration. You can configure it later.');
      return undefined;
    }

    log.info('Validating key file...');
    try {
      const response = await fetch(keyFileUrl);
      if (response.ok) {
        const content = await response.text();
        if (content.trim() === key) {
          log.success('Key file is valid');
          confirmed = true;
        } else {
          log.error('Key file content does not match the generated key');
        }
      } else {
        log.error(`Key file is not accessible (HTTP ${response.status})`);
      }
    } catch {
      log.error('Failed to fetch key file');
    }
  }

  return key;
}

async function promptGoogleCloud(rl: ReturnType<typeof createInterface>): Promise<Pick<SetupConfig, 'googleServiceAccountPath' | 'googleSiteUrl'>> {
  log.info('\n=== Google Cloud Configuration ===\n');

  const configure = await prompt(rl, 'Configure Google Cloud APIs? (y/n): ');
  if (configure.toLowerCase() !== 'y') {
    return {};
  }

  log.info('\nPlease complete the following steps:');
  log.info('1. Create a project: https://console.cloud.google.com/projectcreate');
  log.info('2. Enable the following APIs:');
  log.info('   - Web Search Indexing API');
  log.info('   - Google Search Console API');
  log.info('   - Custom Search API');
  log.info('3. Create a service account and download the JSON key file');
  log.info('4. Add the service account email as Owner in Search Console\n');

  const serviceAccountPath = await prompt(rl, 'Path to service account JSON file (or press Enter to skip): ');
  if (!serviceAccountPath) {
    return {};
  }

  try {
    const content = await readFile(resolve(serviceAccountPath), 'utf-8');
    const json = JSON.parse(content);

    if (!json.client_email || !json.private_key) {
      log.error('Invalid service account file (missing client_email or private_key)');
      return {};
    }

    log.success('Service account file is valid');
  } catch {
    log.error('Failed to read or parse service account file');
    return {};
  }

  const siteUrl = await prompt(rl, 'Search Console site URL (e.g., sc-domain:example.com): ');
  if (!siteUrl) {
    log.warn('Skipping Google Cloud configuration (site URL required)');
    return {};
  }

  return {
    googleServiceAccountPath: serviceAccountPath,
    googleSiteUrl: siteUrl,
  };
}

async function promptBingWebmaster(rl: ReturnType<typeof createInterface>, siteUrl: string): Promise<string | undefined> {
  log.info('\n=== Bing Webmaster Configuration ===\n');

  const configure = await prompt(rl, 'Configure Bing Webmaster? (y/n): ');
  if (configure.toLowerCase() !== 'y') {
    return undefined;
  }

  log.info('\nTo get your API key:');
  log.info('1. Visit https://www.bing.com/webmasters');
  log.info('2. Navigate to Settings > API Access');
  log.info('3. Generate an API key\n');

  const apiKey = await prompt(rl, 'Bing API key (or press Enter to skip): ');
  return apiKey || undefined;
}

async function promptCustomSearch(rl: ReturnType<typeof createInterface>): Promise<Pick<SetupConfig, 'customSearchApiKey' | 'customSearchEngineId'>> {
  log.info('\n=== Custom Search Engine Configuration ===\n');

  const configure = await prompt(rl, 'Configure Custom Search Engine? (y/n): ');
  if (configure.toLowerCase() !== 'y') {
    return {};
  }

  log.info('\nTo create a Custom Search Engine:');
  log.info('1. Visit https://programmablesearchengine.google.com/');
  log.info('2. Create a new search engine');
  log.info('3. Get your API key from Google Cloud Console');
  log.info('4. Note your Engine ID\n');

  const apiKey = await prompt(rl, 'Custom Search API key (or press Enter to skip): ');
  if (!apiKey) {
    return {};
  }

  const engineId = await prompt(rl, 'Custom Search Engine ID (or press Enter to skip): ');
  if (!engineId) {
    return {};
  }

  return {
    customSearchApiKey: apiKey,
    customSearchEngineId: engineId,
  };
}

async function writeConfigFiles(config: SetupConfig): Promise<void> {
  log.info('\n=== Writing Configuration Files ===\n');

  // Build config object
  const configObj: Record<string, unknown> = {
    version: '1.0.0',
    site: {
      url: config.siteUrl,
      sitemap: config.sitemapUrl,
    },
    keywords: config.keywords,
    apis: {},
  };

  const envVars: Record<string, string> = {};

  // IndexNow
  if (config.indexnowKey) {
    (configObj.apis as Record<string, unknown>).indexnow = {
      key: config.indexnowKey,
    };
  }

  // Google Cloud
  if (config.googleServiceAccountPath && config.googleSiteUrl) {
    (configObj.apis as Record<string, unknown>).google = {
      serviceAccountPath: config.googleServiceAccountPath,
      siteUrl: config.googleSiteUrl,
    };
  }

  // Bing
  if (config.bingApiKey) {
    (configObj.apis as Record<string, unknown>).bing = {
      apiKey: '${BING_API_KEY}',
      siteUrl: config.siteUrl,
    };
    envVars.BING_API_KEY = config.bingApiKey;
  }

  // Custom Search
  if (config.customSearchApiKey && config.customSearchEngineId) {
    (configObj.apis as Record<string, unknown>).customSearch = {
      apiKey: '${CUSTOM_SEARCH_API_KEY}',
      engineId: '${CUSTOM_SEARCH_ENGINE_ID}',
    };
    envVars.CUSTOM_SEARCH_API_KEY = config.customSearchApiKey;
    envVars.CUSTOM_SEARCH_ENGINE_ID = config.customSearchEngineId;
  }

  // Write config file
  const configPath = resolve('seo-pilot.config.json');
  await writeFile(configPath, JSON.stringify(configObj, null, 2) + '\n', 'utf-8');
  log.success(`Wrote configuration to ${configPath}`);

  // Write .env.local if there are env vars
  if (Object.keys(envVars).length > 0) {
    const envPath = resolve('.env.local');
    const envContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n';
    await writeFile(envPath, envContent, 'utf-8');
    log.success(`Wrote environment variables to ${envPath}`);
  }
}

async function validateApis(config: SetupConfig): Promise<void> {
  log.info('\n=== Validating API Configuration ===\n');

  // IndexNow - validate key file is accessible
  if (config.indexnowKey) {
    try {
      const host = new URL(config.siteUrl).host;
      const keyFileUrl = `https://${host}/${config.indexnowKey}.txt`;
      const response = await fetch(keyFileUrl);
      if (response.ok) {
        const content = await response.text();
        if (content.trim() === config.indexnowKey) {
          log.success('IndexNow: Valid (key file verified)');
        } else {
          log.error('IndexNow: Failed (key file content mismatch)');
        }
      } else {
        log.error(`IndexNow: Failed (key file returned HTTP ${response.status})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error(`IndexNow: Failed (${message})`);
    }
  }

  // Google Cloud - validate service account can get access token
  if (config.googleServiceAccountPath && config.googleSiteUrl) {
    try {
      const scopes = ['https://www.googleapis.com/auth/indexing'];
      await getGoogleAccessToken(config.googleServiceAccountPath, scopes);
      log.success('Google Cloud: Valid (service account authenticated)');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Google Cloud: Failed (${message})`);
    }
  }

  // Bing - validate API key with test URL submission
  if (config.bingApiKey) {
    try {
      const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrl?apikey=${config.bingApiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteUrl: config.siteUrl,
          url: config.siteUrl,
        }),
      });

      if (response.ok) {
        log.success('Bing Webmaster: Valid (API key authenticated)');
      } else {
        const errorText = await response.text();
        log.error(`Bing Webmaster: Failed (HTTP ${response.status}: ${errorText})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Bing Webmaster: Failed (${message})`);
    }
  }

  // Custom Search - validate with test query
  if (config.customSearchApiKey && config.customSearchEngineId) {
    try {
      const query = `site:${new URL(config.siteUrl).host}`;
      const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${config.customSearchApiKey}&cx=${config.customSearchEngineId}&num=1`;
      const response = await fetch(url);

      if (response.ok) {
        log.success('Custom Search Engine: Valid (credentials authenticated)');
      } else {
        const errorText = await response.text();
        log.error(`Custom Search Engine: Failed (HTTP ${response.status}: ${errorText})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Custom Search Engine: Failed (${message})`);
    }
  }

  if (!config.indexnowKey && !config.googleServiceAccountPath && !config.bingApiKey && !config.customSearchApiKey) {
    log.warn('No APIs configured. Commands will run with limited functionality.');
  }
}

export async function runSetup(): Promise<void> {
  const rl = createInterface({ input, output });

  try {
    log.info('SEO Pilot Setup Wizard');
    log.info('======================\n');

    const siteConfig = await promptSiteConfig(rl);
    const keywords = await promptKeywords(rl);
    const indexnowKey = await promptIndexNow(rl, siteConfig.siteUrl);
    const googleConfig = await promptGoogleCloud(rl);
    const bingApiKey = await promptBingWebmaster(rl, siteConfig.siteUrl);
    const customSearchConfig = await promptCustomSearch(rl);

    const config: SetupConfig = {
      ...siteConfig,
      keywords,
      indexnowKey,
      ...googleConfig,
      bingApiKey,
      ...customSearchConfig,
    };

    await writeConfigFiles(config);
    await validateApis(config);

    log.info('\n=== Setup Complete ===\n');
    log.success('Configuration files created successfully!');
    log.info('\nYou can now run: seo-pilot <command>');
    log.info('Available commands: index, inspect, rank, discover, audit');
  } finally {
    rl.close();
  }
}
