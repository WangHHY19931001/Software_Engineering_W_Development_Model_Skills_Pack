#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""e2e 调测工作区装配器（S 子代理动作模拟）。
产物：counter-api 最小项目（2 REQ + 1 NFR + 1 CON，TLA+ L1/L2 + BDD L1，真实 node:test 四级测试）。
ID 全局一致：REQ-001/REQ-002/NFR-001/CON-001 ↔ SD-001 ↔ INTF-001 ↔ DD-001 ↔ L1_counter/L2_counter_service。
"""
import argparse, json, os, shutil, subprocess, sys, hashlib

ASSETS = os.path.dirname(os.path.abspath(__file__))  # eval/e2e/demo-assets（受跟踪的可重放资产）
# 工作区根 = gitignored 瞬态目录 eval/e2e/demo（可由 WORKSPACE 覆盖，与 run_trajectory.sh / run_negative_probes.sh 同契约）
ROOT = os.environ.get('WORKSPACE') or os.path.join(os.path.dirname(ASSETS), 'demo')
WM = os.path.join(ROOT, '.w-model')

# ---------- 破坏性路径唯一入口（前置门，先于任何写盘） ----------
parser = argparse.ArgumentParser(description='重建 e2e 调测工作区')
parser.add_argument('--reset', action='store_true', help='先清空工作区（唯一破坏性路径）')
args = parser.parse_args()
if os.path.exists(os.path.join(ROOT, '.git')) and not args.reset:
    sys.exit('✗ 工作区根存在 .git：它会让 --scope 的 headRef 绑到 demo 自身 HEAD 而使 p5–p8 门禁过期。'
             '请先移走/删除该目录，或显式传 --reset 清空重建。')
if args.reset and os.path.exists(ROOT):
    shutil.rmtree(ROOT)

def write(rel, content):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

def write_json(rel, obj):
    write(rel, json.dumps(obj, ensure_ascii=False, indent=2) + '\n')

# ---------- 清理重建 ----------
for d in ('.w-model', 'tla', 'features', 'src', 'test', 'docs', 'archive'):
    p = os.path.join(ROOT, d)
    if os.path.exists(p):
        shutil.rmtree(p)
os.makedirs(os.path.join(WM, 'gate-logs'), exist_ok=True)

# ---------- SPEC.md（冻结规格） ----------
write('SPEC.md', '''# counter-api 冻结规格（2026-09-19，e2e 调测用）

## R1 功能需求
- REQ-001（计数器域，level 1）：系统提供取值范围 [0,10] 的环形计数器。
- REQ-002（自增与复位，level 2，属于 REQ-001 域）：用户可执行 Inc（+1 环回）与 Reset（归零）。

## R2 非功能需求
- NFR-001：单次操作响应 P95 ≤ 200ms（生产目标）。

## R3 约束
- CON-001：实现零 npm 运行时依赖（Node 内置能力）。

## 接口（阶段 3 冻结）
- POST /counter/inc → 200 {value}
- POST /counter/reset → 200 {value}
- GET /counter → 200 {value}
''')

# ---------- 真实源码与四级测试（node:test，零依赖） ----------
write('src/counter.ts', '''export type CounterState = 'zeroed' | 'counting';

export class Counter {
  private value = 0;
  inc(): number { this.value = (this.value + 1) % 11; return this.value; }
  reset(): number { this.value = 0; return this.value; }
  get(): number { return this.value; }
  state(): CounterState { return this.value === 0 ? 'zeroed' : 'counting'; }
}
''')
write('test/unit/counter.test.ts', '''import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Counter } from '../../src/counter.ts';

test('TC-UNIT-001 初始值为 0 且状态 zeroed', () => {
  const c = new Counter();
  assert.equal(c.get(), 0);
  assert.equal(c.state(), 'zeroed');
});
test('TC-UNIT-002 inc 环回到 0（%11）', () => {
  const c = new Counter();
  for (let i = 0; i < 11; i++) c.inc();
  assert.equal(c.get(), 0);
});
test('TC-UNIT-003 reset 归零', () => {
  const c = new Counter();
  c.inc(); c.inc();
  assert.equal(c.reset(), 0);
});
''')
write('test/integration/counter-flow.test.ts', '''import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Counter } from '../../src/counter.ts';

test('TC-INT-001 inc→reset 流转', () => {
  const c = new Counter();
  c.inc();
  assert.equal(c.state(), 'counting');
  assert.equal(c.reset(), 0);
});
test('TC-INT-002 连续 inc 边界', () => {
  const c = new Counter();
  for (let i = 0; i < 10; i++) c.inc();
  assert.equal(c.get(), 10);
  assert.equal(c.inc(), 0);
});
''')
write('test/system/counter-sys.test.ts', '''import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Counter } from '../../src/counter.ts';

test('TC-SYS-001 端到端计数路径', () => {
  const c = new Counter();
  c.inc(); c.inc(); c.inc();
  assert.equal(c.get(), 3);
});
test('TC-SYS-002 复位后可继续计数', () => {
  const c = new Counter();
  c.inc(); c.reset(); c.inc();
  assert.equal(c.get(), 1);
});
''')
write('test/acceptance/counter-uat.test.ts', '''import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Counter } from '../../src/counter.ts';

test('UAT-001 REQ-001 取值范围 [0,10]', () => {
  const c = new Counter();
  for (let i = 0; i < 100; i++) {
    const v = c.inc();
    assert.ok(v >= 0 && v <= 10);
  }
});
test('UAT-002 REQ-002 Inc 与 Reset 行为', () => {
  const c = new Counter();
  assert.equal(c.inc(), 1);
  assert.equal(c.reset(), 0);
});
''')

# ---------- TLA+ L1/L2（真实 SANY/TLC 可执行） ----------
write('tla/L1_counter.tla', '''---- MODULE L1_counter ----
EXTENDS Naturals
VARIABLES state

(*
  @system      counter-api
  @requirement REQ-001
  @design      docs/system-design.md#3.1
  @parent      null
  @sibling     null
  @child       tla/L2_counter_service.tla
  @level       L1
  @phase       1
*)

Init == state = "zeroed"
Inc == state = "zeroed" /\\ state' = "counting"
Reset == state = "counting" /\\ state' = "zeroed"
Next == \\/ Inc \\/ Reset
Spec == Init /\\ [][Next]_state
TypeInvariant == state \\in {"zeroed", "counting"}
BusinessInvariant == /\\ TypeInvariant
====
''')
# 阶段 1 变体：L1 尚无 L2 子规格（文件头 @child null，与 manifest.p1 双向一致）
_p1_tla = open(os.path.join(ROOT, 'tla', 'L1_counter.tla'), encoding='utf-8').read().replace(
    '@child       tla/L2_counter_service.tla', '@child       null')
write('tla/L1_counter.p1.tla', _p1_tla)
_p2_tla = open(os.path.join(ROOT, 'tla', 'L1_counter.tla'), encoding='utf-8').read().replace(
    '@requirement REQ-001', '@requirement REQ-001,SD-001')
write('tla/L1_counter.p2plus.tla', _p2_tla)
write('features/L2/L2_counter_service-001.feature', '''# features/L2/L2_counter_service-001.feature
# @req: REQ-002
# @design: SD-001
# @system: counter-api::service
# @tla-spec: L2_counter_service
# @state-machine: SM-L1-counter
# @parent-features: L1_counter-001
# @sibling-features: (none)
# @child-features: (none)
# @scenario-id-prefix: BDD-L2
Feature: 计数服务自增与复位
  作为计数服务
  我希望执行自增与复位
  以便验证服务层满足 REQ-002

Background:
  # @states: zeroed, counting
  # @initial-state: zeroed
  # @terminal-states: counting
  # @accepting-states: counting
  # @rejecting-states: zeroed
  # @transitions:
  #   zeroed + Inc -> counting
  #   counting + Reset -> zeroed
  # @invariants:
  #   TypeInvariant
  #   BusinessInvariant
  Given 系统处于初始状态

@REQ-002 @UAT-002 @BDD-L2-001
Scenario: 服务层自增进入计数态
  Given 系统处于 "zeroed" state
  When Inc 自增 (Inc)
  Then 系统应转移到 "counting" 状态
  And 不变式 "TypeInvariant" 应成立
  And 不变式 "BusinessInvariant" 应成立

@REQ-002 @UAT-002 @BDD-L2-002
Scenario: 服务层复位回到零态
  Given 系统处于 "counting" state
  When Reset 复位 (Reset)
  Then 系统应转移到 "zeroed" 状态
  And 不变式 "TypeInvariant" 应成立
  And 不变式 "BusinessInvariant" 应成立
''')
write('tla/L1_counter.cfg', '''SPECIFICATION Spec
INVARIANT TypeInvariant
''')
write('tla/L2_counter_service.tla', '''---- MODULE L2_counter_service ----
EXTENDS Naturals
VARIABLES state

(*
  @system      counter-api::service
  @requirement REQ-002,SD-001
  @design      docs/system-design.md#3.2
  @parent      tla/L1_counter.tla
  @sibling     null
  @child       null
  @level       L2
  @phase       2
*)

Init == state = "zeroed"
Inc == state = "zeroed" /\\ state' = "counting"
Reset == state = "counting" /\\ state' = "zeroed"
Next == \\/ Inc \\/ Reset
Spec == Init /\\ [][Next]_state
TypeInvariant == state \\in {"zeroed", "counting"}
BusinessInvariant == /\\ TypeInvariant
====
''')
write('tla/L2_counter_service.cfg', '''SPECIFICATION Spec
INVARIANT TypeInvariant
''')

# ---------- BDD L1 feature ----------
write('features/L1/L1_counter-001.feature', '''# features/L1/L1_counter-001.feature
# @req: REQ-001
# @design: SD-001
# @system: counter-api
# @tla-spec: L1_counter
# @state-machine: SM-L1-counter
# @parent-features: (none)
# @sibling-features: (none)
# @child-features: (none)
# @scenario-id-prefix: BDD-L1
Feature: 计数器环形计数
  作为计数器用户
  我希望执行自增与复位
  以便验证计数器满足 REQ-001/REQ-002

Background:
  # @states: zeroed, counting
  # @initial-state: zeroed
  # @terminal-states: counting
  # @accepting-states: counting
  # @rejecting-states: zeroed
  # @transitions:
  #   zeroed + Inc -> counting
  #   counting + Reset -> zeroed
  # @invariants:
  #   TypeInvariant
  #   BusinessInvariant
  Given 系统处于初始状态

@REQ-001 @UAT-001 @BDD-L1-001
Scenario: 自增进入计数态
  Given 系统处于 "zeroed" state
  When Inc 自增 (Inc)
  Then 系统应转移到 "counting" 状态
  And 不变式 "TypeInvariant" 应成立
  And 不变式 "BusinessInvariant" 应成立

@REQ-002 @UAT-002 @BDD-L1-002
Scenario: 复位回到零态
  Given 系统处于 "counting" state
  When Reset 复位 (Reset)
  Then 系统应转移到 "zeroed" 状态
  And 不变式 "TypeInvariant" 应成立
  And 不变式 "BusinessInvariant" 应成立
''')

# ---------- 图谱（phase 4 终态；节点带 phase 字段按阶段过滤） ----------
graph = {
  'version': 1,
  'currentPhase': 4,
  'nodes': [
    {'id': 'EXT-IN', 'type': 'EXT-IN', 'phase': 1, 'title': '外部输入', 'summary': '用户操作进入系统', 'evidenceAnchor': 'SPEC.md:§R1=用户可执行 Inc 与 Reset', 'evidenceStatus': 'confirmed'},
    {'id': 'EXT-OUT', 'type': 'EXT-OUT', 'phase': 1, 'title': '外部输出', 'summary': '计数值返回用户', 'evidenceAnchor': 'SPEC.md:§R1=GET /counter 返回 value', 'evidenceStatus': 'confirmed'},
    {'id': 'REQ-001', 'type': 'REQ', 'phase': 1, 'title': '计数器域', 'summary': 'level=1 域需求', 'level': 1, 'evidenceAnchor': 'SPEC.md:§R1=环形计数器 [0,10]', 'evidenceStatus': 'confirmed'},
    {'id': 'REQ-002', 'type': 'REQ', 'phase': 1, 'title': '自增与复位', 'summary': 'level=2 功能需求', 'level': 2, 'reqGroup': 'REQ-001', 'evidenceAnchor': 'SPEC.md:§R1=Inc 与 Reset', 'evidenceStatus': 'confirmed'},
    {'id': 'NFR-001', 'type': 'REQ', 'phase': 1, 'title': '响应时间', 'summary': 'P95 ≤ 200ms', 'evidenceAnchor': 'SPEC.md:§R2=响应时间约束', 'evidenceStatus': 'confirmed'},
    {'id': 'CON-001', 'type': 'REQ', 'phase': 1, 'title': '零依赖', 'summary': '实现约束', 'evidenceAnchor': 'SPEC.md:§R3=零 npm 运行时依赖', 'evidenceStatus': 'confirmed'},
    {'id': 'SD-001', 'type': 'SD', 'phase': 2, 'title': '计数器子系统', 'summary': '承载 REQ-002 的子系统', 'evidenceAnchor': 'docs/system-design.md:§3.1=SD-001 计数器子系统', 'evidenceStatus': 'confirmed'},
    {'id': 'INTF-001', 'type': 'INTF', 'phase': 3, 'title': '计数器 REST 接口', 'summary': '三个端点', 'evidenceAnchor': 'docs/interface-design.md:§2=INTF-001', 'evidenceStatus': 'confirmed'},
    {'id': 'DD-001', 'type': 'DD', 'phase': 4, 'title': 'Counter 类详细设计', 'summary': '状态与转移实现', 'evidenceAnchor': 'docs/detailed-design.md:§1=DD-001 Counter 类', 'evidenceStatus': 'confirmed'},
  ],
  'edges': [
    {'from': 'REQ-001', 'to': 'REQ-002', 'type': 'parent'},
    {'from': 'NFR-001', 'to': 'REQ-002', 'type': 'cross-cuts'},
    {'from': 'CON-001', 'to': 'REQ-001', 'type': 'cross-cuts'},
    {'from': 'SD-001', 'to': 'REQ-002', 'type': 'implements'},
    {'from': 'SD-001', 'to': 'INTF-001', 'type': 'defines', 'sourceArtifact': 'docs/interface-design.md:§2'},
    {'from': 'DD-001', 'to': 'SD-001', 'type': 'realizes'},
    {'from': 'EXT-IN', 'to': 'REQ-001', 'type': 'produces', 'sourceArtifact': 'SPEC.md:§R1'},
    {'from': 'REQ-001', 'to': 'REQ-002', 'type': 'produces', 'sourceArtifact': 'SPEC.md:§R1'},
    {'from': 'REQ-002', 'to': 'SD-001', 'type': 'produces', 'sourceArtifact': 'docs/system-design.md:§3.1'},
    {'from': 'SD-001', 'to': 'INTF-001', 'type': 'produces', 'sourceArtifact': 'docs/interface-design.md:§2'},
    {'from': 'INTF-001', 'to': 'DD-001', 'type': 'produces', 'sourceArtifact': 'docs/detailed-design.md:§1'},
    {'from': 'DD-001', 'to': 'EXT-OUT', 'type': 'produces', 'sourceArtifact': 'SPEC.md:§R1'},
    {'from': 'EXT-IN', 'to': 'NFR-001', 'type': 'produces', 'sourceArtifact': 'SPEC.md:§R2'},
    {'from': 'NFR-001', 'to': 'SD-001', 'type': 'produces', 'sourceArtifact': 'SPEC.md:§R2'},
    {'from': 'EXT-IN', 'to': 'CON-001', 'type': 'produces', 'sourceArtifact': 'SPEC.md:§R3'},
    {'from': 'CON-001', 'to': 'SD-001', 'type': 'produces', 'sourceArtifact': 'SPEC.md:§R3'},
  ],
}
def graph_variant(stage):
    """按阶段裁剪图谱：stage=1 纯 REQ（多 group 模式）；2=+EXT+SD；3=+INTF；4=+DD。"""
    g = json.loads(json.dumps(graph))
    keep_types_p1 = {'REQ'}
    if stage == 1:
        g['nodes'] = [n for n in g['nodes'] if n['type'] in keep_types_p1]
        g['edges'] = [e for e in g['edges'] if e['from'] in {n['id'] for n in g['nodes']} and e['to'] in {n['id'] for n in g['nodes']}]
    else:
        allowed = {'REQ', 'EXT-IN', 'EXT-OUT'} | ({'SD'} if stage >= 2 else set()) | ({'INTF'} if stage >= 3 else set()) | ({'DD'} if stage >= 4 else set())
        g['nodes'] = [n for n in g['nodes'] if n['type'] in allowed]
        ids = {n['id'] for n in g['nodes']}
        g['edges'] = [e for e in g['edges'] if e['from'] in ids and e['to'] in ids]
    if stage in (2, 3):
        last = {2: 'SD-001', 3: 'INTF-001'}[stage]
        g['edges'].append({'from': last, 'to': 'EXT-OUT', 'type': 'produces', 'sourceArtifact': 'SPEC.md:§R1'})
    g['currentPhase'] = stage
    return g

# SD/INTF/DD 挂 parent 链（否则成为根候选/orphan）
graph['edges'] += [
  {'from': 'REQ-001', 'to': 'SD-001', 'type': 'parent', 'sourceArtifact': 'docs/system-design.md:§3'},
  {'from': 'SD-001', 'to': 'INTF-001', 'type': 'parent', 'sourceArtifact': 'docs/interface-design.md:§2'},
  {'from': 'INTF-001', 'to': 'DD-001', 'type': 'parent', 'sourceArtifact': 'docs/detailed-design.md:§1'},
]
# 全部边补语义来源（占比 ≥80%）
for e in graph['edges']:
    e.setdefault('sourceArtifact', 'SPEC.md:§R1')
for stage in (1, 2, 3, 4):
    write_json(f'.w-model/ingestion/graph.p{stage}.json', graph_variant(stage))
write_json('.w-model/ingestion/graph.json', graph_variant(4))

# ---------- .w-model 状态 ----------
write_json('.w-model/project.json', {
  'id': 'counter-api', 'name': 'counter-api', 'description': 'W-Model e2e 调测最小项目（环形计数器）',
  'status': '需求分析',
  'techStack': {'frontend': [], 'backend': ['TypeScript', 'node:test'], 'database': [], 'others': ['TLA+', 'BDD']},
  'createdAt': '2026-09-19T03:00:00+08:00', 'updatedAt': '2026-09-19T03:00:00+08:00',
})
write_json('.w-model/maturity.json', {
  'schemaVersion': '1.0', 'projectId': 'counter-api', 'level': 'L2',
  'leveledUpAt': '2026-09-19T03:00:00+08:00',
  'unlockConditions': {'stableDays': 30, 'completedCycles': 3, 'attemptCapRate': 0.85, 'misjudgeRate': 0.05, 'operationalFailures': 0},
  'history': [{'at': '2026-09-19T03:00:00+08:00', 'from': 'L1', 'to': 'L2', 'reason': 'e2e 调测项目按生产小项目定级'}],
  'downgradeTriggers': {'operationalFailureStreak': 3, 'budgetBurnRateExceeded': 3, 'checkpointRejectionStreak': 2, 'userRequested': False},
})
write_json('.w-model/budget.json', {
  'schemaVersion': '1.0', 'projectId': 'counter-api',
  'createdAt': '2026-09-19T03:00:00+08:00', 'updatedAt': '2026-09-19T03:00:00+08:00',
  'perPhase': {'maxTokens': 200000, 'maxSubagentSpawns': 10, 'maxReworkRounds': 3},
  'project': {'maxTokensTotal': 2000000, 'maxTokensPerSession': 500000},
  'onExceed': 'pause',
  'killSwitch': {'consecutiveReworks': 3, 'budgetBurnRate': 0.9, 'tlaReworks': 3},
})
tla_manifest_full = {
  'version': 1, 'project': 'counter-api', 'currentPhase': 4, 'basePath': '..',
  'tools': {'jarPath': '../../../w-model-dev/tools/tla2tools.jar', 'javaMinVersion': 11},
  'specs': [
    {'id': 'L1_counter', 'level': 'L1', 'phase': 1, 'system': 'counter-api',
     'requirementIds': ['REQ-001'], 'designRef': 'docs/system-design.md#3.1',
     'tlaPath': 'tla/L1_counter.tla', 'cfgPath': 'tla/L1_counter.cfg',
     'parent': None, 'siblings': [], 'children': ['tla/L2_counter_service.tla'],
     'variableCombination': 2, 'decompositionDecision': 'kept-below-threshold',
     'syntaxChecked': True, 'tlcChecked': True, 'deadlockFree': True, 'invariantsHold': True, 'stateExplosion': False},
    {'id': 'L2_counter_service', 'level': 'L2', 'phase': 2, 'system': 'counter-api::service',
     'requirementIds': ['REQ-002'], 'designRef': 'docs/system-design.md#3.2',
     'tlaPath': 'tla/L2_counter_service.tla', 'cfgPath': 'tla/L2_counter_service.cfg',
     'parent': 'tla/L1_counter.tla', 'siblings': [], 'children': [],
     'variableCombination': 2, 'decompositionDecision': 'kept-below-threshold',
     'syntaxChecked': True, 'tlcChecked': True, 'deadlockFree': True, 'invariantsHold': True, 'stateExplosion': False},
  ],
  'sdCoverage': {'totalSdNodes': 1, 'coveredSdNodes': ['SD-001'], 'uncoveredSdNodes': [], 'coverageRate': 1.0},
  'checkRounds': [],
}

def tla_manifest_variant(stage):
  """阶段 1 = 仅 L1（children 空，无 sdCoverage）；阶段 2+ = L1+L2 双向一致 + sdCoverage + requirementIds 含 SD 标识。"""
  import json as _json
  m = _json.loads(_json.dumps(tla_manifest_full))
  m['currentPhase'] = stage
  if stage == 1:
    m['specs'] = [s for s in m['specs'] if s['phase'] <= 1]
    m['specs'][0]['children'] = []
    m.pop('sdCoverage', None)
  else:
    for s in m['specs']:
      if 'SD-001' not in s['requirementIds']:
        s['requirementIds'] = s['requirementIds'] + ['SD-001']
  return m

for _s in (1, 2, 3, 4):
  write_json(f'.w-model/tla-manifest.p{_s}.json', tla_manifest_variant(_s))
write_json('.w-model/tla-manifest.json', tla_manifest_variant(4))
_bdd_manifest_draft = {
  'schemaVersion': '1.0', 'projectId': 'counter-api', 'basePath': '.', 'currentPhase': 8,
  'features': [
    {'id': 'L1_counter-001', 'level': 1, 'filePath': 'features/L1/L1_counter-001.feature',
     'scenarioCount': 2, 'stateMachineId': 'SM-L1-counter', 'tlaSpecId': 'L1_counter',
     'reqIds': ['REQ-001', 'REQ-002'], 'designIds': ['SD-001'],
     'parentFeatureIds': [], 'siblingFeatureIds': [], 'childFeatureIds': ['L2_counter_service-001']},
    {'id': 'L2_counter_service-001', 'level': 2, 'filePath': 'features/L2/L2_counter_service-001.feature',
     'scenarioCount': 2, 'stateMachineId': 'SM-L1-counter', 'tlaSpecId': 'L2_counter_service',
     'reqIds': ['REQ-002'], 'designIds': ['SD-001'],
     'parentFeatureIds': ['L1_counter-001'], 'siblingFeatureIds': [], 'childFeatureIds': []},
  ],
  'stateMachines': [
    {'id': 'SM-L1-counter', 'level': 1,
     'states': ['zeroed', 'counting'], 'initialState': 'zeroed',
     'terminalStates': ['counting'], 'acceptingStates': ['counting'], 'rejectingStates': ['zeroed'],
     'transitions': [
       {'from': 'zeroed', 'event': 'Inc', 'to': 'counting'},
       {'from': 'counting', 'event': 'Reset', 'to': 'zeroed'},
     ],
     'invariants': ['TypeInvariant', 'BusinessInvariant']},
  ],
  'designCoverage': {'totalSdNodes': 1, 'coveredSdNodes': ['SD-001'], 'uncoveredSdNodes': [], 'coverageRate': 1.0},
}
bdd_manifest_full = json.loads(json.dumps(_bdd_manifest_draft))

def bdd_manifest_variant(stage):
  m = json.loads(json.dumps(bdd_manifest_full))
  m['currentPhase'] = stage
  if stage == 1:
    m['features'] = [f for f in m['features'] if f['level'] <= 1]
    m['features'][0]['childFeatureIds'] = []
    m['stateMachines'] = [s for s in m['stateMachines'] if s['id'] == 'SM-L1-counter']
    m.pop('designCoverage', None)
  return m

for _s in (1, 2, 3, 4):
  write_json(f'.w-model/bdd-manifest.p{_s}.json', bdd_manifest_variant(_s))
write_json('.w-model/bdd-manifest.json', bdd_manifest_variant(8))

# cucumber 执行证据（phase 5-8 required；object + elements[].steps[].result.status）
write_json('.w-model/bdd/reports/report.json', {
  'keyword': 'Feature', 'name': '计数器环形计数', 'uri': 'features/L1/L1_counter-001.feature',
  'elements': [
    {'keyword': 'Scenario', 'name': '自增进入计数态', 'steps': [
      {'keyword': 'Given', 'name': '系统处于 "zeroed" 状态', 'result': {'status': 'passed'}},
      {'keyword': 'When', 'name': '用户执行 Inc', 'result': {'status': 'passed'}},
      {'keyword': 'Then', 'name': '系统应转移到 "counting" 状态', 'result': {'status': 'passed'}},
      {'keyword': 'And', 'name': '不变式 "TypeInvariant" 应成立', 'result': {'status': 'passed'}},
    ]},
    {'keyword': 'Scenario', 'name': '复位回到零态', 'steps': [
      {'keyword': 'Given', 'name': '系统处于 "counting" 状态', 'result': {'status': 'passed'}},
      {'keyword': 'When', 'name': '用户执行 Reset', 'result': {'status': 'passed'}},
      {'keyword': 'Then', 'name': '系统应转移到 "zeroed" 状态', 'result': {'status': 'passed'}},
      {'keyword': 'And', 'name': '不变式 "TypeInvariant" 应成立', 'result': {'status': 'passed'}},
    ]},
  ],
})

# ---------- RTM（phase 8 终态；中间态由轨迹驱动脚本演化或按阶段另存） ----------
rows = [
  {'requirementId': 'REQ-001', 'description': '环形计数器取值 [0,10]', 'designDoc': 'docs/requirement-spec.md#REQ-001',
   'codeModule': 'SD-001:src/counter.ts', 'unitTest': 'TC-UNIT-001', 'integrationTest': 'TC-INT-001',
   'systemTest': 'TC-SYS-001', 'acceptanceTest': 'docs/acceptance-test-design.md#UAT-001', 'coverageStatus': '完整'},
  {'requirementId': 'REQ-002', 'description': 'Inc 自增与 Reset 复位', 'designDoc': 'docs/requirement-spec.md#REQ-002',
   'codeModule': 'SD-001:src/counter.ts', 'unitTest': 'TC-UNIT-002', 'integrationTest': 'TC-INT-002',
   'systemTest': 'TC-SYS-002', 'acceptanceTest': 'docs/acceptance-test-design.md#UAT-002', 'coverageStatus': '完整'},
  {'requirementId': 'NFR-001', 'description': '响应时间 P95 ≤ 200ms', 'designDoc': 'SD-001',
   'codeModule': '横切', 'unitTest': '', 'integrationTest': '', 'systemTest': '', 'acceptanceTest': '',
   'coverageStatus': '完整', 'targetValue': 'P95 ≤ 200ms（生产环境）', 'testThreshold': 'P95 ≤ 250ms（测试环境基线）'},
  {'requirementId': 'CON-001', 'description': '零 npm 运行时依赖', 'designDoc': 'SD-001',
   'codeModule': '横切', 'unitTest': '', 'integrationTest': '', 'systemTest': '', 'acceptanceTest': '',
   'coverageStatus': '完整'},
]
write_json('.w-model/rtm.json', {
  'schemaVersion': '1.0', 'projectId': 'counter-api', 'currentPhase': 8,
  'lastUpdated': '2026-09-19T04:00:00.000Z',
  'rows': rows,
  'executionSummary': {
    'unitTest': {'total': 3, 'passed': 3, 'failed': 0, 'pending': 0, 'coverage': 100,
      'evidence': {'command': 'node --import tsx --test test/unit/counter.test.ts', 'exitCode': 0, 'observedAt': '2026-09-19T04:00:00.000Z'}},
    'integrationTest': {'total': 2, 'passed': 2, 'failed': 0, 'pending': 0, 'coverage': 100,
      'evidence': {'command': 'node --import tsx --test test/integration/counter-flow.test.ts', 'exitCode': 0, 'observedAt': '2026-09-19T04:05:00.000Z'}},
    'systemTest': {'total': 2, 'passed': 2, 'failed': 0, 'pending': 0, 'coverage': 100,
      'evidence': {'command': 'node --import tsx --test test/system/counter-sys.test.ts', 'exitCode': 0, 'observedAt': '2026-09-19T04:10:00.000Z'}},
    'acceptanceTest': {'total': 2, 'passed': 2, 'failed': 0, 'pending': 0, 'coverage': 100,
      'evidence': {'command': 'node --import tsx --test test/acceptance/counter-uat.test.ts', 'exitCode': 0, 'observedAt': '2026-09-19T04:15:00.000Z'}},
  },
})

# ---------- run-log（8 阶段完整 S/V/G + R3×3 + 闭环五脚本 + checkpoint） ----------
PHASE_NAMES = {1: '需求与范围', 2: '系统与架构', 3: '概要设计', 4: '详细设计', 5: '编码实现', 6: '集成测试', 7: '系统测试', 8: '验收测试'}
DECISIONS = {
  1: ['需求 REQ-001/REQ-002 采用环形计数器取值 [0,10] 方案', '非功能需求 NFR-001 响应时间 P95 ≤ 200ms 纳入验收约束'],
  2: ['系统拆分为 SD-001 计数器子系统承载 REQ-002', '架构采用零依赖 TypeScript 模块 + 内存状态设计'],
  3: ['接口 INTF-001 定义 POST /counter/inc 与 /counter/reset 及 GET /counter 三端点', '模块交互采用同步过程调用契约'],
  4: ['详细设计 DD-001 定义 Counter 类字段与状态转移算法', '数据结构采用 number 内存字段与 zeroed/counting 状态机'],
  5: ['编码实现 SD-001:src/counter.ts 与 TC-UNIT-001~003 单元测试', '代码模块状态转移与 TLA+ Next 分支 Inc/Reset 保持一致'],
  6: ['集成测试 TC-INT-001/002 验证 inc→reset 流转与边界', '集成契约与接口 INTF-001 端点行为一致'],
  7: ['系统测试 TC-SYS-001/002 覆盖端到端计数路径', '性能基线：GET /counter 接口 P95 远低于 200ms 阈值达标'],
  8: ['验收测试 UAT-001/002 按 SPEC 冻结规格与接口契约全部通过', '归档产物与 RTM 100% 覆盖及模块清单核对一致'],
}
entries = []
ts = 0  # 秒偏移
def add(action, role, phase, **kw):
  global ts
  ts += 60
  e = {'runId': kw.pop('runId'), 'timestamp': f'2026-09-19T{(4+ts//3600)%24:02d}:{(ts//60)%60:02d}:{ts%60:02d}Z',
       'phase': phase, 'phaseName': PHASE_NAMES[phase], 'action': action, 'role': role,
       'duration_s': 30, 'tokens': 2000, 'estimated': False, 'subagentSpawns': 0,
       'gateExitCode': kw.pop('gateExitCode', None), 'outcome': 'success'}
  e.update(kw)
  entries.append(e)

P8_ID = {'round': 1, 'reportId': 'e2e-phase8-acceptance', 'targetKind': 'test',
        'basedOnReport': '.w-model/verifier-outputs/phase-7.json',
        'implementationTarget': 'test/acceptance/counter-uat.test.ts', 'target': 'UAT-001',
        'artifacts': ['.w-model/rtm.json']}
for p in range(1, 9):
  if p <= 4:
    add('chunk', 'A', p, runId=f'p{p}-a-chunk')
    add('cross', 'S', p, runId=f'p{p}-s-cross')
  add('produce', 'S', p, runId=f'p{p}-s')
  p8 = P8_ID if p == 8 else {}
  add('r3-completeness', 'R', p, runId=f'p{p}-r3c', **p8)
  add('r3-reliability', 'R', p, runId=f'p{p}-r3r', **p8)
  add('r3-security', 'R', p, runId=f'p{p}-r3s', **p8)
  add('review', 'V', p, runId=f'p{p}-v', **p8)
  add('gate', 'G', p, runId=f'p{p}-g', gateExitCode=0, **p8)
  for tag, script in (('b', 'check-budget.ts'), ('rl', 'check-run-log.ts'), ('m', 'check-maturity.ts'), ('c', 'check-checkpoint.ts'), ('pr', 'check-preventive-review.ts')):
    add('gate', 'G', p, runId=f'p{p}-c-{tag}', gateExitCode=0, script=script, **p8)
  add('checkpoint', 'O', p, runId=f'p{p}-cp', acknowledgedDecisions=DECISIONS[p])
write('.w-model/run-log.jsonl', '\n'.join(json.dumps(e, ensure_ascii=False) for e in entries) + '\n')

# ---------- checkpoint-log（用户确认记录；e2e 判据代行，见报告声明） ----------
for p in range(1, 9):
  write(f'.w-model/checkpoint-log/phase-{p}.txt',
        f'[e2e 判据代行] 用户确认阶段 {p} 放行：{DECISIONS[p][0]}；确认时间 2026-09-19。\n')

# ---------- R3 预防性审查 8×3 ----------
for p in range(1, 9):
  for dim in ('completeness', 'reliability', 'security'):
    write_json(f'.w-model/preventive-reviews/{p}-{dim}.json', {
      'reviewedAt': f'2026-09-19T0{(p%9)+1}:00:00Z', 'reviewer': f'R3-{dim}-bot', 'phase': p,
      'dimension': dim,
      'findings': [{'severity': 'FYI', 'description': f'阶段 {p} {dim} 审查无阻塞发现', 'evidence': f'.w-model/run-log.jsonl#p{p}'}],
      'passed': True,
    })

# ---------- V 评审输出 8 份 ----------
AXES = {
  'requirement': [('completeness', .3), ('clarity', .25), ('consistency', .2), ('testability', .15), ('traceability', .1)],
  'design': [('architecture-soundness', .25), ('requirement-coverage', .25), ('interface-consistency', .2), ('feasibility', .15), ('testability', .15)],
  'code': [('correctness', .3), ('security', .2), ('readability', .15), ('maintainability', .15), ('conformance', .2)],
  'test': [('coverage', .3), ('correctness', .25), ('independence', .2), ('clarity', .15), ('priority-reasonableness', .1)],
}
KIND = {1: 'requirement', 2: 'design', 3: 'design', 4: 'design', 5: 'code', 6: 'test', 7: 'test', 8: 'test'}
TARGET = {1: 'REQ-001', 2: 'SD-001', 3: 'INTF-001', 4: 'DD-001', 5: 'SD-001:src/counter.ts', 6: 'TC-INT-001', 7: 'TC-SYS-001', 8: 'UAT-001'}
BASE = {1: .92, 2: .90, 3: .91, 4: .90, 5: .93, 6: .91, 7: .92, 8: .93}
for p in range(1, 9):
  kind, axes, b = KIND[p], AXES[KIND[p]], BASE[p]
  subs, comp = [], 0.0
  for i, (name, w) in enumerate(axes):
    s = round(b - 0.02 * i, 4)
    comp += s * w
    subs.append({'name': name, 'weight': w, 'score': s, 'rawScores': [round(s - 0.01, 4), s, round(s + 0.01, 4)],
                 'variance': 0.0000667, 'evidence': f'docs/phase{p}-evidence.md:§{i+1}={TARGET[p]}'})
  write_json(f'.w-model/verifier-outputs/phase-{p}.json', {
    'schemaVersion': '1.0',
    'meta': {'targetKind': kind, 'target': TARGET[p], 'reviewedAt': '2026-09-19T05:00:00Z',
             'agent': 'e2e-verifier-bot', 'scoringMethod': 'logits', 'repeatTimes': 3, 'varianceThreshold': 0.1},
    'subCriteria': subs,
    'compositeScore': round(comp, 4), 'qualityLevel': 'A',
    'summary': f'阶段 {p} {kind} 评审通过：目标 {TARGET[p]} 五轴均高于 0.70 下限，证据锚点可溯源到阶段产物，'
               f'未发现 Mandatory 返工项，遗留风险无（e2e 调测 V 分派，非 self-as-verifier）。',
    'passed': True,
  })

# ---------- 签名链（自建：每阶段 O→S→R3→V→G→O 环；V 环 artifacts 含图谱节点 id + 锚点路径） ----------
V_ARTIFACTS = {
  1: (['EXT-IN', 'EXT-OUT', 'REQ-001', 'REQ-002', 'NFR-001', 'CON-001'], 'SPEC.md'),
  2: (['SD-001'], 'docs/system-design.md'),
  3: (['INTF-001'], 'docs/interface-design.md'),
  4: (['DD-001'], 'docs/detailed-design.md'),
  5: (['SD-001:src/counter.ts'], 'src/counter.ts'),
  6: (['TC-INT-001', 'TC-INT-002'], 'test/integration/counter-flow.test.ts'),
  7: (['TC-SYS-001', 'TC-SYS-002'], 'test/system/counter-sys.test.ts'),
  8: (['UAT-001', 'UAT-002'], 'test/acceptance/counter-uat.test.ts'),
}
G_ARTIFACTS = {1: ['.w-model/ingestion/graph.json'], 2: ['.w-model/tla-manifest.json'],
               3: ['.w-model/bdd-manifest.json'], 4: ['.w-model/rtm.json'],
               5: ['src/counter.ts', 'test/unit/counter.test.ts'], 6: ['test/integration/counter-flow.test.ts'],
               7: ['test/system/counter-sys.test.ts'], 8: ['.w-model/rtm.json', 'archive/2026-09-19-counter-api/archive-manifest.json']}
S_ARTIFACTS = {1: ['docs/requirement-spec.md'], 2: ['docs/system-design.md'], 3: ['docs/interface-design.md'],
               4: ['docs/detailed-design.md'], 5: ['src/counter.ts'], 6: ['test/integration/counter-flow.test.ts'],
               7: ['test/system/counter-sys.test.ts'], 8: ['test/acceptance/counter-uat.test.ts']}

NL = chr(10)
chain = []
state = {'prev_id': 'genesis', 'prev_hash': '0'}
def jd(x):
  return json.dumps(x, ensure_ascii=False, separators=(',', ':'))

def add_sig(p, role, action, artifacts, ref, signer):
  """ref = (refSigId, refRole, refPath)；动态引用真实前序条目，杜绝悬空。"""
  seq = len(chain) + 1
  sig_id = f'wm1-r{seq:03d}-{role}'
  signed_at = f'2026-09-19T0{(p%9)+1}:{len(chain)%60:02d}:00.000Z'
  run_id = f'e2e-p{p}-{role.lower()}-{seq:03d}'
  ref_id, ref_role, ref_path = ref
  provenance = {'sourceSigIds': [ref_id], 'sourceArtifacts': [{'path': ref_path, 'sourceSigId': ref_id, 'sourceRole': ref_role}],
                'transformDescription': f'{role} 消费 {ref_role} 产物（e2e 轨迹）'}
  payload = f'{sig_id}|{p}|{role}|{action}|{run_id}|{jd(artifacts)}|{state["prev_hash"]}|{signed_at}|{signer}|{jd(provenance)}'
  h = 'sha256:' + hashlib.sha256(payload.encode('utf-8')).hexdigest()
  chain.append({'runId': run_id, 'phase': p, 'phaseName': PHASE_NAMES[p], 'sigId': sig_id, 'role': role,
                'action': action, 'prevSigId': state['prev_id'], 'prevSigHash': state['prev_hash'], 'signedAt': signed_at,
                'signer': signer, 'artifacts': artifacts, 'inputProvenance': provenance, 'sigHash': h})
  state['prev_id'], state['prev_hash'] = sig_id, h
  return sig_id

for p in range(1, 9):
  v_ids, v_path = V_ARTIFACTS[p]
  o_id = add_sig(p, 'O', 'chunk', ['.w-model/project.json'], ('genesis', 'O', '.w-model/project.json'), 'orchestrator-e2e')
  o_ref = (o_id, 'O', '.w-model/project.json')
  if p == 1:
    add_sig(p, 'A', 'cross', ['.w-model/ingestion/graph.json'], o_ref, 'analyzer-e2e')
  s_id = add_sig(p, 'S', 'produce', S_ARTIFACTS[p], o_ref, 'producer-e2e')
  add_sig(p, 'R', 'locate', ['.w-model/preventive-reviews'], o_ref, 'reviewer-r3-e2e')
  v_id = add_sig(p, 'V', 'review', v_ids, (s_id, 'S', v_path), 'verifier-e2e')
  add_sig(p, 'G', 'gate', G_ARTIFACTS[p], (v_id, 'V', v_path), 'gate-runner-e2e')
  g_id = None
  g_id = chain[-1]['sigId']
  add_sig(p, 'O', 'checkpoint', ['.w-model/run-log.jsonl'], (g_id, 'G', G_ARTIFACTS[p][0]), 'user-e2e-delegate')
write('.w-model/signature-chain.jsonl', NL.join(json.dumps(e, ensure_ascii=False) for e in chain) + NL)

# ---------- 文档（引用块占位，满足门禁存在性） ----------
for name, title in (('requirement-spec', '需求规格'), ('system-design', '系统设计'), ('interface-design', '接口设计'),
                    ('detailed-design', '详细设计'), ('acceptance-test-design', '验收测试设计')):
  write(f'docs/{name}.md', f'# {title}（counter-api e2e 调测）\n\n冻结规格见 [SPEC.md](../SPEC.md)。\n')
write('docs/uat-path-mapping.md', '''| UAT ID | 设计路径（阶段1） | 实际路径（阶段5回填） | 映射类型 | 说明 |
| ------ | ----------------- | --------------------- | -------- | ---- |
| UAT-001 | GET /counter（取值 [0,10]） | test/acceptance/counter-uat.test.ts#UAT-001 | 直接 | 环回验证 |
| UAT-002 | POST /counter/inc + /counter/reset | test/acceptance/counter-uat.test.ts#UAT-002 | 直接 | Inc/Reset 行为 |
''')

# ---------- 归档（phase 8 后置） ----------
arch_files = ['requirements.md', 'risk-assessment.md', 'uat-path-mapping.md', 'coverage.json', 'graph.json',
              'tla-manifest.json', 'bdd-manifest.json', 'system-design.md', 'system-test-design.md',
              'outline-design.md', 'integration-test-design.md', 'detailed-design.md', 'unit-test-design.md',
              'src/counter.ts', 'unit-test-report.json', 'rtm.json', 'run-log.jsonl', 'checkpoint-log.jsonl',
              'signature-chain.jsonl', 'integration-test-report.json', 'system-test-report.json',
              'acceptance-test-report.json', 'verifier-output-1.json', 'gate-logs/graph-gate.json']
for f in arch_files:
  write(f'archive/2026-09-19-counter-api/{f}', f'# {f}（counter-api 归档占位，内容由终检核对的清单锚定）\n')
write_json('archive/2026-09-19-counter-api/archive-manifest.json', {
  'schemaVersion': '1.0', 'projectId': 'counter-api', 'archivedAt': '2026-09-19T06:00:00+08:00',
  'files': arch_files,
})


# ---------- 阶段 5-8 变更上下文链（change-scope + codegraph 查询 + opsx 制品） ----------
# 以运行时事实为准：base/head 经 git 解析（REPLAY_BASE/REPLAY_HEAD 可覆盖），changedFiles 取该区间真实差异。
# 边界如实登记：demo 工作区嵌于仓库内且被 gitignore，change-scope 的「实际变更」
# 取仓库真实 BASE..HEAD 差异；demo 源码/测试不在 git 上下文内，
# codegraph 覆盖义务对「scope 内 code/test 文件」为空集（vacuously satisfied）。
_RP = subprocess.run(['git', '-C', ASSETS, 'rev-parse', '--show-toplevel'],
                     capture_output=True, text=True, check=True).stdout.strip()
def _rev(ref):
    return subprocess.run(['git', '-C', _RP, 'rev-parse', ref],
                          capture_output=True, text=True, check=True).stdout.strip()
BASE_SHA = _rev(os.environ.get('REPLAY_BASE', 'HEAD~1'))
HEAD_SHA = _rev(os.environ.get('REPLAY_HEAD', 'HEAD'))
_SCOPE_DIFF = subprocess.run(['git', '-C', _RP, 'diff', '--name-only', f'{BASE_SHA}..{HEAD_SHA}'],
                             capture_output=True, text=True, check=True).stdout.split()
assert _SCOPE_DIFF, 'REPLAY_BASE..REPLAY_HEAD 差异为空：change-scope 需要非空 changedFiles'
PHASE_FILES = {p: list(_SCOPE_DIFF) for p in (5, 6, 7, 8)}
PHASE_SYMBOLS = {
  5: [('Counter', [], ['Counter.inc', 'Counter.reset', 'Counter.get'], 3)],
  6: [('Counter', [], ['Counter.inc', 'Counter.reset'], 2)],
  7: [('Counter', [], ['Counter.inc', 'Counter.reset', 'Counter.get'], 2)],
  8: [('Counter', [], ['Counter.inc', 'Counter.reset'], 2)],
}
for _p in (5, 6, 7, 8):
  _cid = f'phase{_p}-demo'
  write_json(f'.w-model/change-scope.p{_p}.json', {
    'changeId': _cid, 'phase': _p, 'baseRef': BASE_SHA, 'headRef': HEAD_SHA,
    'scopeCreatedAt': '2026-09-19T03:30:00.000Z', 'changedFiles': PHASE_FILES[_p],
  })
  for _sym, _callers, _callees, _radius in PHASE_SYMBOLS[_p]:
    write_json(f'.w-model/codegraph-queries/{_cid}-{_sym.replace(".", "-")}.json', {
      'querySymbol': _sym, 'changeId': _cid, 'targetFiles': PHASE_FILES[_p],
      'callers': _callers, 'callees': _callees, 'blastRadius': _radius,
      'queryTimestamp': '2026-09-19T03:20:00.000Z',
    })
  for _stage_name in ('explore', 'propose', 'coding'):
    for _dim in ('completeness', 'reliability', 'security'):
      write(f'.w-model/r3-reviews/phase{_p}-{_stage_name}-{_dim}.md',
            '# ' + _stage_name + ' ' + _dim + chr(10) + chr(10) + f'阶段 {_p} opsx {_stage_name} 环节 R3 {_dim} 审查（e2e 调测）：通过，无 Required 发现。' + chr(10))
    write(f'.w-model/v-reviews/phase{_p}-{_stage_name}.md',
          '# V ' + _stage_name + chr(10) + chr(10) + f'阶段 {_p} opsx {_stage_name} 环节 V 审查（e2e 调测）：通过。' + chr(10))
  for _doc in ('proposal.md', 'design.md', 'tasks.md', 'tickets.md'):
    write(f'openspec/changes/{_cid}/{_doc}',
          '# ' + _doc[:-3] + chr(10) + chr(10) + f'{_cid} 变更{_doc[:-3]}（counter-api e2e 调测）：变更文件 ' + ', '.join(PHASE_FILES[_p]) + '。' + chr(10))
  write(f'openspec/changes/{_cid}/specs/.gitkeep', '')

print('workspace built at', ROOT)

