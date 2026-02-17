import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { ConfigSchema, type Config } from './schema.js';

/**
 * Loads a .env.local file (KEY=VALUE lines) into process.env.
 * Skips comments, blank lines, and already-set vars (process.env takes precedence).
 */
function loadEnvFile(envPath: string): void {
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();

    // Don't overwrite existing env vars — explicit env always wins
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Recursively substitutes ${VAR} patterns in string values with environment variables.
 * @throws Error if a referenced environment variable is not set
 */
function substituteEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const value = process.env[varName];
      if (value === undefined) {
        throw new Error(`Environment variable "${varName}" is not set but referenced in config`);
      }
      return value;
    });
  }

  if (Array.isArray(obj)) {
    return obj.map(item => substituteEnvVars(item));
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVars(value);
    }
    return result;
  }

  return obj;
}

/**
 * Loads and validates the seo-pilot configuration file.
 * @param path - Path to config file (defaults to seo-pilot.config.json in cwd)
 * @returns Validated and typed configuration object
 * @throws Error if file not found, invalid JSON, validation fails, or env vars missing
 */
export function loadConfig(path?: string): Config {
  const configPath = resolve(path ?? 'seo-pilot.config.json');

  // Load .env.local from same directory as config file before substitution
  const configDir = dirname(configPath);
  loadEnvFile(resolve(configDir, '.env.local'));

  let fileContent: string;
  try {
    fileContent = readFileSync(configPath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Config file not found: ${configPath}`);
    }
    throw error;
  }

  let rawConfig: unknown;
  try {
    rawConfig = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Invalid JSON in config file: ${configPath}`);
  }

  const configWithEnv = substituteEnvVars(rawConfig);
  const result = ConfigSchema.safeParse(configWithEnv);

  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Config validation failed: ${errors}`);
  }

  return result.data;
}
