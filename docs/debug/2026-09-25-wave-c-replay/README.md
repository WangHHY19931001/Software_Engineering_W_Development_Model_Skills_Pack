# Wave C demo 重建重放证据（2026-09-27 执行）

## 命令与前置

```bash
git status --porcelain   # 空（前置：HEAD=a2bf181c，先提交后重建）
python eval/e2e/demo-assets/build_workspace.py --reset --accept-state-loss
cd eval/e2e/demo-assets && bash run_trajectory.sh
bash run_negative_probes.sh
```

## 前置说明

- 首次重放因工作树含未提交 SSoT/data-models 编辑，p5/p6 artifact-gate scope 校验实测拦截（实际变更未在 changedFiles 声明 ×2）——验证了「先提交再重建」前置（plan Task 19 步骤 1）。
- 中止作废运行后，装配器销毁前护栏自动快照部分运行态至 eval/e2e/demo-snapshots/20260926T184833Z（gitignored），真证据已入库 docs/debug/2026-09-23-wm-8phase-live-run/，裁定可丢弃，显式 --accept-state-loss 重建。
- 重建后 change-scope 绑定 a2bf181c（HEAD），changedFiles = 文档提交 2 文件（docs/skill-design-document_SSoT.md + w-model-dev/references/data-models.md，均非 code/test 文件 → codegraph 覆盖义务空集）。

## 结果

- 轨迹：**TOTAL_GATE_RUNS=119 / NONZERO_EXIT_COUNT=0**（`✓ 119/119 exit 0`）
- 探针：**9/9 被拦截 + 恢复复绿**（sigchain-tamper / runlog-missing-closure / tla-invariant-tlc / tla-phase-mismatch / graph-blackhole / verifier-floor / rtm-codemodule / checkpoint-vague / cucumber-failed）
- 原始日志：瞬态工作区 eval/e2e/demo/.replay/{trajectory,negative-probes}.log（gitignored，重建即毁）；关键摘录见 replay.txt / negative-probes.txt
