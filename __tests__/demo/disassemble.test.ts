import { disassembleScript } from '../../demo/src/disassemble'
import { transform } from '../../src/compiler'

// 构造一个最小的 Script 结构（鸭子类型，与 lib 的 Script 结构一致）
const fakeScript = {
  name: null,
  fName: '<demo>',
  stackSize: 4,
  localNames: ['result'],
  globalNames: ['fibonacci'],
  strings: ['hello'],
  instructions: [
    { name: 'FUNCTION', args: [0, 0] },
    { name: 'SETG', args: [0] },
    { name: 'POP', args: null },
    { name: 'STRING_LITERAL', args: [0] },
    { name: 'GETL', args: [0, 0] },
    { name: 'JMPF', args: [6] },
  ],
  children: [
    {
      name: 'fibonacci',
      fName: null,
      stackSize: 2,
      localNames: ['n'],
      globalNames: [],
      strings: [],
      instructions: [{ name: 'GETL', args: [0, 0] }],
      children: [],
    },
  ],
}

describe('disassembleScript', () => {
  it('渲染脚本头与元信息', () => {
    const lines = disassembleScript(fakeScript)
    expect(lines[0]).toBe('=== <demo> ===')
    expect(lines[1]).toBe('stackSize: 4   locals: [result]')
    expect(lines[2]).toBe('')
  })

  it('渲染指令：地址补零、指令名定宽、参数原样', () => {
    const lines = disassembleScript(fakeScript)
    expect(lines[3]).toBe('0000  FUNCTION        [0, 0]  ; fibonacci')
    expect(lines[4]).toBe('0001  SETG            [0]  ; fibonacci')
    // 无参数指令行尾不留空白
    expect(lines[5]).toBe('0002  POP')
  })

  it('渲染字符串常量与局部变量注释', () => {
    const lines = disassembleScript(fakeScript)
    expect(lines[6]).toBe('0003  STRING_LITERAL  [0]  ; "hello"')
    expect(lines[7]).toBe('0004  GETL            [0, 0]  ; result')
  })

  it('跳转指令参数渲染为 -> 目标地址', () => {
    const lines = disassembleScript(fakeScript)
    expect(lines[8]).toBe('0005  JMPF            -> 0006')
  })

  it('非跳转指令的数字参数不做箭头渲染', () => {
    const lines = disassembleScript(fakeScript)
    // SETG 的 args[0] 也是数字，但必须保持 [n] 形式
    expect(lines[4]).toContain('[0]')
    expect(lines[4]).not.toContain('->')
  })

  it('递归渲染子函数并缩进', () => {
    const lines = disassembleScript(fakeScript)
    expect(lines).toContain('  === fibonacci ===')
    expect(lines).toContain('  stackSize: 2   locals: [n]')
    expect(lines).toContain('  0000  GETL            [0, 0]  ; n')
  })

  // 真实编译器冒烟测试：锁定真实的 GETL/SETL 参数形状（[scopeDepth, varIndex]），
  // 防止手工构造的 fixture 与真实编译产物漂移
  it('真实编译器产物：闭包变量跨层注释', () => {
    const script = transform(
      `function createCounter(init) {
  var count = init || 0;
  return {
    increment: function() { count++; }
  };
}`,
      'test.js',
      { hoisting: true, convertES5: false }
    )
    const lines = disassembleScript(script as any)

    // (a) 存在脚本头
    expect(lines.some((l) => l.includes('=== '))).toBe(true)
    // (b) 至少一条跳转指令渲染为 -> NNNN
    expect(lines.some((l) => /-> \d{4}/.test(l))).toBe(true)
    // (c) increment 内的跨层 GETL/SETL [1, 4] 带上外层变量名注释
    const closureLines = lines.filter(
      (l) => /\b(GETL|SETL)\s+\[1, \d+\]/.test(l) && l.includes('; count')
    )
    expect(closureLines.length).toBeGreaterThan(0)
  })
})
