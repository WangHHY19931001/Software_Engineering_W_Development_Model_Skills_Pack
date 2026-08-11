## 关联 Issue

closes #N

## 变更类型

- [ ] feat / fix / refactor / docs / test / chore / ci

## 校验要点

> 本仓库无云端 CI，以下为本地门禁（`.githooks/pre-push`，Git Bash 下执行）。

- [ ] `npm run prepush` 14 项通过
- [ ] 未新增 `.test.ts`（如新增，已同步 vitest 计数与 `w-model-dev/scripts/__tests__/README.md`）
- [ ] 涉及规则：（列出的反模式 / 阶段约束，如 R1-R5 / D7）

## 覆盖规则

（列出本 PR 影响的校验规则 ID）
