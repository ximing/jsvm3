import { compile } from '../src/compiler';
import { CompileError } from '../src/artifact/errors';
import { ARTIFACT_MAGIC } from '../src/artifact';
import { JSVM } from '../src/vm/vm';
import { transform } from '../src/compiler';
import { run, FullJSVM } from '../src/full';

describe('compile / loadArtifact / run APIs', () => {
  it('compile defaults to a format 0 bare array', () => {
    const json = compile('module.exports = 1 + 2;');
    expect(Array.isArray(json)).toBe(true);
    expect((json as unknown as { magic?: string }).magic).toBeUndefined();

    const vm = new JSVM();
    vm.exec(json);
    expect((vm.realm.globalObj as any).module.exports).toEqual(3);
  });

  it('compile({ format: 1 }) returns an envelope and exec hydrates it', () => {
    const artifact = compile('module.exports = 4;', { format: 1, filename: 'four.js' });
    expect(Array.isArray(artifact)).toBe(false);
    expect((artifact as { magic: string }).magic).toBe(ARTIFACT_MAGIC);
    expect((artifact as { format: number }).format).toBe(1);

    const vm = new JSVM();
    vm.exec(artifact as any);
    expect((vm.realm.globalObj as any).module.exports).toEqual(4);
  });

  it('compile wraps parse failures in CompileError', () => {
    try {
      compile('function (', { filename: 'bad.js' });
      throw new Error('expected CompileError');
    } catch (err) {
      expect(err).toBeInstanceOf(CompileError);
      expect((err as CompileError).filename).toBe('bad.js');
      expect((err as CompileError).code).toBe('COMPILE_ERROR');
      expect((err as { cause?: unknown }).cause).toBeDefined();
    }
  });

  it('exec rejects source strings at runtime', () => {
    const vm = new JSVM();
    expect(() =>
      // @ts-expect-error JSVM.exec does not accept source strings
      vm.exec('module.exports = 1')
    ).toThrow(TypeError);
  });

  it('copies timeout and maxDepth onto each Fiber', () => {
    const script = transform('module.exports = 1;', 't.js', {
      hoisting: true,
      convertES5: false,
    });
    const vm = new JSVM({}, { timeout: 5, maxDepth: 3 });
    expect(vm.defaultTimeout).toBe(5);
    expect(vm.maxDepth).toBe(3);
    const fiber = vm.createFiber(script);
    expect(fiber.timeout).toBe(5);
    expect(fiber.maxDepth).toBe(3);
  });

  it('run returns module.exports, not rexp', () => {
    expect(run('module.exports = { ok: true };')).toEqual({ ok: true });
  });

  it('FullJSVM.run returns module.exports', () => {
    const vm = new FullJSVM({ value: 9 });
    expect(vm.run('module.exports = value;')).toEqual(9);
  });
});
