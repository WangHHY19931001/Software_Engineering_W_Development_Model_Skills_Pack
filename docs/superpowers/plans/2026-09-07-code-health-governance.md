# Code Health Governance Campaign 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。计划仅定义实现，不授权在未经人类批准的候选上修改代码。

**目标：** 为 W-Model 技能包建立四阶段、证据门控且可回滚的 code-health campaign：先记录候选和证据，再由 V 审查并在人类 checkpoint 精确批准，最后由 S 只执行批准范围、G 运行真实回归、V 复核、G 放行并归档；候选也可以证据化地 `deferred`、`rejected`、`blocked` 或 `rolled-back`，不要求每个候选都发生变更。

**架构：** 新增独立的 campaign 账本、候选包、报告、批准和归档契约，存放在项目 `.w-model/code-health/`，通过 `wm-write.ts` 的已注册 Schema 写入；确定性纯逻辑位于 `w-model-dev/scripts/logic/`，CLI 只负责受控文件/命令 IO，Vitest fixture 驱动 RED/GREEN 与 fail-closed 校验。Phase 1 先以静态 inventory + 受控动态 trace 产出候选，Phase 2-4 分别做 gap/TDD、遗留测试安全删除、重复簇/抽象等价性证明；所有阶段共享 `candidate → evidence → review → human approval → minimal reversible change → real regression/gates → V → G → archive` 生命周期。现有 W-Model 编排者 O 仍只路由、分派、等待 checkpoint 和调用只读脚本；A/S/V/G/R 各司其职，工具或 LLM 不能单独授权。

**技术栈：** TypeScript strict + `tsx` + Node.js 标准库；JSON Schema draft-07 + Ajv/`validateBySchema`；Vitest + `@vitest/coverage-v8`；TypeScript compiler API（AST/符号/调用图提取）；Git CLI 只通过现有 `run-sync.ts`/注入 runner 执行；现有 `safe-json`、`change-scope`、`gate-log-writer`、`signature-chain`、source-bound provenance、`wm-write`、18 项 pre-push、`npm run eval` 全部复用，不新增 LLM runtime、SDK 或网络模型客户端。

**规格来源：** 已批准规格 [`docs/superpowers/specs/2026-09-07-code-health-governance-design.md`](../specs/2026-09-07-code-health-governance-design.md)，commit `416613f`，基线版本 `42.2.1`。

**执行前硬约束：**

- 本计划执行本身只新增/修改计划与本地忽略报告；候选发现、报告、账本和归档属于未来实现阶段的运行时产物，不得在实现前写入当前项目状态。
- Phase 1 的发现 CLI 默认只读；Phase 1 删除、Phase 3 测试删除、Phase 4 抽象迁移都必须先有完整候选包、V 风险审查和人类对精确 `changeScope` 的批准。默认执行器只输出 patch/commit proposal；无批准不得写代码、删文件、抽象或提交。
- O 不执行分析、编码、删除、测试结果解释、自评或 G 回填。失败路径固定为 `R root-cause → V review → G validation → S rework`；新候选、语义变化或 scope 扩展都重新走生命周期。
- 未运行命令为 `not_run`，工具不可用为 `unavailable`，无法绑定 revision 为 `unverified`；任何结果、coverage、trace、签名、时间戳和 gate outcome 不得伪造。coverage 只能作为 gap/影响信号，不能作为删除或授权标准。
- 保持版本 `42.2.1`、L0/L1 边界、脚本自包含、SSoT-first、无 LLM、当前 18 项 pre-push 顺序/exit 语义、现有 `self-test`/security/typecheck/Prettier/docs-consistency/eval 契约不变。阶段 5-8 若实际改动代码或测试文件，必须先用宿主 `codegraph_explore` 查询 callers/callees/blast radius 并落盘 `.w-model/codegraph-queries/`，随后跑现有 `check-codegraph-queries.ts`；本计划不把未索引的当前仓库伪装成已有 codegraph 证据。

---

## 文件结构与职责锁定

以下是计划实施时将创建/修改的全部文件。任务 1 先定义跨任务复用的类型、Schema、状态和函数签名；后续任务不得引入未在任务 1 定义的新接口。

### 新建文件

| 文件                                                            | 职责                                                                                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `w-model-dev/schemas/code-health-campaign.schema.json`          | Campaign 顶层 manifest：campaign ID、基线 revision/环境、candidate IDs、账本/归档索引、redaction 和 append-only 规则。                                                    |
| `w-model-dev/schemas/code-health-ledger-event.schema.json`      | `.w-model/code-health/ledger.jsonl` 单行事件：candidate 状态转移、actor、revision、证据引用和签名引用；仅允许 append。                                                    |
| `w-model-dev/schemas/code-health-candidate.schema.json`         | 单候选包/最终记录：候选 ID、phase/action/status、来源/revision、files/symbols、confidence/risk、RTM/coverage impact、rollback、review、signatures、changeScope、archive。 |
| `w-model-dev/schemas/code-health-evidence.schema.json`          | 证据包：static/dynamic/test/AST/call-graph/RTM/coverage 证据、命令结果、环境、哈希、未知项、误报检查、redaction。                                                         |
| `w-model-dev/schemas/code-health-approval.schema.json`          | 人类 checkpoint 决策：精确 candidate/changeScope、允许的 action、批准/拒绝/延期理由、actor、UTC 时间和签名来源。                                                          |
| `w-model-dev/schemas/code-health-archive.schema.json`           | 终态归档索引：ledger transition、diff/rollback、manifest/content hashes、review/gate/signature refs、redaction/retention。                                                |
| `w-model-dev/schemas/code-health-gap.schema.json`               | Phase 2 gap matrix 行：requirement/public contract/branch/error/security/concurrency/platform 维度、test level、RTM、风险/优先级/owner、RED/GREEN 结果。                  |
| `w-model-dev/schemas/code-health-test-inventory.schema.json`    | Phase 3 测试 inventory、候选冗余证明、protected facts、pre/post 回归和 coverage provenance。                                                                              |
| `w-model-dev/schemas/code-health-duplicate-cluster.schema.json` | Phase 4 重复簇、AST/data-flow/call-graph 证据、至少两个稳定生产调用点、语义等价证明和维护收益。                                                                           |
| `w-model-dev/scripts/logic/code-health-ledger-logic.ts`         | 纯函数：类型别名、ID/状态校验、append-only transition、证据完整性、approval scope、终态/归档校验和 redaction 元数据校验。                                                 |
| `w-model-dev/scripts/logic/code-health-phase1-logic.ts`         | 纯函数：静态引用分类、动态 trace 归一化、false-positive guard、候选差异与 `deadness=unknown` 规则。                                                                       |
| `w-model-dev/scripts/logic/code-health-gap-logic.ts`            | 纯函数：gap matrix 完整性、测试层选择、RED/GREEN result 绑定、RTM/coverage signal 规则。                                                                                  |
| `w-model-dev/scripts/logic/code-health-test-logic.ts`           | 纯函数：测试 inventory、等价/无效证明、protected test 分类、删除前后事实对比和 fail-closed 判定。                                                                         |
| `w-model-dev/scripts/logic/code-health-duplicate-logic.ts`      | 纯函数：AST/data-flow/call-graph cluster、稳定调用点门槛、五类语义等价维度、维护收益和 abstraction guard。                                                                |
| `w-model-dev/scripts/lib/code-health-command.ts`                | 注入式真实命令执行器接口：命令/环境/时间/退出码/raw output hash 的 source-bound 记录；不接受 shell 拼接、模拟结果或 secret 明文。                                         |
| `w-model-dev/scripts/lib/code-health-redaction.ts`              | 与 evidence-export 规则一致的敏感字段、绝对路径、不可安全导出条件和 redaction report。                                                                                    |
| `w-model-dev/scripts/cli/code-health-ledger.ts`                 | `init`/`append`/`validate`/`archive` 入口；只通过 `wm-write` 等价安全写路径更新 `.w-model/code-health/`。                                                                 |
| `w-model-dev/scripts/cli/code-health-phase1.ts`                 | Phase 1 只读 static inventory + dynamic trace + false-positive guard 报告入口。                                                                                           |
| `w-model-dev/scripts/cli/code-health-apply.ts`                  | 受批准候选的 patch/commit proposal 执行入口；默认 dry-run，拒绝无 approval、scope 漂移和未知文件直接删除。                                                                |
| `w-model-dev/scripts/cli/code-health-gap.ts`                    | Phase 2 gap matrix 装载/校验及 approved gap 的 TDD RED/GREEN harness 入口。                                                                                               |
| `w-model-dev/scripts/cli/code-health-tests.ts`                  | Phase 3 测试 inventory、冗余 proof、protected-fact 检查和批准删除/前后回归入口。                                                                                          |
| `w-model-dev/scripts/cli/code-health-duplicates.ts`             | Phase 4 AST/结构/数据流/调用图 cluster、等价报告和 abstraction guard 入口。                                                                                               |
| `w-model-dev/scripts/cli/code-health-archive.ts`                | 汇总终态 candidate/ledger/evidence/review/gate/signature/diff hashes，做 redaction 后归档和 package/source-bound verify。                                                 |
| `w-model-dev/scripts/__tests__/code-health-ledger.test.ts`      | 账本、状态、ID、approval scope、fail-closed 与 redaction 测试。                                                                                                           |
| `w-model-dev/scripts/__tests__/code-health-phase1.test.ts`      | Phase 1 静态/动态/误报 guard 测试。                                                                                                                                       |
| `w-model-dev/scripts/__tests__/code-health-gap.test.ts`         | Phase 2 gap matrix/TDD harness 测试。                                                                                                                                     |
| `w-model-dev/scripts/__tests__/code-health-tests.test.ts`       | Phase 3 inventory/保护/删除门禁测试。                                                                                                                                     |
| `w-model-dev/scripts/__tests__/code-health-duplicates.test.ts`  | Phase 4 cluster/equivalence/abstraction guard 测试。                                                                                                                      |
| `w-model-dev/scripts/__tests__/code-health-cli.test.ts`         | CLI 真实子进程、exit 0/1/2、默认只读/批准绑定和 rollback 行为。                                                                                                           |
| `w-model-dev/scripts/samples/code-health/valid-campaign.json`   | self-test 合法 campaign fixture。                                                                                                                                         |
| `w-model-dev/scripts/samples/code-health/bad-*.json`            | 缺 ID、未知状态、stale revision、缺证据/approval、protected test 删除、少稳定调用点等负向 fixture。                                                                       |
| `w-model-dev/scripts/samples/code-health/phase1/`               | 静态 inventory、动态 trace、false-positive guard 的 valid/blocked/rejected fixture。                                                                                      |
| `w-model-dev/scripts/samples/code-health/phase2/`               | gap matrix 与 RED/GREEN valid/negative fixture。                                                                                                                          |
| `w-model-dev/scripts/samples/code-health/phase3/`               | 测试 inventory、protected facts、pre/post regression fixture。                                                                                                            |
| `w-model-dev/scripts/samples/code-health/phase4/`               | duplicate cluster/equivalence/abstraction guard fixture。                                                                                                                 |

### 修改文件

| 文件                                                      | 职责与修改边界                                                                                                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `w-model-dev/scripts/lib/state-schema-registry.ts`        | 注册 `.w-model/code-health/campaign.json`、`ledger.jsonl` 等实际写入目标及格式；只注册本计划定义的文件。                                           |
| `w-model-dev/scripts/__tests__/schema-validation.test.ts` | 新 Schema 合法/非法结构、字段 description、注册目标和追加式格式测试；不把运行期 fixture-only 文件注册成写目标。                                    |
| `w-model-dev/scripts/__tests__/README.md`                 | 增加五个 code-health 单元测试矩阵行和保护规则说明。                                                                                                |
| `w-model-dev/scripts/samples/README.md`                   | 增加 `code-health` fixture 子目录、self-test 登记和覆盖说明。                                                                                      |
| `w-model-dev/scripts/cli/self-test.ts`                    | 登记 campaign/Phase 1-4 fixture，所有新增 fixture 均有 expected pass/failure 和 reason pattern。                                                   |
| `w-model-dev/scripts/cli/check-docs-consistency.ts`       | 仅在新增 Schema/CLI/reference/eval live fact 被现有检查消费时注入真实内容并更新动态计数，不能绕过检查。                                            |
| `w-model-dev/scripts/logic/docs-consistency-logic.ts`     | 仅在门禁需要 code-health action/schema/reference/资产计数事实时扩展确定性检查；保留既有 `EXPECTED.prePushCount=18` 与当前 action 语义。            |
| `w-model-dev/scripts/cli/check-artifact-gate.ts`          | 仅在批准实现要求阶段门汇总 campaign 证据时接入 code-health summary；不改变 18 项 pre-push 的顺序或退出码。                                         |
| `w-model-dev/scripts/logic/gate-logic.ts`                 | 仅增加独立 code-health gate summary 输入/输出（若实际行为需要），不重解释既有 GateCheckResult。                                                    |
| `.githooks/pre-push`                                      | 仅当最终批准实现确实将 campaign gate 纳入 hook 才修改；默认不修改，且即使修改也逐项保留原 18 项顺序、期望 exit、audit skip 和 platform preflight。 |
| `w-model-dev/references/code-health-governance.md`        | SSoT 同步后的可按需加载方法论：四阶段、候选闭环、保护规则、证据/approval/rollback/失败路径。                                                       |
| `w-model-dev/references/subagent-delegation.md`           | 增加 A/S/V/G/R code-health 变体和 O 边界指针，不复制实现逻辑。                                                                                     |
| `w-model-dev/references/hard-constraints.md`              | 增加禁止未批准候选变更、伪造证据、coverage 授权、忽略 protected facts 的反模式（编号由实施时按现有最大编号连续分配并同步 docs-consistency）。      |
| `w-model-dev/references/command-reference.md`             | 增加 code-health CLI 用法、参数互斥、exit 0/1/2、`not_run/unavailable/unverified`。                                                                |
| `w-model-dev/references/rtm-guide.md`                     | 增加 gap/deletion/abstraction 对 RTM/coverage impact 的回填规则。                                                                                  |
| `w-model-dev/references/coding-quality.md`                | 增加重复簇仅作候选、两稳定生产调用点和等价性/维护收益门槛。                                                                                        |
| `w-model-dev/references/quality-standards.md`             | 增加四阶段验收与 coverage-only 禁止授权。                                                                                                          |
| `w-model-dev/references/operation-behaviors.md`           | 增加 candidate ledger、checkpoint、R→V→G→S 失败路径和真实回归证据行为。                                                                            |
| `w-model-dev/SKILL.md`                                    | 仅新增 `/wm code-health` 路由/按需 reference 指针、O/A/S/V/G/R 边界与 checkpoint；版本保持 `42.2.1`。                                              |
| `docs/skill-design-document_SSoT.md`                      | 按 SSoT-first 写入 campaign policy、四阶段规则、证据 contract、现有 invariants 和集成边界；然后才同步其他活体文档。                                |
| `README.md`                                               | 仅同步真实新增用户可见命令/边界/计数；不把本地 `.w-model` 运行物或未实现的工具写成现状。                                                           |
| `AGENTS.md`                                               | 同步真实目录、脚本、证据边界和 codegraph 前置条件；保留 18 项、42.2.1 和编排者最小化声明。                                                         |
| `CONTRIBUTING.md`                                         | 同步实际贡献流程、TDD、子代理/人类 checkpoint、真实回归和不提交本地 campaign 产物。                                                                |
| `docs/INSTALL.md`                                         | 同步 L0/L1 code-health 能力差异、Node/tsx/devDeps 和外部 codegraph 使用边界。                                                                      |
| `docs/troubleshooting.md`                                 | 增加实际 CLI 的 fail-closed、stale revision、redaction blocked、rollback 和 platform 命令排障。                                                    |
| `CHANGELOG.md`                                            | 仅记录完成的行为变更；不记录仅计划内容。                                                                                                           |
| `eval/w-model-dev-test-prompts.json`                      | 仅当 `/wm code-health` 成为 measured behavior 时添加触发/边界语料。                                                                                |
| `eval/mappings.json`                                      | 仅当 eval 语料实际增加时同步资产锚点和 matrix。                                                                                                    |
| `eval/runner.ts`                                          | 仅当 measured behavior 变化时扩展断言；否则只跑既有 eval。                                                                                         |
| `eval/w-model-dev-results.tsv`                            | 记录真实验证 batch、commit、行为结果和 provenance；不能写“预期通过”作为事实。                                                                      |
| `package.json`                                            | 只有确实需要且已批准的 `scripts` 入口才添加；不增 LLM/网络 runtime 依赖，不 bump `42.2.1`。                                                        |
| `package-lock.json`                                       | 仅 package.json 依赖或脚本行为实际导致 lockfile 变化时同步；无依赖新增时不改。                                                                     |

---

## 统一执行纪律与接口

任务 1 定义以下 TypeScript 合同，后续任务只复用它们：

```ts
export type CodeHealthPhase = 'P1' | 'P2' | 'P3' | 'P4';
export type CodeHealthAction = 'delete-code' | 'add-test' | 'delete-test' | 'abstract';
export type CodeHealthStatus =
  | 'discovered'
  | 'evidenced'
  | 'under-review'
  | 'approved'
  | 'implemented'
  | 'verified'
  | 'archived'
  | 'rejected'
  | 'deferred'
  | 'blocked'
  | 'rolled-back';
export type EvidenceObservationStatus = 'observed' | 'not_run' | 'unavailable' | 'unverified';
export type ReviewDecision = 'approve' | 'reject' | 'defer' | 'block' | 'rollback';

export interface RevisionIdentity {
  commitSha: string;
  treeSha: string;
  sourceBundleSha256: string;
  analyzedAt: string;
}
export interface CommandEvidence {
  command: string;
  cwd: string;
  environment: Record<string, string>;
  platform: string;
  toolVersions: Record<string, string>;
  startedAt: string;
  endedAt: string;
  exitCode: 0 | 1 | 2 | null;
  observation: EvidenceObservationStatus;
  rawOutputPath: string;
  rawOutputSha256: string;
}
export interface RiskProfile {
  severity: 'low' | 'medium' | 'high' | 'critical';
  behavior: 'none' | 'low' | 'medium' | 'high' | 'unknown';
  security: 'none' | 'low' | 'medium' | 'high' | 'unknown';
  concurrency: 'none' | 'low' | 'medium' | 'high' | 'unknown';
  platform: 'none' | 'low' | 'medium' | 'high' | 'unknown';
  lifecycle: 'none' | 'low' | 'medium' | 'high' | 'unknown';
  governance: 'none' | 'low' | 'medium' | 'high' | 'unknown';
  rationale: string;
}
export interface ImpactRecord {
  rtmBefore: string[];
  rtmAfter: string[];
  coverageBefore: {
    statements: number | null;
    branches: number | null;
    functions: number | null;
    lines: number | null;
  };
  coverageAfter: { statements: number | null; branches: number | null; functions: number | null; lines: number | null };
  testLevels: Array<'unit' | 'integration' | 'system' | 'acceptance'>;
  unmappedScenarios: string[];
  coverageIsSignalOnly: true;
}
export interface RollbackPlan {
  preChangeRevision: string;
  command: string;
  patchPath: string;
  owner: string;
  executable: boolean;
}
export interface SignatureRecord {
  role: 'A' | 'S' | 'V' | 'G' | 'R' | 'human';
  actor: string;
  event: string;
  scopeHash: string;
  provenanceRef: string;
  signedAt: string;
}
export interface CodeHealthCandidate {
  candidateId: string;
  phase: CodeHealthPhase;
  action: CodeHealthAction;
  status: CodeHealthStatus;
  files: string[];
  symbols: string[];
  tests: string[];
  callSites: string[];
  sources: string[];
  revision: RevisionIdentity;
  confidence: { level: 'low' | 'medium' | 'high'; score: number; rationale: string; uncertainties: string[] };
  risk: RiskProfile;
  rtmImpact: ImpactRecord;
  coverageImpact: ImpactRecord;
  rollback: RollbackPlan;
  review: {
    findings: string[];
    unresolvedQuestions: string[];
    decision: ReviewDecision | null;
    humanDecision: ReviewDecision | null;
  };
  signatures: SignatureRecord[];
  changeScope: { files: string[]; symbols: string[]; scopeHash: string };
  evidenceRef: string;
  archive: {
    state: 'not_archived' | 'archived';
    manifestPath: string | null;
    contentHash: string | null;
    redactionStatus: 'not_reviewed' | 'clean' | 'blocked';
  };
}
export interface LedgerEvent {
  eventId: string;
  candidateId: string;
  from: CodeHealthStatus | null;
  to: CodeHealthStatus;
  actorRole: 'O' | 'A' | 'S' | 'V' | 'G' | 'R' | 'human';
  at: string;
  revision: RevisionIdentity;
  evidenceRefs: string[];
  signatureRef: string;
}
export interface CodeHealthLedger {
  schemaVersion: '1.0';
  campaignId: string;
  createdAt: string;
  baseline: RevisionIdentity;
  environmentMatrix: Array<{
    platform: string;
    shell: string;
    runtime: string;
    supported: boolean;
    observed: EvidenceObservationStatus;
    reason: string;
  }>;
  candidates: CodeHealthCandidate[];
  events: LedgerEvent[];
  appendOnly: true;
  redaction: { status: 'not_reviewed' | 'clean' | 'blocked'; rules: string[]; blockedReasons: string[] };
}
export interface ApprovalDecision {
  candidateId: string;
  decision: 'approve' | 'reject' | 'defer';
  approvedAction: CodeHealthAction;
  approvedFiles: string[];
  approvedSymbols: string[];
  scopeHash: string;
  rationale: string;
  actor: string;
  decidedAt: string;
  signatureRef: string;
}
export interface CodeHealthCommandRunner {
  run(
    command: string,
    args: string[],
    options: { cwd: string; env: Record<string, string>; timeoutMs: number },
  ): Promise<CommandEvidence>;
}
export function createCodeHealthCommandRunner(options: {
  rawOutputDir: string;
  now?: () => Date;
}): CodeHealthCommandRunner;

export interface StaticReference {
  path: string;
  symbol: string;
  consumer: string;
  kind:
    | 'import'
    | 'export'
    | 'call'
    | 'route'
    | 'cli-registration'
    | 'string-symbol'
    | 'generated-input'
    | 'schema'
    | 'template'
    | 'rtm'
    | 'test-helper'
    | 'dynamic-import'
    | 'reflection'
    | 'shell-platform';
  line: number;
  sourceHash: string;
}
export interface StaticInventoryReport {
  revision: RevisionIdentity;
  files: string[];
  references: StaticReference[];
  categories: string[];
  unknowns: string[];
  commands: CommandEvidence[];
}
export interface DynamicTraceScenario {
  id: string;
  environment: string;
  reached: boolean | null;
  observation: EvidenceObservationStatus;
  command: CommandEvidence;
}
export interface DynamicTraceReport {
  revision: RevisionIdentity;
  scenarios: DynamicTraceScenario[];
  rawTraceSha256: string;
}
export interface Phase1CandidateLead {
  candidateId: string;
  classification: 'candidate' | 'unknown' | 'blocked';
  files: string[];
  symbols: string[];
  staticReferences: StaticReference[];
  dynamicScenarios: DynamicTraceScenario[];
  guardViolations: string[];
  status: 'discovered' | 'blocked';
}
export interface FalsePositiveContext {
  dynamicImports: string[];
  reflection: string[];
  platforms: string[];
  schemas: string[];
  templates: string[];
  rtmIds: string[];
  testHelpers: string[];
  generatedReferences: string[];
  externalContracts: string[];
}
export interface GapRow {
  gapId: string;
  candidateId: string;
  kind: 'requirement' | 'public-contract' | 'branch' | 'error' | 'security' | 'concurrency' | 'platform';
  testLevels: Array<'unit' | 'integration' | 'system' | 'acceptance'>;
  existingTestIds: string[];
  missingScenario: string;
  evidenceSources: string[];
  risk: RiskProfile;
  priority: 'low' | 'medium' | 'high' | 'critical';
  owner: string;
  rtmIds: string[];
  coverageSignal: {
    statements: number | null;
    branches: number | null;
    functions: number | null;
    lines: number | null;
  };
  coverageIsSignalOnly: true;
  status: 'discovered' | 'approved' | 'implemented' | 'verified' | 'blocked';
}
export type ProtectedTestClass =
  | 'unique-negative'
  | 'boundary'
  | 'security'
  | 'concurrency'
  | 'platform'
  | 'migration-rollback'
  | 'pre-push'
  | 'self-test'
  | 'docs-consistency';
export interface TestRecord {
  testId: string;
  file: string;
  symbol: string;
  author: string;
  createdAt: string;
  lastChangedAt: string;
  level: 'unit' | 'integration' | 'system' | 'acceptance';
  setup: string;
  stimulus: string;
  oracle: string;
  failureSensitivity: string;
  rtmIds: string[];
  scenarioClass: string;
  governanceFacts: string[];
}
export interface TestRemovalProofInput {
  candidate: TestRecord;
  survivor: TestRecord | null;
  pre: { testCount: number; coverageProvenance: string; governanceFacts: string[] };
  post: { testCount: number; coverageProvenance: string; governanceFacts: string[] } | null;
}
export interface DuplicateInput {
  implementations: Array<{ file: string; symbol: string; sourceHash: string }>;
  ast: string[];
  dataFlow: string[];
  callGraph: string[];
  tests: string[];
}
export interface DuplicateCluster {
  clusterId: string;
  implementations: Array<{ file: string; symbol: string; sourceHash: string }>;
  views: { ast: string[]; dataFlow: string[]; callGraph: string[]; signatures: string[]; tests: string[] };
  stableProductionCallSites: string[];
  status: 'under-review' | 'deferred' | 'rejected' | 'approved';
}
export interface AbstractionProposal {
  targetApi: string;
  migratedCallSites: string[];
  inputsOutputs: string;
  errorsRetries: string;
  lifecycleResources: string;
  security: string;
  concurrencyPlatforms: string;
  maintenanceBenefit: string;
  rollback: RollbackPlan;
}
export interface Phase1RunResult {
  exitCode: 0 | 1 | 2;
  report: { candidates: CodeHealthCandidate[]; commands: CommandEvidence[]; unexercisedScenarios: string[] };
  changedFiles: string[];
}
export function runPhase1(input: {
  root: string;
  output: string;
  scenarios: DynamicTraceScenario[];
}): Promise<Phase1RunResult>;
export interface GapDiscoveryInput {
  requirements: unknown;
  publicContracts: unknown;
  branches: unknown;
  errors: unknown;
  securityProperties: unknown;
  concurrencyProperties: unknown;
  platforms: unknown;
  coverageSignal: { lines: number | null };
}
export interface GapDiscoveryResult {
  rows: GapRow[];
  coverageAuthorization: false;
}
export function findGaps(input: GapDiscoveryInput): GapDiscoveryResult;
export interface TddHarnessInput {
  gap: GapRow;
  testCommand: string[];
  implementation: string | null;
}
export interface TddHarnessResult extends CommandEvidence {
  gapId: string;
  assertionHash: string;
  implementationHash: string | null;
}
export function runTddHarness(input: TddHarnessInput): Promise<TddHarnessResult>;
export interface ApplyApprovedInput {
  approval: ApprovalDecision;
  candidate: CodeHealthCandidate;
  mode: 'patch' | 'commit' | 'dry-run';
}
export interface ApplyResult {
  patchPath: string;
  applied: boolean;
  appliedFiles: string[];
  unrelatedFiles: string[];
  rollback: RollbackPlan;
}
export function applyApproved(input: ApplyApprovedInput): Promise<ApplyResult>;
export function executeRollback(rollback: RollbackPlan): Promise<boolean>;
export interface DeletionFacts {
  testCount: number;
  coverageProvenance: string;
  governanceFacts: string[];
  testCountDelta?: number;
}
export interface DeletionEvaluation {
  passed: boolean;
  violations: string[];
}
export function evaluateDeletion(facts: DeletionFacts): DeletionEvaluation;
export interface ArchiveResult {
  exitCode: 0 | 1 | 2;
  path: string;
  manifest: { files: Array<{ path: string }> };
  verificationLevel: 'package-only' | 'source-bound';
  reason?: string;
}
export function archiveCampaign(campaign: CodeHealthLedger): Promise<ArchiveResult>;
export function verifyArchive(
  path: string,
): Promise<{ ok: boolean; verificationLevel: 'package-only' | 'source-bound' }>;
export function recordGateFailure(ledger: CodeHealthLedger, evidence: CommandEvidence): CodeHealthLedger;
export function nextRequiredRoles(ledger: CodeHealthLedger): Array<'R' | 'V' | 'G' | 'S'>;
export interface EvalDiffInput {
  changedBehavior: boolean;
  prompts: unknown[];
  mappings: unknown;
}
export function validateEvalDiff(input: EvalDiffInput): string[];

export function validateCodeHealthCandidate(candidate: unknown): string[];
export function transitionCandidate(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
): CodeHealthLedger;
export function validateApprovalScope(candidate: CodeHealthCandidate, approval: ApprovalDecision): string[];
export function canArchiveCandidate(candidate: CodeHealthCandidate, ledger: CodeHealthLedger): string[];
export function redactCodeHealthArtifact(value: unknown): {
  value?: unknown;
  status: 'clean' | 'blocked';
  reasons: string[];
};
export function buildStaticInventory(input: {
  files: string[];
  sourceText: Map<string, string>;
  revision: RevisionIdentity;
}): StaticInventoryReport;
export function mergeDynamicTrace(
  staticReport: StaticInventoryReport,
  trace: DynamicTraceReport,
): Phase1CandidateLead[];
export function checkFalsePositiveGuards(lead: Phase1CandidateLead, context: FalsePositiveContext): string[];
export function validateGapMatrix(matrix: unknown): string[];
export function validateRedGreenEvidence(gap: GapRow, results: CommandEvidence[]): string[];
export function classifyProtectedTest(test: TestRecord): ProtectedTestClass | null;
export function proveTestRemoval(input: TestRemovalProofInput): string[];
export function clusterDuplicates(input: DuplicateInput): DuplicateCluster[];
export function proveAbstraction(cluster: DuplicateCluster, proposal: AbstractionProposal): string[];
```

The interfaces above are the only cross-task API. `StaticInventoryReport`, `DynamicTraceReport`, `Phase1CandidateLead`, `FalsePositiveContext`, `GapRow`, `TestRecord`, `ProtectedTestClass`, `TestRemovalProofInput`, `DuplicateInput`, `DuplicateCluster`, and `AbstractionProposal` are defined in task 1 with exact fields and Schema definitions before any later task consumes them.

## 共享生命周期验收

Every Phase 1-4 candidate must use this sequence, recorded as ledger events and signatures:

1. A assigns a never-reused ID such as `CHG-P1-20260907-001` and records discovery only; discovery is never a conclusion.
2. A/S assemble source-bound evidence with revision, environment, exact command, tool versions, UTC start/end, exit code, raw-output path/hash, unknown/unavailable observations, false-positive checks, RTM/coverage impact, and redaction result.
3. V independently reviews classification, dynamic/generated/string references, shell/platform/schema/template/RTM references, scope, lifecycle/security/concurrency/platform assumptions, rollback and unresolved questions; material ambiguity is fail-closed.
4. O pauses at the human checkpoint; the human decision names candidate ID, action, exact files/symbols/call sites and scope hash. Tool/LLM output alone cannot authorize anything.
5. S makes only the smallest approved reversible change. Default `code-health-apply` generates a patch/commit proposal; it never deletes unknown files or applies without the approval artifact.
6. G runs real affected and full regression, applicable W-Model gates, security/typecheck/Prettier/docs-consistency/self-test/eval and, for stage 5-8 code/test changes, codegraph query coverage. G records actual exit codes and hashes.
7. V reviews actual diff and outputs; G independently confirms gate outcomes. Any failure/ambiguity enters `R → V → G → S`; no silent scope expansion.
8. `code-health-archive` marks `archived` only after approval, real gates, V review and G confirmation; it preserves rejected/deferred/blocked/rolled-back terminal records and refuses incomplete/redaction-unsafe export.

---

### 任务 1：账本/证据契约与最小校验（TDD）

**目的：** 先锁定全部跨任务 schema、类型、状态机、命令证据和 redaction 契约，使后续任务不凭空假设接口。

**文件：**

- 创建：`w-model-dev/schemas/code-health-campaign.schema.json`、`code-health-ledger-event.schema.json`、`code-health-candidate.schema.json`、`code-health-evidence.schema.json`、`code-health-approval.schema.json`、`code-health-archive.schema.json`、`code-health-gap.schema.json`、`code-health-test-inventory.schema.json`、`code-health-duplicate-cluster.schema.json`。
- 创建：`w-model-dev/scripts/logic/code-health-ledger-logic.ts`、`w-model-dev/scripts/lib/code-health-command.ts`、`w-model-dev/scripts/lib/code-health-redaction.ts`。
- 修改：`w-model-dev/scripts/lib/state-schema-registry.ts`、`w-model-dev/scripts/__tests__/schema-validation.test.ts`、`w-model-dev/scripts/__tests__/README.md`、`w-model-dev/scripts/samples/README.md`。
- 测试：`w-model-dev/scripts/__tests__/code-health-ledger.test.ts`、`w-model-dev/scripts/samples/code-health/valid-campaign.json`、对应 `bad-*.json`。

- [ ] **步骤 1：写失败测试**

在 `code-health-ledger.test.ts` 先加入以下可执行契约测试；测试导入任务 1 约定的函数和类型，并以最小对象构造完整候选：

```ts
it('合法候选包含完整 evidence/impact/rollback/review/signature/archive 字段并可从 discovered 转 evidenced', () => {
  const candidate = validCandidate('CHG-P1-20260907-001');
  expect(validateCodeHealthCandidate(candidate)).toEqual([]);
  const ledger = validLedger(candidate);
  const next = transitionCandidate(ledger, candidate.candidateId, event('discovered', 'evidenced'));
  expect(next.candidates[0]?.status).toBe('evidenced');
});

it('发现记录不能伪装为结论，未知动态加载和缺失环境 fail-closed', () => {
  const candidate = validCandidate('CHG-P1-20260907-002', {
    status: 'discovered',
    confidence: { level: 'high', score: 0.99, rationale: 'no grep hit', uncertainties: ['dynamic import'] },
  });
  expect(validateCodeHealthCandidate(candidate)).toEqual([]);
  expect(canArchiveCandidate(candidate, validLedger(candidate))).toContain('candidate is not verified');
});

it('不合法状态跳转、scope 扩展、伪造命令结果和不安全 redaction 都被拒绝', () => {
  const candidate = validCandidate('CHG-P3-20260907-003');
  expect(() =>
    transitionCandidate(validLedger(candidate), candidate.candidateId, event('discovered', 'archived')),
  ).toThrow(/transition/);
  expect(
    validateApprovalScope(candidate, {
      ...validApproval(candidate),
      approvedFiles: ['unknown.ts'],
      scopeHash: 'sha256:wrong',
    }),
  ).not.toEqual([]);
  expect(redactCodeHealthArtifact({ password: 'x', absolute: 'C:\\secret\\file' }).status).toBe('clean');
  expect(redactCodeHealthArtifact({ payload: '\u0000binary-secret' }).status).toBe('blocked');
});

it('command runner 契约保留真实 exitCode/unknown 状态和 raw output hash，禁止 shell 拼接', async () => {
  const runner = createCodeHealthCommandRunner({ rawOutputDir: path.join(repoRoot, '.tmp-code-health-output') });
  const result = await runner.run(process.execPath, ['--version'], { cwd: repoRoot, env: {}, timeoutMs: 5000 });
  expect(result.command).toContain('--version');
  expect(result.exitCode).toBe(0);
  expect(result.observation).toBe('observed');
  expect(result.rawOutputSha256).toMatch(/^[0-9a-f]{64}$/);
  await expect(
    runner.run('node -e "process.exit(0)"', [], { cwd: repoRoot, env: {}, timeoutMs: 5000 }),
  ).rejects.toThrow(/argv/);
});
```

测试辅助函数 `validCandidate`, `validLedger`, `event`, `validApproval` 也在本任务测试文件内完整定义，字段值来自任务 1 Schema，不依赖后续任务。

- [ ] **步骤 2：运行命令并确认 RED**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/schema-validation.test.ts -t "code-health"
```

预期：RED，`code-health-ledger-logic.ts`、`code-health-command.ts` 和九个 Schema 尚不存在；Vitest 报模块无法解析或 `validateBySchema('code-health-candidate', ...)` 返回未注册。

- [ ] **步骤 3：最小实现和证据产物**

1. 按任务 1 的接口定义九个 draft-07 Schema，所有含 `properties` 的封闭对象都有 `description` 和 `additionalProperties:false`；`environment`、`toolVersions` 等 map 字段使用 `additionalProperties:{"type":"string"}` 并为字段本身提供 description。对 `candidateId` 使用 `^CHG-P[1-4]-[0-9]{8}-[0-9]{3,}$`，status/action/phase 使用固定 enum；`commands` 的 `exitCode` 允许 `null` 但必须同时有 `observation`；所有绝对路径/敏感字段只能进入受控 raw output，候选和 manifest 只存 repo-relative 路径。
2. `code-health-ledger-logic.ts` 实现完整状态图：`discovered→evidenced→under-review→approved→implemented→verified→archived`；`under-review→rejected|deferred|blocked`；任何失败可到 `blocked`，只有真实 rollback 证据可到 `rolled-back`；拒绝 `discovered→archived`、跳过 human approval、`coverageAfter` 缺失和 `not_run` 充当 pass。实现 `validateCodeHealthCandidate`, `transitionCandidate`, `validateApprovalScope`, `canArchiveCandidate` 和 `redactCodeHealthArtifact` 的精确签名。
3. `code-health-command.ts` 只接受 `command` + `args[]`，经 `spawn`/`execFile` 等价无 shell API 执行；记录 UTC 时间、cwd/environment（先脱敏）、platform、tool versions、exit code、raw output file/hash，命令未执行/不可用分别写 `not_run`/`unavailable`，不能接受字符串 shell pipeline 或调用 LLM。
4. `state-schema-registry.ts` 注册全部固定运行期目标：`.w-model/code-health/campaign.json` 使用 `code-health-campaign`，以及 `candidates.jsonl`/`evidence.jsonl`/`approvals.jsonl`/`archive.jsonl`/`gaps.jsonl`/`test-inventory.jsonl`/`duplicate-clusters.jsonl`/`ledger.jsonl` 分别使用对应九个 code-health Schema；每行 JSONL 只接受该文件的 Schema，写入仍走 `wm-write` 的 lock/mtime/backup/tmp+rename/readback/atomic recovery，不直接 `fs.writeFile`。当前 25 份 Schema 加入本任务 9 份后实测为 34；更新测试断言和 docs-consistency 的动态事实，不手改静态计数。
5. 写 `valid-campaign.json` 与至少 8 个负样本：缺 candidate ID、候选充当结论、无 command hash、stale revision、approval scope mismatch、protected omission、missing archive redaction、unavailable environment 当 pass。self-test 注册项必须明确 `expectedPassed` 与失败 pattern，且不能把发现样本当结论样本。

- [ ] **步骤 4：通过验证**

运行：

```bash
npx prettier --check --config config/prettier.config.cjs w-model-dev/scripts/logic/code-health-ledger-logic.ts w-model-dev/scripts/lib/code-health-command.ts w-model-dev/scripts/lib/code-health-redaction.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts w-model-dev/schemas/code-health-*.schema.json
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts
npx tsc -p config/tsconfig.json --noEmit
npm run lint:security
```

预期：新增 ledger 测试和 schema 测试全部 PASS；`tsc` 0 错误；security scan 0 新增。随后在临时目录 `C:\\Temp\\code-health-fixture` 验证 `npx tsx w-model-dev/scripts/cli/wm-write.ts C:\\Temp\\code-health-fixture\\.w-model\\code-health\\campaign.json --from w-model-dev/scripts/samples/code-health/valid-campaign.json` 的 schema 注册、锁、回读和重复写拒绝，目标工作区不改动。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/schemas/code-health-*.schema.json w-model-dev/scripts/logic/code-health-ledger-logic.ts w-model-dev/scripts/lib/code-health-command.ts w-model-dev/scripts/lib/code-health-redaction.ts w-model-dev/scripts/lib/state-schema-registry.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts w-model-dev/scripts/__tests__/README.md w-model-dev/scripts/samples/code-health w-model-dev/scripts/samples/README.md
git commit --no-gpg-sign -m "feat(code-health): define campaign ledger and evidence contracts"
```

暂停/回滚：若 schema 字段无法同时满足现有 `wm-write`/source-bound 规则，暂停在人类 checkpoint；只允许回滚本任务 commit，不得删除或改写既有 `.w-model` 状态。

---

### 任务 2：Phase 1 静态 inventory + 动态 trace + false-positive guard

**目的：** 只读发现死代码候选；静态“无引用”、coverage 低或单环境未触达都只产生 lead，不产生 deadness 结论。

**文件：**

- 创建：`w-model-dev/scripts/logic/code-health-phase1-logic.ts`、`w-model-dev/scripts/cli/code-health-phase1.ts`、`w-model-dev/scripts/__tests__/code-health-phase1.test.ts`。
- 创建：`w-model-dev/scripts/samples/code-health/phase1/{static,dynamic,guards}/` valid/blocked fixtures。
- 修改：`w-model-dev/scripts/cli/self-test.ts`、`w-model-dev/scripts/samples/README.md`。

- [ ] **步骤 1：写失败测试**

在 `code-health-phase1.test.ts` 加入：

```ts
it('static inventory 记录直接/间接引用、export/import、route/CLI registration、generated/schema/template/RTM 和 test helper', () => {
  const report = buildStaticInventory({
    files: ['src/plugin.ts', 'src/cli.ts', 'schema.json', 'template.md', 'tests/setup.ts'],
    sourceText: fixtureSources,
    revision,
  });
  expect(report.categories).toEqual(
    expect.arrayContaining([
      'dynamic-import',
      'reflection',
      'shell-platform',
      'schema-template-rtm',
      'test-only-helper',
    ]),
  );
  expect(report.references.some((r) => r.kind === 'string-symbol' && r.path === 'src/plugin.ts')).toBe(true);
});

it('静态无命中 + dynamic import/reflection 或未执行平台时只能是 unknown/blocked', () => {
  const lead = mergeDynamicTrace(staticReport, {
    revision,
    scenarios: [{ id: 'smoke-win', environment: 'win32-git-bash', reached: false, observation: 'unavailable' }],
    rawTraceSha256: hash,
  });
  expect(
    checkFalsePositiveGuards(lead[0]!, {
      dynamicImports: ['src/plugin.ts'],
      reflection: ['PluginRegistry'],
      platforms: ['win32', 'linux'],
      schemas: ['schema.json'],
      templates: ['template.md'],
      rtmIds: ['REQ-1'],
      testHelpers: ['tests/setup.ts'],
      generatedReferences: [],
      externalContracts: [],
    }),
  ).not.toEqual([]);
  expect(lead[0]?.classification).toBe('unknown');
});

it('命令入口默认只读，报告包含候选 ID、revision、environment、commands、exit codes、hashes 和未执行场景', async () => {
  const result = await runPhase1({ root: repoRoot, output: tempReport, scenarios: scenarioMatrix });
  expect(result.exitCode).toBe(0);
  expect(result.report.candidates.every((c) => c.status === 'discovered')).toBe(true);
  expect(result.report.commands.every((c) => c.observation !== 'unverified')).toBe(true);
  expect(result.report.unexercisedScenarios.length).toBeGreaterThan(0);
  expect(result.changedFiles).toEqual([]);
});
```

fixture 明确覆盖 `import()`、plugin registry/DI/reflection/decorator metadata、string-to-symbol、filesystem discovery、config-selected handler、`process.platform`/env/executable/path/line-ending、Shell/PowerShell、schema field/template placeholder/serialized field/migration/RTM/graph IDs、fixtures/setup/custom matcher/mock adapter/fake clock/sample builder。

- [ ] **步骤 2：运行命令并确认 RED**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-phase1.test.ts
```

预期：RED，`buildStaticInventory`/`mergeDynamicTrace`/`checkFalsePositiveGuards`/`runPhase1` 未定义或模块缺失；确认不会通过空报告误判。

- [ ] **步骤 3：最小实现和证据产物**

1. `buildStaticInventory(input)` 使用 TypeScript compiler API 读取受控 repo-relative files，产出 `StaticInventoryReport`：每个 symbol/reference 含 defining file、consumer、kind、line、export/import/reachability、source hash；加入 AST 引用、normalized string symbol、route/CLI registration、generated-file input、fixture/RTM/schema/template 证据。若源文件不可读，报告 `unavailable` 并将 lead blocked。
2. `mergeDynamicTrace` 只归一化由 `CodeHealthCommandRunner` 真实执行的 scenario traces；每个环境/场景记录 reached/not reached/unknown、command/exit/output hash。缺失支持环境是 blocker，不是 deadness 证据。coverage 只写 `coverageIsSignalOnly:true`。
3. `checkFalsePositiveGuards` 对动态 import/reflection、Shell/platform、schema/template/RTM、generated/external/plugin/deployment、test-only helper 任何未解析项产出 guard violation；报告中 `classification: 'unknown'` 或 `blocked`，绝不生成 `dead` 结论。
4. `code-health-phase1.ts` 入口接受 `--root C:\\Temp\\code-health-source`、`--output C:\\Temp\\code-health-phase1-report.json`、`--scenario w-model-dev/scripts/samples/code-health/phase1/dynamic/valid.json`、`--platform win32`、`--shell git-bash`，拒绝 `--delete`/`--apply` 未知 flags，走 exit 2；只读报告包含 stable ID、sources、revision/tree/source hash、environment matrix、命令 exit code/hash、false-positive guard、`unexercisedScenarios` 和候选状态 `discovered`。输出前调用 `validateCodeHealthCandidate`，失败 exit 1。
5. self-test 添加静态、动态、blocked、guard fixture，`check-samples-coverage.ts` 必须能发现所有 fixture 均已登记。

- [ ] **步骤 4：通过验证**

```bash
npx prettier --check w-model-dev/scripts/logic/code-health-phase1-logic.ts w-model-dev/scripts/cli/code-health-phase1.ts w-model-dev/scripts/__tests__/code-health-phase1.test.ts
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-phase1.test.ts
npm run self-test
npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts
npx tsx w-model-dev/scripts/cli/code-health-phase1.ts --root . --output C:\\Temp\\code-health-phase1-report.json --scenario w-model-dev/scripts/samples/code-health/phase1/dynamic/valid.json
```

预期：聚焦测试、自检、samples coverage 全 PASS；Phase 1 CLI exit 0 且 `changedFiles=[]`；运行 `git status --short` 不出现报告或源码变更。删除/修改 flags 运行 exit 2，并输出 `ERROR_JSON`，不产生报告。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/logic/code-health-phase1-logic.ts w-model-dev/scripts/cli/code-health-phase1.ts w-model-dev/scripts/__tests__/code-health-phase1.test.ts w-model-dev/scripts/samples/code-health/phase1 w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/samples/README.md
git commit --no-gpg-sign -m "feat(code-health): add read-only phase1 static and dynamic discovery"
```

暂停/回滚：若任一支持环境无法运行、动态/生成引用冲突或 output redaction 不安全，候选保留 `blocked`/`deferred`；不得改用 grep、coverage 或 LLM 结论替代。回滚只删除本任务新增代码，不删除运行期报告。

---

### 任务 3：Phase 1 候选审查与删除执行器

**目的：** 把 Phase 1 lead 变成可审查候选，并提供默认 patch/commit proposal 的最小可回滚执行器；没有人类批准绝不删除未知文件。

**文件：**

- 创建：`w-model-dev/scripts/cli/code-health-ledger.ts`、`w-model-dev/scripts/cli/code-health-apply.ts`、`w-model-dev/scripts/__tests__/code-health-cli.test.ts`。
- 修改：`w-model-dev/scripts/logic/code-health-ledger-logic.ts`、`w-model-dev/scripts/samples/code-health/`。

- [ ] **步骤 1：写失败测试**

```ts
it('无 approval 或 approval scope 与 candidate 不一致时，apply 只输出 proposal 且工作树不变', async () => {
  const before = await gitStatus(repoRoot);
  const result = await runCli('code-health-apply.ts', ['--candidate', candidatePath, '--mode', 'apply']);
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toContain('HUMAN_APPROVAL_REQUIRED');
  expect(await gitStatus(repoRoot)).toEqual(before);
});

it('人类批准只允许精确 files/symbols/scopeHash，未知文件、范围扩展和删除目录均 fail-closed', async () => {
  const result = await applyApproved({ approval: validApproval(candidate), candidate, mode: 'patch' });
  expect(result.patchPath).toMatch(/\.patch$/);
  expect(result.applied).toBe(false);
  expect(result.rollback.executable).toBe(true);
  await expect(
    applyApproved({
      approval: { ...validApproval(candidate), approvedFiles: ['unknown.ts'] },
      candidate,
      mode: 'commit',
    }),
  ).rejects.toThrow(/scope/);
});

it('批准后最小删除只触及 exact candidate scope，真实回读与 rollback 可执行', async () => {
  const result = await applyApproved({ approval: validApproval(candidate), candidate, mode: 'commit' });
  expect(result.appliedFiles).toEqual(candidate.changeScope.files);
  expect(result.unrelatedFiles).toEqual([]);
  expect(await executeRollback(result.rollback)).toBe(true);
});
```

- [ ] **步骤 2：运行命令并确认 RED**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-cli.test.ts
```

预期：RED，`code-health-apply.ts`/`code-health-ledger.ts` 不存在或无 approval/scope guard；确认未批准 apply 测试当前不能误报 PASS。

- [ ] **步骤 3：最小实现和证据产物**

1. `code-health-ledger.ts` 实现 `init`/`append`/`validate`：初始化 campaign baseline/环境矩阵；append 只允许合法状态 transition、monotonic UTC event、未复用 candidate/event ID；修改已归档候选、覆盖既有 ledger line、缺 hash 或把 candidate 当 conclusion 均 exit 1。
2. `code-health-apply.ts` 实现 `--candidate C:\\Temp\\code-health-candidate.json --approval C:\\Temp\\code-health-approval.json --mode=patch|commit|dry-run`，值 flag 重复/空值/未知 mode exit 2。默认 `dry-run` 和缺 approval 都不改工作树；`patch` 只产生受控 patch 和 commit proposal；`commit` 先验证 human approval、revision、exact `changeScope`，再调用 `git apply --check`/`git apply` 或安全的 `git rm --`，禁止 shell 字符串拼接、目录递归删除、未知文件、格式化/重命名/依赖混入。
3. approval 由 `validateApprovalScope` 与 candidate `scopeHash`、pre-change revision、action、files、symbols、call sites 精确绑定；人类 decision 不是 O/S/V/G 代签，工具/LLM 输出不能充当 `human` signature。
4. apply 前后记录 `RollbackPlan`：pre-change revision、exact revert/patch command、patch hash、owner；真实回读 scope 与 status。任何写失败保留 `rolled-back` 或 `blocked` 证据，不声称 applied。
5. 测试 fixture 保护 Phase 1 dynamic import、shell/platform、schema/template/RTM 和 test helper 的候选默认不可删除；self-test 注册 approval-required、scope mismatch、valid patch、rollback failure 四态。

- [ ] **步骤 4：通过验证**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-cli.test.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts
npx tsc -p config/tsconfig.json --noEmit
npm run self-test
npm run lint:security
```

预期：全部 PASS；未批准/范围漂移 exit 1 且工作树无变更；`--mode=bad`、重复 flag、缺值 exit 2；批准 fixture 只在隔离 temp repo 生成 patch，提交后真实 rollback 使 `git diff --exit-code` 通过。不得在仓库当前工作树执行真实删除。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/cli/code-health-ledger.ts w-model-dev/scripts/cli/code-health-apply.ts w-model-dev/scripts/__tests__/code-health-cli.test.ts w-model-dev/scripts/logic/code-health-ledger-logic.ts w-model-dev/scripts/samples/code-health
 git commit --no-gpg-sign -m "feat(code-health): gate phase1 changes by approval and rollback"
```

暂停/回滚：任何删除候选需单独人类 checkpoint；若使用 `git rm` 的边界在 Windows/Unix 不一致，暂停并保留 patch proposal，不能自动选择另一删除方式。

---

### 任务 4：Phase 2 gap matrix + TDD RED/GREEN harness

**目的：** 用需求/公开契约/分支/错误/安全/并发/平台全维度 gap matrix 驱动真实测试补齐；coverage 仅作信号。

**文件：**

- 创建：`w-model-dev/scripts/logic/code-health-gap-logic.ts`、`w-model-dev/scripts/cli/code-health-gap.ts`、`w-model-dev/scripts/__tests__/code-health-gap.test.ts`。
- 创建：`w-model-dev/scripts/samples/code-health/phase2/` valid/negative fixtures。
- 修改：`w-model-dev/scripts/cli/self-test.ts`、`w-model-dev/scripts/samples/README.md`。

- [ ] **步骤 1：写失败测试**

```ts
it('gap matrix 每一行含维度、test levels、existing IDs、missing scenario、risk、priority、owner 和 RTM', () => {
  const errors = validateGapMatrix(validGapMatrix);
  expect(errors).toEqual([]);
  expect(
    validateGapMatrix({ ...validGapMatrix, rows: [{ kind: 'security', missingScenario: 'auth bypass' }] }),
  ).toContain('testLevels');
});

it('七维度缺口被完整发现，不能以 coverage 百分比替代 requirement/error/security/concurrency/platform', () => {
  const result = findGaps({
    requirements,
    publicContracts,
    branches,
    errors,
    securityProperties,
    concurrencyProperties,
    platforms,
    coverageSignal: { lines: 100 },
  });
  expect(result.rows.map((r) => r.kind)).toEqual(
    expect.arrayContaining([
      'requirement',
      'public-contract',
      'branch',
      'error',
      'security',
      'concurrency',
      'platform',
    ]),
  );
  expect(result.coverageAuthorization).toBe(false);
});

it('RED 必须是真实非预期通过，GREEN 绑定同一 gap/RTM 且不能通过削弱 assertion', async () => {
  const red = await runTddHarness({
    gap: approvedGap,
    testCommand: ['npm', 'test', '--', 'gap-id'],
    implementation: null,
  });
  expect(red.observation).toBe('observed');
  expect(red.exitCode).toBe(1);
  expect(validateRedGreenEvidence(approvedGap, [red])).toContain('GREEN evidence required');
  const green = await runTddHarness({
    gap: approvedGap,
    testCommand: ['npm', 'test', '--', 'gap-id'],
    implementation: approvedImplementation,
  });
  expect(validateRedGreenEvidence(approvedGap, [red, green])).toEqual([]);
  expect(green.exitCode).toBe(0);
});
```

- [ ] **步骤 2：运行命令并确认 RED**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-gap.test.ts
```

预期：RED，gap logic/harness 未定义；必须看到缺失七维度、coverage-only 和 GREEN 缺失被拦截，而不是把 fixture 直接记为通过。

- [ ] **步骤 3：最小实现和证据产物**

1. 定义 `GapRow` 精确字段：`gapId`, `candidateId`, `kind`（requirement/public-contract/branch/error/security/concurrency/platform）, `testLevels`, `existingTestIds`, `missingScenario`, `evidenceSources`, `risk`, `priority`, `owner`, `rtmIds`, `coverageSignal`, `status`；matrix 还记录 active requirements、public paths/params/status/response fields、default/alternate/boundary/retry/exception branches、invalid/missing/dependency failure/timeout/partial/recovery errors、authz/validation/injection/secrets/redaction/abuse controls、races/locks/retry/idempotency/ordering/atomicity/stale resource、OS/shell/runtime/path/line ending/executable/env。
2. `validateGapMatrix` 逐行 Schema + 语义校验，任何缺维度/owner/RTM/evidence 或用 `coverage=100` 代替 executable assertion fail-closed；`coverageIsSignalOnly:true` 永远固定。
3. `code-health-gap.ts` 只读生成 matrix；批准 gap 后 `runTddHarness` 接受精确 test/implementation argv，不接受 shell string；RED 真实运行且预期 exit 1，失败理由必须与 missing behavior 相符；GREEN 必须同一 gap、exit 0、原 assertion 未弱化，发现产品 defect 则停止并创建独立 candidate，不扩大 scope。
4. 每个新增测试写入 level/scenario class/result/RTM mapping/command hash，按 unit→integration→system→acceptance 选择受影响层级；coverage 前后事实来自同次受控运行，不能手填。
5. self-test 加 valid matrix、缺 security/platform、coverage-only、RED-not-fail、GREEN-weakening、unknown command fixtures。

- [ ] **步骤 4：通过验证**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-gap.test.ts
npx tsx w-model-dev/scripts/cli/code-health-gap.ts --matrix w-model-dev/scripts/samples/code-health/phase2/valid-gap.json --validate
npm run self-test
npx tsc -p config/tsconfig.json --noEmit
```

预期：聚焦 tests、CLI valid matrix、自检、tsc 全 PASS；每个 negative fixture exit 1 或结构错误 exit 2；隔离 harness 的 RED 输出真实 exit 1，GREEN 真实 exit 0，命令/输出 hash 均能在 evidence 中回读。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/logic/code-health-gap-logic.ts w-model-dev/scripts/cli/code-health-gap.ts w-model-dev/scripts/__tests__/code-health-gap.test.ts w-model-dev/scripts/samples/code-health/phase2 w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/samples/README.md
 git commit --no-gpg-sign -m "feat(code-health): add phase2 gap matrix and real tdd harness"
```

暂停/回滚：RED 未按预期失败、GREEN 需弱化断言、或发现 scope 外产品 defect 时停止，记录 blocked candidate，走 `R→V→G→S`，不把 defect 偷塞入当前 gap。

---

### 任务 5：Phase 3 测试 inventory、冗余 proof 与 guarded deletion

**目的：** 评估老模型/人工遗留测试，但不以作者、年龄、名称、间接性、困难程度或低 coverage 为删除理由；保护唯一负向/边界/安全/并发/平台和 governance facts。

**文件：**

- 创建：`w-model-dev/scripts/logic/code-health-test-logic.ts`、`w-model-dev/scripts/cli/code-health-tests.ts`、`w-model-dev/scripts/__tests__/code-health-tests.test.ts`。
- 创建：`w-model-dev/scripts/samples/code-health/phase3/` valid/negative fixtures。
- 修改：`w-model-dev/scripts/cli/code-health-apply.ts`、`w-model-dev/scripts/cli/self-test.ts`、`w-model-dev/scripts/samples/README.md`。

- [ ] **步骤 1：写失败测试**

```ts
it('作者/年龄/old-model provenance 不能构成删除理由，protected 唯一测试必须保留', () => {
  expect(
    classifyProtectedTest({
      testId: 't-old',
      author: 'human',
      ageDays: 3000,
      asserted: 'malformed input',
      level: 'unit',
    }),
  ).toBe('unique-negative');
  expect(proveTestRemoval({ candidate: oldHumanTest, survivor: null, pre: passingFacts, post: null })).toContain(
    'protected',
  );
});

it('声称 redundant 必须证明 setup/stimulus/oracle/failure sensitivity/level 等价，并 rehome RTM/docs facts', () => {
  expect(
    proveTestRemoval({
      candidate: redundantTest,
      survivor: equivalentTest,
      pre: passingFacts,
      post: passingFactsAfter,
    }),
  ).toEqual([]);
  expect(
    proveTestRemoval({
      candidate: redundantTest,
      survivor: { ...equivalentTest, oracle: 'weaker' },
      pre: passingFacts,
      post: passingFactsAfter,
    }),
  ).toContain('oracle');
});

it('pre/post 真实回归、test count、coverage provenance、18 项 gate order、self-test/docs-consistency facts 任一 unexplained 即阻塞', () => {
  const result = evaluateDeletion({ ...passingFactsAfter, testCountDelta: -1, governanceFacts: { prePushCount: 17 } });
  expect(result.passed).toBe(false);
  expect(result.violations).toEqual(expect.arrayContaining([expect.stringMatching(/test count|pre-push/)]));
});
```

- [ ] **步骤 2：运行命令并确认 RED**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-tests.test.ts
```

预期：RED，保护分类/冗余 proof/evaluateDeletion 未定义或会错误接受作者/年龄/低 coverage 删除。

- [ ] **步骤 3：最小实现和证据产物**

1. `TestRecord` 精确记录 testId/file/symbol/author/createdAt/lastChangedAt/level/setup/stimulus/oracle/failureSensitivity/rtmIds/scenarioClass/governanceFacts。`classifyProtectedTest` 返回 `unique-negative`, `boundary`, `security`, `concurrency`, `platform`, `migration-rollback`, `pre-push`, `self-test`, `docs-consistency` 或 null；author/age 只进入 provenance。
2. `proveTestRemoval` 在 active contract/requirements/platform/security/lifecycle 仍需要且没有 independently verified equivalent survivor 时 fail；redundant 必须比较 setup、stimulus、oracle、failure sensitivity、level，并记录 RTM/coverage/docs-consistency/sample matrix rehome；保留唯一 malformed/missing/expected-failure、empty/zero/min/max/overflow/truncation/off-by-one、auth/authz/injection/secret/redaction/privilege、lock/race/retry/idempotency/ordering/atomic recovery、Windows/Git Bash/PowerShell/Linux、migration/rollback。
3. `code-health-tests.ts` 先跑真实 pre-deletion suite，再要求 human approval，再由 `code-health-apply` 只删除 exact approved tests；删除后跑真实 post-change suite，重算 coverage 和 test/provenance facts；任何 test count、fixture reachability、coverage provenance、18-item gate count/order、self-test 或 docs-consistency 变化未解释即 exit 1。
4. 明确保护现有 `pre-push` 18 项顺序/exit 语义、L0/L1、`self-test` sample-to-check、`docs-consistency` live counts/registries/schema descriptions/action/target/provenance facts；不得因“间接”“旧”“human authored”删除。
5. self-test 加唯一保护、等价 survivor、作者年龄诱导、pre/post regression fail、governance facts drift fixtures。

- [ ] **步骤 4：通过验证**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-tests.test.ts w-model-dev/scripts/__tests__/code-health-cli.test.ts
npx tsx w-model-dev/scripts/cli/code-health-tests.ts --inventory w-model-dev/scripts/samples/code-health/phase3/valid-inventory.json --validate
npm run self-test
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts
npx tsc -p config/tsconfig.json --noEmit
```

预期：保护/等价 proof、CLI valid inventory、自检、docs-consistency、tsc 全 PASS；删除负向 fixture exit 1；隔离项目真实 pre/post suite 与 coverage provenance 可回读，任何 facts drift 被阻断，当前仓库无测试删除。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/logic/code-health-test-logic.ts w-model-dev/scripts/cli/code-health-tests.ts w-model-dev/scripts/__tests__/code-health-tests.test.ts w-model-dev/scripts/cli/code-health-apply.ts w-model-dev/scripts/samples/code-health/phase3 w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/samples/README.md
 git commit --no-gpg-sign -m "feat(code-health): protect unique tests during phase3 cleanup"
```

暂停/回滚：保护条件无法证明、survivor 不等价、pre/post facts 漂移或 rollback 不可执行时保持 `blocked/deferred/rejected`；不得以作者/年龄/coverage 解释删除。

---

### 任务 6：Phase 4 duplicate clustering、等价报告与 abstraction guard

**目的：** 识别结构近似实现，但只有至少两个稳定生产调用点、完整语义等价证明和可量化维护收益时才允许抽象；偶然相似、测试专用、平台差异和生命周期/错误/安全/并发差异保留。

**文件：**

- 创建：`w-model-dev/scripts/logic/code-health-duplicate-logic.ts`、`w-model-dev/scripts/cli/code-health-duplicates.ts`、`w-model-dev/scripts/__tests__/code-health-duplicates.test.ts`。
- 创建：`w-model-dev/scripts/samples/code-health/phase4/` valid/negative fixtures。
- 修改：`w-model-dev/scripts/cli/code-health-apply.ts`、`w-model-dev/scripts/cli/self-test.ts`、`w-model-dev/scripts/samples/README.md`。

- [ ] **步骤 1：写失败测试**

```ts
it('至少两种 AST/结构/data-flow/call-graph 视图支持且少于两个稳定生产调用点时 deferred', () => {
  const cluster = clusterDuplicates({
    implementations: [prodA, prodB],
    ast: astEvidence,
    dataFlow: flowEvidence,
    callGraph: oneStableCallSite,
    tests: testEvidence,
  });
  expect(cluster[0]?.stableProductionCallSites.length).toBe(1);
  expect(proveAbstraction(cluster[0]!, proposal)).toContain('two stable production call sites');
});

it('等价 proof 覆盖 inputs/outputs/ordering/mutation/side-effects/error/retry/lifecycle/security/concurrency/platform 和维护收益', () => {
  expect(proveAbstraction(fullyEquivalentCluster, fullyEquivalentProposal)).toEqual([]);
  expect(
    proveAbstraction(fullyEquivalentCluster, { ...fullyEquivalentProposal, security: 'different validation order' }),
  ).toContain('security');
  expect(
    proveAbstraction({ ...fullyEquivalentCluster, callSites: ['tests/helper'] }, fullyEquivalentProposal),
  ).toContain('test-only');
});

it('文本相似、短 diff、少行数、mock/fixture 相似、platform-specific/lifecycle 差异不能授权抽象', () => {
  const result = proveAbstraction(accidentalCluster, shortProposal);
  expect(result).toEqual(expect.arrayContaining([expect.stringMatching(/accidental|platform|lifecycle|maintenance/)]));
});
```

- [ ] **步骤 2：运行命令并确认 RED**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-duplicates.test.ts
```

预期：RED，cluster/equivalence/guard 未定义或少于两个稳定 call sites/缺 semantic dimension 仍被错误接受。

- [ ] **步骤 3：最小实现和证据产物**

1. `DuplicateInput` 记录 repo-relative production files/symbols、AST normalized shape/control-flow、structural data-flow/side effects、call-graph neighborhoods/lifecycle ownership、normalized signatures/branches/error paths/tests；textual similarity 仅作为线索。
2. `clusterDuplicates` 只有至少两个独立稳定生产调用点才生成 review cluster；稳定点必须是现有 supported production path、有 contract 和 regression signal，不得是一-off experiment、dead/generated copy、test-only helper。少于两个返回 `deferred`。
3. `proveAbstraction` 逐项证明 accepted inputs/outputs/order/mutations/side effects；error types/status/messages/retry/failure timing；initialization/finalization/cleanup/cancellation/transactions/resource scope；authz/validation order/secrets/privilege；locks/atomicity/idempotency/platform behavior；并证明 fewer behavior owners/bug-fix surfaces、cohesive API、无 configuration explosion/hidden coupling 的维护收益。
4. 等价性缺失或发现平台/生命周期/错误/安全/并发差异即 reject/defer，不强行抽象；批准后 S 只迁移最小 stable call-site 集，保留每个边界的 semantic tests 和 rollback。
5. Phase 5-8 若迁移代码/测试，调用宿主 `codegraph_explore` 于任何 Edit/Write 前并保存 query `changeId/targetFiles/querySymbol/callers/callees/blastRadius/queryTimestamp`；若本项目无 index，先在 checkpoint 记录 `unavailable`，不得伪造 query。
6. self-test 添加两个稳定点通过、一个稳定点 deferred、test-only、platform difference、error/security/lifecycle mismatch 和 maintenance-only-shorter-diff negative fixtures。

- [ ] **步骤 4：通过验证**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-duplicates.test.ts w-model-dev/scripts/__tests__/code-health-cli.test.ts
npm run self-test
npx tsc -p config/tsconfig.json --noEmit
npm run lint:security
```

预期：聚焦测试、自检、tsc、security 全 PASS；negative cluster exit 1 或 deferred exit 0 with non-approval status；approved proposal 只在隔离项目产生 patch，V 可独立重算 semantic proof；阶段 5-8 的代码/测试写入在变更证据中有 codegraph query 或明确 `unavailable` blocker。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/logic/code-health-duplicate-logic.ts w-model-dev/scripts/cli/code-health-duplicates.ts w-model-dev/scripts/__tests__/code-health-duplicates.test.ts w-model-dev/scripts/cli/code-health-apply.ts w-model-dev/scripts/samples/code-health/phase4 w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/samples/README.md
 git commit --no-gpg-sign -m "feat(code-health): add duplicate clustering and abstraction guards"
```

暂停/回滚：少于两个稳定生产调用点、任一 semantic dimension 无证据、维护收益仅为少几行或 codegraph unavailable 时保持 deferred/blocked；不能把相似语法升级为批准。

---

### 任务 7：SSoT-first 集成 references/SKILL/README/AGENTS/CONTRIBUTING/INSTALL/troubleshooting 与 eval

**目的：** 只有实际行为已由任务 1-6 验证后才同步活体文档和 eval；避免把计划、未实现 CLI 或本地运行物写成仓库事实。

**文件：**

- 修改：`docs/skill-design-document_SSoT.md`、`w-model-dev/references/code-health-governance.md`、`w-model-dev/references/subagent-delegation.md`、`w-model-dev/references/hard-constraints.md`、`w-model-dev/references/command-reference.md`、`w-model-dev/references/rtm-guide.md`、`w-model-dev/references/coding-quality.md`、`w-model-dev/references/quality-standards.md`、`w-model-dev/references/operation-behaviors.md`、`w-model-dev/SKILL.md`、`README.md`、`AGENTS.md`、`CONTRIBUTING.md`、`docs/INSTALL.md`、`docs/troubleshooting.md`、`CHANGELOG.md`。
- 条件修改：`package.json`、`package-lock.json`、`w-model-dev/scripts/logic/docs-consistency-logic.ts`、`w-model-dev/scripts/cli/check-docs-consistency.ts`、`.githooks/pre-push`、`eval/w-model-dev-test-prompts.json`、`eval/mappings.json`、`eval/runner.ts`、`eval/w-model-dev-results.tsv`。
- 测试：`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`、`w-model-dev/scripts/__tests__/skill-metadata.test.ts`、`w-model-dev/scripts/__tests__/eval-runner.test.ts`（仅在实际扩展对应行为时修改）。

- [ ] **步骤 1：写失败测试**

先在隔离临时复制中加入文档事实负向测试，不先改真实文档：

```ts
it('SSoT/asset/docs command facts 漂移时 docs-consistency fail-closed', async () => {
  const fixture = await makeDocsFixture({
    ssot: missingCodeHealthPolicy,
    skill: missingCheckpointPointer,
    commandReference: staleExitSemantics,
  });
  const result = await runDocsConsistencyCli(fixture.root, { json: true });
  expect(result.exitCode).toBe(1);
  expect(result.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/code-health|SSoT|exit/)]));
});

it('eval 只有在实际 measured behavior 新增后才允许新增 prompt/mapping，未声明变化保持原 matrix', () => {
  expect(validateEvalDiff({ changedBehavior: false, prompts: originalPrompts, mappings: originalMappings })).toEqual(
    [],
  );
  expect(
    validateEvalDiff({ changedBehavior: false, prompts: [...originalPrompts, fakePrompt], mappings: originalMappings }),
  ).toContain('behavior change');
});
```

- [ ] **步骤 2：运行命令并确认 RED**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts w-model-dev/scripts/__tests__/eval-runner.test.ts
```

预期：新增负向 fixture 在现有逻辑下未能以 code-health-specific reason 被捕获，RED；若不扩展 eval，不添加 fake prompt，原有 eval runner 保持既有结果。

- [ ] **步骤 3：最小实现和证据产物**

1. 先修改 `docs/skill-design-document_SSoT.md`，新增明确 campaign policy/四阶段/候选非结论/证据字段/authority/checkpoint/失败链/rollback/redaction/18 gate/L0-L1/no-LLM/codegraph 前置，并说明实现选择已落在 task 1 定义的 schema/interface；任何与 SSoT 不一致的下游文档停止同步。
2. 更新 `w-model-dev/references/code-health-governance.md` 与 delegation/hard-constraints/command/RTM/coding-quality/quality/operation references，分别写操作流程、角色边界、反模式、命令和 exit 0/1/2、impact、抽象门槛和 R→V→G→S；所有章节必须给出已确定的字段、命令、退出语义和失败路径，不得留下未完成标记、未决语句、模板化占位语句或笼统验证语句。
3. `SKILL.md` 只加 `/wm code-health` 路由、按需 reference、O/A/S/V/G/R/human 权限和 checkpoint；`README.md`/`AGENTS.md`/`CONTRIBUTING.md`/`INSTALL.md`/`troubleshooting.md` 只写已存在入口和真实依赖。版本仍 `42.2.1`，现有 18 项 pre-push 文本、L0/L1 和 exit semantics 原样保留。
4. 仅当 task 1-6 新增 schema/CLI 被 docs-consistency 静态或动态 facts 消费时同步 `docs-consistency-logic.ts`/CLI/测试/README；动态 schema/CLI 计数从 `find/readdir` 或同次受控 facts 得到，不硬编码未来计数。若 campaign 不纳入 hook，不改 `.githooks/pre-push`；若批准纳入，先增隔离 fixture，逐项验证原 18 项顺序和第 13 audit 网络瞬态 skip 行为。
5. eval 只有在 `/wm code-health` 实际成为触发/评估行为时才增加 prompt/mapping/runner assertions；新增 mapping 必须 asset anchor + route/category/matrix 对齐，并在 TSV 记录真实 batch/commit/provenance。仅新增内部门禁而不改变 measured behavior 时只运行原 `npm run eval`，不虚增语料。

- [ ] **步骤 4：通过验证**

```bash
npx prettier --check "w-model-dev/scripts/**/*.ts" "config/**/*.{cjs,ts}" "scripts/*.cjs"
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts
npm run audit:l0-links
npm run self-test
npm run eval
npx tsc -p config/tsconfig.json --noEmit
```

预期：docs-consistency/L0 links/self-test/eval/tsc/Prettier 全 PASS；文档负向临时 fixture exit 1、恢复后 exit 0；版本仍七处一致为 `42.2.1`；`git diff -- .githooks/pre-push` 为空，除非该任务真实批准并验证 hook 集成。

- [ ] **步骤 5：Commit**

```bash
git add docs/skill-design-document_SSoT.md w-model-dev/references/code-health-governance.md w-model-dev/references/subagent-delegation.md w-model-dev/references/hard-constraints.md w-model-dev/references/command-reference.md w-model-dev/references/rtm-guide.md w-model-dev/references/coding-quality.md w-model-dev/references/quality-standards.md w-model-dev/references/operation-behaviors.md w-model-dev/SKILL.md README.md AGENTS.md CONTRIBUTING.md docs/INSTALL.md docs/troubleshooting.md CHANGELOG.md
# 仅在步骤 3 确认实际行为变更时追加 package/eval/docs-consistency/pre-push 文件
 git commit --no-gpg-sign -m "docs(code-health): sync governance policy and live entry points"
```

暂停/回滚：若 docs-consistency、SSoT、eval matrix 或 18 项 hook facts 不一致，停止同步并回到矛盾文件，不以修改断言或删除旧事实来放行；只回滚本任务文档 commit，保留前六任务代码和可验证 ledger。

---

### 任务 8：全 campaign 验证、真实证据、V/G 复核与归档

**目的：** 在隔离 campaign fixture 和真实仓库门禁上验证完整闭环；所有成功/失败/阻塞状态都进入 ledger/archive，导出遵守 redaction/source-bound 规则。不提交本地 `.w-model` 运行时报告。

**文件：**

- 创建：`w-model-dev/scripts/cli/code-health-archive.ts`、`w-model-dev/scripts/__tests__/code-health-cli.test.ts` 中 archive/verify describe、`w-model-dev/scripts/samples/code-health/archive/` valid/negative fixture。
- 修改：`w-model-dev/scripts/logic/code-health-ledger-logic.ts`、`w-model-dev/scripts/cli/self-test.ts`、`w-model-dev/scripts/samples/README.md`；仅在归档门禁确实纳入现有 gate 时修改 `w-model-dev/scripts/logic/gate-logic.ts`、`w-model-dev/scripts/cli/check-artifact-gate.ts`、`.githooks/pre-push`。
- 运行期（不提交）：隔离 fixture 的 `.w-model/code-health/`、`.w-model/gate-logs/`、`.w-model/verifier-outputs/`、`.w-model/signature-chains/`、`.w-model/codegraph-queries/`、`run-log.jsonl` 与审计导出目录。

- [ ] **步骤 1：写失败测试**

```ts
it('缺 V/G、human approval、真实 exit code、source-bound revision、rollback 或 redaction 时 archive fail-closed', async () => {
  const result = await archiveCampaign(incompleteCampaign);
  expect(result.exitCode).toBe(1);
  expect(result.reason).toMatch(/review|gate|approval|provenance|rollback|redaction/);
});

it('失败必须生成 R root-cause → V → G → S rework 事件，不能直接 archive 或直接重派 S', () => {
  const ledger = recordGateFailure(validLedger, failedGateEvidence);
  expect(ledger.events.map((e) => e.to)).toEqual(['blocked']);
  expect(nextRequiredRoles(ledger)).toEqual(['R', 'V', 'G', 'S']);
  expect(canArchiveCandidate(ledger.candidates[0]!, ledger)).toContain('root cause');
});

it('完整 candidate 可生成脱敏、带 manifest/content hash 的 archive；package-only 与 source-bound verify 语义区分', async () => {
  const exported = await archiveCampaign(completeCampaign);
  expect(exported.exitCode).toBe(0);
  expect(exported.manifest.files.every((f) => f.path.split('/').every((p) => p !== '..'))).toBe(true);
  expect(exported.verificationLevel).toBe('source-bound');
  expect(await verifyArchive(exported.path)).toEqual({ ok: true, verificationLevel: 'package-only' });
});
```

- [ ] **步骤 2：运行命令并确认 RED**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-cli.test.ts -t "archive"
```

预期：RED，archive CLI/logic 尚未实现；缺 reviewer/gate/provenance 可能被错误接受，确认 fail-closed 测试先失败。

- [ ] **步骤 3：最小实现和证据产物**

1. `code-health-archive.ts` 实现 `--campaign`, `--output`, `--verify`, `--source-project`；读取 campaign ledger/candidate/evidence/approval/review/gate/signature/diff rollback refs，先 schema/状态/签名/时间序列/source revision/RTM coverage/redaction 校验，再原子写 archive manifest。缺字段只能 `not_applicable` + reason，不能从 prose 推断。
2. archive 只允许 candidate 已 human approve、implemented、真实 affected/full regression 通过、V review actual diff、G gate 退出码为 0、rollback executable、redaction clean、source-bound hash 与当前 revision 一致；`deferred/rejected/blocked/rolled-back` 可以归档但作为 terminal non-success，不能标记 archived-as-passed。导出保留 candidate ID、sources、confidence/risk、impact、commands/exit/hash、review/signatures/archive；敏感信息、绝对路径、API key/password/token/private cert/PII/customer/proprietary payload 脱敏，不安全则 blocked。
3. 将 code-health archive manifest 作为 `EvidenceKind` 之外的 campaign-specific package：不扩大现有 `evidence-export-logic.ts` 五类白名单，不把 campaign 账本伪装成 gate-log/verifier/signature/codegraph/run-log；若需要受控交付，单独 manifest 记录 package-only 与 source-bound 两种验证级别，复用现有 `verifySourceProvenance` 的 hash/HEAD 规则。
4. 失败事件固定写入 run-log/signature-chain 可消费的角色链：G failure/review failure → R rootcause report → V review → G validation → S rework；R 不修复，V/G 不代替 human approval，S 不静默扩大 scope。真实命令 unavailable/not_run/unverified 和失败 raw hash 全部保留。
5. self-test 加 complete archive、missing approval/V/G、stale revision、hash mismatch、unsafe redaction、blocked terminal、R path、package-only/source-bound verify fixture。运行期报告落在隔离 fixture 或 `.w-model`，不 `git add`。

- [ ] **步骤 4：通过验证**

先运行聚焦和完整回归：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-cli.test.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts
npm run test
npm run coverage
npx tsc -p config/tsconfig.json --noEmit
npm run self-test
npm run lint:security
npm run eval
npm run audit:l0-links
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts
```

然后在 Git Bash 执行现有本地 CI：

```bash
npm run prepush
```

最后针对本 campaign 做真实闭环：

```bash
npx tsx w-model-dev/scripts/cli/code-health-ledger.ts validate --campaign C:\\Temp\\code-health-fixture
npx tsx w-model-dev/scripts/cli/code-health-archive.ts --campaign C:\\Temp\\code-health-fixture --output C:\\Temp\\code-health-archive --source-project C:\\Temp\\code-health-source
npx tsx w-model-dev/scripts/cli/code-health-archive.ts --verify C:\\Temp\\code-health-archive
git -C C:\\Temp\\code-health-source diff --exit-code
```

预期：所有聚焦/全量测试、`self-test`、security、eval、L0 audit、docs-consistency、tsc、Prettier 和 Git Bash `prepush` 的 18 项均按既有 exit 语义通过；第 13 项 `npm audit --audit-level=high` 只保留既有网络/registry 瞬态 skip 规则；archive source-bound verify exit 0，package-only 明确报告 package-only；未批准/失败 campaign archive exit 1；隔离项目 rollback 后 diff clean。记录每条命令真实 stdout/stderr hash、UTC 时间、exit code、当前 HEAD 和环境，不把“预期”写成结果。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/cli/code-health-archive.ts w-model-dev/scripts/logic/code-health-ledger-logic.ts w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/samples/code-health/archive w-model-dev/scripts/samples/README.md
# 只有实际 gate 集成经过任务 8 步骤 4 验证时才追加 gate 相关文件
 git commit --no-gpg-sign -m "feat(code-health): archive verified campaign evidence"
```

暂停/回滚：任一 gate/review/provenance/redaction/rollback 失败则保持 `blocked` 并启动 R→V→G→S；不得用 `--verify`、LLM、工具推荐或 coverage 数字绕过 human approval。归档失败清理本次隔离 staging，保留原 ledger；不提交 `.w-model`、coverage、`.zcode` 或未白名单运行时文件。

---

## 冻结的 18 项 pre-push 顺序

任务 8 必须在 Git Bash 中执行 `npm run prepush`，并逐项记录下列现有顺序、期望退出码和真实退出码；不得新增、删除、重排、重解释任何项目：

1. `npm run self-test`，期望 exit 0。
2. `npm run check:verifier` 无参数，期望 exit 2。
3. `npm run check:gate -- /tmp/nonexistent`，期望 exit 2。
4. `npm run check:verifier -- w-model-dev/scripts/samples/verifier/valid.json`，期望 exit 0。
5. `npm run check:verifier -- w-model-dev/scripts/samples/verifier/bad-ranking-k.json`，期望 exit 1。
6. `npx tsx w-model-dev/scripts/cli/security-scan.ts`，期望 exit 0。
7. `npx tsx w-model-dev/scripts/cli/check-bdd-model.ts w-model-dev/scripts/samples/bdd/valid-manifest.json --phase=1`，期望 exit 0。
8. `npx tsx w-model-dev/scripts/cli/check-bdd-model.ts w-model-dev/scripts/samples/bdd/bad-schema.manifest.json --phase=1`，期望 exit 2。
9. `npm run check:coverage -- w-model-dev/scripts/samples/coverage/valid-minimal-coverage.json`，期望 exit 0。
10. `npm run check:exemption -- w-model-dev/scripts/samples/exemption/valid-full-approval.json`，期望 exit 0。
11. `npx tsx w-model-dev/scripts/cli/check-signature-chain.ts w-model-dev/scripts/samples/signature-chain/valid-all-roles.jsonl --phase=1`，期望 exit 0。
12. `npx vitest run --coverage --reporter=json --outputFile="$tmp_vitest_json" --config config/vitest.config.ts`，期望 exit 0，并以同次 JSON facts/provenance 供第 14 项使用。
13. `npm audit --audit-level=high`，期望 exit 0；仅现有明确网络不可达或 registry 不支持 audit endpoint 的瞬态信号可按 hook 规则跳过，漏洞/解析/权限错误仍阻断。
14. `npm run check:docs-consistency`，期望 exit 0，复用第 12 项 facts/provenance。
15. `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`，期望 exit 0。
16. `npx prettier --config config/prettier.config.cjs --check "w-model-dev/scripts/**/*.ts" "config/**/*.{cjs,ts}" "scripts/*.cjs"`，期望 exit 0。
17. `npx tsc -p config/tsconfig.json`，期望 exit 0。
18. `npx tsx eval/runner.ts`，期望 exit 0。

其中 `$tmp_vitest_json` 是 hook 运行时由 `mktemp` 创建并在退出时清理的临时 JSON 路径，不是仓库文件或计划接口；平台依赖检查仍是全部门禁之前的 preflight，且 L0/L1 分界和版本 `42.2.1` 保持不变。

## 规格逐条映射与最终验收

| 规格章节/要求                                                                                                                               | 计划覆盖                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| §1 governing decision、O 最小化、candidate 非结论                                                                                           | 统一生命周期、任务 1 ledger、任务 2 只读、任务 3 approval guard                                            |
| §2 goals/non-goals、42.2.1、无 LLM、L0/L1、18 gate                                                                                          | 计划头部硬约束、任务 7、任务 8 prepush 验证                                                                |
| §3 roles/checkpoints、R→V→G→S                                                                                                               | 统一生命周期、任务 3/8、每任务暂停/回滚                                                                    |
| §4.1-4.7 discovery/evidence/review/change/regression/archive                                                                                | 任务 1-3、任务 8 archive、LedgerEvent/ApprovalDecision                                                     |
| §5.1 Phase 1 static+dynamic、dynamic/reflection、shell/platform、schema/template/RTM、test helper                                           | 任务 2 static inventory、trace、guard fixtures                                                             |
| §5.2 Phase 2 matrix/TDD/七维度/coverage signal                                                                                              | 任务 4 gap schema、真实 RED/GREEN、level/RTM                                                               |
| §5.3 Phase 3 old/human provenance only、protected facts、pre/post regression                                                                | 任务 5 inventory/proof/delete guard                                                                        |
| §5.4 Phase 4 AST/data-flow/call graph、two stable production call sites、semantic/lifecycle/security/concurrency/platform/maintenance proof | 任务 6 cluster/equivalence/abstraction guard                                                               |
| §6 fail-closed/provenance/redaction/no fabrication                                                                                          | 任务 1 command/redaction、任务 2-6 guards、任务 8 verify                                                   |
| §7 candidate/evidence contract 全字段                                                                                                       | 任务 1 九 Schema、CodeHealthCandidate/CommandEvidence/Impact/Rollback/Review/Signature/Archive             |
| §8 acceptance matrix、terminal candidates                                                                                                   | 任务 2-6 phase acceptance、任务 8 terminal archive                                                         |
| §9 SSoT-first、L0/L1、codegraph 修改前查询                                                                                                  | 任务 7、任务 6/8 codegraph 条件                                                                            |
| §10 frozen/open choices                                                                                                                     | 计划固定 TypeScript compiler API、隔离 patch/commit、环境矩阵与 schema；不削弱冻结原则                     |
| 用户要求的 8 任务拆分                                                                                                                       | 任务 1 账本；任务 2 P1 发现；任务 3 P1 执行；任务 4 P2；任务 5 P3；任务 6 P4；任务 7 集成；任务 8 验证归档 |
| 保留 security/typecheck/prettier/docs-consistency/self-test/eval 与真实结果                                                                 | 每任务验证、任务 7/8 全量命令                                                                              |

## writing-plans 自检清单

- [ ] **规格覆盖检查：** 已逐条映射规格 §1-§10、四阶段要求、字段 contract、18 项 pre-push、L0/L1、SSoT-first、codegraph、真实证据、R→V→G→S 和用户指定 8 任务；未把候选当结论，也未授权当前工作树修改。
- [ ] **完整性检查：** 计划不含未完成标记、未决语句、模板化占位语句或笼统验证语句；每个代码步骤都给出具体函数/字段/命令/预期 RED/GREEN。
- [ ] **类型一致性检查：** task 1 先定义 `CodeHealthCandidate`、`LedgerEvent`、`ApprovalDecision`、`CodeHealthCommandRunner` 及所有跨任务 Phase 类型/函数签名；task 2-8 只引用这些名称或在 task 1 明确定义的 phase-specific 类型。
- [ ] **文件/命令一致性检查：** 新增 CLI 均位于 `w-model-dev/scripts/cli/`；纯逻辑无 direct fs/child_process（任务 1 明确注入式 command/redaction 例外并在 dependency-boundaries 测试登记）；self-test/samples/docs-consistency/eval/prepush 命令路径与当前 `package.json` 对齐；`npm run prepush` 仅 Git Bash。
- [ ] **实际行为变更条件检查：** task 7 对 package/eval/pre-push/docs-consistency 使用条件修改，不会因计划本身新增未实现事实；task 8 只提交源码/测试/样本，不提交 `.w-model`、coverage、`.zcode` 或未白名单运行物。
- [ ] **验证证据检查：** 每任务都包含失败测试、运行命令/预期 RED、最小实现/具体证据、通过验证、独立 commit、暂停和回滚；任务 8 要求真实 exit code/hash/provenance，不接受复制、估算或模拟结果。

## 执行模式

**推荐：子代理驱动。** 每个任务派发新的 A/S/V/G/R 子代理，任务内按 TDD RED→GREEN→真实回归→独立审查执行；O 只传递已批准 scope、等待 human checkpoint、写入状态和路由失败。任务 3（删除执行）、任务 5（测试删除）、任务 6（抽象迁移）和任务 8（归档放行）设置强制 human checkpoint；任何 V/G 失败都先走 R→V→G→S，不能直接回到 S。
