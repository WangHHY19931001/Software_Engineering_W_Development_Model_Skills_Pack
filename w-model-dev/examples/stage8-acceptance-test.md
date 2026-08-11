# 阶段编排示例：阶段 8 验收测试（执行 + 终检 + 归档）

> 对应 W 模型阶段 8（右 V 测试执行终点）。命令入口：`/wm test type=验收 result=<pass|fail>`。
> 本示例聚焦编排流程中的 check 脚本调用、命令行与预期输出；交互对话示例见 [test-execution.md](test-execution.md)。
> 示例输出为示意，实际字段以脚本输出为准。

## 阶段目标

- 执行阶段 1 设计的验收测试用例（UAT-001~050），按用户场景验证需求匹配度。
- 由真实测试运行器（端到端 UI 自动化 / 用户场景脚本）执行，**禁止 LLM 估算**结果。
- RTM 终检：所有需求 → 设计 → 代码 → 四级测试全部建立映射，覆盖率 100%。
- 项目归档：归档目录完整性 + openspec 归档校验，用户确认后完成交付。

## 输入工件清单

| 工件 | 路径（示例） | 说明 |
|---|---|---|
| 验收测试设计文档 | `docs/phase1-requirements/behavior-spec.md` + `docs/test-cases/acceptance/*.md` | 阶段 1 产出 |
| 完整系统 | `src/**` + `tests/acceptance/*.test.ts` | 系统测试通过前置 |
| UAT 路径映射表 | `docs/uat-path-mapping.md` | 阶段 1 初始模板 → 阶段 5 回填路径 → 阶段 8 校验完整性 |
| BDD 验收层 features | `.w-model/bdd-manifest.json` | L1 features，D5 step 绑定校验 |
| cucumber 报告 | `reports/cucumber/acceptance.json` | 真实测试运行器输出 |
| RTM | `.w-model/rtm.json` | `acceptanceTest` 列待回填（四级全齐） |
| 归档目录 | `docs/archive/` | 各阶段强制快照文件 |

产出：验收测试报告（套用 `templates/test-report.md`，含用户确认区 `confirm` / `confirm-with-comments` / `reject`）、RTM acceptanceTest 回填、归档产物。

## 门禁脚本与命令行

阶段 8 完成时，G 子代理依次运行：

```bash
# 1) 工件质量门终检（不传 --phase，默认 --phase=8）：RTM 覆盖率 100% + 四级测试全部通过
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts .

# 2) 归档完整性：校验归档目录包含各阶段强制快照文件
npx tsx w-model-dev/scripts/cli/check-archive-integrity.ts docs/archive

# 3) BDD 验收层校验（D5 step 绑定，cucumber 报告驱动）
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json \
  --phase=8 --cucumber-report=reports/cucumber/acceptance.json

# 4) openspec 归档校验（阶段 8 终检另含）
npx tsx w-model-dev/scripts/cli/check-openspec-archive.ts . --phase 8
```

> 阶段 8 附加门禁：`check-codegraph-queries.ts` / `check-opsx-artifacts.ts`；评审证据经 `check-verifier-output.ts` 回填。

## 预期输出（示例输出）

### 退出码 0（全部通过 → 交付放行）

```
════════════════════════════════════════════════════════════
工件质量门校验（Artifact Gate）终检
RTM 覆盖率    : 100%
四级测试      : 单元 18/18、集成 5/5、系统 5/5、验收 50/50
校验结果      : ✓ 通过
════════════════════════════════════════════════════════════
GATE_JSON {"type":"artifact","passed":true,"coveragePercent":100,"reasons":[]}

ARCHIVE_INTEGRITY_JSON {"type":"archive-integrity","passed":true,"checkedFiles":14,"missingFiles":[]}
```

→ 全部退出码 0 → 🔴 CHECKPOINT · 交付放行（用户签字确认后项目完成）。

### 退出码 1（校验失败示例）

```
✗ 验收测试回填缺失：executionSummary.acceptanceTest 不存在（UAT-001~050 未回填）
GATE_JSON {"type":"artifact","passed":false,"coveragePercent":100,"reasons":["acceptanceTest 未回填"]}

✗ 归档缺失：docs/archive/phase1-requirement-spec.md 不存在
ARCHIVE_INTEGRITY_JSON {"type":"archive-integrity","passed":false,"checkedFiles":14,"missingFiles":["docs/archive/phase1-requirement-spec.md"]}
```

→ 退出码 1：测试失败（UAT 用例 ❌）→ `/wm test type=验收 result=fail` 回到阶段 5 返工；归档缺失 → 补齐归档快照后重跑。

### 退出码 2（输入错误示例）

```
ERROR_JSON {"category":"FILE_NOT_FOUND","rule":"P0-2","message":"目录不存在","file":"<abs路径>"}
```

→ 退出码 2：目录 / 文件缺失或非法，修正后重跑。

## 编排说明

- 阶段 8 是 8 阶段串行流程的终点：阶段 1→8 每阶段门禁通过才放行，本阶段完成后项目交付。
- 用户确认记录于验收测试报告「用户确认」区（`confirm` / `confirm-with-comments` / `reject`），不得使用未定义的 `/wm sign` 命令。
- 归档通过后可执行 `/wm export` 导出项目快照。

## 要点

- 终检 `check-artifact-gate.ts` 不传 `--phase`（默认 8）——这是与阶段 6/7 `--phase=N` 的区别，阶段级门禁不得用终检替代（反模式 #21 的逆向）。
- `check-archive-integrity` 与 `check-openspec-archive` 仅在阶段 8 归档时运行。
- 全部门禁退出码 0 + 用户确认，RTM 四级测试列全 ✅，项目完成。
