# Demo GitHub Pages 自动部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 `master` push 后自动构建并部署 `demo/dist` 到 GitHub Pages，并在 PR 中只验证构建。

**Architecture:** 新增独立 workflow，使用同一个 build job 处理 push 和 pull request；push 成功后通过 Pages artifact 连接到 deploy job。workflow 不直接写入 `gh-pages` 分支，部署权限仅授予 Pages 所需的 OIDC 和 pages 权限。

**Tech Stack:** GitHub Actions、Node.js 20、pnpm、npm、Vite、GitHub Pages artifact/deploy actions。

## Global Constraints

- 只对 `master` push 发布；pull request 不发布。
- 触发路径覆盖 `src/**`、`demo/**`、依赖锁文件、构建配置和 `.github/**`。
- 根项目使用 Node.js 20、`pnpm install` 和 `npm run build`。
- demo 使用 `npm ci` 和 `npm run build`，产物目录为 `demo/dist`。
- 使用 Pages artifact/deploy 流程，不直接推送 `gh-pages`。

---

### Task 1: Add demo Pages workflow

**Files:**
- Create: `.github/workflows/deploy-demo.yml`

**Interfaces:**
- Consumes: root project package manifests, `demo/package-lock.json`, and Vite output at `demo/dist`.
- Produces: a Pages artifact named `github-pages` and a deployment to the repository's configured Pages site.

- [ ] **Step 1: Create the workflow triggers and permissions**

  Add `push` on `master` and `pull_request` with the approved path list, plus `workflow_dispatch`. Set read-only contents permission globally; grant `pages: write` and `id-token: write` only to the deploy job.

- [ ] **Step 2: Add the build job**

  Use `ubuntu-latest`, checkout the commit, setup Node.js 20 with npm cache, install pnpm, run `pnpm install --frozen-lockfile`, run `npm run build`, then run `npm ci` and `npm run build` from `demo/`. Upload `demo/dist` with `actions/upload-pages-artifact` only for push/manual runs.

- [ ] **Step 3: Add the conditional deploy job**

  Make the deploy job depend on `build`, run only when the event is `push` or `workflow_dispatch`, configure `environment: github-pages`, and use `actions/deploy-pages` against the artifact. Add a `github-pages` concurrency group with `cancel-in-progress: true`.

- [ ] **Step 4: Validate the workflow text**

  Check YAML syntax and inspect the resulting file to confirm the path filters, job condition, artifact path, permissions, and concurrency settings are internally consistent.

- [ ] **Step 5: Commit the workflow**

  ```bash
  git add .github/workflows/deploy-demo.yml
  git commit -m "ci: deploy demo to github pages"
  ```

### Task 2: Verify the local build and GitHub Actions integration

**Files:**
- Modify: none
- Test: `.github/workflows/deploy-demo.yml`, root build, and `demo/dist`

**Interfaces:**
- Consumes: workflow from Task 1.
- Produces: fresh local build evidence and GitHub workflow status.

- [ ] **Step 1: Run the root build**

  Run `npm run build` from the repository root and require exit code 0.

- [ ] **Step 2: Run the demo build with the committed lockfile**

  Run `npm ci` and `npm run build` from `demo/`; require exit code 0 and verify `demo/dist/index.html` exists.

- [ ] **Step 3: Inspect repository state and workflow registration**

  Run `git diff --check`, `git status --short --branch`, and `gh workflow list` to confirm there are no unintended changes and the workflow is recognized.

- [ ] **Step 4: Trigger and inspect the workflow**

  After the workflow commit is available on GitHub, use `gh workflow run deploy-demo.yml --ref master` for a manual deployment if needed, then use `gh run list --workflow deploy-demo.yml` and `gh run watch` to inspect the result. Confirm the deployed URL from `gh api repos/{owner}/{repo}/pages`.
