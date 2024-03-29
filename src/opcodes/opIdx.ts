export const OPCodeIdx = {
  SR1: 16,
  SR2: 17,
  SR3: 12,

  LR1: 19,
  LR2: 20,
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

  GET: 1,
  SET: 2,
  DEL: 18,

  GETG: 4,
  SETG: 5,
  SLHS: 21,
  LLHS: 22,
  DECLG: 23,

  PLU: 25,
  INV: 26,
  LNOT: 27,
  NOT: 28,
  INC: 29,
  DEC: 30,

  ADD: 31,
  SUB: 32,
  MUL: 33,
  DIV: 34,
  MOD: 35,
  SHL: 36,
  SAR: 37,
  SHR: 38,
  OR: 39,
  AND: 40,
  XOR: 41,
  EXP: 42,

  CEQ: 44,
  CNEQ: 45,
  CID: 46,
  CNID: 47,
  LT: 48,
  LTE: 49,

  GT: 50,
  GTE: 51,

  IN: 52,
  INSTANCEOF: 53,
  TYPEOF: 54,
  VOID: 55,

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
