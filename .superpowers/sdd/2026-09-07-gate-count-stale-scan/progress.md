# SDD ledger — plan: docs/superpowers/plans/2026-09-07-gate-count-stale-scan.md
Task 1: 裁决记录（计划级缺陷，控制器裁定）：简报正则 `(?<!第)(\d+)\s*项(?!目)` 对「第 13 项」（带空格）失效（(?<!第) 只看紧邻字符，空格通过）且「第13项」无空格时在数字中间误匹配「3项」（Node 亲身验证，比实现者报告更严重）；stale 测试断言 toContain('17 项门禁') 永不出现（消息为「17 项」）。裁定：采纳实现者 fix set 1——正则改 `(第\s*)?` 前缀捕获（m[1] 非 undefined 即序数跳过，m[2] 为计数），stale 断言放宽 toContain('17 项')。计划文件已同步修订。
Task 1: review — 规格 ✅（功能点全部对齐修正契约），Important ×1（正则字面量偏离契约 `((?:第)?\s*)(\d+)\s*项(?!目)`，误用 `(第\s*)?` 形态自造无先例 detect-unsafe-regex 放行）；Minor ×2（deferred: 补「第13项」无空格序数 + (?!目) 排除 + 混合行测试用例；lines[i]! 放行可用 entries() 消除、:1377 先例成立可保留）
Task 1: fix round 1/5 (1 addressed, 0 open — regex aligned to corrected contract, disable removed; commits c9b0e80..efc99fc)
Task 1: complete (commits 59b3507..efc99fc, review clean after 1 fix round)
Task 2: complete (commits efc99fc..8830976, review clean; post-review focused real CLI rerun exit 0, static/dynamic violations 0, Vitest 1608/1608)
Task 3: implementer DONE_WITH_CONCERNS — commit de1e258，聚焦 Vitest 169/169、prettier unchanged、工作树干净；concern = checkout 无 .codegraph 索引，修改前影响查询无法生成，已按工具指示用文件工具聚焦检查（环境问题）
Task 3: complete (commits 8830976..de1e258, review clean; codegraph unavailable due missing .codegraph index, recorded as environment concern)
Task 4: BLOCKED — real npm run prepush exit 1; run-sync.test.ts found SYNC_PROCESS_EXCEPTIONS line 2487 vs actual 2488 (Task 3 EXPECTED import shifted all 8 direct calls +1: 2487→2488, 2490→2491, 2496→2497, 2499→2500, 2506→2507, 2507→2508, 2559→2560, 2582→2583). Root cause confirmed via source/blame/manifest comparison. Required fix modifies w-model-dev/scripts/lib/run-sync.ts, outside Task 4 brief and Task 3 completed scope; awaiting human ruling per SDD plan-conflict rule.
Task 4: implementer BLOCKED→修复后 DONE_WITH_CONCERNS — initial governance commits 140f795/cdedbd0 + required audit-manifest repair 3157e75; final 18/18 prepush and eval 60/60 passed; concern = existing npm home warning + no codegraph index. Review scope includes approved plan amendment 7081d2c and final report append.
Task 4: review — 规格 ✅、实现与终验证据基本完整；Important ×1：task-4-report.md 顶部元数据仍为「最终 HEAD: cdedbd0 / 状态: BLOCKED」，与后文修复 commit 3157e75、prepush 18/18、eval 60/60 矛盾；须更新顶层元数据并明确提交列表（审查者要求）。无其他 Critical/Important/Minor。
Task 4: fix round 1/5 (1 addressed, 0 open — report top metadata reconciled with final HEAD/status, initial BLOCKED evidence retained; commits 3157e75..5fd4cde)
Task 4: complete (commits de1e258..5fd4cde, review clean after 1 fix round; final 18/18 prepush + eval 60/60)
Final review Important fix (2026-09-07): plan/spec still exposed the stale `(第\\s*)?` / `m[1] !== undefined` contract and the spec still described exclusion by `(?<!第)`; corrected both documents to the approved `((?:第)?\\s*)(\\d+)\\s*项(?!目)` contract with `m[1]!.includes('第')`, and labeled the intermediate form as deprecated history.
Modified files:
- `docs/superpowers/plans/2026-09-07-gate-count-stale-scan.md`
- `docs/superpowers/specs/2026-09-07-gate-count-stale-scan-design.md`
- This ledger: `.superpowers/sdd/2026-09-07-gate-count-stale-scan/progress.md`
Verification:
- `grep -n -E "\\(第\\\\s\\*\\)\\?\\(\\\\d\\+\\)|\\(\\?<\\!第\\)|m\\[1\\] !== undefined|被 .*\\(\\?<\\!第\\)" ...`: only the two explicitly labeled historical references remained; no current implementation or current semantic wording matched.
- `npx prettier --check --config config/prettier.config.cjs docs/superpowers/plans/2026-09-07-gate-count-stale-scan.md docs/superpowers/specs/2026-09-07-gate-count-stale-scan-design.md`: `All matched files use Prettier code style!` (npm emitted the existing `Unknown user config "home"` warning).
- `git diff --check`: passed.
Full prepush was not rerun because runtime code, allowlists, governance, and version were unchanged; the prior 18/18 evidence remains valid. Repair commit: `9676892` (`docs: align gate-count regex contract across spec and plan`). Re-review pending.
