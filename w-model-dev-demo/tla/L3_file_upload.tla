(*
  @system        blog-system-demo
  @requirement   SD-015
  @design        docs/system-design.md
  @parent        ../tla/L2_infrastructure.tla
  @sibling       null
  @child         null
  @level         L3
  @phase         3
  所属系统: blog-system-demo
  关联需求: SD-015 文件上传（上传校验与配额管理原子行为）
  关联设计: docs/system-design.md §3.1 SD-015 + §5.3 存储抽象 + docs/interface-design.md INTF-015
  上级 TLA: L2_infrastructure.tla
  同级 TLA: 无（L3 原子行为规格，单一职责）
  下级 TLA: 无（L3 为叶子规格）
  层级: L3 (原子化子系统行为)
  requirementIds: [SD-015]
*)
---- MODULE L3_file_upload ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Users,          (* 用户全集 *)
    Files           (* 文件全集 *)

(* ==================== 状态空间定义 ==================== *)
(* 文件状态：uploaded 已上传 / notexist 未上传 (REQ-015) *)
FileUploaded == "uploaded"
FileNotExist == "notexist"
FileStates == {FileUploaded, FileNotExist}

(* 文件类型（魔数校验，REQ-015 验收标准 3） *)
FileTypeImage == "image"
FileTypeAttachment == "attachment"
FileTypes == {FileTypeImage, FileTypeAttachment}

(* 文件大小上限 (REQ-015 数据约束: 单文件 <= 10MB) *)
MaxFileSizeMB == 10

(* 用户配额上限 (REQ-015 数据约束: 单用户 <= 200 文件) *)
UserQuotaLimit == 200

NoneUser == "noneuser"
NoneFileType == "nonefiletype"

(* ==================== 变量 ==================== *)
VARIABLES
    fileState,          (* 文件状态：file -> FileStates *)
    fileOwner,          (* 文件所有者：file -> Users ∪ {NoneUser} *)
    fileType,           (* 文件类型：file -> FileTypes ∪ {NoneFileType} *)
    fileSizeMB,         (* 文件大小（MB）：file -> Nat（0 表示未上传） *)
    userQuota           (* 用户配额：user -> Nat（已用配额数） *)

vars == <<fileState, fileOwner, fileType, fileSizeMB, userQuota>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ fileState \in [Files -> FileStates]
    /\ fileOwner \in [Files -> Users \cup {NoneUser}]
    /\ fileType \in [Files -> FileTypes \cup {NoneFileType}]
    /\ fileSizeMB \in [Files -> Nat]
    /\ userQuota \in [Users -> Nat]

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/system-design.md#§3.1 SD-015 文件状态合法
 * 业务语义：文件状态必须在 FileStates 中（uploaded/notexist，REQ-015 验收标准 1）。
 *   未上传文件状态为 notexist；上传后状态为 uploaded。
 *   文件软删除后状态仍为 uploaded（保留元数据，仅标记不可访问）。 *)
FileStateInvariant ==
    /\ \A f \in Files :
        fileState[f] \in FileStates
    /\ \A f \in Files :
        fileState[f] = FileNotExist => fileOwner[f] = NoneUser

(* @designRef docs/system-design.md#§3.1 SD-015 文件所有权绑定
 * 业务语义：已上传文件必有合法所有者（REQ-015 验收标准 1）。
 *   文件所有者为 Users 元素；未上传文件所有者为 NoneUser。
 *   配额校验以 fileOwner 为准，防越权上传。 *)
FileOwnerInvariant ==
    /\ \A f \in Files :
        fileState[f] = FileUploaded => fileOwner[f] \in Users
    /\ \A f \in Files :
        fileState[f] = FileNotExist => fileOwner[f] = NoneUser

(* @designRef docs/system-design.md#§3.1 SD-015 文件大小限制
 * 业务语义：单文件大小 <= MaxFileSizeMB（10MB，REQ-015 验收标准 2）。
 *   超过 10MB 返回 413 错误；未上传文件大小为 0。 *)
FileSizeInvariant ==
    /\ \A f \in Files :
        fileState[f] = FileUploaded => fileSizeMB[f] <= MaxFileSizeMB
    /\ \A f \in Files :
        fileState[f] = FileNotExist => fileSizeMB[f] = 0

(* @designRef docs/system-design.md#§3.1 SD-015 文件类型魔数校验
 * 业务语义：已上传文件必有合法类型（image/attachment，REQ-015 验收标准 3）。
 *   魔数校验不匹配返回 415 错误；未上传文件类型为 NoneFileType。 *)
FileTypeInvariant ==
    /\ \A f \in Files :
        fileState[f] = FileUploaded => fileType[f] \in FileTypes
    /\ \A f \in Files :
        fileState[f] = FileNotExist => fileType[f] = NoneFileType

(* @designRef docs/system-design.md#§3.1 SD-015 用户配额限制
 * 业务语义：每用户已用配额 <= UserQuotaLimit（200 文件，REQ-015 数据约束）。
 *   配额超限返回 429 错误；配额计数等于该用户名下 uploaded 文件数。 *)
UserQuotaInvariant ==
    /\ \A u \in Users :
        userQuota[u] <= UserQuotaLimit
    /\ \A u \in Users :
        userQuota[u] = Cardinality({f \in Files : fileState[f] = FileUploaded /\ fileOwner[f] = u})

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ FileStateInvariant
    /\ FileOwnerInvariant
    /\ FileSizeInvariant
    /\ FileTypeInvariant
    /\ UserQuotaInvariant

(* ==================== 初始状态 ==================== *)
Init ==
    /\ fileState = [f \in Files |-> FileNotExist]
    /\ fileOwner = [f \in Files |-> NoneUser]
    /\ fileType = [f \in Files |-> NoneFileType]
    /\ fileSizeMB = [f \in Files |-> 0]
    /\ userQuota = [u \in Users |-> 0]

(* ==================== 状态转移（Next） ==================== *)

(* SD-015 动作1：上传文件（魔数校验 + 大小校验 + 配额校验） *)
UploadFile(user, file, ftype, sizeMB) ==
    /\ user \in Users
    /\ file \in Files
    /\ ftype \in FileTypes
    /\ sizeMB \in Nat
    /\ sizeMB <= MaxFileSizeMB
    /\ userQuota[user] < UserQuotaLimit
    /\ fileState[file] = FileNotExist
    /\ fileState' = [fileState EXCEPT ![file] = FileUploaded]
    /\ fileOwner' = [fileOwner EXCEPT ![file] = user]
    /\ fileType' = [fileType EXCEPT ![file] = ftype]
    /\ fileSizeMB' = [fileSizeMB EXCEPT ![file] = sizeMB]
    /\ userQuota' = [userQuota EXCEPT ![user] = userQuota[user] + 1]

(* SD-015 动作2：删除文件（软删除，配额回收） *)
DeleteFile(user, file) ==
    /\ user \in Users
    /\ file \in Files
    /\ fileState[file] = FileUploaded
    /\ fileOwner[file] = user
    /\ fileState' = [fileState EXCEPT ![file] = FileNotExist]
    /\ fileOwner' = [fileOwner EXCEPT ![file] = NoneUser]
    /\ fileType' = [fileType EXCEPT ![file] = NoneFileType]
    /\ fileSizeMB' = [fileSizeMB EXCEPT ![file] = 0]
    /\ userQuota' = [userQuota EXCEPT ![user] = userQuota[user] - 1]

(* SD-015 动作3：拒绝超大文件（大小超限，返回 413） *)
RejectOversizeFile(user, file, sizeMB) ==
    /\ user \in Users
    /\ file \in Files
    /\ sizeMB \in Nat
    /\ sizeMB > MaxFileSizeMB
    /\ fileState[file] = FileNotExist
    /\ UNCHANGED <<fileState, fileOwner, fileType, fileSizeMB, userQuota>>

(* SD-015 动作4：拒绝魔数不匹配（类型非法，返回 415） *)
RejectInvalidMagic(file) ==
    /\ file \in Files
    /\ fileState[file] = FileNotExist
    /\ UNCHANGED <<fileState, fileOwner, fileType, fileSizeMB, userQuota>>

(* SD-015 动作5：拒绝超配额（用户配额已满，返回 429） *)
RejectQuotaExceeded(user, file) ==
    /\ user \in Users
    /\ file \in Files
    /\ userQuota[user] >= UserQuotaLimit
    /\ fileState[file] = FileNotExist
    /\ UNCHANGED <<fileState, fileOwner, fileType, fileSizeMB, userQuota>>

(* Next：联合文件上传所有原子动作 *)
Next ==
    \/ \E u \in Users, f \in Files, t \in FileTypes, s \in Nat : UploadFile(u, f, t, s)
    \/ \E u \in Users, f \in Files : DeleteFile(u, f)
    \/ \E u \in Users, f \in Files, s \in Nat : RejectOversizeFile(u, f, s)
    \/ \E f \in Files : RejectInvalidMagic(f)
    \/ \E u \in Users, f \in Files : RejectQuotaExceeded(u, f)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   2 个常量：Users / Files
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^2 = 4
 *   4 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 *)
================
