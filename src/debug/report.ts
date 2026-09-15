import type { CrashFrame, CrashReport } from '../vm/types';

const ID_LINE = /^\s*#([a-f0-9]{32})\s*$/;
// Named frames keep the symbol address inside the parentheses: `at name (file:line:col ~script:ip)`.
const NAMED = /^\s*at (.*?) \((.*?):(-?\d+):(-?\d+) ~(\d+):(\d+)\)\s*$/;
const BARE = /^\s*at (.*?):(-?\d+):(-?\d+) ~(\d+):(\d+)\s*$/;

/**
 * Read a crash report out of `error.stack`.
 * The runtime prints `#artifactId` and `~script:ip` into that string so a
 * minified build does not need a second serializer.
 */
export function reportFromError(err: { name?: string; message?: string; stack?: string }): CrashReport {
  const frames: CrashFrame[] = [];
  let artifactId: string | undefined;
  const lines = (err.stack || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const id = ID_LINE.exec(line);
    if (id) {
      artifactId = id[1];
      continue;
    }
    const named = NAMED.exec(line);
    if (named) {
      frames.push({
        name: named[1],
        fName: named[2],
        line: Number(named[3]),
        column: Number(named[4]),
        script: Number(named[5]),
        ip: Number(named[6]),
      });
      continue;
    }
    const bare = BARE.exec(line);
    if (bare) {
      frames.push({
        name: '',
        fName: bare[1],
        line: Number(bare[2]),
        column: Number(bare[3]),
        script: Number(bare[4]),
        ip: Number(bare[5]),
      });
    }
  }
  const report: CrashReport = {
    error: { name: err.name || 'Error', message: err.message || '' },
    frames,
  };
  if (artifactId) {
    report.artifactId = artifactId;
  }
  return report;
}
