# 技能范围剥离重构方案（Skill Scope Trimming）

> **状态**: 待 review（确认后按 executing-plans / subagent-driven-development 执行）
> **审查视角**: 技能本身只做"门禁 + 状态/RTM 管理 + 命令路由"，LLM-as-Verifier / 技能演化 / 技能评估一律剥离至外部工具（SkillOpt / [darwin-skill](https://github.com/alchaincyf/darwin-skill)）。
> **风险等级**: Breaking Change（公共 API 大幅收敛，建议升版本至 0.2.0）

**Goal**: 把技能包收敛为"门禁 + 状态机 + RTM"三件套，删除所有 LLM / 演化 / 评估代码与文档，使其真正自包含、零外部依赖、可独立分发。

**Architecture**: 保留 `src/state/` + `src/commands/router.ts`（瘦身）+ `src/types/index.ts`（瘦身）+ `src/index.ts`（瘦身）+ `w-model-dev/scripts/gate-logic.ts`（只留 `checkArtifactGate`）。删除 `src/core/`、`src/evolution/`、`src/eval/` 三个目录。演化与评估能力以文档指针形式指向 darwin-skill，不在本仓库实现。

**Tech Stack**: TypeScript 5.4 / Jest 29 / ESM / Node ≥ 18（不变）

---

## 一、架构边界原则（本次重构的判定准则）

| 类别 | 是否属于技能职责 | 处置 |
|---|---|---|
| 项目状态持久化（Project / Requirement / Design / TestCase CRUD） | ✅ 是 | 保留 |
| RTM 自动维护（双向追溯、覆盖率统计） | ✅ 是 | 保留 |
| /wm 命令路由与阶段状态机 | ✅ 是 | 保留（瘦身） |
| 工件质量门（RTM 覆盖率 + 四级测试通过判定） | ✅ 是 | 保留（`checkArtifactGate`） |
| LLM-as-a-Verifier 连续评分 | ❌ 否（外层 verifier 工具） | 删除 |
| 三维度验证框架 / PPT 排序 | ❌ 否（依赖 LLM） | 删除 |
| LLM 客户端抽象（OpenAI/Anthropic/Http/Mock） | ❌ 否（调用方自行注入） | 删除 |
| MetaSkillConfig（子标准 / scoringPrompt / 评估次数） | ❌ 否（SkillOpt 训练侧状态） | 删除 |
| SkillOptimizer 训练循环（Rollout→Reflect→Edit→Gate） | ❌ 否（SkillOpt / darwin-skill） | 删除 |
| SkillLiftEvaluator + Level 2 轨迹分析 | ❌ 否（SkillsBench / darwin-skill） | 删除 |
| 技能验证门（`checkSkillGate`，判定 Skill Lift > 0） | ❌ 否（演化侧门禁，随 SkillOptimizer 一起走） | 删除 |
| /wm review 命令（依赖 LLM verifier） | ❌ 否 | 删除 |

**darwin-skill 集成方式**（用户决策）: 仅文档指针，不做代码 hook。

---

## 二、文件处置清单

### 2.1 直接删除（共 16 个文件 + 3 个目录）

**源码目录**:
- `src/core/`（整个目录，6 个文件）
  - `llm-client.ts` / `scoring-engine.ts` / `verification-framework.ts` / `ppt-ranker.ts` / `w-model-enhancer.ts` / `meta-skill-config.ts`
- `src/evolution/`（整个目录）
  - `skill-optimizer.ts`
- `src/eval/`（整个目录）
  - `skill-lift.ts`

**测试文件**（8 个）:
- `tests/llm-client.test.ts`
- `tests/meta-skill-config.test.ts`
- `tests/ppt-ranker.test.ts`
- `tests/scoring-engine.test.ts`
- `tests/skill-lift.test.ts`
- `tests/skill-optimizer.test.ts`
- `tests/verification-framework.test.ts`
- `tests/w-model-enhancer.test.ts`

**技能包内文件**（2 个）:
- `w-model-dev/META-SKILL.md`（元技能可演化配置，属 SkillOpt 范畴）
- `w-model-dev/scripts/check-skill-gate.ts`（技能验证门 CLI，属演化侧）

**文档**（2 个）:
- `docs/llm-verifier-integration-design.md`（LLM Verifier 集成设计）
- `docs/llm-verifier-implementation-template.ts`（LLM Verifier 原始模板）

### 2.2 修改（共 11 个文件）

| 文件 | 修改要点 |
|---|---|
| `src/types/index.ts` | 删除 LLM/Verifier/MetaSkill/Eval 全部类型；`CommandContext` 移除 `verifier` 字段 |
| `src/commands/router.ts` | 移除 `verifier` 引用、`/wm review` 命令、analyze/design 中的 `verify*` 调用与 verifyMsg |
| `src/index.ts` | 移除 core/evolution/eval 导出；`createCommandContext` 简化（不再接受 verifierConfig / metaSkill） |
| `src/state/rtm-manager.ts` | 无需改（继续用 `checkArtifactGate`） |
| `w-model-dev/scripts/gate-logic.ts` | 删除 `checkSkillGate` / `SkillGateInput` / `SkillGateResult` / `SkillEvalReportShape`；保留 `checkArtifactGate` 及其类型 |
| `w-model-dev/SKILL.md` | 移除 LLM Verifier / 演化 / 评估章节；文件清单移除 META-SKILL.md 与 check-skill-gate.ts；新增"演化与评估"指针段指向 darwin-skill |
| `examples/run-wm-flow.ts` | 移除 verifierConfig；移除 `/wm review` 步骤；`createCommandContext` 调用简化 |
| `tests/command-router.test.ts` | 移除 verifier setup、整个 `review` describe 块、review 相关散布用例、`getCommandNames` 中 `review` 断言 |
| `jest.config.js` | 移除 `./src/core/` 覆盖率阈值块；保留 global 70% 与 `./src/state/` 80% |
| `README.md` | 移除 LLM-as-a-Verifier / 三维度 / PPT 能力描述；命令表移除 `/wm review`；移除 Logits Fallback 段；项目结构图更新；新增演化评估指针 |
| `docs/skill-design-document_SSoT.md` | 删除 §7.6/§7.7/§7.8、第 11/14/15 章、§10.5 中技能验证门部分、§10A 追溯表已删模块行、§16 中 SkillOpt/ACES/SkillsBench 等引用（保留 darwin-skill） |

### 2.3 同步更新（共 4 个文件）

| 文件 | 修改要点 |
|---|---|
| `docs/skill-design-document.md`（指针文档） | 同步移除对已删章节的引用 |
| `docs/IMPLEMENTATION-PLAN.md` | 移除已删模块的实现记录；测试数 119→实际值 |
| `docs/INSTALL.md` | 测试数 119→实际值；移除 LLM 相关说明 |
| `CHANGELOG.md` | `[Unreleased]` 新增"架构边界修正"段；建议升版本至 0.2.0；`[0.1.0]` 历史段保留不动 |

### 2.4 保留不动

- `src/state/project-state.ts` / `src/state/rtm-manager.ts`
- `w-model-dev/scripts/check-artifact-gate.ts`
- `w-model-dev/references/` / `w-model-dev/templates/` / `w-model-dev/examples/`
- `package.json`（files 字段已是 `dist/src/w-model-dev/docs`，无需改；scripts 不变）
- `tsconfig.json` / `.eslintrc.cjs` / `.gitignore` / `LICENSE` / `CONTRIBUTING.md`

---

## 三、任务分解

> 每个任务自包含可提交。命令中 `npm test` 实际退出码需用 `echo $?` 验证（管道会吃掉退出码）。
> 删除操作统一用 `rm -rf`；文件修改用 Edit 工具。
> 每个 Task 结束后跑一次 `npm run typecheck` 确认编译通过。

### Task 1: 删除 src/core/、src/evolution/、src/eval/ 三个目录

**Files**:
- Delete: `src/core/`（6 文件）
- Delete: `src/evolution/skill-optimizer.ts`
- Delete: `src/eval/skill-lift.ts`

- [ ] **Step 1: 删除三个目录**

```bash
rm -rf src/core src/evolution src/eval
```

- [ ] **Step 2: 确认目录已删**

```bash
ls src/
```
Expected: 仅剩 `commands/` `index.ts` `state/` `types/`

- [ ] **Step 3: 暂不跑 typecheck**（types/index.ts 与 index.ts 仍引用已删模块，预期失败，留待 Task 2/4 修复）

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor: 删除 src/core、src/evolution、src/eval 三目录（LLM/演化/评估剥离）"
```

---

### Task 2: 瘦身 src/types/index.ts

**Files**:
- Modify: `src/types/index.ts`

- [ ] **Step 1: 删除所有 LLM / Verifier / MetaSkill / Eval 类型块**

删除从 `// ==================== LLM-as-a-Verifier 类型 ====================`（约 L87）到文件末尾的所有内容，但**保留**以下两段：
- `// ==================== 命令处理类型 ====================` 段（`CommandContext` / `CommandResult` / `CommandHandler`）
- `CommandContext` 中的 `verifier` 字段需移除

最终 `src/types/index.ts` 应只包含：
- `ProjectPhase` / `Project` / `RequirementType` / `Priority` / `RequirementStatus` / `Requirement` / `DesignType` / `Design` / `Diagram` / `TestCaseType` / `TestCaseStatus` / `TestCase`
- `RTMRow` / `RTMMatrix`
- `CommandContext`（无 `verifier` 字段）/ `CommandResult` / `CommandHandler`

`CommandContext` 修改后形态：

```typescript
export interface CommandContext {
  projectState: import('../state/project-state').ProjectStateManager;
  rtm: import('../state/rtm-manager').RTMManager;
  cwd: string;
}
```

- [ ] **Step 2: 跑 typecheck 验证**

```bash
npm run typecheck 2>&1 | head -30
```
Expected: 仍有错误（来自 router.ts / index.ts / rtm-manager.ts 引用已删类型），但 types/index.ts 自身无错。

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts && git commit -m "refactor(types): 移除 LLM/Verifier/MetaSkill/Eval 类型，CommandContext 去除 verifier 字段"
```

---

### Task 3: 瘦身 src/commands/router.ts

**Files**:
- Modify: `src/commands/router.ts`

- [ ] **Step 1: 移除 import 中的 LLM 相关类型**

删除 `VerificationResult` from `../types` import（保留 `CommandContext` / `CommandHandler` / `CommandResult` / `DesignType` / `ProjectPhase` / `TestCaseType`）。

- [ ] **Step 2: 移除 help 文本中的 `/wm review` 行**

在 `helpHandler` 的"核心命令"列表中删除：
```
  /wm review <目标ID或文件路径>        LLM-as-a-Verifier 验证（连续评分+置信度）
```

- [ ] **Step 3: 移除 analyze 命令中的 verifier 调用**

在 `analyze` handler 中删除：
- `let verification: VerificationResult | undefined;`
- `if (ctx.verifier) { verification = await ctx.verifier.verifyRequirement(requirement); }`
- `verifyMsg` 变量与模板字符串中的 `${verifyMsg}`
- `data` 字段中的 `verification`

- [ ] **Step 4: 移除 design 命令中的 verifier 调用**

同 Step 3，删除 `design` handler 中所有 `verification` / `verifyMsg` 相关代码。

- [ ] **Step 5: 删除整个 `/wm review` 命令注册块**

删除从 `// ---- /wm review ----` 到 `});` 的整段（约 L455-L501），包括 `formatReviewResult` 辅助函数（约 L626-L642）。

- [ ] **Step 6: 跑 typecheck 验证**

```bash
npm run typecheck 2>&1 | head -30
```
Expected: router.ts 无错；剩余错误来自 index.ts。

- [ ] **Step 7: Commit**

```bash
git add src/commands/router.ts && git commit -m "refactor(router): 移除 /wm review 命令与 verify* 调用（LLM verifier 剥离）"
```

---

### Task 4: 简化 src/index.ts

**Files**:
- Modify: `src/index.ts`

- [ ] **Step 1: 移除 core/evolution/eval 所有导出**

删除以下导出块：
- `// ==================== 核心引擎 ====================` 段（LLMVerifierEngine / VerificationFramework / PPTRanker / WModelVerifierEnhancer / BaseLLMClient 等）
- `// ==================== 技能演化 ====================` 段
- `// ==================== 技能评估 ====================` 段
- `DEFAULT_META_SKILL_CONFIG` 等导出

保留：
- `// ==================== 状态管理 ====================` 段（ProjectStateManager / ProjectStore / RTMManager）
- `// ==================== 命令路由 ====================` 段（dispatch / registerCommand / getCommandNames）
- `// ==================== 类型 ====================` 段（`export type * from './types'`）

- [ ] **Step 2: 简化 createCommandContext**

修改后：

```typescript
import { ProjectStateManager } from './state/project-state';
import { RTMManager } from './state/rtm-manager';
import type { CommandContext } from './types';

/**
 * 创建默认命令上下文（用于即装即用的 CLI / Agent 接入）
 *
 * @param cwd 工作目录（项目根）
 */
export async function createCommandContext(cwd: string): Promise<CommandContext> {
  const projectState = new ProjectStateManager(cwd);
  await projectState.load();
  const rtm = new RTMManager(cwd, projectState);
  return { projectState, rtm, cwd };
}
```

删除 `WModelVerifierEnhancer` / `createLLMClient` / `VerifierConfig` / `MetaSkillConfig` 的 import 与使用。

- [ ] **Step 3: 跑 typecheck 验证全仓库通过**

```bash
npm run typecheck 2>&1 | head -30
```
Expected: 0 错误。

- [ ] **Step 4: Commit**

```bash
git add src/index.ts && git commit -m "refactor(index): 收敛公共 API 至状态/路由/类型，createCommandContext 去 verifier 参数"
```

---

### Task 5: 瘦身 w-model-dev/scripts/gate-logic.ts

**Files**:
- Modify: `w-model-dev/scripts/gate-logic.ts`

- [ ] **Step 1: 删除技能验证门相关代码**

删除：
- `SkillEvalReportShape` interface（约 L46-L55）
- `// ==================== 技能验证门 ====================` 整段（约 L118-L168，含 `SkillGateInput` / `SkillGateResult` / `checkSkillGate`）

保留：
- `RTMMatrixShape` / `TestSummaryShape` / `ArtifactGateResult` / `checkArtifactGate`

- [ ] **Step 2: 更新文件顶部注释**

将注释中"两类质量门"改为"工件质量门"，删除对 `checkSkillGate` 与 `src/evolution/skill-optimizer.ts` 的引用。

- [ ] **Step 3: 跑 typecheck 验证**

```bash
npm run typecheck 2>&1 | head -20
```
Expected: 0 错误（`skill-optimizer.ts` 已删，无人再 import `checkSkillGate`）。

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/scripts/gate-logic.ts && git commit -m "refactor(gate-logic): 移除 checkSkillGate（技能验证门随演化侧剥离）"
```

---

### Task 6: 删除 w-model-dev/META-SKILL.md 与 check-skill-gate.ts

**Files**:
- Delete: `w-model-dev/META-SKILL.md`
- Delete: `w-model-dev/scripts/check-skill-gate.ts`

- [ ] **Step 1: 删除文件**

```bash
rm w-model-dev/META-SKILL.md w-model-dev/scripts/check-skill-gate.ts
```

- [ ] **Step 2: 确认 w-model-dev/scripts/ 只剩 gate-logic.ts 与 check-artifact-gate.ts**

```bash
ls w-model-dev/scripts/
```
Expected: `check-artifact-gate.ts  gate-logic.ts`

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "refactor(skill): 删除 META-SKILL.md 与 check-skill-gate.ts（演化侧资产剥离）"
```

---

### Task 7: 修改 examples/run-wm-flow.ts

**Files**:
- Modify: `examples/run-wm-flow.ts`

- [ ] **Step 1: 移除 verifierConfig 与相关 import**

删除：
- `import type { VerifierConfig } from '../src/types/index.js';`
- `verifierConfig` 常量定义（L26-L31）
- `/wm review REQ-001` 步骤（L76）

- [ ] **Step 2: 简化 createCommandContext 调用**

将 `const ctx = await createCommandContext(cwd, verifierConfig);` 改为：
```typescript
const ctx = await createCommandContext(cwd);
```

- [ ] **Step 3: 更新文件顶部注释**

移除"运行 LLM-as-a-Verifier 评分"描述；保留"自动维护 RTM、质量门检查"。

- [ ] **Step 4: 跑示例验证**

```bash
npm run example:run 2>&1 | tail -20
```
Expected: 8 阶段全过，无 `/wm review` 步骤，末尾输出"✅ W 模型全流程演示完成"。

- [ ] **Step 5: Commit**

```bash
git add examples/run-wm-flow.ts && git commit -m "refactor(example): 移除 verifier 与 /wm review 步骤"
```

---

### Task 8: 修改 tests/command-router.test.ts

**Files**:
- Modify: `tests/command-router.test.ts`

- [ ] **Step 1: 移除 verifier 相关 import**

删除：
- `import { WModelVerifierEnhancer } from '../src/core/w-model-enhancer.js';`
- `import { MockLLMClient } from '../src/core/llm-client.js';`
- `VerifierConfig` from `../src/types/index.js` 的 import（保留 `CommandContext`）

- [ ] **Step 2: 简化 beforeEach**

修改后：
```typescript
beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'w-model-cmd-'));
  const state = new ProjectStateManager(tmpDir);
  await state.load();
  const rtm = new RTMManager(tmpDir, state);
  ctx = { projectState: state, rtm, cwd: tmpDir };
});
```

- [ ] **Step 3: 删除整个 `describe('命令路由 - review')` 块**

约 L155-L169，全部删除。

- [ ] **Step 4: 删除散布的 review 相关测试用例**

在 `describe('命令路由 - 边界与错误路径')` 中删除：
- `it('review 缺少参数时失败' ...)`
- `it('review 设计文档' ...)`
- `it('review 测试用例' ...)`
- `it('review 文件路径' ...)`
- `it('review 无 verifier 时失败' ...)`
- `it('review 不存在的目标返回失败' ...)`

在 `it('getCommandNames 返回已注册命令')` 中删除：
- `expect(names).toContain('review');`

- [ ] **Step 5: 跑测试验证**

```bash
npm test > /tmp/t.log 2>&1; echo "EXIT=$?"; tail -20 /tmp/t.log
```
Expected: `EXIT=0`；测试数减少（原 163 - 删除的 review 用例数）；覆盖率门通过（src/core 已不存在，无 85% 阈值）。

- [ ] **Step 6: Commit**

```bash
git add tests/command-router.test.ts && git commit -m "test(router): 移除 verifier setup 与 review 测试用例"
```

---

### Task 9: 修改 jest.config.js

**Files**:
- Modify: `jest.config.js`

- [ ] **Step 1: 移除 `./src/core/` 覆盖率阈值块**

删除：
```javascript
'./src/core/': {
  branches: 85,
  functions: 85,
  lines: 85,
  statements: 85,
},
```

保留 `global: 70%` 与 `./src/state/: 80%`。

- [ ] **Step 2: 跑测试验证覆盖率门通过**

```bash
npm test > /tmp/t.log 2>&1; echo "EXIT=$?"; tail -25 /tmp/t.log
```
Expected: `EXIT=0`；无 `coverage threshold not met` 报错。

- [ ] **Step 3: Commit**

```bash
git add jest.config.js && git commit -m "chore(jest): 移除 src/core 覆盖率阈值（目录已删）"
```

---

### Task 10: 修改 w-model-dev/SKILL.md

**Files**:
- Modify: `w-model-dev/SKILL.md`

- [ ] **Step 1: 移除"实现位置"表中的 LLM/演化/评估行**

删除表中以下行（约 L244-L249）：
- 阶段门评审（LLM-as-a-Verifier）→ `src/core/w-model-enhancer.ts`
- LLM Verifier 引擎 → `src/core/scoring-engine.ts`
- 三维度验证框架 → `src/core/verification-framework.ts`
- PPT 优先级排序 → `src/core/ppt-ranker.ts`
- 技能演化（验证门）→ `src/evolution/skill-optimizer.ts`

保留：命令接口 / 数据与状态管理 / RTM 同步维护 / 工件质量门 / 公共 API 入口 行。

- [ ] **Step 2: 移除"门禁脚本调用"段中的技能验证门部分**

删除约 L140-L146 的 `# 技能验证门` 代码块与说明。

- [ ] **Step 3: 文件清单移除 META-SKILL.md 与 check-skill-gate.ts**

修改 `## 文件清单` 代码块：
- 删除 `├── META-SKILL.md` 行
- 在 `scripts/` 下删除 `│   └── check-skill-gate.ts` 行
- `gate-logic.ts` 注释从"含 checkArtifactGate + checkSkillGate"改为"仅 checkArtifactGate"

- [ ] **Step 4: 简化"快速验证"段**

将 `# 运行测试套件（119 个测试，覆盖率达标）` 改为 `# 运行测试套件（覆盖率达标）`（去掉过时数字）。

- [ ] **Step 5: 简化"编程式接入"示例**

```typescript
import { createCommandContext, dispatch } from 'w-model-dev-skill';

const ctx = await createCommandContext('./my-project');

await dispatch('/wm analyze 用户登录功能', ctx);
await dispatch('/wm design type=架构', ctx);
// ... 完整 8 阶段流程
```

- [ ] **Step 6: 新增"演化与评估"指针段**

在文件末尾追加：

```markdown
## 演化与评估（外部工具）

本技能仅负责 W 模型编排与工件质量门，不包含技能自身的演化与评估实现。
技能演化（SkillOpt ReflectTrainer 训练循环）与技能评估（ACES Skill Lift / SkillsBench 三级评估）
委托外部工具完成：

- [darwin-skill](https://github.com/alchaincyf/darwin-skill) — 技能演化与评估框架
- SkillOpt — Rollout → Reflect → Edit → Gate 训练循环参考实现

外层工具通过以下接口接入本技能：
- 编程式：`createCommandContext(cwd)` → `dispatch('/wm ...', ctx)` 跑 rollout
- 门禁脚本：`npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]` 获取确定性门禁判定
- 状态读取：`.w-model/project.json` 与 `.w-model/rtm.json`（JSON 格式，可直接消费）
```

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/SKILL.md && git commit -m "docs(skill): 移除 LLM/演化章节，新增 darwin-skill 指针段"
```

---

### Task 11: 修改 README.md

**Files**:
- Modify: `README.md`

- [ ] **Step 1: 修改"核心能力"段**

移除以下 bullet：
- LLM-as-a-Verifier
- 三维度验证框架
- PPT 排序算法

新增 bullet：
- **演化与评估外置**：技能演化与评估委托 [darwin-skill](https://github.com/alchaincyf/darwin-skill) 等外部工具，技能本身保持精简

- [ ] **Step 2: 命令表移除 `/wm review` 行**

删除：
```
| `/wm review <目标ID或文件路径>` | LLM-as-a-Verifier 验证（连续评分+置信度） |
```

- [ ] **Step 3: 移除"LLM Verifier 的 Logits Fallback"整段**

删除 `## LLM Verifier 的 Logits Fallback` 及其表格（约 L142-L150）。

- [ ] **Step 4: 更新"项目结构"图**

- `src/core/` 子树整段删除
- `src/` 下新增 `eval/` 与 `evolution/` 已不存在，无需补
- `tests/` 注释从"119 个，覆盖率 ≥ 85%"改为"覆盖率达标"（去掉过时数字）
- `w-model-dev/` 下删除 `META-SKILL.md` 行；`scripts/` 下删除 `check-skill-gate.ts` 行
- `docs/` 下删除 `llm-verifier-integration-design.md` 与 `llm-verifier-implementation-template.ts` 行

- [ ] **Step 5: 简化"编程式接入"示例**

```typescript
import { createCommandContext, dispatch } from 'w-model-dev-skill';

const ctx = await createCommandContext('./my-project');

await dispatch('/wm analyze 用户登录功能', ctx);
await dispatch('/wm design type=架构', ctx);
await dispatch('/wm design type=概要', ctx);
await dispatch('/wm design type=详细', ctx);
await dispatch('/wm code 登录服务 authService.ts', ctx);
await dispatch('/wm test type=单元 result=pass', ctx);
await dispatch('/wm test type=集成 result=pass', ctx);
await dispatch('/wm test type=系统 result=pass', ctx);
const result = await dispatch('/wm test type=验收 result=pass', ctx);

if (result.success) {
  console.log('✅ 质量门通过，项目可交付');
}
```

- [ ] **Step 6: 覆盖率目标描述修正**

将 `覆盖率目标：全局 ≥ 70%，核心模块 ≥ 85%。` 改为 `覆盖率目标：全局 ≥ 70%，状态管理模块 ≥ 80%。`

- [ ] **Step 7: 新增"演化与评估"段**

在"相关文档"前追加：

```markdown
## 技能演化与评估

本技能仅负责 W 模型编排与工件质量门。技能自身的演化（元参数优化）与评估（Skill Lift）委托外部工具：

- [darwin-skill](https://github.com/alchaincyf/darwin-skill) — 技能演化与评估框架
- SkillOpt — Rollout → Reflect → Edit → Gate 训练循环参考实现

外层工具可通过 `createCommandContext` + `dispatch` 跑 rollout，或直接消费 `.w-model/*.json` 状态文件。
```

- [ ] **Step 8: Commit**

```bash
git add README.md && git commit -m "docs(readme): 移除 LLM 能力描述，更新结构与命令表，新增演化评估指针"
```

---

### Task 12: 修改 docs/skill-design-document_SSoT.md

**Files**:
- Modify: `docs/skill-design-document_SSoT.md`

> 这是最复杂的文档修改。建议先 Read 全文定位章节行号，再用多次 Edit 删除整章。

- [ ] **Step 1: 删除 §7.6 / §7.7 / §7.8 三个数据模型章节**

删除"LLM-as-a-Verifier 数据模型"、"元技能与演化数据模型"、"技术评估数据模型"三节。

- [ ] **Step 2: 删除第 11 章「LLM Verifier 集成规范」整章**

- [ ] **Step 3: 删除第 14 章「技能演化机制」整章**

- [ ] **Step 4: 删除第 15 章「技能评估标准」整章**

- [ ] **Step 5: §10.5 瘦身**

§10.5「两类质量门」改为「工件质量门」，删除技能验证门（`checkSkillGate`）部分，只保留工件质量门（`checkArtifactGate`）。

- [ ] **Step 6: §10A 追溯表瘦身**

删除表中对应已删模块的行（LLMVerifierEngine / VerificationFramework / PPTRanker / WModelVerifierEnhancer / SkillOptimizer / SkillLiftEvaluator / MetaSkillConfig / checkSkillGate 等）。

- [ ] **Step 7: 第 12 章发展规划瘦身**

删除"第四阶段（自演化版）"或改为指针："技能自演化委托 darwin-skill 等外部工具"。

- [ ] **Step 8: §16 参考文献瘦身**

删除 SkillOpt / MetaSkill-Evolve / ACES / SkillsBench / SkillLearnBench / PPT 等引用；新增 darwin-skill 引用。

- [ ] **Step 9: 文件顶部"单一事实来源"声明保留，但补充一句**

"本 SSoT 仅描述技能核心（编排 + 状态 + RTM + 工件质量门）；技能演化与评估不在本文件范围，委托 darwin-skill。"

- [ ] **Step 10: 跑 typecheck 确认未误伤代码**

```bash
npm run typecheck 2>&1 | head -10
```
Expected: 0 错误（文档修改不影响编译）。

- [ ] **Step 11: Commit**

```bash
git add docs/skill-design-document_SSoT.md && git commit -m "docs(ssot): 删除 LLM/演化/评估章节，收敛至技能核心范围"
```

---

### Task 13: 同步更新 docs/ 其余文档

**Files**:
- Modify: `docs/skill-design-document.md`
- Modify: `docs/IMPLEMENTATION-PLAN.md`
- Modify: `docs/INSTALL.md`

- [ ] **Step 1: docs/skill-design-document.md（指针文档）**

移除对已删章节（§7.6/7.7/7.8、第 11/14/15 章）的所有引用；保留对 §7（核心数据模型）/ §8（命令）/ §9（RTM）/ §10.5（工件质量门）的指针。

- [ ] **Step 2: docs/IMPLEMENTATION-PLAN.md**

- 移除已删模块（core/evolution/eval）的实现记录
- 测试数 119 → 实际值（运行 `npm test 2>&1 | grep "Tests:"` 获取）
- 同文档内 119 与 163 矛盾一并消除

- [ ] **Step 3: docs/INSTALL.md**

- 测试数 119 → 实际值
- 移除任何 LLM 相关说明（若存在）

- [ ] **Step 4: Commit**

```bash
git add docs/skill-design-document.md docs/IMPLEMENTATION-PLAN.md docs/INSTALL.md
git commit -m "docs: 同步指针文档/实现计划/安装指南至瘦身后的技能范围"
```

---

### Task 14: 删除 docs/ 下 LLM Verifier 专属文档

**Files**:
- Delete: `docs/llm-verifier-integration-design.md`
- Delete: `docs/llm-verifier-implementation-template.ts`

- [ ] **Step 1: 删除文件**

```bash
rm docs/llm-verifier-integration-design.md docs/llm-verifier-implementation-template.ts
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "docs: 删除 LLM Verifier 集成设计与实现模板（已剥离至外层工具）"
```

---

### Task 15: 更新 CHANGELOG.md 与 package.json 版本

**Files**:
- Modify: `CHANGELOG.md`
- Modify: `package.json`

- [ ] **Step 1: CHANGELOG.md 新增 [Unreleased] 段**

在 `## [Unreleased]` 下追加新段"架构边界修正（Breaking Change）"：

```markdown
### 架构边界修正（Breaking Change）

> 技能本身只做"门禁 + 状态/RTM 管理 + 命令路由"，LLM-as-Verifier / 技能演化 / 技能评估一律剥离至外部工具（SkillOpt / darwin-skill）。

#### 删除
- 删除 `src/core/` 目录（`llm-client.ts` / `scoring-engine.ts` / `verification-framework.ts` / `ppt-ranker.ts` / `w-model-enhancer.ts` / `meta-skill-config.ts`）
- 删除 `src/evolution/skill-optimizer.ts`（SkillOpt 训练循环，委托 darwin-skill）
- 删除 `src/eval/skill-lift.ts`（ACES Skill Lift + 轨迹分析，委托 darwin-skill）
- 删除 `w-model-dev/META-SKILL.md`（元技能可演化配置，属 SkillOpt 范畴）
- 删除 `w-model-dev/scripts/check-skill-gate.ts`（技能验证门，随演化侧剥离）
- 删除 `docs/llm-verifier-integration-design.md` 与 `docs/llm-verifier-implementation-template.ts`
- 删除对应 8 个测试文件（llm-client / scoring-engine / verification-framework / ppt-ranker / w-model-enhancer / meta-skill-config / skill-optimizer / skill-lift）

#### 变更
- `src/commands/router.ts`：移除 `/wm review` 命令；analyze/design 不再调用 LLM verifier
- `src/types/index.ts`：移除 LLM/Verifier/MetaSkill/Eval 全部类型；`CommandContext` 去除 `verifier` 字段
- `src/index.ts`：公共 API 收敛至状态管理 + 命令路由 + 类型；`createCommandContext(cwd)` 不再接受 verifierConfig / metaSkill
- `w-model-dev/scripts/gate-logic.ts`：移除 `checkSkillGate`，只保留 `checkArtifactGate`
- `jest.config.js`：移除 `src/core` 覆盖率阈值块
- `w-model-dev/SKILL.md` / `README.md` / SSoT：移除 LLM/演化/评估章节，新增 darwin-skill 指针

#### 新增
- 文档指针：技能演化与评估委托 [darwin-skill](https://github.com/alchaincyf/darwin-skill)
```

- [ ] **Step 2: package.json 升版本至 0.2.0**

```json
"version": "0.2.0",
```

理由：公共 API 大幅收敛（Breaking Change），按 semver 0.x 阶段升 minor。

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md package.json && git commit -m "chore: 升版本至 0.2.0，记录架构边界修正"
```

---

### Task 16: 最终验证

- [ ] **Step 1: typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```
Expected: 无输出（0 错误）。

- [ ] **Step 2: lint**

```bash
npm run lint 2>&1 | tail -5
```
Expected: 无输出（0 warnings）。

- [ ] **Step 3: test + 覆盖率门**

```bash
npm test > /tmp/final.log 2>&1; echo "EXIT=$?"; tail -25 /tmp/final.log
```
Expected: `EXIT=0`；所有测试通过；无 `coverage threshold not met`。

- [ ] **Step 4: build**

```bash
npm run build 2>&1 | tail -5; echo "EXIT=$?"
```
Expected: `EXIT=0`；`dist/` 生成成功。

- [ ] **Step 5: example:run**

```bash
npm run example:run 2>&1 | tail -10
```
Expected: 8 阶段全过，末尾"✅ W 模型全流程演示完成"。

- [ ] **Step 6: 确认 dist 不含已删模块**

```bash
ls dist/src/
```
Expected: 仅 `commands/` `index.js` `state/` `types/`（无 `core/` `evolution/` `eval/`）。

- [ ] **Step 7: 确认 w-model-dev/scripts 只剩 2 个脚本**

```bash
ls w-model-dev/scripts/
```
Expected: `check-artifact-gate.ts  gate-logic.ts`

- [ ] **Step 8: 最终 Commit（如有遗漏修复）**

```bash
git status
# 若有未提交改动：
git add -A && git commit -m "chore: 最终验证修复"
```

---

## 四、风险与回滚

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 漏删某处对已删模块的引用导致 typecheck 失败 | 中 | 编译失败 | Task 16 Step 1 兜底；每个 Task 后跑 typecheck |
| `command-router.test.ts` 删过头导致测试数骤降 | 低 | 测试覆盖不足 | Task 8 仅删 review 相关用例，保留流程测试 |
| SSoT 章节行号定位错误 | 中 | 误删保留章节 | Task 12 Step 1 前先 Read 全文确认行号 |
| 外部用户依赖 `createCommandContext(cwd, verifierConfig)` 旧签名 | 低 | Breaking | CHANGELOG 已标注 Breaking Change；升版本至 0.2.0 |
| `dist/` 残留旧产物 | 低 | 发布物含已删模块 | Task 16 Step 6 验证；必要时 `rm -rf dist && npm run build` |

**回滚策略**: 整个重构在一个分支上完成（建议 `refactor/skill-scope-trimming`），合并前可整体放弃。每个 Task 独立 commit，可按需 revert 单个 Task。

---

## 五、Self-Review 结果

**1. 用户指令覆盖**:
- ✅ "技能只做门禁" → 保留 `checkArtifactGate`，删 `checkSkillGate`
- ✅ "不涉及 LLM" → 删 `src/core/` 全部
- ✅ "不应该有轨迹部分" → 删 `src/eval/skill-lift.ts`（含 Level 2 轨迹分析）
- ✅ "进化利用 SkillOpt 或 darwin-skill" → 删 `src/evolution/skill-optimizer.ts`，文档指向 darwin-skill
- ✅ "darwin-skill 文档指针即可" → Task 10 Step 6 / Task 11 Step 7 仅加链接，不做代码 hook
- ✅ "直接删除剥离物" → Task 1/6/14 全部 `rm`
- ✅ "先出重构方案" → 本文档

**2. Placeholder 扫描**: 无 TBD / TODO；每个 Step 含具体命令或代码片段。SSoT 修改（Task 12）因未读全文未给精确行号，标注"先 Read 定位"。

**3. 类型一致性**: `CommandContext` 在 Task 2（types）、Task 3（router 用）、Task 7（example 用）、Task 8（test 用）、Task 4（index 工厂）中签名一致：`{ projectState, rtm, cwd }`，无 `verifier`。

**4. 漏项检查**:
- `src/state/rtm-manager.ts` 无需改（继续用 `checkArtifactGate`，已确认 L27 import 与 L148 调用均指向保留函数）✅
- `package.json` files 字段是 `["dist", "src", "w-model-dev", "docs"]`，无需改 ✅
- `tsconfig.json` include 是 `["src/**/*.ts", "w-model-dev/scripts/**/*.ts"]`，无需改 ✅
- `.eslintrc.cjs` glob 是 `src/**/*.ts`，无需改 ✅

---

## 六、执行选择

方案已完成并保存至 [docs/refactor-plan-skill-scope-trimming.md](file:///workspace/docs/refactor-plan-skill-scope-trimming.md)。

确认后两种执行方式：

1. **Subagent-Driven（推荐）**: 每个 Task 派一个 fresh subagent，Task 间 review，迭代快
2. **Inline Execution**: 在当前会话按 executing-plans 批量执行，带 checkpoint review

请 review 方案，确认无误后告诉我选哪种执行方式（或先调整方案）。
