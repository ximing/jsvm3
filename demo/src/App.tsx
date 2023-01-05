import React, { useState, useCallback } from 'react'
import { JSVM } from 'jsvm3/lib/vm/vm.js'
import { parse } from '@babel/parser'
import { Emitter } from 'jsvm3/lib/compiler/emitter.js'
import { disassembleScript } from './disassemble'

const DEFAULT_CODE = `// jsvm3 演示 - 输入 JavaScript 代码并运行
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

var result = fibonacci(10);
console.log("fibonacci(10) =", result);
console.log("Hello, jsvm3!");

// 试试数组操作
var arr = [1, 2, 3, 4, 5];
var sum = 0;
for (var i = 0; i < arr.length; i++) {
  sum += arr[i];
}
console.log("数组求和:", sum);

result;
`

const SAMPLE_EXAMPLES = [
  {
    label: '斐波那契',
    code: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
fibonacci(10);`,
  },
  {
    label: '数组操作',
    code: `var arr = [3, 1, 4, 1, 5, 9, 2, 6];
var sum = 0;
for (var i = 0; i < arr.length; i++) {
  sum += arr[i];
}
sum;`,
  },
  {
    label: '对象与闭包',
    code: `function createCounter(init) {
  var count = init || 0;
  return {
    increment: function() { count++; },
    decrement: function() { count--; },
    getValue: function() { return count; }
  };
}

var counter = createCounter(10);
counter.increment();
counter.increment();
counter.decrement();
counter.getValue();`,
  },
  {
    label: '递归',
    code: `function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
factorial(6);`,
  },
]

function compileCode(code: string) {
  // 使用 @babel/parser 解析代码为 AST
  const ast = parse(code, {
    sourceType: 'script',
    plugins: [],
  })

  // 编译为字节码
  const emitter = new Emitter([], '<demo>', null, code.split('\n'), code)
  emitter.visit(ast.program)
  return emitter.end()
}

function App() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [output, setOutput] = useState<string[]>([])
  const [bytecode, setBytecode] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const runCode = useCallback(() => {
    setRunning(true)
    setError(null)
    setOutput([])

    // 使用 setTimeout 让 UI 先更新
    setTimeout(() => {
      try {
        // 拦截 console.log
        const logs: string[] = []
        const originalLog = console.log
        console.log = (...args: any[]) => {
          logs.push(
            args
              .map((a) => {
                if (a === null) return 'null'
                if (a === undefined) return 'undefined'
                if (typeof a === 'object') {
                  try {
                    return JSON.stringify(a, null, 2)
                  } catch {
                    return String(a)
                  }
                }
                return String(a)
              })
              .join(' ')
          )
        }

        // 编译代码并展示字节码（编译失败时字节码面板显示错误）
        // 注意只有编译放在 try 里，反汇编异常不应被误标为「编译错误」
        let compiled
        try {
          compiled = compileCode(code)
        } catch (e: any) {
          setBytecode([`编译错误: ${e.message || String(e)}`])
          throw e
        }
        setBytecode(disassembleScript(compiled))

        // 编译产物即 VM 的 Script，直接执行
        const vm = new JSVM()
        const result = vm.exec(compiled)

        // 恢复 console.log
        console.log = originalLog

        const outputLines: string[] = []
        if (logs.length > 0) {
          outputLines.push('--- console 输出 ---')
          outputLines.push(...logs)
        }
        outputLines.push('')
        outputLines.push('--- 返回值 ---')
        outputLines.push(result !== undefined ? String(result) : 'undefined')

        setOutput(outputLines)
      } catch (e: any) {
        setError(e.message || String(e))
      } finally {
        setRunning(false)
      }
    }, 50)
  }, [code])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        runCode()
      }
    },
    [runCode]
  )

  const loadExample = useCallback((exampleCode: string) => {
    setCode(exampleCode)
    setOutput([])
    setBytecode([])
    setError(null)
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">
          <span className="logo">⚡</span> jsvm3
        </h1>
        <p className="subtitle">
          基于自定义字节码的 JavaScript 虚拟机 &mdash; 在浏览器中运行 JavaScript
        </p>
      </header>

      <section className="examples">
        <span className="examples-label">示例: </span>
        {SAMPLE_EXAMPLES.map((example) => (
          <button
            key={example.label}
            className="example-btn"
            onClick={() => loadExample(example.code)}
          >
            {example.label}
          </button>
        ))}
      </section>

      <main className="main">
        <div className="editor-panel">
          <div className="panel-header">
            <span className="panel-title">JavaScript 代码</span>
            <span className="shortcut">Ctrl+Enter 运行</span>
          </div>
          <textarea
            className="editor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            placeholder="输入 JavaScript 代码..."
          />
          <button
            className={`run-btn ${running ? 'running' : ''}`}
            onClick={runCode}
            disabled={running}
          >
            {running ? '⏳ 运行中...' : '▶ 运行'}
          </button>
        </div>

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

        <div className="output-panel">
          <div className="panel-header">
            <span className="panel-title">输出</span>
          </div>
          <div className="output">
            {error ? (
              <pre className="error">{error}</pre>
            ) : output.length > 0 ? (
              output.map((line, i) => (
                <pre key={i} className={line.startsWith('---') ? 'section-title' : ''}>
                  {line}
                </pre>
              ))
            ) : (
              <span className="placeholder">点击 "运行" 查看输出</span>
            )}
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>
          jsvm3 使用自定义字节码编译器和基于纤程的虚拟机执行 JavaScript。
          支持完整的 ES5 和部分 ES2015+ 特性。
        </p>
        <p className="links">
          <a href="https://github.com/ximing/jsvm3" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <span className="sep">·</span>
          <a href="https://www.npmjs.com/package/jsvm2" target="_blank" rel="noopener noreferrer">
            npm
          </a>
          <span className="sep">·</span>
          <span className="version">v1.2.5</span>
        </p>
      </footer>
    </div>
  )
}

export default App