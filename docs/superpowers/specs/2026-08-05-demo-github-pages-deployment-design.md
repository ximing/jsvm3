# Demo GitHub Pages 自动部署设计

## 背景

仓库的 GitHub Pages 当前从 `gh-pages` 分支发布，但 demo 位于 `demo/`，现有构建 workflow 只监听根项目源码和测试目录，因此 demo 的代码变更不会自动更新线上页面。

## 目标

- `master` 分支发生与 demo、运行时源码、构建依赖或 workflow 相关的 push 后，自动构建并发布 demo。
- pull request 只执行 demo 构建检查，不发布 GitHub Pages。
- 使用 GitHub Pages artifact/deploy 流程，避免 workflow 直接维护 `gh-pages` 分支。
- 保留现有根项目构建与测试 workflow 的职责边界。

## 方案

新增独立的 GitHub Actions workflow：

1. 触发条件为 `push` 到 `master`，路径覆盖 `src/**`、`demo/**`、根目录依赖锁文件、构建配置和 `.github/**`；同时对 `pull_request` 使用相同路径做构建检查。
2. 使用 Node.js 20，安装根项目依赖并执行根项目构建，使 demo 对根目录源码的 alias 能够正常解析；仓库锁定的 `serialize-javascript@7.0.7` 要求 Node.js 20 或更高版本。
3. 进入 `demo/`，使用已提交的 `demo/package-lock.json` 安装依赖并执行 `npm run build`，产物为 `demo/dist`。
4. push 任务上传 Pages artifact，并由独立 deploy job 部署；deploy job 只在 `push` 任务执行，PR 只运行 build job。
5. 设置 `pages: write` 和 `id-token: write` 权限，并为 Pages 部署设置串行 concurrency，避免并发发布导致旧版本覆盖新版本。

## 触发范围

以下变更会触发 workflow：

- `src/**`、`demo/**`
- `package.json`、`pnpm-lock.yaml`、`demo/package.json`、`demo/package-lock.json`
- `rollup.config.js`、`rollup.exp.config.js`、`tsconfig*.json`
- `.github/**`

其他只影响文档或 benchmark 的变更不触发 demo 发布，除非同时修改上述路径。

## 失败处理

- 根项目构建失败时，不生成 demo artifact，也不部署。
- demo 类型检查或 Vite 构建失败时，不部署。
- Pages 部署失败时，GitHub Actions 保留失败日志，不改变已发布版本。
- workflow 提供手动 `workflow_dispatch` 入口，便于在不产生代码变更时重新发布。

## 验证

- 在本地执行根项目构建。
- 在 `demo/` 执行锁文件一致的依赖安装和 `npm run build`。
- 检查 workflow YAML 的触发路径、权限、job 条件和 artifact 路径。
- 提交后通过 `gh run` 检查 workflow 是否被识别及执行结果。
