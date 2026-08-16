import * as fs from 'fs';
import * as path from 'path';
import { compile } from '../../src/compiler';
import { JSVM } from '../../src/vm/vm';
import { loadArtifact } from '../../src/utils/convert';

const dir = __dirname;

function execJson(json: unknown) {
  const vm = new JSVM();
  vm.exec(loadArtifact(json));
  return (vm.realm.globalObj as { module: { exports: unknown } }).module.exports;
}

function write(name: string, value: unknown) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`);
  return file;
}

const addSrc = fs.readFileSync(path.join(dir, 'add.source.js'), 'utf8');
const wideSrc = fs.readFileSync(path.join(dir, 'wide.source.js'), 'utf8');

const add0 = compile(addSrc, { filename: 'add.js', format: 0, convertES5: false });
const wide0 = compile(wideSrc, { filename: 'wide.js', format: 0, convertES5: false });
const wide1 = compile(wideSrc, { filename: 'wide.js', format: 1, convertES5: false });

write('add.format0.json', add0);
write('wide.format0.json', wide0);
write('wide.format1.json', wide1);

const expected = {
  add: execJson(add0),
  wide: execJson(wide0),
};
write('expected.json', expected);

if (JSON.stringify(execJson(wide1)) !== JSON.stringify(expected.wide)) {
  throw new Error('format 1 wide fixture does not match format 0 result');
}

// eslint-disable-next-line no-console
console.log('wrote fixtures', expected);
