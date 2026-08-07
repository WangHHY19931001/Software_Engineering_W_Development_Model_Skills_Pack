# 目录约定（Directory Conventions）

> 本文件是所有 W 模型产物路径的唯一事实来源（SSoT）。phase 文档、模板、门禁脚本、verifier-spec 均须引用本文件，不得自定义路径。
> 日期：2026-08-07
> 状态：生效中

## 1. 阶段子目录模式

所有阶段产物统一存放于 `docs/phaseN-{name}/` 子目录下，禁止平铺于 `docs/` 根目录。

| 阶段 | 目录 | 文件命名 | 模板 |
|------|------|----------|------|
| 1 需求分析 | `docs/phase1-requirements/` | `requirement-spec.md`, `acceptance-test-design.md` | `templates/requirement-spec.md` |
| 2 系统设计 | `docs/phase2-design/` | `{module}-system-design.md`, `{module}-system-test.md` | `templates/system-design.md`, `templates/test-case.md` |
| 3 概要设计 | `docs/phase3-outline/` | `{module}-outline-design.md`, `{module}-integration-test.md` | `templates/detailed-design.md`, `templates/test-case.md` |
| 4 详细设计 | `docs/phase4-detailed/` | `{module}-detailed-design.md`, `{module}-interface-design.md` | `templates/detailed-design.md`, `templates/interface-design.md` |
| 5 编码 | `src/` | 按技术栈约定 | — |
| 6 集成测试 | `docs/phase6-integration-test/` | `integration-test.md` | `templates/test-case.md` |
| 7 系统测试 | `docs/phase7-system-test/` | `system-test.md` | `templates/test-case.md` |
| 8 验收测试 | `docs/phase8-acceptance-test/` | `acceptance-test.md` | `templates/test-case.md` |

## 2. 横切文档

| 产物 | 目录 | 命名 | 强制阶段 |
|------|------|------|----------|
| UAT 路径映射 | `docs/` | `uat-path-mapping.md` | 阶段 1 产出，阶段 5/终检校验回填 |
| RTM | `.w-model/` | `rtm.json` | 阶段 1 起持续维护 |
| 项目状态 | `.w-model/` | `project.json` | 全阶段 |
| 编排状态 | `.w-model/` | `orchestrator-state.md` | 全阶段 |

## 3. TLA+ 规格目录

| 层级 | 目录 | 文件命名 |
|------|------|----------|
| L1 | `tla/specs/level1/` | `L1_{System}.tla`, `L1_{System}.cfg` |
| L2 | `tla/specs/level2/` | `L2_{System}_{Subsystem}.tla`, `L2_{System}_{Subsystem}.cfg` |
| L3 | `tla/specs/level3/` | `L3_{System}_{Subsystem}_{Atom}.tla`, 同名 `.cfg` |
| L4-L6 | `tla/specs/level{N}/` | `L{N}_{System}_..._{Atom}.tla` |

## 4. BDD features 目录

| 层级 | 目录 | 文件命名 |
|------|------|----------|
| L1 | `features/L1/` | `L1_{system}-001.feature` |
| L2 | `features/L2/` | `L2_{system}_{subsystem}-001.feature` |
| L3 | `features/L3/` | `L3_{system}_{subsystem}_{atom}-001.feature` |
| L4 | `features/L4/` | `L4_{system}_{subsystem}_{atom}_{method}-001.feature` |

## 5. .w-model 目录结构

```
.w-model/
├── project.json              # 项目元数据
├── orchestrator-state.md     # 编排状态
├── rtm.json                  # 需求追踪矩阵
├── tla-manifest.json         # TLA+ 规格清单
├── bdd-manifest.json         # BDD features 清单
├── ingestion/                # 图谱导入产物
│   ├── graph.json            # 合并后的需求/设计图谱
│   └── consolidated-phaseN.json
├── verifier-outputs/         # V 子代理产出
├── gate-logs/                # 门禁日志
└── run-log.jsonl             # 运行日志
```

## 6. 路径引用规则

所有跨文件路径引用须遵循 [format-conventions.md](format-conventions.md) 的分隔符约定。

## 7. 门禁脚本路径解析

`check-artifact-gate.ts` 内置 `resolvePhaseDoc(phase, type)` 函数从本约定解析文档路径，禁止硬编码。
