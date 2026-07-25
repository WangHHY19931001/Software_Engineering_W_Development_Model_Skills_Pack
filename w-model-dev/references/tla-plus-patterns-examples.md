# TLA+ Patterns and Examples（W 模型适配版）

> 本文件为 TLA+ 典型示例库，提供 S-tla 子代理在 SD/DD 阶段按子系统类型选模板用的可复用模式集合。

## 来源说明

- **吸收自**：claude-tla-plus-plugin `skills/tla-plus-generator/patterns-examples.md`（第 11 轮外部技能吸收）。
- **原始来源仓库**：`andrueandersoncs/claude-tla-plus-plugin`（GitHub，commit `60646ae8a549921a58aec0f853e40a9dc53f3fb3`）。
- **内容范围**：8 个完整 `.tla` 示例 + 末尾"Common Specification Patterns Summary"。
- **变更类型**：仅作 W 模型适配（每示例补文件头注释、补示例索引表、补交叉引用），未改动任何 `.tla` 规格体。

## W 模型适配说明

1. **文件头注释**：每个示例在 MODULE 行后插入 `@level` / `@sd` / `@parent` / `@sibling` / `@child` / 来源六行注释，遵循 `tla-plus-guide.md` §2.1 路径解析基准与"文件头规范（强制）"节定义的 8 个 `@` 字段子集。
2. **占位符语义**：所有 `@sd` / `@parent` / `@sibling` / `@child` 标识均为**示例占位符**，按示例语义命名（如 Bakery → `SD-bakery-mutex`）。实际使用时由 **S-tla 子代理**按目标子系统的真实 RTM/结构层图谱标识回填，不可直接套用。
3. **层级映射**：`@level` 按示例语义映射，固定为下表取值：
   - **L2**（系统级状态机/事务/共识/分布式算法）：示例 1、4、7、8。
   - **L3**（多进程并发/互斥/协调/经典同步问题）：示例 2、3、5、6。
4. **代码块原样保留**：示例 `.tla` 体从来源完整复制，保持缩进、空行、注释与 `=====` 终止符原样；仅在 MODULE 行后插入文件头注释块。

## 加载时机

- **触发者**：S-tla 子代理。
- **触发场景**：在「按 SD 子系统类型选模板」步骤中，根据目标子系统的场景语义按需加载对应示例作为骨架模板。
- **场景映射建议**（非穷举，S-tla 可按需扩展）：
  | 目标子系统场景 | 推荐加载示例 |
  |---|---|
  | 键值存储 / 事务快照隔离 | 示例 1（Key-Value Store） |
  | 互斥 / 锁协议 | 示例 2（Bakery Algorithm） |
  | 有界缓冲 / 生产者-消费者 | 示例 3（Producer-Consumer） |
  | 分布式生成树 / 网络泛洪 | 示例 4（Echo Algorithm） |
  | 多智能体协调 / 调度 | 示例 5（Elevator System） |
  | 经典同步问题 / 资源分配 | 示例 6（Cigarette Smokers） |
  | 共识 / 法定人数投票 | 示例 7（Consensus Protocol） |
  | 分布式事务提交 / 两阶段提交 | 示例 8（Two-Phase Commit） |
- **回填职责**：S-tla 选定模板后，将占位 `@sd/@parent/@sibling/@child` 替换为真实标识，并将 MODULE 名改为符合 §2.0 命名规范的目标模块名。

## 示例索引

| # | 示例 | 层级 | 典型场景 | W 模型阶段 |
|---|---|---|---|---|
| 1 | Key-Value Store | L2 | 状态机 + 事务 | 阶段 2-3 |
| 2 | Bakery Algorithm | L3 | 互斥 | 阶段 3-4 |
| 3 | Producer-Consumer | L3 | 并发同步 | 阶段 3-4 |
| 4 | Echo Algorithm | L2 | 分布式生成树 | 阶段 2 |
| 5 | Elevator System | L3 | 多智能体协调 | 阶段 3-4 |
| 6 | Cigarette Smokers | L3 | 经典同步问题 | 阶段 3-4 |
| 7 | Consensus Protocol | L2 | 共识 | 阶段 2 |
| 8 | Two-Phase Commit | L2 | 分布式事务 | 阶段 2 |

---

## Example 1: Key-Value Store with Snapshot Isolation

A concurrent key-value store with transactional semantics:

```tla
--------------------------- MODULE KeyValueStore ---------------------------
\* @level L2
\* @sd SD-kv-store（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-kv-store
\* @sibling SD-tx-manager
\* @child DD-kv-get, DD-kv-put
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md（第 11 轮）
CONSTANTS   Key,            \* The set of all keys
            Val,            \* The set of all values
            TxId            \* The set of all transaction IDs
VARIABLES   store,          \* Data store mapping keys to values
            tx,             \* Set of open snapshot transactions
            snapshotStore,  \* Snapshots of store for each transaction
            written,        \* Log of writes within each transaction
            missed          \* Writes invisible to each transaction
----------------------------------------------------------------------------
NoVal == CHOOSE v : v \notin Val
Store == [Key -> Val \cup {NoVal}]
Init ==
    /\ store = [k \in Key |-> NoVal]
    /\ tx = {}
    /\ snapshotStore = [t \in TxId |-> [k \in Key |-> NoVal]]
    /\ written = [t \in TxId |-> {}]
    /\ missed = [t \in TxId |-> {}]
TypeInvariant ==
    /\ store \in Store
    /\ tx \subseteq TxId
    /\ snapshotStore \in [TxId -> Store]
    /\ written \in [TxId -> SUBSET Key]
    /\ missed \in [TxId -> SUBSET Key]
OpenTx(t) ==
    /\ t \notin tx
    /\ tx' = tx \cup {t}
    /\ snapshotStore' = [snapshotStore EXCEPT ![t] = store]
    /\ UNCHANGED <<written, missed, store>>
Add(t, k, v) ==
    /\ t \in tx
    /\ snapshotStore[t][k] = NoVal
    /\ snapshotStore' = [snapshotStore EXCEPT ![t][k] = v]
    /\ written' = [written EXCEPT ![t] = @ \cup {k}]
    /\ UNCHANGED <<tx, missed, store>>
CloseTx(t) ==
    /\ t \in tx
    /\ missed[t] \cap written[t] = {}   \* No write-write conflicts
    /\ store' = [k \in Key |->
        IF k \in written[t] THEN snapshotStore[t][k] ELSE store[k]]
    /\ tx' = tx \ {t}
    /\ missed' = [otherTx \in TxId |->
        IF otherTx \in tx' THEN missed[otherTx] \cup written[t] ELSE {}]
    /\ snapshotStore' = [snapshotStore EXCEPT ![t] = [k \in Key |-> NoVal]]
    /\ written' = [written EXCEPT ![t] = {}]
Next ==
    \/ \E t \in TxId : OpenTx(t)
    \/ \E t \in tx : \E k \in Key : \E v \in Val : Add(t, k, v)
    \/ \E t \in tx : CloseTx(t)
Spec == Init /\ [][Next]_<<store, tx, snapshotStore, written, missed>>
=============================================================================
```

## Example 2: Mutual Exclusion (Bakery Algorithm)

Lamport's bakery algorithm for mutual exclusion:

```tla
---------------------------- MODULE Bakery ----------------------------
\* @level L3
\* @sd SD-bakery-mutex（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-mutex
\* @sibling SD-peterson-lock
\* @child DD-bakery-entry, DD-bakery-exit
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md（第 11 轮）
EXTENDS Naturals
CONSTANT N
ASSUME N \in Nat
Procs == 1..N
\* Lexicographic ordering on pairs
a \prec b == \/ a[1] < b[1]
             \/ (a[1] = b[1]) /\ (a[2] < b[2])
VARIABLES num, flag, pc
vars == <<num, flag, pc>>
Init ==
    /\ num = [i \in Procs |-> 0]
    /\ flag = [i \in Procs |-> FALSE]
    /\ pc = [i \in Procs |-> "ncs"]
\* Non-critical section
ncs(self) ==
    /\ pc[self] = "ncs"
    /\ pc' = [pc EXCEPT ![self] = "e1"]
    /\ UNCHANGED <<num, flag>>
\* Entry protocol: set flag and get ticket number
e1(self) ==
    /\ pc[self] = "e1"
    /\ flag' = [flag EXCEPT ![self] = TRUE]
    /\ num' = [num EXCEPT ![self] =
        1 + CHOOSE m \in Nat : \A i \in Procs : num[i] <= m]
    /\ pc' = [pc EXCEPT ![self] = "e2"]
\* Entry protocol: clear flag
e2(self) ==
    /\ pc[self] = "e2"
    /\ flag' = [flag EXCEPT ![self] = FALSE]
    /\ pc' = [pc EXCEPT ![self] = "w1"]
    /\ UNCHANGED num
\* Wait for others with lower numbers
w1(self) ==
    /\ pc[self] = "w1"
    /\ \A j \in Procs \ {self} :
        \/ num[j] = 0
        \/ <<num[self], self>> \prec <<num[j], j>>
    /\ pc' = [pc EXCEPT ![self] = "cs"]
    /\ UNCHANGED <<num, flag>>
\* Critical section
cs(self) ==
    /\ pc[self] = "cs"
    /\ pc' = [pc EXCEPT ![self] = "exit"]
    /\ UNCHANGED <<num, flag>>
\* Exit: reset number
exit(self) ==
    /\ pc[self] = "exit"
    /\ num' = [num EXCEPT ![self] = 0]
    /\ pc' = [pc EXCEPT ![self] = "ncs"]
    /\ UNCHANGED flag
p(self) == ncs(self) \/ e1(self) \/ e2(self) \/ w1(self) \/ cs(self) \/ exit(self)
Next == \E self \in Procs : p(self)
Spec == Init /\ [][Next]_vars /\ \A self \in Procs : WF_vars(p(self))
\* Safety: mutual exclusion
MutualExclusion == \A i, j \in Procs :
    (i /= j) => ~(pc[i] = "cs" /\ pc[j] = "cs")
\* Liveness: starvation freedom
StarvationFree == \A i \in Procs : pc[i] = "e1" ~> pc[i] = "cs"
TypeOK ==
    /\ num \in [Procs -> Nat]
    /\ flag \in [Procs -> BOOLEAN]
    /\ pc \in [Procs -> {"ncs", "e1", "e2", "w1", "cs", "exit"}]
=============================================================================
```

## Example 3: Producer-Consumer with Bounded Buffer

```tla
------------------------ MODULE ProducerConsumer ------------------------
\* @level L3
\* @sd SD-prod-cons-buffer（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-bounded-buffer
\* @sibling SD-readers-writers
\* @child DD-produce, DD-consume
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md（第 11 轮）
EXTENDS Naturals, Sequences
CONSTANTS Producers, Consumers, BufferSize, Data
VARIABLES buffer, prodState, consState
vars == <<buffer, prodState, consState>>
TypeInvariant ==
    /\ buffer \in Seq(Data)
    /\ Len(buffer) <= BufferSize
    /\ prodState \in [Producers -> {"idle", "producing"}]
    /\ consState \in [Consumers -> {"idle", "consuming"}]
Init ==
    /\ buffer = <<>>
    /\ prodState = [p \in Producers |-> "idle"]
    /\ consState = [c \in Consumers |-> "idle"]
Produce(p, d) ==
    /\ prodState[p] = "idle"
    /\ Len(buffer) < BufferSize
    /\ buffer' = Append(buffer, d)
    /\ prodState' = [prodState EXCEPT ![p] = "producing"]
    /\ UNCHANGED consState
FinishProducing(p) ==
    /\ prodState[p] = "producing"
    /\ prodState' = [prodState EXCEPT ![p] = "idle"]
    /\ UNCHANGED <<buffer, consState>>
Consume(c) ==
    /\ consState[c] = "idle"
    /\ Len(buffer) > 0
    /\ buffer' = Tail(buffer)
    /\ consState' = [consState EXCEPT ![c] = "consuming"]
    /\ UNCHANGED prodState
FinishConsuming(c) ==
    /\ consState[c] = "consuming"
    /\ consState' = [consState EXCEPT ![c] = "idle"]
    /\ UNCHANGED <<buffer, prodState>>
Next ==
    \/ \E p \in Producers, d \in Data : Produce(p, d)
    \/ \E p \in Producers : FinishProducing(p)
    \/ \E c \in Consumers : Consume(c)
    \/ \E c \in Consumers : FinishConsuming(c)
Spec == Init /\ [][Next]_vars
FairSpec == Spec
    /\ \A p \in Producers : WF_vars(\E d \in Data : Produce(p, d))
    /\ \A c \in Consumers : WF_vars(Consume(c))
\* Safety: buffer never overflows or underflows
BufferSafety == Len(buffer) >= 0 /\ Len(buffer) <= BufferSize
\* Liveness: items eventually get consumed
Progress == \A d \in Data :
    (d \in {buffer[i] : i \in 1..Len(buffer)}) ~>
    (d \notin {buffer[i] : i \in 1..Len(buffer)})
=============================================================================
```

## Example 4: Distributed Spanning Tree (Echo Algorithm)

```tla
-------------------------------- MODULE Echo --------------------------------
\* @level L2
\* @sd SD-echo-spanning-tree（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-spanning-tree
\* @sibling SD-flooding
\* @child DD-echo-init, DD-echo-receive
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md（第 11 轮）
EXTENDS Naturals, FiniteSets
CONSTANTS Node, initiator, R  \* R is adjacency relation
ASSUME /\ initiator \in Node
       /\ R \in [Node \X Node -> BOOLEAN]
NoNode == CHOOSE x : x \notin Node
neighbors(n) == {m \in Node : R[m, n]}
VARIABLES inbox, parent, children, rcvd
vars == <<inbox, parent, children, rcvd>>
\* Network operations
send(net, p, q, knd) == [net EXCEPT ![q] = @ \cup {[kind |-> knd, sndr |-> p]}]
receive(net, p, msg) == [net EXCEPT ![p] = @ \ {msg}]
multicast(net, p, dest, knd) ==
    [m \in Node |-> IF m \in dest
                    THEN net[m] \cup {[kind |-> knd, sndr |-> p]}
                    ELSE net[m]]
Init ==
    /\ inbox = [n \in Node |-> {}]
    /\ parent = [n \in Node |-> NoNode]
    /\ children = [n \in Node |-> {}]
    /\ rcvd = [n \in Node |-> 0]
\* Initiator starts the algorithm
InitiatorStart ==
    /\ rcvd[initiator] = 0
    /\ inbox' = multicast(inbox, initiator, neighbors(initiator), "m")
    /\ rcvd' = [rcvd EXCEPT ![initiator] = Cardinality(neighbors(initiator))]
    /\ UNCHANGED <<parent, children>>
\* Non-initiator receives first message
FirstReceive(n) ==
    /\ n /= initiator
    /\ rcvd[n] = 0
    /\ \E msg \in inbox[n] :
        /\ msg.kind = "m"
        /\ parent' = [parent EXCEPT ![n] = msg.sndr]
        /\ inbox' = multicast(receive(inbox, n, msg), n,
                              neighbors(n) \ {msg.sndr}, "m")
        /\ rcvd' = [rcvd EXCEPT ![n] = 1]
    /\ UNCHANGED children
\* Receive subsequent messages
SubsequentReceive(n) ==
    /\ rcvd[n] > 0
    /\ rcvd[n] < Cardinality(neighbors(n))
    /\ \E msg \in inbox[n] :
        /\ inbox' = receive(inbox, n, msg)
        /\ rcvd' = [rcvd EXCEPT ![n] = @ + 1]
        /\ IF msg.kind = "c"
           THEN children' = [children EXCEPT ![n] = @ \cup {msg.sndr}]
           ELSE UNCHANGED children
    /\ UNCHANGED parent
\* Send acknowledgment to parent
SendAck(n) ==
    /\ n /= initiator
    /\ rcvd[n] = Cardinality(neighbors(n))
    /\ parent[n] /= NoNode
    /\ inbox' = send(inbox, n, parent[n], "c")
    /\ parent' = [parent EXCEPT ![n] = NoNode]  \* Mark as done
    /\ UNCHANGED <<children, rcvd>>
Next ==
    \/ InitiatorStart
    \/ \E n \in Node : FirstReceive(n)
    \/ \E n \in Node : SubsequentReceive(n)
    \/ \E n \in Node : SendAck(n)
Spec == Init /\ [][Next]_vars
\* The initiator never has a parent
InitiatorNoParent == parent[initiator] = NoNode
\* At termination, initiator has all children in spanning tree
SpanningTree ==
    (\A n \in Node : rcvd[n] = Cardinality(neighbors(n))) =>
    \A n \in Node \ {initiator} :
        \E path \in Seq(Node) :
            /\ path[1] = n
            /\ path[Len(path)] = initiator
=============================================================================
```

## Example 5: Multi-Car Elevator System

```tla
------------------------------ MODULE Elevator ------------------------------
\* @level L3
\* @sd SD-elevator-coord（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-elevator
\* @sibling SD-scheduler
\* @child DD-call-elevator, DD-move-elevator
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md（第 11 轮）
EXTENDS Integers
CONSTANTS Person, Elevator, FloorCount
VARIABLES PersonState, ActiveElevatorCalls, ElevatorState
Vars == <<PersonState, ActiveElevatorCalls, ElevatorState>>
Floor == 1..FloorCount
Direction == {"Up", "Down"}
ElevatorCall == [floor : Floor, direction : Direction]
ElevatorDirectionState == Direction \cup {"Stationary"}
GetDirection[current, destination \in Floor] ==
    IF destination > current THEN "Up" ELSE "Down"
GetDistance[f1, f2 \in Floor] ==
    IF f1 > f2 THEN f1 - f2 ELSE f2 - f1
CanServiceCall[e \in Elevator, c \in ElevatorCall] ==
    LET eState == ElevatorState[e] IN
    /\ c.floor = eState.floor
    /\ c.direction = eState.direction
TypeInvariant ==
    /\ PersonState \in [Person -> [location : Floor \cup Elevator,
                                   destination : Floor,
                                   waiting : BOOLEAN]]
    /\ ActiveElevatorCalls \subseteq ElevatorCall
    /\ ElevatorState \in [Elevator -> [floor : Floor,
                                       direction : ElevatorDirectionState,
                                       doorsOpen : BOOLEAN,
                                       buttonsPressed : SUBSET Floor]]
Init ==
    /\ PersonState \in [Person -> [location : Floor,
                                   destination : Floor,
                                   waiting : {FALSE}]]
    /\ ActiveElevatorCalls = {}
    /\ ElevatorState \in [Elevator -> [floor : Floor,
                                       direction : {"Stationary"},
                                       doorsOpen : {FALSE},
                                       buttonsPressed : {{}}]]
CallElevator(p) ==
    LET
        pState == PersonState[p]
        call == [floor |-> pState.location,
                 direction |-> GetDirection[pState.location, pState.destination]]
    IN
    /\ ~pState.waiting
    /\ pState.location /= pState.destination
    /\ pState.location \in Floor
    /\ ActiveElevatorCalls' = ActiveElevatorCalls \cup {call}
    /\ PersonState' = [PersonState EXCEPT ![p] = [@ EXCEPT !.waiting = TRUE]]
    /\ UNCHANGED ElevatorState
OpenDoors(e) ==
    LET eState == ElevatorState[e] IN
    /\ ~eState.doorsOpen
    /\ \/ \E call \in ActiveElevatorCalls : CanServiceCall[e, call]
       \/ eState.floor \in eState.buttonsPressed
    /\ ElevatorState' = [ElevatorState EXCEPT ![e] =
        [@ EXCEPT !.doorsOpen = TRUE,
                  !.buttonsPressed = @ \ {eState.floor}]]
    /\ ActiveElevatorCalls' = ActiveElevatorCalls \
        {[floor |-> eState.floor, direction |-> eState.direction]}
    /\ UNCHANGED PersonState
MoveElevator(e) ==
    LET
        eState == ElevatorState[e]
        nextFloor == IF eState.direction = "Up"
                     THEN eState.floor + 1
                     ELSE eState.floor - 1
    IN
    /\ eState.direction /= "Stationary"
    /\ ~eState.doorsOpen
    /\ nextFloor \in Floor
    /\ ElevatorState' = [ElevatorState EXCEPT ![e] =
        [@ EXCEPT !.floor = nextFloor]]
    /\ UNCHANGED <<PersonState, ActiveElevatorCalls>>
Next ==
    \/ \E p \in Person : CallElevator(p)
    \/ \E e \in Elevator : OpenDoors(e)
    \/ \E e \in Elevator : MoveElevator(e)
Spec == Init /\ [][Next]_Vars
\* Safety: elevator doors only open at valid floors
DoorsOpenAtValidFloor ==
    \A e \in Elevator : ElevatorState[e].doorsOpen =>
        ElevatorState[e].floor \in Floor
\* Liveness: every call eventually serviced
CallsServiced == \A c \in ElevatorCall :
    c \in ActiveElevatorCalls ~> \E e \in Elevator : CanServiceCall[e, c]
=============================================================================
```

## Example 6: Cigarette Smokers Problem

Classic synchronization problem:

```tla
-------------------------- MODULE CigaretteSmokers --------------------------
\* @level L3
\* @sd SD-smokers-sync（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-sync
\* @sibling SD-dining-philosophers
\* @child DD-start-smoking, DD-stop-smoking
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md（第 11 轮）
EXTENDS Integers, FiniteSets
CONSTANT Ingredients, Offers
VARIABLE smokers, dealer
ASSUME /\ Offers \subseteq (SUBSET Ingredients)
       /\ \A n \in Offers : Cardinality(n) = Cardinality(Ingredients) - 1
TypeOK ==
    /\ smokers \in [Ingredients -> [smoking: BOOLEAN]]
    /\ dealer \in Offers \/ dealer = {}
vars == <<smokers, dealer>>
ChooseOne(S, P(_)) == CHOOSE x \in S : P(x) /\ \A y \in S : P(y) => y = x
Init ==
    /\ smokers = [r \in Ingredients |-> [smoking |-> FALSE]]
    /\ dealer \in Offers
startSmoking ==
    /\ dealer /= {}
    /\ smokers' = [r \in Ingredients |->
        [smoking |-> {r} \cup dealer = Ingredients]]
    /\ dealer' = {}
stopSmoking ==
    /\ dealer = {}
    /\ LET r == ChooseOne(Ingredients, LAMBDA x : smokers[x].smoking)
       IN smokers' = [smokers EXCEPT ![r].smoking = FALSE]
    /\ dealer' \in Offers
Next == startSmoking \/ stopSmoking
Spec == Init /\ [][Next]_vars
FairSpec == Spec /\ WF_vars(Next)
\* At most one smoker at a time
AtMostOne == Cardinality({r \in Ingredients : smokers[r].smoking}) <= 1
=============================================================================
```

## Example 7: Simple Consensus Protocol

```tla
---------------------------- MODULE Consensus ----------------------------
\* @level L2
\* @sd SD-consensus（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-consensus
\* @sibling SD-paxos
\* @child DD-vote, DD-decide
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md（第 11 轮）
EXTENDS Naturals, FiniteSets
CONSTANTS Value, Acceptor, Quorum
ASSUME /\ \A Q \in Quorum : Q \subseteq Acceptor
       /\ \A Q1, Q2 \in Quorum : Q1 \cap Q2 /= {}
VARIABLES votes, decision
vars == <<votes, decision>>
TypeOK ==
    /\ votes \in [Acceptor -> SUBSET Value]
    /\ decision \in SUBSET Value
Init ==
    /\ votes = [a \in Acceptor |-> {}]
    /\ decision = {}
Vote(a, v) ==
    /\ votes[a] = {}  \* Each acceptor votes once
    /\ votes' = [votes EXCEPT ![a] = {v}]
    /\ UNCHANGED decision
Decide(v) ==
    /\ v \notin decision
    /\ \E Q \in Quorum : \A a \in Q : v \in votes[a]
    /\ decision' = decision \cup {v}
    /\ UNCHANGED votes
Next ==
    \/ \E a \in Acceptor, v \in Value : Vote(a, v)
    \/ \E v \in Value : Decide(v)
Spec == Init /\ [][Next]_vars
\* Agreement: at most one value decided
Agreement == Cardinality(decision) <= 1
\* Validity: only proposed values can be decided
Validity == decision \subseteq Value
=============================================================================
```

## Example 8: Two-Phase Commit

```tla
--------------------------- MODULE TwoPhaseCommit ---------------------------
\* @level L2
\* @sd SD-two-phase-commit（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-transaction-commit
\* @sibling SD-3pc
\* @child DD-prepare, DD-commit
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md（第 11 轮）
EXTENDS Naturals
CONSTANTS RM  \* Set of resource managers
VARIABLES rmState, tmState, tmPrepared, msgs
vars == <<rmState, tmState, tmPrepared, msgs>>
Message == [type : {"Prepared", "Commit", "Abort"}]
TypeOK ==
    /\ rmState \in [RM -> {"working", "prepared", "committed", "aborted"}]
    /\ tmState \in {"init", "committed", "aborted"}
    /\ tmPrepared \subseteq RM
    /\ msgs \subseteq Message
Init ==
    /\ rmState = [r \in RM |-> "working"]
    /\ tmState = "init"
    /\ tmPrepared = {}
    /\ msgs = {}
\* RM sends Prepared message
RMPrepare(r) ==
    /\ rmState[r] = "working"
    /\ rmState' = [rmState EXCEPT ![r] = "prepared"]
    /\ msgs' = msgs \cup {[type |-> "Prepared"]}
    /\ UNCHANGED <<tmState, tmPrepared>>
\* TM receives Prepared from RM
TMRcvPrepared(r) ==
    /\ tmState = "init"
    /\ [type |-> "Prepared"] \in msgs
    /\ tmPrepared' = tmPrepared \cup {r}
    /\ UNCHANGED <<rmState, tmState, msgs>>
\* TM commits when all RMs prepared
TMCommit ==
    /\ tmState = "init"
    /\ tmPrepared = RM
    /\ tmState' = "committed"
    /\ msgs' = msgs \cup {[type |-> "Commit"]}
    /\ UNCHANGED <<rmState, tmPrepared>>
\* TM aborts
TMAbort ==
    /\ tmState = "init"
    /\ tmState' = "aborted"
    /\ msgs' = msgs \cup {[type |-> "Abort"]}
    /\ UNCHANGED <<rmState, tmPrepared>>
\* RM commits upon receiving Commit
RMRcvCommit(r) ==
    /\ rmState[r] = "prepared"
    /\ [type |-> "Commit"] \in msgs
    /\ rmState' = [rmState EXCEPT ![r] = "committed"]
    /\ UNCHANGED <<tmState, tmPrepared, msgs>>
\* RM aborts upon receiving Abort
RMRcvAbort(r) ==
    /\ rmState[r] \in {"working", "prepared"}
    /\ [type |-> "Abort"] \in msgs
    /\ rmState' = [rmState EXCEPT ![r] = "aborted"]
    /\ UNCHANGED <<tmState, tmPrepared, msgs>>
Next ==
    \/ \E r \in RM : RMPrepare(r)
    \/ \E r \in RM : TMRcvPrepared(r)
    \/ TMCommit
    \/ TMAbort
    \/ \E r \in RM : RMRcvCommit(r)
    \/ \E r \in RM : RMRcvAbort(r)
Spec == Init /\ [][Next]_vars
\* Consistency: all RMs reach same decision
Consistency ==
    /\ \A r1, r2 \in RM : ~(rmState[r1] = "committed" /\ rmState[r2] = "aborted")
    /\ (tmState = "committed") => (\A r \in RM : rmState[r] /= "aborted")
    /\ (tmState = "aborted") => (\A r \in RM : rmState[r] /= "committed")
=============================================================================
```

## Common Specification Patterns Summary

1. **State Machine**: Define states, transitions, and invariants
2. **Concurrent Processes**: Use process IDs as indices into state arrays
3. **Message Passing**: Model channels as sets/sequences of messages
4. **Transactions**: Snapshot isolation with conflict detection
5. **Mutual Exclusion**: Entry/exit protocols with safety properties
6. **Producer-Consumer**: Bounded buffers with blocking
7. **Consensus**: Quorum-based voting
8. **Two-Phase Commit**: Coordinator-participant protocols

---

## W 模型交叉引用

本文件作为 TLA+ 参考体系的示例库，与以下参考文件协同使用：

- **`tla-plus-guide.md`**（主纲）
  - **§2.0 命名规范**：S-tla 选定模板后改 MODULE 名时须遵守（无连字符/中文/特殊符号，文件名与 MODULE 名一致）。
  - **§2.1 路径解析基准 + 「文件头规范（强制）」节**：本文件每示例的 `@level`/`@sd`/`@parent`/`@sibling`/`@child` 字段语义与回填规则依据；`@parent`/`@sibling`/`@child` 相对 `.tla` 文件所在目录解析。
  - **§3 SD 覆盖率校验（全规格强制，无例外）**：本文件提供的 SD 模板最终须落入 SD 覆盖率统计；占位符 `@sd` 回填后即计入 `--graph` 提取的 SD 节点。
  - **§10 SD 覆盖率规则**：缺陷对照 D10（11 个子系统但仅 3 个 spec）的检出依据；本示例库旨在降低该缺陷复发率，提供可复用 SD 骨架。
- **`tla-plus-syntax-reference.md`**：示例中 `EXTENDS`、`CHOOSE`、`EXCEPT`、`[][Next]_vars`、`WF_vars`、`~>` 等语法语义查证来源。
- **`tla-plus-tlc-configuration.md`**：示例 TLC 验证（`Spec`、`FairSpec`、不变式 `TypeInvariant`/`Agreement`/`Consistency` 等）的 `INIT`/`NEXT`/`INVARIANT`/`PROPERTIES` 配置规则。
- **`tla-plus-review-checklist.md`**：S-tla 回填占位符后、提交门禁前的自检清单（文件头 8 字段齐全、与 manifest 一致、SANY 通过、TLC 通过）。

> **回填流程**：S-tla 子代理按子系统场景从「示例索引」或「加载时机」表选定模板 → 复制对应 `.tla` 块 → 将 `@sd/@parent/@sibling/@child` 占位符替换为真实标识 → 改 MODULE 名 → 按 `tla-plus-syntax-reference.md` 校验语法 → 按 `tla-plus-tlc-configuration.md` 配置 TLC → 按 `tla-plus-review-checklist.md` 自检 → 提交 §3/§10 覆盖率门禁。
