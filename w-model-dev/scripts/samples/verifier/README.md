# samples/verifier fixture 目录说明

VerifierOutput 样本目录：`valid*.json`（正例，含 4 个可执行 Persona 样例）、`persona-*.json`
（Persona 可执行样例）、`bad-*.json`（负例，逐规则失败判据，登记于 `../NEGATIVE-COVERAGE.md` 的
门禁行与本目录 `samples/README.md` 矩阵、`self-test.ts` 的 `VERIFIER_CASES`）。

## reviewedArtifacts 登记（R19，A2 反伪造）

本目录全部 fixture 均带必填 `reviewedArtifacts: [{path, sha256}]`（VerifierOutput Schema 必填字段，
R19 评审对象绑定）。登记口径：

- **无 `path:Lnn=` 形态 evidence 的 fixture**：回落登记本 `README.md`（稳定锚文件——内容与本目录
  fixture 集合无耦合，改动频率低）。fixture 不能登记自己：登记项 sha256 是文件自身内容的哈希，
  存在自引用悖论；也不登记同目录其他 fixture（相互哈希耦合会扩散改动面）。
- **`persona-*.json`**：登记其 `path:Lnn=` evidence 指向的仓内真实文件（仓库根相对路径，
  `check-verifier-output.ts` 按「VerifierOutput 所在目录优先、cwd 回退」解析）。
  **维护注意**：这些登记项哈希绑定被引文件的当前字节——修改
  `w-model-dev/scripts/logic/verifier-logic.ts`、`w-model-dev/scripts/__tests__/verifier-logic.test.ts`、
  `w-model-dev/references/agent-personas.md` 后，须同步刷新对应 persona fixture 的
  `reviewedArtifacts[].sha256`（对被改文件 `sha256sum` 后回填四个 JSON），否则 self-test /
  vitest 以 `R19 评审对象哈希不符` 失败——这正是该门禁的预期行为（产物已变，旧评审不再成立）。

## 校验入口

```bash
npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/valid.json
```
