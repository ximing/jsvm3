import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { compile, compileWithMap, formatSymbolicated, reportFromError, symbolicate } from '../src/compiler';
import { JSVM } from '../src/vm/vm';
import { JSVMError } from '../src/utils/errors';
import { main, parseArgs } from '../src/cli';
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
    expect(page.text).toContain('设为线上');

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

  it('releases a channel to devices and symbolicates a device stack', async () => {
    expect(parseArgs(['--host', '0.0.0.0', '--port', '9']).host).toBe('0.0.0.0');

    const created = await call('/api/scripts', 'POST', { name: 'rule.js', source: BLOW });
    const id = created.body.id as string;
    const first = await call(`/api/scripts/${id}/publish`, 'POST', {});
    const liveId = first.body.artifactId as string;

    const other = await call('/api/scripts', 'POST', {
      name: 'other.js',
      source: 'module.exports = 1;',
    });
    const crossed = await call('/api/channels/stable', 'PUT', {
      scriptId: other.body.id,
      artifactId: liveId,
    });
    expect(crossed.status).toBe(400);
    expect(crossed.body.error).toBe('script mismatch');

    const named = await call('/api/channels/Bad_Name', 'PUT', { scriptId: id, artifactId: liveId });
    expect(named.status).toBe(400);

    const set = await call('/api/channels/stable', 'PUT', { scriptId: id, artifactId: liveId });
    expect(set.status).toBe(200);
    expect(set.body.previous).toBeNull();
    expect(set.body.gray).toBeNull();

    const again = await call('/api/channels/stable', 'PUT', { scriptId: id, artifactId: liveId });
    expect(again.body.live).toBe(liveId);
    expect(again.body.previous).toBeNull();

    const otherPub = await call(`/api/scripts/${other.body.id}/publish`, 'POST', {});
    const owned = await call('/api/channels/stable', 'PUT', {
      scriptId: other.body.id,
      artifactId: otherPub.body.artifactId,
    });
    expect(owned.status).toBe(400);
    expect(owned.body.error).toBe('script mismatch');

    await call(`/api/scripts/${id}`, 'PUT', { source: 'module.exports = 9;' });
    const second = await call(`/api/scripts/${id}/publish`, 'POST', {});
    const nextId = second.body.artifactId as string;
    const promoted = await call('/api/channels/stable', 'PUT', { scriptId: id, artifactId: nextId });
    expect(promoted.body.live).toBe(nextId);
    expect(promoted.body.previous).toBe(liveId);
    expect(promoted.body.gray).toBeNull();

    const gray = await call('/api/channels/stable/gray', 'POST', { artifactId: liveId, percent: 100 });
    expect(gray.status).toBe(200);
    const device = 'phone-a';
    const pulled = await call(`/api/devices/artifact?channel=stable&device=${device}`);
    expect(pulled.status).toBe(200);
    expect(pulled.body.rollout).toBe('gray');
    expect(pulled.body.artifactId).toBe(liveId);
    expect(pulled.body.scriptId).toBe(id);
    expect(pulled.body.bucket).toBeGreaterThanOrEqual(0);
    expect(pulled.body.bucket).toBeLessThan(100);
    expect(pulled.body.debug).toBeUndefined();
    expect(pulled.body.map).toBeUndefined();
    expect(pulled.body.source).toBeUndefined();
    expect(pulled.body.magic).toBe('JSVM3');
    expect(pulled.body.body).toBeTruthy();

    const cleared = await call('/api/channels/stable/gray', 'POST', { percent: 0 });
    expect(cleared.body.gray).toBeNull();
    const livePull = await call(`/api/devices/artifact?channel=stable&device=${device}`);
    expect(livePull.body.rollout).toBe('live');
    expect(livePull.body.artifactId).toBe(nextId);

    const fraction = await call('/api/channels/stable/gray', 'POST', { percent: 1.5, artifactId: liveId });
    expect(fraction.status).toBe(400);

    const half = await call('/api/channels/stable/gray', 'POST', { artifactId: liveId, percent: 50 });
    expect(half.status).toBe(200);
    const firstPull = await call(`/api/devices/artifact?channel=stable&device=${device}`);
    const secondPull = await call(`/api/devices/artifact?channel=stable&device=${device}`);
    expect(firstPull.body.bucket).toBe(secondPull.body.bucket);
    expect(firstPull.body.artifactId).toBe(secondPull.body.artifactId);
    expect(firstPull.body.rollout).toBe(secondPull.body.rollout);

    const rolledGray = await call('/api/channels/stable/rollback', 'POST', {});
    expect(rolledGray.body.gray).toBeNull();
    expect(rolledGray.body.live).toBe(nextId);
    const rolled = await call('/api/channels/stable/rollback', 'POST', {});
    expect(rolled.body.live).toBe(liveId);
    expect(rolled.body.previous).toBeNull();
    const stuck = await call('/api/channels/stable/rollback', 'POST', {});
    expect(stuck.status).toBe(400);
    expect(stuck.body.error).toBe('nothing to roll back');

    const badDevice = await call('/api/devices/artifact?channel=stable&device=');
    expect(badDevice.status).toBe(400);

    const ran = await call(`/api/versions/${liveId}/run`, 'POST', {});
    expect(ran.body.report.artifactId).toBe(liveId);
    const frame = ran.body.report.frames.find((item: { name: string }) => item.name === 'blow');
    const stack = [
      `${ran.body.report.error.name}: ${ran.body.report.error.message}`,
      `#${ran.body.report.artifactId}`,
      `at ${frame.name} (${frame.fName}:${frame.line}:${frame.column} ~${frame.script}:${frame.ip})`,
    ].join('\n');
    const crash = await call('/api/crashes', 'POST', { stack });
    expect(crash.status).toBe(200);
    const blow = crash.body.symbolicated.frames.find((item: { name: string }) => item.name === 'blow');
    expect(blow.line).toBe(2);
    expect(crash.body.text).toContain('missingProp');
  });

  it('stops a tight loop with the admin wall clock', async () => {
    const created = await call('/api/scripts', 'POST', { name: 'loop.js', source: 'while (true) {}' });
    const published = await call(`/api/scripts/${created.body.id}/publish`, 'POST', {});
    const started = Date.now();
    const ran = await call(`/api/versions/${published.body.artifactId}/run`, 'POST', {});
    expect(Date.now() - started).toBeLessThan(4000);
    expect(ran.body.ok).toBe(false);
    expect(ran.body.report.error.name).toBe('JSVMTimeoutError');
  });
});
