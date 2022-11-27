export type Trace = {
  at: {
    name: string;
    filename: string;
  };
  line: number;
  column: number;
};
