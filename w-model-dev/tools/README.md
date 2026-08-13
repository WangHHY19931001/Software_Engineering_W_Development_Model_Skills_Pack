# tools/ — 技能内置工具

## tla2tools.jar

| 项 | 值 |
|---|---|
| 版本 | TLC2 2.19 of 08 August 2024 |
| 来源 | [github.com/tlaplus/tlaplus](https://github.com/tlaplus/tlaplus)（TLA+ 官方仓库 release 产物） |
| License | BSD-2-Clause（TLA+ 工具链官方许可证，见上游仓库 LICENSE） |
| 内容 | SANY（语法解析）+ TLC（模型检查）+ PlusCal（翻译器），单文件分发，无网络依赖 |
| 位置 | `w-model-dev/tools/tla2tools.jar`（约 2.3MB） |

**权威版本记录**：`references/tla-plus-guide.md`「工具链」节（实测确认方法：`java -cp tla2tools.jar tlc2.TLC` 输出 `TLC2 Version 2.19 of 08 August 2024`）。

**同步策略**：手动同步，随 skill 版本演进更新（升级时同步更新本表与本仓库 README 中相关版本声明）；不采用每次运行自动下载——保证 `check-tla-model.ts` 离线可用、结果可复现。

**依赖**：宿主 Java runtime ≥ 11（唯一外部依赖，见 tla-plus-guide.md「工具链」节）。
