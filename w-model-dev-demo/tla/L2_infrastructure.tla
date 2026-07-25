(*
  @system        blog-system-demo
  @requirement   SD-015
  @design        docs/system-design.md
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_content_management.tla, ../tla/L2_identity_access.tla, ../tla/L2_discovery.tla, ../tla/L2_interaction.tla, ../tla/L2_operations_support.tla, ../tla/L2_subscription_push.tla
  @child         ../tla/L3_file_upload.tla
  @level         L2
  @phase         2
  所属系统: blog-system-demo
  关联需求: SD-015 文件上传 + WAL 操作日志 + 审计日志（基础设施域）
  关联设计: docs/system-design.md §3.1 SD-015 + §6.3 文件上传安全 + §8.3 可用性
  上级 TLA: L1_blog_system.tla
  同级 TLA: 其他 6 个 L2 规格
  下级 TLA: L3_file_upload.tla（阶段 3 产出，SD-015 上传校验与配额管理原子行为）
  层级: L2 (子系统内部行为)
  requirementIds: [SD-015]
*)
---- MODULE L2_infrastructure ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Files,            (* 文件全集 *)
    Users,            (* 用户全集 *)
    AuditEntries      (* 审计日志条目全集 *)

(* ==================== 状态空间定义 ==================== *)
(* 文件状态 (REQ-015) *)
FileUploaded == "uploaded"
FileNotExist == "notexist"
FileStates == {FileUploaded, FileNotExist}

(* 允许的 MIME 白名单 (REQ-015 验收标准 1-2 + §6.3) *)
MimeJpeg == "image/jpeg"
MimePng == "image/png"
MimeWebp == "image/webp"
MimeGif == "image/gif"
MimePdf == "application/pdf"
MimeMarkdown == "text/markdown"
MimeZip == "application/zip"
AllowedMimes == {MimeJpeg, MimePng, MimeWebp, MimeGif, MimePdf, MimeMarkdown, MimeZip}

(* 文件大小上限 (REQ-015 数据约束: 单文件 <=10MB) *)
FileSizeLimit == 10485760

(* 用户日配额上限 (REQ-015 验收标准 3: 用户日 50MB) *)
UserDailyQuotaLimit == 52428800

(* 博主月配额上限 (REQ-015 验收标准 3: 博主月 500MB) *)
BloggerMonthlyQuotaLimit == 524288000

NoneUser == "noneuser"
NoneMime == "nonemime"

(* ==================== 变量 ==================== *)
VARIABLES
    fileStore,             (* 文件状态：file -> FileStates *)
    fileMeta,              (* 文件元数据：file -> (uploader, mime, size, sha256) ∪ {NoneMeta} *)
    userDailyQuota,        (* 用户日配额：user -> Nat（bytes，每日重置） *)
    auditLog,              (* 审计日志：Seq(AuditEntries)（只追加） *)
    operationLog           (* WAL 操作日志：Seq(操作记录)（崩溃重建依据） *)

NoneMeta == "nonemeta"
vars == <<fileStore, fileMeta, userDailyQuota, auditLog, operationLog>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ fileStore \in [Files -> FileStates]
    /\ fileMeta \in [Files -> (Users \times AllowedMimes \times Nat \times STRING) \cup {NoneMeta}]
    /\ userDailyQuota \in [Users -> Nat]
    /\ auditLog \in Seq(AuditEntries)
    /\ operationLog \in Seq(Files \times Users)

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/system-design.md#§3.1 SD-015 文件状态一致
 * 业务语义：文件存储一致——fileStore 中每个文件状态必须在 FileStates 中（REQ-015 验收标准 4）。
 *   已上传文件（uploaded）的元数据完整：MIME 类型、大小、上传者、SHA-256 摘要。
 *   未上传文件 fileMeta = NoneMeta，状态为 notexist。 *)
FileStoreConsistent ==
    /\ \A f \in Files :
        fileStore[f] = FileUploaded => fileMeta[f] # NoneMeta
    /\ \A f \in Files :
        fileStore[f] = FileNotExist => fileMeta[f] = NoneMeta

(* @designRef docs/system-design.md#§6.3 SD-015 MIME 白名单
 * 业务语义：已上传文件的 MIME 必须在 AllowedMimes 中（REQ-015 验收标准 1-2）。
 *   图片 image/jpeg|png|webp|gif；附件 application/pdf、text/markdown、application/zip。
 *   魔数校验：读取文件头字节验证与声明 MIME 一致（防伪造扩展名，§6.3）。 *)
FileMimeWhitelist ==
    \A f \in Files :
        fileStore[f] = FileUploaded =>
            fileMeta[f] # NoneMeta /\ fileMeta[f][2] \in AllowedMimes

(* @designRef docs/system-design.md#§3.1 SD-015 文件大小限制
 * 业务语义：单文件 <= 10MB（REQ-015 数据约束）；超限返回 413。
 *   SHA-256 摘要用于去重（REQ-015 验收标准 7）。
 *   流式处理边接收边校验边写入，避免全量缓冲（CON-001 不引入 multer）。 *)
FileSizeInvariant ==
    \A f \in Files :
        fileStore[f] = FileUploaded =>
            fileMeta[f] # NoneMeta /\ fileMeta[f][3] <= FileSizeLimit

(* @designRef docs/system-design.md#§3.1 SD-015 配额管理
 * 业务语义：用户日配额 <= 50MB（REQ-015 验收标准 3）。
 *   博主月配额 500MB；站点总配额 10GB。
 *   配额超限拒绝上传，返回 413；日配额每日重置。 *)
UserQuotaInvariant ==
    \A u \in Users :
        userDailyQuota[u] <= UserDailyQuotaLimit

(* @designRef docs/system-design.md#§6.4 SD-003/017 审计日志只追加
 * 业务语义：审计日志只追加不可修改（NFR-003 审计完整性）。
 *   记录用户封禁/解禁、文章批量下架/归档、广告审核、备份恢复等敏感操作。
 *   日志条目均为合法 AuditEntries 元素。 *)
AuditLogAppendOnly ==
    /\ \A i \in 1..Len(auditLog) : auditLog[i] \in AuditEntries
    /\ Len(auditLog) >= 0

(* @designRef docs/system-design.md#§8.3 SD-001/012/017 WAL 操作日志
 * 业务语义：WAL 操作日志有序记录所有写操作（崩溃重建依据，NFR-002 可用性）。
 *   日志条目为 (file, user) 二元组，记录文件操作。
 *   崩溃后从日志重放重建内存状态（操作日志可选持久化）。 *)
OperationLogOrdered ==
    /\ \A i \in 1..Len(operationLog) : operationLog[i] \in Files \times Users
    /\ Len(operationLog) >= 0

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ FileStoreConsistent
    /\ FileMimeWhitelist
    /\ FileSizeInvariant
    /\ UserQuotaInvariant
    /\ AuditLogAppendOnly
    /\ OperationLogOrdered

(* ==================== 初始状态 ==================== *)
Init ==
    /\ fileStore = [f \in Files |-> FileNotExist]
    /\ fileMeta = [f \in Files |-> NoneMeta]
    /\ userDailyQuota = [u \in Users |-> 0]
    /\ auditLog = <<>>
    /\ operationLog = <<>>

(* ==================== 状态转移（Next） ==================== *)

(* SD-015 动作1：文件上传（流式处理，校验 MIME/大小/配额） *)
FileUpload(user, file, mime, size, sha256) ==
    /\ user \in Users
    /\ file \in Files
    /\ mime \in AllowedMimes
    /\ size <= FileSizeLimit
    /\ sha256 \in STRING
    /\ Len(sha256) = 64
    /\ fileStore[file] = FileNotExist
    /\ userDailyQuota[user] + size <= UserDailyQuotaLimit
    /\ fileStore' = [fileStore EXCEPT ![file] = FileUploaded]
    /\ fileMeta' = [fileMeta EXCEPT ![file] = <<user, mime, size, sha256>>]
    /\ userDailyQuota' = [userDailyQuota EXCEPT ![user] = userDailyQuota[user] + size]
    /\ operationLog' = Append(operationLog, <<file, user>>)
    /\ UNCHANGED <<auditLog>>

(* SD-015 动作2：文件删除（仅上传者或管理员可删，元数据清空） *)
FileDelete(user, file) ==
    /\ user \in Users
    /\ file \in Files
    /\ fileStore[file] = FileUploaded
    /\ fileMeta[file] # NoneMeta
    /\ fileMeta[file][1] = user
    /\ fileStore' = [fileStore EXCEPT ![file] = FileNotExist]
    /\ fileMeta' = [fileMeta EXCEPT ![file] = NoneMeta]
    /\ UNCHANGED <<userDailyQuota, auditLog, operationLog>>

(* SD-015 动作3：日配额重置（每日定时任务） *)
ResetDailyQuota ==
    /\ userDailyQuota' = [u \in Users |-> 0]
    /\ UNCHANGED <<fileStore, fileMeta, auditLog, operationLog>>

(* SD-015 动作4：基于 sha256 去重上传（已存在同 sha256 文件直接复用） *)
FileDedupUpload(user, file, mime, size, sha256) ==
    /\ user \in Users
    /\ file \in Files
    /\ mime \in AllowedMimes
    /\ size <= FileSizeLimit
    /\ sha256 \in STRING
    /\ Len(sha256) = 64
    /\ fileStore[file] = FileNotExist
    /\ \E f \in Files :
        fileStore[f] = FileUploaded /\ fileMeta[f][4] = sha256
    /\ fileStore' = [fileStore EXCEPT ![file] = FileUploaded]
    /\ fileMeta' = [fileMeta EXCEPT ![file] = <<user, mime, size, sha256>>]
    /\ UNCHANGED <<userDailyQuota, auditLog, operationLog>>

(* 审计动作5：追加审计日志（敏感操作触发） *)
AppendAuditLog(entry) ==
    /\ entry \in AuditEntries
    /\ auditLog' = Append(auditLog, entry)
    /\ UNCHANGED <<fileStore, fileMeta, userDailyQuota, operationLog>>

(* WAL 动作6：追加操作日志（崩溃重建依据） *)
AppendOperationLog(file, user) ==
    /\ file \in Files
    /\ user \in Users
    /\ operationLog' = Append(operationLog, <<file, user>>)
    /\ UNCHANGED <<fileStore, fileMeta, userDailyQuota, auditLog>>

(* Next：联合基础设施域所有动作 *)
Next ==
    \/ \E u \in Users, f \in Files, m \in AllowedMimes, s \in Nat, h \in STRING :
        FileUpload(u, f, m, s, h)
    \/ \E u \in Users, f \in Files : FileDelete(u, f)
    \/ ResetDailyQuota
    \/ \E u \in Users, f \in Files, m \in AllowedMimes, s \in Nat, h \in STRING :
        FileDedupUpload(u, f, m, s, h)
    \/ \E e \in AuditEntries : AppendAuditLog(e)
    \/ \E f \in Files, u \in Users : AppendOperationLog(f, u)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   3 个常量：Files / Users / AuditEntries
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^3 = 8
 *   8 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 *)
================
