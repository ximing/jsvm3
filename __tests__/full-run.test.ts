import { run, FullJSVM } from 'jsvm3/full';

describe('public run() (path B)', () => {
  it('returns module.exports, not exec rexp', () => {
    expect(run('module.exports = { ok: true }; 99')).toEqual({ ok: true });
  });

  it('returns an empty exports object when source does not assign module.exports', () => {
    expect(run('var x = 1 + 2;')).toEqual({});
  });

  it('returns a primitive assigned to module.exports', () => {
    expect(run('module.exports = 1 + 2;')).toEqual(3);
  });

  it('injects host bindings', () => {
    expect(run('module.exports = value;', { host: { value: 7 } })).toEqual(7);
  });

  it('FullJSVM.run returns module.exports', () => {
    const vm = new FullJSVM({ value: 9 });
    expect(vm.run('module.exports = value; 1')).toEqual(9);
  });
});
