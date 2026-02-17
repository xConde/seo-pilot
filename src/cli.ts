#!/usr/bin/env node
import { parseArgs } from './utils/args.js';
import { log } from './utils/logger.js';

const args = parseArgs(process.argv.slice(2));

switch (args.command) {
  case 'index': {
    const { runIndex } = await import('./commands/index.js');
    await runIndex(args.flags);
    break;
  }
  // Other commands will be added later
  default:
    if (args.command) {
      log.error(`Unknown command: ${args.command}`);
    }
    // Print usage
    console.log('Usage: seo-pilot <command> [options]');
    console.log('Commands: index, inspect, rank, discover, audit, setup');
    process.exit(args.command ? 1 : 0);
}
