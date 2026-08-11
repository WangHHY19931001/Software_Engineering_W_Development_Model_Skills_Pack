---
name: security-review
description: "在任何安全评审/凭据检查场景使用此技能——对仓库执行源码级安全扫描与凭据脱敏评审：跑 lint:security（eslint-plugin-security + baseline 指纹豁免）、按反模式 #43 检查状态文件与日志中的硬编码凭据、执行修复动作并复扫确认。"
version: "1.0.0"
license: MIT
metadata:
  hermes:
    tags: [security, review]
---

# 安全评审：源码级安全扫描 + 凭据脱敏

对仓库执行两层安全评审：第一层用 `lint:security`（security-scan.ts + eslint-plugin-security）做源码级扫描；第二层按反模式 #43 对数据文件层做凭据脱敏检查。发现风险后执行修复动作并复扫确认。

<HARD-GATE>
在完成下方检查清单的全部条目（源码扫描 → 数据文件层凭据检查 → 模板/示例占位符检查 → 修复 → 复扫确认）之前，不得向用户宣称"安全通过"或"无安全问题"。任何安全结论都必须是可复现检查的结果。
</HARD-GATE>

## 源码级安全扫描

先跑全量安全扫描：

```bash
npm run lint:security
```

**底层机制**：`lint:security` = `tsx w-model-dev/scripts/cli/security-scan.ts`，脚本内部调用 `npx eslint --no-eslintrc --config config/.eslintrc.cjs --ignore-path config/.eslintignore w-model-dev/scripts/ --format json` 收集 eslint-plugin-security 发现，再与仓库根目录的 `.eslintsecurity-baseline.json` 比对。

**6 条安全规则**（`config/.eslintrc.cjs`）：

| 规则 | 级别 | 检测内容 |
|---|---|---|
| `security/detect-object-injection` | warn | 对象属性访问键名未校验，可被原型污染/注入 |
| `security/detect-unsafe-regex` | error | 灾难性回溯正则（ReDoS） |
| `security/detect-non-literal-regexp` | error | 用字符串拼接/变量构造 RegExp |
| `security/detect-non-literal-fs-filename` | warn | 文件系统路径拼接未校验，可被路径穿越 |
| `security/detect-eval-with-expression` | error | eval / Function 执行表达式 |
| `security/detect-pseudoRandomBytes` | error | 用 crypto.pseudoRandomBytes 生成安全密钥 |

**baseline 机制**：已知风险以 sha256 内容敏感指纹（`file + ruleId + 归一化违规行内容`）记录在 `.eslintsecurity-baseline.json`，不含行号列号——行号漂移（上方增删行）不改变指纹，基线不会因位移而陈旧。已覆盖的发现豁免；**仅新增风险条目才报错**。

**退出码**：0 = 无新增风险；1 = 有新增风险（需修复代码或重生成 baseline）；2 = 输入错误（eslint 不可用 / baseline 文件损坏 / 旧版位置指纹格式需重生成）。

**定向扫描**：只查单个文件/目录时直接 `npx eslint <file-or-dir>`（如 `npx eslint w-model-dev/scripts/lib/cli-error.ts`），规则与全量扫描一致。

**重生成 baseline**：新增代码触发误报时，先人工确认发现确为可豁免误报，再按仓库惯例执行 `npx tsx w-model-dev/scripts/cli/security-scan.ts --regenerate` 全量重生成 baseline，随后复跑 `npm run lint:security` 确认 exit 0。

## 凭据脱敏检查（反模式 #43）

检查数据文件层（反模式 #43，权威定义见 `w-model-dev/references/anti-patterns.md`）：状态文件与日志是项目资产，可能随仓库分发、归档或进入下游 CI，硬编码凭据构成泄露风险，且违反「敏感配置统一经环境变量注入」的运维纪律。

**检查范围**：

- `.w-model/*.json`（project/budget/maturity/graph/rtm/tla-manifest 等）
- `.w-model/gate-logs/` 存档
- `.w-model/` 下的 `run-log.jsonl` / `event-ingress.jsonl` / `signature-chain.jsonl`

**高熵密钥特征清单**——任一命中即视为疑似硬编码凭据：

- `sk-` 前缀（如 `sk-${API_KEY}` 形式的密钥引用）
- 32+ 位 Base64 字符串
- `Bearer ` 格式的认证头令牌
- `AKIA` 前缀（AWS 访问密钥）
- `password=` / `passwd=` 字段

**模板/示例检查**：SKILL.md 示例、templates/ 模板、references/ 示例中的凭据必须为占位符（如 `${JWT_SECRET}`），不得出现真实凭据。演示/教学场景同样用占位符呈现，示例运行时应从环境变量读取值。

## 修复动作

命中反模式 #43 时按顺序执行：

1. **移除敏感值** — 从 `.w-model/*.json`、`.w-model/gate-logs/`、`run-log.jsonl` / `event-ingress.jsonl` / `signature-chain.jsonl` 删除硬编码的密钥、令牌、密码、连接串。
2. **改为引用** — 敏感配置统一经环境变量注入，文件与日志中只留引用名（如 `${JWT_SECRET}`）；或移交外部 secrets 管理，不落盘。
3. **修正模板/示例** — SKILL.md 示例、templates/、references/ 中的真实凭据全部替换为占位符。
4. **复扫确认** — 修复后重跑 `npm run lint:security` 确认 exit 0，并按上方特征清单对检查范围重新扫描确认 0 命中，两者均通过后才可给出评审结论。

## 检查清单

你必须为以下每个条目创建任务，并按顺序完成：

1. **源码级安全扫描** — 运行 `npm run lint:security`，确认无新增风险（exit 0）；exit 1 时先修复代码，确认误报后再按惯例重生成 baseline 并复跑
2. **数据文件层凭据检查** — 按特征清单扫描 `.w-model/*.json`、`.w-model/gate-logs/`、`run-log.jsonl` / `event-ingress.jsonl` / `signature-chain.jsonl`，确认 0 命中
3. **模板/示例占位符检查** — 检查 SKILL.md 示例、templates/、references/ 示例，确认凭据均为占位符（如 `${JWT_SECRET}`）而非真实值
4. **修复动作** — 对命中项执行：移除敏感值 → 改环境变量引用名或外部 secrets 管理 → 修正模板/示例为占位符
5. **复扫确认** — 重跑 `npm run lint:security`（exit 0）与凭据复扫（0 命中），两项均通过后给出评审结论

## 认证/授权/传输安全评审维度（第 41 轮四源吸收）

> 源码扫描（上文）发现"有没有"，本节评审"设计对不对"。对设计/架构评审场景执行。
> 与 [verifier-spec.md](../../../w-model-dev/references/verifier-spec.md) Security 轴评审提问同源（第 41 轮四源吸收，凤凰架构 system-security/zero-trust）——本节为检查维度表，评审提问见该文档，更新时保持同步。

| 维度 | 检查项 | 高危信号 |
|---|---|---|
| 认证 | 认证三层覆盖（信道 TLS / 协议 / 内容）；OAuth2 四模式与场景适配 | 密码模式用于第三方应用；无 TLS 强制 |
| 授权 | RBAC96 建模（角色/许可/资源）；最小特权 + 职责分离；角色互斥 | 全量管理员角色；越权直接对象引用（IDOR） |
| 凭证 | 密码存储 = 慢哈希 + 每用户盐 + 服务端二次哈希；JWT 防篡改不防泄漏 | 明文/弱哈希存密码；JWT 用于会话态管理（无法主动失效） |
| 传输 | HTTPS 强制；mTLS 服务间认证；零信任（服务间无默认信任、集中策略实施点） | 内网明文 HTTP；服务间默认互信 |
