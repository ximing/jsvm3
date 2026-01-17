import { Script } from './runtime';

export function transform(
  code: string,
  fName: string,
  options?: { hoisting?: boolean; convertES5?: boolean }
): Script;

export function transformEXP(exp: string): Script;
