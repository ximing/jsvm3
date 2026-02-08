export interface LabelHost {
  readonly instructions: { readonly length: number };
}

export class Label {
  static id = 1;
  readonly emitter: LabelHost;
  readonly id: number;
  ip: number | null;

  constructor(emitter: LabelHost) {
    this.emitter = emitter;
    this.id = Label.id++;
    this.ip = null;
  }

  mark(): number {
    return (this.ip = this.emitter.instructions.length);
  }
}
