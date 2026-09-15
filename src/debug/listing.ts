import { OPCodeIdx } from '../opcodes/opIdx';
import type { ScriptJson } from '../artifact/types';

const nameById: Record<number, string> = {};
const ids = OPCodeIdx as Record<string, number>;
for (const key of Object.keys(ids)) {
  nameById[ids[key]] = key;
}

/** Root-script listing for the admin. Device artifacts store numeric opcodes. */
export function listRoot(body: ScriptJson, limit = 80): string {
  const instructions = body[2] || [];
  const lines: string[] = [];
  const count = Math.min(instructions.length, limit);
  for (let ip = 0; ip < count; ip++) {
    const ins = instructions[ip];
    const id = ins[0];
    const name = typeof id === 'number' ? nameById[id] || String(id) : String(id);
    const args = ins
      .slice(1)
      .map((arg) => (arg === null ? 'null' : JSON.stringify(arg)))
      .join(' ');
    lines.push(`${String(ip).padStart(4, ' ')}  ${name}${args ? `  ${args}` : ''}`);
  }
  if (instructions.length > limit) {
    lines.push(`… ${instructions.length - limit} more`);
  }
  return lines.join('\n');
}
