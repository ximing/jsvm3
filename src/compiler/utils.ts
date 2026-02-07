type ChalkLike = {
  green: (s: string) => string;
  bgYellowBright: { black: (s: string) => string };
};

function tryChalk(): ChalkLike | null {
  try {
    // Optional debug color. Not a published compiler dependency.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('chalk');
  } catch {
    return null;
  }
}

export function printCodeWithLine(code: string, lineNumber?: number) {
  const chalk = tryChalk();
  const lines = code.split('\n');
  const maxLength = String(lines.length).length;

  for (let i = 0; i < lines.length; i++) {
    const lineNumberStr = String(i + 1).padStart(maxLength, ' ');
    const line = lines[i];
    const marked = i + 1 === lineNumber && chalk ? chalk.bgYellowBright.black(line) : line;
    const prefix = chalk ? chalk.green(`${lineNumberStr} |`) : `${lineNumberStr} |`;
    console.log(prefix, marked);
  }
}
