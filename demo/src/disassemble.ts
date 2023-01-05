// 将编译产物 Script 渲染为可读的反汇编文本。
// 纯函数，不依赖 lib 类型，只用结构化鸭子类型，方便独立测试。

interface InstructionLike {
  name: string
  args: any[] | null
}

interface ScriptLike {
  name: string | null
  fName: string | null
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
  if (typeof arg === 'object') return String(arg)
  if (typeof arg === 'string') return JSON.stringify(arg)
  return String(arg)
}

// Emitter.end() 之后 Label 已被 forEachLabel 替换为数字 ip，
// 跳转参数只能按指令名识别：这些指令的第一个参数是跳转目标
const JUMP_OPCODES = new Set(['JMP', 'JMPF', 'JMPT', 'NEXT'])

// 普通参数合并为 [a, b] 形式；跳转指令的首参数渲染为 -> NNNN
function renderInstructionArgs(ins: InstructionLike): string {
  const args = ins.args ?? []
  if (JUMP_OPCODES.has(ins.name) && typeof args[0] === 'number') {
    const [target, ...rest] = args
    const parts = [`-> ${pad4(target)}`]
    if (rest.length > 0) parts.push(renderArg(rest))
    return parts.join(' ')
  }
  return args.length > 0 ? renderArg(args) : ''
}

function renderComment(
  ins: InstructionLike,
  script: ScriptLike,
  ancestors: ScriptLike[]
): string {
  const args = ins.args ?? []
  switch (ins.name) {
    case 'GETG':
    case 'SETG': {
      const name = script.globalNames[args[0]]
      return name != null ? `  ; ${name}` : ''
    }
    case 'GETL':
    case 'SETL': {
      // args = [scopeDepth, varIndex]；scopeDepth 是跨越的函数作用域数，
      // 0 表示当前脚本，d > 0 表示沿祖先链向上第 d 层脚本
      const depth = args[0]
      const varIndex = args[1]
      let name: string | undefined
      if (depth === 0) {
        name = script.localNames[varIndex]
      } else {
        const ancestor = ancestors[ancestors.length - depth]
        if (ancestor) name = ancestor.localNames[varIndex]
      }
      if (name != null) return `  ; ${name}`
      // depth 0 解析失败时保持现状不加注释；跨层则标注 outer 便于排查
      return depth > 0 ? `  ; outer[${varIndex}]` : ''
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

  // ancestors 为当前脚本之上的祖先链（根在前，父脚本在最后），
  // 供 GETL/SETL 按 scopeDepth 解析闭包变量名
  const walk = (s: ScriptLike, depth: number, ancestors: ScriptLike[]) => {
    const indent = '  '.repeat(depth)
    lines.push(`${indent}=== ${s.name || s.fName || '<anonymous>'} ===`)
    // localNames 以 varIndex 为下标、可能是稀疏数组，过滤空位避免渲染出 ", ,"
    const locals = s.localNames.filter((n) => n != null)
    lines.push(`${indent}stackSize: ${s.stackSize}   locals: [${locals.join(', ')}]`)
    lines.push('')
    s.instructions.forEach((ins, ip) => {
      const argsStr = renderInstructionArgs(ins)
      const comment = renderComment(ins, s, ancestors)
      lines.push(
        `${indent}${pad4(ip)}  ${ins.name.padEnd(NAME_WIDTH)}${argsStr}${comment}`.trimEnd()
      )
    })
    s.children.forEach((child) => {
      lines.push('')
      walk(child, depth + 1, [...ancestors, s])
    })
  }

  walk(script, 0, [])
  return lines
}
