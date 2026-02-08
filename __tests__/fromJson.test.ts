import { transform } from '../src/compiler';
import { dumpArtifact, fromJson, loadArtifact, scriptToJson } from '../src/utils/convert';
import { Artifact, ARTIFACT_MAGIC } from '../src/artifact';
import { ArtifactFormatError, ArtifactLoadError, ArtifactVersionError } from '../src/artifact/errors';
import { JSVM } from '../src/vm/vm';

const execRestored = function (restored: ReturnType<typeof fromJson>) {
  const vm = new JSVM();
  vm.exec(restored);
  return (vm.realm.globalObj as any).module.exports;
};

const runViaJson = function (code: string) {
  const script = transform(code, 'test.js', { hoisting: true, convertES5: false });
  // 模拟真实的序列化场景：JSON 往返后再反序列化执行
  const json = JSON.parse(JSON.stringify(scriptToJson(script)));
  const restored = fromJson(json);
  return execRestored(restored);
};

describe('fromJson', function () {
  it('should execute a script restored from json', function () {
    expect(runViaJson(`module.exports = 1 + 2;`)).toEqual(3);
  });

  it('should restore children scripts (functions)', function () {
    expect(
      runViaJson(`
        function fibonacci(n) {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
        module.exports = fibonacci(10);
      `)
    ).toEqual(55);
  });

  it('should roundtrip through a format 1 envelope', function () {
    const script = transform(`module.exports = 1 + 2;`, 'test.js', {
      hoisting: true,
      convertES5: false,
    });
    const raw = dumpArtifact(script);
    expect(Array.isArray(raw)).toBe(true);
    expect((raw as unknown as { magic?: string }).magic).toBeUndefined();

    const envelope = dumpArtifact(script, { format: 1 }) as Artifact;
    expect(Array.isArray(envelope)).toBe(false);
    expect(envelope.magic).toBe(ARTIFACT_MAGIC);
    expect(envelope.format).toBe(1);
    expect(envelope.opcode).toBe(1);
    expect(Array.isArray(envelope.body)).toBe(true);

    const restored = loadArtifact(JSON.parse(JSON.stringify(envelope)));
    expect(execRestored(restored)).toEqual(3);
  });

  it('should throw ArtifactFormatError for objects without magic', function () {
    expect(() => fromJson({ body: [] })).toThrow(ArtifactFormatError);
    expect(() => fromJson({ magic: 'NOPE', format: 1, opcode: 1, body: [] })).toThrow(
      ArtifactFormatError
    );
  });

  it('should throw ArtifactVersionError for a bad opcode', function () {
    const script = transform(`module.exports = 1;`, 'test.js', {
      hoisting: true,
      convertES5: false,
    });
    const envelope = dumpArtifact(script, { format: 1 }) as Artifact;
    try {
      fromJson({ ...envelope, opcode: 99 });
      throw new Error('expected ArtifactVersionError');
    } catch (err) {
      expect(err).toBeInstanceOf(ArtifactVersionError);
      expect((err as ArtifactVersionError).field).toBe('opcode');
      expect((err as ArtifactVersionError).expected).toBe('1-1');
      expect((err as ArtifactVersionError).actual).toBe('99');
    }
  });

  it('should throw ArtifactVersionError for a bad format', function () {
    const script = transform(`module.exports = 1;`, 'test.js', {
      hoisting: true,
      convertES5: false,
    });
    const envelope = dumpArtifact(script, { format: 1 }) as Artifact;
    expect(() => fromJson({ ...envelope, format: 99 })).toThrow(ArtifactVersionError);
  });

  it('should throw ArtifactLoadError for a missing envelope body', function () {
    expect(() =>
      fromJson({ magic: ARTIFACT_MAGIC, format: 1, opcode: 1 })
    ).toThrow(ArtifactLoadError);
  });

  it('should restore regexp literals', function () {
    const testWord = runViaJson(`
      var reg = /^hello/gi;
      module.exports = function (word) {
        return reg.test(word);
      };
    `);
    expect(testWord('Hello')).toBeTruthy();
    expect(testWord('world')).toBeFalsy();
  });

  it('should restore try/catch guards', function () {
    const script = transform(
      `
      const obj = { runTry: false, runError: false };
      try {
        obj.runTry = true;
        throw new Error('invalid');
      } catch (err) {
        obj.runError = true;
      }
      module.exports = obj;
    `,
      'test.js',
      { hoisting: true, convertES5: false }
    );
    const json = scriptToJson(script);
    expect(json[5].length).toBeGreaterThan(0);
    expect(json[5][0].length).toBe(4);

    const restored = fromJson(JSON.parse(JSON.stringify(json)));
    const res = execRestored(restored);
    expect(res.runTry).toBeTruthy();
    expect(res.runError).toBeTruthy();
  });

  it('should restore globalNames', function () {
    const script = transform(
      `
      undeclaredGlobal = 42;
      module.exports = undeclaredGlobal;
    `,
      'test.js',
      { hoisting: true, convertES5: false }
    );
    const json = scriptToJson(script);
    expect(json[9]).toEqual(expect.arrayContaining(['undeclaredGlobal']));

    const restored = fromJson(JSON.parse(JSON.stringify(json)));
    expect(execRestored(restored)).toEqual(42);
  });

  it('should load a 10-tuple without index 10', function () {
    const script = transform(`module.exports = 1 + 2;`, 'test.js', {
      hoisting: true,
      convertES5: false,
    });
    const json = scriptToJson(script);
    expect(json.length).toBe(10);
    expect(json[10]).toBeUndefined();

    const restored = fromJson(json);
    expect(restored.source == null).toBe(true);
    expect(execRestored(restored)).toEqual(3);
  });
});
