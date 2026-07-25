(*
  @system        blog-system-demo
  @requirement   SD-001, SD-017
  @design        docs/system-design.md
  @parent        ../tla/L1_blog_system.tla
  @sibling       ../tla/L2_content_management.tla, ../tla/L2_identity_access.tla, ../tla/L2_discovery.tla, ../tla/L2_interaction.tla, ../tla/L2_infrastructure.tla, ../tla/L2_subscription_push.tla
  @child         null
  @level         L2
  @phase         2
  所属系统: blog-system-demo
  关联需求: SD-001 站点管理 + SD-017 数据导出与备份（运营支撑域）
  关联设计: docs/system-design.md §3.1 SD-001/017 + §8 可用性设计
  上级 TLA: L1_blog_system.tla
  同级 TLA: 其他 6 个 L2 规格
  下级 TLA: 无（L3 在阶段 3-4 产出）
  层级: L2 (子系统内部行为)
  requirementIds: [SD-001, SD-017]
*)
---- MODULE L2_operations_support ----
EXTENDS Naturals, Sequences, FiniteSets

(* ==================== 常量 ==================== *)
CONSTANTS
    Backups,            (* 备份任务全集 *)
    Users,              (* 用户全集 *)
    Announcements       (* 公告全集 *)

(* ==================== 状态空间定义 ==================== *)
(* 系统运行状态 (REQ-001 验收标准 2) *)
RunningState == "running"
MaintenanceState == "maintenance"
SystemStates == {RunningState, MaintenanceState}

(* 备份任务状态 (REQ-017 验收标准 6) *)
BackupPending == "pending"
BackupRunning == "running"
BackupCompleted == "completed"
BackupFailed == "failed"
BackupStates == {BackupPending, BackupRunning, BackupCompleted, BackupFailed}
NonExistBackup == "notbackup"

(* 公告状态 (REQ-001) *)
AnnouncementPending == "pending"
AnnouncementPublished == "published"
AnnouncementArchived == "archived"
AnnouncementStates == {AnnouncementPending, AnnouncementPublished, AnnouncementArchived}
NonExistAnnouncement == "notannouncement"

(* 备份文件大小上限 (CON-003: 备份 <=10MB) *)
BackupFileSizeLimit == 10485760

(* ==================== 变量 ==================== *)
VARIABLES
    systemState,                (* 系统运行状态 *)
    maintenanceMessage,         (* 维护模式消息（开启维护模式时非空） *)
    backupSchedule,             (* 备份调度集合：SUBSET Backups *)
    backupStatus,               (* 备份任务状态：backup -> BackupStates ∪ {NonExistBackup} *)
    backupSha256,               (* 备份文件 SHA-256 校验和：backup -> string（恢复时校验） *)
    announcementRegistry        (* 公告状态：announcement -> AnnouncementStates ∪ {NonExistAnnouncement} *)

vars == <<systemState, maintenanceMessage, backupSchedule, backupStatus, backupSha256, announcementRegistry>>

(* ==================== TypeInvariant ==================== *)
TypeInvariant ==
    /\ systemState \in SystemStates
    /\ maintenanceMessage \in STRING
    /\ backupSchedule \subseteq Backups
    /\ backupStatus \in [Backups -> BackupStates \cup {NonExistBackup}]
    /\ backupSha256 \in [Backups -> STRING]
    /\ announcementRegistry \in [Announcements -> AnnouncementStates \cup {NonExistAnnouncement}]

(* ==================== 业务不变式 ==================== *)

(* @designRef docs/system-design.md#§3.1 SD-001 站点管理维护模式
 * 业务语义：系统状态必须始终合法（running 或 maintenance，REQ-001 验收标准 2）。
 *   维护模式下非管理员请求返回 503 且响应体含 maintenanceMessage。
 *   状态切换由管理员控制，保证站点可运维性。 *)
SystemStateInvariant ==
    /\ systemState \in SystemStates
    /\ systemState = MaintenanceState => maintenanceMessage # ""

(* @designRef docs/system-design.md#§3.1 SD-017 备份任务状态机
 * 业务语义：备份任务状态机 pending → running → completed/failed（REQ-017 验收标准 6）。
 *   禁止逆向跳转（completed 不可回 running）；任务异步执行，支持进度查询。
 *   导出格式 CSV/JSON（REQ-017 数据约束）。 *)
BackupStatusInvariant ==
    /\ \A b \in Backups :
        backupStatus[b] \in BackupStates \cup {NonExistBackup}
    /\ \A b \in Backups :
        backupStatus[b] # NonExistBackup => backupStatus[b] \in BackupStates

(* @designRef docs/system-design.md#§8.3 SD-017 备份完整性校验
 * 业务语义：备份恢复前校验 SHA-256 完整性，不一致返回 422（REQ-017 验收标准 4）。
 *   备份文件 <= 10MB（CON-003）；恢复成功率 >= 99%（NFR-002）。
 *   completed 状态的备份必有 sha256 校验和（恢复依据）。 *)
BackupIntegrityInvariant ==
    \A b \in Backups :
        backupStatus[b] = BackupCompleted =>
            backupSha256[b] # "" /\ Len(backupSha256[b]) = 64

(* @designRef docs/system-design.md#§3.1 SD-001 公告状态机
 * 业务语义：公告状态机 pending → published → archived（REQ-001 数据约束）。
 *   publishedAt 为未来时间则 pending；定时发布由 setInterval 扫描触发。
 *   archived 公告不可恢复为 published（单向流转）。 *)
AnnouncementStatusInvariant ==
    /\ \A a \in Announcements :
        announcementRegistry[a] \in AnnouncementStates \cup {NonExistAnnouncement}
    /\ \A a \in Announcements :
        announcementRegistry[a] # NonExistAnnouncement =>
            announcementRegistry[a] \in AnnouncementStates

(* @designRef docs/system-design.md#§3.1 SD-017 备份调度合法性
 * 业务语义：backupSchedule 中的任务必须属于 Backups 全集（REQ-017 验收标准 1）。
 *   任务调度的状态流转：pending → running → completed/failed。
 *   GDPR 占位：用户数据删除请求，30 天后物理清除（REQ-017 验收标准 7）。 *)
BackupScheduleInvariant ==
    /\ backupSchedule \subseteq Backups
    /\ \A b \in backupSchedule :
        backupStatus[b] # NonExistBackup

(* ==================== BusinessInvariant 聚合 ==================== *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ SystemStateInvariant
    /\ BackupStatusInvariant
    /\ BackupIntegrityInvariant
    /\ AnnouncementStatusInvariant
    /\ BackupScheduleInvariant

(* ==================== 初始状态 ==================== *)
Init ==
    /\ systemState = RunningState
    /\ maintenanceMessage = ""
    /\ backupSchedule = {}
    /\ backupStatus = [b \in Backups |-> NonExistBackup]
    /\ backupSha256 = [b \in Backups |-> ""]
    /\ announcementRegistry = [a \in Announcements |-> NonExistAnnouncement]

(* ==================== 状态转移（Next） ==================== *)

(* SD-001 动作1：开启维护模式（管理员设置 maintenanceMessage） *)
EnterMaintenance(message) ==
    /\ message \in STRING
    /\ message # ""
    /\ systemState = RunningState
    /\ systemState' = MaintenanceState
    /\ maintenanceMessage' = message
    /\ UNCHANGED <<backupSchedule, backupStatus, backupSha256, announcementRegistry>>

(* SD-001 动作2：退出维护模式（恢复运行） *)
ExitMaintenance ==
    /\ systemState = MaintenanceState
    /\ systemState' = RunningState
    /\ maintenanceMessage' = ""
    /\ UNCHANGED <<backupSchedule, backupStatus, backupSha256, announcementRegistry>>

(* SD-001 动作3：创建公告（pending 状态） *)
CreateAnnouncement(announcement) ==
    /\ announcement \in Announcements
    /\ announcementRegistry[announcement] = NonExistAnnouncement
    /\ announcementRegistry' = [announcementRegistry EXCEPT ![announcement] = AnnouncementPending]
    /\ UNCHANGED <<systemState, maintenanceMessage, backupSchedule, backupStatus, backupSha256>>

(* SD-001 动作4：发布公告（pending → published） *)
PublishAnnouncement(announcement) ==
    /\ announcement \in Announcements
    /\ announcementRegistry[announcement] = AnnouncementPending
    /\ announcementRegistry' = [announcementRegistry EXCEPT ![announcement] = AnnouncementPublished]
    /\ UNCHANGED <<systemState, maintenanceMessage, backupSchedule, backupStatus, backupSha256>>

(* SD-001 动作5：归档公告（published → archived） *)
ArchiveAnnouncement(announcement) ==
    /\ announcement \in Announcements
    /\ announcementRegistry[announcement] = AnnouncementPublished
    /\ announcementRegistry' = [announcementRegistry EXCEPT ![announcement] = AnnouncementArchived]
    /\ UNCHANGED <<systemState, maintenanceMessage, backupSchedule, backupStatus, backupSha256>>

(* SD-017 动作6：调度备份任务（pending 状态入队） *)
ScheduleBackup(backup) ==
    /\ backup \in Backups
    /\ backupStatus[backup] = NonExistBackup
    /\ backup \notin backupSchedule
    /\ backupSchedule' = backupSchedule \cup {backup}
    /\ backupStatus' = [backupStatus EXCEPT ![backup] = BackupPending]
    /\ UNCHANGED <<systemState, maintenanceMessage, backupSha256, announcementRegistry>>

(* SD-017 动作7：开始备份（pending → running） *)
StartBackup(backup) ==
    /\ backup \in Backups
    /\ backupStatus[backup] = BackupPending
    /\ backupStatus' = [backupStatus EXCEPT ![backup] = BackupRunning]
    /\ UNCHANGED <<systemState, maintenanceMessage, backupSchedule, backupSha256, announcementRegistry>>

(* SD-017 动作8：完成备份（running → completed，写入 sha256 校验和） *)
CompleteBackup(backup, sha256) ==
    /\ backup \in Backups
    /\ backupStatus[backup] = BackupRunning
    /\ sha256 \in STRING
    /\ Len(sha256) = 64
    /\ backupStatus' = [backupStatus EXCEPT ![backup] = BackupCompleted]
    /\ backupSha256' = [backupSha256 EXCEPT ![backup] = sha256]
    /\ UNCHANGED <<systemState, maintenanceMessage, backupSchedule, announcementRegistry>>

(* SD-017 动作9：备份失败（running → failed） *)
FailBackup(backup) ==
    /\ backup \in Backups
    /\ backupStatus[backup] = BackupRunning
    /\ backupStatus' = [backupStatus EXCEPT ![backup] = BackupFailed]
    /\ UNCHANGED <<systemState, maintenanceMessage, backupSchedule, backupSha256, announcementRegistry>>

(* SD-017 动作10：恢复备份（校验 sha256 一致性，不一致失败） *)
RestoreBackup(backup, expectedSha256) ==
    /\ backup \in Backups
    /\ backupStatus[backup] = BackupCompleted
    /\ expectedSha256 \in STRING
    /\ backupSha256[backup] = expectedSha256
    /\ UNCHANGED <<systemState, maintenanceMessage, backupSchedule, backupStatus, backupSha256, announcementRegistry>>

(* Next：联合运营支撑域所有动作 *)
Next ==
    \/ \E m \in STRING : EnterMaintenance(m)
    \/ ExitMaintenance
    \/ \E a \in Announcements : CreateAnnouncement(a)
    \/ \E a \in Announcements : PublishAnnouncement(a)
    \/ \E a \in Announcements : ArchiveAnnouncement(a)
    \/ \E b \in Backups : ScheduleBackup(b)
    \/ \E b \in Backups : StartBackup(b)
    \/ \E b \in Backups, s \in STRING : CompleteBackup(b, s)
    \/ \E b \in Backups : FailBackup(b)
    \/ \E b \in Backups, s \in STRING : RestoreBackup(b, s)

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数分析（按 .cfg 常量赋值数计算，tla-plus-guide.md §1.1）：
 *   3 个常量：Backups / Users / Announcements
 *   .cfg 中每个常量赋 2 个值 → 变量组合数 = 2^3 = 8
 *   8 < 1000 → kept-below-threshold（保留不拆）
 * decompositionDecision: "kept-below-threshold"
 *)
================
