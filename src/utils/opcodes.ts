import type { Frame } from '../vm/frame';

export const throwErr = function (frame: Frame, err) {
  frame.evalError = err;
  return (frame.paused = true);
};
