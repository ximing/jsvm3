import { ENUMERATE, FUNCTION_SETUP, ITER, NEXT } from './ins';

export const OPCodeIdx = {
  SR1: 1,
  SR2: 2,
  SR3: 12,

  LR1: 4,
  LR2: 5,
  LR3: 13,

  SREXP: 7,

  LINE: 8,
  COLUMN: 9,

  GETL: 3,
  SETL: 6,

  POP: 10,
  DUP: 11,
  SWAP: 14,

  GLOBAL: 15,

  GET: 16,
  SET: 17,
  DEL: 18,

  GETG: 19,
  SETG: 20,

  INV: 25,
  LNOT: 26,
  NOT: 27,
  INC: 28,
  DEC: 29,

  ADD: 30,
  SUB: 31,
  MUL: 32,
  DIV: 33,
  MOD: 34,
  SHL: 35,
  SAR: 36,
  SHR: 37,
  OR: 38,
  AND: 39,
  XOR: 40,

  CEQ: 41,
  CNEQ: 42,
  CID: 43,
  CNID: 44,
  LT: 45,
  LTE: 46,

  GT: 47,
  GTE: 48,

  IN: 49,
  INSTANCEOF: 50,
  TYPEOF: 51,
  VOID: 52,

  UNDEF: 59,

  LITERAL: 60,
  STRING_LITERAL: 61,
  REGEXP_LITERAL: 62,
  OBJECT_LITERAL: 63,
  ARRAY_LITERAL: 64,

  ITER: 66,
  ENUMERATE: 67,
  NEXT: 68,

  JMP: 69,
  JMPT: 70,
  JMPF: 71,

  FUNCTION_SETUP: 72,
  FUNCTION: 73,
  REST: 74,
  RET: 75,
  RETV: 76,
  NEW: 77,
  CALL: 78,
  CALLM: 79,
  PAUSE: 80,
  YIELD: 81,
  THROW: 82,
  ENTER_GUARD: 83,
  EXIT_GUARD: 84,

  ENTER_SCOPE: 86,
  EXIT_SCOPE: 87,

  DEBUG: 88,
};
