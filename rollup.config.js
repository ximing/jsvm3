// import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';
import external from 'rollup-plugin-peer-deps-external';
import resolve from '@rollup/plugin-node-resolve';
import RollupPluginPreprocess from 'rollup-plugin-preprocess';
import babel from '@rollup/plugin-babel';
import * as path from 'path';
import * as fs from 'fs';
import * as t from '@babel/types';
import terser from '@rollup/plugin-terser';

import pkg from './package.json';

const requireFromString = require('require-from-string');
const OPCodeIdx = requireFromString(
  fs
    .readFileSync(path.join(__dirname, 'src/opcodes/opIdx.ts'), 'utf-8')
    .replace('export const ', 'module.exports = ')
);

const minifyObj = {};
Object.keys(OPCodeIdx).forEach((key) => {
  minifyObj[`OPCodeIdx.${key}`] = OPCodeIdx[key];
});

const babelAssumptions = {
  noDocumentAll: true,
  noClassCalls: true,
  enumerableModuleMeta: true,
  constantReexports: true,
  iterableIsArray: true,
  noNewArrows: true,
  objectRestNoSymbols: true,
  privateFieldsAsProperties: true,
  setClassMethods: true,
  setComputedProperties: true,
  setPublicClassFields: true,
  setSpreadProperties: true,
  superIsCallableConstructor: true,
  skipForOfIteratorClosing: true,
};

const babelPresets = [
  [
    '@babel/env',
    {
      targets: {
        browsers: ['safari >= 10', 'android >= 53'],
      },
      bugfixes: true,
    },
  ],
  '@babel/preset-typescript',
];

function renameStackMethod(name) {
  if (name === 'push') {
    return 'p';
  }
  if (name === 'pop') {
    return 'u';
  }
  if (name === 'top') {
    return 't';
  }
  return name;
}

function isEvalStackExpr(node) {
  if (t.isIdentifier(node) && node.name === 'evalStack') {
    return true;
  }
  return (
    t.isMemberExpression(node) &&
    t.isIdentifier(node.property) &&
    node.property.name === 'evalStack'
  );
}

function evalStackRenamePlugin() {
  return {
    visitor: {
      ClassMethod(path) {
        const cls = path.findParent((p) => p.isClassDeclaration() || p.isClassExpression());
        const id = cls && cls.node.id;
        if (!id || id.name !== 'EvaluationStack' || !t.isIdentifier(path.node.key)) {
          return;
        }
        path.node.key.name = renameStackMethod(path.node.key.name);
      },
      CallExpression({ node }) {
        if (t.isMemberExpression(node.callee) && isEvalStackExpr(node.callee.object)) {
          if (t.isIdentifier(node.callee.property)) {
            node.callee.property.name = renameStackMethod(node.callee.property.name);
          }
        }
      },
    },
  };
}

function tsBabel(extraPlugins = []) {
  return babel({
    babelrc: false,
    configFile: false,
    assumptions: babelAssumptions,
    presets: babelPresets,
    plugins: [
      [
        'transform-define',
        {
          'process.env.NODE_ENV': 'production',
          ...minifyObj,
        },
      ],
      evalStackRenamePlugin,
      ...extraPlugins,
    ],
    extensions: ['.ts'],
  });
}

const runtimeTerser = terser({
  compress: {
    passes: 3,
    pure_getters: true,
    unsafe: true,
  },
  mangle: {
    module: true,
    reserved: [],
    properties: {
      reserved: [
        'exec',
        'realm',
        'globalObj',
        'createFiber',
        'defaultTimeout',
        'maxDepth',
        'module',
        'exports',
        'magic',
        'format',
        'opcode',
        'body',
      ],
    },
  },
});

function cjsOutput(file) {
  return {
    file,
    format: 'cjs',
    exports: 'named',
    sourcemap: true,
  };
}

function esmOutput(file) {
  return {
    file,
    format: 'es',
    exports: 'named',
    sourcemap: true,
  };
}

function isBabelish(id) {
  const normalized = String(id).replace(/\\/g, '/');
  return (
    id === '@babel' ||
    id.startsWith('@babel/') ||
    id.startsWith('babel-plugin-minify-') ||
    id.startsWith('babel-plugin-') ||
    /\/node_modules\/@babel\//.test(normalized) ||
    /\/node_modules\/babel-plugin-/.test(normalized)
  );
}

function keepBabelExternal() {
  return {
    name: 'keep-babel-external',
    resolveId(source) {
      if (isBabelish(source) || source === 'chalk') {
        return { id: source, external: true };
      }
      return null;
    },
  };
}

function isSelfEntry(id) {
  return (
    id === 'jsvm3/runtime' ||
    id === 'jsvm3/compiler' ||
    id === 'jsvm3/artifact' ||
    id === 'jsvm3/full' ||
    id === 'jsvm3/exp'
  );
}

function isNodeBuiltin(id) {
  return (
    id === 'fs' ||
    id === 'path' ||
    id === 'os' ||
    id === 'util' ||
    id === 'module' ||
    id === 'process' ||
    id.startsWith('node:')
  );
}

function keepSelfEntries() {
  return {
    name: 'keep-self-entries',
    resolveId(source) {
      if (isSelfEntry(source)) {
        return { id: source, external: true };
      }
      return null;
    },
  };
}

const runtimePlugins = [
  external(),
  resolve({
    extensions: ['.ts'],
  }),
  RollupPluginPreprocess({
    include: ['**/*.ts'],
    context: {
      VM: true,
      // @ifdef tests definedness, not truthiness — omit COMPILER so those blocks strip
      CURRENT: 'all',
    },
  }),
  commonjs(),
  tsBabel(),
  runtimeTerser,
];

const expPlugins = [
  external(),
  resolve({
    extensions: ['.ts'],
  }),
  RollupPluginPreprocess({
    include: ['**/*.ts'],
    context: {
      VM: true,
      CURRENT: 'exp',
    },
  }),
  commonjs(),
  tsBabel(),
  runtimeTerser,
];

const compilerPlugins = [
  keepBabelExternal(),
  external(),
  resolve({
    extensions: ['.ts'],
  }),
  RollupPluginPreprocess({
    include: ['**/*.ts'],
    context: {
      COMPILER: true,
      VM: false,
      CURRENT: 'all',
    },
  }),
  commonjs(),
  tsBabel(),
];

const artifactPlugins = [
  external(),
  resolve({
    extensions: ['.ts'],
  }),
  commonjs(),
  tsBabel(),
];

const fullPlugins = [
  keepSelfEntries(),
  keepBabelExternal(),
  external(),
  resolve({
    extensions: ['.ts'],
  }),
  RollupPluginPreprocess({
    include: ['**/*.ts'],
    context: {
      COMPILER: true,
      VM: true,
      CURRENT: 'all',
    },
  }),
  commonjs(),
  tsBabel(),
];

const cliPlugins = [
  keepSelfEntries(),
  keepBabelExternal(),
  external(),
  resolve({
    extensions: ['.ts'],
    preferBuiltins: true,
  }),
  RollupPluginPreprocess({
    include: ['**/*.ts'],
    context: {
      COMPILER: true,
      VM: true,
      CURRENT: 'all',
    },
  }),
  commonjs(),
  tsBabel(),
];

export default [
  {
    input: 'src/index.ts',
    output: [
      cjsOutput('dist/runtime.js'),
      cjsOutput(pkg.main.replace(/^\.\//, '')),
      esmOutput('dist/runtime.es.js'),
      esmOutput(pkg.module.replace(/^\.\//, '')),
    ],
    plugins: runtimePlugins,
  },
  {
    input: 'src/exp.ts',
    output: [cjsOutput('dist/exp.js'), esmOutput('dist/exp.es6.js')],
    plugins: expPlugins,
  },
  {
    input: 'src/compiler/index.ts',
    external: (id) => isBabelish(id) || isSelfEntry(id),
    output: [cjsOutput('dist/compiler.js'), esmOutput('dist/compiler.es.js')],
    plugins: compilerPlugins,
  },
  {
    input: 'src/artifact/index.ts',
    output: [cjsOutput('dist/artifact.js'), esmOutput('dist/artifact.es.js')],
    plugins: artifactPlugins,
  },
  {
    input: 'src/full/index.ts',
    external: (id) => isBabelish(id) || isSelfEntry(id),
    output: [cjsOutput('dist/full.js'), esmOutput('dist/full.es.js')],
    plugins: fullPlugins,
  },
  {
    input: 'src/cli/index.ts',
    external: (id) => isBabelish(id) || isSelfEntry(id) || isNodeBuiltin(id),
    output: {
      file: 'dist/cli.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
      banner: '#!/usr/bin/env node',
    },
    plugins: cliPlugins,
  },
];
