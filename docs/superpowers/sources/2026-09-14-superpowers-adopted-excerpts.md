# obra/superpowers 采纳项原文摘录（vendor 基准）

> **用途**：本仓库采纳主张的**唯一可复核证据基准**。全部采纳项源自外部仓库 `D:/w_skill_opt/superpowers`（obra/superpowers v6.3.0），受控 commit `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`。
> **复核方式**：本文件内容即证据原文，**无需访问外部仓库**；如需再核，可按下方 SHA-256 与行号范围对照该 commit。
> **逐字原则**：所有摘录均为原文逐字复制（含缩进、标点、emoji、代码块），未做任何改写；省略处一律用 `…（略）…` 明确标注。
> **范围**：只摘录被采纳项实际引用的行段；未采纳内容不 vendor。
> **来源许可**：外部仓库为公开发布的技能集，此处仅摘录用于评审的短行段并完整标注来源。

---

## S01 Match the Form to the Failure

- **来源**：`skills/writing-skills/SKILL.md`
- **行号范围**：459-474；480
- **源文件 SHA-256**：`d34db5c8aed6a4e0440132bd0613aace70a693ec7819d5637ad77481d8e10d1b`
- **采纳要点**：**Match the Form to the Failure**（按失败类型选形式）+ **No nuance clauses** + **Exemption clauses don't scope**（design spec §3 L74）

```text
[L459-474]
## Match the Form to the Failure

Before writing guidance, classify the baseline failure. The form that bulletproofs one failure type measurably backfires on another.

| Baseline failure | Right form | Wrong form |
|---|---|---|
| Skips/violates a rule under pressure (knows better, does it anyway) | Prohibition + rationalization table + red flags (see Bulletproofing below) | Soft guidance ("prefer...", "consider...") |
| Complies, but output has the wrong shape (bloated prompt, buried verdict, restated spec) | Positive recipe or contract: state what the output IS — its parts, in order | Prohibition list ("don't restate", "never narrate") |
| Omits a required element from something they already produce | Structural: REQUIRED field or slot in the template they fill in | Prose reminders near the template |
| Behavior should depend on a condition | Conditional keyed to an observable predicate ("if the brief exists, reference it") | Unconditional rule + exemption clauses |

**Why prohibitions backfire on shaping problems:** under a competing incentive ("make the prompt self-contained"), agents negotiate with "don't X". In head-to-head wording tests on dispatch-prompt guidance, the prohibition arm produced clearly more of the unwanted content than the recipe arm (fully separated distributions), and trended worse than even the no-guidance control — micro-test your own case rather than assuming, but never reach for the prohibition by default. A recipe leaves nothing to negotiate: the output matches the stated shape or it doesn't.

**Rules for whichever form you pick:**
- **No nuance clauses.** "Don't X unless it matters" reopens the negotiation — appending a single nuance clause to a winning recipe degraded it from consistent to noisy in the same wording tests. Express a real exception as its own conditional on an observable predicate.
- **Exemption clauses don't scope.** "This limit doesn't apply to code blocks" still suppresses code blocks. If part of the output must be exempt, restructure so the rule can't reach it.

…（略）…

[L480]
**Scope:** this toolkit is for discipline failures — an agent that knows the rule and skips it under pressure. For wrong-shaped output or omitted elements, prohibition-based bulletproofing backfires; use the forms in Match the Form to the Failure instead.
```

## S02 Description: When, Never What

- **来源**：`skills/writing-skills/SKILL.md`
- **行号范围**：99-103；150-158；160-197
- **源文件 SHA-256**：`d34db5c8aed6a4e0440132bd0613aace70a693ec7819d5637ad77481d8e10d1b`
- **采纳要点**：description 只写 when、**绝不概括工作流**（含因果事故链与正反例）（design spec §3 L71）

````text
[L99-103]
- `description`: Third-person, describes ONLY when to use (NOT what it does)
  - Start with "Use when..." to focus on triggering conditions
  - Include specific symptoms, situations, and contexts
  - **NEVER summarize the skill's process or workflow** (see SDO section for why)
  - Keep under 500 characters if possible

…（略）…

[L150-158]
**CRITICAL: Description = When to Use, NOT What the Skill Does**

The description should ONLY describe triggering conditions. Do NOT summarize the skill's process or workflow in the description.

**Why this matters:** Testing revealed that when a description summarizes the skill's workflow, an agent may follow the description instead of reading the full skill content. A description saying "code review between tasks" caused an agent to do ONE review, even though the skill's flowchart clearly showed TWO reviews (spec compliance then code quality).

When the description was changed to just "Use when executing implementation plans with independent tasks" (no workflow summary), the agent correctly read the flowchart and followed the two-stage review process.

**The trap:** Descriptions that summarize workflow create a shortcut agents will take. The skill body becomes documentation agents skip.

…（略）…

[L160-197]
```yaml
# ❌ BAD: Summarizes workflow - agents may follow this instead of reading skill
description: Use when executing plans - dispatches subagent per task with code review between tasks

# ❌ BAD: Too much process detail
description: Use for TDD - write test first, watch it fail, write minimal code, refactor

# ✅ GOOD: Just triggering conditions, no workflow summary
description: Use when executing implementation plans with independent tasks in the current session

# ✅ GOOD: Triggering conditions only
description: Use when implementing any feature or bugfix, before writing implementation code
```

**Content:**
- Use concrete triggers, symptoms, and situations that signal this skill applies
- Describe the *problem* (race conditions, inconsistent behavior) not *language-specific symptoms* (setTimeout, sleep)
- Keep triggers technology-agnostic unless the skill itself is technology-specific
- If skill is technology-specific, make that explicit in the trigger
- Write in third person (injected into system prompt)
- **NEVER summarize the skill's process or workflow**

```yaml
# ❌ BAD: Too abstract, vague, doesn't include when to use
description: For async testing

# ❌ BAD: First person
description: I can help you with async tests when they're flaky

# ❌ BAD: Mentions technology but skill isn't specific to it
description: Use when tests use setTimeout/sleep and are flaky

# ✅ GOOD: Starts with "Use when", describes problem, no workflow
description: Use when tests have race conditions, timing dependencies, or pass/fail inconsistently

# ✅ GOOD: Technology-specific skill with explicit trigger
description: Use when using React Router and handling authentication redirects
```
````

## S03 Progressive Disclosure Thresholds and Pointer Conventions

- **来源**：`skills/writing-skills/anthropic-best-practices.md`（L241-243；353-357；383-385；1099）；`skills/writing-skills/SKILL.md`（L84-91；217-220；278-288）
- **行号范围**：anthropic-best-practices.md 241-243；353-357；383-385；1099 ／ SKILL.md 84-91；217-220；278-288
- **源文件 SHA-256**：anthropic-best-practices.md `217629b356c09c9bd11017c9788e8fc654ca1b32c92d4a51cd490e16dd65e59a`；SKILL.md `d34db5c8aed6a4e0440132bd0613aace70a693ec7819d5637ad77481d8e10d1b`
- **采纳要点**：**渐进披露数字阈值**（body <500 行 / >100 行拆 / <50 行内联 / 引用一层深 / >100 行加 TOC / 词数 <150/<200/<500）+ 指针约定（REQUIRED SUB-SKILL 标记；**禁 `@` 深链**及 200k context 成本论证）（design spec §3 L69）
- **注**：台账对 anthropic-best-practices.md 记区间 L235-408，此处按最小证据原则摘取 L241-243、353-357、383-385；所摘行号均落在台账区间内。

```text
[anthropic-best-practices.md L241-243]
* Keep SKILL.md body under 500 lines for optimal performance
* Split content into separate files when approaching this limit
* Use the patterns below to organize instructions, code, and resources effectively

…（略）…

[anthropic-best-practices.md L353-357]
### Avoid deeply nested references

Agents may partially read files when they're referenced from other referenced files. When encountering nested references, an agent might use commands like `head -100` to preview content rather than reading entire files, resulting in incomplete information.

**Keep references one level deep from SKILL.md**. All reference files should link directly from SKILL.md to ensure agents read complete files when needed.

…（略）…

[anthropic-best-practices.md L383-385]
### Structure longer reference files with table of contents

For reference files longer than 100 lines, include a table of contents at the top. This ensures agents can see the full scope of available information even when previewing with partial reads.

…（略）…

[anthropic-best-practices.md L1099]
Keep SKILL.md body under 500 lines for optimal performance. If your content exceeds this, split it into separate files using the progressive disclosure patterns described earlier. For architectural details, see the [Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#how-skills-work).

…（略）…

[SKILL.md L84-91]
**Separate files for:**
1. **Heavy reference** (100+ lines) - API docs, comprehensive syntax
2. **Reusable tools** - Scripts, utilities, templates

**Keep inline:**
- Principles and concepts
- Code patterns (< 50 lines)
- Everything else

…（略）…

[SKILL.md L217-220]
**Target word counts:**
- getting-started workflows: <150 words each
- Frequently-loaded skills: <200 words total
- Other skills: <500 words (still be concise)

…（略）…

[SKILL.md L278-288]
### 5. Cross-Referencing Other Skills

**When writing documentation that references other skills:**

Use skill name only, with explicit requirement markers:
- ✅ Good: `**REQUIRED SUB-SKILL:** Use superpowers:test-driven-development`
- ✅ Good: `**REQUIRED BACKGROUND:** You MUST understand superpowers:systematic-debugging`
- ❌ Bad: `See skills/testing/test-driven-development` (unclear if required)
- ❌ Bad: `@skills/testing/test-driven-development/SKILL.md` (force-loads, burns context)

**Why no @ links:** `@` syntax force-loads files immediately, consuming 200k+ context before you need them.
```

## S04 Authoring Gate: No-Guidance Control

- **来源**：`skills/writing-skills/SKILL.md`
- **行号范围**：580；644-645
- **源文件 SHA-256**：`d34db5c8aed6a4e0440132bd0613aace70a693ec7819d5637ad77481d8e10d1b`
- **采纳要点**：no-guidance control 的**"授权不写"**语义：control 不复现失败即不得写这条规则（design spec §3 L70）
- **注**：台账记 L645，实测为 L644-645（L644 为该项上下文行）。

```text
[L580]
2. **Always include a no-guidance control.** If the control doesn't exhibit the failure, there is nothing to fix — stop, don't author the guidance.

…（略）…

[L644-645]
- [ ] Guidance form matches the failure type (see Match the Form to the Failure)
- [ ] For behavior-shaping guidance: wording micro-tested against a no-guidance control (5+ reps, every flagged match read manually) — N/A for pure reference skills
```

## S05 Mechanical Constraints → Automate

- **来源**：`skills/writing-skills/SKILL.md`
- **行号范围**：59
- **源文件 SHA-256**：`d34db5c8aed6a4e0440132bd0613aace70a693ec7819d5637ad77481d8e10d1b`
- **采纳要点**：机械约束→自动化，文档只留判断题（design spec §3 L72）

```text
[L59]
- Mechanical constraints (if it's enforceable with regex/validation, automate it—save documentation for judgment calls)
```

## S06 Do Not Pre-Judge Findings

- **来源**：`skills/subagent-driven-development/SKILL.md`
- **行号范围**：339-344
- **源文件 SHA-256**：`8dd1b8e698edec3700c6d89517dbe96febd3bacd3f6ea21c1a3569c62ea104b5`
- **采纳要点**：**禁止编排者预判 findings**（不得在 dispatch prompt 写 "do not flag" / "at most Minor"）（design spec §3 L82）

```text
[L339-344]
- Do not pre-judge findings for the reviewer — never instruct a reviewer to
  ignore or not flag a specific issue. If you believe a finding would be a
  false positive, let the reviewer raise it and adjudicate it in the review
  loop. If the prompt you are writing contains "do not flag," "don't treat X
  as a defect," "at most Minor," or "the plan chose" — stop: you are
  pre-judging, usually to spare yourself a review loop.
```

## S07 Do Not Trust the Report

- **来源**：`skills/subagent-driven-development/task-reviewer-prompt.md`
- **行号范围**：64-71；84-85；153-157
- **源文件 SHA-256**：`eea23e33ec570c3041f40e9569fa711d61b8029f9eecf908345138aa1c6e61ab`
- **采纳要点**：**"不信任报告"**：作者 rationale 是 claim、不得降级 severity；plan 作者不自评自己的 plan；test output 的 warning 即 finding（design spec §3 L83）
- **注**：台账记 L84，实测该句为 L84-85；台账记 L152-157，实测支撑"plan 作者不自评"的行段为 L153-157（L152 为上一句的句尾片段）。

```text
[L64-71]
    ## Do Not Trust the Report

    Treat the implementer's report as unverified claims about the code. It
    may be incomplete, inaccurate, or optimistic. Verify the claims against
    the diff. Design rationales in the report are claims too: "left it per
    YAGNI," "kept it simple deliberately," or any other justification is the
    implementer grading their own work. Judge the code on its merits — a
    stated rationale never downgrades a finding's severity.

…（略）…

[L84-85]
    Warnings or other noise in the implementer's reported test output are
    findings — test output should be pristine.

…（略）…

[L153-157]
    If the plan or brief explicitly mandates something this rubric calls a
    defect (a test that asserts nothing, verbatim duplication of a logic
    block), that IS a finding — report it as Important, labeled
    plan-mandated. The plan's authorship does not grade its own work; the
    human decides.
```

## S08 Push Back on External Review Findings

- **来源**：`skills/receiving-code-review/SKILL.md`
- **行号范围**：68-84；88-98；113-129
- **源文件 SHA-256**：`091df1629510af1b92fc4abd6f96732ebedb4cb2c0f3457e8f2740b0504a2438`
- **采纳要点**：面向 V finding 的**误报质疑通道（回流新 V，禁 O 裁决）**（design spec §3 L84）
- **注**：台账记 L76-84，实测 L76-84 为 L68 起始代码块的尾部；此处取 L68-84 以保留完整代码块。台账其余两段（88-98 / 113-129）与实测一致。

````text
[L68-84]
```
BEFORE implementing:
  1. Check: Technically correct for THIS codebase?
  2. Check: Breaks existing functionality?
  3. Check: Reason for current implementation?
  4. Check: Works on all platforms/versions?
  5. Check: Does reviewer understand full context?

IF suggestion seems wrong:
  Push back with technical reasoning

IF can't easily verify:
  Say so: "I can't verify this without [X]. Should I [investigate/ask/proceed]?"

IF conflicts with your human partner's prior decisions:
  Stop and discuss with your human partner first
```

…（略）…

[L88-98]
## YAGNI Check for "Professional" Features

```
IF reviewer suggests "implementing properly":
  grep codebase for actual usage

  IF unused: "This endpoint isn't called. Remove it (YAGNI)?"
  IF used: Then implement properly
```

**your human partner's rule:** "You and reviewer both report to me. If we don't need this feature, don't add it."

…（略）…

[L113-129]
## When To Push Back

Push back when:
- Suggestion breaks existing functionality
- Reviewer lacks full context
- Violates YAGNI (unused feature)
- Technically incorrect for this stack
- Legacy/compatibility reasons exist
- Conflicts with your human partner's architectural decisions

**How to push back:**
- Use technical reasoning, not defensiveness
- Ask specific questions
- Reference working tests/code
- Involve your human partner if architectural

**If you're uncomfortable pushing back out loud:** Name that tension, then tell your partner about the issue you've seen. They'll appreciate your honesty.
````

## S09 Scoped Re-Review with Per-Finding Verdicts

- **来源**：`skills/subagent-driven-development/re-review-prompt.md`（L55-62；80-86）；`skills/subagent-driven-development/SKILL.md`（L361-365；372-373）
- **行号范围**：re-review-prompt.md 55-62；80-85 ／ SKILL.md 361-365；372-373
- **源文件 SHA-256**：re-review-prompt.md `db0d5849478bc79cbde97b9b2cf0e58b50be8b8ed18464b0252c2bf27b6440a6`；SKILL.md `8dd1b8e698edec3700c6d89517dbe96febd3bacd3f6ea21c1a3569c62ea104b5`
- **采纳要点**：scoped re-review：只审 fix delta + 逐 finding `ADDRESSED/NOT ADDRESSED`（"**Attempted is not addressed**"）+ Minor 不进 loop（design spec §3 L85）
- **注**：台账记 re-review-prompt.md L52-57，实测该区间为 "You Do Not Dispatch Subagents" 尾句 + "Scope" 节，而"逐 finding 裁决 / Attempted is not addressed"实测位于 L80-85（L86 为源文件空行）；此处以实测为准列出 L55-62 与 L80-85。台账对 SKILL.md L361-365、372-373 与实测一致。

```text
[re-review-prompt.md L55-62]
    ## Scope

    Your scope is the findings list and the fix diff. Verdict every finding.
    Inspect the fix diff for new problems the fix itself introduced. Do NOT
    re-review code the fix did not touch: if you notice an issue entirely
    outside the fix diff, report it under Out-of-Scope Observations — it
    does not block this task and does not extend the loop. A broad
    whole-branch review happens after all tasks are complete.

…（略）…

[re-review-prompt.md L80-85]
    ### Finding Verdicts

    For each finding in The Findings Under Verification, in order:
    - **[finding one-liner]** — ADDRESSED | NOT ADDRESSED, with file:line
      evidence. "Attempted" is not addressed: the specific defect must no
      longer exist.

…（略）…

[SKILL.md L361-365]
- Record Minor findings in the progress ledger as you go
  (`Task <N>: minor (deferred): <one-liner>`), and point the final
  whole-branch review at that list so it can triage which must be fixed
  before merge. A roll-up nobody reads is a silent discard. Minor findings
  never enter the loop.

…（略）…

[SKILL.md L372-373]
Everything else enters the loop. A fix round is one fix dispatch plus one
scoped re-review. Five rounds maximum per task:
```

## S10 Ruling Three-Part Record + Exhaustive Handover

- **来源**：`skills/subagent-driven-development/SKILL.md`
- **行号范围**：19-25；473-480
- **源文件 SHA-256**：`8dd1b8e698edec3700c6d89517dbe96febd3bacd3f6ea21c1a3569c62ea104b5`
- **采纳要点**：**Ruling 三要素**（含"**若错代价**"）+ 穷尽上缴用户（design spec §3 L88）
- **注**：台账记 L22-25，实测 `Ruling:` 三要素句起始于 L19；此处取 L19-25 以保留完整句子，L22-25 为其子集。台账对 L473-480 与实测一致。

```text
[L19-25]
**Rulings, not stalls.** A running plan does not wait on a human. Conflicts,
ambiguities, plan defects, a cap you would have asked to exceed — decide
them. The spec is the binding authority, the plan is its argument, and your
judgment settles what neither answers. Record every decision in the ledger as
`Ruling: <what you decided> — <why> — <what it costs if wrong>`, and keep
going. A wrong ruling costs rework your human partner can see and undo; a
session parked on a question costs their whole day and buys nothing.

…（略）…

[L473-480]
Before you delete anything, collect every ledger line containing `Ruling:` —
preflight rulings, parked findings, breaker adjudications, all of them — into
your final message under "Rulings I made", in the order you made them, each
with what it costs if wrong. The list is exhaustive: if the ledger holds a
ruling, the list holds it. That list is the only place the decisions you
took on your human partner's behalf reach them — they read it and rework
whatever you got wrong. A ruling that dies with the workspace was a decision
made in secret.
```

## S11 Model Selection by Tier and Escalation

- **来源**：`skills/subagent-driven-development/SKILL.md`
- **行号范围**：184-206；208-219
- **源文件 SHA-256**：`8dd1b8e698edec3700c6d89517dbe96febd3bacd3f6ea21c1a3569c62ea104b5`
- **采纳要点**：**模型档位 × 修复轮次 escalation + 必须显式指定模型**（design spec §3 L89）
- **注**：台账记 L184-219（整段连续）；此处按最小证据原则摘取 L184-206 与 L208-219，未摘 L207 空行。

```text
[L184-206]
## Model Selection

Use the least powerful model that can handle each role to conserve cost and increase speed.

**Mechanical implementation tasks** (isolated functions, clear specs, 1-2 files): use a fast, cheap model. Most implementation tasks are mechanical when the plan is well-specified.

**Integration and judgment tasks** (multi-file coordination, pattern matching, debugging): use a standard model.

**Architecture and design tasks**: use the most capable available model.
The final whole-branch review is one of these — dispatch it on the most
capable available model, not the session default.

**Review tasks**: choose the model with the same judgment, scaled to the
diff's size, complexity, and risk. A small mechanical diff does not need the
most capable model; a subtle concurrency change does. Scoped re-reviews of
small fix diffs take a cheap-to-mid tier.

**Fix-loop escalation (rounds 4-5)**: use a model at least one tier above
the implementer that got stuck.

**Always specify the model explicitly when dispatching a subagent.** An
omitted model inherits your session's model — often the most capable and
most expensive — which silently defeats this section.

…（略）…

[L208-219]
**Turn count beats token price.** Wall-clock and context cost scale with how
many turns a subagent takes, and the cheapest models routinely take 2-3× the
turns on multi-step work — costing more overall. Use a mid-tier model as the
floor for reviewers and for implementers working from prose descriptions.
When the task's plan text contains the complete code to write, the
implementation is transcription plus testing: use the cheapest tier for
that implementer. Single-file mechanical fixes also take the cheapest tier.

**Task complexity signals (implementation tasks):**
- Touches 1-2 files with a complete spec → cheap model
- Touches multiple files with integration concerns → standard model
- Requires design judgment or broad codebase understanding → most capable model
```

## S12 Preflight Pairwise Conflict Scan

- **来源**：`skills/subagent-driven-development/SKILL.md`
- **行号范围**：162-182
- **源文件 SHA-256**：`8dd1b8e698edec3700c6d89517dbe96febd3bacd3f6ea21c1a3569c62ea104b5`
- **采纳要点**：**preflight 成对冲突扫描表**（design spec §3 L125）

```text
[L162-182]
Before dispatching Task 1, scan the plan once for conflicts, writing down
what you checked as you check it:

- tasks that contradict each other or the plan's Global Constraints
- anything the plan explicitly mandates that the review rubric treats as a
  defect (a test that asserts nothing, verbatim duplication of a logic block)

The scan's output is a table, not a verdict. One row for every pair of tasks
that share a file or an interface: the two tasks, what one produces against
what the other consumes, and what you found. One row for every task: whether
its own text agrees with itself — the tests it specifies against the code it
specifies, the files it creates against the files it later touches. "The scan
is clean" without those rows is not a scan you ran.

Write the table to the ledger. Rule on everything you find before execution
begins — each finding against the plan text that mandates it — and record
each ruling in the ledger. If the scan is clean, proceed without comment.
Rule on each conflict it surfaces — the spec is the binding authority, the
plan is its argument — record the ruling beside its row, and dispatch
Task 1. The review loop remains the net for conflicts that only emerge from
implementation.
```

## S13 Legitimate "No Root Cause" Exit

- **来源**：`skills/systematic-debugging/SKILL.md`
- **行号范围**：266-275
- **源文件 SHA-256**：`808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`
- **采纳要点**：**"无根因"合法出口**（真环境/时序/外部）+ "95% 反例"警示（design spec §3 L119）

```text
[L266-275]
## When Process Reveals "No Root Cause"

If systematic investigation reveals issue is truly environmental, timing-dependent, or external:

1. You've completed the process
2. Document what you investigated
3. Implement appropriate handling (retry, timeout, error message)
4. Add monitoring/logging for future investigation

**But:** 95% of "no root cause" cases are incomplete investigation.
```

## S14 Three-or-More Failed Fixes Architectural Criterion

- **来源**：`skills/systematic-debugging/SKILL.md`
- **行号范围**：191-212
- **源文件 SHA-256**：`808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`
- **采纳要点**：**≥3 次修复失败的技术判据**（暴露新共享状态且位置不同 / 要求大规模重构 / 别处产生新症状 → 架构错误）（design spec §3 L90）

```text
[L191-212]
4. **If Fix Doesn't Work**
   - STOP
   - Count: How many fixes have you tried?
   - If < 3: Return to Phase 1, re-analyze with new information
   - **If ≥ 3: STOP and question the architecture (step 5 below)**
   - DON'T attempt Fix #4 without architectural discussion

5. **If 3+ Fixes Failed: Question Architecture**

   **Pattern indicating architectural problem:**
   - Each fix reveals new shared state/coupling/problem in different place
   - Fixes require "massive refactoring" to implement
   - Each fix creates new symptoms elsewhere

   **STOP and question fundamentals:**
   - Is this pattern fundamentally sound?
   - Are we "sticking with it through sheer inertia"?
   - Should we refactor architecture vs. continue fixing symptoms?

   **Discuss with your human partner before attempting more fixes**

   This is NOT a failed hypothesis - this is a wrong architecture.
```

## S15 Three-Path Triage and One-Way Ratchet

- **来源**：`skills/brainstorming/SKILL.md`
- **行号范围**：22-52；63-73
- **源文件 SHA-256**：`74edf03ea6d24ef53db48677b93558d14a979bdf052ca3f57ecdca0c66791608`
- **采纳要点**：**三路径分诊 + 单向棘轮 + 分类口播**（design spec §3 L133）

```text
[L22-52]
## Three Paths

Before your first question, classify the request and say the
classification out loud — "this looks bounded, so I'll present a short
design here rather than write a spec" — so your human partner can
override it:

- **Spike** — a feasibility question ("can we...", "is it possible...",
  "quick and dirty is fine") whose output is an answer, not code you
  keep. Present the question and what you'll try in 2-3 sentences, get
  a nod, then find out as cheaply as correctness allows. No design
  doc, no spec file. Report findings as a recommendation; anything you
  built stays labeled throwaway.
- **Bounded** — a well-scoped change to code that already exists in
  this repo: a new flag, a small endpoint, a one-file fix.
  Understanding the kind of app is not enough — bounded means the flow
  you are changing is already here to read. If there is no existing
  flow to change, the task is not bounded. Ask the clarifying
  questions that matter, present a short design IN CHAT (a few
  sentences to a few short paragraphs), and STOP. Implementation
  starts only after your human partner says yes to that design — a
  bounded task's approval is as hard a gate as an architectural
  one. No spec file, no implementation plan document.
- **Architectural** — new projects, new subsystems, changes that
  restructure how components fit together or alter interfaces others
  depend on. Follow the full process: questions, approaches, sectioned
  design, written spec, then the writing-plans skill.

When in doubt between two paths, take the heavier one. The ratchet is
one-way: hidden complexity discovered mid-task upgrades the path —
stop, say so, and step up. Nothing downgrades mid-task.

…（略）…

[L63-73]
## Red Flags

| Thought | Reality |
|---------|---------|
| "This is too simple to need a design" | Simple means a short design, not no design. Two sentences in chat, then approval. |
| "I'll call it bounded and skip the spec" | Reaching for a label to skip work IS the doubt — take the heavier path. |
| "It's bounded and the design is obvious — I'll start while they read it" | The gate is the approval, not the design's length. Present, then stop until you hear yes. |
| "I understand this kind of app, so it's bounded" | Bounded measures the repo, not your familiarity. A new project has no existing flow — it is architectural. |
| "The spike works, so I'll keep the code" | A spike's output is an answer. Keeping the code is a new request — classify it. |
| "It grew, but I'm almost done — no need to re-classify" | Hidden complexity upgrades the path mid-task. Stop and say so. |
| "They approved the spike, so the follow-up change is approved too" | Each task gets its own classification and its own approval. |
```

## S16 Spec Self-Review and Reviewer Calibration

- **来源**：`skills/brainstorming/SKILL.md`（L211-219）；`skills/brainstorming/spec-document-reviewer-prompt.md`（L19-34）
- **行号范围**：SKILL.md 211-219 ／ spec-document-reviewer-prompt.md 19-34
- **源文件 SHA-256**：SKILL.md `74edf03ea6d24ef53db48677b93558d14a979bdf052ca3f57ecdca0c66791608`；spec-document-reviewer-prompt.md `95a0a195de9d984be2fffa95bab16fc8c563bc296a9cfc5e9c29cb3ece0d7457`
- **采纳要点**：spec self-review 4 项 + 独立 spec reviewer + **calibration 阈值**（治 V 过度判负）（design spec §3 L86）

```text
[SKILL.md L211-219]
**Spec Self-Review:**
After writing the spec document, look at it with fresh eyes:

1. **Placeholder scan:** Any "TBD", "TODO", incomplete sections, or vague requirements? Fix them.
2. **Internal consistency:** Do any sections contradict each other? Does the architecture match the feature descriptions?
3. **Scope check:** Is this focused enough for a single implementation plan, or does it need decomposition?
4. **Ambiguity check:** Could any requirement be interpreted two different ways? If so, pick one and make it explicit.

Fix any issues inline. No need to re-review — just fix and move on.

…（略）…

[spec-document-reviewer-prompt.md L19-34]
    | Category | What to Look For |
    |----------|------------------|
    | Completeness | TODOs, placeholders, "TBD", incomplete sections |
    | Consistency | Internal contradictions, conflicting requirements |
    | Clarity | Requirements ambiguous enough to cause someone to build the wrong thing |
    | Scope | Focused enough for a single plan — not covering multiple independent subsystems |
    | YAGNI | Unrequested features, over-engineering |

    ## Calibration

    **Only flag issues that would cause real problems during implementation planning.**
    A missing section, a contradiction, or a requirement so ambiguous it could be
    interpreted two different ways — those are issues. Minor wording improvements,
    stylistic preferences, and "sections less detailed than others" are not.

    Approve unless there are serious gaps that would lead to a flawed plan.
```

## S17 CHECKPOINT 呈现内核 4 条

- **来源**：`skills/brainstorming/visual-companion.md`；`skills/brainstorming/SKILL.md`
- **行号范围**：`visual-companion.md` 7；127-136；277。`SKILL.md` 240
- **源文件 SHA-256**：`77eb44a4ec3408bb3dafb872288ecd94beb8cf21da4f2bafa54fd08255d7808b`（`skills/brainstorming/visual-companion.md`）；`74edf03ea6d24ef53db48677b93558d14a979bdf052ca3f57ecdca0c66791608`（`skills/brainstorming/SKILL.md`）
- **采纳要点**：呈现内核 4 条：逐问判定 / 2-4 选项 / **后撤屏**（推进时作废上一问的呈现物）/ **提议独占一条消息**（设计 spec §3.5 S17）

````text
[L7]
Decide per-question, not per-session. The test: **would the user understand this better by seeing it than reading it?**

…（略）…

[L127-136]
5. **Unload when returning to terminal** — when the next step doesn't need the browser (e.g., a clarifying question, a tradeoff discussion), push a waiting screen to clear the stale content:

   ```html
   <!-- filename: waiting.html (or waiting-2.html, etc.) -->
   <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
     <p class="subtitle">Continuing in terminal...</p>
   </div>
   ```

   This prevents the user from staring at a resolved choice while the conversation has moved on. When the next visual question comes up, push a new content file as usual.

…（略）…

[L277]
- **2-4 options max** per screen

…（略）…

[`skills/brainstorming/SKILL.md` L240]
**This offer MUST be its own message.** Only the offer — no clarifying question, summary, or other content. Wait for the user's response. If they accept, start the server with `--open` so their browser opens to the first screen automatically. If they decline, continue text-only and don't offer again unless they raise it.
````

## S18 No Placeholders 七条黑名单 + Buildability 判据

- **来源**：`skills/writing-plans/SKILL.md`；`skills/writing-plans/plan-document-reviewer-prompt.md`
- **行号范围**：`SKILL.md` 131-139；`plan-document-reviewer-prompt.md` 25
- **源文件 SHA-256**：`48508f44bbfd7d24b029fbf3a314f3cd14c9615599059366e922f47b8dc08cf2`（`skills/writing-plans/SKILL.md`）；`aa728b96aad603c8be28875a4305637f6c984aa81ffcadcb13e743202fa2a0c7`（`skills/writing-plans/plan-document-reviewer-prompt.md`）
- **采纳要点**：**No Placeholders 七条黑名单** + Buildability 判据（设计 spec §3.5 S18，落点「票据校验（`check-artifact-gate.ts --phase=5`）+ V 必答项」）

```text
[L131-139]
## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

…（略）…

[L25]
    | Buildability | Could an engineer follow this plan without getting stuck? |
```

## S19 Mutation Check 5 类变异

- **来源**：`skills/test-driven-development/writing-good-tests.md`
- **行号范围**：157-169
- **源文件 SHA-256**：`51471c853306ff92ca8bb41dcaea05f31c0e46b03651f8f3c99754b7172f4ae1`
- **采纳要点**：**Mutation Check 5 类变异**（错误常量/参数、错误分支、缺失状态变更/副作用、空或 default 返回、零/空/nil/未授权/畸形输入缺校验）+ 判据 "a mutation nothing catches marks the behavior as unprotected — or the test as tautological"（台账 §5 S19；设计 spec §3.3 S19）

```text
[L157-169]
## The Mutation Check

Before finishing, mentally mutate the production code; at least one test
should fail for each realistic mutation:

- Wrong constant or argument
- Wrong branch handler
- Missing state change or side effect
- Empty or default return
- Missing validation for zero, empty, nil, unauthorized, or malformed input

A mutation nothing catches marks the behavior as unprotected — or the
test as tautological.
```

## S20 Mock 三条硬规则

- **来源**：`skills/test-driven-development/writing-good-tests.md`
- **行号范围**：99-102；119-123；125-127；129-133
- **源文件 SHA-256**：`51471c853306ff92ca8bb41dcaea05f31c0e46b03651f8f3c99754b7172f4ae1`
- **采纳要点**：**Mock 三条硬规则**：先学副作用 / 镜像完整结构 / 禁 test-only 方法进生产类（设计 spec §3.3 S20；作用域限定为被测生产代码，不波及门禁 fixture）

````text
[L99-102]
**Mock at the right level.** Learn every side effect of the real method
before replacing it; mock the slow or external operation and keep what
the test depends on real. When unsure, run the test against the real
implementation first and observe what actually needs to happen.

…（略）…

[L119-123]
**Mirror real data completely.** Mock the complete structure as it exists
in reality — all documented fields — not just the ones your test reads.
Partial mocks fail silently when downstream code reads an omitted field:
the test passes while integration breaks.

…（略）…

[L124-127]
**Production classes carry production methods only.** Cleanup that only
tests need lives in test utilities, never as a `destroy()` on the
production class. Ask: is this method called only from tests? Does this
class own this resource's lifecycle? Wrong answers → test utility.

…（略）…

[L129-133]
**Prefer real components over complex mocks.** When mock setup outgrows
the test logic, mocks miss methods the real components have, or tests
break when the mock changes, switch to an integration test with real
components. **your human partner's question:** "Do we need to be using a
mock here?"
````

> 注：台账记 L125-127，实测该段句首为 L124（L124-127）。

## S21 测试质量独有判据（change detector / string-presence trap / Name the break / 期望值独立推导）

- **来源**：`skills/test-driven-development/writing-good-tests.md`
- **行号范围**：41-46；48-53；23-25；27-39
- **源文件 SHA-256**：`51471c853306ff92ca8bb41dcaea05f31c0e46b03651f8f3c99754b7172f4ae1`
- **采纳要点**：change detector / **string-presence trap** / "Name the break" 前置门 / **期望值独立推导**（设计 spec §3.3 S21，落点 `quality-standards.md` + V checklist）

````text
[L22-25]
Before writing the test body, answer: **what production change should
make this test fail — and is that change a bug or a decision?** A test
earns its place by catching a wrong branch, missing side effect, wrong
argument, boundary case, or broken contract.

…（略）…

[L27-39]
**Derive expectations independently.** Use literals and hand-checked
fixtures; table-driven tests with literal `want` values are the preferred
shape. An expectation computed by the code under test — or its helpers —
passes no matter what that code does:

```typescript
// ❌ Mirror assertion: the same builder computes both sides — always true
const expected = buildSearchQuery({ tag: 'urgent' });
expect(buildSearchQuery({ tag: 'urgent' })).toBe(expected);

// ✅ Hand-derived literal
expect(buildSearchQuery({ tag: 'urgent' })).toBe('tag:"urgent"');
```

…（略）…

[L41-46]
**No change detectors.** If only intentional decisions can fail a test —
a constant's value, exact message wording, private structure — it fires
on redesign and sleeps through bugs. Test the behavior that depends on
the decision: not `expect(MAX_RETRIES).toBe(5)` but "a failing call is
retried 5 times and the 6th attempt never happens."

…（略）…

[L47-52]
**Behavior, not text.** Asserting that a script, skill, or config
contains an exact line proves only that the source is the source. Run
scripts against controlled inputs and assert outputs, side effects, or
exit codes. Documents that instruct agents are tested by the consuming
agent's behavior (superpowers:writing-skills); prose for humans earns no
test at all.
````

> 注：台账记 L23-25，实测该句句首为 L22（L22-25）；台账记 L48-53，实测"string-presence trap"整句起于 L47（L47-52）。

## S22 条件等待三要素 + 三反模式

- **来源**：`skills/systematic-debugging/condition-based-waiting.md`
- **行号范围**：36-46；58-107
- **源文件 SHA-256**：`e89fec8400d6cd50f43407cec9fab50976ba4d55d0ec2eb51c0bd68036b54c26`
- **采纳要点**：**条件等待三要素** + 三反模式（台账 §5 S22：先等触发条件 / 基于已知节奏而非猜测 / 注释说明原因；三反模式 = 轮询过快 / 无 timeout / getter 在循环外取陈旧数据）

````text
[L36-46]
```typescript
// ❌ BEFORE: Guessing at timing
await new Promise(r => setTimeout(r, 50));
const result = getResult();
expect(result).toBeDefined();

// ✅ AFTER: Waiting for condition
await waitFor(() => getResult() !== undefined);
const result = getResult();
expect(result).toBeDefined();
```

…（略）…

[L58-80]
## Implementation

Generic polling function:
```typescript
async function waitFor<T>(
  condition: () => T | undefined | null | false,
  description: string,
  timeoutMs = 5000
): Promise<T> {
  const startTime = Date.now();

  while (true) {
    const result = condition();
    if (result) return result;

    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout waiting for ${description} after ${timeoutMs}ms`);
    }

    await new Promise(r => setTimeout(r, 10)); // Poll every 10ms
  }
}
```

…（略）…

[L84-93]
## Common Mistakes

**❌ Polling too fast:** `setTimeout(check, 1)` - wastes CPU
**✅ Fix:** Poll every 10ms

**❌ No timeout:** Loop forever if condition never met
**✅ Fix:** Always include timeout with clear error

**❌ Stale data:** Cache state before loop
**✅ Fix:** Call getter inside loop for fresh data

…（略）…

[L95-107]
## When Arbitrary Timeout IS Correct

```typescript
// Tool ticks every 100ms - need 2 ticks to verify partial output
await waitForEvent(manager, 'TOOL_STARTED'); // First: wait for condition
await new Promise(r => setTimeout(r, 200));   // Then: wait for timed behavior
// 200ms = 2 ticks at 100ms intervals - documented and justified
```

**Requirements:**
1. First wait for triggering condition
2. Based on known timing (not guessing)
3. Comment explaining WHY
````

## S23 worktree 隔离五条 + 清理拥有权判定

- **来源**：`skills/using-git-worktrees/SKILL.md`；`skills/finishing-a-development-branch/SKILL.md`
- **行号范围**：`using-git-worktrees/SKILL.md` 12；26-33；41-45；80-88；121-133；164-167。`finishing-a-development-branch/SKILL.md` 159-201；220-221
- **源文件 SHA-256**：`8cfb86f121269e8f7f12361e6795c4f6738828340e28964c9229d365666c9edd`（`skills/using-git-worktrees/SKILL.md`）；`8db5a922b242dd4e1bf824cb91c13b3e8d8e8a86d6ceaf7f0774eb9cce909d65`（`skills/finishing-a-development-branch/SKILL.md`）
- **采纳要点**：**worktree 隔离五条**（Step0 检测 + submodule 守卫 / 建前取同意 / 原生工具优先 / `git check-ignore` 强制 / **clean baseline 强制**）+ 清理拥有权 + `git worktree prune` 自愈（设计 spec §3.4 S23）

````text
[using-git-worktrees/SKILL.md L12]
**Core principle:** Detect existing isolation first. Then use native tools. Then fall back to git. Never fight the harness.

…（略）…

[using-git-worktrees/SKILL.md L26-33]
**Submodule guard:** `GIT_DIR != GIT_COMMON` is also true inside git submodules. Before concluding "already in a worktree," verify you are not in a submodule:

```bash
# If this returns a path, you're in a submodule, not a worktree — treat as normal repo
git rev-parse --show-superproject-working-tree 2>/dev/null
```

**If `GIT_DIR != GIT_COMMON` (and not a submodule):** You are already in a linked worktree. Skip to Step 2 (Project Setup). Do NOT create another worktree.

…（略）…

[using-git-worktrees/SKILL.md L41-45]
Has the user already indicated their worktree preference in your instructions? If not, ask for consent before creating a worktree:

> "Would you like me to set up an isolated worktree? It protects your current branch from changes."

Honor any existing declared preference without asking. If the user declines consent, work in place and skip to Step 2.

…（略）…

[using-git-worktrees/SKILL.md L80-88]
**MUST verify directory is ignored before creating worktree:**

```bash
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**If NOT ignored:** Add to .gitignore, commit the change, then proceed.

**Why critical:** Prevents accidentally committing worktree contents to repository.

…（略）…

[using-git-worktrees/SKILL.md L121-133]
## Step 3: Verify Clean Baseline

Run tests to ensure workspace starts clean:

```bash
# Use project-appropriate command
npm test / cargo test / pytest / go test ./...
```

**If tests fail:** Report failures, ask whether to proceed or investigate.

**If tests pass:** Report ready.

…（略）…

[using-git-worktrees/SKILL.md L164-167]
| "`git worktree add` is quicker than hunting for a native tool" | A native tool (e.g. `EnterWorktree`) owns placement, branching, and cleanup. Bypassing it is the #1 mistake — it creates phantom state your harness can't see or manage. |
| "The worktree directory is surely ignored already" | Run `git check-ignore`. An unignored worktree directory commits the whole tree into the repo. |
| "Any directory name works" | Explicit instructions beat an existing project-local directory, which beats the `.worktrees/` default. |
| "The workspace is fresh — baseline tests can wait" | A dirty baseline makes every later failure ambiguous. Run the tests now; proceeding past failures is your human partner's call. |

…（略）…

[finishing-a-development-branch/SKILL.md L159-175]
## Step 6: Cleanup Workspace

**Runs for Option 1 and confirmed discards.** Options 2 and 3 always
preserve the worktree. Both callers have already changed directory to the
main repo root — worktree removal must run from outside the worktree —
and use the `GIT_DIR`/`GIT_COMMON`/`WORKTREE_PATH` values captured in
Step 2, from before that directory change.

**If `GIT_DIR == GIT_COMMON`:** Normal repo, no worktree to clean up. Done.

**If `WORKTREE_PATH` is under `.worktrees/` or `worktrees/`:** Superpowers
created this worktree — we own cleanup:

```bash
git worktree remove "$WORKTREE_PATH"
git worktree prune  # Self-healing: clean up any stale registrations
```

…（略）…

[finishing-a-development-branch/SKILL.md L200-201]
**Otherwise:** The host environment owns this workspace — leave it in
place. If your platform provides a workspace-exit tool, use it.

…（略）…

[finishing-a-development-branch/SKILL.md L220-221]
| "The PR is up, so the worktree is clutter now" | PR feedback gets fixed in that worktree. It stays until the work lands. |
| "This other worktree looks stale — I'll clean it too" | Clean up only worktrees under `.worktrees/` or `worktrees/`. Everything else belongs to the host. |
````

## S24 污染源二分定位

- **来源**：`skills/systematic-debugging/root-cause-tracing.md`；`skills/systematic-debugging/find-polluter.sh`
- **行号范围**：`root-cause-tracing.md` 97-107；`find-polluter.sh` 37-68
- **源文件 SHA-256**：`6b0622269e098ca1399e123e553fd385f0b6412d88ef0e9c4f5a8ea9cf1cec7b`（`skills/systematic-debugging/root-cause-tracing.md`）；`dd7b8f13c4cc2a24b33ff87b18da9248f3e1c80a085c3316224f69ff0fa5c43c`（`skills/systematic-debugging/find-polluter.sh`）
- **采纳要点**：**污染源二分定位**（逐文件跑，停在第一个污染源）（设计 spec §3.4 S24，落点「新确定性 CLI（vitest 语义）」，只作按需工具、不得当门禁）

````text
[root-cause-tracing.md L97-107]
## Finding Which Test Causes Pollution

If something appears during tests but you don't know which test:

Use the bisection script `find-polluter.sh` in this directory:

```bash
./find-polluter.sh '.git' 'src/**/*.test.ts'
```

Runs tests one-by-one, stops at first polluter. See script for usage.

…（略）…

[find-polluter.sh L37-46]
COUNT=0
for TEST_FILE in $TEST_FILES; do
  COUNT=$((COUNT + 1))

  # Skip if pollution already exists
  if [ -e "$POLLUTION_CHECK" ]; then
    echo "⚠️  Pollution already exists before test $COUNT/$TOTAL"
    echo "   Skipping: $TEST_FILE"
    continue
  fi

…（略）…

[find-polluter.sh L48-67]
  echo "[$COUNT/$TOTAL] Testing: $TEST_FILE"

  # Run the test
  npm test "$TEST_FILE" > /dev/null 2>&1 || true

  # Check if pollution appeared
  if [ -e "$POLLUTION_CHECK" ]; then
    echo ""
    echo "🎯 FOUND POLLUTER!"
    echo "   Test: $TEST_FILE"
    echo "   Created: $POLLUTION_CHECK"
    echo ""
    echo "Pollution details:"
    ls -la "$POLLUTION_CHECK"
    echo ""
    echo "To investigate:"
    echo "  npm test $TEST_FILE    # Run just this test"
    echo "  cat $TEST_FILE         # Review test code"
    exit 1
  fi
````

## S25 规则负载性因果测试（RED/GREEN/PRESSURE）

- **来源**：`tests/claude-code/test-worktree-native-preference.sh`
- **行号范围**：10-19；87-89；115-119
- **源文件 SHA-256**：`1c0a94fb097ad33186bb7ea2b0321b11d8ba92ed8c6ef61464a2246eec33acf6`
- **采纳要点**：**规则负载性因果测试**（RED/GREEN/PRESSURE：**移除该规则文本必须复现旧行为**）（设计 spec §3.3 S25，落点「新增规则级 fixture 协议（**超越 M06**）」）

```text
[L10-19]
# RED:   Skill without Step 1a (no native tool preference). Agent should use git worktree add.
# GREEN: Skill with Step 1a (explicit tool naming + consent bridge). Agent should use EnterWorktree.
# PRESSURE: Same as GREEN but under time pressure with existing .worktrees/ dir.
#
# Key insight: the fix is Step 1a's text, not file separation. Three things make it work:
#   1. Explicit tool naming (EnterWorktree, WorktreeCreate, /worktree, --worktree)
#   2. Consent bridge ("user's consent = authorization to use native tool")
#   3. Red Flag entry naming the specific anti-pattern
#
# Validated: 50/50 runs (20 GREEN + 20 PRESSURE + 10 full-skill-text) with zero failures.

…（略）…

[L87-89]
            if [ "$mentioned_enter" = "yes" ]; then
                fail=$((fail + 1))
                echo "  Run $i: [UNEXPECTED] Agent used EnterWorktree WITHOUT Step 1a"

…（略）…

[L115-119]
if [ "$PHASE" = "red" ]; then
    echo "--- RED PHASE: Running WITHOUT Step 1a (current skill) ---"
    echo "Expected: Agent uses 'git worktree add' (no native tool awareness)"
    echo ""
    run_and_check "RED" "$SCENARIO" "none" "false"
```

## S26 M06 补强：fail-closed + 状态逐字节不变

- **来源**：`tests/version-bump/test-bump-version.sh`；`tests/codex-plugin-sync/test-sync-to-codex-plugin.sh`
- **行号范围**：`test-bump-version.sh` 61-74；`test-sync-to-codex-plugin.sh` 698-708
- **源文件 SHA-256**：`5ee6381b450985934877a6fb3da71f769559f413419c616158cd6b79ff582ff1`（`tests/version-bump/test-bump-version.sh`）；`f13e38b0a0fcb955bd362c1c91868b47e29c0e7717017e2d145f4069e5096e2c`（`tests/codex-plugin-sync/test-sync-to-codex-plugin.sh`）
- **采纳要点**：M06 补强：**fail-closed + 状态逐字节不变**（违规注入后 fixture 未被污染）（设计 spec §3.3 S26）

```text
[test-bump-version.sh L61-74]
invalid_repo="$TEST_ROOT/invalid"
make_fixture "$invalid_repo" $'name: superpowers\nversion: 123'
cp "$invalid_repo/package.json" "$TEST_ROOT/package.before"
cp "$invalid_repo/.hermes-plugin/plugin.yaml" "$TEST_ROOT/plugin.before"

if /bin/bash "$invalid_repo/scripts/bump-version.sh" 2.3.4 \
  >"$TEST_ROOT/invalid.out" 2>&1; then
  fail "bump accepted a non-string YAML version"
fi

cmp -s "$TEST_ROOT/package.before" "$invalid_repo/package.json" \
  || fail "JSON manifest changed before YAML validation failed"
cmp -s "$TEST_ROOT/plugin.before" "$invalid_repo/.hermes-plugin/plugin.yaml" \
  || fail "invalid YAML manifest changed"

…（略）…

[test-sync-to-codex-plugin.sh L698-708]
    assert_equals "$dirty_apply_status" "1" "Dirty local apply exits with failure"
    assert_contains "$dirty_apply_output" "ERROR: local checkout has uncommitted changes under 'plugins/superpowers'" "Dirty local apply reports protected destination path"
    assert_current_branch "$dirty_apply_dest" "$dirty_apply_dest_branch" "Dirty local apply leaves destination checkout on its original branch"
    assert_branch_absent "$dirty_apply_dest" "sync/superpowers-*" "Dirty local apply does not create sync branch in destination checkout"
    assert_file_equals "$dirty_skill_path" "# Example Skill

Locally modified fixture content." "Dirty local apply preserves tracked working-tree file content"
    assert_equals "$noop_apply_status" "0" "Clean no-op local apply exits successfully"
    assert_contains "$noop_apply_output" "No changes — embedded plugin was already in sync with upstream" "Clean no-op local apply reports no changes"
    assert_current_branch "$noop_apply_dest" "$noop_apply_dest_branch" "Clean no-op local apply leaves destination checkout on its original branch"
    assert_branch_absent "$noop_apply_dest" "sync/superpowers-*" "Clean no-op local apply does not create sync branch in destination checkout"
```

## S27 回归测试回滚证伪协议

- **来源**：`skills/verification-before-completion/SKILL.md`
- **行号范围**：82-86
- **源文件 SHA-256**：`2befe7fc55bcadaa3d97dd9e8efeb633d2561c0ebe74c5a8b17c4d9e7e4520b3`
- **采纳要点**：**回归测试回滚证伪协议**（`revertEvidence`：回滚后必须变红）（设计 spec §3.3 S27，落点「门禁扩展（**补反模式 #45**）」，优先复用既有 `assertionHash` 模式）

````text
[L82-86]
**Regression tests (TDD Red-Green):**
```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```
````

## S28 "断言必须能失败"的自检纪律

- **来源**：`tests/pi/test-pi-extension.mjs`；`tests/hermes/test_bootstrap.py`
- **行号范围**：`test-pi-extension.mjs` 125-136；`test_bootstrap.py` 66-68
- **源文件 SHA-256**：`0f84e8fe4190575e907a109e3b2540a21832ddac4f1bdb76f1074489f4f605c6`（`tests/pi/test-pi-extension.mjs`）；`e189bf61781cabf54ea7f969e5bc6d43de261a9d6fe2ca0f57ec46492f6532b8`（`tests/hermes/test_bootstrap.py`）
- **采纳要点**："断言必须能失败"的自检纪律（瞄准最小证据单元 + 注释写明所防回归）（设计 spec §3.3 S28，落点 `samples/README.md` 矩阵）

```text
[test-pi-extension.mjs L125-136]
  // Assert against the mapping-table rows only. The surrounding prose mentions
  // these same tokens, so matching the whole file would still pass if the table
  // were deleted — the exact regression this test exists to catch.
  const rows = text.split('\n').filter((line) => line.startsWith('|'));
  assert.ok(
    rows.some((row) => /subagent/i.test(row)),
    'mapping table documents subagent dispatch',
  );
  assert.ok(
    rows.some((row) => /todo|task/i.test(row)),
    'mapping table documents task tracking',
  );

…（略）…

[test_bootstrap.py L66-68]
        # A distinctive line from the skill body proves the real SKILL.md was
        # embedded, not a stub.
        assert "You have superpowers" in content
```

## S29 测试替身保真

- **来源**：`tests/hermes/conftest.py`
- **行号范围**：16-26
- **源文件 SHA-256**：`e737e392fd89a560ae870e7baee167fc98331e0cb0e68bf2db02f4a4da5dea72`
- **采纳要点**：测试替身保真（mock 复刻历史 bug 真实契约）（设计 spec §3.3 S29，落点「门禁单测」）

```text
[L16-26]
    def register_skill(name, path):
        # Mimic hermes' real register_skill, which calls path.exists() and
        # therefore breaks on a str (the bug that silently disabled the whole
        # plugin, found 2026-07-23). Keeping that fidelity here means a
        # regression to str paths fails these tests instead of failing
        # silently inside hermes.
        if not isinstance(path, Path):
            raise AttributeError(
                f"register_skill requires a pathlib.Path, got {type(path).__name__}"
            )
        ctx._skills[name] = path
```

> 注：台账记 L15-25，实测为 L16-26（L15 为空行）。

## S30 定量预算断言

- **来源**：`tests/hermes/test_bootstrap.py`
- **行号范围**：13-16；95-98
- **源文件 SHA-256**：`e189bf61781cabf54ea7f969e5bc6d43de261a9d6fe2ca0f57ec46492f6532b8`
- **采纳要点**：定量预算断言（L0 加载体积/文件数上限）（设计 spec §3.3 S30，落点「门禁/单测」）

```text
[L13-16]
# Hermes spills injected context over 10,000 chars to a file, which breaks
# inline injection semantics. The bootstrap must stay under it with margin.
HERMES_CONTEXT_SPILL_LIMIT = 10_000


…（略）…

[L95-98]
            f"bootstrap is {len(content)} chars; hermes spills injected "
            f"context over {HERMES_CONTEXT_SPILL_LIMIT} to a file, which "
            "breaks inline injection"
        )
```

## S31 完整性审计（declared-list + 全仓 grep 未登记载体）

- **来源**：`scripts/bump-version.sh`
- **行号范围**：152-215（摘 185-189；191-215）
- **源文件 SHA-256**：`fc96339dad5f54ffcef3393b28542dbe93ec168573c012d9c599603009e80006`
- **采纳要点**：**完整性审计**（declared-list + 全仓 grep 未登记载体）（设计 spec §3.3 S31，落点 `check-docs-consistency.ts` 新维度，与既有"计数相等"正交互补）

```text
[L185-189]
  # Get list of declared paths for comparison
  local -a declared_paths=()
  while IFS=$'\t' read -r path _field; do
    declared_paths+=("$path")
  done < <(declared_files)

…（略）…

[L191-215]
  # Grep for the version string
  local found_undeclared=0
  while IFS= read -r match; do
    local match_file
    match_file=$(echo "$match" | cut -d: -f1)
    # Make path relative to repo root
    local rel_path="${match_file#$REPO_ROOT/}"

    # Check if this file is in the declared list
    local is_declared=0
    for dp in "${declared_paths[@]}"; do
      if [[ "$rel_path" == "$dp" ]]; then
        is_declared=1
        break
      fi
    done

    if [[ "$is_declared" -eq 0 ]]; then
      if [[ "$found_undeclared" -eq 0 ]]; then
        echo "UNDECLARED files containing '$current_version':"
        found_undeclared=1
      fi
      echo "  $match"
    fi
  done < <(grep -rn "${exclude_args[@]}" -F "$current_version" "$REPO_ROOT" 2>/dev/null || true)
```

## S32 评审包物化为确定性单文件

- **来源**：`skills/subagent-driven-development/scripts/review-package`
- **行号范围**：7-9；32-43
- **源文件 SHA-256**：`7cfee68ad5c53dea3532acd4c34d85148d3e591f2f8da94853478ffd57bf4211`
- **采纳要点**：评审包物化为确定性单文件（diff 包按 range 命名，不进编排者上下文）（设计 spec §3.3 S32，落点「新确定性脚本」）

```text
[L7-9]
# Usage: review-package PLAN_FILE BASE HEAD [OUTFILE]
# Default OUTFILE: <repo-root>/.superpowers/sdd/<plan-basename>/review-<base7>..<head7>.diff
# (named per range, so a re-review after fixes gets a distinct fresh file).

…（略）…

[L32-43]
{
  echo "# Review package: ${base}..${head}"
  echo
  echo "## Commits"
  git log --oneline "${base}..${head}"
  echo
  echo "## Files changed"
  git diff --stat "${base}..${head}"
  echo
  echo "## Diff"
  git diff -U10 "${base}..${head}"
} > "$out"
```
