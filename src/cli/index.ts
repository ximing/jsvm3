/**
 * Single full bin (jsvm3 compile / run / eval).
 * Device path A does not use the CLI — runtime-only devices load JSON via
 * jsvm3/runtime. This process may resolve Babel (COMPILER: true).
 */
import * as fs from 'fs';
import * as path from 'path';
import { compile, dumpArtifact, transformEXP } from 'jsvm3/compiler';
import { JSVM } from 'jsvm3/runtime';

export const USAGE = `Usage:
  jsvm3 compile <input.js> -o <out.json> [--format 0|1] [--no-hoisting] [--no-es5] [--debug] [--filename name]
  jsvm3 run <input.js> [--no-hoisting] [--no-es5] [--debug] [--filename name]
  jsvm3 eval <expr>

compile defaults to --format 0 (bare ScriptJson array). --format 1 writes a JSVM3 envelope.
run compiles then executes and prints module.exports (full path; may need Babel).
eval compiles an expression via transformEXP and prints exec's rexp.

Device path A does not use the CLI.`;

type Format = 0 | 1;

interface ParsedArgs {
  positionals: string[];
  format: Format;
  out?: string;
  hoisting: boolean;
  convertES5: boolean;
  debug: boolean;
  filename?: string;
  help: boolean;
}

function parseFormat(value: string | undefined): Format {
  if (value === '0') {
    return 0;
  }
  if (value === '1') {
    return 1;
  }
  throw new Error(`--format must be 0 or 1, got ${value ?? '(missing)'}`);
}

function takeValue(argv: string[], i: number, flag: string): { value: string; next: number } {
  const cur = argv[i];
  const eq = cur.indexOf('=');
  if (eq !== -1 && (cur.startsWith(`${flag}=`) || (flag === '-o' && cur.startsWith('-o=')))) {
    return { value: cur.slice(eq + 1), next: i };
  }
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('-')) {
    throw new Error(`${flag} requires a value`);
  }
  return { value: next, next: i + 1 };
}

export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    positionals: [],
    format: 0,
    hoisting: true,
    convertES5: true,
    debug: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      result.help = true;
      continue;
    }
    if (arg === '-o' || arg === '--out' || arg.startsWith('-o=') || arg.startsWith('--out=')) {
      const taken = takeValue(argv, i, arg.startsWith('--') ? '--out' : '-o');
      result.out = taken.value;
      i = taken.next;
      continue;
    }
    if (arg === '--format' || arg.startsWith('--format=')) {
      const taken = takeValue(argv, i, '--format');
      result.format = parseFormat(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--no-hoisting') {
      result.hoisting = false;
      continue;
    }
    if (arg === '--no-es5') {
      result.convertES5 = false;
      continue;
    }
    if (arg === '--debug') {
      result.debug = true;
      continue;
    }
    if (arg === '--filename' || arg.startsWith('--filename=')) {
      const taken = takeValue(argv, i, '--filename');
      result.filename = taken.value;
      i = taken.next;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}`);
    }
    result.positionals.push(arg);
  }
  return result;
}

function printValue(value: unknown) {
  if (typeof value === 'object' && value !== null) {
    console.log(JSON.stringify(value));
    return;
  }
  console.log(value);
}

function compileOptions(parsed: ParsedArgs, inputPath?: string) {
  return {
    format: parsed.format,
    hoisting: parsed.hoisting,
    convertES5: parsed.convertES5,
    debug: parsed.debug,
    filename: parsed.filename ?? (inputPath ? path.basename(inputPath) : undefined),
  };
}

function cmdCompile(parsed: ParsedArgs): number {
  if (parsed.help) {
    console.log(USAGE);
    return 0;
  }
  const input = parsed.positionals[0];
  if (!input) {
    throw new Error('compile requires <input.js>');
  }
  if (!parsed.out) {
    throw new Error('compile requires -o <out.json>');
  }
  const source = fs.readFileSync(input, 'utf8');
  const json = compile(source, compileOptions(parsed, input));
  fs.mkdirSync(path.dirname(parsed.out), { recursive: true });
  fs.writeFileSync(parsed.out, `${JSON.stringify(json, null, 2)}\n`);
  return 0;
}

function cmdRun(parsed: ParsedArgs): number {
  if (parsed.help) {
    console.log(USAGE);
    return 0;
  }
  const input = parsed.positionals[0];
  if (!input) {
    throw new Error('run requires <input.js>');
  }
  const source = fs.readFileSync(input, 'utf8');
  const json = compile(source, compileOptions(parsed, input));
  const vm = new JSVM();
  vm.exec(json);
  printValue((vm.realm.globalObj as { module: { exports: unknown } }).module.exports);
  return 0;
}

function cmdEval(parsed: ParsedArgs): number {
  if (parsed.help) {
    console.log(USAGE);
    return 0;
  }
  const expr = parsed.positionals.join(' ').trim();
  if (!expr) {
    throw new Error('eval requires <expr>');
  }
  // JSON is the only cross-entry currency (compiler Script + runtime exec).
  const json = dumpArtifact(transformEXP(expr));
  const vm = new JSVM();
  printValue(vm.exec(json));
  return 0;
}

export function main(argv: string[]): number {
  try {
    if (argv.length === 0) {
      console.error(USAGE);
      return 1;
    }
    const command = argv[0];
    if (command === '-h' || command === '--help') {
      console.log(USAGE);
      return 0;
    }
    const parsed = parseArgs(argv.slice(1));
    if (command === 'compile') {
      return cmdCompile(parsed);
    }
    if (command === 'run') {
      return cmdRun(parsed);
    }
    if (command === 'eval') {
      return cmdEval(parsed);
    }
    throw new Error(`unknown command: ${command}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return 1;
  }
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
