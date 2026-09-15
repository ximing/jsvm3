import { OPCodeIdx } from '../opcodes/opIdx';
import type { Locator } from './locate';

const LINE_ID = OPCodeIdx.LINE;
const COLUMN_ID = OPCodeIdx.COLUMN;

export interface SymbolRange {
  ip: number;
  line: number;
  column: number;
  source: string | null;
}

export interface ScriptSymbol {
  script: number;
  name: string | null;
  fName: string | null;
  ranges: SymbolRange[];
}

export interface SymbolMap {
  version: 1;
  artifactId: string;
  filename: string;
  sources: Array<{ name: string; content: string }>;
  scripts: ScriptSymbol[];
}

export interface CrashFrame {
  script: number;
  name: string;
  fName: string;
  ip: number;
  line: number;
  column: number;
}

export interface CrashReport {
  artifactId?: string;
  error: { name: string; message: string };
  frames: CrashFrame[];
}

export interface SymbolicatedFrame {
  script: number;
  name: string;
  fName: string;
  ip: number;
  source: string | null;
  line: number;
  column: number;
  lineText: string | null;
  mapped: boolean;
}

export interface Symbolicated {
  artifactId?: string;
  mismatch: boolean;
  error: { name: string; message: string };
  frames: SymbolicatedFrame[];
}

interface MappedInstruction {
  id: number;
  name?: string;
  args?: Array<unknown> | null;
}

interface MappedScript {
  name: string | null;
  fName: string | null;
  instructions: MappedInstruction[];
  children: MappedScript[];
}

function rangesFor(script: MappedScript, locate: Locator): SymbolRange[] {
  const ranges: SymbolRange[] = [];
  let line = -1;
  let column = -1;
  let last = '';
  const instructions = script.instructions || [];
  for (let ip = 0; ip < instructions.length; ip++) {
    const ins = instructions[ip];
    const id = ins.id;
    const name = ins.name;
    if (name === 'LINE' || id === LINE_ID) {
      const next = ins.args && ins.args[0];
      line = typeof next === 'number' ? next : line;
    } else if (name === 'COLUMN' || id === COLUMN_ID) {
      const next = ins.args && ins.args[0];
      column = typeof next === 'number' ? next : column;
    } else if (ranges.length > 0) {
      continue;
    }
    const pos = locate(line, column);
    const key = `${pos.source || ''}:${pos.line}:${pos.column}`;
    if (key === last) {
      continue;
    }
    last = key;
    ranges.push({ ip, line: pos.line, column: pos.column, source: pos.source });
  }
  return ranges;
}

export function buildSymbolMap(
  script: MappedScript,
  locate: Locator,
  meta: { artifactId: string; filename: string; source: string }
): SymbolMap {
  const scripts: ScriptSymbol[] = [];
  const walk = (current: MappedScript) => {
    const index = scripts.length;
    scripts.push({
      script: index,
      name: current.name,
      fName: current.fName,
      ranges: rangesFor(current, locate),
    });
    const children = current.children || [];
    for (let i = 0; i < children.length; i++) {
      walk(children[i]);
    }
  };
  walk(script);
  return {
    version: 1,
    artifactId: meta.artifactId,
    filename: meta.filename,
    sources: [{ name: meta.filename, content: meta.source }],
    scripts,
  };
}

function rangeAt(ranges: SymbolRange[], ip: number): SymbolRange | null {
  let found: SymbolRange | null = null;
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    if (range.ip <= ip) {
      found = range;
    } else {
      break;
    }
  }
  return found;
}

function lineText(map: SymbolMap, source: string | null, line: number): string | null {
  if (!source || line < 1) {
    return null;
  }
  const file = map.sources.find((item) => item.name === source) || map.sources[0];
  if (!file) {
    return null;
  }
  const lines = file.content.split('\n');
  if (line > lines.length) {
    return null;
  }
  return lines[line - 1];
}

export function symbolicate(report: CrashReport, map: SymbolMap): Symbolicated {
  if (!map || map.version !== 1 || !Array.isArray(map.scripts)) {
    throw new TypeError('symbolicate expected a version 1 symbol map');
  }
  const frames = (report.frames || []).map((frame) => {
    const table = map.scripts.find((item) => item.script === frame.script);
    const range = table ? rangeAt(table.ranges, frame.ip) : null;
    const mapped = !!(range && range.line > 0 && range.source);
    const source = mapped && range ? range.source : frame.fName || null;
    const line = mapped && range ? range.line : frame.line;
    const column = mapped && range ? range.column : frame.column;
    return {
      script: frame.script,
      name: frame.name,
      fName: frame.fName,
      ip: frame.ip,
      source,
      line,
      column,
      lineText: mapped ? lineText(map, source, line) : null,
      mapped,
    };
  });
  return {
    artifactId: report.artifactId || map.artifactId,
    mismatch: !!(report.artifactId && map.artifactId && report.artifactId !== map.artifactId),
    error: report.error,
    frames,
  };
}

export function formatSymbolicated(result: Symbolicated): string {
  const lines = [`${result.error.name}: ${result.error.message}`];
  if (result.mismatch) {
    lines.push('    (report artifactId does not match this map)');
  }
  for (let i = 0; i < result.frames.length; i++) {
    const frame = result.frames[i];
    const name = frame.name || '<anonymous>';
    const where = frame.source ? `${frame.source}:${frame.line}:${frame.column}` : `ip ${frame.ip}`;
    lines.push(`    at ${name} (${where})`);
    if (frame.lineText) {
      lines.push(`      ${frame.lineText.trim()}`);
    }
  }
  return lines.join('\n');
}
