# 43.0.1 热修：autocrlf×R19 环境侧修复 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 用 `.gitattributes` 强制全仓 LF 落盘并 renormalize，消除「新 clone（autocrlf=true）首次 self-test 假红」，发版 43.0.1 并合入 main。

**架构：** 纯环境修复——单文件 `.gitattributes` + 一次 renormalize 提交 + 升版。不改任何代码（机制侧归一化哈希归批次 7）。合并期已设仓库级 `core.autocrlf=false`；`.gitattributes` 使该行为对任何 clone 永久成立（attributes 优先于 config）。

**技术栈：** git attributes / renormalize；验证链 = self-test 403/403 + fresh-clone 实证 + prepush。

**规格：** `docs/superpowers/specs/2026-10-07-remediation-leftovers-design.md` §1。

---

### 任务 1：CRLF 存量盘点（熔断判定）

**文件：** 无修改（只盘点）。

- [ ] **步骤 1：盘点 eol 状态**

```bash
cd "D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" && git ls-files --eol | awk '{print $1, $2}' | sort | uniq -c | sort -rn
```
记录四类计数：`i/lf w/lf`（仓 LF 盘 LF）、`i/lf w/crlf`（仓 LF 盘 CRLF——renormalize 会改写这些的落盘形态，commit 无 diff）、`i/crlf`（仓内 blob 本身 CRLF——renormalize 会产生真实 diff）、`binary`。

- [ ] **步骤 2：熔断判定**

判定规则：`i/crlf` 文件数 > 20 或包含 >10 个源码文件 → **停下**，把清单报告给用户（renormalize 将产生大 diff）再继续；否则（预期：`i/crlf` ≈ 0 或仅个别）直接进任务 2。把盘点结果全文记入报告文件。

---

### 任务 2：.gitattributes + renormalize

**文件：**
- 创建：`.gitattributes`
- 修改：renormalize 触达的落盘形态文件（通常无内容 diff，仅行尾归一）

- [ ] **步骤 1：创建 .gitattributes**

```
* text=auto eol=lf
*.jar binary
*.png binary
*.jpg binary
*.ico binary
```

- [ ] **步骤 2：renormalize 并核对 diff 规模**

```bash
git add --renormalize . && git status --porcelain | wc -l && git diff --cached --stat | tail -3
```
预期：内容级 diff 为零或极小（若出现真实内容变化行，逐文件核对是否纯行尾归一；异常即停下报告）。

- [ ] **步骤 3：验证 self-test 回配**

```bash
npm run --silent self-test 2>&1 | tail -2
```
预期 403/403（登记哈希为 LF 哈希，落盘归一后应全部回配；任何 verifier 区失败说明盘点遗漏，回任务 1）。

- [ ] **步骤 4：Commit**

```bash
git add -A && git commit -m "fix(env)!: .gitattributes 强制 LF 落盘并 renormalize——消除 autocrlf 下新 clone 的 R19 哈希假红（43.0.1）"
```

---

### 任务 3：fresh-clone 实证 + 升版 43.0.1

**文件：**
- 修改：`package.json`、`package-lock.json`、`w-model-dev/skill-metadata.json`、`w-model-dev/SKILL.md`、`README.md`、`docs/INSTALL.md`、`CHANGELOG.md`

- [ ] **步骤 1：fresh-clone 实证（「新 clone 假红」的直接关闭证据）**

```bash
rm -rf /tmp/fresh-clone-4301 && git clone "D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" /tmp/fresh-clone-4301 -q && cd /tmp/fresh-clone-4301 && git config core.autocrlf true && git checkout -q main && sha256sum w-model-dev/scripts/samples/verifier/README.md | head -c 16
```
预期：落盘哈希 = `2dfe8de7b528a167`（LF——attributes 压过 autocrlf）。再在该 clone 内跑（node_modules 缺失则回主仓以 `--root` 不适用，直接复制主仓 node_modules 或跳过完整 self-test，改跑最小判据）：
```bash
cd /tmp/fresh-clone-4301 && npx --prefix "D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/valid.json 2>/dev/null | grep -o '"exitCode":[01]'
```
预期 `"exitCode":0`。若 node_modules 依赖不可行，改判据：clone 内 `sha256sum` 抽验 3 个登记文件全部等于 fixture 登记哈希（即 LF 落盘成立）——把实际采用的判据写进报告。

- [ ] **步骤 2：升版 43.0.1（七处）**

```bash
npm version 43.0.1 --no-git-tag-version
```
手工同步其余五处（skill-metadata.json version/updatedAt、SKILL.md frontmatter、README、INSTALL、CHANGELOG 头部节）。

- [ ] **步骤 3：CHANGELOG 43.0.1 节**

```markdown
## [43.0.1] - 2026-10-07

### Fixed

- **环境（autocrlf×R19）**：新增 `.gitattributes` 强制全仓 LF 落盘并 renormalize——修复全局 `core.autocrlf=true` 下新 clone 首次 self-test 的 R19 哈希假红（合并期实测发现）。机制侧归一化哈希随 43.1.0 落地。

**验证记录**：self-test 403/403（renormalize 后回配）；fresh-clone 实证 LF 落盘成立；prepush 19 项全绿（实测耗时见 git log）。
```

- [ ] **步骤 4：验证 + Commit**

```bash
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts && npm run --silent eval && git add -A && git commit -m "chore(release): 43.0.1——autocrlf 环境热修"
```

---

### 任务 4：prepush + 合入 main

- [ ] **步骤 1：prepush（当前分支 fix/hotfix-43-0-1 上，19 项单次全绿；后台运行，前台等待勿超 6 分钟纪律不适用于控制者本人的后台任务）**

```bash
npm run --silent prepush
```
预期 exit 0。若 npm audit 再拦：同批次 6 先例处置（audit fix + 复跑）。

- [ ] **步骤 2：合入 main 并删分支**

```bash
git checkout main && git merge --no-ff fix/hotfix-43-0-1 -m "Merge branch 'fix/hotfix-43-0-1'（43.0.1：autocrlf 环境热修，prepush 19/19 全绿）" && git branch -d fix/hotfix-43-0-1 && git log --oneline -2
```

- [ ] **步骤 3：合并结果快验证**

```bash
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts && npm run --silent eval && npm run --silent self-test 2>&1 | tail -1
```
预期三绿（docs-consistency 0 / eval 68/68 / self-test 403/403）。

---

## 自检记录

1. **规格覆盖度**：规格 §1 环境侧四步骤（盘点/attributes/renormalize/fresh-clone 实证）↔ 任务 1-3；升版发版 ↔ 任务 3-4。机制侧归批次 7（非本计划）。
2. **占位符扫描**：无待定/TODO；步骤 1 的熔断判定给出精确阈值与停下动作。
3. **类型一致性**：不适用（无代码接口）。
