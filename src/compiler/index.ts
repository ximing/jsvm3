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

/**
 * @deprecated Cross-package callers should use compile() + loadArtifact();
 * same-process use accepts dual-instance risk. Unchanged behavior.
 */
export const transform = (
  code: string,
  fName: string,
  { hoisting, convertES5 } = { hoisting: true, convertES5: true }
) => {
  let transformCode: string = code;
  if (convertES5) {
    const result = babel.transformSync(code, {
      presets: [
        [
          presetEnv,
          {
            targets: {
              browsers: ['safari >= 9', 'android >= 4.4'],
            },
            useBuiltIns: false,
          },
        ],
      ],
      // @ts-ignore
      assumptions: {
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
      },
      configFile: false,
      babelrc: false,
    });

    transformCode = result!.code!;
  }
  // 性能 编译期优化
  const plugins: any[] = [
    [minifyDCE, { keepFnName: true, keepFnArgs: true, keepClassName: true }],
    minifyFold,
    minifyGuard,
  ];
  if (hoisting) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    plugins.unshift(require('./plugin/hoisting'));
  }
  if (process.env.JSVM_DEBUG) {
    printCodeWithLine(transformCode);
  }
  const result = babel.transformSync(transformCode, {
    plugins,
    configFile: false,
    babelrc: false,
  });
  transformCode = result!.code!;
  let ast = parse(transformCode, {
    sourceType: 'module',
    plugins: [],
  });
  // console.log(transformCode);
  const emitter = new Emitter([], fName, null, transformCode.split('\n'), transformCode);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ast = emitter.visit(ast.program);
  // console.log(ast);
  return emitter.end();
};

export const transformEXP = (exp: string) => {
  const ast = parseExpression(exp);
  const emitter = new Emitter(null, '<e>', null, exp.split('\n'), exp);
  emitter.visit(ast);
  return emitter.end();
};

export { dumpArtifact };

/**
 * Not a sandbox: compiling untrusted source does not isolate it at runtime.
 * transform() + dumpArtifact(). Failures throw CompileError with cause.
 * Defaults: hoisting true, convertES5 true, format 0 (bare ScriptJson array).
 */
export function compile(source: string, options?: CompileOptions): ScriptJson | Artifact {
  const filename = options?.filename;
  const hoisting = options?.hoisting ?? true;
  const convertES5 = options?.convertES5 ?? true;
  const format = options?.format ?? 0;
  try {
    const script = transform(source, filename ?? '<anonymous>', { hoisting, convertES5 });
    return dumpArtifact(script, {
      format,
      filename,
      debug: options?.debug,
    });
  } catch (cause) {
    if (cause instanceof CompileError) {
      throw cause;
    }
    throw new CompileError(
      cause instanceof Error ? cause.message : String(cause),
      filename,
      { cause }
    );
  }
}
