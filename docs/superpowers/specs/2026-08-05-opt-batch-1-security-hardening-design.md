# 第 33 轮 · 批次 1 设计：安全加固

> 触发：全仓库深入分析识别 4 项安全相关缺陷（1 项 P1 门禁静默放行 + 1 项 P2 误删面 + 1 项 P2 命令注入面 + 1 项 P3 原型污染防御）。总框架 spec 见 [2026-08-05-optimization-overview-design.md](./2026-08-05-optimization-overview-design.md)。
>
> 当前版本：`32.0.0`（版本号在全部批次完成后统一升级 33.0.0，本批不升版本号）。
>
> 工作流：总框架头脑风暴 → 本批次 spec → 本批次 plan → 实施 → 回归 → 提交。

## 1. 背景与缺口

| # | 级别 | 现状（探索实测） | 风险 |
|---|---|---|---|
| 1.1 | P1 | [check-state-machine-consistency.ts:159-165](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/scripts/cli/check-state-machine-consistency.ts#L159-L165) 的 isMain 守卫用 `import.meta.url.replace('file:///', '')` 字符串替换做路径比较，未 URL 解码 | 脚本所在路径含空格（`%20`）或非 ASCII 字符时，比较不等 → `isMain=false` → `main()` 永不执行 → Node 以退出码 0 结束 → **门禁在未做任何校验的情况下静默报告通过** |
| 1.2 | P2 | [check-tla-model.ts:176-204](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/scripts/cli/check-tla-model.ts#L176-L204) `cleanTraceFiles(dir)` 对 `dir` 下 `states/` 目录递归删除、`*.dump/*.out` 强制删除；`dir` 来自 manifest 的 `spec.tlaPath`（Agent 可写） | 若 manifest 把 tlaPath 指向仓库根或敏感目录，`fs.rm(dir/states, {recursive})` 会删除该目录下同名业务 `states/` 目录（第 1 轮分析：当前删除面虽已限定文件名，但目录名 `states` 无 TLC 特征校验） |
| 1.3 | P2 | [server.cjs:537-547](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.cursor/skills/brainstorming/scripts/server.cjs#L537-L547) `cp.exec(process.env.BRAINSTORM_OPEN_CMD + ' ' + JSON.stringify(url), ...)` 经 shell 拼接执行 | BRAINSTORM_OPEN_CMD 虽注释为 trusted operator input，仍是通过 shell 的命令注入面（如环境变量值含 shell 元字符）；且 JSON.stringify(url) 对含特殊字符的 url 不构成 shell 安全边界 |
| 1.4 | P3 | 全仓 ~30 处 `JSON.parse` 入口均未处理 `__proto__` 键 | 现代 V8 的 JSON.parse 本身不污染原型（`__proto__` 成为自有属性），但对象后续若经 `Object.assign`/spread 复制会触发原型污染；为防御性加固 |

### 1.1 不涉及范围

- 不改 check-role-dispatch 坏行行为（第 29 轮已决策，行为不等价不重构）。
- 不改 exit 1 校验语义与 `XXX_JSON` 输出结构（批次 1 只做安全加固，输出结构不动）。
- 不引入新运行时依赖（safe-json.ts 仅 node 内置）。

## 2. 方案（已确认）

| # | 方案 | 说明 | 结论 |
|---|---|---|---|
| 1.1 | **A（采纳）** | isMain 守卫改为 `fileURLToPath(import.meta.url)` 比较（与其余 8 个脚本一致的成熟写法），`import { fileURLToPath } from 'node:url'` | 一行改动，消除静默放行 |
| 1.2 | **A（采纳）** | `cleanTraceFiles` 增加两层守卫：① `dir` 目录内必须存在 `.tla` 文件（TLC 产物只产生于 spec 目录）；② `states/` 目录删除前校验 TLC 产物特征（时间戳子目录模式或含 `.st`/`.fp` 文件），不匹配则跳过 | 白名单化删除面 |
| 1.3 | **A（采纳）** | `BRAINSTORM_OPEN_CMD` 改用 `execFile(bin, [...args, url])`（无 shell）；命令按首个空白拆分为 bin + 参数 | 消除 shell 注入面，保持功能 |
| 1.4 | **A（采纳）** | 新增 `lib/safe-json.ts`：`parseJsonSafe` + `safeJsonReviver`（reviver 丢弃 `__proto__` 键，返回 undefined 删除该键）；`read-json-or-exit.ts` 与全部 CLI 层 parse 入口接入 | 防御性加固，行为不变 |

### 2.1 关键决策（用户确认于总框架）

1. 批次 1 只做安全加固，不做文档/性能/重构（批次 2/3 承接）。
2. 删除面白名单化：**宁可漏删 TLC 残留、不可误删用户目录**（守卫不匹配则跳过而非删除）。
3. reviver 只丢弃 `__proto__`（原型污染唯一危险键）；`constructor` 不处理（JSON.parse 下无污染风险，避免破坏合法字段）。

## 3. 详细设计

### 3.1 isMain 守卫修复（1.1）

```ts
// check-state-machine-consistency.ts
import { fileURLToPath } from 'node:url';
// ...
const isMain = (() => {
  try {
    return process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
```

- 与 `check-artifact-gate.ts:385-386` / `check-role-dispatch.ts:128-129` 等 8 个脚本的既有写法完全一致。
- 删除 `import.meta.url.replace('file:///', '')` 字符串替换。

### 3.2 cleanTraceFiles 白名单（1.2）

```ts
/** TLC 时间戳子目录模式：states/YYYY-MM-DD-HH-MM-SS/ */
const TLC_TIMESTAMP_DIR = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/;

async function cleanTraceFiles(dir: string): Promise<string[]> {
  const deleted: string[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return deleted;
  }
  // 守卫 1：TLC 产物只产生于含 .tla 规格文件的目录；无 .tla 则跳过整个清理
  if (!entries.some(name => name.endsWith('.tla'))) {
    return deleted;
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    if (name.endsWith('.dump') || name.endsWith('.out')) {
      try { await fs.rm(full, { force: true }); deleted.push(full); } catch { /* 忽略 */ }
    }
    if (name === 'states') {
      // 守卫 2：states/ 必须是 TLC 产物（时间戳子目录或含 .st/.fp 指纹文件），否则跳过
      if (await isTlcStatesDir(full)) {
        try { await fs.rm(full, { recursive: true, force: true }); deleted.push(full); } catch { /* 忽略 */ }
      }
    }
  }
  return deleted;
}

/** 判定目录是否为 TLC 产物目录：含时间戳子目录，或直接含 .st/.fp 文件 */
async function isTlcStatesDir(dir: string): Promise<boolean> {
  let children: string[];
  try {
    children = await fs.readdir(dir);
  } catch {
    return false;
  }
  for (const c of children) {
    if (TLC_TIMESTAMP_DIR.test(c)) return true;
    if (c.endsWith('.st') || c.endsWith('.fp') || c.endsWith('.dump') || c.endsWith('.out')) return true;
  }
  return false;
}
```

- 行为变化仅在"误删面"：非 TLC 产物的 `states/` 目录不再删除（原实现删除）。正常 TLC 流程产物（时间戳子目录 + .st/.fp）删除行为不变。
- self-test 无需新增样本（无新校验规则，仅清理行为加固）；如需可加 1 个 `isTlcStatesDir` 单测。

### 3.3 server.cjs execFile 化（1.3）

```js
// server.cjs maybeOpenBrowser() 内
const cp = require('child_process');
if (process.env.BRAINSTORM_OPEN_CMD) {
  // 命令按首个空白拆分为 bin + args，URL 作为独立 argv 元素传入（无 shell）
  const [bin, ...args] = process.env.BRAINSTORM_OPEN_CMD.trim().split(/\s+/);
  if (bin) {
    try { cp.execFile(bin, [...args, url], () => {}); } catch (e) { /* best effort */ }
  }
  return;
}
```

- 局限说明（文档注明）：不支持命令本身含引号包裹的完整路径参数（如 `"C:\Program Files\x.exe"` 需用 `BRAINSTORM_OPEN_CMD="C:\Program Files\x.exe"` 时被拆分为 bin=`C:\Program`+args）；operator 配置场景可接受，注释中明示该约定。
- 平台 launcher 分支（execFile 数组模式）保持不变。

### 3.4 safe-json.ts（1.4）

新增 `w-model-dev/scripts/lib/safe-json.ts`：

```ts
/**
 * 安全 JSON 解析工具（原型污染防御）
 *
 * 背景：JSON.parse 将 `__proto__` 创建为对象自有属性（不污染原型），但对象后续
 * 经 Object.assign / spread 复制时会触发原型污染。对不受信输入统一丢弃 `__proto__` 键。
 * 仅丢弃 `__proto__`；`constructor`/`prototype` 在 JSON.parse 语义下无污染风险，不做处理。
 */
export function safeJsonReviver(key: string, value: unknown): unknown {
  return key === '__proto__' ? undefined : value;
}

export function parseJsonSafe<T = unknown>(text: string): T {
  return JSON.parse(text, safeJsonReviver) as T;
}
```

接入点（全部外部输入 parse 入口）：

| 文件 | 位置 | 替换 |
|---|---|---|
| `lib/read-json-or-exit.ts` | :39 / :79 | `JSON.parse(raw)` / `JSON.parse(trimmed)` → `parseJsonSafe` |
| `check-artifact-gate.ts` | :196/:222/:241/:263 | → `parseJsonSafe` |
| `check-bdd-model.ts` | :79 | → `parseJsonSafe` |
| `check-budget.ts` | :87/:146 | → `parseJsonSafe` |
| `check-maturity.ts` | :87/:130 | → `parseJsonSafe` |
| `check-preventive-review.ts` | :92/:162 | → `parseJsonSafe` |
| `check-requirement-coverage.ts` | :57/:94/:138 | → `parseJsonSafe` |
| `check-requirement-graph.ts` | :83/:122 | → `parseJsonSafe` |
| `check-role-dispatch.ts` | :70 | → `parseJsonSafe` |
| `check-run-log.ts` | :116 | → `parseJsonSafe` |
| `check-codegraph-queries.ts` | :81 | → `parseJsonSafe` |
| `metrics-report.ts` | :129 | → `parseJsonSafe` |
| `wm-status.ts` | :66/:90 | → `parseJsonSafe` |
| `security-scan.ts` | :166/:194 | → `parseJsonSafe`（baseline 文件亦统一） |
| `schema-loader.ts` | :37 | → `parseJsonSafe`（受信任 schema 文件，统一无副作用） |
| `self-test.ts` | 内部 ~25 处 | 机械替换（测试内部输入，统一） |

> `run-log-logic.ts:469`（GATE_JSON 模式提取 `match[1]` 后 parse）亦替换。

新增单测 `lib/safe-json.test.ts`（或并入现有测试）：
- `__proto__` 键被丢弃（parse 后对象无该键）
- 普通嵌套对象键保留、行为与原 JSON.parse 一致
- 数组 / 标量 / null 输入行为一致

## 4. 验证策略（批次 1 验收标准）

1. **全局基线**：`npm run self-test` 213 条全通过；`npx vitest run` 363 条全通过；`npx tsc --noEmit` 0 错误；`npm run lint:security` baseline 通过。
2. **行为验证（1.1）**：在含空格/中文的目录路径下执行 `check-state-machine-consistency.ts` → 正常输出校验结果（不再静默 exit 0）。用 `samples/state-machine/valid-consistent.json` 复验 exit 0 语义不变。
3. **行为验证（1.2）**：构造 tlaPath 指向仓库根（无 .tla 文件的目录）的 manifest → `cleanTraceFiles` 不删除任何内容；构造含非 TLC 特征 `states/` 的目录 → 跳过不删；构造标准 TLC 产物（时间戳子目录 + .st）→ 正常删除。
4. **行为验证（1.3）**：设置 `BRAINSTORM_OPEN_CMD` 为含参数的命令 + 含空格 url → execFile 正常执行（可用占位命令如 `cmd /c echo` 验证 argv 传递）；不设置时平台 launcher 分支不变。
5. **行为验证（1.4）**：含 `__proto__` 键的 JSON 输入 parse 后无该键；`samples/` 全部有效样本经 read-json-or-exit 解析结果与原实现一致（self-test 覆盖）。

## 5. 影响文件清单

| 文件 | 动作 |
|---|---|
| `w-model-dev/scripts/cli/check-state-machine-consistency.ts` | 修改（isMain 修复） |
| `w-model-dev/scripts/cli/check-tla-model.ts` | 修改（cleanTraceFiles 白名单） |
| `.cursor/skills/brainstorming/scripts/server.cjs` | 修改（execFile 化） |
| `w-model-dev/scripts/lib/safe-json.ts` | **新增** |
| `w-model-dev/scripts/lib/read-json-or-exit.ts` | 修改（parseJsonSafe 接入） |
| 14 个 CLI/工具脚本（见 §3.4 表） | 修改（parseJsonSafe 机械替换） |
| `w-model-dev/scripts/cli/self-test.ts` | 修改（内部 parse 替换） |
| `w-model-dev/scripts/__tests__/safe-json.test.ts` | **新增**（reviver 单测） |
| `w-model-dev/scripts/samples/state-machine/valid-consistent.json` | 已存在（复验用） |

提交粒度（子任务级）：① isMain 修复 ② cleanTraceFiles 白名单 ③ server.cjs execFile ④ safe-json 工具 + 全量 parse 接入 + 单测。
