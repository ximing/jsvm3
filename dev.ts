import { transform } from './src/compiler';
import { JSVM } from './src/vm/vm';

const code = `
let a = 4;
let b = 1;
let c = (a+b)*5
`;

const script = transform(code, 'sum.js');

const vm = new JSVM();
const res = vm.go(script);
console.log(script.toJSON());
console.log(res);
