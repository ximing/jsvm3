#!/usr/bin/env node
/**
 * Walk static imports from src/index.ts and fail if compiler/ or @babel/
 * is reachable. This is the 1.3 industrial check for KD-2/KD-3: runtime
 * must not import the compiler or Babel. Type-only imports count.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(repoRoot, 'src');
const entry = path.join(srcRoot, 'index.ts');

const IMPORT_PATTERNS = [
  /\bimport\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:type\s+)?[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function isBabel(spec) {
  return spec === '@babel' || spec.startsWith('@babel/');
}

function isCompilerFile(file) {
  const rel = path.relative(srcRoot, file);
  return rel === 'compiler' || rel.startsWith(`compiler${path.sep}`);
}

function resolveImport(fromFile, spec) {
  if (isBabel(spec)) {
    return { kind: 'babel', spec };
  }
  if (!spec.startsWith('.') && !path.isAbsolute(spec)) {
    return { kind: 'external', spec };
  }
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) {
        return { kind: 'file', file: path.normalize(candidate) };
      }
    } catch {
      // try next candidate
    }
  }
  return { kind: 'unresolved', spec };
}

function collectSpecs(source) {
  const specs = [];
  const cleaned = stripComments(source);
  for (const re of IMPORT_PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(cleaned))) {
      specs.push(match[1]);
    }
  }
  return specs;
}

function rel(file) {
  return path.relative(repoRoot, file);
}

if (!fs.existsSync(entry)) {
  console.error(`missing runtime entry: ${rel(entry)}`);
  process.exit(1);
}

const visited = new Set();
const parent = new Map();
const queue = [entry];
const errors = [];

function chainTo(file) {
  const parts = [];
  let cur = file;
  while (cur && parent.has(cur)) {
    const step = parent.get(cur);
    parts.push(`${rel(step.from)} -> ${step.spec}`);
    cur = step.from;
  }
  parts.reverse();
  return parts;
}

while (queue.length) {
  const file = queue.shift();
  if (visited.has(file)) {
    continue;
  }
  visited.add(file);

  if (isCompilerFile(file)) {
    errors.push({
      kind: 'compiler',
      chain: chainTo(file),
      target: rel(file),
    });
    continue;
  }

  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (err) {
    errors.push({ kind: 'read', target: rel(file), message: err.message });
    continue;
  }

  for (const spec of collectSpecs(source)) {
    const resolved = resolveImport(file, spec);
    if (resolved.kind === 'babel') {
      errors.push({
        kind: 'babel',
        chain: [...chainTo(file), `${rel(file)} -> ${spec}`],
        target: spec,
      });
      continue;
    }
    if (resolved.kind === 'file') {
      if (!parent.has(resolved.file) && resolved.file !== entry) {
        parent.set(resolved.file, { from: file, spec });
      }
      if (!visited.has(resolved.file)) {
        queue.push(resolved.file);
      }
    }
  }
}

if (errors.length) {
  console.error('runtime import graph from src/index.ts reached forbidden modules:');
  for (const err of errors) {
    if (err.kind === 'read') {
      console.error(`  read error ${err.target}: ${err.message}`);
      continue;
    }
    const label = err.kind === 'babel' ? '@babel/' : 'compiler/';
    const chain = err.chain.length ? err.chain.join('\n    ') : err.target;
    console.error(`  ${label} ${err.target}\n    ${chain}`);
  }
  process.exit(1);
}

console.log(
  `ok: walked ${visited.size} modules from src/index.ts; no compiler/ or @babel/ imports`
);
