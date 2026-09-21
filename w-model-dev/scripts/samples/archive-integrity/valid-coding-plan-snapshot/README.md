# valid-coding-plan-snapshot/（配套归档目录树）

`valid-coding-plan-snapshot.json` 清单的**配套归档目录树**：演示编码计划归档快照在真实归档目录内的
落盘形态（`<changeId>.plan.md` + `progress.md` + `task-<N>-{brief,report}.md`，即 check-coding-plan R6
归档快照语义的 archive-integrity 视角）。

- self-test 的 `ARCHIVE_INTEGRITY_CASES` valid 用例经 `sampleDir` 字段读本树内的 `progress.md`
  作为 `progressMdContent`（与 CLI `deriveArchiveIntegrityManifest` + 实读账本的生产路径同源）；
- 树内文件由 check-samples-coverage 规则 1 经该 `sampleDir` 子树引用登记，非悬空 fixture。
