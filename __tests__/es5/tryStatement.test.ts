import { run } from '../helper';

describe('if scope spec:', () => {
  it('base', function () {
    const res = run(`
      const obj = {
        runTry: false,
        runError: false
      };
      try {
        obj.runTry = true;
      } catch (err) {
        obj.runError = true;
      }
      module.exports = obj;
    `);
    expect(res.runTry).toBeTruthy();
    expect(res.runError).not.toBeTruthy();
  });

  it('throw', function () {
    const res = run(`
      const obj = {
        runTry: false,
        runError: false
      };
      try {
        obj.runTry = true;
        throw new Error("invalid ...");
      } catch (err) {
        obj.runError = true;
      }
      module.exports = obj;
    `);
    expect(res.runTry).toBeTruthy();
    expect(res.runError).toBeTruthy();
  });

  it('finally', function () {
    const res = run(`
      const obj = {
        runTry: false,
        runError: false,
        runFinally: false
      };
      try {
        obj.runTry = true;
      } catch (err) {
        obj.runError = true;
      }finally{
        obj.runFinally = true;
      }
      module.exports = obj;
    `);
    expect(res.runTry).toBeTruthy();
    expect(res.runError).not.toBeTruthy();
    expect(res.runFinally).toBeTruthy();
  });

  it('throw function error', function () {
    const res = run(`
      var freeProcess = { binding:1 };
      var nodeUtil=function(){
        try{
          return freeProcess&&freeProcess.binding&&freeProcess.binding('util');
        }catch(e){
          return 1;
        }
      }();
      module.exports = nodeUtil
    `);
    expect(res).toBe(1);
  });

  it('try/finally without catch: normal path', function () {
    const res = run(`
      const obj = {
        runTry: false,
        runFinally: false
      };
      try {
        obj.runTry = true;
      } finally {
        obj.runFinally = true;
      }
      module.exports = obj;
    `);
    expect(res.runTry).toBeTruthy();
    expect(res.runFinally).toBeTruthy();
  });

  it('try/finally without catch: return in try', function () {
    const res = run(`
      function fn(){
        var log = [];
        try {
          log.push('try');
          return log;
        } finally {
          log.push('finally');
        }
      }
      module.exports = fn();
    `);
    expect(res).toEqual(['try', 'finally']);
  });

  it('try/finally without catch: rethrow after finally', function () {
    const ctx = { log: [] as string[] };
    expect(() => {
      run(
        `
        try {
          throw new Error('boom');
        } finally {
          log.push('finally');
        }
      `,
        ctx
      );
    }).toThrow('boom');
    expect(ctx.log).toEqual(['finally']);
  });
});
