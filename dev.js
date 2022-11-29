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

const code = `
    var a = 0,b = 0,c = 1,d = 2,e = 2,f = 2,g = 2,h = 2,i = 2,j = 2,k = 2,l = 2;
    a +=1;
    b -=1;
    c *=2;
    d /=2;
    e %=2;
    f <<= 2;
    g >>= 2;
    h >>>= 2;
    i &= 2;
    j ^= 2;
    k |= 2;
    l **= 2;
    var obj = {a,b,c,d,e,f,g,h,i,j,k,l};
    module.exports = obj;
`;
const script = transform(code, 'sum.js');
console.log(JSON.stringify(script.toJSON(), null, 2));
console.log('===============+> run');
const vm = new Vm();
const res = vm.run(script);
console.log(script.toJSON());
console.log(res);
