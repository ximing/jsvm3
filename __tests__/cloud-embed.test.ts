import { compile } from '../src/compiler';
import { JSVM, loadArtifact } from 'jsvm3/runtime';
import { JSVMError, JSVMTimeoutError, JSVMTypeError } from '../src/utils/errors';
import { ARTIFACT_MAGIC, OPCODE_VERSION } from '../src/artifact/version';
import * as runtimeEntry from 'jsvm3/runtime';

const exec = (source: string, host?: Record<string, unknown>, options?: ConstructorParameters<typeof JSVM>[1]) => {
  const json = compile(source, { filename: 'cloud.js', convertES5: false });
  const vm = new JSVM(host, options);
  const rexp = vm.exec(json);
  return { vm, rexp, exports: (vm.realm.globalObj as { module: { exports: unknown } }).module.exports };
};

describe('execution errors for host reporting', () => {
  it('JSVMError and JSVMTimeoutError are Error instances', () => {
    expect(new JSVMError('x')).toBeInstanceOf(Error);
    expect(new JSVMTimeoutError()).toBeInstanceOf(Error);
    expect(new JSVMTimeoutError()).toBeInstanceOf(JSVMError);
    expect(new JSVMTypeError('nope')).toBeInstanceOf(Error);
  });

  it('jsvm3/runtime re-exports the execution error classes', () => {
    expect((runtimeEntry as { JSVMTimeoutError?: unknown }).JSVMTimeoutError).toBe(JSVMTimeoutError);
    expect((runtimeEntry as { JSVMError?: unknown }).JSVMError).toBe(JSVMError);
    expect((runtimeEntry as { JSVMTypeError?: unknown }).JSVMTypeError).toBe(JSVMTypeError);
  });

  it('createFiber can resume after JSVMTimeoutError with a new budget', () => {
    const json = compile('var i = 0; while (i < 80) { i = i + 1; } module.exports = i;', {
      filename: 'slice.js',
      convertES5: false,
    });
    const vm = new JSVM();
    const fiber = vm.createFiber(loadArtifact(json), 8);
    expect(() => fiber.run()).toThrow(JSVMTimeoutError);
    fiber.resume(1_000_000);
    expect((vm.realm.globalObj as { module: { exports: unknown } }).module.exports).toBe(80);
  });

  it('a timed-out exec throws JSVMTimeoutError without retaining the Fiber', () => {
    try {
      exec(
        'var i = 0; while (i < 10000) { i = i + 1; } module.exports = i;',
        {},
        { timeout: 20 }
      );
      throw new Error('expected timeout');
    } catch (err) {
      expect(err).toBeInstanceOf(JSVMTimeoutError);
      expect(err).toBeInstanceOf(Error);
      expect(Object.prototype.hasOwnProperty.call(err, 'fiber')).toBe(false);
      expect((err as { fiber?: unknown }).fiber).toBeUndefined();
      const json = JSON.stringify(err);
      expect(json).not.toMatch(/callStack|globalObj|realm/);
    }
  });
});

describe('cloud Path A contract', () => {
  it('Path A callers must read module.exports; exec is the last expression', () => {
    const { rexp, exports } = exec('module.exports = 1; (function () { return 2; })();');
    expect(exports).toBe(1);
    expect(rexp).toBe(2);
  });

  it('compile({ format: 1 }) writes an envelope the runtime can exec', () => {
    const artifact = compile('module.exports = 4;', {
      filename: 'rule.js',
      convertES5: false,
      format: 1,
    });
    expect(Array.isArray(artifact)).toBe(false);
    expect((artifact as { magic: string; opcode: number }).magic).toBe(ARTIFACT_MAGIC);
    expect((artifact as { opcode: number }).opcode).toBe(OPCODE_VERSION);
    const vm = new JSVM();
    vm.exec(artifact);
    expect((vm.realm.globalObj as { module: { exports: unknown } }).module.exports).toBe(4);
  });

  it('stock JSVM does not define Map (inject it if the script needs it)', () => {
    expect(() => exec('module.exports = new Map();')).toThrow(/Map/);
    const { exports } = exec('module.exports = new Map([[1, 2]]).get(1);', { Map: Map });
    expect(exports).toBe(2);
  });

  it('host merge can hide Function without a new Realm API', () => {
    const { exports } = exec('module.exports = typeof Function;', { Function: undefined });
    expect(exports).toBe('undefined');
  });
});
