# 门禁项数边界测试与隔离负例实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 补齐 `gate-count-docs` 的三个正则边界回归用例，并将 CLI 负向验证改为只修改 `mkdtemp` 隔离仓库的真实 CLI 测试。

**架构：** 复用现有 `docs-consistency-logic.test.ts` 的 `baseInput`、`withDocsConsistencyFixture`、`writeVitestCount` 和 `runDocsConsistencyCli`，不改生产逻辑、CLI 接线或门禁配置。任务 1 增加纯逻辑边界断言；任务 2 增加真实 CLI 隔离负例并同步原 campaign 计划中的验证说明。

**技术栈：** TypeScript、Vitest、Node `fs`/`path`、`tsx`，零新增依赖。

---

## 全局约束

- 直接在 `main` 工作树执行，沿用仓库既定约定。
- 不修改 `docs-consistency-logic.ts`、`check-docs-consistency.ts`、`.githooks/pre-push`、`eval/` 运行逻辑、版本号或白名单。
- 不修改真实 checkout 的 `docs/troubleshooting.md`；负向 CLI 用例只能修改临时 fixture 副本。
- 保持 exit code 0/1/2 语义；测试必须断言真实行为，不能 mock 正则或 CLI。
- 每个任务完成后运行其聚焦测试、格式化并独立 commit；最终运行完整 `npm test`、`npm run prepush`、`npx tsx eval/runner.ts`。

## 文件结构

| 文件                                                           | 职责                                          | 改动                   |
| -------------------------------------------------------------- | --------------------------------------------- | ---------------------- |
| `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | `gate-count-docs` 逻辑边界与真实 CLI 隔离负例 | 修改（任务 1、任务 2） |
| `docs/superpowers/plans/2026-09-07-gate-count-stale-scan.md`   | 原 campaign 的 Task 2 负向验证说明            | 修改（任务 2）         |

---

### 任务 1：补齐 `gate-count-docs` 正则边界测试

**文件：**

- 修改：`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` 的既有 `describe('gate-count-docs…')` 块
- 测试：同一文件新增 3 个真实逻辑用例

- [ ] **步骤 1：编写三个边界测试**

在既有 `gate-count-docs` describe（当前约 3080 行）中，追加以下三个 `it` 用例。沿用 `baseInput` 与 `runDocConsistencyChecks`，每个用例只过滤 `check === 'gate-count-docs'`：

```ts
it('index-exclusion：无空格「第13项」也不误报', () => {
  const input = baseInput({
    gateCountDocs: [{ name: 'CONTRIBUTING.md', content: 'pre-push 第13项 npm audit（门禁不阻断）' }],
  });
  expect(runDocConsistencyChecks(input).filter((x) => x.check === 'gate-count-docs')).toEqual([]);
});

it('project-suffix：含门禁标记的「3 项目」不作为计数', () => {
  const input = baseInput({
    gateCountDocs: [{ name: 'AGENTS.md', content: '门禁说明：3 项目目录不计数' }],
  });
  expect(runDocConsistencyChecks(input).filter((x) => x.check === 'gate-count-docs')).toEqual([]);
});

it('mixed-line：同一行跳过序数但捕获过期计数', () => {
  const input = baseInput({
    gateCountDocs: [{ name: 'README.md', content: '第 13 项 npm audit（门禁稳定）且 17 项门禁未同步' }],
  });
  const violations = runDocConsistencyChecks(input).filter((x) => x.check === 'gate-count-docs');
  expect(violations).toHaveLength(1);
  expect(violations[0]!.message).toContain('17 项');
});
```

- [ ] **步骤 2：运行聚焦测试确认边界基线**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
```

预期：基线现有 169 个用例，加上本任务新增的 3 个边界用例后共 172 个通过。由于本任务只补回归测试、生产逻辑已存在，新增用例应直接验证当前实现；若发现断言或 fixture 拼写错误，只修正测试输入或断言，不改生产逻辑。

- [ ] **步骤 3：格式化与检查**

运行：

```bash
npx prettier --write --config config/prettier.config.cjs w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
npx prettier --check --config config/prettier.config.cjs w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
```

预期：格式化后文件 unchanged，check 通过。

- [ ] **步骤 4：Commit**

```bash
git add w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git commit -m "test(gate-count): cover ordinal project and mixed-line boundaries"
```

---

### 任务 2：将 CLI 负向验证隔离到临时 fixture

**文件：**

- 修改：`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`，新增真实 CLI 负例
- 修改：`docs/superpowers/plans/2026-09-07-gate-count-stale-scan.md` Task 2 步骤 3 与验收描述

- [ ] **步骤 1：先写隔离 fixture 负例**

在 `docs-consistency-logic.test.ts` 的真实 CLI 测试区域（`withDocsConsistencyFixture` / `runDocsConsistencyCli` 用例附近）新增：

```ts
it('真实 CLI 隔离 fixture：过期门禁项数 exit 1 且不污染真实 checkout', async () => {
  await withDocsConsistencyFixture(async (fixtureRoot) => {
    await writeVitestCount(fixtureRoot, 1002);
    const troubleshootingPath = path.join(fixtureRoot, 'docs', 'troubleshooting.md');
    const content = await fs.readFile(troubleshootingPath, 'utf8');
    const current = '本次推送未执行 18 项门禁';
    const stale = '本次推送未执行 17 项门禁';
    expect(content).toContain(current);
    const mutated = content.replace(current, stale);
    expect(mutated).not.toBe(content);
    await fs.writeFile(troubleshootingPath, mutated, 'utf8');

    const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
    expect(result.code).toBe(1);
    const report = JSON.parse(result.stdout) as { reasons: string[] };
    expect(
      report.reasons.some(
        (reason) =>
          reason.includes('[gate-count-docs]') &&
          reason.includes('docs/troubleshooting.md:13') &&
          reason.includes('17 项'),
      ),
    ).toBe(true);
  });
});
```

`withDocsConsistencyFixture` 的 `finally` 负责删除临时仓库；不得调用 `git checkout`，不得直接写入真实 `docs/troubleshooting.md`，不得修改全局 `process.env`。

- [ ] **步骤 2：运行新增真实 CLI 用例确认通过**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts -t "真实 CLI 隔离 fixture"
```

预期：1 个测试通过，exit 0；真实工作树的 `docs/troubleshooting.md` 仍含 `18 项`，临时目录由 helper 清理。

- [ ] **步骤 3：同步原 campaign 计划中的验证说明**

修改 `docs/superpowers/plans/2026-09-07-gate-count-stale-scan.md` Task 2 步骤 3：

删除原来的真实文件命令：

```bash
sed -i 's/本次推送未执行 18 项门禁/本次推送未执行 17 项门禁/' docs/troubleshooting.md
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts; echo "exit=$?"
git checkout -- docs/troubleshooting.md
git status --short
```

改为说明：使用 `withDocsConsistencyFixture` 复制临时仓库，使用 `writeVitestCount` 写入 facts/provenance，只修改临时 `docs/troubleshooting.md`，使用 `runDocsConsistencyCli(fixtureRoot, {}, ['--json'])`，断言 exit 1、`gate-count-docs`、`docs/troubleshooting.md:13` 与 `17 项`；helper `finally` 清理且真实工作树不变。

同时把计划验收中的「临时 17 项 → exit 1」改成「隔离 fixture 负向 CLI → exit 1」。

- [ ] **步骤 4：运行任务 2 聚焦回归**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts -t "gate-count-docs|真实 CLI 隔离 fixture"
npx prettier --write --config config/prettier.config.cjs w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts docs/superpowers/plans/2026-09-07-gate-count-stale-scan.md
npx prettier --check --config config/prettier.config.cjs w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts docs/superpowers/plans/2026-09-07-gate-count-stale-scan.md
```

预期：`gate-count-docs` 逻辑用例与隔离 CLI 用例全部通过；真实文档未被修改；Markdown 与 TypeScript 格式检查通过。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts docs/superpowers/plans/2026-09-07-gate-count-stale-scan.md
git commit -m "test(gate-count): isolate stale-doc CLI negative fixture"
```

---

## 最终验证

两个任务完成后，从最终 HEAD 运行：

```bash
npm test
npm run prepush
npx tsx eval/runner.ts
```

验收：完整测试 70 个文件 / 1608 个既有用例加 4 个新用例（共 1613 个）全部通过；pre-push 18/18 exit 0；eval 60/60；真实 `docs/troubleshooting.md` 从未被负向测试修改；`git status --short` 干净。
