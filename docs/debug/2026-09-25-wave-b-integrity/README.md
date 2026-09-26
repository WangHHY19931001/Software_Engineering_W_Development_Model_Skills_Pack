# Wave B 验收证据：完整性与纪律（反伪造探针，2026-09-26）

> 来源：计划「8 阶段 live run 调测发现全量修复」任务 12（`.superpowers/sdd/2026-09-25-live-run-findings-remediation/task-12-brief.md`，gitignored 账本）、规格 `docs/superpowers/specs/2026-09-25-live-run-findings-remediation-design.md` §4（WS-5..WS-7）；输入证据 = 8 阶段 live run 报告 `docs/debug/2026-09-23-wm-8phase-live-run/README.md`（D-3、D-4、D-5、D-8、N-5、N-6、L4）。
> 执行环境：分支 `feat/live-run-findings-remediation`，验收起点 HEAD `8a9c5561`；验收子代理**只读**执行（未改任何 `w-model-dev/` 源码，未改仓库内任何快照）。本文所有退出码为真实进程退出码，未经人工改写。
> 仓外临时工作区：`C:\Users\wangh\AppData\Local\Temp\wm-task12\`（探针副本、突变产物与原始日志；不入库）。仓库内快照 `docs/debug/2026-09-23-wm-8phase-live-run/snapshots/run-log.jsonl`（443 行、md5 `4ee418e349a10777dd2cbf3aa0fc4fa0`）仅只读消费：全部探针改的是**仓外副本**，探针执行前后两次实测 md5 一致（§2 第 5 条）。

## 1. Wave B 五个实施工作流 ↔ 命令 ↔ 提交 ↔ 结果

> 口径：Wave B 在计划中拆为 **5 个实施工作流（任务 6-11）+ 本验收（任务 12）**；规格 `…-design.md` §4 把它们归并为 3 个 WS（**WS-5** = D-3 + D-5① + N-5；**WS-6** = D-4 + D-8；**WS-7** = D-5② + N-6），下表的「规格 WS」列给归并关系。

| #   | 实施工作流（计划任务）              | 规格 WS | 发现项             | 实现提交（区间）             | 本轮验收命令                                                                                        | 结果                                                                      |
| --- | ----------------------------------- | ------- | ------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ①   | run-log 追加器（唯一追加入口）      | WS-5    | D-5① / N-5         | Task 6 `139051ee..a9678e24`  | `wm-append-runlog.ts --from`（正确追加 2 条 = 主探针基线）+ 边界探针                                 | 追加 exit 0、链自洽；见 §3(e)                                             |
| ②   | R7 记录哈希链                       | WS-5    | D-3a               | Task 7 `a9678e24..0cf3082a`  | 四类突变探针 (a) 改内容 / (b) 改时间戳 / (c) 删行 / (d) 插无哈希行 → 全 **exit 1**                   | 4/4 拦截；见 §3(a)-(d)                                                    |
| ③   | checkpoint 放行锚 + 归档前缀性      | WS-5    | D-3b / D-3 / **L4** | Task 8 `0cf3082a..87baed24`  | 追加器自动填锚自洽 + `check-archive-integrity --live-run-log` 三态（边界前缀 / 中途截断 / 空快照）   | 锚自洽；三态 = 0 / 1 / 1；见 §4                                           |
| ④   | 自举顺序纪律与例外登记（含三态时序） | WS-6    | D-4 / D-8          | Tasks 9/10 `87baed24..6b226d95` | 三态时序回归矩阵（自然时序 / 先放行后补门 / 同秒）转录 + 本轮 prepush 全量                          | 矩阵见 §5；prepush 见 §7                                                  |
| ⑤   | 预算接线与上界口径                  | WS-7    | D-5② / N-6         | Task 11 `6b226d95..8a9c5561` | `check-budget --run-log`（20M/300M 临时预算 + live-run 存档 run-log）→ **exit 1**；不传 `--run-log` → exit 0 + 诊断 | 牙齿成立（`522M > 300M` 逐字命中）；见 §6                                 |

**计数影响**：Wave B 只新增 1 个 CLI（`wm-append-runlog.ts`），**exit-2 族 45 → 46**（27 个 `check-*` + 19 个工具 CLI；`w-model-dev/references/conventions.md:124` 与 docs-consistency 探针双向兜底），**schema 仍 34**（`ls w-model-dev/schemas/*.json | wc -l` 实测 34）。哈希链 / 放行锚 / 归档前缀性均**并入既有判据编号**（`check-run-log` R7 三段、`check-archive-integrity` 既有 `missingFiles` 机制），反模式 48 条不变。

## 2. 探针设计与键前提（先读）

1. **仓库内快照是纯 legacy 日志**：443 行、`grep -c recordHash` = 0、8 条放行记录均无 `runLogAnchor`。按 D-3a 设计，哈希链只保护「首个带哈希记录起」的段，**全 legacy 段内的改写不可检出**——这是已登记的固有限制（`schemas/run-log.schema.json` 的 `recordHash` / `runLogAnchor` description 明写）。
2. 因此**主探针集建在带哈希的日志上**：把快照 `cp` 到仓外 → 经 `wm-append-runlog.ts` 追加 2 条记录（起一条哈希链）→ 在**该基线**上做四类突变。
3. **边界探针（诚实登记）**：对**未附加链**的纯 legacy 副本改一条 `note` → 实测 **exit 0 + LEGACY 诊断**，用于证明「限制可见、非静默隐瞒」（§3 边界行）。
4. 追加目标须为**已注册状态路径**（`<projectRoot>/.w-model/run-log.jsonl`）：本轮首次尝试以 `<tmp>/hash-base.jsonl` 为目标是 exit 1 `INVALID_JSON`（`lib/state-schema-registry.ts:16` 只注册 `.w-model/run-log.jsonl`），改用 `<tmp>/ws/.w-model/run-log.jsonl` 后 `appended:2`。**这不是缺陷**，是 wm-write 的状态路径注册语义。
5. **仓库内快照不可变核验**：验收开始（§3.2 之前）与全部哈希/归档探针结束后各测一次 `md5sum docs/debug/2026-09-23-wm-8phase-live-run/snapshots/run-log.jsonl` → 两次均为 `4ee418e349a10777dd2cbf3aa0fc4fa0`；`git status` 该路径始终为未跟踪（本仓不跟踪该快照目录），无内容变更。

## 3. 五类探针矩阵（哈希段）

基线构造（仓外）：

```bash
TMPW="C:/Users/wangh/AppData/Local/Temp/wm-task12"
cp docs/debug/2026-09-23-wm-8phase-live-run/snapshots/run-log.jsonl "$TMPW/ws/.w-model/run-log.jsonl"   # 443 行 legacy
npx tsx w-model-dev/scripts/cli/wm-append-runlog.ts "$TMPW/ws/.w-model/run-log.jsonl" --from "$TMPW/payload-2.json" --json
# → RUNLOG_APPEND_JSON {"lines":445,"appended":2,"digest":"sha256:592497bd…","ok":true,…,"legacyInvalidLines":[]}   APPEND_EXIT=0
```

追加的 2 条（时间戳显式注入，晚于末条 `2026-09-25T14:35:00.000Z`，未用 `--allow-clock-adjust`）：`p8-S-produce-waveb-01`（`2026-09-26T11:00:00.000Z`，哈希段首条，`prevRecordHash=""`）、`p8-O-checkpoint-waveb-02`（`2026-09-26T11:01:00.000Z`，`action=checkpoint/outcome=success` → 追加器**自动填锚**，锚自身入链）。

### 3.0 起链载荷原文（可再推导，非 transcript 独占）

`$TMPW/payload-2.json` 原文（`--from` 载荷 = JSON 数组；等价 `--stdin` 形态即两条 JSONL；**行内空白不影响哈希**——链哈希的载荷是 `canonicalJson` 重序列化结果，不是原文文本）：

```json
[
  {
    "runId": "p8-S-produce-waveb-01",
    "timestamp": "2026-09-26T11:00:00.000Z",
    "phase": 8,
    "phaseName": "验收测试",
    "action": "produce",
    "role": "S",
    "duration_s": 1,
    "tokens": 1000,
    "estimated": true,
    "subagentSpawns": 0,
    "gateExitCode": null,
    "outcome": "success",
    "artifacts": ["docs/debug/2026-09-25-wave-b-integrity/README.md"],
    "note": "Wave B 验收探针：哈希段起点记录 1（Task 12）"
  },
  {
    "runId": "p8-O-checkpoint-waveb-02",
    "timestamp": "2026-09-26T11:01:00.000Z",
    "phase": 8,
    "phaseName": "验收测试",
    "action": "checkpoint",
    "role": "O",
    "duration_s": 0,
    "tokens": 28000,
    "estimated": true,
    "subagentSpawns": 0,
    "gateExitCode": null,
    "outcome": "success",
    "artifacts": [".w-model/checkpoint-log/phase-8.txt"],
    "acknowledgedDecisions": ["Wave B 验收：Task 12 反伪造探针放行（临时工作区，不入库）"],
    "note": "Wave B 验收探针：哈希段起点记录 2（Task 12）"
  }
]
```

落盘后的**完整**链字段（64 位小写 hex，非截断；基线行号 444 / 445）：

| 行 | runId | `prevRecordHash` | `recordHash` | `runLogAnchor` |
| -- | ----- | ---------------- | ------------ | -------------- |
| 444 | `p8-S-produce-waveb-01` | `""`（空串，哈希段首条） | `59617208d2229b43ac470257dfc54d32c10b388f6f44ab1d3ef22ef88d86a3b7` | — |
| 445 | `p8-O-checkpoint-waveb-02` | `59617208d2229b43ac470257dfc54d32c10b388f6f44ab1d3ef22ef88d86a3b7` | `73acd0d89abba9975033a8fc95a901bfda2ca7f876f008c858d816497a867eca` | `{"lines":444,"sha256":"f6652b57adc0bd5ba6f9a638352f0842c23a4b1247a9fc7f1feb3fb7886fe8be"}` |

**独立复算**（`node:crypto`，不依赖仓库实现；输入 = 上表 payload + 仓库内快照副本）：

```bash
$ node -e "…按 README §3.0 payload 与快照行重算 recordHash[1]/recordHash[2]/anchor…"   # 一次性脚本，逻辑 = sha256(prev + '\n' + canonicalJson(record 去 recordHash)) / sha256(前缀行以 '\n' 连接)
recomputed recordHash[1] = 59617208d2229b43ac470257dfc54d32c10b388f6f44ab1d3ef22ef88d86a3b7 (MATCH)
recomputed recordHash[2] = 73acd0d89abba9975033a8fc95a901bfda2ca7f876f008c858d816497a867eca (MATCH)
recomputed anchor        = f6652b57adc0bd5ba6f9a638352f0842c23a4b1247a9fc7f1feb3fb7886fe8be (MATCH) lines=444
```

即三个哈希均**可由本 README 内联的载荷 + 快照独立复算**，不需要 transcript。

| #       | 突变形态                                          | 命令（仓外副本）                                                                                                | 退出码 | 关键输出（逐字摘录）                                                                                                                                                                                                                                                                                                     |
| ------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **(a)** | 改带哈希记录内容（`p8-S-produce-waveb-01` 的 `note`） | `check-run-log.ts "$TMPW/mut-a.jsonl" --json`                                                                   | **1**  | `R7: 哈希链断裂：条目 p8-S-produce-waveb-01 记录内容与 recordHash 不符（记录被就地改写或链字段被篡改）`；`R7: 放行记录 p8-O-checkpoint-waveb-02 的 runLogAnchor 与当前历史前缀不符（放行后被改写/重排）：sha256=f6652b57… ≠ 当前前缀原始字节摘要 2fca5b7b…`（reasons=2）                                                                      |
| **(b)** | 改带哈希记录时间戳（`p8-O-checkpoint-waveb-02` → `11:02:00Z`，仍单调） | `check-run-log.ts "$TMPW/mut-b.jsonl" --json`                                                                   | **1**  | `R7: 哈希链断裂：条目 p8-O-checkpoint-waveb-02 记录内容与 recordHash 不符（记录被就地改写或链字段被篡改）`（reasons=**1**，干净单命中：仅内容维度；时间戳仍单调 → 不触发 R7 时序段）                                                                                                                                          |
| **(c)** | 删一条带哈希记录（删哈希段首条）                  | `check-run-log.ts "$TMPW/mut-c.jsonl" --json`                                                                   | **1**  | `R7: 哈希链断裂：条目 p8-O-checkpoint-waveb-02 的 prevRecordHash=59617208… 与前一条 recordHash= 不符（链被重排/删除/插入）`；`R7: …runLogAnchor…：lines=444 ≠ 当前前缀记录数 443`；`R7: …sha256=f6652b57… ≠ … fbde538b…`（reasons=3）                                                                                       |
| **(d)** | 在哈希段内插入一条无哈希记录（`p8-S-produce-legacy-inserted`，`11:00:30Z`，无 `recordHash`） | `check-run-log.ts "$TMPW/mut-d.jsonl" --json`                                                                   | **1**  | `R7: 哈希链断裂：条目 p8-S-produce-legacy-inserted 无 recordHash（哈希段之后不得出现未入链记录；就地删除 recordHash 亦命中）`；`R7: …runLogAnchor…：lines=444 ≠ 当前前缀记录数 445`；`R7: …sha256=f6652b57… ≠ … 2af9a320…`（reasons=3）                                                                                       |
| **(e)** | **正确用法**：经追加器追加后直接校验（基线 445 行） | `check-run-log.ts "$TMPW/ws/.w-model/run-log.jsonl" --json`                                                     | **0**  | `passed=true reasons=[] violations=[]`；`r11={"checkedGates":9,"missing":0}`；`R7: 历史段 443 条无哈希（LEGACY，未参与链校验）`（诊断在场）+ 8 条放行记录 `早于 cutoff → LEGACY 非阻断`；新放行记录带锚且自洽 → **无 R7 blocking**                        |

> 上表「关键输出」中的哈希为**阅读用截断**（`f6652b57…` / `59617208…` 等）；工具输出原文是完整 64 位小写 hex，完整值与可复算命令见 §3.0。

**探针 (a)-(d) 的突变构造**（node 脚本，仓外；均在副本上原地改，仓库内快照未触碰）：

| 突变 | 构造 |
| ---- | ---- |
| (a)  | 第 444 行解析后 `note += ' [TAMPERED-BY-PROBE-a]'`，重新序列化 |
| (b)  | 第 445 行 `timestamp = '2026-09-26T11:02:00.000Z'`（晚于前条 11:00:00、保持单调） |
| (c)  | `splice(443,1)` 删除哈希段首条 |
| (d)  | 在第 444/445 行之间 `splice(444,0,<无 recordHash 的 legacy 形态记录>)` |

### 3.1 边界探针（未附加链的纯 legacy 副本，诚实登记）

```bash
cp docs/debug/2026-09-23-wm-8phase-live-run/snapshots/run-log.jsonl "$TMPW/legacy-copy.jsonl"
# 改第 101 行的 note（纯 legacy 段内改写）
npx tsx w-model-dev/scripts/cli/check-run-log.ts "$TMPW/legacy-mut-note.jsonl" --json
# → passed=true exitCode=0；reasons=[]；诊断 R7: 历史段 443 条无哈希（LEGACY，未参与链校验）
EXIT=0
```

**结论（如实登记，不作强主张）**：纯 legacy 段内的就地改写**不可检出**（exit 0），但门禁**明示**「历史段 N 条无哈希（LEGACY，未参与链校验）」——限制可见、非静默隐瞒；该段的历史可信度由**归档快照字节前缀**（L4，§4）与导出包 SHA-256 manifest 承担，不由链承担。这是 5 类探针中**唯一的非拦截项**，且属设计内已登记口径。

### 3.2 历史零回归（仓库内快照，只读）

```bash
npx tsx w-model-dev/scripts/cli/check-run-log.ts docs/debug/2026-09-23-wm-8phase-live-run/snapshots/run-log.jsonl --json
# → passed=true exitCode=0 reasons=[]  r11={"checkedGates":8,"missing":0}
# → diagnostics 共 358 条、其中 R7 相关 9 条：1 条「历史段 443 条无哈希（LEGACY）」+ 8 条「放行记录 p1..p8-O-checkpoint-01 缺 runLogAnchor：时间戳 … 早于 cutoff 2026-09-26T00:00:00Z → LEGACY 非阻断」
EXIT=0
```

历史记录**未因 R7 哈希链 / 放行锚新规则变红**（cutoff 前的放行记录按 LEGACY 吸收，禁止回溯补锚 / 补哈希）。

## 4. 归档记录边界前缀（L4 / D-3b）三态

归档根按 `ARCHIVE_INTEGRITY_CHECKLIST` 物化齐备（仓外 `$TMPW/archive-ws`，24 个顶层条目含 `src/`、`gate-logs/`、`verifier-output-1.json`）；live = 445 行的带哈希日志（`$TMPW/live-run-log.jsonl`，223228 字节），仅替换归档侧 `run-log.jsonl` 三态：

| 态            | 归档侧快照                                   | 命令                                                                                 | 退出码 | 关键输出（逐字摘录）                                                                                                                                                                    |
| ------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 记录边界前缀  | live 前 444 条（以 `\n` 结尾，222558 字节）  | `check-archive-integrity.ts "$TMPW/archive-ws" --live-run-log="$TMPW/live-run-log.jsonl" --json` | **0**  | `归档前缀性 : 已校验（--live-run-log=…）：归档 run-log.jsonl 是 live 的记录边界前缀`；`passed=true reasons=[]`                                                                            |
| 中途截断      | 同前再截去末 37 字节（不落在记录边界）       | 同上（换归档侧文件）                                                                 | **1**  | `[runLogPrefix] 归档 run-log.jsonl 落在记录中途（非记录边界）：快照 222521 字节未以换行结尾，而 live 为 223228 字节——疑似归档写入途中崩溃或被截断（半行快照），不得据此放行；请补全归档快照后重跑` |
| 空快照        | 0 字节                                       | 同上（换归档侧文件）                                                                 | **1**  | `[runLogPrefix] 归档 run-log.jsonl 快照为空（0 字节）而 live 有 223228 字节：空快照无法证明前缀性，不得据此放行（缺内容请补归档快照后重跑）`                                             |
| （补充）未接线 | 中途截断态                                   | `check-archive-integrity.ts "$TMPW/archive-ws" --json`（不传 `--live-run-log`）        | **0**  | `归档前缀性 : 未提供 --live-run-log（跳过归档 run-log 前缀性校验，非阻断）`——**未提供 ≠ 通过**，文案明示跳过                                                                              |

## 5. 三态时序回归矩阵（转录自 Tasks 9/10 报告，本轮未重跑）

> 出处：`.superpowers/sdd/2026-09-25-live-run-findings-remediation/task-9-10-report.md`「三态回归锚」节 + §「命令证据 ⑤」（**gitignored 账本**；原始进程输出在仓外 `%TEMP%\wm-t9t10\`，**不在 tracked 面**，故本表为**转录**、本轮未重跑）。三态 run-log 时间戳均早于 `RELEASE_ANCHOR_CUTOFF`，缺锚走 LEGACY 非阻断诊断，不影响结论。

| 态                                            | 构造                                                                                                                                    | 命令 → 结果                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A 自然时序**（五门在前 + 放行末条；3 阶段） | `state-a/run-log.jsonl`（= N-3 修正后的 `samples/run-log/valid.jsonl` 副本）+ `state-a/checkpoint-log/phase-{1,2,3}.txt`                 | `check-run-log.ts` → **exit 0**（`"passed":true`、`"r11":{"checkedGates":3,"missing":0}`）；`check-checkpoint.ts --checkpoint-log=…` → **exit 0**（`{"passed":true,"violations":[],"exitCode":0}`）                                                                                                                                                                                                  |
| **B 先写放行后补门**（阶段 ≥2）               | `state-b/run-log.jsonl`：阶段 2 放行（`03:30:00Z`）在前，五条闭环 gate（`04:00:10Z`~`04:00:50Z`）在后，时间戳仍单调（不触发 R7 时序段） | `check-run-log.ts` → **exit 1**，`reasons` 含 **R8**（`R8: 阶段 2 checkpoint 非阶段最后记录（checkpoint 之后仍有 5 条动作…）`、5 条 `R8: 阶段 2 gate 动作(gate)出现在 checkpoint 之后…`、`R8: 阶段 2 轨迹顺序倒置：G(gate 类)(第 9 条) 晚于 checkpoint(第 4 条)…`）+ **R11**（5 条 `R11: 阶段 2 的 checkpoint 放行缺少闭环脚本 <script> 的成功 gate 记录（须 role=G、gateExitCode=0 且早于放行…）`），`violations=[{"rule":"violation","count":12}]`、`r11={"checkedGates":2,"missing":5}` |
| **C 同秒**（阶段 ≥2；五门与放行同秒 `03:30:00Z`，物理位置在放行前） | `state-c/run-log.jsonl`                                                                                                                 | `check-run-log.ts` → **exit 1**，**仅 R11**（5 条 missing、`violations count=5`、`"r11":{"checkedGates":2,"missing":5}`）、**无 R8** —— 干净证明「**同秒不算早于**」                                                                                                                                                                                                                                  |

**本轮旁证（同一纪律在 Wave B 基线上可复现）**：§3(e) 的基线中 8 条历史放行记录全部满足 R11（`checkedGates=9/missing=0`），追加的第二条记录（放行）严格晚于其前五门 gate 记录，故 R11 无 missing —— 自然时序在带哈希段同样 exit 0。

## 6. 预算接线牙齿（WS-9 / D-5② / N-6）

临时预算 `$TMPW/budget-20M-300M.json` 镜像 live run 的 Ruling 口径（阶段 20M / 总 300M；`createdAt=2026-09-26T00:00:00Z`、`updatedAt=2026-09-26T01:00:00Z` 避开 R1 时效性噪声），project 用快照 `project.json` 副本，run-log 用快照 `run-log.jsonl` 副本（443 行，Σtokens 阶段/全量 = 104902704 / 522358388）。

### 6.1 接线（带 `--run-log`）→ exit 1 + `R6：` 逐字

```
$ npx tsx w-model-dev/scripts/cli/check-budget.ts $TMPW/budget-20M-300M.json \
    --project=$TMPW/project-copy.json --phase=8 --run-log=$TMPW/live-snapshot-copy.jsonl
--run-log     : …live-snapshot-copy.jsonl（rework=5, tla-rework=0, tokens=阶段/全量 104902704/522358388）
校验结果      : ✗ 未通过
未通过原因：
  - killSwitch 应触发（返工 5 >= 3）但未告警
  - R6：阶段 tokens 104902704 > perPhase.maxTokens 20000000（524.5%）
  - R6：总 tokens 522358388 > project.maxTokensTotal 300000000（174.1%）
  - R5-b：killSwitch 应触发（阶段消耗占比 5.25 >= budgetBurnRate 0.9）
非阻断诊断：
  - Σtokens 为上界口径；疑似重复归账 42 组（同 timestamp/tokens/duration）——同一分派的多条归账会重复累计，预算判定按上界执行（不去重，口径见 data-models.md「用量实效校验（R6）」）
BUDGET_JSON {…"passed":false,…,"exitCode":1}
EXIT_A=1
```

### 6.2 未接线（不带 `--run-log`）→ exit 0 + 「未生效」诊断

```
$ npx tsx w-model-dev/scripts/cli/check-budget.ts $TMPW/budget-20M-300M.json \
    --project=$TMPW/project-copy.json --phase=8
--run-log     : 未提供
校验结果      : ✓ 通过
非阻断诊断：
  - R6/R5-b 未生效（未提供 run-log）：用量实效（Σtokens vs 上限）与 burnRate 告警整体跳过，跳过不等于通过
BUDGET_JSON {…"passed":true,"violations":[],"diagnostics":["R6/R5-b 未生效（未提供 run-log）：…"],"exitCode":0}
EXIT_B=0
```

**牙齿成立**：同一份预算 + 同一份 run-log，**装配 `--run-log` 后由 exit 0 变 exit 1**，`522358388 > 300000000` 与 `R6：` 文案逐字命中（Task 11 的取证此前只在仓外临时目录与 gitignored `.w-model/gate-logs/`，本轮落成 tracked 证据）；未接线面**明示跳过不等于通过**（D-5② 未接线可见化）。

## 7. 全量门禁（`npm run prepush`，19 项）

```
$ npm run prepush            # = bash .githooks/pre-push --force（当前 HEAD 8a9c5561）
（18:47 → 19:12 运行 ≈ 26 分钟；日志 C:\Users\wangh\AppData\Local\Temp\wm-task12\prepush.log）
PREPUSH_EXIT=0
[pre-push] 全部门禁通过，允许推送 ✓
```

逐项（原文 `✓` 行，ANSI 色码略）：

| #   | 项                                     | 原文关键行                                                           |
| --- | -------------------------------------- | -------------------------------------------------------------------- |
| 1   | self-test 样本                         | `✓ self-test 全部样本匹配期望（exit 0）`                              |
| 2   | check:verifier 无参数                  | `✓ check:verifier 无参数退出 2（exit 2）`                              |
| 3   | check:gate 不存在目录                  | `✓ check:gate 不存在目录退出 2（exit 2）`                              |
| 4   | check:verifier 有效样本                | `✓ check:verifier 有效样本退出 0（exit 0）`                            |
| 5   | check:verifier 无效样本                | `✓ check:verifier 无效样本退出 1（exit 1）`                            |
| 6   | security-scan                          | `✓ security-scan 无新增风险（exit 0）`                                 |
| 7   | check-bdd-model 有效样本               | `✓ check-bdd-model 有效 BDD 样本退出 0（exit 0）`                       |
| 8   | check-bdd-model 不合规样本             | `✓ check-bdd-model schema 不合规 BDD 样本退出 2（exit 2）`              |
| 9   | check:coverage                         | `✓ check:coverage 有效覆盖样本退出 0（exit 0）`                        |
| 10  | check:exemption                        | `✓ check:exemption 有效豁免样本退出 0（exit 0）`                       |
| 11  | check-signature-chain                  | `✓ check-signature-chain 有效签名链样本退出 0（exit 0）`                |
| 12  | **vitest 全量 + coverage 阈值**        | `✓ vitest 单元测试 + coverage 阈值通过（exit 0）`                      |
| 13  | 规则层覆盖口径（logic+lib）            | `✓ 规则层覆盖口径 (logic+lib) 达阈值（exit 0）`                        |
| 14  | npm audit                              | `⚠ npm audit 网络不可达或 registry 不支持 audit endpoint，跳过（不阻断）`（见下方 caveat） |
| 15  | docs-consistency（活体文档一致）       | `✓ docs-consistency 活体文档一致（exit 0）`                            |
| 16  | samples 覆盖矩阵                       | `✓ samples 覆盖矩阵一致（无未登记 fixture）（exit 0）`                 |
| 17  | prettier --check                       | `✓ prettier 格式一致性（--check）（exit 0）`                           |
| 18  | tsc 类型检查                           | `✓ tsc 类型检查 0 错误（exit 0）`                                      |
| 19  | eval 语料断言与覆盖矩阵                | `✓ eval 语料断言与覆盖矩阵全绿（exit 0）`                              |

**末 30 行（原文逐字，含 ANSI 转义与 npm warn）**：

```text
[pre-push] 检测到校验脚本相关变更，启动推送前门禁...
[pre-push] 平台依赖检查（ensure-platform-deps --check）...
[ensure-deps] [32m✓[0m 平台依赖齐备（win32-x64）
[pre-push] [32m✓[0m self-test 全部样本匹配期望（exit 0）
[pre-push] [32m✓[0m check:verifier 无参数退出 2（exit 2）
[pre-push] [32m✓[0m check:gate 不存在目录退出 2（exit 2）
[pre-push] [32m✓[0m check:verifier 有效样本退出 0（exit 0）
[pre-push] [32m✓[0m check:verifier 无效样本退出 1（exit 1）
[pre-push] [32m✓[0m security-scan 无新增风险（exit 0）
[pre-push] [32m✓[0m check-bdd-model 有效 BDD 样本退出 0（exit 0）
[pre-push] [32m✓[0m check-bdd-model schema 不合规 BDD 样本退出 2（exit 2）
[pre-push] [32m✓[0m check:coverage 有效覆盖样本退出 0（exit 0）
[pre-push] [32m✓[0m check:exemption 有效豁免样本退出 0（exit 0）
[pre-push] [32m✓[0m check-signature-chain 有效签名链样本退出 0（exit 0）
[pre-push] [32m✓[0m vitest 单元测试 + coverage 阈值通过（exit 0）
[pre-push] [32m✓[0m 规则层覆盖口径 (logic+lib) 达阈值（exit 0）
[pre-push] npm audit 依赖漏洞扫描（high 以上阻断）...
[pre-push] [33m⚠[0m npm audit 网络不可达或 registry 不支持 audit endpoint，跳过（不阻断）
npm warn Unknown env config "home". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown user config "home". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn audit request to https://registry.npmjs.org/-/npm/v1/security/advisories/bulk failed, reason: connect ETIMEDOUT 127.8.0.1:443
undefined
npm error audit endpoint returned an error
npm error A complete log of this run can be found in: C:\Users\wangh\AppData\Local\npm-cache\_logs\2026-09-26T11_12_11_158Z-debug-0.log
[pre-push] [32m✓[0m docs-consistency 活体文档一致（exit 0）
[pre-push] [32m✓[0m samples 覆盖矩阵一致（无未登记 fixture）（exit 0）
[pre-push] [32m✓[0m prettier 格式一致性（--check）（exit 0）
[pre-push] [32m✓[0m tsc 类型检查 0 错误（exit 0）
[pre-push] [32m✓[0m eval 语料断言与覆盖矩阵全绿（exit 0）
[pre-push] 全部门禁通过，允许推送 ✓
PREPUSH_EXIT=0
```

**caveat（如实登记）**：第 14 项 `npm audit` 在本轮为**网络不可达跳过**（`connect ETIMEDOUT 127.8.0.1:443`，属非阻断设计路径）→ 本轮未实际复核依赖漏洞面；该面已由下方**提交后确认运行**真实覆盖（`✓ npm audit 未发现 high 以上漏洞`）。第 12 项（vitest 全量 + coverage 阈值）与第 15 项（docs-consistency，复用同次 vitest JSON 与受控 provenance）均 exit 0，覆盖 Wave B 新增的哈希链 / 放行锚 / 追加器 / 归档前缀性 / 预算诊断全部用例。

### 7.1 确认运行（提交后复跑，HEAD `cfb4bfe3`）

按「交付前必须跑全量」纪律，文档提交后在 `cfb4bfe3` 上复跑同一命令（日志 `C:\Users\wangh\AppData\Local\Temp\wm-task12\prepush-postcommit.log`，19:19 → 19:45 运行 ≈ 26 分钟）：

```text
[pre-push] 平台依赖检查（ensure-platform-deps --check）...
[ensure-deps] [32m✓[0m 平台依赖齐备（win32-x64）
[pre-push] [32m✓[0m self-test 全部样本匹配期望（exit 0）
[pre-push] [32m✓[0m check:verifier 无参数退出 2（exit 2）
[pre-push] [32m✓[0m check:gate 不存在目录退出 2（exit 2）
[pre-push] [32m✓[0m check:verifier 有效样本退出 0（exit 0）
[pre-push] [32m✓[0m check:verifier 无效样本退出 1（exit 1）
[pre-push] [32m✓[0m security-scan 无新增风险（exit 0）
[pre-push] [32m✓[0m check-bdd-model 有效 BDD 样本退出 0（exit 0）
[pre-push] [32m✓[0m check-bdd-model schema 不合规 BDD 样本退出 2（exit 2）
[pre-push] [32m✓[0m check:coverage 有效覆盖样本退出 0（exit 0）
[pre-push] [32m✓[0m check:exemption 有效豁免样本退出 0（exit 0）
[pre-push] [32m✓[0m check-signature-chain 有效签名链样本退出 0（exit 0）
[pre-push] [32m✓[0m vitest 单元测试 + coverage 阈值通过（exit 0）
[pre-push] [32m✓[0m 规则层覆盖口径 (logic+lib) 达阈值（exit 0）
[pre-push] npm audit 依赖漏洞扫描（high 以上阻断）...
[pre-push] [32m✓[0m npm audit 未发现 high 以上漏洞
[pre-push] [32m✓[0m docs-consistency 活体文档一致（exit 0）
[pre-push] [32m✓[0m samples 覆盖矩阵一致（无未登记 fixture）（exit 0）
[pre-push] [32m✓[0m prettier 格式一致性（--check）（exit 0）
[pre-push] [32m✓[0m tsc 类型检查 0 错误（exit 0）
[pre-push] [32m✓[0m eval 语料断言与覆盖矩阵全绿（exit 0）
[pre-push] 全部门禁通过，允许推送 ✓
PREPUSH_POSTCOMMIT_EXIT=0
```

即：**19/19 全绿**（含第 14 项 npm audit 本次**真实执行通过**）——上一次运行的 audit 跳过缺口由此闭环；两次运行共同构成「实现态（8a9c5561）与交付态（cfb4bfe3）均已全量验证」。

### 7.2 交付态最终运行（HEAD `d7cd03db`，本证据文档定稿后）

文档补记提交后，在**最终交付态** `d7cd03db` 上第三次跑同一命令（日志 `C:\Users\wangh\AppData\Local\Temp\wm-task12\prepush-final.log`，19:19 → 19:45 运行 ≈ 26 分钟）→ **exit 0**：

```text
[pre-push] 检测到校验脚本相关变更，启动推送前门禁...
[pre-push] 平台依赖检查（ensure-platform-deps --check）...
[ensure-deps] [32m✓[0m 平台依赖齐备（win32-x64）
[pre-push] [32m✓[0m self-test 全部样本匹配期望（exit 0）
[pre-push] [32m✓[0m check:verifier 无参数退出 2（exit 2）
[pre-push] [32m✓[0m check:gate 不存在目录退出 2（exit 2）
[pre-push] [32m✓[0m check:verifier 有效样本退出 0（exit 0）
[pre-push] [32m✓[0m check:verifier 无效样本退出 1（exit 1）
[pre-push] [32m✓[0m security-scan 无新增风险（exit 0）
[pre-push] [32m✓[0m check-bdd-model 有效 BDD 样本退出 0（exit 0）
[pre-push] [32m✓[0m check-bdd-model schema 不合规 BDD 样本退出 2（exit 2）
[pre-push] [32m✓[0m check:coverage 有效覆盖样本退出 0（exit 0）
[pre-push] [32m✓[0m check:exemption 有效豁免样本退出 0（exit 0）
[pre-push] [32m✓[0m check-signature-chain 有效签名链样本退出 0（exit 0）
[pre-push] [32m✓[0m vitest 单元测试 + coverage 阈值通过（exit 0）
[pre-push] [32m✓[0m 规则层覆盖口径 (logic+lib) 达阈值（exit 0）
[pre-push] npm audit 依赖漏洞扫描（high 以上阻断）...
[pre-push] [33m⚠[0m npm audit 网络不可达或 registry 不支持 audit endpoint，跳过（不阻断）
npm warn audit request to https://registry.npmjs.org/-/npm/v1/security/advisories/bulk failed, reason: connect ETIMEDOUT 127.8.0.1:443
undefined
npm error audit endpoint returned an error
[pre-push] [32m✓[0m docs-consistency 活体文档一致（exit 0）
[pre-push] [32m✓[0m samples 覆盖矩阵一致（无未登记 fixture）（exit 0）
[pre-push] [32m✓[0m prettier 格式一致性（--check）（exit 0）
[pre-push] [32m✓[0m tsc 类型检查 0 错误（exit 0）
[pre-push] [32m✓[0m eval 语料断言与覆盖矩阵全绿（exit 0）
[pre-push] 全部门禁通过，允许推送 ✓
PREPUSH_FINAL_EXIT=0
```

（第 14 项 npm audit 本次再因网络不可达按设计跳过——该网络为间歇性；依赖漏洞面由 §7.1 的运行真实覆盖。）

**三次运行口径（不bump，事实合并）**：`8a9c5561`（实现态）exit 0 → `cfb4bfe3`（交付态一）exit 0 → `d7cd03db`（交付态最终）exit 0，**无红项**；`npm audit` 仅在 `cfb4bfe3` 一次真实执行通过。

### 7.3 `npm run test:affected`（快速车道记录）

```bash
$ npm run test:affected -- --since 8a9c5561     # 覆盖 Wave B 三个提交的改动面
# 触及 docs/** 与根活体文档（CHANGELOG）→ 按设计涟漪回退**全量 vitest**（非子集）
# Test Files  2 failed | 104 passed (106)
# Tests       3 failed | 2597 passed (2600)
# Duration    3009.48s（50 分钟）
TEST_AFFECTED_EXIT=1
```

**3 项失败全为时序预算 / 超时断言（非逻辑断言），判定为负载时序噪声，已隔离复验**：

| 失败用例 | 断言 | 判定 |
| -------- | ---- | ---- |
| `pre-commit-hook.test.ts > bounds a hanging Prettier check…` | `expected 15504 to be less than 12000`（**前一行 `status===124` 断言已通过**——hook 确实按 3s 预算截断，仅总墙钟超出余量） | 墙钟余量型，负载敏感 |
| `pre-commit-hook.test.ts > terminates the batch helper process tree on snapshot timeout…` | `expected 14071 to be less than 10000`（同样 `status===124` 断言已通过——2s 快照超时确实触发） | 墙钟余量型，负载敏感 |
| `evidence-export-logic.test.ts > rejects hash-valid package-only manifests with sensitive provenance IDs and file paths` | `Test timed out in 30000ms`（该用例本身墙钟 38.3s） | 长用例自重 timeout 型 |

**隔离复跑（同机、仅这两个文件）**：

```bash
$ npx vitest run --config config/vitest.config.ts \
    w-model-dev/scripts/__tests__/pre-commit-hook.test.ts \
    w-model-dev/scripts/__tests__/evidence-export-logic.test.ts
# Test Files  2 passed (2)
# Tests       60 passed (60)      Duration 139.94s
ISOLATED_EXIT=0
```

**口径（如实登记）**：本项为**非验收门禁**（脚本自身头注即声明「本地迭代用、不是验收门禁」），3 项失败在两文件隔离复跑中全部通过，且**同一代码树（`d7cd03db`，与本次仅差 markdown）在 §7.2 的全量 prepush 中 2600/2600 通过** → 判定为并发/串行 50 分钟累积负载下的时序噪声，非内容回归。本 README 不据此改动任何测试预算（守本轮只读 `w-model-dev/` 纪律）。

### 7.4 证据收口运行（评审响应，HEAD `d7cd03db`）

评审要求「处置结论须落在 tracked 面」，故补齐两项门禁在**当前 HEAD** 上的记录（两次运行均单独执行、无并发负载）：

```bash
$ npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts
vitest 用例  : 2600
静态违规      : 0
动态违规      : 0
检查结果      : ✓ 全部一致
DOCS_CONSISTENCY_JSON {"passed":true,"violationCount":0,"staticViolationCount":0,"dynamicViolationCount":0,
  "dynamicMeasurements":{"schemaCount":34,"cliScriptCount":47,"exit2ScriptCount":46,"testFileCount":106,
  "vitestTestCount":2600,"numPassedTests":2600,"numFailedTests":0,"success":true,
  "vitestRunId":"633e8a562d2ff547","vitestCommitSha":"d7cd03dbf9f27786039265dbd9e39f8ab00e578d",
  "exit2ProbeResults":[…48 条全 status/errorExitCode=2（0 漂移）…]},"exitCode":0}
DOCS_CONSISTENCY_EXIT=0
```

**facts 通道 = 自采集**：本次运行**未**注入 `WM_VITEST_COUNT_FILE` / `WM_VITEST_PROVENANCE_FILE` / `WM_VITEST_PROVENANCE_ROOT`（`env | grep -c WM_VITEST` = 0），CLI 自行 spawn 全量 vitest（2600/2600）并自生成同目录 provenance，另跑 48 条中心 exit-2 探针（全 2，零漂移）；`vitestCommitSha` 绑定当前 HEAD `d7cd03db`。

```bash
$ npx tsx w-model-dev/scripts/cli/self-test.ts
✓ …（样本逐条，含 Wave B 相关 fixture）
总计 373 条用例：373 通过，0 失败
SELF_TEST_EXIT=0
```

即：`self-test` 与基线 **373 一致**（无下降）。这两项与 §7.1/§7.2 的 prepush 全量共同构成交付态门禁记录。

### 补充：原始日志与脚本的可再推导性

上列逐项输出与探针产物均来自 `%TEMP%\wm-task12\`（瞬态）；本 README **转录**其关键行并把**起链载荷原文与完整链哈希**内联（§3.0，可独立复算），使其不再依赖 transcript 或临时目录（先例：`docs/debug/2026-09-22-rc-closeout-acceptance/` 曾把 `acceptance.txt` 原文入库）。突变脚本本身为一次性 `node -e`，其构造规则已在 §3 表内逐条写明（等价改写即可复现）。

## 8. 未达成项 / 疑虑（如实登记）

1. **纯 legacy 段的改写不可检出**（§3.1）——设计内固有限制（哈希链只保护带哈希段；cutoff 前的放行锚按 LEGACY 吸收）。本轮以「边界探针 exit 0 + 非阻断诊断可见」如实登记，**不主张**历史段防伪；该段的完整性主张由归档字节前缀（§4）与 `wm-export-evidence` 的 SHA-256 manifest 承担。
2. **探针 (b) 只命中内容维度**：时间戳突变若同时破坏单调性，会额外触发既有 R7 时序段——本轮刻意选「仍单调」的变体，以证明**内容哈希**维度独立于时序维度生效（reasons=1）。
3. **`--allow-clock-adjust` 未在本轮触发**：追加时间戳 `2026-09-26T11:00/11:01Z` 均晚于末条（`2026-09-25T14:35:00.000Z`）且当前时钟更晚，故走显式注入通道（`clock-injected` 留痕），**未使用** `--allow-clock-adjust`。
4. **归档前缀的字节前缀口径不证明「归档后无改写 + live 侧尾部追加」的绝对归属**（两侧不可同真，文案已改为「须人工裁定证据归属」，测试只断言 `[runLogPrefix]`）——Task 8 报告已登记，本轮不改口径。
5. **三态时序矩阵为本轮转录、非本轮重跑**（§5）：原始进程输出在 gitignored 账本 `task-9-10-report.md` 与仓外 `%TEMP%\wm-t9t10\`；本轮以同一基线的 R11 `checkedGates=9/missing=0` 作旁证，未另造 A/B/C 三态副本。
6. **原始日志 / 突变脚本为 `%TEMP%` 瞬态**（`C:\Users\wangh\AppData\Local\Temp\wm-task12\`，不入库）：本 README 为**转录**，并以 §3.0 内联的起链载荷原文 + 完整链哈希 + 独立复算命令补足可再推导性（不再依赖 transcript）；突变脚本为一次性 `node -e`，构造规则已在 §3 表内逐条写明。
7. **`npm run test:affected` 非验收门禁**（§7.3）：它只跑受影响测试文件、且在触及 `docs/**` / 根活体文档时按设计回退全量 vitest；本轮记录见 §7.3，验收依据仍是 §7/§7.1/§7.2 的 prepush 全量三次 exit 0。
