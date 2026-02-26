import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { ConfigSchema, type Config } from './schema.js';

/**
 * Loads a .env.local file (KEY=VALUE lines) into process.env.
 * Skips comments, blank lines, and already-set vars (process.env takes precedence).
 *
 * Note: This mutates process.env for the lifetime of the process. For production CLI usage,
 * this is fine (the process exits after one command). For tests, ensure cleanup in afterEach.
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
 * Supports ${VAR:-default} syntax for optional vars with fallback values.
 * @throws Error if a referenced environment variable is not set (plain ${VAR} syntax only)
 */
function substituteEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (_match, expr: string) => {
      const defaultMatch = expr.match(/^([^:]+):-(.*)$/);
      if (defaultMatch) {
        const varName = defaultMatch[1]!;
        const fallback = defaultMatch[2]!;
        return process.env[varName] ?? fallback;
      }
      const value = process.env[expr];
      if (value === undefined) {
        throw new Error(`Environment variable "${expr}" is not set but referenced in config`);
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

  const config = result.data;

  // Strip API blocks where required fields are empty (from ${VAR:-} fallback).
  // This ensures downstream `if (!config.apis.google)` checks correctly skip
  // unconfigured APIs rather than attempting auth with empty credentials.
  if (config.apis.indexnow && !config.apis.indexnow.key) {
    config.apis.indexnow = undefined;
  }
  if (config.apis.google && (!config.apis.google.serviceAccountPath || !config.apis.google.siteUrl)) {
    config.apis.google = undefined;
  }
  if (config.apis.bing && !config.apis.bing.apiKey) {
    config.apis.bing = undefined;
  }
  if (config.apis.customSearch && (!config.apis.customSearch.apiKey || !config.apis.customSearch.engineId)) {
    config.apis.customSearch = undefined;
  }

  // Resolve relative serviceAccountPath from config directory
  if (config.apis.google?.serviceAccountPath) {
    const resolvedPath = resolve(configDir, config.apis.google.serviceAccountPath);
    config.apis.google.serviceAccountPath = resolvedPath;
    if (!existsSync(resolvedPath)) {
      throw new Error(`Google service account file not found: ${resolvedPath}`);
    }
  }

  return config;
}
