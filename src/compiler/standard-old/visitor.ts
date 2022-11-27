import * as standard from './index';

export const visit = function (node: any) {
  if (node instanceof Array) {
    return visitArray(node);
  }
  if (node && node.type) {
    if (!standard[node.type]) {
      throw new Error(`unexpected ${node.type}`);
    }
    return standard[node.type](node);
  }
  if (node) {
    throw new Error('unexpected node');
  }
  return null;
};

export const visitArray = function (array: any[]) {
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
};
