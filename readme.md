# jsvm3

用 JS 实现的 JS 虚拟机（解释器）。

## Specification

https://www.ecma-international.org/wp-content/uploads/ECMA-262_5th_edition_december_2009.pdf

## 支持能力

注：引擎表现为严格模式

### ES5

- [x] File
- [x] Program
- [x] Identifier
- [x] NullLiteral
- [x] StringLiteral
- [x] NumericLiteral
- [x] BooleanLiteral
- [ ] RegExpLiteral
- [x] VariableDeclaration
- [x] FunctionDeclaration
- [x] FunctionExpression
- [x] ArrayExpression
- [x] VariableDeclarator
- [x] ExpressionStatement
- [x] BlockStatement
- [x] ConditionalExpression
- [x] EmptyStatement
- [x] DebuggerStatement
- [ ] WithStatement: t.WithStatement; // 不实现，@babel/parse 在严格模式下禁用 WithStatement
- [x] ReturnStatement
- [x] LabeledStatement
- [x] BreakStatement
- [x] ContinueStatement
- [ ] IfStatement
- [ ] SwitchStatement
- [ ] SwitchCase
- [ ] ThrowStatement
- [ ] TryStatement
- [ ] CatchClause
- [ ] ForStatement
- [ ] WhileStatement
- [ ] DoWhileStatement
- [ ] ForInStatement
- [ ] ThisExpression
- [ ] ObjectExpression
- [ ] ObjectProperty
- [ ] ObjectMethod
- [ ] UnaryExpression
- [ ] UpdateExpression
- [ ] BinaryExpression
- [ ] AssignmentExpression
- [ ] LogicalExpression
- [ ] MemberExpression
- [ ] CallExpression
- [ ] NewExpression
- [ ] SequenceExpression

### ES2015

- [ ] VariableDeclaration (let/const)
- [ ] ArrowFunctionExpression
- [ ] TemplateLiteral
- [ ] TaggedTemplateExpression
- [ ] ForOfStatement
- [ ] ClassDeclaration
- [ ] ClassExpression
- [ ] ClassBody
- [ ] ClassMethod
- [ ] MetaProperty
- [ ] Super
- [ ] TemplateElement
- [ ] SpreadElement
- [ ] YieldExpression
- [ ] ObjectPattern
- [ ] ArrayPattern
- [ ] RestElement
- [ ] AssignmentPattern
- [ ] ImportDeclaration
- [ ] ExportNamedDeclaration
- [ ] ExportDefaultDeclaration

### ES2016

- [ ] BinaryExpression

### ES2017

- [ ] AwaitExpression

### Experimental

- [ ] ImportSpecifier
- [ ] ImportDefaultSpecifier
- [ ] ExportSpecifier
- [ ] SpreadProperty
- [ ] DoExpression
- [ ]Decorator
