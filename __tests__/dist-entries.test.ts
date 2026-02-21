import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');
const compilerPath = path.join(root, 'dist/compiler.js');
const runtimePath = path.join(root, 'dist/runtime.js');
const fullPath = path.join(root, 'dist/full.js');
const hasDist =
  fs.existsSync(compilerPath) && fs.existsSync(runtimePath) && fs.existsSync(fullPath);
const describeDist = hasDist ? describe : describe.skip;

describeDist('published dist entries', () => {
  it('require(dist/compiler).compile works without ./plugin/hoisting', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { compile } = require(compilerPath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { JSVM, loadArtifact } = require(runtimePath);
    const json = compile('module.exports = 1 + 2;', {
      filename: 'dist-smoke.js',
      convertES5: false,
    });
    expect(Array.isArray(json)).toBe(true);
    const vm = new JSVM();
    vm.exec(loadArtifact(json));
    expect(vm.realm.globalObj.module.exports).toBe(3);
  });

  it('require(dist/full).run returns module.exports', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { run } = require(fullPath);
    expect(run('module.exports = { ok: 1 };', { convertES5: false })).toEqual({ ok: 1 });
  });

  it('resetOnExec and host-callback timeout work on dist/runtime', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { compile } = require(compilerPath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { JSVM } = require(runtimePath);
    const vm = new JSVM({}, { resetOnExec: true });
    vm.exec(compile('var x = 1; module.exports = x;', { convertES5: false }));
    vm.exec(compile('module.exports = typeof x;', { convertES5: false }));
    expect(vm.realm.globalObj.module.exports).toBe('undefined');

    let cb;
    const vm2 = new JSVM(
      {
        later(fn) {
          cb = fn;
        },
      },
      { timeout: 40 }
    );
    vm2.exec(
      compile('later(function () { var i = 0; while (i < 10000) { i = i + 1; } }); module.exports = 1;', {
        convertES5: false,
      })
    );
    expect(() => cb()).toThrow(/timed out/);
  });

  it('default compile of async/await runs on dist/runtime', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { compile } = require(compilerPath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { JSVM } = require(runtimePath);
    const json = compile(`
      module.exports = (async function () {
        var v = await later(7);
        return v + 1;
      })();
    `);
    const vm = new JSVM({
      later(v) {
        return Promise.resolve(v);
      },
    });
    vm.exec(json);
    await expect(vm.realm.globalObj.module.exports).resolves.toBe(8);
  });

  it('timed-out exec on dist/runtime is an Error without a fiber field', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { compile } = require(compilerPath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require(runtimePath);
    const { JSVM, JSVMTimeoutError } = runtime;
    expect(typeof JSVMTimeoutError).toBe('function');
    const vm = new JSVM({}, { timeout: 20 });
    try {
      vm.exec(
        compile('var i = 0; while (i < 10000) { i = i + 1; } module.exports = i;', { convertES5: false })
      );
      throw new Error('expected timeout');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(JSVMTimeoutError);
      expect((err as { fiber?: unknown }).fiber).toBeUndefined();
    }
  });

  it('null.foo on dist/runtime is JSVMTypeError, not ReferenceError', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { compile } = require(compilerPath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { JSVM } = require(runtimePath);
    const json = compile('module.exports = null.foo;', { convertES5: false });
    const vm = new JSVM();
    try {
      vm.exec(json);
      throw new Error('expected throw');
    } catch (err) {
      expect((err as Error).name).not.toBe('ReferenceError');
      expect(String(err)).toMatch(/Cannot get property/);
      expect(String(err)).not.toMatch(/Cannot is not defined/);
    }
  });
});
