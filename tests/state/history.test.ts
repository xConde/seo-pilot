import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readHistory,
  writeHistory,
  appendHistory,
  getStateDir,
  type HistoryEntry,
} from '../../src/state/history.js';

interface TestEntry extends HistoryEntry {
  action: string;
  url?: string;
}

describe('history', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Create temp directory
    tempDir = await mkdtemp(join(tmpdir(), 'seo-pilot-test-'));

    // Mock process.cwd() to return temp directory
    originalCwd = process.cwd();
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    // Restore original cwd
    vi.mocked(process.cwd).mockRestore();

    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  it('getStateDir returns correct path', () => {
    const stateDir = getStateDir();
    expect(stateDir).toBe(join(tempDir, '.seo-pilot'));
  });

  it('readHistory returns empty array for non-existent file', async () => {
    const entries = await readHistory<TestEntry>('test.json');
    expect(entries).toEqual([]);
  });

  it('writeHistory creates file with entries', async () => {
    const testEntries: TestEntry[] = [
      { timestamp: '2026-02-16T10:00:00Z', action: 'test' },
      { timestamp: '2026-02-16T10:01:00Z', action: 'test2', url: 'https://example.com' },
    ];

    await writeHistory('test.json', testEntries);

    const read = await readHistory<TestEntry>('test.json');
    expect(read).toEqual(testEntries);
  });

  it('readHistory returns written entries', async () => {
    const testEntries: TestEntry[] = [
      { timestamp: '2026-02-16T10:00:00Z', action: 'index' },
    ];

    await writeHistory('entries.json', testEntries);
    const read = await readHistory<TestEntry>('entries.json');

    expect(read).toHaveLength(1);
    expect(read[0].timestamp).toBe('2026-02-16T10:00:00Z');
    expect(read[0].action).toBe('index');
  });

  it('appendHistory adds single entry to existing entries', async () => {
    const initial: TestEntry[] = [
      { timestamp: '2026-02-16T10:00:00Z', action: 'first' },
    ];

    await writeHistory('append.json', initial);

    const newEntry: TestEntry = {
      timestamp: '2026-02-16T10:05:00Z',
      action: 'second',
    };

    await appendHistory('append.json', newEntry);

    const read = await readHistory<TestEntry>('append.json');
    expect(read).toHaveLength(2);
    expect(read[0].action).toBe('first');
    expect(read[1].action).toBe('second');
  });

  it('appendHistory adds multiple entries to existing entries', async () => {
    const initial: TestEntry[] = [
      { timestamp: '2026-02-16T10:00:00Z', action: 'first' },
    ];

    await writeHistory('append-multi.json', initial);

    const newEntries: TestEntry[] = [
      { timestamp: '2026-02-16T10:05:00Z', action: 'second' },
      { timestamp: '2026-02-16T10:10:00Z', action: 'third' },
    ];

    await appendHistory('append-multi.json', newEntries);

    const read = await readHistory<TestEntry>('append-multi.json');
    expect(read).toHaveLength(3);
    expect(read.map(e => e.action)).toEqual(['first', 'second', 'third']);
  });

  it('appendHistory works with non-existent file', async () => {
    const entry: TestEntry = {
      timestamp: '2026-02-16T10:00:00Z',
      action: 'initial',
    };

    await appendHistory('new.json', entry);

    const read = await readHistory<TestEntry>('new.json');
    expect(read).toHaveLength(1);
    expect(read[0].action).toBe('initial');
  });
});
