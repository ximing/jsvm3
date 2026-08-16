#!/usr/bin/env node
/**
 * Emit public .d.ts files into dist/.
 *
 * Runtime types prefer the COMPILER:false preprocessed graph (KD-2).
 * OPCodeIdx / Cannot / property imports live behind @ifdef COMPILER in
 * source while the identifiers are still used; the bundle replaces them
 * via transform-define. For tsc we re-attach those imports after
 * preprocess. If that pipeline fails, fall back to types/runtime.d.ts.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const preprocess = require('preprocess');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(repoRoot, 'src');
const typesRoot = path.join(repoRoot, 'types');
const distRoot = path.join(repoRoot, 'dist');
const tmpRoot = path.join(repoRoot, '.tmp', 'runtime-src');
const tmpOut = path.join(repoRoot, '.tmp', 'runtime-dts');

const IMPORT_PATTERNS = [
  /\bimport\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:type\s+)?[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.') && !path.isAbsolute(spec)) {
    return null;
  }
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) {
        return path.normalize(candidate);
      }
    } catch {
      // next
    }
  }
  return null;
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

function walkRuntimeGraph() {
  const entry = path.join(srcRoot, 'index.ts');
  const visited = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file)) {
      continue;
    }
    visited.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const spec of collectSpecs(source)) {
      const resolved = resolveImport(file, spec);
      if (resolved && !visited.has(resolved)) {
        queue.push(resolved);
      }
    }
  }
  return [...visited];
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(from, to) {
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}

function writeFile(to, contents) {
  ensureDir(path.dirname(to));
  fs.writeFileSync(to, contents);
}

function reattachRuntimeShims(source) {
  const needsOp =
    /\bOPCodeIdx\b/.test(source) &&
    !/from ['"]\.\/opIdx['"]/.test(source) &&
    !/export const OPCodeIdx\b/.test(source);
  const needsConst =
    /\b(?:Cannot|property)\b/.test(source) &&
    !/from ['"]\.\/contants['"]/.test(source) &&
    !/export const Cannot\b/.test(source);
  const shims = [];
  if (needsOp) {
    shims.push(`import { OPCodeIdx } from './opIdx';`);
  }
  if (needsConst) {
    shims.push(`import { Cannot, property } from './contants';`);
  }
  if (!shims.length) {
    return source;
  }
  return `${shims.join('\n')}\n${source}`;
}

function generateRuntimeFromPreprocess() {
  rmrf(tmpRoot);
  rmrf(tmpOut);
  ensureDir(tmpRoot);

  const files = walkRuntimeGraph();
  for (const file of files) {
    const rel = path.relative(srcRoot, file);
    const dest = path.join(tmpRoot, rel);
    const raw = fs.readFileSync(file, 'utf8');
    let processed = preprocess.preprocess(
      raw,
      { VM: true, CURRENT: 'all' },
      { type: 'js' }
    );
    processed = reattachRuntimeShims(processed);
    // JS extra-arg calls (e.g. new Script(..., source)) are valid at runtime
    // but fail tsc after COMPILER constructor params are stripped.
    processed = `// @ts-nocheck\n${processed}`;
    writeFile(dest, processed);
  }

  const tsconfig = {
    compilerOptions: {
      target: 'ES5',
      module: 'ESNext',
      moduleResolution: 'node',
      declaration: true,
      emitDeclarationOnly: true,
      skipLibCheck: true,
      noImplicitAny: false,
      strictNullChecks: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      allowSyntheticDefaultImports: true,
      outDir: tmpOut,
      rootDir: tmpRoot,
      lib: ['es2015'],
    },
    include: ['./**/*.ts'],
  };
  writeFile(path.join(tmpRoot, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

  const tsc = path.join(repoRoot, 'node_modules', '.bin', 'tsc');
  const result = spawnSync(tsc, ['-p', path.join(tmpRoot, 'tsconfig.json')], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const detail = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    throw new Error(`tsc on preprocessed runtime graph failed:\n${detail || '(no tsc output)'}`);
  }

  const generatedEntry = path.join(tmpOut, 'index.d.ts');
  if (!fs.existsSync(generatedEntry)) {
    throw new Error('preprocessed tsc did not emit index.d.ts');
  }

  const typesDest = path.join(distRoot, 'types', 'runtime');
  rmrf(typesDest);
  copyDir(tmpOut, typesDest);

  const banner =
    '/* generated from COMPILER:false preprocessed runtime graph; do not edit */\n';
  writeFile(
    path.join(distRoot, 'runtime.d.ts'),
    `${banner}export * from './types/runtime/index';\n`
  );

  const tree = fs.readFileSync(generatedEntry, 'utf8');
  if (/compiler\/emitter|@babel\//.test(tree)) {
    throw new Error('generated runtime dts still references compiler/emitter or @babel');
  }
  return files.length;
}

function copyDir(from, to) {
  ensureDir(to);
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dest);
    } else {
      copyFile(src, dest);
    }
  }
}

function copyHandwritten() {
  copyFile(path.join(typesRoot, 'runtime.d.ts'), path.join(distRoot, 'runtime.d.ts'));
}

function copyPublicDts() {
  copyFile(path.join(typesRoot, 'compiler.d.ts'), path.join(distRoot, 'compiler.d.ts'));
  copyFile(path.join(typesRoot, 'artifact.d.ts'), path.join(distRoot, 'artifact.d.ts'));
  copyFile(path.join(typesRoot, 'full.d.ts'), path.join(distRoot, 'full.d.ts'));
  copyFile(path.join(typesRoot, 'exp.d.ts'), path.join(distRoot, 'exp.d.ts'));
}

ensureDir(distRoot);

let generated = false;
try {
  const count = generateRuntimeFromPreprocess();
  generated = true;
  console.log(`ok: generated dist/runtime.d.ts from ${count} preprocessed modules`);
} catch (err) {
  console.warn(`warn: preprocess dts failed (${err.message.split('\n')[0]}); using types/runtime.d.ts`);
  copyHandwritten();
}

copyPublicDts();

const required = [
  'runtime.d.ts',
  'compiler.d.ts',
  'artifact.d.ts',
  'full.d.ts',
  'exp.d.ts',
];
for (const name of required) {
  const file = path.join(distRoot, name);
  if (!fs.existsSync(file)) {
    console.error(`missing ${path.relative(repoRoot, file)}`);
    process.exit(1);
  }
}

console.log(
  `ok: wrote ${required.map((n) => `dist/${n}`).join(', ')}${generated ? ' (runtime from preprocess)' : ' (runtime handwritten)'}`
);
