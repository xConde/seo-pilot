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
    if (!arg) continue;

    if (arg.startsWith('--')) {
      // Handle --flag=value
      if (arg.includes('=')) {
        const [key, value] = arg.slice(2).split('=');
        if (key) flags[key] = value ?? '';
      } else {
        const key = arg.slice(2);
        const nextArg = argv[i + 1];

        // Consume next arg as flag value if it exists and isn't another flag
        if (nextArg && !nextArg.startsWith('--')) {
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
