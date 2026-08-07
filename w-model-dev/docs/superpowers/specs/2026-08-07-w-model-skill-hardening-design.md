# W 模型技能强化设计：目录约定 / 格式统一 / 覆盖率校验架构升级

> 日期：2026-08-07
> 状态：已批准（待写实施计划）
> 决策方案：方案 C（最强保障）+ S-ingest 独立回填覆盖率
> 兼容性：允许不兼容历史数据，重新产生调测 demo

## 1. 问题根因

### 1.1 目录约定不一致（问题 1）

四方路径约定互不匹配：

| 来源 | 约定 | 证据 |
|------|------|------|
| verifier-spec.md:834 | `docs/phase1-requirements/requirements-spec.md`（阶段子目录） | L834 |
| phase-2-system-design.md:36 | `<模块>-system-design.md`（模块前缀，无目录） | L36 |
| tla-spec-template.md:128,144,160 | `docs/system-design.md`（平铺 docs/） | L128,144,160 |
| check-artifact-gate.ts:313 | `docs/uat-path-mapping.md`（平铺硬编码） | L313 |

**根因**：路径约定散落于 phase 文档 / 模板 / 门禁脚本 / verifier-spec 四处，无 SSoT，导致漂移。

### 1.2 产出格式不一致（问题 2）

分隔符三方不一致：

| 来源 | 分隔符 | 证据 |
|------|--------|------|
| verifier-spec.md §6.2.1:458 | `:` 冒号（`path:§section`） | L458 |
| verifier-spec.md §6.2:447 | `.` 点号（`path.field=value`） | L447 |
| tla-spec-template.md:15,128,144,160 | `#` 井号（`path#§section`） | L15 |

**根因**：格式约定散落于 verifier-spec 两节（自身就不一致）+ 模板，无 SSoT。

### 1.3 TLA+/BDD 覆盖率盲区（问题 3）

| 校验环节 | TLA+ SD 覆盖率 | BDD 子系统覆盖率 |
|----------|----------------|------------------|
| guide 规则 | 强制（tla-plus-guide §10:447） | 文档声称支持 --graph（bdd-guide:330） |
| 脚本实现 | 仅 --graph 传入时执行（check-tla-model.ts:401-408） | 完全缺失（check-bdd-model.ts 无 --graph 处理） |
| 终检门禁 | 不调用 check-tla-model，仅检查 manifest 存在（check-artifact-gate.ts:232-246） | 同左 |
| schema | graphSdNodes 可选（tla-manifest.schema.json:75-79） | 无覆盖字段约束 |
| 分派模板 | S-tla 未约束覆盖范围 | S-bdd 声称覆盖但门禁不校验 |

**根因**：① --graph 可选且终检不传；② BDD 覆盖率维度未实现；③ G 标准模板不强制跑 model 校验；④ 覆盖率数据由 S 自填不可靠。

## 2. 设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 目录约定 | 阶段子目录 `docs/phaseN-{name}/` | 阶段隔离清晰、与 verifier-spec 现有约定一致 |
| 格式分隔符 | 冒号 `path:§section` / `path:L42` | 与 verifier-spec §6.2.1 一致、与 IDE file:line 跳转兼容 |
| 覆盖率强化深度 | 全链路强制（schema + 门禁 + 终检 + G 模板） | 三重保障，防止覆盖率盲区 |
| 覆盖率数据来源 | S-ingest 独立回填（非 S-tla/S-bdd 自填） | 分离关注点，防止自填不可靠 |
| 兼容性 | 允许不兼容，重新产生 demo | 简化实施，无需兼容层 |

## 3. 设计详述

### 3.1 目录约定集中化

#### 3.1.1 新建 SSoT

新建 `w-model-dev/references/directory-conventions.md`，作为所有路径约定的唯一事实来源：

| 阶段 | 目录 | 文件命名 |
|------|------|----------|
| 1 需求分析 | `docs/phase1-requirements/` | `requirement-spec.md`, `acceptance-test-design.md` |
| 2 系统设计 | `docs/phase2-design/` | `{module}-system-design.md`, `{module}-system-test.md` |
| 3 概要设计 | `docs/phase3-outline/` | `{module}-outline-design.md`, `{module}-integration-test.md` |
| 4 详细设计 | `docs/phase4-detailed/` | `{module}-detailed-design.md`, `{module}-interface-design.md` |
| 5-8 测试 | `docs/phase{N}-{name}/` | `{type}-test.md` |
| 横切 | `docs/` | `uat-path-mapping.md`（阶段 1 强制） |
| TLA+ | `tla/specs/level{N}/` | `L{N}_{System}.tla`, `L{N}_{System}.cfg` |
| BDD | `features/L{N}/` | `L{N}_{system}-{num}.feature` |
| .w-model | `.w-model/` | 固定结构（`ingestion/`, `verifier-outputs/` 等） |

#### 3.1.2 统一改动点

| 文件 | 当前 | 改为 |
|------|------|------|
| phase-2-system-design.md:36 | `<模块>-system-design.md` | `docs/phase2-design/{module}-system-design.md` |
| phase-3-outline-design.md | 同模式 | `docs/phase3-outline/{module}-outline-design.md` |
| phase-4-detailed-design.md:36 | `<模块>-detailed-design.md` | `docs/phase4-detailed/{module}-detailed-design.md` |
| tla-spec-template.md:128,144,160 | `docs/system-design.md#§3.2` | `docs/phase2-design/{module}-system-design.md:§3.2` |
| 所有 phase 文档 | 各自定义路径 | 引用 `directory-conventions.md` |
| check-artifact-gate.ts | 硬编码路径 | 新增 `resolvePhaseDoc(phase, type)` 函数从内置映射表解析 |

### 3.2 格式约定集中化

#### 3.2.1 新建 SSoT

新建 `w-model-dev/references/format-conventions.md`，作为所有元数据字段格式的唯一事实来源。

#### 3.2.2 统一分隔符规则

```
路径定位统一为冒号分隔：
  path:§section   （章节定位）
  path:L42-58     （行号定位）
  path:§3.2,L42   （章节+行号混合）

禁止格式：
  path#§section   （井号——旧格式）
  path.field=value（点号——旧格式）
  纯文件名无定位
```

#### 3.2.3 各字段格式规范

| 字段 | 位置 | 格式 | 示例 |
|------|------|------|------|
| evidence | VerifierOutput JSON | `path:§section=statement` 或 `path:L42=statement` | `docs/phase1-requirements/requirement-spec.md:§1.1=32 需求齐全` |
| @design | TLA+ spec 头部 | `path:§section` | `docs/phase2-design/blog-system-system-design.md:§3.2` |
| @design | BDD feature 头部 | 同上 | 同上 |
| designDoc | RTM | `path:§anchor` | `docs/phase2-design/blog-system-system-design.md:§M-001` |

#### 3.2.4 改动点

| 文件 | 当前 | 改为 |
|------|------|------|
| tla-spec-template.md:15,128,144,160 | `#§`（井号） | `:§`（冒号） |
| verifier-spec.md §6.2:447-448 | `.` 点号 | `:` 冒号 |
| verifier-spec.md §6.2 与 §6.2.1 | 两种格式不统一 | 统一引用 format-conventions.md |
| 所有模板占位符 | `{{路径}}` | 补全为阶段子目录路径示例 |
| verifier-logic.ts evidence 正则 | 匹配旧格式 | 更新为匹配 `path:§section=statement` 或 `path:L42=statement` |

### 3.3 覆盖率校验架构升级

#### 3.3.1 核心原则：覆盖率数据由 S-ingest 独立回填

S-tla/S-bdd 产出文件时在头部声明 `@designIds`（自己覆盖的 SD 节点），但不回填 manifest 覆盖率字段。由独立的 S-ingest 子代理从产物文件中提取覆盖信息、与 graph.json 比对后回填 manifest。

#### 3.3.2 修订后的分派时序

```
TLA+ 侧：
  S-doc → A-evolve(SD 节点入图谱) → S-tla(产出 .tla/.cfg/manifest 基础字段 + @designIds 头部)
  → S-ingest-tla(从 .tla 提取 @designIds + 比对 graph.json SD 节点 → 回填 manifest sdCoverage)
  → R3 → V → G(check-tla-model --graph 校验)

BDD 侧：
  S-bdd(产出 .feature/manifest 基础字段 + @designIds 头部)
  → S-ingest-bdd(从 .feature 提取 @designIds + 比对 graph.json SD 节点 → 回填 manifest designCoverage)
  → R3 → V → G(check-bdd-model --graph 校验)
```

#### 3.3.3 新增 S-ingest 子代理变体

**S-ingest-tla**（TLA+ 图谱导入）：
- 输入：`.tla` 文件 + `tla-manifest.json` + `.w-model/ingestion/graph.json`
- 任务：从 `.tla` 头部 `@designIds` 提取覆盖的 SD 节点 ID，与 graph.json 中所有 type=SD 节点比对
- 产出：`tla-manifest.json` 的 `sdCoverage` 字段回填
- 只读 .tla 文件，不修改

**S-ingest-bdd**（BDD 图谱导入）：
- 输入：`.feature` 文件 + `bdd-manifest.json` + `.w-model/ingestion/graph.json`
- 任务：从 `.feature` 头部 `@designIds` 提取覆盖的 SD 节点 ID，与 graph.json 比对
- 产出：`bdd-manifest.json` 的 `designCoverage` 字段回填
- 只读 .feature 文件，不修改

#### 3.3.4 TLA+/BDD 文件头部新增 @designIds 元数据

`.tla` 文件头部新增：
```
@designIds     SD-001,SD-002,SD-005
```

`.feature` 文件头部新增：
```
@designIds     SD-001,SD-002,SD-005
```

S-tla/S-bdd 产出文件时填写自己覆盖的 SD 节点 ID（基于设计文档），S-ingest 验证这些 ID 与实际内容一致后回填 manifest。

#### 3.3.5 manifest schema 强制字段

`tla-manifest.schema.json` 新增 `sdCoverage` 必填字段（phase≥2）：

```json
{
  "sdCoverage": {
    "type": "object",
    "required": ["totalSdNodes", "coveredSdNodes", "uncoveredSdNodes", "coverageRate"],
    "properties": {
      "totalSdNodes": { "type": "integer" },
      "coveredSdNodes": { "type": "array", "items": { "type": "string" } },
      "uncoveredSdNodes": { "type": "array", "items": { "type": "string" } },
      "coverageRate": { "type": "number" }
    }
  }
}
```

`bdd-manifest.schema.json` 新增 `designCoverage` 必填字段（phase≥2），结构同上。

`uncoveredSdNodes` 非空 → schema 校验失败（phase≥2）。

#### 3.3.6 check-tla-model.ts 升级

- `--graph` 参数从**可选**改为**强制**（phase≥2 时缺失 → exitCode=2 ARG_INVALID）
- SD 覆盖率校验从"仅在有 graphSdNodes 时执行"改为"phase≥2 时强制执行"
- `sdCoverage.uncoveredSdNodes` 非空 → exitCode=1，reworkHints 指向未覆盖的 SD 节点 ID

#### 3.3.7 check-bdd-model.ts 新增 D8 维度

新增 **D8 SD Coverage** 校验维度：
- 实现 `--graph` 参数解析（当前完全缺失）
- 从 graph.json 提取 type=SD 节点
- 比对 bdd-manifest 的 `designCoverage.uncoveredSdNodes`
- `uncoveredSdNodes` 非空 → D8 violation，exitCode=1
- 输出：`--- D8 SD Coverage: N violations (uncovered: SD-005, SD-012, ...)`

#### 3.3.8 check-artifact-gate.ts 终检升级

- phase≥2 时，终检**调用** `check-tla-model.ts --graph=<graph.json> --phase=<N>` 和 `check-bdd-model.ts --graph=<graph.json> --phase=<N>`
- 终检传递 `.w-model/ingestion/graph.json` 路径
- TLA+/BDD 模型校验失败 → 终检失败（exitCode=1）

#### 3.3.9 G 子代理标准模板升级

`subagent-delegation.md` G 模板改为：
- 阶段 1~7：强制跑 `check-verifier-output.ts` + `check-tla-model.ts --graph=.w-model/ingestion/graph.json --phase=<N>` + `check-bdd-model.ts --graph=.w-model/ingestion/graph.json --phase=<N>` + `check-artifact-gate.ts --phase=<N>` + 其余闭环脚本
- 阶段 8 终检：`check-artifact-gate.ts`（内部已调用上述 model 校验）

#### 3.3.10 S-tla/S-bdd 分派模板强化

- S-tla 模板新增：".tla 文件头部须含 `@designIds` 字段，列出覆盖的 SD 节点 ID"
- S-bdd 模板新增：".feature 文件头部须含 `@designIds` 字段，列出覆盖的 SD 节点 ID"
- 两者均新增："读取 `.w-model/ingestion/graph.json` 提取 SD 节点列表作为覆盖范围依据"

## 4. 影响范围

| 改动类型 | 文件 | 数量 |
|----------|------|------|
| 新建 SSoT | `directory-conventions.md`, `format-conventions.md` | 2 |
| schema 变更 | `tla-manifest.schema.json`, `bdd-manifest.schema.json` | 2 |
| 脚本升级 | `check-tla-model.ts`, `check-bdd-model.ts`, `check-artifact-gate.ts`, `verifier-logic.ts`, `tla-logic.ts` | 5 |
| 新增分派模板 | S-ingest-tla, S-ingest-bdd（`subagent-delegation.md`） | 2 |
| 文档更新 | phase-2~4 文档(路径), `tla-plus-guide.md`(--graph 强制), `bdd-guide.md`(D8), `verifier-spec.md`(格式), `subagent-delegation.md`(G/S 模板), templates/(路径+格式), `tla-spec-template.md`(@designIds + :§), `feature.template`(@designIds + :§) | ~14 |
| demo 重产 | `w-model-dev-demo/` 下全部产物（允许不兼容） | 全量 |

## 5. 验收标准

- [ ] `directory-conventions.md` 存在且被所有 phase 文档/模板/门禁脚本引用
- [ ] `format-conventions.md` 存在且被 verifier-spec/模板/门禁脚本引用
- [ ] 所有路径使用阶段子目录模式（`docs/phaseN-{name}/`）
- [ ] 所有路径定位使用冒号分隔（`path:§section` / `path:L42`）
- [ ] TLA+ manifest `sdCoverage` 字段 phase≥2 必填，由 S-ingest-tla 回填
- [ ] BDD manifest `designCoverage` 字段 phase≥2 必填，由 S-ingest-bdd 回填
- [ ] `check-tla-model.ts --graph` phase≥2 强制，缺失 → exitCode=2
- [ ] `check-bdd-model.ts` D8 SD Coverage 维度实现
- [ ] `check-artifact-gate.ts` 终检调用 check-tla-model + check-bdd-model 并传递 --graph
- [ ] G 标准模板强制跑 check-tla-model + check-bdd-model
- [ ] S-tla/S-bdd 模板要求 @designIds 头部字段
- [ ] demo 重新产出并通过全部门禁
