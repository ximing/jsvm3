export type BabelMap = {
  version: 3;
  sources: string[];
  names?: string[];
  mappings: string;
  sourcesContent?: Array<string | null>;
  file?: string;
};

export type Located = {
  line: number;
  column: number;
  source: string | null;
};

export type Locator = (line: number, column: number) => Located;

type OriginalPosition = {
  source: string | null;
  line: number | null;
  column: number | null;
};

// Loaded by a non-literal id so TypeScript 4.9 does not parse the package's
// `.cts` type imports.
function loadTracer(): {
  TraceMap: new (map: BabelMap) => unknown;
  originalPositionFor: (map: unknown, pos: { line: number; column: number }) => OriginalPosition;
} {
  const id = '@jridgewell/' + 'trace-mapping';
  return require(id);
}

/**
 * Map a generated (post-Babel) line/column back onto the author's file.
 * LINE opcodes are 1-based; COLUMN opcodes are 0-based, matching Babel loc
 * and the source-map spec. A single input file always reports `filename`.
 */
export function makeLocator(map: BabelMap | null | undefined, filename: string): Locator {
  if (!map || !map.mappings) {
    return (line, column) => {
      if (line < 1) {
        return { line: 0, column: 0, source: null };
      }
      return { line, column: column < 0 ? 0 : column, source: filename };
    };
  }
  const tracerApi = loadTracer();
  const tracer = new tracerApi.TraceMap(map);
  return (line, column) => {
    if (line < 1) {
      return { line: 0, column: 0, source: null };
    }
    const pos = tracerApi.originalPositionFor(tracer, {
      line,
      column: column < 0 ? 0 : column,
    });
    if (pos.line == null) {
      return { line, column: column < 0 ? 0 : column, source: filename };
    }
    return {
      line: pos.line,
      column: pos.column ?? 0,
      source: filename,
    };
  };
}
