/**
 * Path A: pre-generated JSON + runtime only. This file must not import
 * the compiler. If anything pulls in Babel, the stubs below throw.
 */
jest.mock('@babel/core', () => {
  throw new Error('runtime-only tests must not import @babel/core');
});
jest.mock('@babel/parser', () => {
  throw new Error('runtime-only tests must not import @babel/parser');
});
jest.mock('@babel/preset-env', () => {
  throw new Error('runtime-only tests must not import @babel/preset-env');
});

import * as fs from 'fs';
import * as path from 'path';
import { JSVM, loadArtifact, ArtifactVersionError, ArtifactFormatError } from 'jsvm3/runtime';

const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));

const execArtifact = function (json: unknown) {
  const vm = new JSVM();
  vm.exec(loadArtifact(json));
  return (vm.realm.globalObj as { module: { exports: unknown } }).module.exports;
};

const expected = fixture('expected.json');

describe('runtime-only (path A)', () => {
  it('loads a pre-generated format 0 array via loadArtifact + JSVM', () => {
    const json = fixture('add.format0.json');
    expect(Array.isArray(json)).toBe(true);
    expect(execArtifact(json)).toEqual(expected.add);
  });

  it('executes a wide-opcode format 0 fixture (arith, call, closure, try/catch, RegExp)', () => {
    const json = fixture('wide.format0.json');
    expect(Array.isArray(json)).toBe(true);
    expect(json).toHaveLength(10);
    expect(execArtifact(json)).toEqual(expected.wide);
  });

  it('loads a pre-generated format 1 envelope', () => {
    const envelope = fixture('wide.format1.json');
    expect(envelope.magic).toBe('JSVM3');
    expect(envelope.format).toBe(1);
    expect(execArtifact(envelope)).toEqual(expected.wide);
  });

  it('treats a bare 10-tuple as the old format 0 array', () => {
    const json = fixture('add.format0.json');
    expect(json[10]).toBeUndefined();
    const script = loadArtifact(json);
    expect(script.source == null).toBe(true);
    const vm = new JSVM();
    vm.exec(json);
    expect((vm.realm.globalObj as { module: { exports: unknown } }).module.exports).toEqual(3);
  });

  it('throws ArtifactVersionError on opcode mismatch', () => {
    const envelope = fixture('wide.format1.json');
    expect(() => loadArtifact({ ...envelope, opcode: 99 })).toThrow(ArtifactVersionError);
  });

  it('throws ArtifactFormatError on a bad magic object', () => {
    expect(() => loadArtifact({ magic: 'NOPE', format: 1, opcode: 1, body: [] })).toThrow(
      ArtifactFormatError
    );
  });
});
