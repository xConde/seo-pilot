import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { log } from '../../src/utils/logger.js';

describe('logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('info logs plain message', () => {
    log.info('test message');
    expect(consoleLogSpy).toHaveBeenCalledWith('test message');
  });

  it('success logs with ✓ prefix', () => {
    log.success('operation complete');
    expect(consoleLogSpy).toHaveBeenCalledWith('✓ operation complete');
  });

  it('warn logs with ⚠ prefix', () => {
    log.warn('warning message');
    expect(consoleLogSpy).toHaveBeenCalledWith('⚠ warning message');
  });

  it('error logs with ✗ prefix to stderr', () => {
    log.error('error message');
    expect(consoleErrorSpy).toHaveBeenCalledWith('✗ error message');
  });

  it('table formats headers and rows with alignment', () => {
    const headers = ['Name', 'Age', 'City'];
    const rows = [
      ['Alice', '30', 'NYC'],
      ['Bob', '25', 'SF'],
      ['Charlie', '35', 'LA'],
    ];

    log.table(headers, rows);

    expect(consoleLogSpy).toHaveBeenCalledTimes(5); // header + separator + 3 rows

    const calls = consoleLogSpy.mock.calls.map((call) => call[0]);

    // Check header
    expect(calls[0]).toBe('Name    | Age | City');

    // Check separator
    expect(calls[1]).toBe('--------+-----+-----');

    // Check rows
    expect(calls[2]).toBe('Alice   | 30  | NYC ');
    expect(calls[3]).toBe('Bob     | 25  | SF  ');
    expect(calls[4]).toBe('Charlie | 35  | LA  ');
  });

  it('table handles varying column widths', () => {
    const headers = ['Short', 'VeryLongHeader'];
    const rows = [['A', 'B']];

    log.table(headers, rows);

    const calls = consoleLogSpy.mock.calls.map((call) => call[0]);

    // Header should determine width
    expect(calls[0]).toBe('Short | VeryLongHeader');
    expect(calls[1]).toBe('------+---------------');
    expect(calls[2]).toBe('A     | B             ');
  });
});
