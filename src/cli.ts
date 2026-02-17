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
  case 'setup': {
    const { runSetup } = await import('./commands/setup.js');
    await runSetup();
    break;
  }
  case 'inspect': {
    const { runInspect } = await import('./commands/inspect.js');
    await runInspect(args.flags);
    break;
  }
  case 'rank': {
    const { runRank } = await import('./commands/rank.js');
    await runRank(args.flags);
    break;
  }
  case 'discover': {
    const { runDiscover } = await import('./commands/discover.js');
    await runDiscover(args.flags);
    break;
  }
  case 'audit': {
    const { runAudit } = await import('./commands/audit.js');
    await runAudit(args.flags);
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
