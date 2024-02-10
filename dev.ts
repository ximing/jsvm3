import { transform } from './src/compiler';
import { JSVM } from './src/vm/vm';

const code = `
let a = 4;
let b = 1;
let c = (a+b)*5
`;

// const code = `function b(a,b){return a+b+1}`;

const script = transform(code, 'sum.js');

const vm = new JSVM();
const res = vm.exec(script);
// console.log(JSON.stringify(script.toJSON(), null, 2));
console.dir(script.toJSON(), { depth: null, colors: true });

console.log(res);
