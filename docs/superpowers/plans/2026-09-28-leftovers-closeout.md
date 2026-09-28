# 遗留收口 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development 逐任务实现此计划。
> 规格：`docs/superpowers/specs/2026-09-28-leftovers-closeout-design.md`（§1 逐项处置表是权威；冲突时以规格为准并回来改计划）。
> 账本（本地留档）：`.superpowers/sdd/2026-09-28-leftovers-closeout/progress.md`（首行身份 + 逐任务 `Task N: complete`）。
> 回归纪律：`.ts` 改动前 codegraph 查询落盘 `.w-model/codegraph-queries/`；每组定向 vitest；终局全量 `npm run prepush`。
> 基线：`73e7e036`（main，含上一批全部成果）。行号 `:N` 为编写时实测锚，实现以符号/短语搜索为准。

**目标：** 清掉上一批最终审查登记的全部 12 项遗留（修复为主），使「验收口径」与实现/文档一致，然后合入 main 并推送。

**技术栈：** TypeScript（tsx）、vitest、纯 Markdown 编辑。

---

## 文件结构（分解锁定）

| 文件 | 动作 | 任务 |
| --- | --- | --- |
| `w-model-dev/scripts/infrastructure/schema-loader.ts` | 修改（L1 报错点名字段） | 1 |
| `w-model-dev/schemas/run-log.schema.json` | 修改（L2 description 与实现/权威同义） | 1 |
| `w-model-dev/scripts/cli/check-budget.ts` | 修改（L4 头注指针去重） | 1 |
| `w-model-dev/scripts/cli/check-samples-coverage.ts` | 修改（L3 块头文案） | 2 |
| `w-model-dev/scripts/__tests__/check-samples-coverage.test.ts` | 修改（L3 两条新单测） | 2 |
| `w-model-dev/scripts/__tests__/asset-budget.test.ts` | 修改（L5 注释历史口径） | 2 |
| `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | 修改（L9 人类可读断言） | 2 |
| `w-model-dev/examples/README.md` | 修改（L6 roster 指针化） | 3 |
| `w-model-dev/scripts/__tests__/README.md` | 修改（L7 矩阵行指针化） | 3 |
| `w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md` | 修改（L8 迁移说明补登记） | 3 |
| `w-model-dev/references/subagent-delegation.md` | 修改（L11 长时门禁约定成文） | 3 |
| `docs/superpowers/specs/2026-09-27-gate-thinning-design.md` | 修改（L7 口径脚注） | 3 |
| `CHANGELOG.md` + 版本六镜像 | 修改（`[42.4.1]` + 六处版本） | 4 |

---

## 任务 1：代码与契约面（L1 / L2 / L4）

**文件：**
- 修改：`w-model-dev/scripts/infrastructure/schema-loader.ts`（L1）
- 修改：`w-model-dev/schemas/run-log.schema.json`（L2）
- 修改：`w-model-dev/scripts/cli/check-budget.ts`（L4）

- [ ] **步骤 1：审计与实测（先出证据）**

1. L1：读 `infrastructure/schema-loader.ts` 的错误格式化（`:100-102`），用一段临时脚本（`npx tsx`）喂入带额外字段的载荷，记录**修复前**报错原文（应形如 `/: must NOT have additional properties [additionalProperties]`，不点名）；确认 Ajv 的 `e.params.additionalProperty` 可用。
2. L2：读 `cli/check-budget.ts` 的分组键守卫实现（`countSuspectedDuplicateGroups` 一带）与 `references/data-models.md`「用量实效校验」段的键句，确定**实现语义**（「同 parentDispatchId 且键全同仍计组」是否属实），再定 schema description 的目标文字。
3. L4：定位 `check-budget.ts` 头注中两处对 `data-models.md`「用量实效校验」段的指针（`:18-21` 与 `:28`），确定合并方案（保留一处、义务句不丢）。

- [ ] **步骤 2：实现**

1. L1：在格式化器中，当 `e.keyword === 'additionalProperties'` 且 `e.params?.additionalProperty` 为字符串时，在消息后追加 `(额外字段: <name>)`；其余 keyword 形态**逐字不变**。
2. L2：把 schema description 中「在场时同 parentDispatchId 的条目不互计重复组」改为与**实现/权威同义**的措辞（不得改变字段语义声明方向；description 仍完整非空）。
3. L4：头注合并为一处指针，义务句保留。

- [ ] **步骤 3：验证**

```bash
cd /d/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/leftovers
# L1：修复后同输入报错点名字段（贴修复前/后对照）
npx tsx <临时探针>.ts        # 或自建最小 tsx 片段，输出 ERROR 文案对照
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts w-model-dev/scripts/__tests__/project-read-validation.test.ts
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts    # 秒级；exit 0（schema description 门禁）
npm run self-test 2>&1 | tail -1                             # 381/381
```
（若上述两个 vitest 文件与本改动无关，说明依据并改跑真正读 schema 报错的测试文件。）

- [ ] **步骤 4：Commit**

```bash
git add w-model-dev/scripts/infrastructure/schema-loader.ts w-model-dev/schemas/run-log.schema.json w-model-dev/scripts/cli/check-budget.ts
git commit -m "fix(schema): additionalProperties 报错点名字段 + run-log parentDispatchId 描述与实现同义 + check-budget 指针去重（L1/L2/L4）"
```

## 任务 2：门禁与测试面（L3 / L5 / L9）

**文件：** `w-model-dev/scripts/cli/check-samples-coverage.ts`、`__tests__/check-samples-coverage.test.ts`、`__tests__/asset-budget.test.ts`、`__tests__/docs-consistency-logic.test.ts`

- [ ] **步骤 1：L3 块头文案 + 两条新单测**

1. `check-samples-coverage.ts` 的派生锚输出块头（`:1053` 一带）改为如实描述三种形态：fixture 行 = self-test 覆盖位置（派生，格式 `self-test.ts#file: 'x.json'`）；`invocation`/`mutated-copy` 行 = **本行落点**；fixture 不可派生（不在盘）= `null`。
2. `check-samples-coverage.test.ts` 补两条：
   - dangling fixture 行 → `derivedAnchors` 对应元素为 `null`（并伴随 `negative-coverage-dangling` 或既有等价违规）；
   - `sampleDir:` 形态（目录声明为 `sampleDir` 的用例）→ 派生锚输出 `self-test.ts#sampleDir: '<dir>'`。

- [ ] **步骤 2：L5 注释历史口径**：把 `asset-budget.test.ts` 中裸写「当前实测 N」的注释改为带日期/锚的历史依据措辞（无有效日期者改为「以目录实测为准」）；**上限常量与断言一行不动**；顺带核对注释中的数值与当前实测是否一致（不一致则一并改为历史口径，不追新数）。

- [ ] **步骤 3：L9 人类可读断言**：在态 1（受控工件不可信）/态 2（自采集失败）路径的**既有**用例中，补一条人类可读通道断言（文案含「无法采集（不一致）」），不新增用例。

- [ ] **步骤 4：验证**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-samples-coverage.test.ts w-model-dev/scripts/__tests__/asset-budget.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts     # exit 0；46 行 / 48 探针 / 派生锚在场
npm run self-test 2>&1 | tail -1                              # 381/381
```

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/cli/check-samples-coverage.ts w-model-dev/scripts/__tests__/check-samples-coverage.test.ts w-model-dev/scripts/__tests__/asset-budget.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git commit -m "test/docs: 派生锚块头如实 + null/sampleDir 两分支单测 + asset-budget 注释历史口径 + 态1/2 人类可读断言（L3/L5/L9）"
```

## 任务 3：文档面（L6 / L7 / L8 / L11 + 规格脚注）

**文件：** `w-model-dev/examples/README.md`、`w-model-dev/scripts/__tests__/README.md`、`w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`、`w-model-dev/references/subagent-delegation.md`、`docs/superpowers/specs/2026-09-27-gate-thinning-design.md`

- [ ] **步骤 1：L6**：`examples/README.md:37` 的 roster 枚举改 ≤1 句义务摘要 + 指针（roster 权威 = `references/operational-recovery.md`「调用时机」节，锚串须能在该文件 grep 命中**目标小节**）；保留 dispatch-matrix 指针。
- [ ] **步骤 2：L7**：`__tests__/README.md:89` 行内联的 ①②③ 细节改义务摘要 + 指针（`references/command-reference.md` 的 `wm-append-runlog` 条目「时间戳三态」）；同批在规格 `2026-09-27-gate-thinning-design.md` §4/T4 规则行加脚注澄清验收口径为「**登记落点内** == 0（摘要句与实现视角描述除外）」。
- [ ] **步骤 3：L8**：`NEGATIVE-COVERAGE.md` 迁移说明补三条原「所防回归」子句（`check-verifier-output` 的 D-10 文案、`check-codegraph-queries` 由 4 条收窄为 D-6 一条、`check-coding-plan` 的「缺验证命令的编码变更被放行」）。
- [ ] **步骤 4：L11**：`subagent-delegation.md`「任务合并与审查面」节补一条约定：**长时门禁（prepush 级 ≈35-45 min）由控制者后台执行，子代理只做编辑与报告、不同步等待**（依据：2026-09-27/28 批两次环境停滞事故）。
- [ ] **步骤 5：验证**

```bash
grep -rn "isFile()\|闭环五脚本\|时间戳三态\|无法采集" w-model-dev/examples/README.md w-model-dev/scripts/__tests__/README.md | head   # 旧枚举零残留/仅指针
grep -rn "调用时机" w-model-dev/references/operational-recovery.md | head -3     # 锚可命中
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts     # 秒级；exit 0
npm run audit:l0-links                                        # exit 0
```

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/examples/README.md w-model-dev/scripts/__tests__/README.md w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md w-model-dev/references/subagent-delegation.md docs/superpowers/specs/2026-09-27-gate-thinning-design.md
git commit -m "docs(pointer): roster/矩阵行指针化 + 登记册迁移补全 + 长时门禁执行约定 + T4 验收口径脚注（L6/L7/L8/L11）"
```

## 任务 4：收口（CHANGELOG `[42.4.1]` + 版本六镜像 + 全量验收）

**文件：** `CHANGELOG.md`、`package.json`、`package-lock.json`、`w-model-dev/SKILL.md`、`w-model-dev/skill-metadata.json`、`docs/INSTALL.md`、`README.md`

- [ ] **步骤 1：CHANGELOG 新增 `## [42.4.1] - 2026-09-28`**：逐条登记 L1-L11（L12 记「已清/不改」）；**L10 的补记**（`[42.4.0]` T7 小节的连带文件清单：`lib/run-sync.ts` / `lib/types.ts` / `logic/archive-integrity-logic.ts` / `cli/check-archive-integrity.ts` / `__tests__/README.md` 矩阵行）；**L7 的口径澄清**（「权威外 == 0」= 登记落点内 == 0，摘要句与实现视角描述除外）。`[42.4.0]` 条目**逐字节不动**。
- [ ] **步骤 2：版本六镜像 bump 42.4.0 → 42.4.1**（`npm version 42.4.1 --no-git-tag-version` + SKILL.md frontmatter + skill-metadata.json + INSTALL.md + README「当前版本」），`grep -rn "42\.4\.0"` 六文件零残留（历史条目除外）。
- [ ] **步骤 3：终局全量验收**（**由控制者后台执行**，遵循 L11 约定）：

```bash
npm run prepush > .superpowers/sdd/2026-09-28-leftovers-closeout/task-4-prepush.txt 2>&1; echo "PREPUSH_EXIT=$?"
time npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts
npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts
```

- [ ] **步骤 4：Commit**

```bash
git add CHANGELOG.md package.json package-lock.json w-model-dev/SKILL.md w-model-dev/skill-metadata.json docs/INSTALL.md README.md
git commit -m "docs(changelog): 遗留收口登记（12 项处置 + 42.4.1 版本六镜像）"
```

---

## 验收总表（与规格 §4 对应）

| 规格条 | 验收动作 | 期望 |
| --- | --- | --- |
| L1 | 修复前后报错对照 | 新文案点名字段；其余 keyword 形态不变 |
| L2 | description ↔ 实现/权威对照 | 二者同义；description 非空在场 |
| L3 | 两条新单测 + 块头文案 | `null` / `sampleDir` 两分支有断言；文案如实 |
| L4 | 指针去重 | 同段仅一处指针；义务句未丢 |
| L5 | 注释历史口径 grep | 裸「当前实测」零残留（或明确标注历史）；断言/常量未动 |
| L6/L7 | 指针锚可命中小节 + 旧枚举零残留 | 义务摘要保留 |
| L8 | 迁移说明三条补登记 | 可逐条对账 |
| L9 | 既有用例新增断言 | 断言通过且指向该文案 |
| L10 | `[42.4.1]` 补记文件清单 | 逐字可核 |
| L11 | 约定成文 | 一节一条，不改脚本 |
| 终局 | `npm run prepush` | 19 项 exit 0；vitest 2615 → 2617 |
| 版本 | 六镜像 | 42.4.1 零残留 |
