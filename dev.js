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

const code = `
module.exports = 1;
`;
const script = transform(code, 'sum.js');
console.log(JSON.stringify(script.toJSON(), null, 2));
console.log('===============+> run');
const vm = new Vm();
const res = vm.run(script);
console.log(script.toJSON());
console.log(res);
