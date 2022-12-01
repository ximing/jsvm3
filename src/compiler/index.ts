import * as babel from '@babel/core';
import { parse, parseExpression } from '@babel/parser';
import { Emitter } from './emitter';

export const transform = (
  code,
  filename,
  { hoisting, convertES5 } = { hoisting: true, convertES5: true }
) => {
  let transformCode = code;
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
    transformCode = result!.code;
  }
  if (hoisting) {
    const result = babel.transformSync(transformCode, {
      plugins: [require('./plugin/hoisting')],
      configFile: false,
      babelrc: false,
    });
    transformCode = result!.code;
  }
  // console.log(transformCode);
  // try {
  //   let ast = parse(transformCode, {
  //     sourceType: 'module',
  //     plugins: [],
  //   });
  //   const emitter = new Emitter(null, filename, null, transformCode.split('\n'));
  //   ast = emitter.visit(ast);
  //   console.log(ast);
  //   return emitter.end();
  // } catch (err) {
  //   console.log(transformCode);
  //   throw err;
  // }
  let ast = parse(transformCode, {
    sourceType: 'module',
    plugins: [],
  });
  const emitter = new Emitter([], filename, null, transformCode.split('\n'), transformCode);
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
