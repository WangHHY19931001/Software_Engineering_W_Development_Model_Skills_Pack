#!/usr/bin/env bash
# W-Model 8 阶段全流程调测轨迹驱动（O 角色模拟：状态经 wm-write 演化；门禁真实执行）
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
CLI="$REPO_ROOT/w-model-dev/scripts/cli"
WS="${WORKSPACE:-$REPO_ROOT/eval/e2e/demo}"
LOG="${LOG:-$WS/.replay/trajectory.log}"
mkdir -p "$(dirname "$LOG")"
TMPD="$(dirname "$LOG")"
cd "$WS"

R() { # R <label> <cmd...>
  local label="$1"; shift
  echo "" >> "$LOG"; echo "[$label] \$ $*" >> "$LOG"
  local out c
  out=$("$@" 2>&1); c=$?
  printf '%s\n' "$out" | tail -4 >> "$LOG"
  echo "[$label] EXIT_CODE=$c" >> "$LOG"
}

stage_setup() { # stage_setup <phase> <status>
  local p="$1" status="$2"
  cp ".w-model/ingestion/graph.p$(( p > 4 ? 4 : p )).json" "$TMPD/graph-stage.json"
  R "p${p}-O-wm-write-graph" npx tsx "$CLI/wm-write.ts" ".w-model/ingestion/graph.json" --from "$TMPD/graph-stage.json" --lock-timeout 10000 --allow-untyped
  if [ "$p" -le 4 ]; then
    R "p${p}-O-wm-write-tla" npx tsx "$CLI/wm-write.ts" ".w-model/tla-manifest.json" --from ".w-model/tla-manifest.p${p}.json" --lock-timeout 10000 --allow-untyped
    # S-fix：L1 文件头 @child 与 manifest 阶段形态同步（p1=null，p2+=L2）
    if [ "$p" -eq 1 ]; then cp tla/L1_counter.p1.tla tla/L1_counter.tla; else cp tla/L1_counter.p2plus.tla tla/L1_counter.tla; fi
    R "p${p}-O-wm-write-bdd" npx tsx "$CLI/wm-write.ts" ".w-model/bdd-manifest.json" --from ".w-model/bdd-manifest.p${p}.json" --lock-timeout 10000 --allow-untyped
  fi
  if [ "$p" -ge 5 ]; then
    R "p${p}-O-wm-write-bdd" npx tsx "$CLI/wm-write.ts" ".w-model/bdd-manifest.json" --from ".w-model/bdd-manifest.p4.json" --lock-timeout 10000 --allow-untyped
  fi
  python - "$p" "$status" <<'PY' > "$TMPD/project-stage.json"
import json, sys
d = json.load(open('.w-model/project.json', encoding='utf-8'))
d['status'] = sys.argv[2]
json.dump(d, sys.stdout, ensure_ascii=False, indent=2)
PY
  R "p${p}-O-wm-write-project" npx tsx "$CLI/wm-write.ts" ".w-model/project.json" --from "$TMPD/project-stage.json" --lock-timeout 10000
}

closure_gates() { # closure_gates <phase>（闭环五脚本 + role-dispatch + signature-chain）
  local p="$1"
  R "p${p}-G-budget" npx tsx "$CLI/check-budget.ts" .w-model/budget.json --project=.w-model/project.json --run-log=.w-model/run-log.jsonl --phase="$p"
  R "p${p}-G-run-log" npx tsx "$CLI/check-run-log.ts" .w-model/run-log.jsonl
  R "p${p}-G-maturity" npx tsx "$CLI/check-maturity.ts" .w-model/maturity.json --project=.w-model/project.json
  R "p${p}-G-checkpoint" npx tsx "$CLI/check-checkpoint.ts" .w-model/run-log.jsonl --checkpoint-log=.w-model/checkpoint-log
  R "p${p}-G-preventive" npx tsx "$CLI/check-preventive-review.ts" . --phase="$p" --variant=standard
  R "p${p}-G-role-dispatch" npx tsx "$CLI/check-role-dispatch.ts" .w-model/run-log.jsonl
  R "p${p}-G-signature-chain" npx tsx "$CLI/check-signature-chain.ts" .w-model/signature-chain.jsonl
}

: > "$LOG"
echo "### W-Model 8 阶段全流程调测轨迹（counter-api demo，$(date -Iseconds)）###" >> "$LOG"

# ---------- 阶段 1 需求分析 ----------
stage_setup 1 需求分析
R "p1-G-graph" npx tsx "$CLI/check-requirement-graph.ts" .w-model/ingestion/graph.json --phase=1
R "p1-G-tla" npx tsx "$CLI/check-tla-model.ts" .w-model/tla-manifest.json --phase=1
R "p1-G-bdd" npx tsx "$CLI/check-bdd-model.ts" .w-model/bdd-manifest.json --phase=1 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json
R "p1-G-verifier" npx tsx "$CLI/check-verifier-output.ts" .w-model/verifier-outputs/phase-1.json
R "p1-G-artifact-gate" npx tsx "$CLI/check-artifact-gate.ts" . --phase=1
closure_gates 1

# ---------- 阶段 2 系统设计 ----------
stage_setup 2 系统设计
R "p2-G-graph" npx tsx "$CLI/check-requirement-graph.ts" .w-model/ingestion/graph.json --phase=2
R "p2-G-tla" npx tsx "$CLI/check-tla-model.ts" .w-model/tla-manifest.json --phase=2 --graph=.w-model/ingestion/graph.json
R "p2-G-bdd" npx tsx "$CLI/check-bdd-model.ts" .w-model/bdd-manifest.json --phase=2 --graph=.w-model/ingestion/graph.json --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json
R "p2-G-verifier" npx tsx "$CLI/check-verifier-output.ts" .w-model/verifier-outputs/phase-2.json
R "p2-G-artifact-gate" npx tsx "$CLI/check-artifact-gate.ts" . --phase=2
closure_gates 2

# ---------- 阶段 3 概要设计 ----------
stage_setup 3 概要设计
R "p3-G-graph" npx tsx "$CLI/check-requirement-graph.ts" .w-model/ingestion/graph.json --phase=3
R "p3-G-tla" npx tsx "$CLI/check-tla-model.ts" .w-model/tla-manifest.json --phase=3 --graph=.w-model/ingestion/graph.json
R "p3-G-bdd" npx tsx "$CLI/check-bdd-model.ts" .w-model/bdd-manifest.json --phase=3 --graph=.w-model/ingestion/graph.json --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json
R "p3-G-verifier" npx tsx "$CLI/check-verifier-output.ts" .w-model/verifier-outputs/phase-3.json
R "p3-G-artifact-gate" npx tsx "$CLI/check-artifact-gate.ts" . --phase=3
closure_gates 3

# ---------- 阶段 4 详细设计 ----------
stage_setup 4 详细设计
R "p4-G-graph" npx tsx "$CLI/check-requirement-graph.ts" .w-model/ingestion/graph.json --phase=4
R "p4-G-tla" npx tsx "$CLI/check-tla-model.ts" .w-model/tla-manifest.json --phase=4 --graph=.w-model/ingestion/graph.json
R "p4-G-bdd" npx tsx "$CLI/check-bdd-model.ts" .w-model/bdd-manifest.json --phase=4 --graph=.w-model/ingestion/graph.json --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json
R "p4-G-verifier" npx tsx "$CLI/check-verifier-output.ts" .w-model/verifier-outputs/phase-4.json
R "p4-G-artifact-gate" npx tsx "$CLI/check-artifact-gate.ts" . --phase=4
closure_gates 4

# ---------- 阶段 5 编码实现 ----------
stage_setup 5 编码
R "p5-G-verifier" npx tsx "$CLI/check-verifier-output.ts" .w-model/verifier-outputs/phase-5.json
R "p5-G-bdd" npx tsx "$CLI/check-bdd-model.ts" .w-model/bdd-manifest.json --phase=5 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=.w-model/bdd/reports/report.json
R "p5-G-artifact-gate" npx tsx "$CLI/check-artifact-gate.ts" . --phase=5 --scope=.w-model/change-scope.p5.json
closure_gates 5

# ---------- 阶段 6 集成测试 ----------
stage_setup 6 集成测试
R "p6-G-verifier" npx tsx "$CLI/check-verifier-output.ts" .w-model/verifier-outputs/phase-6.json
R "p6-G-bdd" npx tsx "$CLI/check-bdd-model.ts" .w-model/bdd-manifest.json --phase=6 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=.w-model/bdd/reports/report.json
R "p6-G-artifact-gate" npx tsx "$CLI/check-artifact-gate.ts" . --phase=6 --scope=.w-model/change-scope.p6.json
closure_gates 6

# ---------- 阶段 7 系统测试 ----------
stage_setup 7 系统测试
R "p7-G-verifier" npx tsx "$CLI/check-verifier-output.ts" .w-model/verifier-outputs/phase-7.json
R "p7-G-bdd" npx tsx "$CLI/check-bdd-model.ts" .w-model/bdd-manifest.json --phase=7 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=.w-model/bdd/reports/report.json
R "p7-G-artifact-gate" npx tsx "$CLI/check-artifact-gate.ts" . --phase=7 --scope=.w-model/change-scope.p7.json
closure_gates 7

# ---------- 阶段 8 验收测试 + 终检 + 归档 ----------
stage_setup 8 验收测试
R "p8-G-verifier" npx tsx "$CLI/check-verifier-output.ts" .w-model/verifier-outputs/phase-8.json
R "p8-G-bdd" npx tsx "$CLI/check-bdd-model.ts" .w-model/bdd-manifest.json --phase=8 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=.w-model/bdd/reports/report.json
R "p8-G-artifact-gate-final" npx tsx "$CLI/check-artifact-gate.ts" . --phase=8 --scope=.w-model/change-scope.p8.json
R "p8-G-archive-integrity" npx tsx "$CLI/check-archive-integrity.ts" archive/2026-09-19-counter-api
closure_gates 8

# ---------- 收尾状态：项目完成 ----------
python - <<'PY' > "$TMPD/project-final.json"
import json, sys
d = json.load(open('.w-model/project.json', encoding='utf-8'))
d['status'] = '项目完成'
json.dump(d, sys.stdout, ensure_ascii=False, indent=2)
PY
R "p8-O-wm-write-final" npx tsx "$CLI/wm-write.ts" ".w-model/project.json" --from "$TMPD/project-final.json" --lock-timeout 10000
R "final-O-wm-status" npx tsx "$CLI/wm-status.ts" .

echo "" >> "$LOG"; echo "### 轨迹执行完毕 $(date -Iseconds) ###" >> "$LOG"
TOTAL=$(grep -cE "EXIT_CODE=" "$LOG")
NONZERO=$(grep -cE "EXIT_CODE=[^0]" "$LOG")
echo "TOTAL_GATE_RUNS=$TOTAL" >> "$LOG"
echo "NONZERO_EXIT_COUNT=$NONZERO" >> "$LOG"
[ "$TOTAL" -eq 119 ] || { echo "✗ 期望 119 条执行，实测 $TOTAL"; exit 1; }
[ "$NONZERO" -eq 0 ] || { echo "✗ 存在 $NONZERO 条非零退出（见 $LOG）"; exit 1; }
echo "✓ 119/119 exit 0（日志：$LOG）"
