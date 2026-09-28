# 遗留收口 设计规格（2026-09-28）

> 动机：上一批「门禁/测试瘦身」（`73e7e036` 已并入 main，含 WS-T7 去 hash 化）经整分支最终审查判定**可合并 / 无阻断**，同时留下 12 项「可延后」遗留；用户裁定：**处理全部遗留**，随后移除其他分支并推送远端。
> 执行分支：`feat/leftovers-closeout`（worktree `.worktrees/leftovers`，基线 `73e7e036`）。
> 口径沿用上一批：**修复为主**（不销账）；**零新增门禁**；**历史不改写**（`CHANGELOG` 的 `[42.4.0]` 条目逐字节不动，补记写入新的 `[42.4.1]` 条目）。

## 1. 遗留清单与逐项处置（全部来自上一批最终审查/账本登记，已逐项实测现状）

| # | 遗留 | 现状（实测） | 处置 |
| --- | --- | --- | --- |
| L1 | `schema-loader` 的 `additionalProperties` 报错**不点名字段** | `w-model-dev/scripts/infrastructure/schema-loader.ts:102` 只渲染 `e.instancePath + e.message + [keyword]`，Ajv 的 `params.additionalProperty` 被丢弃（T7 迁移时表现为三条同文案、无法定位字段） | 在格式化器中对 `keyword === 'additionalProperties'` 追加字段名（`(额外字段: <name>)`），保持其余形态不变 |
| L2 | `schemas/run-log.schema.json` 的 `parentDispatchId` 描述与权威键句**相反** | schema :246 写「在场时同 parentDispatchId 的条目不互计重复组」；权威 `references/data-models.md`「用量实效校验」段写「同 `parentDispatchId` 且键全同仍计组」 | 以**实现**（`cli/check-budget.ts` 分组键守卫）为准订正 schema description 措辞，使二者同义 |
| L3 | 派生锚**块头文案**与 `null` / `sampleDir` 两分支无单测 | `check-samples-coverage.ts:1053` 头写「每行 → 覆盖位置（由 self-test.ts 用例条目派生）」，但 `invocation`/`mutated-copy` 行打印**本行落点**、fixture 行不可派生时打印 `null`；两分支无单测 | 改写块头为「fixture 行 = self-test 覆盖位置（派生）；其余行 = 本行落点；不可派生为 null」；补两条单测（dangling → `null`、`sampleDir:` 形态） |
| L4 | `check-budget.ts` 头注**同一权威段被指两次** | `:18-21` 与 `:28` 都指向 `data-models.md`「用量实效校验」段（R6） | 合并为一处（保留义务句，删重复指针） |
| L5 | `asset-budget.test.ts` 的「当前实测」注释 | 10 处，部分带日期/锚（如「2026-09-15 实测」「head 实测」），部分裸写「当前实测 N …」且数值可能已随本批文档改动漂移 | 把裸写者改为**带日期/锚的历史依据**措辞（无效数字改为「以目录实测为准」）；**上限常量与断言一行不动** |
| L6 | `examples/README.md:37` 的 roster 复述 | 同句复述闭环五脚本 + role-dispatch + signature-chain + 阶段 5-8 两门（roster 权威在 `operational-recovery.md`「调用时机」节） | 枚举改 ≤1 句义务摘要 + 指向「调用时机」节；保留既有 dispatch-matrix 指针（那是角色分派矩阵，非 roster） |
| L7 | `__tests__/README.md:89` 仍复述簇 ① 细节 | 测试矩阵行内联了 ①②③ 与两个逃生口细节 | 改为义务摘要 + 指针（权威 `command-reference.md` wm-append-runlog 条目）；同时把 T4 的验收口径**澄清为「登记落点内 == 0」**（写入 `[42.4.1]` 条目与规格 §4/T4 脚注） |
| L8 | `NEGATIVE-COVERAGE.md` 迁移说明**未逐条登记**被换件/删行丢掉的原「所防回归」子句 | 迁移说明只记了 2 处具名换件 + 6 处次要样本退出 | 在迁移说明补「原列出的次要样本 + 其原所防回归子句」（`check-verifier-output` D-10 文案、`check-codegraph-queries` 4→1、`check-coding-plan` 行） |
| L9 | T3 的「`vitest 用例 : 无法采集（不一致）`」人类可读标签**无断言** | 该文案仅在 `docs-consistency-logic.test.ts:2072` 注释中出现 | 在态 1/态 2 失败路径的既有用例中补一条人类可读通道断言（不新增用例面） |
| L10 | `CHANGELOG` `[42.4.0]` 的 T7 小节**未点名全部连带文件** | 只写「全链条」+ 指向账本 | 在 `[42.4.1]` 条目**补记**连带文件清单（`lib/run-sync.ts` / `lib/types.ts` / `logic/archive-integrity-logic.ts` / `cli/check-archive-integrity.ts` / `__tests__/README.md` 矩阵行） |
| L11 | 长时门禁的执行约定未成文 | 2026-09-27/28 两批共两次环境停滞均出在「子代理同步等待 prepush（≈35-45 min）」（本批 0 次；口径与最终审查一致） | `references/subagent-delegation.md`「任务合并与审查面」节补一条：长时门禁（prepush 级）由控制者后台执行，子代理只做编辑/报告，不同步等待 |
| L12 | 任务 1 报告处置 #13/#14 标注与报告措辞 | 报告为本地留档（`.superpowers/sdd/**`，不随仓交付）；`[42.4.0]` 条目已如实写「部分成立」 | **不改**（已完成，登记为已清） |

**已裁定豁免 / 保留（本批不动，防反复）**：`eval/e2e/demo-assets/**` 的 D-6 枚举（上一批裁定⑪显式豁免）；`CONTRIBUTING.md:7`「provenance 三形态」（裁定⑫）；`logic/budget-logic.ts:7-8` 阈值句（实现视角豁免）；`references/operational-recovery.md:458` 诊断字面；`schemas` 计数契约与其余机器可读契约；已随上一批修复的 `SSoT:1396` 重复与 `command-reference` ⑥a 标签（本批已复核为已清）。

## 2. 全局约束

1. **牙齿清单不动**：exit-code 契约与 48 条 exit-2 串行探针、scope/Git 绑定、**文件/制品级**证据链与签名链、版本六镜像、schema 字段 description 门禁、有门禁强制的计数契约、四类负例探针。
2. **零新增门禁**；**不改机器可读契约**（L2 仅订正 description 文字使其与实现一致，字段集与语义不变）。
3. **修复为主**（不销账）；每处改动在 `[42.4.1]` 条目登记（含 L10 补记）。
4. **历史不改写**：`[42.4.0]` 及其以下条目逐字节不动。
5. 回归纪律：`.ts` 改动前 codegraph 查询落盘；每组定向 vitest；终局全量 prepush 19 项。

## 3. 计数与版本预测

- `vitestTestCount` **+2**（L3 两条新单测；L9 为既有用例内断言，不增用例数）→ 2615 → 2617；
- `testFileCount 106` / `self-test 381` / `schema 34` / `exit2 46` / `prepush 19` / CLI 47 / personas 33 / references 44 **不变**；
- 版本：**42.4.1**（行为面可见变更：schema-loader 报错文案、schema description 文字；六镜像同步）。

## 4. 验收策略

1. 每组定向 vitest（`check-samples-coverage.test.ts`、`docs-consistency-logic.test.ts`、`check-budget` 相关、`schema-loader` 相关）+ `npm run self-test` + `check-docs-consistency`（秒级）+ `audit:l0-links`；
2. L1 须给出「修复前/后同一输入的报错对照」实测（点名字段生效）；
3. L2 须给出 schema description 与权威键句的逐字对照 + 与实现分组键的一致性核对；
4. L5/L6/L7/L8 须给出 grep 证据（旧枚举/旧措辞零残留、指针锚可命中）；
5. 终局：`npm run prepush` 19 项 exit 0（全量 vitest 零回归，除新增 2 例外用例数不变）+ 版本六镜像 `42.4.1` 零残留。

## 5. 风险登记

| 项 | 登记 |
| --- | --- |
| L1 报错文案变更 | 扫描全仓测试/文档对该文案的字面断言（实测无精确断言；`CHANGELOG` `[42.4.0]` 引用的旧文案属历史条目，不动，由 `[42.4.1]` 承接改进说明） |
| L2 schema 文字改动 | schema 字段 description 门禁要求「全字段有 description」——只改文字不删字段，描述仍在场 |
| L5 注释改动 | 仅注释；上限常量与断言不动，`asset-budget` 用例数不变 |
| L6/L7 指针替换 | 须保留义务摘要、锚串可 grep 命中目标小节（上一批 T4 教训：锚串要能命中**目标小节名**） |
| L11 成文 | 只写操作约定，不改脚本、不加门禁 |
