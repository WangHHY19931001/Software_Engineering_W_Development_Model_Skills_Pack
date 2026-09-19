#!/usr/bin/env bash
# 负向篡改探针：在绿色终态上做最小突变 → 断言被真实拦截 → 恢复 → 复验绿
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
CLI="$REPO_ROOT/w-model-dev/scripts/cli"
WS="${WORKSPACE:-$REPO_ROOT/eval/e2e/demo}"
LOG="${LOG:-$WS/.replay/negative-probes.log}"
# cd 先于 mkdir：`mkdir -p` 会连带创建 $WS，若顺序相反则工作区缺失时 cd 仍成功，护栏失效
cd "$WS" || { echo "✗ 工作区不存在或不可进入：$WS（先运行 python build_workspace.py --reset）"; exit 1; }
mkdir -p "$(dirname "$LOG")"
FAILED=0
BACKUPS=()

backup() { cp "$1" "$1.probe-orig"; BACKUPS+=("$1"); }
restore_all() {
  [ "${#BACKUPS[@]}" -eq 0 ] && return 0
  for f in "${BACKUPS[@]}"; do [ -f "$f.probe-orig" ] && mv "$f.probe-orig" "$f"; done
  BACKUPS=()
}
# 信号（Ctrl-C / TERM）先恢复再中止：避免 restore_all 返回后循环继续跑完剩余探针
trap restore_all EXIT
trap 'restore_all; exit 1' INT TERM

# JSON 变异：mutate <file> <python 语句，作用域内有 d（已解析对象）>
mutate() {
  local f="$1"; local code="$2"
  backup "$f"
  python - "$f" "$code" <<'PY'
import json, sys
p, code = sys.argv[1], sys.argv[2]
d = json.load(open(p, encoding='utf-8'))
exec(code)
json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
PY
}

# JSONL 变异：mutate_jsonl <file> <python 语句，作用域内有 recs（记录列表）>
mutate_jsonl() {
  local f="$1"; local code="$2"
  backup "$f"
  python - "$f" "$code" <<'PY'
import json, sys
p, code = sys.argv[1], sys.argv[2]
recs = [json.loads(l) for l in open(p, encoding='utf-8') if l.strip()]
exec(code)
open(p, 'w', encoding='utf-8').write('\n'.join(json.dumps(r, ensure_ascii=False) for r in recs) + '\n')
PY
}

probe() { # probe <id> <cmd...>；断言 exit 1 且输出命中 $EXPECT
  local id="$1"; shift
  echo "[NP:$id] \$ $*" >> "$LOG"
  local out; out=$("$@" 2>&1); local c=$?
  printf '%s\n' "$out" | tail -4 >> "$LOG"
  echo "[NP:$id] EXIT_CODE=$c（期望 1；期望词「$EXPECT」）" >> "$LOG"
  if [ "$c" -ne 1 ]; then
    echo "[NP:$id] EXPECT_MATCH=no（exit≠1，未执行期望词断言）" >> "$LOG"
    echo "✗ [$id] exit=$c 期望 1"; FAILED=1; return 1
  fi
  # -e：EXPECT 可能以 "-" 开头（如 "--- D5 Step Binding: …"），裸 PATTERN 会被 grep 当选项（exit 2）
  # 判定结果写回日志（断言之后），使归档日志自证「命中期望词」而非只回显期望
  if printf '%s' "$out" | grep -q -e "$EXPECT"; then
    echo "[NP:$id] EXPECT_MATCH=yes" >> "$LOG"
  else
    echo "[NP:$id] EXPECT_MATCH=no" >> "$LOG"
    echo "✗ [$id] 未命中期望原因：$EXPECT"; FAILED=1; return 1
  fi
  echo "✓ [$id] 被拦截（命中「$EXPECT」）"
  return 0
}

: > "$LOG"
echo "### 负向篡改探针（9 项；绿色终态上最小突变，验后恢复）###" >> "$LOG"

# ---------- 1 签名链第 6 条 sigHash 置零 → R6 篡改检测 ----------
# 区分度：要求 R6 出现在「失败规则：」行；R6 通过而别条规则失败时它只出现在「通过规则：」行，不命中
EXPECT='失败规则：.*R6'
mutate_jsonl .w-model/signature-chain.jsonl "recs[5]['sigHash'] = 'sha256:' + '0' * 64"
probe sigchain-tamper npx tsx "$CLI/check-signature-chain.ts" .w-model/signature-chain.jsonl
restore_all

# ---------- 2 删除阶段 1 的 budget 闭环记录 → run-log R11 ----------
EXPECT='R11'
mutate_jsonl .w-model/run-log.jsonl "recs = [r for r in recs if r.get('runId') != 'p1-c-b']"
probe runlog-missing-closure npx tsx "$CLI/check-run-log.ts" .w-model/run-log.jsonl
restore_all

# ---------- 3 TLA 不变式真实违反 + manifest 自报全 true → 真实 TLC 拒绝 ----------
# 区分度：报告块无条件打印「不变式违反    : 无|N 条」；要求 N ≥ 1，故缺 Java/jar 导致的环境失败（无 → exit 1）不命中
EXPECT='不变式违反 *: *[1-9]'
backup tla/L2_counter_service.tla
python - <<'PY'
p = 'tla/L2_counter_service.tla'
src = open(p, encoding='utf-8').read()
needle = 'Inc == state = "zeroed"'
assert needle in src, '未找到 Inc 动作定义（工作区形态与预期不符）'
open(p, 'w', encoding='utf-8').write(
    src.replace('state\' = "counting"', 'state\' = "broken"', 1)
)
PY
mutate .w-model/tla-manifest.json "
for s in d['specs']:
    if s['id'] == 'L2_counter_service':
        s['syntaxChecked'] = True
        s['tlcChecked'] = True
        s['deadlockFree'] = True
        s['invariantsHold'] = True
"
probe tla-invariant-tlc npx tsx "$CLI/check-tla-model.ts" .w-model/tla-manifest.json --phase=4 --graph=.w-model/ingestion/graph.json
restore_all

# ---------- 4 phase 形态错配（后期 manifest 做前期校验）→ 层次校验，措辞须指后续阶段 ----------
EXPECT='属后续阶段'
probe tla-phase-mismatch npx tsx "$CLI/check-tla-model.ts" .w-model/tla-manifest.json --phase=1
restore_all

# ---------- 5 删除 DD-001 → EXT-OUT 信息流边 → 黑洞 ----------
EXPECT='黑洞'
mutate .w-model/ingestion/graph.json "
d['edges'] = [e for e in d['edges'] if not (e.get('from') == 'DD-001' and e.get('to') == 'EXT-OUT')]
"
probe graph-blackhole npx tsx "$CLI/check-requirement-graph.ts" .w-model/ingestion/graph.json --phase=4
restore_all

# ---------- 6 Verifier 单轴 0.93 → 0.5 → R13 单轴下限 ----------
EXPECT='单轴下限'
mutate .w-model/verifier-outputs/phase-5.json "d['subCriteria'][0]['score'] = 0.5"
probe verifier-floor npx tsx "$CLI/check-verifier-output.ts" .w-model/verifier-outputs/phase-5.json
restore_all

# ---------- 7 REQ-001 的 codeModule 置空 → RTM 追溯 ----------
EXPECT='codeModule'
mutate .w-model/rtm.json "
for r in d['rows']:
    if r.get('requirementId') == 'REQ-001':
        r['codeModule'] = ''
"
probe rtm-codemodule npx tsx "$CLI/check-artifact-gate.ts" . --phase=5 --scope=.w-model/change-scope.p5.json
restore_all

# ---------- 8 CHECKPOINT 决策改泛化短句 → R2/R4 ----------
EXPECT='R2'
mutate_jsonl .w-model/run-log.jsonl "
for r in recs:
    if r.get('runId') == 'p3-cp':
        r['acknowledgedDecisions'] = ['好']
"
probe checkpoint-vague npx tsx "$CLI/check-checkpoint.ts" .w-model/run-log.jsonl --checkpoint-log=.w-model/checkpoint-log
restore_all

# ---------- 9 cucumber 步骤改 failed → BDD D5 执行证据 ----------
# 区分度：报告块无条件打印「--- D5 Step Binding: N violations」；要求 N ≥ 1，故任何与 D5 无关的失败（0 violations）不命中
EXPECT='--- D5 Step Binding: [1-9]'
mutate .w-model/bdd/reports/report.json "d['elements'][0]['steps'][0]['result']['status'] = 'failed'"
probe cucumber-failed npx tsx "$CLI/check-bdd-model.ts" .w-model/bdd-manifest.json --phase=5 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=.w-model/bdd/reports/report.json
restore_all

# ---------- 恢复后回归复验 ----------
echo "" >> "$LOG"; echo "### 探针恢复后回归复验 ###" >> "$LOG"
for pair in "check-signature-chain.ts:.w-model/signature-chain.jsonl" "check-run-log.ts:.w-model/run-log.jsonl"; do
  s="${pair%%:*}"; a="${pair#*:}"
  out=$(npx tsx "$CLI/$s" "$a" 2>&1); c=$?
  echo "restore-check $s EXIT=$c" >> "$LOG"
  [ "$c" -eq 0 ] || { echo "✗ 恢复后 $s 未复绿（exit=$c）"; FAILED=1; }
done
# 恢复完整性自证：备份残留计数写入日志（0 = 所有 *.probe-orig 均已 mv 回原位）
echo "probe-orig residue count=$(find . -name '*.probe-orig' | wc -l | tr -d ' ')" >> "$LOG"

if [ "$FAILED" -eq 0 ]; then
  echo "✓ 9/9 探针被拦截 + 恢复复绿（日志：$LOG）"
else
  echo "✗ 探针失败（日志：$LOG）"; exit 1
fi
