export type Trace = {
  at: {
    name: string;
    fName: string;
  };
  line: number;
  column: number;
};

export type Guard = {
  start: number | null;
  handler: number | null;
  finalizer: number | null;
  end: number | null;
};
