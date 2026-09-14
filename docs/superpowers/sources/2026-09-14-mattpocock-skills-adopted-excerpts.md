# mattpocock/skills 采纳项原文摘录（vendor 基准）

> **用途**：本仓库采纳主张的**唯一可复核证据基准**。全部采纳项源自外部仓库 `D:/w_skill_opt/skills`（mattpocock/skills），受控 commit `3cca18b368ae95cdbdebbff572ccafa662551015`。
> **复核方式**：本文件内容即证据原文，**无需访问外部仓库**；如需再核，可按下方 SHA-256 与行号范围对照该 commit。
> **逐字原则**：所有摘录均为原文逐字复制（含缩进、标点、emoji、代码块），未做任何改写或删节标记以外的编辑。省略处一律用 `…（略）…` 明确标注。
> **范围**：只摘录被采纳项实际引用的行段；未采纳内容不 vendor（避免把无关上下文引入本仓库）。
> **来源许可**：外部仓库为公开发布的技能集，此处仅摘录用于评审的短行段并完整标注来源。

---

## M01 资产编写杠杆

- **来源**：`skills/productivity/writing-for-agents/SKILL.md`
- **行号范围**：12；16-18；22-27；31-39；41；47-52；63-72；78-81
- **源文件 SHA-256**：1c0c4ebf2d221917591144f0ced4fe46dae13301cb3d6d93fc88ecf0dda6aed2
- **采纳要点**：资产编写杠杆：no-op test（行为性判据："delete the line and ask whether the agent's behaviour changed"；失败删整句而非删词）、leading word（作为 token 重复而非句子；把模糊门变成二值可观测状态）、context load vs cognitive load、信息层级阶梯 + progressive disclosure 的 branching 判据、context pointer 措辞决定命中率 + 三剪枝、completion criteria（clarity + demand）与 premature completion 防御顺序、co-location、pruning 四刀

```text
L12: A **context pointer** is a reference held in the agent's context that names some out-of-context material and encodes the condition for reaching it. A skill's description is one; a line in `AGENTS.md` naming a doc is the same object. The pointer's _wording_, not its target, decides when the agent reaches the material, and how reliably. A must-have target behind a weakly worded pointer is a variance bug: sharpen the wording first, and inline the material only if sharpening fails.

…（略）…

[L16-18]
- **Front-load the leading word**: the pointer is where it does its triggering work.
- **One trigger per branch.** Synonyms that rename a single branch are one branch written twice; collapse them and keep only genuinely distinct branches.
- **Cut identity the body already carries.**

…（略）…

[L22-27]
Every document and pointer you add spends one of two budgets:

- **Context load** is the cost of always-loaded material on the agent's window: an `AGENTS.md` line, a skill description, anything sitting in context every turn, spending tokens and attention whether or not it fires.
- **Cognitive load** is the cost on the human: which documents exist and when to reach for each. The human is the index. Not a cost to minimise: it is the price of human agency; spend it where human judgement matters, remove it where it does not.

Material reached only through a pointer escapes context load at the price of the pointer's own line; material with no pointer at all rides entirely on cognitive load.

…（略）…

[L31-39]
A document is built from two content types: **steps** (the ordered actions the agent performs) and **reference** (definitions, rules, facts consulted on demand). The two mix freely: all steps (a recipe), all reference (a review's rules, this skill), or both. The core decision is where each piece sits on the **information hierarchy**, a ladder ranked by how immediately the agent needs the material:

1. **In-file step** is the primary tier: what the agent does, in order.
2. **In-file reference** is consulted on demand. Often a legitimately flat peer-set (every rule of a review on one rung), which is a fine arrangement, not a smell.
3. **Disclosed reference** is pushed out into a separate file, reached by a context pointer, loaded only when the pointer fires. Spans a sibling file in the same folder through fully external reference that lives anywhere and any document can point at.

Push too little down and the top bloats; push too much and you hide material the agent actually needs. That tension is the whole decision.

**Progressive disclosure** is the move down the ladder (out of the main file and behind a pointer) so the top stays legible. Not primarily a token optimisation: it is how the hierarchy is protected. Branching is the cleanest disclosure test: inline what every branch needs, and push behind a pointer what only some branches reach. When a document has steps, in-file reference that should be disclosed buries them and turns attending to them into a coin-flip: a variance lever, not just a legibility one.

…（略）…

L41: **Co-location** is the within-file companion: where the ladder decides _how far down_ a piece sits, co-location decides _what sits beside it_ once there. Keep a concept's definition, rules, and caveats under one heading rather than scattered, so reading one part brings its neighbours with it. The test: the document should read like documentation written for the agent. Grouped material reads that way; scattered material does not. (Distinct from duplication: that repeats one meaning in two places; scattering fragments one meaning across many.)

…（略）…

[L47-52]
Every step ends on a **completion criterion**, the condition that tells the agent the work is done. Two properties make it a lever:

- **Clarity**: can the agent tell done from not-done? A vague bound ("understanding reached") invites **premature completion**: ending the step before it is genuinely done, attention slipping to _being done_. The visible steps still ahead (the **post-completion steps**) supply the pull; the criterion's clarity is the resistance. Defend in order: **sharpen the bound first** (local and cheap); only if it is irreducibly fuzzy _and_ you observe the rush, hide the later steps by splitting the sequence. Hiding only works across a real context boundary (a hand-off or a subagent dispatch; an inline call leaves the later steps in context and clears nothing).
- **Demand**: how much it requires. "Every modified model accounted for" forces thorough work where "produce a change list" does not. Demand drives **legwork** (the digging the agent does within the work, latent in the wording rather than written as its own step), and it is not step-bound: "every rule applied" binds a body of flat reference just as "every step done" binds a sequence, which is how an all-reference document still carries an exhaustiveness bar.

The strongest criteria are both checkable and exhaustive.

…（略）…

[L63-72]
A **leading word** is a compact concept already living in the model's pretraining that the agent thinks with while running the document (_lesson_, _fog of war_, _tracer bullets_). Repeated as a token, never as a sentence, it accumulates a distributed definition and anchors a whole region of behaviour in the fewest tokens, by recruiting priors the model already holds. Coining your own works if you define it clearly, but a made-up word recruits no priors: you pay in definition tokens what a pretrained word gives free; reach for an existing word first.

It anchors twice. In the body, _execution_: the agent reaches for the same behaviour every time the word appears, and inside flat reference it focuses attention on a class of thing to look for. In a pointer, _invocation_: when the same word lives in your prompts, your docs, and your codebase, the agent links that shared language to the material and reaches it more reliably.

Hunt for opportunities to refactor with leading words. A triad spelled out at three sites, a pointer spending a sentence to gesture at one idea. Each is a passage begging to collapse into a single token:

- "fast, deterministic, low-overhead" → _tight_ (a _tight_ loop).
- "a loop you believe in" → _red_, turning a fuzzy gate into a binary observable state (the loop goes _red_ on the bug, or it doesn't).

You win twice: fewer tokens, and a sharper hook for the agent to hang its thinking on. Assume every document is carrying restatements that leading words retire. Go find them.

…（略）…

[L78-81]
- Keep each meaning in a **single source of truth**: one authoritative place, so changing the behaviour is a one-place edit. **Duplication** (the same meaning in more than one place) costs maintenance and tokens, and inflates a meaning's prominence on the ladder past its real rank. (The accidental inverse of a leading word, which repeats a token on purpose, never the meaning.)
- The **environment** is a source of truth too (`package.json` scripts, config files, the directory layout, `--help` output), and a document that restates it is a **cache**: a copy of a lookup, earning its load only when the lookup is expensive. Cache what the agent cannot find by looking: the unwritten convention, the reason behind a choice, the gotcha no config confesses. Leave the one-file, one-command lookups to the environment, where they cannot go stale.
- Check every line for **relevance**: does it still bear on what the document does? A line loses relevance by never bearing on the task (mere exposition, or a branch that should be disclosed) or by going stale as the behaviour or world it describes changes. Shorter documents are easier to keep relevant. Without a pruning discipline the default fate is **sediment**: stale layers that settle because adding feels safe and removing feels risky, until you must core down through them to find what is still live.
- Hunt **no-ops** sentence by sentence: an instruction the model already obeys by default pays load to say nothing. The test (does it change behaviour versus the default?) is model-relative, not reader-relative: two people disagreeing about a no-op disagree about the default, and settle it by running the document, not by debate. When a sentence fails, delete the whole sentence rather than trim words from it. The test also grades leading words: a word too weak to beat the default (_be thorough_ when the agent is already thorough-ish) is a no-op, and the fix is a stronger word (_relentless_), not a different technique.
```

## M02 反模式否定式表述整改

- **来源**：`skills/productivity/writing-for-agents/SKILL.md`
- **行号范围**：74
- **源文件 SHA-256**：1c0c4ebf2d221917591144f0ced4fe46dae13301cb3d6d93fc88ecf0dda6aed2
- **采纳要点**：反模式否定式表述整改：整句否定会把被禁行为拖入上下文并提高其可用性；应写正面目标，禁止只在无法正面表述的硬护栏保留且必须配正面目标

```text
L74: **Negation** is the failure mode beside this lever: steering by prohibition drags the forbidden behaviour into context and makes it _more_ available, not less. _Don't think of an elephant_, and the elephant is all there is; the negation is a weak modifier the strongly-activated concept overruns, so the ban half-reads as an instruction to do the thing. Prompt the **positive**: state the target behaviour ("write one-line comments") so the banned one is never spoken. A prohibition earns its place only as a hard guardrail you cannot phrase positively; even then, pair it with the positive target so attention lands on what to do.
```

## M03 测试质量反模式

- **来源**：`skills/engineering/tdd/tests.md`
- **行号范围**：38-45；63-77
- **源文件 SHA-256**：0b401f98bd3684d2fea6440d6946afcf8f5f68ac6a65599dd7a2b90dd9f02eb5
- **来源**：`skills/engineering/tdd/mocking.md`
- **行号范围**：3-13
- **源文件 SHA-256**：73a10b6a26b56197c738a764c1e4205af98c74553f4a713795997f6bc35b917d
- **来源**：`skills/engineering/tdd/SKILL.md`
- **行号范围**：32
- **源文件 SHA-256**：193b791c489d1640ccfb58d7cbd60fc9e059ef44632b3c92f208784cfe45ab78
- **采纳要点**：测试质量反模式：tautological（期望值按代码同法重算，"passes by construction and can never disagree with the code"；期望值须来自独立事实源）、implementation-coupled（识别信号="重构但行为未变时测试碎掉"）、mock 只在系统边界、垂直切片禁 horizontal slicing

````text
【tests.md L38-45】
Red flags:

- Mocking internal collaborators
- Testing private methods
- Asserting on call counts/order
- Test breaks when refactoring without behavior change
- Test name describes HOW not WHAT
- Verifying through external means instead of interface

…（略）…

【tests.md L63-77】
**Tautological tests**: Expected value restates the implementation, so the test passes by construction.

```typescript
// BAD: Expected value is recomputed the way the code computes it
test("calculateTotal sums line items", () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// GOOD: Expected value is an independent, known literal
test("calculateTotal sums line items", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```

…（略）…

【mocking.md L3-13】
Mock at **system boundaries** only:

- External APIs (payment, email, etc.)
- Databases (sometimes - prefer test DB)
- Time/randomness
- File system (sometimes)

Don't mock:

- Your own classes/modules
- Internal collaborators
- Anything you control

…（略）…

【SKILL.md L32】
- **Horizontal slicing**: writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.
````

## M04 CHECKPOINT 提问与呈现规范

- **来源**：`skills/productivity/to-questionnaire/SKILL.md`
- **行号范围**：9；12-16；36；40；42-48
- **源文件 SHA-256**：77825120815c21400f82e2794faf342d1d1a4ab1493be3fe061857885d26b768
- **来源**：`skills/productivity/grilling/SKILL.md`
- **行号范围**：6；8；12-22；26；28
- **源文件 SHA-256**：d806733216b16e51adad834e724bfec5540a436d06395bfc75b843cda9f7404b
- **来源**：`skills/in-progress/loop-me/SKILL.md`
- **行号范围**：22-23
- **源文件 SHA-256**：38ac316635d244abfdc1526edec49596f9284b36595f5a212fc5983894b6094a
- **采纳要点**：CHECKPOINT 提问与呈现规范：grill-the-send（只问用户能答的，可查事实归 agent）、每题一想法绝不复合 + 答案 stub + 按需一行 _Why this matters_、明确鼓励 "I don't know"、每步自带 Done 判据；frontier（前提已解的问题集）+ 每题必给推荐答案 + 一轮一 frontier + 找事实派子代理且不阻塞；Push right + Brief（what/why/link 三段式，绝不抛原始输出）
> 注：台账记 `to-questionnaire/SKILL.md:20-54`（整节 Document structure 含模板）；此处只 vendor 支撑采纳要点的最小行段（20 段外的 36/40 与示例 42-48 为机制承重行，其余 L21-35/L49-54 为模板版式与收尾问句，未 vendor）。

````text
【to-questionnaire/SKILL.md L9】
**Grill the send, not the subject.** Interview the user only about the _send_, which they can always answer: who it goes to, and what they need back. The questions in the document then target the **gap** between what the recipient knows and what the user needs.

…（略）…

【to-questionnaire/SKILL.md L12-16】
1. **Who is it going to?** Ask, in one exchange, the recipient's role, expertise, and relationship to the user. This fixes the questionnaire's tone and how much context it must carry. Done when you know who the recipient is and what they know that the user doesn't.

2. **What do you need back?** Ask, in one exchange, the specific decisions or facts the user can't resolve alone and needs from this person. Done when you have a concrete list of what the user must walk away able to do or decide.

3. **Write the questionnaire.** Draft questions aimed at the gap from steps 1–2, following the Document structure below. Write it to `to-questionnaire-<slug>.md` in the current directory (slug from the topic) and report the path. Done when the file exists and every item the user named in step 2 is covered by a question.

…（略）…

【to-questionnaire/SKILL.md L36】
Deadline and rough effort. Partial answers and "I don't know" are useful: flag anything you're unsure of rather than skipping it.

…（略）…

【to-questionnaire/SKILL.md L40】
One `##` section per theme. Under each, its questions, most-important-first. Every question is one idea, never compound, with an answer stub directly beneath, and a one-line _why this matters_ only where the question could be misread or invite a throwaway answer.

…（略）…

【to-questionnaire/SKILL.md L42-48】
<question-example>
### What load is the system expected to handle at launch?

_Why this matters: it decides whether we provision for burst traffic now or defer it._

>
</question-example>

…（略）…

【grilling/SKILL.md L6】
Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

…（略）…

【grilling/SKILL.md L8】
Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

…（略）…

【grilling/SKILL.md L12-22】
```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

…（略）…

【grilling/SKILL.md L26】
Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

…（略）…

【grilling/SKILL.md L28】
The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.

…（略）…

【loop-me/SKILL.md L22-23】
- **Push right**: defer the checkpoint as far as it will go. Do maximal work before involving the human, so they are asked once, late, with everything prepared.
- **Brief**: what a checkpoint presents, a tight, decision-ready summary (what was produced, why, and a link down to the asset itself), never the raw output. The user reads a brief, not a draft. Speed of review is imperative.
````

## M05 R 入场门

- **来源**：`skills/engineering/diagnosing-bugs/SKILL.md`
- **行号范围**：53-66；88-96
- **源文件 SHA-256**：bca66b7141da7d225b7dfd1abf6f2bee657b8044d3897604055e760749c71724
- **采纳要点**：R 入场门：红信号四项验收（已真实跑过 / red-capable 断言用户确切症状 / deterministic / fast / agent-runnable）+ 反锚定"红得起之前禁进假设"+ 3–5 条排序可证伪假设 + 预测格式（"若 X 是因，则改 Y 让 bug 消失/改 Z 更糟"）+ 造不出须停下并向用户要三选一并置 blocked

```text
[L53-66]
### When you genuinely cannot build a loop

Stop and say so explicitly. List what you tried. Ask the user for: (a) access to whatever environment reproduces it, (b) a redacted captured artifact (HAR file, log dump, core dump, screen recording with timestamps), or (c) permission to add temporary production instrumentation. Do **not** proceed to hypothesise without a loop.

### Completion criterion: a tight loop that goes red

Phase 1 is done when the loop is **tight** and **red-capable**: you can name **one command** (a script path, a test invocation, a curl) that you have **already run at least once** (show the invocation and its output, redacted), and that is:

- [ ] **Red-capable**: it drives the actual bug code path and asserts the **user's exact symptom**, so it can go red on this bug and green once fixed. Not "runs without erroring"; it must be able to _catch this specific bug_.
- [ ] **Deterministic**: same verdict every run (flaky bugs: a pinned, high reproduction rate, per above).
- [ ] **Fast**: seconds, not minutes.
- [ ] **Agent-runnable**: you can run it unattended; a human in the loop only via `scripts/hitl-loop.template.sh`.

If you catch yourself reading code to build a theory before this command exists, **stop: jumping straight to a hypothesis is the exact failure this skill prevents.** No red-capable command, no Phase 2.

…（略）…

[L88-96]
## Phase 3: Hypothesise

Generate **3–5 ranked hypotheses** before testing any of them. Single-hypothesis generation anchors on the first plausible idea.

Each hypothesis must be **falsifiable**: state the prediction it makes.

> Format: "If <X> is the cause, then <changing Y> will make the bug disappear / <changing Z> will make it worse."

If you cannot state the prediction, the hypothesis is a vibe: discard or sharpen it.
```

## M06 "证明规则会咬人"负向 fixture 协议

- **来源**：`skills/in-progress/setup-ts-deep-modules/SKILL.md`
- **行号范围**：79-87
- **源文件 SHA-256**：3709fc7d62ea75cd7da1d6f21e33d58d758766fb8f5247a859687d7ed63c213e
- **采纳要点**："证明规则会咬人"负向 fixture 协议：干净态通过 → 故意注入违规 → 必须失败 → 回滚 → 再通过；若不失败说明规则未接通必须修完

```text
[L79-87]
### 6. Prove the rules bite

This is the completion criterion for the whole skill: a config that doesn't fail on a violation is worthless.

1. Run `lint:boundaries`. It must **pass** on the clean example.
2. Temporarily add a deep import to `tests/example.test.ts` (e.g. `import { thing } from "../lib/impl"`). Run `lint:boundaries` again; it must **fail** with `tests-through-entrypoints`.
3. Revert the deep import. Run once more, and it must **pass**.

**Done when:** you have observed a pass, then a fail on the deep import, then a pass again. If step 2 does not fail, the rules are not wired correctly, so fix before finishing.
```

## M07 RED 证据可验证化

- **证据性质**：负面（源中不存在该规则）
- **来源**：`skills/engineering/tdd/SKILL.md`（最接近的对照原文）
- **行号范围**：36
- **源文件 SHA-256**：193b791c489d1640ccfb58d7cbd60fc9e059ef44632b3c92f208784cfe45ab78
- **核对范围**：`skills/engineering/tdd/SKILL.md` L1-38（全文 38 行）与 `skills/engineering/tdd/tests.md` L1-77（全文 77 行）；两文件均**未**要求“运行测试并观察其失败”，也无“曾观测到失败”的证据产物要求。最接近的对照原文是 SKILL.md L36 的 “Red before green”，它只规定写作顺序，不要求任何已执行的 RED 证据。
- **采纳要点**：RED 证据可验证化：要求"曾观测到失败"的证据，把不可验证的 RED 变成可验证

```text
【tdd/SKILL.md L34-38】（规则全段，用于对照“不存在运行并观察失败的要求”）
## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
```

## M08 `.out-of-scope/` 式拒绝知识库

- **来源**：`skills/engineering/triage/OUT-OF-SCOPE.md`
- **行号范围**：3-6；17；23-54；70-82；84-88；99-106
- **源文件 SHA-256**：a48a2c63f0520eaa08cd68705030a77428e7ba6647834c7a644ad9cda396e4ae
- **采纳要点**：`.out-of-scope/` 式拒绝知识库：概念粒度（非 issue 粒度）+ 入口处先读全量并按概念相似度去重 + `Prior requests` 回链 + 仅 rejected enhancement 写入 + 改主意则删除

````text
[L3-6]
The `.out-of-scope/` directory in a repo stores persistent records of rejected feature requests. It serves two purposes:

1. **Institutional memory**: why a feature was rejected, so the reasoning isn't lost when the issue is closed
2. **Deduplication**: when a new issue comes in that matches a prior rejection, the skill can surface the previous decision instead of re-litigating it

…（略）…

L17: One file per **concept**, not per issue. Multiple issues requesting the same thing are grouped under one file.

…（略）…

[L23-54]
```markdown
# Dark Mode

This project does not support dark mode or user-facing theming.

## Why this is out of scope

The rendering pipeline assumes a single color palette defined in
`ThemeConfig`. Supporting multiple themes would require:

- A theme context provider wrapping the entire component tree
- Per-component theme-aware style resolution
- A persistence layer for user theme preferences

This is a significant architectural change that doesn't align with the
project's focus on content authoring. Theming is a concern for downstream
consumers who embed or redistribute the output.

```ts
// The current ThemeConfig interface is not designed for runtime switching:
interface ThemeConfig {
  colors: ColorPalette; // single palette, resolved at build time
  fonts: FontStack;
}
```

## Prior requests

- #42: "Add dark mode support"
- #87: "Night theme for accessibility"
- #134: "Dark theme option"
```

…（略）…

[L70-82]
## When to check `.out-of-scope/`

During triage (Step 1: Gather context), read all files in `.out-of-scope/`. When evaluating a new issue:

- Check if the request matches an existing out-of-scope concept
- Matching is by concept similarity, not keyword: "night theme" matches `dark-mode.md`
- If there's a match, surface it to the maintainer: "This is similar to `.out-of-scope/dark-mode.md`. We rejected this before because [reason]. Do you still feel the same way?"

The maintainer may:

- **Confirm**: the new issue gets added to the existing file's "Prior requests" list, then closed
- **Reconsider**: the out-of-scope file gets deleted or updated, and the issue proceeds through normal triage
- **Disagree**: the issues are related but distinct, proceed with normal triage

…（略）…

[L84-88]
## When to write to `.out-of-scope/`

Only when an **enhancement** (not a bug) is *rejected* as `wontfix`. This applies to enhancement PRs exactly as it does to issues: a rejected PR is recorded here so the same request doesn't return as fresh code.

Do **not** write here when something is closed as `wontfix` because it's **already implemented**. That's a built feature, not a rejected one; recording it would poison the dedup checks with false rejections. Instead, the closing comment points to where the feature already lives.

…（略）…

[L99-106]
## Updating or removing out-of-scope files

If the maintainer changes their mind about a previously rejected concept:

- Delete the `.out-of-scope/` file
- The skill does not need to reopen old issues; they're historical records
- The new issue that triggered the reconsideration proceeds through normal triage
````

## M09 设计压力与 seam 负向判据

- **来源**：`skills/engineering/codebase-design/DEEPENING.md`
- **行号范围**：5-26；29；34
- **源文件 SHA-256**：a67260cb384580b60430486edeb47a6e656ea5f8a42b7196b24461459031f00c
- **来源**：`skills/engineering/codebase-design/SKILL.md`
- **行号范围**：63；65
- **源文件 SHA-256**：362b0bec828219d9f4b08ca7c466164e67253bdd817359258e60d2e9c5692a8f
- **来源**：`skills/engineering/codebase-design/DESIGN-IT-TWICE.md`
- **行号范围**：19-44
- **源文件 SHA-256**：4c3b083988c0b34449dfef3f4fcee963e3d7fc614c71beacfaa51023f1b24d78
- **采纳要点**：设计压力与 seam 负向判据：两 adapter 才成真 seam（一 adapter 只是假想 seam；无变化处不得引入 port）+ 依赖四分类→测试策略 + deletion test（"删掉是收敛复杂度还是搬家"）+ DESIGN-IT-TWICE（3+ 子代理各带不同设计约束：最小接口 / 最大灵活 / 优化最常见调用者 / ports&adapters，各出 5 项固定产物，最后给有主见的推荐）

```text
【DEEPENING.md L5-26】
## Dependency categories

When assessing a candidate for deepening, classify its dependencies. The category determines how the deepened module is tested across its seam.

### 1. In-process

Pure computation, in-memory state, no I/O. Always deepenable: merge the modules and test through the new interface directly. No adapter needed.

### 2. Local-substitutable

Dependencies that have local test stand-ins (PGLite for Postgres, in-memory filesystem). Deepenable if the stand-in exists. The deepened module is tested with the stand-in running in the test suite. The seam is internal; no port at the module's external interface.

### 3. Remote but owned (Ports & Adapters)

Your own services across a network boundary (microservices, internal APIs). Define a **port** (interface) at the seam. The deep module owns the logic; the transport is injected as an **adapter**. Tests use an in-memory adapter. Production uses an HTTP/gRPC/queue adapter.

Recommendation shape: *"Define a port at the seam, implement an HTTP adapter for production and an in-memory adapter for testing, so the logic sits in one deep module even though it's deployed across a network."*

### 4. True external (Mock)

Third-party services (Stripe, Twilio, etc.) you don't control. The deepened module takes the external dependency as an injected port; tests provide a mock adapter.

…（略）…

【DEEPENING.md L28-30】
## Seam discipline

- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a port unless at least two adapters are justified (typically production + test). A single-adapter seam is just indirection.
- **Internal seams vs external seams.** A deep module can have internal seams (private to its implementation, used by its own tests) as well as the external seam at its interface. Don't expose internal seams through the interface just because tests use them.

…（略）…

【DEEPENING.md L32-34】
## Testing strategy: replace, don't layer

- Old unit tests on shallow modules become waste once tests at the deepened module's interface exist; delete them.

…（略）…

【SKILL.md L63】
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.

…（略）…

【SKILL.md L65】
- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a seam unless something actually varies across it.

…（略）…

【DESIGN-IT-TWICE.md L19-44】
### 2. Spawn sub-agents

Spawn 3+ sub-agents in parallel. Each must produce a **radically different** interface for the deepened module.

Prompt each sub-agent with a separate technical brief (file paths, coupling details, dependency category from [DEEPENING.md](DEEPENING.md), what sits behind the seam). The brief is independent of the user-facing problem-space explanation in Step 1. Give each agent a different design constraint:

- Agent 1: "Minimize the interface: aim for 1–3 entry points max. Maximise leverage per entry point."
- Agent 2: "Maximise flexibility: support many use cases and extension."
- Agent 3: "Optimise for the most common caller: make the default case trivial."
- Agent 4 (if applicable): "Design around ports & adapters for cross-seam dependencies."

Include both [SKILL.md](SKILL.md) vocabulary and CONTEXT.md vocabulary in the brief so each sub-agent names things consistently with the architecture language and the project's domain language.

Each sub-agent outputs:

1. Interface (types, methods, params, plus invariants, ordering, error modes)
2. Usage example showing how callers use it
3. What the implementation hides behind the seam
4. Dependency strategy and adapters (see [DEEPENING.md](DEEPENING.md))
5. Trade-offs: where leverage is high, where it's thin

### 3. Present and compare

Present designs sequentially so the user can absorb each one, then compare them in prose. Contrast by **depth** (leverage at the interface), **locality** (where change concentrates), and **seam placement**.

After comparing, give your own recommendation: which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated: the user wants a strong read, not a menu.
```

## M10 ADR 入选三问门槛

- **来源**：`skills/engineering/domain-modeling/ADR-FORMAT.md`
- **行号范围**：31-37（摘录含节标题 L29，故块内标注为 29-37）
- **源文件 SHA-256**：b7021c31a1c2485b07356a8110fd1fd1ae4facbab3e210983789f425f867d95b
- **采纳要点**：ADR 入选三问门槛：难逆 / 无上下文会困惑 / 真取舍（全真才立档）

```text
[L29-37]
## When to offer an ADR

All three of these must be true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

If a decision is easy to reverse, skip it: you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing."
```

## M11 expand-contract 兜底

- **来源**：`skills/engineering/to-tickets/SKILL.md`
- **行号范围**：40
- **源文件 SHA-256**：8082bc6ef165027c5df3215763055f4a9668878bf27f25f582db78a14c3ed3c1
- **采纳要点**：expand-contract 兜底：migrate 批次自身无法保持 CI 绿时，共享 integration 分支并由一张 integrate-and-verify 票据统一承诺绿

```text
L40: **Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change (rename a column, retype a shared symbol) whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own ticket blocked by the expand, keeping CI green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch. When even the batches can't stay green alone, keep the sequence but let them share an integration branch that all block a final integrate-and-verify ticket; green is promised only there.
```

## M12 pre-commit 快层

- **来源**：`skills/misc/setup-pre-commit/SKILL.md`
- **行号范围**：37-45；47；81-85；91
- **源文件 SHA-256**：e069e6a23069ebdba946d4dea11e5d663c10640c6b14b55c4585c81b1a256ac9
- **采纳要点**：pre-commit 快层：staged-only（prettier --ignore-unknown + 增量 tsc）留在提交前，全量 suite 留 pre-push；缺脚本即降级告知；装完立即提交一次作 smoke test
> 注：台账记 L37-45/47/81-85/91，实测行号一致。但**内容与台账表述有出入**：源文 L42-44 的 `.husky/pre-commit` 同时含 `npx lint-staged`、`npm run typecheck`、`npm run test`，L91 亦自述 "The pre-commit runs lint-staged first (fast, staged-only), then full typecheck and tests" —— 即“全量 typecheck+test”在源文中**留在 pre-commit 内**，并未留到 pre-push。台账“全量 suite 留 pre-push / 增量 tsc”属 W-model 改造后的落位，不是源文原话；本摘录只固化源文。

````text
[L37-45]
### 4. Create `.husky/pre-commit`

Write this file (no shebang needed for Husky v9+):

```
npx lint-staged
npm run typecheck
npm run test
```

…（略）…

L47: **Adapt**: Replace `npm` with detected package manager. If repo has no `typecheck` or `test` script in package.json, omit those lines and tell the user.

…（略）…

[L81-85]
### 8. Commit

Stage all changed/created files and commit with message: `Add pre-commit hooks (husky + lint-staged + prettier)`

This will run through the new pre-commit hooks: a good smoke test that everything works.

…（略）…

L91: - The pre-commit runs lint-staged first (fast, staged-only), then full typecheck and tests
````

## M13 事件接驳前置核实

- **来源**：`skills/engineering/triage/SKILL.md`
- **行号范围**：74
- **源文件 SHA-256**：652c815971c2df925cee0f250ae2596f50fde19328305f3c55afd157a7f06fe6
- **采纳要点**：事件接驳前置核实："先核实主张再受理"——按 reporter 步骤复现、检出 PR 跑相关测试后再分类

```text
L74: 3. **Verify the claim.** Before any grilling, check that the claim holds up. For a bug, reproduce it from the reporter's steps. For a PR, confirm the diff does what it claims: check it out, run the relevant tests or commands. Report what happened: confirmed (with code path), failed, or insufficient detail (a strong `needs-info` signal). A confirmed verification makes a much stronger agent brief.
```

## M14 Loop 4 输入：retro 七类改进源 + no-op 审计

- **来源**：`skills/in-progress/retro/SKILL.md`
- **行号范围**：17-23；31-35；41
- **源文件 SHA-256**：27213192896e3efa8f0a5dd316bfcfd072e7ae794658523cf1bfe0908b819f1c
- **采纳要点**：Loop 4 输入：retro 七类改进源 + no-op 审计（找 steering 文件里不改变 agent 行为的指令）+ "实现压力大、评审压力小，故标准归评审者" → 风格/标准类规则应进 V 的 persona 与 verifier-spec.md 检查项而非 S 的 prompt（上游标 STUB，须标注"思想来源，非已验收实践"）

```text
[L17-23]
- **Navigation**: how easy was it for the agent to find the right files? Are there hidden dependencies between files? Would a **navigation pointer** make it easier? _Use when_ the session took a long time to find a piece of information.
- **Automated checks**: are there automated checks that could catch errors the agent made? Linting, typing, tests, filesystem linters? _Use when_ the agent made a mistake that could have been caught by an automated check.
- **Coding standards**: should the **reviewer agent** be given a new rule to enforce? Should an existing rule be removed or clarified? _Use when_ the reviewer agent failed to catch a mistake.
- **Global AGENTS.md**: are there any steering instructions that should be moved to coding standards (or automated checks) instead? _Use when_ the AGENTS.md file is particularly large - in the repo OR the user's global scope.
- **Tool economy**: did the agent make expensive tool calls that could be streamlined? Is there any custom tooling (CLI's, MCP's) that is particularly token-inefficient? _Use when_ the agent made an expensive tool call.
- **No-ops**: look for instructions in steering files that don't modify the agent's behavior. _Use when_ the steering files are large and unwieldy.
- **Information access**: look for opportunities to increase the agent's access to information. Teeing dev server logs, readonly access to third-party services. _Use when_ a crucial piece of information was not available to the agent.

…（略）…

[L29-35]
### Implementation vs Review

Remember that all work goes through two stages: implementation and review. The implementation agent has the most **context pressure**. They are responsible for exploration, writing code, and debugging failures.

The review agent has the least context pressure - it receives a diff, so no exploration needed. It often does not need to write code or debug.

This means that the review agent should be responsible for imposing coding standards, not the implementation agent.

…（略）…

L41: - `CLAUDE.md`/`AGENTS.md`: these files are pushed to the context window of any agent working in this repo. They should be used incredibly sparingly, usually only for **navigation pointers** to other files.
```

## M15 调用分类与跨阶段交接写法

- **来源**：`.agents/invocation.md`
- **行号范围**：3；5-6；16；20；22
- **源文件 SHA-256**：f2d39f262e4c641d1e73435f68b1f459a23d1386aa366c533ef925a07a343cf8
- **采纳要点**：调用分类与跨阶段交接写法：invocation 分类（人类入口 vs 模型可达）+ 依赖写成显式动作句、禁深链/裸命令

```text
L3: Every `SKILL.md` in this repo is a skill. The one axis that splits them is **invocation**, who can reach it:

…（略）…

[L5-6]
- **User-invoked**: reachable **only by the human typing its name**. Set `disable-model-invocation: true` in the frontmatter (Claude Code) and `policy.allow_implicit_invocation: false` in `agents/openai.yaml` (Codex). The `description` is **human-facing**: a one-line summary read by a person browsing slash-commands. Strip trigger lists ("Use when the user says…").
- **Model-invoked**: reachable by **model or user**. The default: omit `disable-model-invocation` and the `policy` block from `agents/openai.yaml`. The `description` is **model-facing** and keeps rich trigger phrasing ("Use when the user wants…, mentions…, asks for…") so auto-invocation fires. The test for whether a skill should stay model-invoked: _could the model usefully reach for this autonomously?_ (Reuse is the reason to extract a skill, not the test.)

…（略）…

L16: Dependencies are expressed as an explicit instruction to **call the Skill tool** with the named skill (`Call the Skill tool with "grilling"`), not deep `../other-skill/FILE.md` cross-references, and not a bare `/skill`-style mention left for the model to interpret. Naming the tool is what gets it fired: most harnesses expose skill invocation as a tool the model calls, and spelling that out gets a higher hit rate than dropping a `/name` into prose and hoping it's read as a command. Dropping the leading `/` also keeps this harness-neutral rather than less: a skill name on its own carries no assumption about which harness's trigger syntax it belongs to. Shared reference docs live inside the skill that owns them; other skills reach that material by calling the Skill tool with it, not by linking across folders.

…（略）…

L20: The Skill tool takes one skill per call. A step that needs two skills is two calls, not one call with two names: say so (`Call the Skill tool twice, for "grilling" and "domain-modeling"`), not "call it with X and Y," which reads as a single call taking both.

…（略）…

L22: This whole convention only holds when the named skill is **model-invoked**. A user-invoked skill can never be reached this way, full stop: per the invariant above, no other skill can call it, including by naming it to the Skill tool. When a step's precondition is a user-invoked skill (e.g. `setup-matt-pocock-skills`), phrase it as an instruction for the human to act on: "tell the user to run `/setup-matt-pocock-skills`", never as a Skill tool call.
```

## M16 单一权威文案纪律

- **来源**：`.agents/install-block.md`
- **行号范围**：3；39；53；55-57
- **源文件 SHA-256**：f1ae420ee648a4c62b86e75245a91188573f1f3a73e9ff8aabf844187863d281
- **采纳要点**：单一权威文案纪律：会被多处复述的文案（安装/快速开始）建立单一权威块，明令消费者不得复制、改为指向（曾整体过期，处理方式是删除而非修正）

```text
L3: One install story, one wording. `README.md`, `.changeset/*`, and every page under `docs/` must say **this** and nothing else. Change it here first, then propagate.

…（略）…

L39: …and the single-skill form wherever one skill is named on its own. Note that **`docs/` pages are not a consumer of this block**: ai-hero renders the install widget above the body, so a page that writes the commands out duplicates it. See [writing-docs.md](./writing-docs.md).

…（略）…

L53: `skills@latest` is the pinned spelling in all three. The pages under `docs/` used to carry their own copy of these commands; those blocks are now deleted rather than corrected, because the site renders the install commands itself.

…（略）…

[L55-57]
## The two routes are exclusive

The plugin is a managed, read-only bundle you subscribe to. skills.sh writes files you own and edit. Installing both leaves the user with every skill twice: always say "pick one".
```

## M17 S 的 loop 构造方法清单

- **来源**：`skills/engineering/diagnosing-bugs/SKILL.md`
- **行号范围**：24-35；49-51
- **源文件 SHA-256**：bca66b7141da7d225b7dfd1abf6f2bee657b8044d3897604055e760749c71724
- **采纳要点**：S 的 loop 构造方法清单（10 种按序：failing test → curl → CLI fixture diff → headless browser → replay trace → throwaway harness → property/fuzz → git bisect run → differential → HITL 兜底）+ 非确定性 bug 目标是提高复现率而非干净复现

```text
[L24-35]
### Ways to construct one, in roughly this order

1. **Failing test** at whatever seam reaches the bug: unit, integration, e2e.
2. **Curl / HTTP script** against a running dev server.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot.
4. **Headless browser script** (Playwright / Puppeteer) that drives the UI and asserts on DOM/console/network.
5. **Replay a captured trace.** Save a real network request / payload / event log to disk; replay it through the code path in isolation.
6. **Throwaway harness.** Spin up a minimal subset of the system (one service, mocked deps) that exercises the bug code path with a single function call.
7. **Property / fuzz loop.** If the bug is "sometimes wrong output", run 1000 random inputs and look for the failure mode.
8. **Bisection harness.** If the bug appeared between two known states (commit, dataset, version), automate "boot at state X, check, repeat" so you can `git bisect run` it.
9. **Differential loop.** Run the same input through old-version vs new-version (or two configs) and diff outputs.
10. **HITL bash script.** Last resort. If a human must click, drive _them_ with `scripts/hitl-loop.template.sh` so the loop is still structured. Captured output feeds back to you.

…（略）…

[L49-51]
### Non-deterministic bugs

The goal is not a clean repro but a **higher reproduction rate**. Loop the trigger 100×, parallelise, add stress, narrow timing windows, inject sleeps. A 50%-flake bug is debuggable; 1% is not, so keep raising the rate until it's debuggable.
```

## M18 受控低仪式探索通道

- **来源**：`skills/engineering/prototype/SKILL.md`
- **行号范围**：23；26
- **源文件 SHA-256**：f74ae01f4fc454d3a4ef21271920f1706e626271e715dda0559e489f45c792c3
- **来源**：`skills/engineering/prototype/LOGIC.md`
- **行号范围**：20
- **源文件 SHA-256**：8d7e31de7ce73b8e62f207e3f3ecbd90a7a54fdc728f8965f5f0739976f9959a
- **采纳要点**：受控低仪式探索通道：question-first（写代码前把问题写在可见处）+ 捕获纪律（有效决策折回真实代码；原型本体作一手来源保留；main 只留已验证决策）+ 默认零持久化

```text
【prototype/SKILL.md L23】
3. **No persistence by default.** State lives in memory. Persistence is the thing the prototype is _checking_, not something it should depend on. If the question explicitly involves a database, hit a scratch DB or a local file with a clear "PROTOTYPE, wipe me" name.

…（略）…

【prototype/SKILL.md L26】
6. **Capture it when done.** Fold any validated decision into the real code, then capture the prototype itself as a **primary source**: commit it to a throwaway branch, out of main, and leave a context pointer to that branch on the implementation issue. Capture the answer too (the verdict and the question it settled) in the issue or a commit. The main branch keeps only the validated decision.

…（略）…

【prototype/LOGIC.md L20】
Before writing code, write down what state model and what question you're prototyping. One paragraph, at the top of the demo (in a visible intro, not just a comment). A logic prototype that answers the wrong question is pure waste, so make the question explicit so it can be checked later, whether the user is watching now or returning to it AFK.
```
