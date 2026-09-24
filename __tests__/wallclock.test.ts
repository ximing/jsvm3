import { compile } from '../src/compiler';
import { JSVM } from '../src/vm/vm';
import { JSVMTimeoutError } from '../src/utils/errors';

function run(source: string, options: ConstructorParameters<typeof JSVM>[1]) {
  const json = compile(source, { filename: 'wall.js', convertES5: false });
  const vm = new JSVM({}, options);
  vm.exec(json);
  return (vm.realm.globalObj as { module: { exports: unknown } }).module.exports;
}

describe('wallMs', () => {
  it('stops an infinite loop on the wall clock while the instruction budget is unlimited', () => {
    expect(() => run('while (true) {}', { timeout: -1, wallMs: 80 })).toThrow(JSVMTimeoutError);
  });

  it('returns exports when the script finishes inside the wall clock', () => {
    expect(run('module.exports = 3;', { timeout: -1, wallMs: 5000 })).toBe(3);
  });

  it('still stops on the instruction budget when the wall clock is long', () => {
    expect(() => run('while (true) {}', { timeout: 50, wallMs: 5000 })).toThrow(JSVMTimeoutError);
  });
});
