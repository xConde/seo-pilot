#!/usr/bin/env node
import { parseArgs } from './utils/args.js';
import { log } from './utils/logger.js';

const VERSION = '0.1.0';

const USAGE = `seo-pilot v${VERSION} — Organic SEO promotion CLI

Usage: seo-pilot <command> [options]

Commands:
  setup      Interactive credential setup wizard
  index      Submit URLs to search engines (IndexNow, Google, Bing)
  inspect    Check indexing status via Google URL Inspection API
  rank       Track keyword positions via Search Console
  discover   Find forum/directory engagement opportunities
  audit      Validate on-page SEO (meta, schema, links, sitemap)

Global options:
  --help     Show help for a command
  --version  Show version number
  --config   Path to config file (default: seo-pilot.config.json)

Examples:
  seo-pilot setup
  seo-pilot index --dry-run
  seo-pilot index --service indexnow
  seo-pilot inspect --url https://example.com/page
  seo-pilot rank --days 7
  seo-pilot discover --type forums
  seo-pilot audit --checks meta,schema`;

const COMMAND_HELP: Record<string, string> = {
  setup: `seo-pilot setup

  Interactive wizard to configure API credentials.
  Walks through IndexNow, Google Cloud, Bing, and Custom Search setup.
  Writes seo-pilot.config.json and .env.local.`,

  index: `seo-pilot index [options]

  Submit sitemap URLs to search engines for indexing.

  Options:
    --service <name>  Service to use: indexnow, google, bing, all (default: all)
    --dry-run         Show URLs without submitting
    --config <path>   Path to config file`,

  inspect: `seo-pilot inspect [options]

  Check indexing status via Google URL Inspection API.

  Options:
    --url <url>       Inspect a single URL (default: all sitemap URLs)
    --config <path>   Path to config file`,

  rank: `seo-pilot rank [options]

  Track keyword rankings via Google Search Console.

  Options:
    --days <n>        Date range in days (default: 28)
    --keyword <kw>    Filter to specific keyword
    --config <path>   Path to config file`,

  discover: `seo-pilot discover [options]

  Find engagement opportunities on forums and directories.

  Options:
    --type <type>     Search type: forums, directories, all (default: forums)
    --keyword <kw>    Filter to specific keyword
    --config <path>   Path to config file`,

  audit: `seo-pilot audit [options]

  Validate on-page SEO for site URLs.

  Options:
    --url <url>            Audit a single URL (default: all sitemap URLs)
    --checks <list>        Comma-separated checks: meta, schema, links, sitemap (default: all)
    --base-url <url>       Override site URL (e.g. for staging/preview deploys)
    --sitemap <url>        Override sitemap URL
    --config <path>        Path to config file`,
};

const args = parseArgs(process.argv.slice(2));

if (args.flags.version) {
  console.log(VERSION);
  process.exit(0);
}

if (args.flags.help) {
  if (args.command && COMMAND_HELP[args.command]) {
    console.log(COMMAND_HELP[args.command]);
  } else {
    console.log(USAGE);
  }
  process.exit(0);
}

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
  default:
    if (args.command) {
      log.error(`Unknown command: ${args.command}`);
      console.log(`Run 'seo-pilot --help' for usage information.`);
      process.exit(1);
    }
    console.log(USAGE);
    process.exit(0);
}
