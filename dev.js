const { transform } = require('./lib/compiler');
const { Vm } = require('./lib/vm/vm');
// const code = `
// let a = 4;
// let b = 1;
// let c = (a+b)*5
// `;

// const code = `
// const c = 1;
// function a(d){
//   return c + d;
// }
// a(2);
// `;

// const code = `
// let a = 2;
// switch(a){
//   case 1:
//     console.log(1);
//     break;
//   case 2:
//     console.log('------->',2);
//     break;
//   default:
//     console.log('default')
// }
// `;

// const code = `
// const l = 10;
// for(let i =0 ;i<l; i++){
//   if(i===3){
//     break;
//   }
//   console.log('---->',i);
// }
// `;
//
// const code = `
// try{
//   throw 1
// }catch(err){
//   console.log('err',err)
// }finally{
//   console.log('finally')
// }
// `;

// const code = `
// module.exports = [0, false, undefined, null];
// `;

// const code = `
// module.exports = [1,,2];
// `;

// const code = `
// var a = 0 || 1;
// var b = 0 && 1;
// module.exports = {a,b};
// `;

// const code = `
// a = 1;
// module.exports = a;
// `

// const code = `
//     var a = 0,b = 0,c = 1,d = 2,e = 2,f = 2,g = 2,h = 2,i = 2,j = 2,k = 2,l = 2;
//     a +=1;
//     b -=1;
//     c *=2;
//     d /=2;
//     e %=2;
//     f <<= 2;
//     g >>= 2;
//     h >>>= 2;
//     i &= 2;
//     j ^= 2;
//     k |= 2;
//     l **= 2;
//     var obj = {a,b,c,d,e,f,g,h,i,j,k,l};
//     module.exports = obj;
// `;

// const code = `
// function fn(a,b){
//   let c = 1;
//         return a+b+c;
// }
// module.exports = fn;
// `

// const code = `const obj = {
//         sum(a,b){
//           return a+b;
//         },
//         sub:function(a,b){
//           return a-b;
//         }
//       }
//       module.exports = obj;`;

// const code = `function fn (name = 'ximing'){ return name;}
//       module.exports = fn();`

// const code = `module.exports = "".concat(1,2,3);`;

// const code = `function test(){
//             return  this;
//         }
//         var da = {
//             o: true,
//             func: test,
//         };
//         module.exports = (0, da.func)();`;

// const code = `const obj = {
//         a:1
//       };
//       module.exports = obj.a();`

// const code = `
//       const reg = /^hello/;
//       function isSayHi(word) {
//         console.log(reg, word)
//         return reg.test(word);
//       }
//       module.exports = isSayHi;`;

// const code = `const obj = {
//         a: false,
//         b: 0,
//         c: '123'
//       };
//       for(let attr in obj){
//         console.log(attr);
//         if(attr === 'a') continue;
//         if(attr === 'c') break;
//         obj[attr] = !!obj[attr];
//       }
//       module.exports = obj;`

// const code = `Function.__proto__.__proto__ === Object.prototype`
// const code = `var a = 1;
//       for(;;){
//         var a = 2;
//         break;
//       }`

// const code = ` var num = 1;
//     var obj = {a: ++num,b: num++,c:--num,d:num--,num};`;

// const code = ` var a = {n: 1};
//         var b = a;
//         a.x = a = {n: 2};
//         module.exports = {a, b};`;

// const code = `var a = 1;
//       doLoop:
//       do {
//         console.log('1',a);
//         a++;
//         continue doLoop;
//         console.log('2',a);
//       } while (a<10);
//       module.exports = a;`;

// const code = `function createPerson(name, age, job) {
//       let person = new Object();
//       person.name = name;
//       person.age = age;
//       person.job = job;
//       person.sayName = function () {
//         return name
//       };
//
//       return person;
//     }
//     module.exports = {
//       p : createPerson('Ben', 21, 'student')
//     }`;

// const code = `  var arr = [0, 1, undefined, null];
//   arr[0]+=1;
//   arr[1] = 100;
//   arr[4] = 4;
//   module.exports = arr;`;
//
// const script = transform(code, 'sum.js', { hoisting: true, convertES5: false });
// console.log(JSON.stringify(script.toJSON(), null, 2));
// console.log('===============+> run');
// const vm = new Vm();
// const res = vm.run(script);
// // console.log(JSON.stringify(script.toJSON(), null, 2));
// console.log(res);
// 'use strict'

// const code1 = `
// var _PopLogic = /*#__PURE__*/ (function () {
//   function _PopLogic() {}
//   var _proto12 = _PopLogic.prototype;
//   _proto12.useRenderFunc = function useRenderFunc(funcName) {
//     var _this$popupController;
//     return (_this$popupController = popupRender)[funcName].apply(_this$popupController, []);
//   };
//   return _PopLogic;
// })();
// module.exports = new _PopLogic().useRenderFunc('test');`;

// const code1 = `let a = { b:2, c(){return this.b} };
// let d;
// module.exports = (d = a)['c'].apply(d,[])`

// const code1 = `module.exports= new String('123')`

// const code1 = `let count = {
//         c1 : 0,
//         c2 : 0
//       };
//       class A{
//         async f1(){
//           count.c1++;
//           await Promise.resolve(1)
//           return 1;
//         }
//         f2(){
//           count.c2++;
//           return this.f1();
//         }
//       }
//       console.log(A)
//       const a = new A();
//       a.f2();
//       module.exports = {count}`;
//
// const code1 = `
// class A{
// f2(){
//           return 1;
//         }
// };
// const a = new A();
// module.exports = a.f2();;
// `

const code1 = `
    var _Sequence;
    (function (Sequence2) {
    })(_Sequence);
    `
const code11 = `
num = 6;
      var num;
      module.exports = num;
    `

const code12 = `
var a = (get() , 2);
var b;
function get(){
  b = 3;
}
module.exports = {a: a, b: b};
`

const script1 = transform(code1, 'sum.js', { hoisting: true, convertES5: true });
console.log(JSON.stringify(script1.toJSON(), null, 2));
console.log('===============+> run');
const vm1 = new Vm({
  popupRender: {
    b: 1,
    test() {
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
  regeneratorRuntime: require('regenerator-runtime/runtime.js'),
});
const res1 = vm1.run(script1);
console.log(res1);
console.log(vm1.realm.global);
