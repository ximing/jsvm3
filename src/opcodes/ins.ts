/* eslint @typescript-eslint/no-unused-vars: 0 */
import { call, callm, createFunction, createOP, ret } from './utils';
// @ifdef COMPILER
import { OPCodeIdx } from './opIdx';
// @endif
export const InsMap = new Map();
/*
 * 存储到寄存器1
 * */
export const SR1 = createOP(
  OPCodeIdx.SR1,
  function (frame, evalStack, scope, realm, args) {
    frame.fiber.r1 = evalStack.pop();
  },
  () => 0
);
export const SR2 = createOP(OPCodeIdx.SR2, function (frame, evalStack, scope, realm, args) {
  frame.fiber.r2 = evalStack.pop();
});

export const SR3 = createOP(OPCodeIdx.SR3, function (frame, evalStack, scope, realm, args) {
  frame.fiber.r3 = evalStack.pop();
});
/*
 * 从寄存器1读取
 * */
export const LR1 = createOP(
  OPCodeIdx.LR1,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(frame.fiber.r1);
  },
  () => 1
);
export const LR2 = createOP(
  OPCodeIdx.LR2,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(frame.fiber.r2);
  },
  () => 1
);
export const LR3 = createOP(
  OPCodeIdx.LR3,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(frame.fiber.r3);
  },
  () => 1
);
/*
 * 存储表达式结果到(表达式)寄存器中  Store Result of EXPression
 * */
export const SREXP = createOP(OPCodeIdx.SREXP, function (frame, evalStack, scope, realm, args) {
  evalStack.fiber.rexp = evalStack.pop();
});

export const POP = createOP(OPCodeIdx.POP, function (frame, evalStack, scope, realm, args) {
  evalStack.pop();
});

export const DUP = createOP(
  OPCodeIdx.DUP,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(evalStack.top());
  },
  () => 1
);

export const SWAP = createOP(OPCodeIdx.SWAP, function (frame, evalStack, scope, realm, args) {
  const [bot, top] = evalStack.tail(2);
  evalStack.push(top);
  evalStack.push(bot);
});

export const GLOBAL = createOP(
  OPCodeIdx.GLOBAL,
  function (frame, evalStack, scope, realm, args) {
    evalStack.push(realm.globalObj);
  },
  () => 1
);

export const SLHS = createOP(OPCodeIdx.SLHS, function (frame, evalStack, scope, realm, args) {
  // console.log('SLHS', obj, key);
  // [key, obj]
  frame.lref.push(evalStack.tail(2));
});

export const LLHS = createOP(
  OPCodeIdx.LLHS,
  function (frame, evalStack, scope, realm, args) {
    const [key, obj] = frame.lref.pop();
    frame.fiber.r1 = key;
    frame.fiber.r2 = obj;
    evalStack.push(key);
    evalStack.push(obj);
  },
  () => 2
);
