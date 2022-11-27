import { Program } from '@babel/types';
import { isVariableDeclaration, isFunctionDeclaration } from '../babelTypes';
import { visit } from '../visitor';
/*
"program": {
    "type": "Program",
    "start": 0,
    "end": 259,
    "loc": {
      "start": {
        "line": 1,
        "column": 0
      },
      "end": {
        "line": 11,
        "column": 0
      }
    },
    "sourceType": "module",
    "interpreter": null,
    "body": [],
    "directives": []
  },
* */
export function Program(program: Program) {
  // hoisting
  for (const node of program.body) {
    if (isFunctionDeclaration(node)) {
      visit(node);
    } else if (isVariableDeclaration(node)) {
      // for (const declaration of node.declarations) {
      //   if (node.kind === Kind.var) {
      //     scope.declareVar((declaration.id as Identifier).name, undefined);
      //   }
      // }
    }
  }
  let result;
  for (const node of program.body) {
    if (!isFunctionDeclaration(node)) {
      result = visit(node);
    }
  }
  return result;
}
