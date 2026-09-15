import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { compile, compileWithMap, formatSymbolicated, reportFromError, symbolicate } from '../src/compiler';
import { JSVM } from '../src/vm/vm';
import { JSVMError } from '../src/utils/errors';
import { main } from '../src/cli';

const BLOW = ['function blow(x) {', '  return x.missingProp;', '}', 'module.exports = blow(null);'].join(
  '\n'
);

const ARROW = [
  'const blow = (x) => {',
  '  return x.missingProp;',
  '};',
  'module.exports = blow(null);',
].join('\n');

function crash(source: string, filename: string) {
  const { artifact, map } = compileWithMap(source, {
    filename,
    format: 1,
    sourceMap: true,
    convertES5: false,
  });
  if (Array.isArray(artifact) || !map) {
    throw new Error('expected envelope and map');
  }
  const vm = new JSVM();
  let caught: unknown;
  try {
    vm.exec(artifact);
  } catch (err) {
    caught = err;
  }
  if (!(caught instanceof JSVMError)) {
    throw new Error('expected JSVMError');
  }
  const report = reportFromError(caught);
  return { artifact, map, report, symbolicated: symbolicate(report, map) };
}

describe('symbol map', () => {
  it('stamps a stable artifactId on format 1 and leaves it off format 0', () => {
    const first = compile('module.exports = 1;', { format: 1, filename: 'a.js' });
    const second = compile('module.exports = 1;', { format: 1, filename: 'a.js' });
    const changed = compile('module.exports = 2;', { format: 1, filename: 'a.js' });
    const bare = compile('module.exports = 1;', { filename: 'a.js' });
    if (Array.isArray(first) || Array.isArray(second) || Array.isArray(changed)) {
      throw new Error('expected envelopes');
    }
    expect(first.artifactId).toMatch(/^[a-f0-9]{32}$/);
    expect(second.artifactId).toBe(first.artifactId);
    expect(changed.artifactId).not.toBe(first.artifactId);
    expect(Array.isArray(bare)).toBe(true);
    expect((first as { debug?: unknown }).debug).toBeUndefined();
  });

  it('maps a throw inside a function back to the author line', () => {
    const { artifact, map, report, symbolicated } = crash(BLOW, 'rule.js');
    expect(report.artifactId).toBe(artifact.artifactId);
    expect(map.artifactId).toBe(artifact.artifactId);
    expect(map.sources[0].content).toBe(BLOW);
    const blow = symbolicated.frames.find((frame) => frame.name === 'blow');
    expect(blow).toBeTruthy();
    expect(blow!.mapped).toBe(true);
    expect(blow!.line).toBe(2);
    expect(blow!.source).toBe('rule.js');
    expect(blow!.lineText).toContain('missingProp');
    expect(symbolicated.mismatch).toBe(false);
    expect(formatSymbolicated(symbolicated)).toContain('rule.js:2:');
  });

  it('follows Babel downleveling back to the original arrow-function line', () => {
    const { artifact, map } = compileWithMap(ARROW, {
      filename: 'arrow.js',
      format: 1,
      sourceMap: true,
      convertES5: true,
    });
    if (Array.isArray(artifact) || !map) {
      throw new Error('expected envelope and map');
    }
    const vm = new JSVM();
    let caught: unknown;
    try {
      vm.exec(artifact);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(JSVMError);
    const symbolicated = symbolicate(reportFromError(caught as JSVMError), map);
    const frame = symbolicated.frames.find((item) => item.line === 2 && item.mapped);
    expect(frame).toBeTruthy();
    expect(frame!.lineText).toContain('missingProp');
  });

  it('embeds the author source only when debug is set', () => {
    const { artifact, map } = compileWithMap(BLOW, {
      filename: 'rule.js',
      format: 1,
      debug: true,
      convertES5: false,
    });
    if (Array.isArray(artifact) || !map) {
      throw new Error('expected envelope and map');
    }
    expect(artifact.debug?.source).toBe(BLOW);
    expect(artifact.debug?.maps).toEqual(map);
    const device = { ...artifact };
    delete (device as { debug?: unknown }).debug;
    const vm = new JSVM();
    expect(() => vm.exec(device)).toThrow(JSVMError);
  });
});

describe('cli map and symbolicate', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsvm3-map-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes a sidecar map and symbolicates a saved report', () => {
    const input = path.join(dir, 'rule.js');
    const output = path.join(dir, 'rule.json');
    const mapFile = path.join(dir, 'rule.json.map');
    const reportFile = path.join(dir, 'report.json');
    fs.writeFileSync(input, BLOW);

    expect(main(['compile', input, '-o', output, '--format', '1', '--map', mapFile, '--no-es5'])).toBe(
      0
    );

    const envelope = JSON.parse(fs.readFileSync(output, 'utf8'));
    const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
    expect(envelope.debug).toBeUndefined();
    expect(envelope.artifactId).toBe(map.artifactId);
    expect(map.sources[0].content).toContain('missingProp');

    const vm = new JSVM();
    let caught: unknown;
    try {
      vm.exec(envelope);
    } catch (err) {
      caught = err;
    }
    fs.writeFileSync(reportFile, JSON.stringify(reportFromError(caught as JSVMError)));

    const logs: string[] = [];
    const orig = console.log;
    console.log = (value?: unknown) => {
      logs.push(String(value));
    };
    try {
      expect(main(['symbolicate', reportFile, '--map', mapFile])).toBe(0);
    } finally {
      console.log = orig;
    }
    expect(logs.join('\n')).toContain('rule.js:2:');
    expect(logs.join('\n')).toContain('missingProp');
  });
});
