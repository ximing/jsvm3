import { transform } from '../src/compiler';
import { fromJson, scriptToJson } from '../src/utils/convert';
import { JSVM } from '../src/vm/vm';

const runViaJson = function (code: string) {
  const script = transform(code, 'test.js', { hoisting: true, convertES5: false });
  // 模拟真实的序列化场景：JSON 往返后再反序列化执行
  const json = JSON.parse(JSON.stringify(scriptToJson(script)));
  const restored = fromJson(json);
  const vm = new JSVM();
  vm.exec(restored);
  return (vm.realm.globalObj as any).module.exports;
};

describe('fromJson', function () {
  it('should execute a script restored from json', function () {
    expect(runViaJson(`module.exports = 1 + 2;`)).toEqual(3);
  });

  it('should restore children scripts (functions)', function () {
    expect(
      runViaJson(`
        function fibonacci(n) {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
        module.exports = fibonacci(10);
      `)
    ).toEqual(55);
  });
});
