import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { compile, compileWithMap, formatSymbolicated, reportFromError, symbolicate } from '../src/compiler';
import { JSVM } from '../src/vm/vm';
import { JSVMError } from '../src/utils/errors';
import { main } from '../src/cli';
import { startAdmin } from '../src/admin/server';

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

describe('admin console', () => {
  let dir: string;
  let close: (() => Promise<void>) | null = null;
  let base = '';

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsvm3-admin-'));
    const handle = await startAdmin({ port: 0, dir });
    close = handle.close;
    base = `http://127.0.0.1:${handle.port}`;
  });

  afterEach(async () => {
    if (close) {
      await close();
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function call(pathname: string, method = 'GET', payload?: unknown) {
    return new Promise<{ status: number; body: any; text: string }>((resolve, reject) => {
      const req = http.request(
        `${base}${pathname}`,
        {
          method,
          headers: payload === undefined ? {} : { 'content-type': 'application/json' },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let body: any = null;
            if (text && (res.headers['content-type'] || '').indexOf('json') !== -1) {
              body = JSON.parse(text);
            }
            resolve({ status: res.statusCode || 0, body, text });
          });
        }
      );
      req.on('error', reject);
      if (payload !== undefined) {
        req.write(JSON.stringify(payload));
      }
      req.end();
    });
  }

  it('publishes a version, runs it, and symbolicates the crash', async () => {
    const page = await call('/');
    expect(page.text).toContain('脚本台');
    expect(page.text).toContain('发布');

    const created = await call('/api/scripts', 'POST', { name: 'rule.js', source: BLOW });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const published = await call(`/api/scripts/${id}/publish`, 'POST', {});
    expect(published.status).toBe(201);
    expect(published.body.artifactId).toMatch(/^[a-f0-9]{32}$/);
    expect(published.body.listing).toContain('LINE');

    const ran = await call(`/api/versions/${published.body.artifactId}/run`, 'POST', {});
    expect(ran.status).toBe(200);
    expect(ran.body.ok).toBe(false);
    const blow = ran.body.symbolicated.frames.find((frame: { name: string }) => frame.name === 'blow');
    expect(blow.line).toBe(2);
    expect(blow.lineText).toContain('missingProp');

    const okScript = await call('/api/scripts', 'POST', {
      name: 'ok.js',
      source: 'module.exports = 7;',
    });
    const okPub = await call(`/api/scripts/${okScript.body.id}/publish`, 'POST', {});
    const okRun = await call(`/api/versions/${okPub.body.artifactId}/run`, 'POST', {});
    expect(okRun.body).toEqual({ ok: true, exports: 7 });
  });
});
