#!/usr/bin/env node
/**
 * 1.4 runtime bundle gates (PR 3):
 * - dist/runtime.js (and the index.js alias) must not contain @babel or compiler/emitter
 * - gzip(runtime) <= 6KB
 * - known opcode ids must still be registered after minify (InsMap.set / createOP residue)
 * - full.js must externalize jsvm3/runtime and jsvm3/compiler
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(repoRoot, 'dist');

function loadOpIdx() {
  const src = fs.readFileSync(path.join(repoRoot, 'src/opcodes/opIdx.ts'), 'utf8');
  const fn = new Function(`${src.replace('export const ', 'const ')}${'\n'}return OPCodeIdx;`);
  return fn();
}

const opcodes = loadOpIdx();

const REQUIRED_OPCODES = [
  'GET',
  'SET',
  'GETL',
  'ADD',
  'LITERAL',
  'FUNCTION',
  'RET',
  'CALL',
  'ENTER_GUARD',
  'DEBUG',
  'SR1',
  'POP',
  'JMP',
  'THROW',
  'ARRAY_LITERAL',
];

const FORBIDDEN = [/@babel\//, /compiler\/emitter/, /compiler\/visitor/, /compiler\/plugin/];

const GZIP_BUDGET = 6 * 1024;
const RAW_BUDGET = 15 * 1024;

function rel(file) {
  return path.relative(repoRoot, file);
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function mustExist(file) {
  if (!fs.existsSync(file)) {
    fail(`missing ${rel(file)}`);
    return null;
  }
  return fs.readFileSync(file);
}

const runtimeJs = path.join(distRoot, 'runtime.js');
const indexJs = path.join(distRoot, 'index.js');
const fullJs = path.join(distRoot, 'full.js');
const compilerJs = path.join(distRoot, 'compiler.js');
const artifactJs = path.join(distRoot, 'artifact.js');
const expJs = path.join(distRoot, 'exp.js');
const cliJs = path.join(distRoot, 'cli.js');

const runtimeBuf = mustExist(runtimeJs);
const indexBuf = mustExist(indexJs);
mustExist(fullJs);
mustExist(compilerJs);
mustExist(artifactJs);
const expBuf = mustExist(expJs);
const EXP_RAW_BUDGET = 12 * 1024;
if (expBuf && expBuf.length > EXP_RAW_BUDGET) {
  fail(`${rel(expJs)} raw size ${expBuf.length} > ${EXP_RAW_BUDGET}`);
}

const dtsFiles = ['runtime.d.ts', 'compiler.d.ts', 'full.d.ts', 'artifact.d.ts', 'exp.d.ts'];
for (const name of dtsFiles) {
  mustExist(path.join(distRoot, name));
}

function collectDts(dir, acc = []) {
  if (!fs.existsSync(dir)) {
    return acc;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectDts(full, acc);
    } else if (entry.name.endsWith('.d.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

const runtimeDtsFiles = [
  path.join(distRoot, 'runtime.d.ts'),
  ...collectDts(path.join(distRoot, 'types', 'runtime')),
];
for (const file of runtimeDtsFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (/compiler\/emitter|@babel\//.test(text)) {
    fail(`${rel(file)} leaks compiler/emitter or @babel`);
  }
}

if (runtimeBuf && indexBuf) {
  const runtimeText = runtimeBuf.toString('utf8');
  const indexText = indexBuf.toString('utf8');

  for (const re of FORBIDDEN) {
    if (re.test(runtimeText)) {
      fail(`${rel(runtimeJs)} contains forbidden ${re}`);
    }
    if (re.test(indexText)) {
      fail(`${rel(indexJs)} contains forbidden ${re}`);
    }
  }

  const gzip = zlib.gzipSync(runtimeBuf);
  const gzipSize = gzip.length;
  const rawSize = runtimeBuf.length;
  console.log(
    `runtime size: ${rawSize} B raw / ${gzipSize} B gzip (budgets ${RAW_BUDGET} / ${GZIP_BUDGET})`
  );
  if (rawSize > RAW_BUDGET) {
    fail(`runtime raw size ${rawSize} > ${RAW_BUDGET}`);
  }
  if (gzipSize > GZIP_BUDGET) {
    fail(`runtime gzip size ${gzipSize} > ${GZIP_BUDGET}`);
  }

  if (!/\.set\s*\(/.test(runtimeText)) {
    fail(`${rel(runtimeJs)} lost Map.set residue after minify`);
  }

  const missing = [];
  for (const name of REQUIRED_OPCODES) {
    const id = opcodes[name];
    if (typeof id !== 'number') {
      missing.push(`${name} (unknown id)`);
      continue;
    }
    const registered =
      new RegExp(String.raw`\.set\s*\(\s*${id}\s*,`).test(runtimeText) ||
      new RegExp(String.raw`\(${id},function`).test(runtimeText) ||
      new RegExp(String.raw`\(${id},function`).test(runtimeText.replace(/\s+/g, '')) ||
      new RegExp(String.raw`\b${id},function`).test(runtimeText);
    if (!registered) {
      missing.push(`${name}=${id}`);
    }
  }
  if (missing.length) {
    fail(`InsMap registration residue missing for: ${missing.join(', ')}`);
  } else {
    console.log(`ok: InsMap residue present for ${REQUIRED_OPCODES.join(', ')}`);
  }
}

const fullText = fs.existsSync(fullJs) ? fs.readFileSync(fullJs, 'utf8') : '';
if (fullText) {
  const hasRuntime =
    /require\(['"]jsvm3\/runtime['"]\)/.test(fullText) ||
    /from ['"]jsvm3\/runtime['"]/.test(fullText);
  const hasCompiler =
    /require\(['"]jsvm3\/compiler['"]\)/.test(fullText) ||
    /from ['"]jsvm3\/compiler['"]/.test(fullText);
  if (!hasRuntime || !hasCompiler) {
    fail(`${rel(fullJs)} must externalize jsvm3/runtime and jsvm3/compiler`);
  }
  if (/new Map/.test(fullText) && /\.set\s*\(\s*\d+/.test(fullText)) {
    fail(`${rel(fullJs)} looks like it inlined a second InsMap / JSVM`);
  }
  if (/@babel\//.test(fullText)) {
    fail(`${rel(fullJs)} must not bundle @babel/*`);
  }
  console.log(`ok: ${rel(fullJs)} externalizes jsvm3/runtime and jsvm3/compiler`);
}

const compilerText = fs.existsSync(compilerJs) ? fs.readFileSync(compilerJs, 'utf8') : '';
if (compilerText && /compileToScript/.test(compilerText)) {
  fail(`${rel(compilerJs)} must not export compileToScript`);
}

const CLI_MARKER = 'Device path A does not use the CLI';
if (runtimeBuf && runtimeBuf.toString('utf8').includes(CLI_MARKER)) {
  fail(`${rel(runtimeJs)} must not include the CLI`);
}
if (indexBuf && indexBuf.toString('utf8').includes(CLI_MARKER)) {
  fail(`${rel(indexJs)} must not include the CLI`);
}

const cliBuf = mustExist(cliJs);
if (cliBuf) {
  const cliText = cliBuf.toString('utf8');
  if (!cliText.startsWith('#!/usr/bin/env node')) {
    fail(`${rel(cliJs)} must start with a node shebang`);
  }
  if (!cliText.includes(CLI_MARKER)) {
    fail(`${rel(cliJs)} is missing the path-A warning`);
  }
  const hasRuntime =
    /require\(['"]jsvm3\/runtime['"]\)/.test(cliText) ||
    /from ['"]jsvm3\/runtime['"]/.test(cliText);
  const hasCompiler =
    /require\(['"]jsvm3\/compiler['"]\)/.test(cliText) ||
    /from ['"]jsvm3\/compiler['"]/.test(cliText);
  if (!hasRuntime || !hasCompiler) {
    fail(`${rel(cliJs)} must externalize jsvm3/runtime and jsvm3/compiler`);
  }
  if (/@babel\//.test(cliText)) {
    fail(`${rel(cliJs)} must not bundle @babel/*`);
  }
  console.log(`ok: ${rel(cliJs)} is a separate full bin (not in runtime)`);
}

const fixturePath = path.join(repoRoot, '__tests__/fixtures/wide.format0.json');
const expectedPath = path.join(repoRoot, '__tests__/fixtures/expected.json');
if (fs.existsSync(runtimeJs) && fs.existsSync(fixturePath) && fs.existsSync(expectedPath)) {
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { JSVM, loadArtifact } = require(runtimeJs);
    const artifact = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
    const vm = new JSVM();
    vm.exec(loadArtifact(artifact));
    const got = vm.realm.globalObj.module.exports;
    if (JSON.stringify(got) !== JSON.stringify(expected.wide)) {
      fail(`dist/runtime.js exec mismatch: ${JSON.stringify(got)}`);
    } else {
      console.log('ok: dist/runtime.js executed wide-opcode fixture');
    }
  } catch (err) {
    fail(`dist/runtime.js failed to exec fixture: ${err && err.stack ? err.stack : err}`);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log('ok: runtime bundle checks passed');
