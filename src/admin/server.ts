import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { compileWithMap, formatSymbolicated, reportFromError, symbolicate } from 'jsvm3/compiler';
import type { SymbolMap } from 'jsvm3/compiler';
import { JSVM, JSVMError } from 'jsvm3/runtime';
import { listRoot } from '../debug/listing';
import type { ScriptJson } from '../artifact/types';

const SCRIPT_ID = /^s_[a-f0-9]{16}$/;
const ARTIFACT_ID = /^[a-f0-9]{32}$/;
const CHANNEL_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;
const BODY_LIMIT = 2_000_000;

export interface AdminOptions {
  port?: number;
  dir: string;
  host?: string;
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

interface ChannelRecord {
  name: string;
  scriptId: string;
  live: string;
  previous: string | null;
  gray: { artifactId: string; percent: number } | null;
  updatedAt: string;
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

function channelPath(dir: string, name: string) {
  if (!CHANNEL_NAME.test(name)) {
    throw new HttpError(400, 'invalid channel name');
  }
  return path.join(dir, 'channels', `${name}.json`);
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

function readChannel(dir: string, name: string): ChannelRecord {
  const file = channelPath(dir, name);
  if (!fs.existsSync(file)) {
    throw new HttpError(404, 'channel not found');
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeChannel(dir: string, record: ChannelRecord) {
  fs.writeFileSync(channelPath(dir, record.name), `${JSON.stringify(record, null, 2)}\n`);
}

function listChannels(dir: string, scriptId?: string): ChannelRecord[] {
  const folder = path.join(dir, 'channels');
  if (!fs.existsSync(folder)) {
    return [];
  }
  return fs
    .readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8')) as ChannelRecord)
    .filter((channel) => !scriptId || channel.scriptId === scriptId)
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

function versionForScript(dir: string, artifactId: string, scriptId: string): VersionRecord {
  const version = readVersion(dir, artifactId);
  if (version.scriptId !== scriptId) {
    throw new HttpError(400, 'script mismatch');
  }
  return version;
}

function setLive(dir: string, name: string, scriptId: string, artifactId: string): ChannelRecord {
  if (!SCRIPT_ID.test(scriptId)) {
    throw new HttpError(400, 'invalid script id');
  }
  readScript(dir, scriptId);
  versionForScript(dir, artifactId, scriptId);
  const now = new Date().toISOString();
  const file = channelPath(dir, name);
  if (!fs.existsSync(file)) {
    const created: ChannelRecord = {
      name,
      scriptId,
      live: artifactId,
      previous: null,
      gray: null,
      updatedAt: now,
    };
    writeChannel(dir, created);
    return created;
  }
  const current = readChannel(dir, name);
  if (current.scriptId !== scriptId) {
    throw new HttpError(400, 'script mismatch');
  }
  if (current.live === artifactId) {
    current.updatedAt = now;
    writeChannel(dir, current);
    return current;
  }
  current.previous = current.live;
  current.live = artifactId;
  current.gray = null;
  current.updatedAt = now;
  writeChannel(dir, current);
  return current;
}

function setGray(dir: string, name: string, body: { artifactId?: unknown; percent?: unknown }): ChannelRecord {
  const channel = readChannel(dir, name);
  const percent = body.percent;
  if (typeof percent !== 'number' || !Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new HttpError(400, 'percent must be an integer from 0 to 100');
  }
  if (percent === 0) {
    channel.gray = null;
    channel.updatedAt = new Date().toISOString();
    writeChannel(dir, channel);
    return channel;
  }
  const artifactId = typeof body.artifactId === 'string' ? body.artifactId : '';
  versionForScript(dir, artifactId, channel.scriptId);
  channel.gray = { artifactId, percent };
  channel.updatedAt = new Date().toISOString();
  writeChannel(dir, channel);
  return channel;
}

function rollback(dir: string, name: string): ChannelRecord {
  const channel = readChannel(dir, name);
  if (channel.gray) {
    channel.gray = null;
  } else if (channel.previous) {
    channel.live = channel.previous;
    channel.previous = null;
  } else {
    throw new HttpError(400, 'nothing to roll back');
  }
  channel.updatedAt = new Date().toISOString();
  writeChannel(dir, channel);
  return channel;
}

function deviceBucket(device: string): number {
  let hash = 0;
  for (let i = 0; i < device.length; i++) {
    hash = (hash * 33 + device.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

function pullArtifact(dir: string, channelName: string, device: string) {
  if (!CHANNEL_NAME.test(channelName)) {
    throw new HttpError(400, 'invalid channel name');
  }
  if (!device || device.length > 128) {
    throw new HttpError(400, 'invalid device');
  }
  const channel = readChannel(dir, channelName);
  const bucket = deviceBucket(device);
  const useGray = !!(channel.gray && bucket < channel.gray.percent);
  const artifactId = useGray && channel.gray ? channel.gray.artifactId : channel.live;
  const version = readVersion(dir, artifactId);
  const env = version.artifact;
  return {
    channel: channel.name,
    scriptId: channel.scriptId,
    rollout: useGray ? ('gray' as const) : ('live' as const),
    bucket,
    magic: env.magic,
    format: env.format,
    opcode: env.opcode,
    compiler: env.compiler,
    filename: env.filename || version.filename,
    artifactId: env.artifactId || version.artifactId,
    body: env.body,
  };
}

function ingestCrash(dir: string, body: any) {
  let report: ReturnType<typeof reportFromError>;
  if (body && body.report && typeof body.report === 'object') {
    report = body.report;
  } else if (body && typeof body.stack === 'string') {
    report = reportFromError({
      name: typeof body.name === 'string' ? body.name : undefined,
      message: typeof body.message === 'string' ? body.message : undefined,
      stack: body.stack,
    });
  } else {
    throw new HttpError(400, 'stack or report required');
  }
  if (typeof body.artifactId === 'string' && body.artifactId) {
    report = { ...report, artifactId: body.artifactId };
  }
  if ((typeof body.name === 'string' || typeof body.message === 'string') && report.error) {
    report = {
      ...report,
      error: {
        name: typeof body.name === 'string' ? body.name : report.error.name,
        message: typeof body.message === 'string' ? body.message : report.error.message,
      },
    };
  }
  if (!report.artifactId) {
    throw new HttpError(400, 'artifact id required');
  }
  const version = readVersion(dir, report.artifactId);
  const symbolicated = symbolicate(report, version.map);
  return { report, symbolicated, text: formatSymbolicated(symbolicated) };
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
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'channels' && parts.length === 2) {
      const scriptId = url.searchParams.get('scriptId') || undefined;
      if (scriptId && !SCRIPT_ID.test(scriptId)) {
        throw new HttpError(400, 'invalid script id');
      }
      send(res, 200, { channels: listChannels(dir, scriptId) });
      return;
    }
    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'channels' && parts.length === 3) {
      const body = await readJson(req);
      send(res, 200, setLive(dir, parts[2], String(body.scriptId || ''), String(body.artifactId || '')));
      return;
    }
    if (
      method === 'POST' &&
      parts[0] === 'api' &&
      parts[1] === 'channels' &&
      parts[3] === 'gray' &&
      parts.length === 4
    ) {
      send(res, 200, setGray(dir, parts[2], await readJson(req)));
      return;
    }
    if (
      method === 'POST' &&
      parts[0] === 'api' &&
      parts[1] === 'channels' &&
      parts[3] === 'rollback' &&
      parts.length === 4
    ) {
      send(res, 200, rollback(dir, parts[2]));
      return;
    }
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'devices' && parts[2] === 'artifact') {
      send(
        res,
        200,
        pullArtifact(dir, url.searchParams.get('channel') || '', url.searchParams.get('device') ?? '')
      );
      return;
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'crashes' && parts.length === 2) {
      send(res, 200, ingestCrash(dir, await readJson(req)));
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
  const host = options.host ?? '127.0.0.1';
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'versions'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'channels'), { recursive: true });
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
    server.listen(options.port ?? 0, host, () => {
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
