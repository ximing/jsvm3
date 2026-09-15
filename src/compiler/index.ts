import * as babel from '@babel/core';
import { parse, parseExpression } from '@babel/parser';
import * as presetEnvModule from '@babel/preset-env';
import * as minifyDCEModule from 'babel-plugin-minify-dead-code-elimination';
import * as minifyFoldModule from 'babel-plugin-minify-constant-folding';
import * as minifyGuardModule from 'babel-plugin-minify-guarded-expressions';
import { Emitter } from './emitter';
import { printCodeWithLine } from './utils';
import { dumpArtifact } from '../utils/convert';
import { CompileError } from '../artifact/errors';
import { Artifact, CompileOptions, ScriptJson } from '../artifact/types';
import { SREXP } from '../opcodes';
import hoistingPlugin from './plugin/hoisting';
import { artifactIdOf } from '../debug/id';
import { makeLocator } from '../debug/locate';
import { buildSymbolMap, SymbolMap } from '../debug/map';
import { Script } from '../vm/script';

const babelPlugin = (mod: unknown) => {
  if (typeof mod === 'function') {
    return mod;
  }
  if (mod && typeof (mod as { default?: unknown }).default === 'function') {
    return (mod as { default: unknown }).default;
  }
  return mod;
};

const presetEnv = babelPlugin(presetEnvModule);
const minifyDCE = babelPlugin(minifyDCEModule);
const minifyFold = babelPlugin(minifyFoldModule);
const minifyGuard = babelPlugin(minifyGuardModule);

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

type LowerOptions = {
  hoisting: boolean;
  convertES5: boolean;
  sourceMap: boolean;
  filename: string;
};

function babelOptions(
  options: LowerOptions,
  inputMap: unknown,
  extra: Record<string, unknown>
) {
  const next: Record<string, unknown> = {
    configFile: false,
    babelrc: false,
    ...extra,
  };
  // Filename is only passed when a map is requested, so the default bytecode
  // stays identical to compile() without sourceMap.
  if (options.sourceMap) {
    next.sourceMaps = true;
    next.filename = options.filename;
    next.sourceFileName = options.filename;
    if (inputMap) {
      next.inputSourceMap = inputMap;
    }
  }
  return next;
}

function lower(code: string, options: LowerOptions): { code: string; map: any } {
  let current = code;
  let map: any = null;
  if (options.convertES5) {
    const result = babel.transformSync(
      current,
      babelOptions(options, null, {
        presets: [
          [
            presetEnv,
            {
              targets: {
                browsers: ['safari >= 9', 'android >= 4.4'],
              },
              useBuiltIns: false,
              exclude: [
                'transform-async-to-generator',
                'transform-regenerator',
                'transform-async-generator-functions',
              ],
            },
          ],
        ],
        assumptions: babelAssumptions,
      })
    );
    current = result!.code!;
    map = options.sourceMap ? result!.map : null;
  }
  if (process.env.JSVM_DEBUG) {
    printCodeWithLine(current);
  }
  const plugins: any[] = [
    [minifyDCE, { keepFnName: true, keepFnArgs: true, keepClassName: true }],
    minifyFold,
    minifyGuard,
  ];
  if (options.hoisting) {
    plugins.unshift(hoistingPlugin);
  }
  const result = babel.transformSync(current, babelOptions(options, map, { plugins }));
  return { code: result!.code!, map: options.sourceMap ? result!.map : null };
}

function emitScript(code: string, filename: string): Script {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: [],
  });
  const emitter = new Emitter([], filename, null, code.split('\n'), code);
  emitter.visit(ast.program);
  return emitter.end();
}

/**
 * @deprecated Cross-package callers should use compile() + loadArtifact();
 * same-process use accepts dual-instance risk. Unchanged behavior.
 */
export const transform = (
  code: string,
  fName: string,
  { hoisting, convertES5 } = { hoisting: true, convertES5: true }
) => {
  const lowered = lower(code, {
    hoisting,
    convertES5,
    sourceMap: false,
    filename: fName,
  });
  return emitScript(lowered.code, fName);
};

export const transformEXP = (exp: string) => {
  const ast = parseExpression(exp);
  const emitter = new Emitter(null, '<e>', null, exp.split('\n'), exp);
  emitter.visit(ast);
  // Same tail as ExpressionStatement so exec can store rexp and leave the stack empty.
  emitter.createINS(SREXP);
  return emitter.end();
};

export { dumpArtifact };
export { symbolicate, formatSymbolicated } from '../debug/map';
export { reportFromError } from '../debug/report';
export type { SymbolMap, CrashReport, Symbolicated, SymbolicatedFrame } from '../debug/map';

export interface CompileResult {
  artifact: ScriptJson | Artifact;
  /** Null unless `sourceMap` or `debug` is set. Not embedded unless `debug` and format 1. */
  map: SymbolMap | null;
}

/**
 * Not a sandbox: compiling untrusted source does not isolate it at runtime.
 * Failures throw CompileError with cause.
 * Defaults: hoisting true, convertES5 true, format 0 (bare ScriptJson array).
 * Format 1 envelopes include `artifactId`. Pass `sourceMap` to get a sidecar map
 * (ip → author line). Pass `debug` to also embed that map; do not ship it.
 */
export function compileWithMap(source: string, options?: CompileOptions): CompileResult {
  const filename = options?.filename;
  const hoisting = options?.hoisting ?? true;
  const convertES5 = options?.convertES5 ?? true;
  const format = options?.format ?? 0;
  const wantMap = options?.sourceMap === true || options?.debug === true;
  const mapName = filename ?? '<anonymous>';
  try {
    const lowered = lower(source, {
      hoisting,
      convertES5,
      sourceMap: wantMap,
      filename: mapName,
    });
    const script = emitScript(lowered.code, mapName);
    const dumped = dumpArtifact(script, { format, filename });
    if (Array.isArray(dumped)) {
      const artifactId = artifactIdOf(dumped);
      return {
        artifact: dumped,
        map: wantMap
          ? buildSymbolMap(script, makeLocator(lowered.map, mapName), {
              artifactId,
              filename: mapName,
              source,
            })
          : null,
      };
    }
    const artifactId = artifactIdOf(dumped.body);
    const map = wantMap
      ? buildSymbolMap(script, makeLocator(lowered.map, mapName), {
          artifactId,
          filename: mapName,
          source,
        })
      : null;
    const artifact: Artifact = {
      ...dumped,
      artifactId,
    };
    if (options?.debug && map) {
      (artifact as { debug?: { source: string; maps: SymbolMap } }).debug = {
        source,
        maps: map,
      };
    }
    return { artifact, map };
  } catch (cause) {
    if (cause instanceof CompileError) {
      throw cause;
    }
    throw new CompileError(cause instanceof Error ? cause.message : String(cause), filename, {
      cause,
    });
  }
}

export function compile(source: string, options?: CompileOptions): ScriptJson | Artifact {
  return compileWithMap(source, options).artifact;
}
