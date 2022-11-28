import { parse } from '@babel/parser';
import { Visitor } from './visitor';

// 每个操作码都有一个堆栈深度因子，它是opcode 将把评估堆栈带到，稍后用于确定运行脚本所需的最大堆栈大小
// 在大多数情况下这个数字是静态的，只取决于opcode function body。为了避免必须手动维护数字，我们解析操作码通过遍历 ast 获取并计算推送 - 弹出的次数。
// 这个比较hack，但似乎没啥问题
class Counter extends Visitor {
  factor: number;
  current: number;
  constructor() {
    super();
    this.factor = 0;
    this.current = 0;
  }

  CallExpression(node) {
    node = super.CallExpression(node);
    if (node.callee.type === 'MemberExpression') {
      let name;
      if (node.callee.property.type === 'Identifier') {
        ({ name } = node.callee.property);
      } else if (node.callee.property.type === 'Literal') {
        name = node.callee.property.value;
      } else {
        throw new Error('Counter assert error');
      }
      if (name === 'push') {
        this.current++;
      } else if (name === 'pop') {
        this.current--;
      }
      this.factor = Math.max(this.factor, this.current);
    }
    return node;
  }
}

export function calculateOpcodeFactor(opcodeFn) {
  const ast = parse(`(${opcodeFn.toString()})`);
  const counter = new Counter();
  counter.visit(ast);
  return counter.factor;
}
