# 决策日志（Decision Log）

> 历史决策归档：SSoT（skill-design-document_SSoT.md）自 41.7.0 起**只承载当前设计事实**，
> 一切历史信息（轮次记录 / 变更过程 / 调测史 / 吸收决策记录 / 修复记录）统一由
> **CHANGELOG 体系**承载——本目录是 CHANGELOG 的配套归档（同 `engineering-batches/` 模式），
> 存放按轮次归档的详细决策记录与验证数据。
>
> **不参与门禁**：本目录仅文档记录，`check-docs-consistency` / pre-push 不读取。
> **迁移原则**：归档内容保留原文，不篡改历史事实（同「不篡改演进史」原则）。

## 文件清单

| 文件 | 内容 | 对应版本区间 |
|---|---|---|
| [rounds-09-39.md](./rounds-09-39.md) | SSoT §3.4.7-39 轮次记录 + §10A 对应轮次行 + §10B 参考实现调测史 | [9.0.0] ~ [40.2.0]（CHANGELOG-archive.md） |
| [rounds-40-47.md](./rounds-40-47.md) | SSoT §3.4.40-47 轮次记录 + §10A 对应轮次行 | [41.0.0] ~ [41.6.0]（CHANGELOG.md） |
| [absorptions.md](./absorptions.md) | 外部方法论吸收决策记录（四源 / 三源 / 人月神话 / 外部技能，原 references/*-absorption.md） | [40.0.0] ~ [41.2.0] |
| [legacy-sections.md](./legacy-sections.md) | 历史段落归档（anti-patterns 实现层经验教训 / hard-constraints 编号迁移表 / SSoT §14-15 tombstone 原文 / 迁移指令等） | 各轮 |

## 轮次 → 版本 → CHANGELOG 映射

> 完整变更条目见 CHANGELOG.md（41.0.0 之后）与 CHANGELOG-archive.md（41.0.0 之前）；
> 本表为已核实的轮次编号 ↔ 版本号对照。§3.4.7-25（第 9-26 轮区间）的版本对应以
> rounds-09-39.md 内各轮次记录「版本号」标注为准（CHANGELOG-archive.md 条目按版本号检索）。

| 轮次（SSoT §3.4.N） | 版本 | CHANGELOG 条目 |
|---|---|---|
| §3.4.7 第 9 轮 | [9.0.0] | CHANGELOG-archive.md |
| §3.4.26 第 27 轮 | [29.0.0] | CHANGELOG-archive.md |
| §3.4.27 第 28 轮 | [30.0.0] | CHANGELOG-archive.md |
| §3.4.28 第 29 轮 | [30.1.0] | CHANGELOG-archive.md |
| §3.4.29 第 30 轮 | [31.0.0] | CHANGELOG-archive.md |
| §3.4.30 第 31 轮 | [32.0.0] | CHANGELOG-archive.md |
| §3.4.31 第 32 轮 | [33.0.0] | CHANGELOG-archive.md |
| §3.4.32 第 33 轮 | [34.0.0] | CHANGELOG-archive.md |
| §3.4.33 第 34 轮 | [35.0.0] | CHANGELOG-archive.md |
| §3.4.34 第 35 轮 | [36.0.0] | CHANGELOG-archive.md |
| §3.4.35 第 36 轮 | [37.0.0] | CHANGELOG-archive.md |
| §3.4.36 第 37 轮 | [38.0.0] | CHANGELOG-archive.md |
| §3.4.37 第 38 轮·小轮 A | [38.0.0] | CHANGELOG-archive.md |
| §3.4.38 第 38 轮·小轮 B | [38.1.0] | CHANGELOG-archive.md |
| §3.4.39 第 38 轮·小轮 C | [39.2.0] | CHANGELOG-archive.md |
| §3.4.40 第 39 轮 | [39.0.0]/[39.1.0]/[39.2.0] | CHANGELOG-archive.md |
| §3.4.41 第 40 轮（三源吸收 P0/P1/P2） | [40.0.0]/[40.1.0]/[40.2.0] | CHANGELOG-archive.md |
| §3.4.42 第 41 轮（四源吸收 P0/P1/P2） | [41.0.0]/[41.1.0]/[41.2.0] | CHANGELOG.md |
| §3.4.43 第 42 轮（P0-P2 工程化批次） | [41.2.0] | CHANGELOG.md + engineering-batches/ |
| §3.4.44 第 43 轮（移除 .cursor 技能包） | [41.3.0] | CHANGELOG.md |
| §3.4.45 第 44 轮（评审修正批次） | [41.3.1] | CHANGELOG.md |
| §3.4.46 第 45 轮（外部评审核实修正批次） | [41.4.0] | CHANGELOG.md |
| §3.4.47 第 46 轮（五项落地批次） | [41.5.0] | CHANGELOG.md |
| §3.4.48 第 47 轮（SSoT 权威性审查修复） | [41.6.0] | CHANGELOG.md |
