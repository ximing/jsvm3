import * as babel from '@babel/core';
import { parse, parseExpression } from '@babel/parser';
import { Emitter } from './emitter';

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
          '@babel/preset-env',
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
  const plugins = [
    ['minify-dead-code-elimination', { keepFnName: true, keepFnArgs: true, keepClassName: true }],
    ['minify-constant-folding'],
    ['minify-guarded-expressions'],
  ];
  if (hoisting) {
    plugins.unshift(require('./plugin/hoisting'));
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
