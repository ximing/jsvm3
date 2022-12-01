import { ErrNotDefined } from '../../old-src/error';
import { run } from '../helper';

describe('es2015 hoisting spec:', () => {
  // https://developer.mozilla.org/zh-CN/docs/Glossary/Hoisting
  it('let should not Hoisting', function () {
    expect(() =>
      run(`
      function fn(a){}
      fn(a);
      let a = 123;
    `)
    ).toThrow('a is not defined');
  });

  it('const should not Hoisting', function () {
    expect(() =>
      run(`
      function fn(a){}
      fn(a);
      const a = 123;
    `)
    ).toThrow('a is not defined');
  });
});
