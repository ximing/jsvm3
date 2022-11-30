import { run } from '../helper';

describe('ins call spec:', () => {
  it('constructor function', () => {
    const res = run(
      `
var _PopLogic = /*#__PURE__*/ (function () {
  function _PopLogic() {}
  var _proto12 = _PopLogic.prototype;
  _proto12.useRenderFunc = function useRenderFunc(funcName) {
    var _this$popupController;
    return (_this$popupController = popupRender)[funcName].apply(_this$popupController, []);
  };
  return _PopLogic;
})();
    module.exports = new _PopLogic().useRenderFunc('test');
    `,
      {
        popupRender: {
          b: 1,
          test() {
            console.trace();
            console.log(this);
            return this.b;
          },
          p: {
            c() {
              return {
                b: 1,
                test() {
                  return this.b;
                },
              };
            },
          },
        },
      }
    );
    expect(res).toEqual(1);
  });

  it('ins call', () => {
    const res = run(
      `
let a = { b:2,c(){return this.b}};
let d;
module.exports = (d = a)['c'].apply(d,[])
    `
    );
    expect(res).toEqual(2);
  });
});
