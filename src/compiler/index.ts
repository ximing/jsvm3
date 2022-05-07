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
    });

    transformCode = result!.code!;
  }
  let ast = parse(transformCode, {
    sourceType: 'module',
    plugins: [],
  });
  const emitter = new Emitter([], fName, null, transformCode.split('\n'), transformCode);
  ast = emitter.visit(ast.program);
  return emitter.end();
};
