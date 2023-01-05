// 将编译产物 Script 渲染为可读的反汇编文本。
// 纯函数，不依赖 lib 类型，只用结构化鸭子类型，方便独立测试。

interface InstructionLike {
  name: string
  args: any[] | null
}

interface ScriptLike {
  name: string | null
  instructions: InstructionLike[]
  children: ScriptLike[]
  localNames: string[]
  globalNames: string[]
  stackSize: number
  strings: string[]
}

// 最长指令名为 14 字符（STRING_LITERAL / REGEXP_LITERAL 等），留 2 空格间隔
const NAME_WIDTH = 16

function pad4(n: number): string {
  return String(n).padStart(4, '0')
}

function renderArg(arg: any): string {
  if (arg === null || arg === undefined) return 'null'
  if (Array.isArray(arg)) return `[${arg.map(renderArg).join(', ')}]`
  if (typeof arg === 'object') {
    // Label 实例（end() 之后 ip 已解析为目标地址）
    if (typeof arg.ip === 'number') return `-> ${pad4(arg.ip)}`
    return String(arg)
  }
  if (typeof arg === 'string') return JSON.stringify(arg)
  return String(arg)
}

function isLabelArg(arg: any): boolean {
  return typeof arg === 'object' && arg !== null && typeof arg.ip === 'number'
}

// 普通参数合并为 [a, b] 形式；Label 参数单独渲染为 -> NNNN
function renderArgs(args: any[]): string {
  const parts: string[] = []
  const values = args.filter((a) => !isLabelArg(a))
  if (values.length > 0) parts.push(renderArg(values))
  args.filter(isLabelArg).forEach((a) => parts.push(renderArg(a)))
  return parts.join(' ')
}

function renderComment(ins: InstructionLike, script: ScriptLike): string {
  const args = ins.args ?? []
  switch (ins.name) {
    case 'GETG':
    case 'SETG': {
      const name = script.globalNames[args[0]]
      return name != null ? `  ; ${name}` : ''
    }
    case 'GETL':
    case 'SETL': {
      const name = script.localNames[args[1]]
      return name != null ? `  ; ${name}` : ''
    }
    case 'FUNCTION': {
      const child = script.children[args[0]]
      return child ? `  ; ${child.name || '<anonymous>'}` : ''
    }
    case 'STRING_LITERAL': {
      const str = script.strings[args[0]]
      return str != null ? `  ; ${JSON.stringify(str)}` : ''
    }
    default:
      return ''
  }
}

export function disassembleScript(script: ScriptLike): string[] {
  const lines: string[] = []

  const walk = (s: ScriptLike, depth: number) => {
    const indent = '  '.repeat(depth)
    lines.push(`${indent}=== ${s.name || '<anonymous>'} ===`)
    lines.push(`${indent}stackSize: ${s.stackSize}   locals: [${s.localNames.join(', ')}]`)
    lines.push('')
    s.instructions.forEach((ins, ip) => {
      const argsStr = renderArgs(ins.args ?? [])
      const comment = renderComment(ins, s)
      lines.push(
        `${indent}${pad4(ip)}  ${ins.name.padEnd(NAME_WIDTH)}${argsStr}${comment}`.trimEnd()
      )
    })
    s.children.forEach((child) => {
      lines.push('')
      walk(child, depth + 1)
    })
  }

  walk(script, 0)
  return lines
}
