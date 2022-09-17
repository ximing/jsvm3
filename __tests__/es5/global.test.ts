import { run } from '../helper';

describe('global spec:', () => {
  it('basic', () => {
    const a = run(
      `
num = 6;
var num;
module.exports = num;
  `
    );
    expect(a).toEqual(6);
  });

  it('basic1', () => {
    const { a, b } = run(
      `
var a = (get() , 2);
var b;
function get(){
  b = 3;
}
module.exports = {a: a, b: b};
  `
    );
    expect(a).toEqual(2);
    expect(b).toEqual(3);
  });

  it('basic2', () => {
    const a = run(
      `
var _Sequence;
(function (Sequence2) {
Sequence2.a = 1;
})(_Sequence || (_Sequence = {}));
module.exports = _Sequence;
  `
    );
    expect(a.a).toEqual(1);
  });
});
