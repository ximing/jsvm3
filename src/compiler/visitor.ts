import * as t from '@babel/types';

// Base class for classes that perform ast transformation
// Any subclass must return a node on the type-specific methods
// or null to delete that node
export class Visitor {
  visit(node: any) {
    if (node instanceof Array) {
      return this.visitArray(node);
    }
    if (node && node.type) {
      // @ts-ignore
      if (!this[node.type]) {
        throw new Error(`${node.type} 未实现`);
      }
      // @ts-ignore
      return this[node.type](node);
    }
    if (node) {
      throw new Error('unexpected node');
    }
    return null;
  }

  visitArray(array: any[]) {
    let i = 0;
    while (i < array.length) {
      if (!array[i]) {
        i++;
        continue;
      }
      const result = this.visit(array[i]);
      if (result) {
        array[i++] = result;
      } else {
        array.splice(i, 1);
      }
    }
    return array;
  }

  Program(node: t.Program) {
    node.body = this.visit(node.body);
    return node;
  }
}
