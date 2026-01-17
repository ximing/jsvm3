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

function evalStackRenamePlugin() {
  return {
    visitor: {
      CallExpression({ node }) {
        if (t.isMemberExpression(node.callee)) {
          if (t.isIdentifier(node.callee.object) && node.callee.object.name === 'evalStack') {
            if (t.isIdentifier(node.callee.property)) {
              if (node.callee.property.name === 'push') {
                node.callee.property.name = 'p';
              }
              if (node.callee.property.name === 'pop') {
                node.callee.property.name = 'u';
              }
              if (node.callee.property.name === 'top') {
                node.callee.property.name = 't';
              }
            }
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
  mangle: {
    module: true,
    reserved: [],
    properties: {
      reserved: ['exec', 'realm', 'globalObj', 'createFiber'],
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
];
