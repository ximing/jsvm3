import * as fs from 'fs';
import * as path from 'path';

function tryRequire(name: string): unknown {
  try {
    return require(name);
  } catch {
    return null;
  }
}

const rollupMod = tryRequire('rollup') as { rollup?: Function } | null;
const describeBundler =
  rollupMod && typeof rollupMod.rollup === 'function' ? describe : describe.skip;

function pluginDefault(mod: unknown): unknown {
  if (mod && typeof (mod as { default?: unknown }).default === 'function') {
    return (mod as { default: unknown }).default;
  }
  return mod;
}

function resolveRuntimeEntry(): string {
  // Bundle from source so `pnpm test` does not require a prior `pnpm build`.
  // Mark the file as having side effects so InsMap registrations survive.
  return path.join(path.resolve(__dirname, '..'), 'src/index.ts');
}

describeBundler('bundler fixture (jsvm3/runtime only)', () => {
  // Rollup + Babel over the full runtime source is slower than the 5s default,
  // especially when this file shares a worker with the lodash suite.
  it('rollup-bundles jsvm3/runtime and executes a wide-opcode fixture', async () => {
    const { rollup } = rollupMod as { rollup: Function };
    const resolve = pluginDefault(tryRequire('@rollup/plugin-node-resolve'));
    const commonjs = pluginDefault(tryRequire('@rollup/plugin-commonjs'));
    const babel = pluginDefault(tryRequire('@rollup/plugin-babel'));
    const json = pluginDefault(tryRequire('@rollup/plugin-json'));
    const requireFromString = tryRequire('require-from-string') as (code: string) => {
      runArtifact: (artifact: unknown) => unknown;
    };

    if (!resolve || !commonjs || !babel || !requireFromString) {
      return;
    }

    const runtimeEntry = resolveRuntimeEntry();
    const plugins: unknown[] = [
      {
        name: 'alias-jsvm3-runtime',
        resolveId(source: string) {
          if (source === 'jsvm3/runtime') {
            return { id: runtimeEntry, moduleSideEffects: true };
          }
          return null;
        },
      },
    ];
    if (json) {
      plugins.push((json as Function)());
    }
    // No @ifdef preprocess: OPCodeIdx imports stay, which is what the
    // un-minified consumer graph needs. Production rollup inlines the ids.
    plugins.push(
      (resolve as Function)({ extensions: ['.ts', '.js'] }),
      (commonjs as Function)(),
      (babel as Function)({
        babelrc: false,
        configFile: false,
        babelHelpers: 'bundled',
        extensions: ['.ts', '.js'],
        exclude: /node_modules|\/dist\//,
        presets: [['@babel/env', { targets: { node: '10' } }], '@babel/preset-typescript'],
      })
    );

    const bundle = await rollup({
      input: path.join(__dirname, 'fixtures/bundler/entry.js'),
      plugins,
      onwarn(warning: { code?: string }, next: (w: unknown) => void) {
        if (warning.code === 'CIRCULAR_DEPENDENCY') {
          return;
        }
        next(warning);
      },
    });
    const { output } = await bundle.generate({ format: 'cjs', exports: 'named' });
    const code = output[0].code as string;

    expect(code).not.toMatch(/@babel\/core/);
    expect(code).not.toMatch(/compiler\/emitter/);
    expect(code).not.toMatch(/compiler\/visitor/);

    const mod = requireFromString(code);
    const artifact = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'fixtures/wide.format0.json'), 'utf8')
    );
    const expected = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'fixtures/expected.json'), 'utf8')
    );
    expect(mod.runArtifact(artifact)).toEqual(expected.wide);
  }, 30000);
});
