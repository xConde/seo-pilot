import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type HistoryEntry = {
  timestamp: string; // ISO 8601
  [key: string]: unknown;
};

const STATE_DIR_NAME = '.seo-pilot';

export function getStateDir(): string {
  return join(process.cwd(), STATE_DIR_NAME);
}

async function ensureStateDir(): Promise<void> {
  const stateDir = getStateDir();
  await mkdir(stateDir, { recursive: true });
}

export async function readHistory<T extends HistoryEntry>(filename: string): Promise<T[]> {
  await ensureStateDir();

  const filePath = join(getStateDir(), filename);

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as T[];
  } catch (error) {
    // File doesn't exist or is invalid - return empty array
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function writeHistory<T extends HistoryEntry>(
  filename: string,
  entries: T[]
): Promise<void> {
  await ensureStateDir();

  const filePath = join(getStateDir(), filename);
  const content = JSON.stringify(entries, null, 2);

  await writeFile(filePath, content, 'utf-8');
}

export async function appendHistory<T extends HistoryEntry>(
  filename: string,
  entries: T | T[]
): Promise<void> {
  const existing = await readHistory<T>(filename);
  const toAppend = Array.isArray(entries) ? entries : [entries];
  const updated = [...existing, ...toAppend];

  await writeHistory(filename, updated);
}
