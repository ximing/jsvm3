import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { main } from '../src/cli';
import { fromJson } from '../src/utils/convert';
import { ARTIFACT_MAGIC } from '../src/artifact';
import { JSVM } from '../src/vm/vm';

const execRestored = function (json: unknown) {
  const vm = new JSVM();
  vm.exec(fromJson(json));
  return (vm.realm.globalObj as any).module.exports;
};

describe('cli compile', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsvm3-cli-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('format 0 output is a raw array loadable by fromJson', () => {
    const input = path.join(dir, 'in.js');
    const output = path.join(dir, 'out.json');
    fs.writeFileSync(input, 'module.exports = 1 + 2;');

    expect(main(['compile', input, '-o', output])).toBe(0);

    const json = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(Array.isArray(json)).toBe(true);
    expect((json as { magic?: string }).magic).toBeUndefined();

    expect(execRestored(json)).toEqual(3);
  });

  it('format 1 writes an envelope', () => {
    const input = path.join(dir, 'in.js');
    const output = path.join(dir, 'out.json');
    fs.writeFileSync(input, 'module.exports = 4;');

    expect(main(['compile', input, '-o', output, '--format', '1'])).toBe(0);

    const envelope = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(Array.isArray(envelope)).toBe(false);
    expect(envelope.magic).toBe(ARTIFACT_MAGIC);
    expect(envelope.format).toBe(1);
    expect(envelope.opcode).toBe(1);
    expect(Array.isArray(envelope.body)).toBe(true);

    expect(execRestored(envelope)).toEqual(4);
  });

  it('run compiles and prints module.exports', () => {
    const input = path.join(dir, 'in.js');
    fs.writeFileSync(input, 'module.exports = { ok: true };');
    const logs: unknown[] = [];
    const orig = console.log;
    console.log = (value?: unknown) => {
      logs.push(value);
    };
    try {
      expect(main(['run', input])).toBe(0);
    } finally {
      console.log = orig;
    }
    expect(logs).toEqual([JSON.stringify({ ok: true })]);
  });

  it('eval prints rexp via transformEXP', () => {
    const logs: unknown[] = [];
    const orig = console.log;
    console.log = (value?: unknown) => {
      logs.push(value);
    };
    try {
      expect(main(['eval', '1 + 2'])).toBe(0);
    } finally {
      console.log = orig;
    }
    expect(logs).toEqual([3]);
  });
});
