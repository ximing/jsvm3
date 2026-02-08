import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');
const compilerPath = path.join(root, 'dist/compiler.js');
const runtimePath = path.join(root, 'dist/runtime.js');
const fullPath = path.join(root, 'dist/full.js');
const hasDist =
  fs.existsSync(compilerPath) && fs.existsSync(runtimePath) && fs.existsSync(fullPath);
const describeDist = hasDist ? describe : describe.skip;

describeDist('published dist entries', () => {
  it('require(dist/compiler).compile works without ./plugin/hoisting', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { compile } = require(compilerPath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { JSVM, loadArtifact } = require(runtimePath);
    const json = compile('module.exports = 1 + 2;', {
      filename: 'dist-smoke.js',
      convertES5: false,
    });
    expect(Array.isArray(json)).toBe(true);
    const vm = new JSVM();
    vm.exec(loadArtifact(json));
    expect(vm.realm.globalObj.module.exports).toBe(3);
  });

  it('require(dist/full).run returns module.exports', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { run } = require(fullPath);
    expect(run('module.exports = { ok: 1 };', { convertES5: false })).toEqual({ ok: 1 });
  });
});
