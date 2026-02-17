import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../src/utils/args.js';

describe('parseArgs', () => {
  it('parses command as first non-flag argument', () => {
    const result = parseArgs(['deploy', '--verbose']);
    expect(result.command).toBe('deploy');
  });

  it('parses --flag value format', () => {
    const result = parseArgs(['test', '--env', 'production']);
    expect(result.flags).toEqual({ env: 'production' });
  });

  it('parses --flag as boolean when no value follows', () => {
    const result = parseArgs(['test', '--verbose']);
    expect(result.flags).toEqual({ verbose: true });
  });

  it('parses --flag as boolean when next arg starts with --', () => {
    const result = parseArgs(['test', '--verbose', '--debug']);
    expect(result.flags).toEqual({ verbose: true, debug: true });
  });

  it('parses --flag=value format', () => {
    const result = parseArgs(['test', '--env=staging']);
    expect(result.flags).toEqual({ env: 'staging' });
  });

  it('collects remaining non-flag args as positionals', () => {
    const result = parseArgs(['deploy', '--env', 'prod', 'file1.txt', 'file2.txt']);
    expect(result.positionals).toEqual(['file1.txt', 'file2.txt']);
  });

  it('handles mixed flags and positionals', () => {
    const result = parseArgs(['build', '--output=dist', 'src/', 'main.ts', '--verbose']);
    expect(result.command).toBe('build');
    expect(result.flags).toEqual({ verbose: true, output: 'dist' });
    expect(result.positionals).toEqual(['src/', 'main.ts']);
  });

  it('returns empty command when no non-flag args present', () => {
    const result = parseArgs(['--verbose', '--debug']);
    expect(result.command).toBe('');
    expect(result.positionals).toEqual([]);
  });

  it('parses URL flag values with slashes', () => {
    const result = parseArgs(['inspect', '--url', 'https://example.com/page']);
    expect(result.command).toBe('inspect');
    expect(result.flags).toEqual({ url: 'https://example.com/page' });
  });

  it('parses file path flag values with slashes and dots', () => {
    const result = parseArgs(['index', '--config', './path/to/config.json']);
    expect(result.command).toBe('index');
    expect(result.flags).toEqual({ config: './path/to/config.json' });
  });

  it('parses multiple flags with URL and string values', () => {
    const result = parseArgs(['audit', '--url', 'https://example.com', '--checks', 'meta,schema']);
    expect(result.command).toBe('audit');
    expect(result.flags).toEqual({ url: 'https://example.com', checks: 'meta,schema' });
  });

  it('handles boolean flag followed by string flag', () => {
    const result = parseArgs(['index', '--dry-run', '--service', 'google']);
    expect(result.command).toBe('index');
    expect(result.flags).toEqual({ 'dry-run': true, service: 'google' });
  });

  it('handles multiple boolean flags', () => {
    const result = parseArgs(['index', '--dry-run', '--verbose']);
    expect(result.command).toBe('index');
    expect(result.flags).toEqual({ 'dry-run': true, verbose: true });
  });
});
