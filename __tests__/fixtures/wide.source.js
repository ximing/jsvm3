// Wide-opcode fixture source (arithmetic, call, closure, try/catch, RegExp).
// Regenerated into *.json via: npx ts-node --compiler-options '{"module":"commonjs"}' __tests__/fixtures/generate.ts
function add(a, b) {
  return a + b;
}

function makeAdder(x) {
  return function (y) {
    return add(x, y);
  };
}

function safeDiv(a, b) {
  try {
    if (b === 0) {
      throw new Error('div0');
    }
    return a / b;
  } catch (e) {
    return -1;
  }
}

var re = /^hello/gi;
var plus10 = makeAdder(10);

module.exports = {
  sum: add(2, 3),
  closed: plus10(5),
  ok: re.test('Hello'),
  fail: re.test('world'),
  div: safeDiv(10, 2),
  div0: safeDiv(1, 0),
};
