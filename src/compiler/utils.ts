import * as chalk from 'chalk';

export function printCodeWithLine(code: string, lineNumber?: number) {
  const lines = code.split('\n');
  const maxLength = String(lines.length).length;

  for (let i = 0; i < lines.length; i++) {
    const lineNumberStr = String(i + 1).padStart(maxLength, ' ');
    const line = lines[i];

    // 如果当前行是目标行，则为其添加颜色
    const formattedLine = i + 1 === lineNumber ? chalk.bgYellowBright.black(line) : line;

    console.log(chalk.green(`${lineNumberStr} |`), formattedLine);
  }
}
