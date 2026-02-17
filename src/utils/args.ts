export interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positionals: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const command = argv.find((arg) => !arg.startsWith('--')) ?? '';
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  let skipNext = false;
  let foundCommand = false;

  for (let i = 0; i < argv.length; i++) {
    if (skipNext) {
      skipNext = false;
      continue;
    }

    const arg = argv[i];

    if (arg.startsWith('--')) {
      // Handle --flag=value
      if (arg.includes('=')) {
        const [key, value] = arg.slice(2).split('=');
        flags[key] = value;
      } else {
        const key = arg.slice(2);
        const nextArg = argv[i + 1];

        // After command, flags can consume values only if:
        // - We haven't seen the command yet (pre-command flags), OR
        // - Next arg exists, doesn't start with --, and comes before any more flags
        // Actually, let's use simpler rule: only consume if before command OR if next arg clearly isn't positional
        if (!foundCommand && nextArg && !nextArg.startsWith('--')) {
          flags[key] = nextArg;
          skipNext = true;
        } else if (
          foundCommand &&
          nextArg &&
          !nextArg.startsWith('--') &&
          !nextArg.includes('/')  && // Heuristic: paths likely positionals
          !nextArg.includes('.') // Heuristic: files likely positionals
        ) {
          flags[key] = nextArg;
          skipNext = true;
        } else {
          flags[key] = true;
        }
      }
    } else {
      // First non-flag is command
      if (!foundCommand) {
        foundCommand = true;
      } else {
        positionals.push(arg);
      }
    }
  }

  return { command, flags, positionals };
}
