# Demo 字节码展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 jsvm3 演示页面中新增「字节码」面板，以反汇编文本形式展示编译产物，形成「源码 → 字节码 → 执行结果」三栏演示流程。

**Architecture:** 在 `demo/src/disassemble.ts` 新增纯函数 `disassembleScript(script)`，递归遍历编译产物 `Script`（instructions / children / localNames / globalNames / strings），输出反汇编文本行；`App.tsx` 新增 `bytecode` state，运行时随输出一起刷新；`App.css` 改为三栏网格。不改动核心库（`src/`、`lib/`）。

**Tech Stack:** Vite 5 + React 17（classic JSX runtime）+ TypeScript（strict）；测试用根仓库 jest + ts-jest。

**Spec:** `docs/superpowers/specs/2026-08-04-demo-bytecode-display-design.md`

## Global Constraints

- 不修改核心库：`src/`、`lib/`、`opcodes/` 下任何文件都不可动；反汇编逻辑全部在 demo 内完成。
- demo 通过 vite alias `jsvm3` → 仓库根目录引用 `lib/` 构建产物；`disassemble.ts` 不 import 任何 lib 模块，只用本地结构化类型（`ScriptLike`），保持纯函数可独立测试。
- demo 使用 React 17 + classic JSX（`vite.config.ts` 已配 `jsxRuntime: 'classic'`），TSX 文件必须 `import React`。
- demo tsconfig 开启 `strict`、`noUnusedLocals`、`noUnusedParameters`，代码需通过 `tsc` 检查。
- 提交信息遵循仓库现有风格（中文、conventional commits 前缀，如 `feat: ...`）。

---

### Task 1: 反汇编纯函数 `disassembleScript`（TDD）

**Files:**
- Create: `demo/src/disassemble.ts`
- Test: `__tests__/demo/disassemble.test.ts`

**Interfaces:**
- Produces:
  - `export function disassembleScript(script: ScriptLike): string[]` — 输入编译产物，输出反汇编文本行数组。
  - `ScriptLike`（本地接口，不导出亦可）：`{ name: string | null; instructions: InstructionLike[]; children: ScriptLike[]; localNames: string[]; globalNames: string[]; stackSize: number; strings: string[] }`
  - `InstructionLike`：`{ name: string; args: any[] | null }`
  - 跳转参数以鸭子类型识别：`typeof arg === 'object' && typeof arg.ip === 'number'` → 渲染为 `-> NNNN`。
- Consumes: 无（第一个任务）。

- [ ] **Step 1: 写失败的测试**

创建 `__tests__/demo/disassemble.test.ts`：

```ts
import { disassembleScript } from '../../demo/src/disassemble'

// 构造一个最小的 Script 结构（鸭子类型，与 lib 的 Script 结构一致）
const fakeScript = {
  name: '<demo>',
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
    { name: 'JMPF', args: [{ ip: 6, id: 1, emitter: {} }] },
  ],
  children: [
    {
      name: 'fibonacci',
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

  it('递归渲染子函数并缩进', () => {
    const lines = disassembleScript(fakeScript)
    expect(lines).toContain('  === fibonacci ===')
    expect(lines).toContain('  stackSize: 2   locals: [n]')
    expect(lines).toContain('  0000  GETL            [0, 0]  ; n')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest __tests__/demo/disassemble.test.ts`
Expected: FAIL — 报错 `Cannot find module '../../demo/src/disassemble'`

- [ ] **Step 3: 实现 `disassemble.ts`**

创建 `demo/src/disassemble.ts`：

```ts
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
      const argsStr = (ins.args ?? []).map(renderArg).join(' ')
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest __tests__/demo/disassemble.test.ts`
Expected: PASS（5 个用例全部通过）

注意：Task 2 的 demo `tsc` 检查会因为 `disassemble.ts` 暂时未被引用而报 `noUnusedLocals` 之外的错误的风险为零（导出函数不算 unused），但 jest 之外先不用跑 demo build，Task 2 再统一验证。

- [ ] **Step 5: 提交**

```bash
git add demo/src/disassemble.ts __tests__/demo/disassemble.test.ts
git commit -m "feat: demo 新增字节码反汇编渲染函数"
```

---

### Task 2: App.tsx 接入字节码面板

**Files:**
- Modify: `demo/src/App.tsx`

**Interfaces:**
- Consumes: `disassembleScript(script: ScriptLike): string[]`（来自 Task 1，`import { disassembleScript } from './disassemble'`）。`compileCode()` 返回的 `Script`（lib 类型）结构与 `ScriptLike` 兼容，可直接传入。
- Produces: `bytecode: string[]` state；JSX 中新增 `.bytecode-panel` > `.bytecode` 结构（Task 3 为其写样式）。

- [ ] **Step 1: 添加 import 和 state**

在 `demo/src/App.tsx` 顶部 import 区（第 4 行之后）添加：

```ts
import { disassembleScript } from './disassemble'
```

在 `App` 组件的 state 声明区（`const [output, setOutput] = useState<string[]>([])` 之后）添加：

```ts
const [bytecode, setBytecode] = useState<string[]>([])
```

- [ ] **Step 2: runCode 中生成字节码**

将 `runCode` 中的这两行：

```ts
        // 编译代码
        const compiled = compileCode(code)
```

替换为：

```ts
        // 编译代码并展示字节码（编译失败时字节码面板显示错误）
        let compiled
        try {
          compiled = compileCode(code)
          setBytecode(disassembleScript(compiled))
        } catch (e: any) {
          setBytecode([`编译错误: ${e.message || String(e)}`])
          throw e
        }
```

- [ ] **Step 3: loadExample 时清空字节码**

在 `loadExample` 的 `setError(null)` 之前添加一行：

```ts
    setBytecode([])
```

- [ ] **Step 4: 添加字节码面板 JSX**

在 `<main className="main">` 内，`</div>`（editor-panel 结束）与 `<div className="output-panel">` 之间插入：

```tsx
        <div className="bytecode-panel">
          <div className="panel-header">
            <span className="panel-title">字节码</span>
          </div>
          <div className="bytecode">
            {bytecode.length > 0 ? (
              <pre>{bytecode.join('\n')}</pre>
            ) : (
              <span className="placeholder">点击 "运行" 查看字节码</span>
            )}
          </div>
        </div>
```

- [ ] **Step 5: 类型检查**

Run: `cd demo && npx tsc`
Expected: 无错误（strict 模式通过；`Script` 结构兼容 `ScriptLike`）

- [ ] **Step 6: 提交**

```bash
git add demo/src/App.tsx
git commit -m "feat: demo 页面新增字节码面板"
```

---

### Task 3: 三栏布局样式

**Files:**
- Modify: `demo/src/App.css`

**Interfaces:**
- Consumes: Task 2 产出的 `.bytecode-panel` / `.bytecode` DOM 结构。
- Produces: 无（最终样式）。

- [ ] **Step 1: 三栏网格 + 加宽容器**

修改 `.app`（第 14-21 行）的 `max-width`：

```css
.app {
  max-width: 1600px;
  /* 其余属性保持不变 */
}
```

修改 `.main`（第 80-86 行）的列定义：

```css
.main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  flex: 1;
  min-height: 0;
}
```

（`minmax(0, 1fr)` 防止 `pre` 内容撑破网格列。）

- [ ] **Step 2: 字节码面板样式**

将第 88-96 行的选择器：

```css
.editor-panel,
.output-panel {
```

改为：

```css
.editor-panel,
.bytecode-panel,
.output-panel {
```

在 `/* Output */` 样式块之后（`.placeholder` 规则之后、 `/* Footer */` 之前）添加：

```css
/* Bytecode */
.bytecode {
  flex: 1;
  padding: 16px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  overflow: auto;
  min-height: 360px;
  max-height: 500px;
}

.bytecode pre {
  margin: 0;
  white-space: pre;
}
```

- [ ] **Step 3: 响应式断点**

在 `@media (max-width: 768px)` 块中，将：

```css
  .editor,
  .output {
    min-height: 240px;
  }
```

改为：

```css
  .editor,
  .bytecode,
  .output {
    min-height: 240px;
  }
```

（`.main` 在该断点已是单列，无需改动。）

- [ ] **Step 4: 构建验证**

Run: `cd demo && npm run build`
Expected: `tsc && vite build` 全部通过，无类型错误、无构建错误

- [ ] **Step 5: 提交**

```bash
git add demo/src/App.css
git commit -m "feat: demo 页面改为三栏布局展示字节码"
```

---

### Task 4: 端到端手动验证

**Files:**
- 无文件改动（仅验证；发现问题则回到对应任务修复）

**Interfaces:**
- Consumes: Task 1-3 的全部产出。
- Produces: 无。

- [ ] **Step 1: 回归运行既有测试**

Run: `npx jest`
Expected: 全部通过（确认未影响核心库测试）

- [ ] **Step 2: 启动 dev server 手动验证**

Run: `cd demo && npm run dev`，浏览器打开终端输出的地址（注意 base 路径为 `/jsvm3/`）。

逐项检查：

1. 默认示例点击「运行」：中间面板显示 `=== <demo> ===` 主脚本反汇编 + 递归的 `=== fibonacci ===` 子函数；右侧面板输出与改动前一致。
2. 「斐波那契」「递归」示例：嵌套函数正确缩进展示。
3. 「数组操作」示例：for 循环的跳转指令渲染为 `-> NNNN`，且目标地址是面板中真实存在的指令序号。
4. 「对象与闭包」示例：`GETL`/`SETL` 注释显示正确的局部变量名（如 `; count`）。
5. 输入一段语法错误代码（如 `var = 1`）点运行：字节码面板显示 `编译错误: ...`，输出面板显示错误。
6. 输入运行时报错但编译通过的代码（如 `null.x`）：字节码面板正常显示反汇编，输出面板显示运行时错误。
7. 浏览器窗口缩窄到 < 768px：三个面板纵向堆叠，无横向溢出。

- [ ] **Step 3: 如全部通过，无需提交（无文件改动）；若有修复，提交修复**

```bash
git add -u
git commit -m "fix: 修复 demo 字节码面板验证中发现的问题"
```

---

## Self-Review 记录

- **Spec 覆盖：** 反汇编渲染（Task 1）✓、三栏布局（Task 3）✓、state 与错误处理（Task 2）✓、手动验证清单（Task 4，覆盖 spec「测试」一节全部条目）✓。YAGNI 项（JSON 视图、实时编译、行号联动）均未引入。
- **占位符扫描：** 无 TBD/TODO；所有代码步骤含完整代码。
- **类型一致性：** `disassembleScript` / `ScriptLike` / `bytecode: string[]` 在 Task 1→2 间一致；`.bytecode-panel` / `.bytecode` 类名在 Task 2→3 间一致。
- **格式对齐验证：** `NAME_WIDTH = 16`（最长指令名 `STRING_LITERAL` 为 14 字符，保证至少 2 空格间隔）：`FUNCTION`(8)+8 空格 → `0000  FUNCTION        [0, 0]`（地址后 2 空格）；`POP` 行 `trimEnd()` 后无尾空白 — 与 Task 1 测试断言逐字符一致。
