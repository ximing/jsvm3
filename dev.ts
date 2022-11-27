import { transform } from './src/compiler';

const code = `
let a = 4;
let b = 1;
let c = (a+b)*5
`;

const res = transform(code, 'sum.js');
console.log(res);
