import { Emitter } from '../compiler/emitter';

export class Label {
  static id = 1;
  emitter: Emitter;
  id: number;
  ip: number | null;

  constructor(emitter) {
    this.emitter = emitter;
    this.id = Label.id++;
    this.ip = null;
  }

  mark() {
    return (this.ip = this.emitter.instructions.length);
  }
}
