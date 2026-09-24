import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { compileWithMap, reportFromError, symbolicate } from 'jsvm3/compiler';
import type { SymbolMap } from 'jsvm3/compiler';
import { JSVM, JSVMError } from 'jsvm3/runtime';
import { listRoot } from '../debug/listing';
import type { ScriptJson } from '../artifact/types';

const SCRIPT_ID = /^s_[a-f0-9]{16}$/;
const ARTIFACT_ID = /^[a-f0-9]{32}$/;
const BODY_LIMIT = 2_000_000;

export interface AdminOptions {
  port?: number;
  dir: string;
}

export interface AdminHandle {
  port: number;
  dir: string;
  close: () => Promise<void>;
}

interface ScriptRecord {
  id: string;
  name: string;
  source: string;
  updatedAt: string;
}

interface VersionRecord {
  artifactId: string;
  scriptId: string;
  filename: string;
  createdAt: string;
  artifact: {
    body: ScriptJson;
    artifactId?: string;
    magic?: string;
    format?: number;
    opcode?: number;
    compiler?: string;
    filename?: string;
  };
  map: SymbolMap;
}

function pageFile(): string {
  const candidates = [
    path.join(__dirname, '../../admin/public/index.html'),
    path.join(__dirname, '../admin/public/index.html'),
  ];
  for (let i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) {
      return candidates[i];
    }
  }
  throw new Error('admin page is missing (admin/public/index.html)');
}

function send(res: http.ServerResponse, status: number, body: unknown, type = 'application/json') {
  const payload = type === 'application/json' ? JSON.stringify(body) : String(body);
  res.writeHead(status, {
    'content-type': `${type}; charset=utf-8`,
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req: http.IncomingMessage): Promise<any> {
  const raw = await readBody(req);
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

function scriptPath(dir: string, id: string) {
  return path.join(dir, 'scripts', `${id}.json`);
}

function versionPath(dir: string, id: string) {
  return path.join(dir, 'versions', `${id}.json`);
}

function readScript(dir: string, id: string): ScriptRecord {
  if (!SCRIPT_ID.test(id)) {
    throw new HttpError(400, 'invalid script id');
  }
  const file = scriptPath(dir, id);
  if (!fs.existsSync(file)) {
    throw new HttpError(404, 'script not found');
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeScript(dir: string, record: ScriptRecord) {
  fs.writeFileSync(scriptPath(dir, record.id), `${JSON.stringify(record, null, 2)}\n`);
}

function listScripts(dir: string): ScriptRecord[] {
  const folder = path.join(dir, 'scripts');
  if (!fs.existsSync(folder)) {
    return [];
  }
  return fs
    .readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8')) as ScriptRecord)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function readVersion(dir: string, id: string): VersionRecord {
  if (!ARTIFACT_ID.test(id)) {
    throw new HttpError(400, 'invalid artifact id');
  }
  const file = versionPath(dir, id);
  if (!fs.existsSync(file)) {
    throw new HttpError(404, 'version not found');
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listVersions(dir: string, scriptId?: string) {
  const folder = path.join(dir, 'versions');
  if (!fs.existsSync(folder)) {
    return [];
  }
  return fs
    .readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8')) as VersionRecord)
    .filter((version) => !scriptId || version.scriptId === scriptId)
    .map((version) => ({
      artifactId: version.artifactId,
      scriptId: version.scriptId,
      filename: version.filename,
      createdAt: version.createdAt,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function publish(dir: string, id: string) {
  const script = readScript(dir, id);
  const filename = script.name || 'script.js';
  const { artifact, map } = compileWithMap(script.source, {
    filename,
    format: 1,
    sourceMap: true,
  });
  if (Array.isArray(artifact) || !map || !artifact.artifactId) {
    throw new HttpError(500, 'compile did not return a format 1 envelope');
  }
  const record: VersionRecord = {
    artifactId: artifact.artifactId,
    scriptId: script.id,
    filename,
    createdAt: new Date().toISOString(),
    artifact: artifact as VersionRecord['artifact'],
    map,
  };
  fs.writeFileSync(versionPath(dir, record.artifactId), `${JSON.stringify(record)}\n`);
  return {
    artifactId: record.artifactId,
    scriptId: record.scriptId,
    filename,
    createdAt: record.createdAt,
    listing: listRoot(artifact.body),
  };
}

function runVersion(dir: string, id: string) {
  const version = readVersion(dir, id);
  const vm = new JSVM({}, { timeout: 1_000_000, maxDepth: 64, resetOnExec: true, wallMs: 1000 });
  try {
    vm.exec(version.artifact as Parameters<JSVM['exec']>[0]);
    return {
      ok: true as const,
      exports: (vm.realm.globalObj as { module: { exports: unknown } }).module.exports,
    };
  } catch (err) {
    if (err instanceof JSVMError) {
      const report = reportFromError(err);
      return {
        ok: false as const,
        report,
        symbolicated: symbolicate(report, version.map),
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false as const,
      report: { error: { name: 'Error', message }, frames: [] },
      symbolicated: null,
    };
  }
}

async function route(req: http.IncomingMessage, res: http.ServerResponse, dir: string) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const parts = url.pathname.split('/').filter(Boolean);
  const method = req.method || 'GET';

  if (method === 'GET' && parts.length === 0) {
    send(res, 200, fs.readFileSync(pageFile(), 'utf8'), 'text/html');
    return;
  }

  try {
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'scripts' && parts.length === 2) {
      send(res, 200, { scripts: listScripts(dir) });
      return;
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'scripts' && parts.length === 2) {
      const body = await readJson(req);
      const name = typeof body.name === 'string' && body.name ? body.name : 'script.js';
      const source = typeof body.source === 'string' ? body.source : '';
      const record: ScriptRecord = {
        id: `s_${randomBytes(8).toString('hex')}`,
        name,
        source,
        updatedAt: new Date().toISOString(),
      };
      writeScript(dir, record);
      send(res, 201, record);
      return;
    }
    if (parts[0] === 'api' && parts[1] === 'scripts' && parts.length === 3 && SCRIPT_ID.test(parts[2])) {
      if (method === 'GET') {
        send(res, 200, readScript(dir, parts[2]));
        return;
      }
      if (method === 'PUT') {
        const body = await readJson(req);
        const current = readScript(dir, parts[2]);
        if (typeof body.name === 'string' && body.name) {
          current.name = body.name;
        }
        if (typeof body.source === 'string') {
          current.source = body.source;
        }
        current.updatedAt = new Date().toISOString();
        writeScript(dir, current);
        send(res, 200, current);
        return;
      }
    }
    if (
      method === 'POST' &&
      parts[0] === 'api' &&
      parts[1] === 'scripts' &&
      parts[3] === 'publish' &&
      parts.length === 4
    ) {
      send(res, 201, publish(dir, parts[2]));
      return;
    }
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'versions' && parts.length === 2) {
      const scriptId = url.searchParams.get('scriptId') || undefined;
      if (scriptId && !SCRIPT_ID.test(scriptId)) {
        throw new HttpError(400, 'invalid script id');
      }
      send(res, 200, { versions: listVersions(dir, scriptId) });
      return;
    }
    if (
      method === 'POST' &&
      parts[0] === 'api' &&
      parts[1] === 'versions' &&
      parts[3] === 'run' &&
      parts.length === 4
    ) {
      send(res, 200, runVersion(dir, parts[2]));
      return;
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'symbolicate' && parts.length === 2) {
      const body = await readJson(req);
      const version = readVersion(dir, String(body.artifactId || ''));
      send(res, 200, symbolicate(body.report, version.map));
      return;
    }
    send(res, 404, { error: 'not found' });
  } catch (err) {
    if (err instanceof HttpError) {
      send(res, err.status, { error: err.message });
      return;
    }
    if (err instanceof SyntaxError) {
      send(res, 400, { error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    send(res, 400, { error: message });
  }
}

export function startAdmin(options: AdminOptions): Promise<AdminHandle> {
  const dir = options.dir;
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'versions'), { recursive: true });
  const server = http.createServer((req, res) => {
    route(req, res, dir).catch((err) => {
      if (res.headersSent) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      send(res, 500, { error: message });
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : options.port ?? 0;
      resolve({
        port,
        dir,
        close: () =>
          new Promise((done, fail) => {
            server.close((err) => (err ? fail(err) : done()));
          }),
      });
    });
  });
}
