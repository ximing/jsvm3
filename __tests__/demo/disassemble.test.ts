import { disassembleScript } from '../../demo/src/disassemble'

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

  it('Label 参数渲染为跳转目标地址', () => {
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
})
