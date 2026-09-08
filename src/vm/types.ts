export type Trace = {
  at: {
    name: string;
    fName: string;
  };
  line: number;
  column: number;
  /** Instruction that threw. `frame.ip` already points at the next opcode. */
  ip: number;
  /** Preorder index in the script tree. Matches the symbol map's `script` field. */
  script: number;
};

export type CrashFrame = {
  script: number;
  name: string;
  fName: string;
  ip: number;
  line: number;
  column: number;
};

export type CrashReport = {
  artifactId?: string;
  error: { name: string; message: string };
  frames: CrashFrame[];
};

export type Guard = {
  start: number | null;
  handler: number | null;
  finalizer: number | null;
  end: number | null;
};
