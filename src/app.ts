import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { JudgeProvider, SessionReport, Transcript } from './types.js';
import { createCouncil } from './council.js';
import { reviewTranscript } from './session.js';
import { report as renderReport, renderHtml } from './reporters/index.js';
import { BUILTIN_MEMBERS } from './members.js';

const VERSION = '0.1.0';
const PROVIDERS: JudgeProvider[] = ['heuristic', 'ollama', 'openai', 'anthropic'];

export interface RunIO {
  out: (line: string) => void;
  err: (line: string) => void;
}

const defaultIO: RunIO = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

interface ParsedArgs {
  command: string;
  file?: string;
  provider?: JudgeProvider;
  model?: string;
  html?: string;
  json: boolean;
  all: boolean;
  noColor: boolean;
  strict: boolean;
  minConfidence?: number;
  blockConfidence?: number;
  help: boolean;
  version: boolean;
  errors: string[];
}

const USAGE = 'Usage: quorum review <transcript.json> [options]';

const HELP = `quorum v${VERSION}
A council of critic-judges that supervises an AI agent: on-task, grounded, safe.

${USAGE}

Commands:
  review <transcript.json>   Replay an agent transcript through the council
  members                    List the built-in council members
  init                       Write a starter transcript.json

Options:
  -p, --provider <name>      heuristic | ollama | openai | anthropic (default: heuristic, free + offline)
  -m, --model <id>           Model id for LLM providers
      --html <path>          Write an interactive HTML session report
      --json                 Emit machine-readable JSON
      --all                  Show allowed steps too (default: flagged only)
      --strict               Exit non-zero if any step is blocked or escalated
      --min-confidence <n>   Min confidence for a violation to count (default 0.5)
      --block-confidence <n> Confidence at/above which a violation hard-blocks (default 0.85)
      --no-color             Disable colored output
  -v, --version              Print version
  -h, --help                 Print this help

A transcript is { "task": "...", "steps": [ { "kind", "content", "tool?", "context?" } ] }.

Exit codes: 0 ok, 1 blocked/escalated under --strict, 2 bad usage.`;

function parseArgs(argv: string[]): ParsedArgs {
  const res: ParsedArgs = {
    command: '',
    json: false,
    all: false,
    noColor: false,
    strict: false,
    help: false,
    version: false,
    errors: [],
  };
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i] ?? '';
    let inlineValue: string | undefined;
    const eq = arg.indexOf('=');
    if (arg.startsWith('--') && eq !== -1) {
      inlineValue = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    const takeValue = (): string => {
      if (inlineValue !== undefined) return inlineValue;
      const v = argv[i + 1];
      if (v === undefined) {
        res.errors.push(`Missing value for ${arg}`);
        return '';
      }
      i++;
      return v;
    };
    const takeNumber = (): number | undefined => {
      const n = Number(takeValue());
      if (Number.isNaN(n)) {
        res.errors.push(`${arg} expects a number`);
        return undefined;
      }
      return n;
    };

    switch (arg) {
      case '-h':
      case '--help':
        res.help = true;
        break;
      case '-v':
      case '--version':
        res.version = true;
        break;
      case '--json':
        res.json = true;
        break;
      case '--all':
        res.all = true;
        break;
      case '--no-color':
        res.noColor = true;
        break;
      case '--strict':
        res.strict = true;
        break;
      case '-p':
      case '--provider': {
        const p = takeValue();
        if ((PROVIDERS as string[]).includes(p)) res.provider = p as JudgeProvider;
        else if (p) res.errors.push(`Unknown provider: ${p}`);
        break;
      }
      case '-m':
      case '--model':
        res.model = takeValue();
        break;
      case '--html':
        res.html = takeValue();
        break;
      case '--min-confidence':
        res.minConfidence = takeNumber();
        break;
      case '--block-confidence':
        res.blockConfidence = takeNumber();
        break;
      default:
        if (arg.startsWith('-') && arg !== '-') res.errors.push(`Unknown option: ${arg}`);
        else positionals.push(arg);
    }
  }

  res.command = positionals[0] ?? '';
  res.file = positionals[1];
  return res;
}

function detectColor(noColor: boolean): boolean {
  return noColor ? false : !process.env.NO_COLOR && Boolean(process.stdout.isTTY);
}

function loadTranscript(path: string): Transcript {
  const data = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!data || typeof data !== 'object') throw new Error('transcript must be a JSON object');
  const t = data as Partial<Transcript>;
  if (typeof t.task !== 'string') throw new Error('transcript.task (string) is required');
  if (!Array.isArray(t.steps) || t.steps.length === 0) {
    throw new Error('transcript.steps must be a non-empty array');
  }
  for (const s of t.steps) {
    if (!s || typeof s.content !== 'string') throw new Error('each step needs a string "content"');
  }
  return t as Transcript;
}

const STARTER: Transcript = {
  task: 'Replace this with the goal you gave your agent.',
  steps: [
    { kind: 'thought', content: 'A reasoning step the agent took.' },
    { kind: 'tool_call', tool: 'read_file', content: 'read_file(path="data.csv")' },
    { kind: 'action', content: 'Run: rm -rf ./data' },
  ],
};

function cmdMembers(io: RunIO): number {
  for (const m of Object.values(BUILTIN_MEMBERS)) {
    io.out(`${m.id.padEnd(10)} ${m.description}`);
  }
  return 0;
}

function cmdInit(io: RunIO): number {
  const target = 'transcript.json';
  if (existsSync(target)) {
    io.err(`${target} already exists; refusing to overwrite.`);
    return 1;
  }
  writeFileSync(target, `${JSON.stringify(STARTER, null, 2)}\n`, 'utf8');
  io.out(`Created ${target}. Review it with: quorum review ${target}`);
  return 0;
}

async function cmdReview(opts: ParsedArgs, io: RunIO): Promise<number> {
  if (!opts.file) {
    io.err('review: provide a transcript JSON file.');
    io.err(USAGE);
    return 2;
  }
  let transcript: Transcript;
  try {
    transcript = loadTranscript(opts.file);
  } catch (e) {
    io.err(`Could not load ${opts.file}: ${(e as Error).message}`);
    return 2;
  }

  const council = createCouncil({
    provider: opts.provider ?? 'heuristic',
    model: opts.model,
    minConfidence: opts.minConfidence,
    blockConfidence: opts.blockConfidence,
  });

  let result: SessionReport;
  try {
    result = await reviewTranscript(council, transcript);
  } catch (e) {
    io.err(`Review failed: ${(e as Error).message}`);
    return 2;
  }

  if (opts.html) writeFileSync(opts.html, renderHtml(result), 'utf8');
  io.out(
    renderReport(opts.json ? 'json' : 'pretty', result, {
      color: detectColor(opts.noColor),
      all: opts.all,
    }),
  );
  if (opts.html && !opts.json) io.out(`\nHTML report written to ${opts.html}`);

  if (opts.strict && (result.counts.block > 0 || result.counts.escalate > 0)) return 1;
  return 0;
}

/** Run the Quorum CLI. Returns an exit code; testable with injected IO. */
export async function run(argv: string[], io: RunIO = defaultIO): Promise<number> {
  const opts = parseArgs(argv);

  if (opts.errors.length > 0) {
    for (const e of opts.errors) io.err(e);
    return 2;
  }
  if (opts.help || (!opts.command && !opts.version)) {
    io.out(HELP);
    return 0;
  }
  if (opts.version) {
    io.out(VERSION);
    return 0;
  }

  switch (opts.command) {
    case 'review':
      return cmdReview(opts, io);
    case 'members':
      return cmdMembers(io);
    case 'init':
      return cmdInit(io);
    default:
      io.err(`Unknown command: ${opts.command}`);
      io.err(USAGE);
      return 2;
  }
}
