# Git Bash / WSL Hook Runtime Compatibility 规格

- **日期：** 2026-09-07
- **状态：** 已批准设计的规格，待后续实现
- **范围：** 仓库根目录 `node_modules` 与本地 `.githooks/pre-push` / `.githooks/ensure-platform-deps.sh`
- **当前版本约束：** 保持 `42.2.1`；本规格不要求版本 bump
- **实施边界：** 本文只定义行为、数据契约、调用顺序、错误语义和验收方法，不实现代码，不改变 L0 Skill 分发模型

## 1. 背景与问题证据

本仓库是单根包。`w-model-dev/` 是可整体拷贝的纯 Markdown Skill 资产；仓库根目录的 `node_modules` 只服务于门禁脚本、测试和工程工具。两者不是同一交付物，也不应在安装 Skill 时混为一谈。

当前本地 hook 的事实如下：

1. `.githooks/pre-push` 在 Git Bash / WSL 中执行；纯 cmd / PowerShell 没有 Bash 时保留现有提示并以 `exit 0` 放行，提醒用户改用 Git Bash 补跑门禁。
2. 路径过滤、stdin ref 解析、delete-only、新分支基线回退和 fail-closed 语义先于依赖检查；只有命中门禁相关变更时才进入依赖检查。
3. 依赖检查先要求 `npm` 可用，再要求存在 `node_modules`，然后以当前 shell 执行 `bash .githooks/ensure-platform-deps.sh --check`。当前 `--check` 只读，缺失时提示手工运行 `npm run platform-deps:install`。
4. 依赖满足后，hook 按固定顺序执行 18 项门禁。`npm audit` 的已批准网络瞬态跳过规则、其它失败的阻断规则和纯 Windows shell 的放行语义均属于现有契约。
5. `.githooks/ensure-platform-deps.sh` 通过当前执行的 Node 读取 `process.platform` / `process.arch`，目前只支持 `win32-x64` 和 `linux-x64`；其它平台 fail-closed，并提示手工处理。
6. 现有测试已锁定 `--check` 不执行 npm、tar、解包或 node_modules 写入，以及缺失依赖时拒绝推送。实现本规格时，这些与“条件命中后执行 `npm ci`”直接冲突的测试断言必须更新为新契约；其余安全测试和 hook 顺序测试必须保留并扩展。

问题是同一 checkout 在 Git Bash 与 WSL 之间复用 `node_modules` 时，目录可能来自另一套运行环境：Git Bash 通常使用 Windows Node（`process.platform=win32`），WSL 使用 Linux Node（`process.platform=linux`），原生包和执行器脚本可能因此不可加载。仅检查目录存在或检查少数平台包，无法证明 `node_modules` 由当前 Node/npm、当前主版本和当前 `package-lock.json` 产生。反向复用还可能让本应失败的 hook 在错误环境中继续执行，造成执行器、原生二进制和日志诊断不一致。

## 2. 目标

本规格的目标是：

- 为仓库根 `node_modules` 建立可验证、可重算的运行环境 provenance 指纹。
- 在每次命中门禁时识别当前 shell 家族、当前执行器的真实 Node/npm 路径与版本、`process.platform` / `process.arch`，并计算当前 lockfile 的 SHA-256。
- 明确区分 Git Bash 与 WSL。Git Bash 的 win32 Node 与 WSL 的 linux Node 永远不能因路径或目录相同而视为同一环境。
- 仅在 `node_modules` 缺失、指纹缺失或损坏、schema 不符、当前环境不匹配、或当前 `package-lock.json` hash 不匹配时，使用当前解析到的 npm 执行完整 `npm ci`。
- `npm ci` 成功且重算验证通过后，原子写入新的 provenance 指纹；指纹不能成为绕过安装的可伪造单点。
- 重建失败时阻断 hook，禁止继续执行平台依赖检查或 18 项门禁。
- 保持既有 pre-push 触发范围、exit 语义、18 项门禁顺序、审计跳过边界、纯 cmd / PowerShell 提示放行语义和平台原生包的 fail-closed 语义。
- 记录足以排障的环境信息，同时不泄露 token、registry 凭据、用户路径中的敏感片段或完整 npm 配置。

## 3. 非目标

- 不把 L0 纯 Markdown Skill 安装改为需要 Node.js、npm 或仓库根 `node_modules`。
- 不在 Skill 资产中内置 LLM 调用、编程式编排引擎或 SDK。
- 不改变 O 编排者与 A / S / V / G / R 子代理的边界，不新增编排职责。
- 不把 `npm ci` 变成每次 push 的无条件重建，也不以 `npm install`、`npm pack`、手工解包或手工删除 `node_modules` 替代完整重建。
- 不改变平台原生包的当前支持矩阵：只支持 `win32-x64`、`linux-x64`；其它平台不因本规格而放行。
- 不修改本次规格范围之外的门禁、路径过滤、git stdin ref 解析、审计网络错误判定、TLA+/BDD、证据 provenance 或 L0 链接边界。
- 不在本规格提交中同步修改 SSoT、README、INSTALL、troubleshooting、AGENTS、hook 或测试；这些是后续实现变更的同步清单。
- 不要求 `42.2.1` 在本次实现中 bump。是否在后续发布时 bump 是独立发布决策。

## 4. 术语与运行环境分类

### 4.1 shellFamily

`shellFamily` 是 hook 运行时的分类，不是操作系统的别名，也不能只由脚本路径、当前目录或 `PATH` 推测。至少定义以下值：

| 值         | 适用环境                                                 | 必须核验的信号                                                                                                                                                              |
| ---------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git-bash` | Git for Windows 的 MSYS2 / MINGW Bash                    | `MSYSTEM` 为已知 `MINGW*` / `MSYS*` 值，或 `OSTYPE` 为 `msys*` / `mingw*`，或 `uname -s` 为 `MINGW*` / `MSYS*` / `CYGWIN*`；同时核对当前 Node 的平台结果                    |
| `wsl`      | Windows Subsystem for Linux 内的 Bash                    | `WSL_INTEROP` 或 `WSL_DISTRO_NAME` 存在且非空，或 `/proc/version` / `/proc/sys/kernel/osrelease` 含可验证的 WSL 标识；同时要求 `uname -s=Linux`，并核对当前 Node 的平台结果 |
| `posix`    | 非 WSL 的 Linux / macOS / BSD 等 POSIX shell             | `OSTYPE` / `uname -s` 与非 WSL 的 POSIX 信号一致，且没有被识别为 Git Bash 或 WSL                                                                                            |
| `unknown`  | 信号冲突、信号缺失且无法可靠归类、探测命令失败或输出异常 | 不得继续依赖复用；按第 8 节 fail-closed 处理                                                                                                                                |

检测顺序必须先排除信号冲突，再分类：

1. 读取并校验 `MSYSTEM`、`OSTYPE`、`uname -s`，检查 Git Bash/MSYS/MINGW 信号。
2. 读取 `WSL_INTEROP`、`WSL_DISTRO_NAME`，必要时读取 `/proc/version` 与 `/proc/sys/kernel/osrelease`，检查 WSL 信号。
3. 用 `uname -s` 与当前 Node 的 `process.platform` / `process.arch` 交叉验证。
4. 任一强信号相互矛盾（例如同时呈现 Git Bash 与 WSL、WSL 信号存在但 `uname` 非 Linux、Git Bash 信号存在但当前 Node 非 `win32`），或无法确认分类时，记录 `shellFamily=unknown` 并 fail-closed；不得猜测为 Git Bash 或 WSL。

`MSYSTEM`、`OSTYPE`、`WSL_*` 和 `/proc` 内容属于探测输入，不写入指纹中的任意原始环境变量字段；日志只记录经过白名单归一化的分类和必要的布尔探测结果，避免泄露用户环境细节。

### 4.2 当前执行器身份

Node/npm 必须来自当前 hook 执行器，而不是来自历史指纹、另一侧 checkout、固定路径或未经审计的用户 `PATH`：

- Node 的真实可执行文件路径由当前 shell 解析，并由该 Node 自己输出 `process.execPath`、`process.version`、`process.platform` 和 `process.arch`。
- npm 的真实可执行文件路径由当前 shell 解析；实现必须记录解析结果，并通过该 npm 的 `--version` 或等价受控探测获得 npm 版本。
- `node`、`npm` 的路径必须是绝对路径，或先由受控解析转换为绝对路径后再调用。日志记录规范化路径和版本，但对用户目录、令牌、registry 参数做脱敏。
- 解析结果必须绑定本次 hook 的进程。不能从 provenance 直接取旧路径，也不能静默用 PATH 中后来发现的第二套 npm 替代初始解析结果。
- 推荐的受控调用边界是：先解析一次 Node 与 npm，验证两者可执行且版本可读；随后所有环境探测、`npm ci`、平台检查和 package script 调用均使用已解析的绝对路径。若无法保持该绑定，立即 fail-closed。
- 现有门禁中出现的 `npx` 不能在预检后再次通过未审计的 `PATH` 解析。实现必须将其绑定到同一 npm/node 工具链（例如使用已解析 npm 的受控 `exec` 入口，或解析并核验 `npx` 与 npm 同目录且版本归属一致），并记录实际路径；无法证明绑定时，直接 fail-closed。
- `npm ci` 的 `cwd` 必须是当前 Git checkout 根目录，参数必须是实现定义且经审计的固定参数集合，不得拼接未验证的用户输入。除项目根和当前锁文件外，不从 npm 配置、registry 输出或包内容推导可执行路径。

Node 主版本与 npm 主版本均是匹配字段。版本值必须由当前执行器输出并按合法语义版本解析；无法读取、解析失败或版本不在仓库引擎约束内时，不得盲目复用，直接阻断并提示使用当前支持的 Node/npm 修复环境。

### 4.3 平台分类

平台分类以当前 Node 输出为准：

- `process.platform=win32` 且 `process.arch=x64`：允许 Windows x64 原生包。
- `process.platform=linux` 且 `process.arch=x64`：允许 Linux x64 原生包。
- 其它组合：沿用现有 fail-closed，明确提示当前平台未覆盖；不得通过 provenance 命中或 npm ci 后自动放行。支持矩阵检查是兼容性预检的前置条件；未覆盖组合必须在任何 `npm ci`、平台依赖安装或 18 项门禁之前直接阻断，避免无意义的网络和写盘副作用。

Git Bash 与 WSL 的平台结果必须独立记录和匹配。典型有效配对是 `git-bash + win32-x64` 与 `wsl + linux-x64`；Git Bash 解析到 Linux Node、或 WSL 解析到 Windows Node，均属于不一致环境，不能复用，且应 fail-closed，而不是把 shell 名称重写为另一类。

## 5. Provenance 指纹契约

### 5.1 文件位置与生命周期

指纹文件固定放在当前 checkout 根目录：

```text
.w-model/node-modules-provenance.json
```

`.w-model/` 已是本地生成物目录并被 Git 忽略。指纹仅描述仓库根 `node_modules`，不描述 Agent-specific 的 L0 Skill 目录，也不作为审计证据或密码学签名。

若 `.w-model/` 不存在，实现可在受控目录创建它；若无法创建或无法写入，重建后的 hook 必须 fail-closed，因为无法完成 provenance 记录。指纹文件读取失败、空文件、非 UTF-8 JSON、JSON 顶层不是对象、schema 版本未知或任一字段非法，都按“指纹损坏”处理并触发重建；不允许把损坏值当作未变更的证明。

### 5.2 Schema

实现必须提供可测试的固定 schema。以下为本规格冻结的字段与类型（字段名不可变；schema 的具体载体可在实现阶段选择 JSON Schema 或等价确定性校验）：

```json
{
  "format": "w-model-node-modules-provenance",
  "schemaVersion": 1,
  "checkoutRoot": "/repo",
  "shellFamily": "wsl",
  "process": {
    "platform": "linux",
    "arch": "x64"
  },
  "node": {
    "execPath": "/usr/bin/node",
    "version": "v20.19.0",
    "major": 20
  },
  "npm": {
    "execPath": "/usr/bin/npm",
    "version": "10.8.2",
    "major": 10
  },
  "packageLock": {
    "path": "package-lock.json",
    "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  },
  "createdAt": "2026-09-07T00:00:00.000Z"
}
```

上例是一个完整的 WSL 形状示例；实际值必须全部由当前 checkout 的当前执行器实测生成。字段规则：

- `format` 必须是固定字符串；`schemaVersion` 必须是整数 `1`。未知版本一律损坏，不做宽松解析。
- `checkoutRoot` 必须是当前 `git rev-parse --show-toplevel` 解析得到的绝对、规范化路径；无法取得或不能确认当前 checkout 根目录时 fail-closed。比较路径时使用当前平台规范化规则；不得把 Git Bash `/d/...` 与 WSL `/mnt/d/...` 仅按字符串改写后当作相同 Node 环境。
- `shellFamily` 只能取已核验的值，不能写 `unknown` 作为可复用 provenance；无法分类时不写入可用指纹，直接阻断或完成重建后仍阻断。
- `process.platform` 与 `process.arch` 必须是当前 Node 的精确输出，不能从 `uname` 或历史文件代填。
- `node.execPath`、`node.version`、`node.major`、`npm.execPath`、`npm.version`、`npm.major` 必须来自本次执行器解析和探测。版本主数必须与完整版本一致。
- `packageLock.path` 固定为 checkout 根相对路径 `package-lock.json`；hash 是对该文件当前原始字节按 SHA-256 计算的 lowercase hex，不能对解析后的 JSON、格式化内容或换行归一化后再 hash。
- `createdAt` 只用于诊断，不能参与匹配判定；时间不可解析时指纹仍视为损坏，成功写入使用 UTC ISO 8601。
- 不记录 PATH 全文、npm 配置全文、registry URL、认证信息、用户 token、原始 WSL 版本字符串或完整环境变量快照。

### 5.3 原子写入与不可伪造要求

指纹写入不能成为绕过 `npm ci` 的可伪造单点：

1. 读取并 hash 当前 checkout 的 `package-lock.json` 原始字节。
2. 当前执行器重新探测 shell、Node、npm 和平台字段；所有字段都必须通过 schema 和一致性规则。
3. 只有在本次 `npm ci` 返回 `exit 0` 后，且再次确认 `node_modules` 存在、当前 Node/npm 可用、当前 lockfile hash 未在过程中变化，并通过 `ensure-platform-deps.sh --check` 后，才允许构造指纹。
4. 指纹对象必须由当前执行器按第 5.2 节完整生成，不能接受命令行传入或从旧指纹复制路径、版本、hash。
5. 写入使用同一 checkout 内的临时文件：创建权限受限的临时文件，写入完整 JSON + 单一换行，刷新并关闭，读取回解析并逐字段复核，然后以同目录 `rename` 原子替换目标文件。失败时删除临时文件，保留旧指纹但本次 hook 仍失败。
6. 指纹写入与 `npm ci` 必须受 checkout 级互斥锁保护；锁超时、锁损坏或无法确认锁归属时 fail-closed。不得使用无界等待。

指纹只用于判断“是否需要重建”，不是安装成功证明。即使恶意进程预先伪造了一个字段齐全的指纹，后续实现也必须在使用前重新探测当前 Node/npm、重新计算 lockfile hash，并检查目录及平台依赖；伪造指纹不能使不匹配环境继续执行。对于同 UID / 同 Windows 访问令牌进程直接篡改 checkout、锁文件或 `node_modules` 的主体，沿用仓库既有威胁模型：不声明对该主体提供不可抵赖或 OS 级隔离。

## 6. Hook 数据流与调用顺序

以下顺序是行为契约。路径过滤之前不做可能产生网络或写盘副作用的依赖重建。

1. 保留现有参数解析、`--force` / `PREPUSH_FORCE` 处理、纯 cmd / PowerShell 检测、Git push stdin ref 解析、路径范围聚合、delete-only 放行和 fail-closed 回退。
2. 未命中门禁路径时按现有语义放行；命中后进入兼容性预检。
3. 通过当前 Bash 的受控方式解析一次 `node` 和 `npm` 绝对路径；记录 `nodePath` / `npmPath` 的脱敏诊断信息。任一缺失、不可执行、解析为多个不一致目标或版本不可读时，输出明确原因并 `exit 1`。
4. 使用该 Node 取得 `process.execPath`、Node 版本、`process.platform`、`process.arch`；使用该 npm 取得 npm 版本。校验 shellFamily，禁止把 Git Bash 与 WSL 合并。先执行支持平台前置检查；当前组合不是 `win32-x64` 或 `linux-x64` 时立即 `exit 1`，不执行 `npm ci`。
5. 取得当前 checkout 根目录并读取 `package-lock.json`；无法读取、hash 失败或 checkout 根不确定时 `exit 1`。在判断是否复用前，不得使用旧指纹补齐任何未知字段。
6. 读取 `.w-model/node-modules-provenance.json`，按 schema 和一致性规则验证。缺失、损坏、schema 不符、shellFamily 不同、checkout 根不同、Node/npm 路径或主版本不同、`process.platform` / `process.arch` 不同、lockfile SHA-256 不同，均标记为需要重建。
7. 若无需重建，执行当前 `ensure-platform-deps.sh --check`，且该检查必须使用已解析并绑定的 Node/npm 语境。检查失败则 `exit 1`，不得执行门禁。
8. 若需要重建，取得 checkout 级互斥锁；锁等待期间重新执行步骤 3–7，因为另一个 hook 可能已完成重建。若复核后已匹配且平台检查通过，释放锁并继续，不重复 `npm ci`。
9. 锁持有者在 lockfile hash、当前 Node/npm、shellFamily 和平台再次确认后，以当前解析的绝对 npm 执行固定形式的 `npm ci`，`cwd` 为 checkout 根。不得先手工 `rm -rf node_modules`，不得切换到另一 npm，不得执行 `npm install` 代替 `npm ci`。`npm ci` 的生命周期脚本按当前 package.json 正常执行，既有 `postinstall` 行为继续受现有契约约束。
10. `npm ci` 返回非零、被信号终止、超时、权限失败、lockfile 被并发修改或输出显示配置/解析错误时，记录脱敏摘要、删除本次临时文件、释放锁并 `exit 1`；不执行平台检查，不执行任何门禁。网络错误也不能让 hook继续门禁，用户需在环境恢复后重试。
11. `npm ci` 成功后重新执行当前 Node/npm 和 lockfile 探测；确认 `node_modules` 与 `.bin/tsx` 等门禁运行时可用，并调用 `ensure-platform-deps.sh --check`。任一失败不写 provenance，释放锁并 `exit 1`。
12. 由当前实测值构造并原子写入指纹；回读复核成功后释放锁。指纹写入失败不影响旧文件的保留策略，但本次 hook 必须 `exit 1`，不得以“npm ci 已成功”为由继续门禁。
13. 释放锁后进入现有门禁段。18 项门禁的编号、命令、期望退出码和顺序保持不变；兼容性预检和可能的 `npm ci` 不计入 18 项，不得静默删除、重排、放宽任一门禁。
14. 保留现有清理 trap、审计输出和最终 exit 语义。依赖兼容性失败统一阻断（`exit 1`）；纯 cmd / PowerShell 仍在步骤 1 以既有提示 `exit 0` 放行，不因无法运行 Bash 而尝试从 cmd / PowerShell 选择 npm 或自动安装。

## 7. `npm ci` 重建触发矩阵

“匹配”要求所有条件同时成立；任意一项未知或失败都不能复用。矩阵中的“重建”指在互斥锁内再次复核后执行 `npm ci`。

| 条件                                                       | 行为                                     | 说明                                                       |
| ---------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `node_modules` 缺失                                        | 重建                                     | 不再仅提示手工安装；当前 npm 执行 `npm ci`，失败即阻断     |
| `node_modules` 存在，但 provenance 文件缺失                | 重建                                     | 缺失不能证明来源                                           |
| provenance 为空、非法 JSON、非对象、未知版本或任一字段损坏 | 重建                                     | 损坏不能降级为匹配                                         |
| shellFamily 变化（Git Bash ↔ WSL，或其它已知类别变化）     | 重建                                     | 同一 checkout 路径不改变此规则                             |
| shellFamily 检测不确定或信号冲突                           | 不盲目重建后放行；fail-closed            | 无法生成可信指纹，阻断并提示修复当前 Bash/WSL 识别环境     |
| 当前 Node `process.platform` 变化                          | 重建                                     | `win32` 与 `linux` 永不互换                                |
| 当前 Node `process.arch` 变化                              | 支持矩阵内重建；其它平台直接 fail-closed | 非 `x64` 平台不得执行 `npm ci`                             |
| 当前 Node 可执行路径变化                                   | 重建                                     | 路径属于执行器身份，不能复用旧环境                         |
| Node 主版本变化                                            | 重建                                     | 版本必须来自当前 Node；不满足 `engines.node >=20` 时阻断   |
| npm 可执行路径变化                                         | 重建                                     | 不允许静默选择另一套 npm                                   |
| npm 主版本变化                                             | 重建                                     | 版本来自当前 npm                                           |
| 当前 `package-lock.json` SHA-256 变化                      | 重建                                     | 对原始文件字节 hash                                        |
| checkout root 变化或无法确认                               | 重建后仍 fail-closed                     | 不能把另一个 checkout 的 provenance 当作本 checkout 的证明 |
| 所有字段匹配，但平台包缺失或平台未支持                     | 不写新指纹，fail-closed                  | `ensure-platform-deps --check` 仍是阻断检查                |
| 所有字段匹配、平台检查通过                                 | 不重建                                   | 直接进入既有 18 项门禁                                     |
| `npm ci` 成功但后验探测、平台检查或指纹原子写入失败        | fail-closed                              | 不继续门禁，也不写不完整指纹                               |

特别规则：

- 不允许只因 `node_modules` 目录存在就复用。
- 不允许只因 provenance 的 lockfile hash 相同就复用；环境和执行器字段同样必须匹配。
- 不允许只因 npm 能运行就复用；Node/npm 的绝对路径、主版本和平台结果都必须核验。
- 不允许每次 push 无条件 `npm ci`。命中“所有字段匹配且平台检查通过”时，必须证明没有调用 `npm ci`。
- provenance 缺失、损坏或 schema 不符会触发重建，但 shellFamily、当前 Node/npm 或 lockfile hash 无法确认时不能盲目复用，也不能写入“看起来匹配”的指纹。

## 8. 失败与安全语义

### 8.1 权限、文件系统和网络

- 无法执行或读取当前 Node/npm、无法创建 `.w-model`、临时文件、锁，或无法读写指纹：输出不含秘密的原因，`exit 1`。
- `node_modules` 只读、文件被占用、rename 失败、npm cache/config 无法使用或 `npm ci` 权限失败：`exit 1`，不继续门禁。
- `npm ci` 的网络不可达、registry 失败、包校验失败或 lifecycle script 失败：均是依赖重建失败，`exit 1`。现有 `npm audit` 的网络瞬态“第 13 项可跳过”只适用于该审计步骤，不能扩展到 `npm ci`。
- 锁文件被并发修改：以重新读取和 hash 为准；若 hash 在安装前后不一致，视为失败，不写指纹。用户需先稳定工作树后重试。
- 不输出完整 npm 命令行、环境变量、registry URL、认证参数或原始 npm 错误中可能包含的 token；允许输出退出码、错误类别、经脱敏的执行器路径、Node/npm 主版本、平台和重试建议。

### 8.2 恶意或损坏指纹

- provenance 是不可信输入。JSON 解析、schema、路径规范化、版本语义、平台值和 hash 格式必须全部校验。
- 指纹中的路径、版本、平台或 hash 与当前重算值任何一项不符，不能复用；按矩阵重建。
- 当前执行器身份或 lockfile hash 无法确认时，不得用指纹中的值填补，不得“最佳努力”放行。
- 重建后的指纹只能由当前 hook 根据成功后验生成；不接受调用者提供 JSON，不从 npm 输出粘贴字段。
- 指纹文件所在 `.w-model` 仍属于本地运行时状态，不提交、不导出为源代码证据；本规格不赋予它签名或第三方证明能力。

### 8.3 并发 hook

- 以 checkout 根为粒度设置互斥锁，至少覆盖“复核 → npm ci → 后验 → 指纹原子写入”完整生命周期。
- 第二个 hook 获取锁前可以做只读预检；获取锁后必须重新读取和重算，发现第一个 hook 已完成则跳过 `npm ci`。
- 锁等待超过固定有限超时、锁 owner 无法验证、锁内容损坏或恢复动作不明确时 fail-closed。不能通过删除未知锁或无条件覆盖指纹来解锁。
- 采用原子临时文件 + 同目录 rename；失败清理临时文件，不能留下可被下一次误读的半文件。

### 8.4 日志与诊断

每次进入兼容性预检至少记录：shellFamily、`process.platform` / `process.arch`、Node/npm 主版本、脱敏后的 Node/npm 路径、lockfile hash 的前 12 位摘要、判定结果（reuse / rebuild 及触发原因）、是否执行 `npm ci` 和最终 exit code。完整 SHA-256 可以写入本地指纹，但默认日志只显示前缀。

不得记录：完整 `PATH`、完整环境变量、npm config、认证 token、registry 凭据、用户 home 下未经脱敏的路径、包下载 URL 查询参数或包脚本秘密。错误摘要要按固定类别映射，避免把任意 npm 输出原样复制到日志；必要的原始诊断只允许由用户在本地直接重跑 npm 命令获取，hook 不代为打印秘密。

## 9. 兼容性与迁移

### 9.1 Git Bash 与 WSL

首次在任一环境命中门禁时，若根 `node_modules` 缺失或旧指纹不匹配，hook 在该环境使用当前 npm 执行 `npm ci`，成功后写入该环境指纹。随后切换到另一环境：

- Git Bash 解析到 `win32-x64` 与 WSL 解析到 `linux-x64` 必然不匹配，第二侧再次执行 `npm ci`；
- 第二侧成功后覆盖同一路径的 provenance，下一次回到第一侧会再次因 shell/platform/path 不匹配而重建；
- 这是一种可接受的“同一 checkout 双环境切换”迁移语义，不能通过放宽匹配把两个原生依赖树混为一谈；频繁切换的长期建议仍是使用独立 checkout。

### 9.2 旧 checkout 与旧 provenance

旧版本没有该指纹文件，或文件不是 `format=w-model-node-modules-provenance` / `schemaVersion=1`，统一按缺失/损坏处理。首次成功的条件 `npm ci` 后才建立新指纹，不提供一次性信任旧 `npm install` 产物的迁移豁免。旧的显式 `npm run platform-deps:install` 仍可作为独立手工工具，但不替代本规格要求的根依赖兼容性重建。

### 9.3 纯 Windows shell

原生 cmd / PowerShell 无 Bash 时维持现有提示、`exit 0` 放行和“请在 Git Bash 补跑”的文字语义。该路径不执行 shellFamily 指纹探测、不选择 npm、不执行 `npm ci`，也不改变“门禁未真正执行”的提示。Git Bash / WSL 才是本规格的执行入口。

### 9.4 L0 / L1 边界

复制 `w-model-dev/` 到 Agent-specific skills 目录仍是 L0/L1 Skill 安装动作，不读写仓库根 `.w-model/node-modules-provenance.json`，不触发 `npm ci`。只有在当前仓库根 hook 需要执行门禁时，才适用本规格。

## 10. 测试矩阵

实现阶段必须扩展现有 `w-model-dev/scripts/__tests__/platform-deps-hook.test.ts`（优先扩展现有文件，不新增测试文件，除非另行说明）和必要的 hook 端到端 fixture。以下矩阵为最低覆盖：

| 类别         | 场景                                                          | 必须验证                                                         |
| ------------ | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| Shell 识别   | Git Bash：MSYSTEM / OSTYPE / uname 组合                       | 识别为 `git-bash`；不因路径名或 `PATH` 假设                      |
| Shell 识别   | WSL：WSL_* 或 `/proc` 信号 + Linux uname                      | 识别为 `wsl`；与 Git Bash 结果不同                               |
| Shell 识别   | 非 WSL POSIX                                                  | 识别为 `posix`                                                   |
| Shell 识别   | 信号冲突、探测失败、缺失且无法确认                            | `unknown`，不复用，不写指纹，fail-closed                         |
| 平台交叉验证 | Git Bash + win32 Node                                         | 通过环境一致性检查                                               |
| 平台交叉验证 | WSL + linux Node                                              | 通过环境一致性检查                                               |
| 平台交叉验证 | Git Bash + linux Node、WSL + win32 Node                       | 不复用并阻断，不能重分类                                         |
| 执行器来源   | Node/npm 从不同 PATH 位置变化                                 | 记录真实绝对路径；路径变化触发 `npm ci`                          |
| 执行器安全   | PATH 中存在另一套 npm、npm 路径含空格或恶意参数               | 只调用初次受控解析结果；不静默切换；参数边界安全                 |
| 版本         | Node 主版本变化、npm 主版本变化、版本无法解析                 | 重建或阻断；不盲目复用                                           |
| Lockfile     | hash 相同                                                     | 不重建（其它字段也匹配时）                                       |
| Lockfile     | 任意字节变化、文件缺失或读取失败                              | 重建或阻断；不复用旧值                                           |
| 指纹状态     | 缺失、空、非法 JSON、schema 不符、未知版本、错误字段类型      | 触发重建；无法获得当前实测值则阻断                               |
| 指纹防伪     | 手工改 path / platform / arch / version / hash                | 当前重算发现不匹配，不能绕过 `npm ci`                            |
| 首次构建     | `node_modules` 缺失                                           | 调用一次当前绝对 npm 的 `npm ci`；成功后写入指纹                 |
| 正常复用     | 完整匹配且平台包齐全                                          | 不调用 `npm ci`，进入平台检查和门禁                              |
| 条件重建     | shell / platform / path / Node/npm 主版本 / lockfile 任一变化 | 仅触发一次 `npm ci`，成功后写新指纹                              |
| 重建失败     | npm 非零、信号、权限、网络、生命周期失败                      | `exit 1`，不调用平台检查，不调用 18 项门禁                       |
| 后验失败     | `npm ci` 成功但 `.bin/tsx`、平台包或 lockfile 后验失败        | 不写指纹，`exit 1`，不进入门禁                                   |
| 原子写       | 指纹临时写入、回读失败、rename 失败                           | 旧文件不被半写覆盖，hook 阻断，临时文件清理                      |
| 并发         | 两个 hook 同时发现不匹配                                      | 锁内二次复核，最多一次实际重建，指纹为完整可读 JSON              |
| 现有 hook    | 多 ref、delete-only、新分支、无关路径、`--force`              | 原有范围和放行语义不变；无关路径不触发 `npm ci`                  |
| 门禁顺序     | 依赖复用和重建两条路径                                        | 18 项命令编号、期望 exit code、顺序不变；重建失败时 18 项为 0 次 |
| 平台矩阵     | win32-x64、linux-x64、其它平台                                | 前两者按当前执行器检查；其它平台在 `npm ci` 前明确 fail-closed   |
| L0 边界      | 只复制 `w-model-dev/`                                         | 不生成指纹，不要求 npm/node_modules，不触发 hook                 |
| 日志         | npm 错误、用户路径、registry/token 形态                       | 有诊断字段且脱敏，不输出秘密                                     |

除了单元和 fixture 测试，还必须在 Git Bash 与 WSL 各执行一次真实 hook 兼容性验证：确认日志显示不同 `shellFamily` 与平台身份，切换环境会触发重建，匹配环境的后续 push 不会无条件重建。真实验证报告属于后续实现阶段证据，不属于本规格提交。

## 11. 需要同步的文件与变更边界

后续实现完成后必须按 SSoT 优先顺序同步，且每次活体文档中的“门禁项数”保持 `18`：

1. `docs/skill-design-document_SSoT.md`：更新本地 pre-push 平台依赖与显式安装安全边界，加入 shellFamily、Node/npm 执行器绑定、provenance schema、条件 `npm ci`、锁与 fail-closed 规则。
2. `.githooks/pre-push`：实现兼容性预检、受控 Node/npm 解析、重建与后验；保留路径过滤、纯 Windows 分支和 18 项原有顺序。更新注释中的旧依赖行为描述。
3. `.githooks/ensure-platform-deps.sh`：接受 hook 已确认的当前执行器语境，继续从当前 Node 获取平台，维持 `win32-x64` / `linux-x64` 支持矩阵和其它平台 fail-closed；不得用脚本路径或旧指纹推断平台。
4. `w-model-dev/scripts/__tests__/platform-deps-hook.test.ts`：将缺失依赖和只读探测的历史预期改成条件重建矩阵，并补齐第 10 节测试。
5. `package.json`：仅在实现确需新增内部命令时同步 scripts；不得因本规格自动 bump `42.2.1`。若不需要新入口，保持不变。
6. `README.md`：更新 CI / 本地 pre-push、Git Bash / WSL 和根 `node_modules` 复用说明；保留 L0 Skill 资产零依赖表述。
7. `docs/INSTALL.md`：更新仓库验证、pre-push、平台依赖、Git Bash / WSL 切换和 L0/L1 交付边界。
8. `docs/troubleshooting.md`：新增 provenance 缺失/损坏、环境切换触发 `npm ci`、npm ci 失败、锁冲突和日志脱敏排障；保留纯 Windows 放行说明。
9. `AGENTS.md`：更新关键目录速查、常用命令和 pre-push 依赖语义；明确当前版本 `42.2.1` 不变、18 项顺序不变和 L0 边界。
10. `docs/superpowers/specs/2026-09-07-hook-runtime-compatibility-design.md`：本文件作为设计依据被实现计划和后续审查引用。
11. 若实现新增 schema / 共享库 / CLI 或动态测试事实，必须按仓库现有 docs-consistency、security-scan、Prettier、TypeScript 和测试矩阵规则同步其登记与验证；不得仅改文档后宣称实现完成。

本规格提交不修改上述现有活体文件；第 11 节是后续实现的同步清单，不是本次提交范围。

## 12. 验收标准

验收必须由可执行命令、测试或人工可复核证据给出，不得由 LLM 估算：

- [ ] 规格实现只对当前解析到的绝对 Node/npm 执行探测和 `npm ci`，日志能显示脱敏路径、版本和平台；不存在未经审计的 PATH 静默切换。
- [ ] Git Bash / WSL 分类使用 `MSYSTEM`、`OSTYPE`、`uname`、`WSL_*` 和 `/proc` 的可验证信号；冲突或不确定时 fail-closed。
- [ ] Git Bash 的 win32 Node 与 WSL 的 linux Node 被识别为不同 provenance；切换环境不会复用另一侧 `node_modules`。
- [ ] provenance 文件为 `.w-model/node-modules-provenance.json`，符合第 5.2 节固定 schema，记录 shellFamily、platform、arch、Node/npm 主版本、真实执行器路径和 package-lock SHA-256。
- [ ] 指纹缺失、损坏、schema 不符、任一环境字段变化或 lockfile hash 变化均触发重建；当前执行器或 lockfile hash 无法确认时不盲目复用。
- [ ] `npm ci` 只在触发矩阵命中且锁内二次复核仍不匹配时执行；完整匹配且平台检查通过时零次调用。
- [ ] `npm ci` 使用 hook 解析到的当前 npm、当前 checkout root 和完整依赖重建语义；无手工 `rm -rf`、无 `npm install` 替代、无未经批准的参数拼接。
- [ ] `npm ci` 或后验失败时返回 `exit 1`，不执行 `ensure-platform-deps --check`，不执行 18 项门禁，不写不完整 provenance。
- [ ] 成功重建后，当前环境与 lockfile hash 重新计算，通过平台检查，再以临时文件 + 回读 + 同目录原子 rename 写入 provenance；并发 hook 最多一个实际重建。
- [ ] `win32-x64` 与 `linux-x64` 继续支持；其它平台在 `npm ci` 前明确提示并 fail-closed。
- [ ] 路径过滤、stdin ref、多 ref、delete-only、新分支 fail-closed、`--force`、纯 cmd / PowerShell `exit 0` 提示语义保持；无关变更不触发重建。
- [ ] 18 项门禁的顺序、期望退出码、审计网络跳过边界保持；兼容性预检不计入 18 项。
- [ ] L0 纯 Markdown Skill 安装不生成 provenance、不要求根 `node_modules`、不调用 npm ci。
- [ ] 测试矩阵覆盖 shell 识别、执行器绑定、指纹状态、重建矩阵、失败阻断、并发、原子写、日志脱敏和现有 hook 回归；Git Bash 与 WSL 各有真实验证证据。
- [ ] 实现后的 SSoT、README、INSTALL、troubleshooting、AGENTS、`.githooks` 和测试同步完成；`npm run check:docs-consistency`、Prettier、相关 Vitest 和适用门禁结果以真实命令输出为准。规格阶段不运行实现测试。

## 13. 冻结项与后续发布决策

### 13.1 本规格冻结，后续实现不得自行改变

- 目标问题：同一 checkout 在 Git Bash 与 WSL 复用不匹配 `node_modules` 的 hook 执行器与原生依赖问题。
- 方案：运行环境指纹 + 仅不匹配时使用当前 npm 执行完整 `npm ci`。
- `shellFamily` 必须由可验证环境信号分类，不能只靠文件路径；不确定或冲突必须 fail-closed。
- Git Bash 与 WSL 是不同 shellFamily；当前 Node 的真实路径、`process.platform`、`process.arch`、Node/npm 主版本和当前 `package-lock.json` SHA-256 共同决定是否可复用。
- provenance 路径与字段：`.w-model/node-modules-provenance.json`、`format`、`schemaVersion=1`、shell、平台、架构、Node/npm 路径和主版本、lockfile SHA-256 等第 5.2 节字段。
- 缺失、损坏、schema 不符或任何匹配字段变化的处理方向；当前环境或 hash 无法确认时禁止盲目复用。
- provenance 只能在 `npm ci` 成功、后验通过、当前 lockfile hash 未变化且平台检查通过后由当前执行器原子写入；它不是绕过 `npm ci` 的信任根。
- `npm ci` 的完整重建、当前解析 npm、当前 checkout cwd、禁止手工删除、失败阻断和有限 checkout 级并发锁语义。
- 支持平台仅 `win32-x64` / `linux-x64`；其它平台 fail-closed。
- 现有 pre-push 路径过滤、纯 cmd / PowerShell 提示放行、exit 语义和 18 项门禁顺序不被静默放宽；兼容性预检不算新增门禁项。
- L0 Skill 安装与仓库根 `node_modules` 完全分离。
- 本规格及后续实现不引入 LLM 调用，不改变编排者最小化与子代理边界。

### 13.2 未在本规格冻结，需实现/发布时单独决定

- 具体实现是继续维护 shell 脚本，还是新增自包含 TypeScript 辅助 CLI。
- 兼容性预检的函数名、脚本文件拆分、锁文件命名和具体有限超时时长。
- 指纹校验是否另建仓库 schema 文件，或在现有内部校验库中以内嵌固定 schema 实现；若新增 schema，必须遵循仓库 schema 清单和 docs-consistency 规则。
- 日志中脱敏绝对路径的具体替换算法，只冻结“可诊断且不泄露秘密”的结果。
- 真实 Git Bash / WSL CI 或本机验证的编排方式；仓库不因此新增云端 CI。
- 是否在后续发布批次 bump 版本号；本次实现默认继续 `42.2.1`。

## 14. 规格自检约束

提交前必须完成以下文档级检查：

- 使用搜索确认没有遗留任务标记、未决事项标记或空缺章节。
- 使用搜索确认全文没有把旧的“缺失依赖仅提示人工处理”行为当作新契约；旧行为只能在问题证据或“后续实现需更新的现有测试”中明确标为历史状态。
- 检查全文对 `18 项`、`42.2.1`、`win32-x64`、`linux-x64`、`npm ci`、shellFamily 和 L0 边界的表述一致。
- 检查 Markdown 标题层级、代码块闭合、表格列数、行尾和尾随空白。
- 检查验收标准能对应到测试矩阵和数据流，且没有把实现测试结果提前宣称为通过。

本文件是规格文档，不是实现计划；完成文档自检后，后续实现仍须按仓库要求走 SSoT 同步、子代理分派、修改前影响分析、测试与门禁流程。
