# Demo 页面展示中间字节码 — 设计文档

日期：2026-08-04
状态：已确认

## 背景与目标

jsvm3 的演示页面（`demo/`，Vite5 + React17 + TypeScript）目前只有「输入代码」和「输出结果」两个面板，没有体现 VM 的核心概念——中间字节码。目标是在 demo 中展示源码编译后的反汇编字节码，形成「源码 → 字节码 → 执行结果」的完整演示流程。

## 现状分析

- `demo/src/App.tsx` 的 `compileCode()` 使用 `@babel/parser` 解析源码，经 `Emitter` 编译得到 `Script` 对象（demo 通过 vite alias `jsvm3` → 仓库根目录，引用 `lib/` 构建产物）。
- `Script`（`src/vm/script.ts`）包含展示所需的全部信息：
  - `instructions: Instruction[]` — 每条指令有 `.name`（opcode 名）、`.args`（参数数组）
  - `children: Script[]` — 嵌套函数，递归结构
  - `localNames` / `globalNames` / `stackSize` / `name`
- 跳转类指令的 `args` 中含 `Label` 实例（`src/opcodes/label.ts`），`emitter.end()` 之后其 `.ip` 已解析为指令序号（目标地址）。
- 构建产物 `lib/opcodes/utils.js` 中 `createOP` 保留了 `name: OPCodeMap[id]`，浏览器端可直接读取指令名。

## 方案

在 demo 内新增纯渲染函数，不改动核心库。

### 1. 反汇编渲染（`demo/src/App.tsx` 内新增 `disassembleScript` 纯函数）

输入 `Script`，输出字符串行数组，递归处理 `children`。

格式示例：

```
=== <demo> ===
stackSize: 4   locals: [result, arr, sum, i]

0000  FUNCTION  [0, 0]
0001  SETG      [0]            ; fibonacci
0003  PUSH      10
...
=== fibonacci ===
stackSize: 3   locals: [n]
0000  GETL      [0, 0]         ; n
0003  JMPF      -> 0007
```

渲染规则：

- 每个 `Script` 先输出头行 `=== <name> ===` 和元信息行（`stackSize`、`locals`）。
- 指令地址：4 位补零序号；指令名左对齐（定宽）。
- `args` 逐个渲染：
  - `Label` 实例 → `-> NNNN`（`.ip` 补零 4 位）
  - 数组 → `[a, b]`（递归渲染元素）
  - 字符串 / 数字 / null → 原样
- 注释列（`;` 前缀）帮助理解索引：
  - `GETG` / `SETG` → 标注 `globalNames[idx]`
  - `GETL` / `SETL` → 标注 `localNames[idx]`（取 args 第二个元素对应的局部变量名）
  - `FUNCTION` → 标注对应 `children[idx].name`

### 2. UI：三栏布局

- `.main` 从两列改为三列网格：左 = 代码编辑器（含运行按钮），中 = 字节码面板，右 = 输出面板。
- 字节码面板：等宽字体 `pre`，独立滚动。
- 刷新时机：点击「运行」时与输出一起更新（编译成功即显示字节码，即使运行时报错）。不做实时编译——与运行时机保持一致，避免输入过程频繁报错。
- 窄屏退化为纵向堆叠（沿用 `App.css` 已有媒体查询断点）。

### 3. 状态与错误处理

- `App.tsx` 新增 state：`bytecode: string[]`。
- `runCode` 中编译成功后立即 `setBytecode(disassembleScript(compiled))`。
- 编译错误：字节码面板显示编译错误信息；输出面板保持现有行为（显示 error）。

### 4. 测试

手动验证：

- 默认示例运行后，字节码面板显示主脚本 + `fibonacci` 子函数的反汇编。
- 4 个示例按钮分别加载并运行，检查：跳转地址（`-> NNNN`）指向正确指令、嵌套函数递归展示、局部变量注释正确。
- 输入语法错误代码，字节码面板显示编译错误。
- 窄屏（< 媒体查询断点）布局纵向堆叠正常。

## 明确不做（YAGNI）

- 不改动核心库（不加 `Script.disassemble()`）。
- 不提供原始 JSON 视图 / Tab 切换。
- 不做实时（输入时）编译。
- 不做字节码与源码行号联动高亮。
