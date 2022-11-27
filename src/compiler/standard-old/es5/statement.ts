import * as t from '@babel/types';
import { isFunctionDeclaration, isVariableDeclaration } from '../babelTypes';
import { visit } from '../visitor';

export function ExpressionStatement(node: t.ExpressionStatement) {
  return visit(node.expression);
}

export function DebuggerStatement() {
  debugger;
}

export function LabeledStatement(node: t.LabeledStatement) {}

export function EmptyStatement() {}

// A block statement, i.e., a sequence of statements surrounded by braces.
export function BlockStatement(block: t.BlockStatement) {
  // let blockScope: Scope = !scope.isolated ? scope : scope.createChild(ScopeType.Block);
  /*
   * function b(){
   *   let a = 0;
   *   {
   *       let a = 0
   *   }
   * }
   * 处理上面这种情况的，如果根是 function scope的话，没必要多新建一个 block作用域，但是里面的二级作用域需要创建
   * */
  // const blockScope =
  //   scope.type !== ScopeType.Block && parent?.scope !== scope
  //     ? scope
  //     : scope.createChild(ScopeType.Block);
  // if (scope.isolated) {
  //   blockScope = scope.createChild(ScopeType.Block);
  //   // blockScope.invasive = true;
  // } else {
  //   blockScope = scope;
  // }
  // blockScope.isolated = true;
  // hoisting
}
