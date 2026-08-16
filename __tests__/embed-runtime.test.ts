import { compile } from '../src/compiler';
import { JSVM } from '../src/vm/vm';
import { JSVMTimeoutError, JSVMTypeError } from '../src/utils/errors';

const execExports = (source: string, host?: Record<string, unknown>, options?: ConstructorParameters<typeof JSVM>[1]) => {
  const json = compile(source, { filename: 'embed.js', convertES5: false });
  const vm = new JSVM(host, options);
  vm.exec(json);
  return { vm, exports: (vm.realm.globalObj as { module: { exports: unknown } }).module.exports };
};

describe('null/undefined property access', () => {
  it('null.foo throws JSVMTypeError, not a host ReferenceError', () => {
    expect(() => {
      execExports('module.exports = null.foo;');
    }).toThrow(JSVMTypeError);
    try {
      execExports('module.exports = null.foo;');
    } catch (err) {
      expect(err).toBeInstanceOf(JSVMTypeError);
      expect(err).not.toBeInstanceOf(ReferenceError);
      expect(String(err)).toMatch(/Cannot get property/);
    }
  });

  it('guest try/catch can catch null.foo', () => {
    const { exports } = execExports(`
      var caught = false;
      try {
        null.foo;
      } catch (e) {
        caught = true;
      }
      module.exports = caught;
    `);
    expect(exports).toBe(true);
  });

  it('undefined.bar() throws JSVMTypeError, not ReferenceError', () => {
    try {
      execExports('module.exports = (void 0).bar();');
    } catch (err) {
      expect(err).toBeInstanceOf(JSVMTypeError);
      expect(err).not.toBeInstanceOf(ReferenceError);
      expect(String(err)).toMatch(/Cannot cal method/);
    }
  });
});

describe('host-invoked guest callback budget', () => {
  it('applies JSVM timeout to a callback the host invokes later', () => {
    let cb: Function | undefined;
    const { exports } = execExports(
      `
      later(function () {
        var i = 0;
        while (i < 10000) { i = i + 1; }
      });
      module.exports = 1;
    `,
      {
        later(fn: Function) {
          cb = fn;
        },
      },
      { timeout: 40 }
    );
    expect(exports).toBe(1);
    expect(typeof cb).toBe('function');
    expect(() => cb!()).toThrow(JSVMTimeoutError);
  });

  it('applies JSVM maxDepth to a host-invoked guest callback', () => {
    let cb: Function | undefined;
    let seen = 0;
    execExports(
      `
      later(function () {
        function boom() {
          enter();
          boom();
        }
        boom();
      });
      module.exports = 1;
    `,
      {
        later(fn: Function) {
          cb = fn;
        },
        enter() {
          seen += 1;
        },
      },
      { maxDepth: 3 }
    );
    expect(() => cb!()).toThrow(/maximum cStack size/);
    expect(seen).toBeLessThan(10);
  });
});

describe('realm reset between execs', () => {
  it('reset() drops guest globals and module.exports but keeps host bindings', () => {
    const vm = new JSVM({ hostVal: 7 });
    vm.exec(compile('var leaked = 1; module.exports = { leaked: leaked };', { convertES5: false }));
    expect((vm.realm.globalObj as any).leaked).toBe(1);
    expect((vm.realm.globalObj as any).module.exports.leaked).toBe(1);

    vm.reset();

    expect((vm.realm.globalObj as any).leaked).toBeUndefined();
    expect((vm.realm.globalObj as any).hostVal).toBe(7);
    expect((vm.realm.globalObj as any).module.exports).toEqual({});
    expect((vm.realm.globalObj as any).exports).toBe((vm.realm.globalObj as any).module.exports);

    vm.exec(compile('module.exports = { leaked: typeof leaked, hostVal: hostVal };', { convertES5: false }));
    expect((vm.realm.globalObj as any).module.exports).toEqual({ leaked: 'undefined', hostVal: 7 });
  });

  it('resetOnExec isolates sequential execs on the same JSVM', () => {
    const vm = new JSVM({}, { resetOnExec: true });
    vm.exec(compile('var x = 1; module.exports = x;', { convertES5: false }));
    expect((vm.realm.globalObj as any).module.exports).toBe(1);
    vm.exec(compile('module.exports = typeof x;', { convertES5: false }));
    expect((vm.realm.globalObj as any).module.exports).toBe('undefined');
  });
});

describe('default compile of async/await', () => {
  it('does not compile async down to inlined regenerator helpers', () => {
    const json = compile(
      `
      module.exports = (async function () {
        return 1;
      })();
    `,
      { filename: 'async.js' }
    );
    const blob = JSON.stringify(json);
    expect(blob).not.toMatch(/regeneratorRuntime|_asyncToGenerator|_regenerator/);
  });

  it('async function return is a thenable that resolves', async () => {
    const json = compile(
      `
      module.exports = (async function () {
        return 1 + 2;
      })();
    `
    );
    const vm = new JSVM();
    vm.exec(json);
    const p = (vm.realm.globalObj as { module: { exports: unknown } }).module.exports as Promise<number>;
    expect(typeof (p as { then?: unknown }).then).toBe('function');
    await expect(p).resolves.toBe(3);
  });

  it('await unwraps a host promise', async () => {
    const json = compile(
      `
      module.exports = (async function () {
        var v = await later(7);
        return v + 1;
      })();
    `
    );
    const vm = new JSVM({
      later(v: number) {
        return Promise.resolve(v);
      },
    });
    vm.exec(json);
    const p = (vm.realm.globalObj as { module: { exports: unknown } }).module.exports;
    await expect(p).resolves.toBe(8);
  });

  it('calling an async function does not block the caller', async () => {
    let resolveLater: (() => void) | undefined;
    const json = compile(`
      var order = [];
      var p = (async function () {
        order.push(1);
        await later();
        order.push(3);
        return 9;
      })();
      order.push(2);
      module.exports = { p: p, order: order };
    `);
    const vm = new JSVM({
      later() {
        return new Promise<void>((resolve) => {
          resolveLater = resolve;
        });
      },
    });
    vm.exec(json);
    const exp = (vm.realm.globalObj as { module: { exports: { p: Promise<number>; order: number[] } } })
      .module.exports;
    expect(exp.order).toEqual([1, 2]);
    resolveLater!();
    await expect(exp.p).resolves.toBe(9);
    expect(exp.order).toEqual([1, 2, 3]);
  });

  it('await of a rejected host promise rejects the async function', async () => {
    const json = compile(
      `
      module.exports = (async function () {
        await later();
        return 1;
      })();
    `
    );
    const vm = new JSVM({
      later() {
        return Promise.reject(new Error('nope'));
      },
    });
    vm.exec(json);
    const p = (vm.realm.globalObj as { module: { exports: unknown } }).module.exports;
    await expect(p).rejects.toThrow(/nope/);
  });
});
