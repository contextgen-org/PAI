# Trigger Processor 运行手册（V1 合同冻结）

本文适用于 Trigger Processor V1 的值班、故障定位与恢复演练。PostgreSQL 是 Trigger、TriggerProcess、foreground slot、snapshot metadata、work item、inbox/outbox 和 transition audit 的唯一事实源；Redis 与进程内 SSE 连接只用于传输和加速，不能用于回填或改写 owner 事实。

## 1. 不变量与操作边界

- 同一 `bot_id` 最多有一个 `bot_foreground_slots` owner。slot transfer 必须由 owner writer 在同一事务内 compare-and-set，禁止手工 delete/insert。
- Trigger 接受必须在一个事务中形成 canonical trigger、process、admission audit 和所需 outbox；重复请求只 replay 第一次持久化结果。
- Runtime callback 的 `source_event_id`、source sequence、run/attempt/fence、payload hash 与 scope 必须由 owner writer复核。全局 `append_sequence_no` 只能由 PostgreSQL 分配。
- Process 终态不可迁出；cancel、complete 与 preempt 的胜者必须有 transition evidence，不能靠运维直接改 `phase/status`。
- Snapshot manifest、metadata、overflow refs、hash、retention 与 redaction 必须一致。Snapshot resolve 不得降级读取 latest 或返回部分区间。
- Work item 与 outbox 都是至少一次执行。只有带 `claim_token/lease_generation` 的 fenced ACK 才能提交结果；commit 后断连视为结果不确定，禁止改发另一个 outcome。
- 所有人工操作默认只读。恢复动作必须调用版本固定的 SECURITY DEFINER owner writer 或部署的 worker；禁止对 owner table 直接 DML，禁止临时授权应用角色写表。

## 2. 启动与就绪

生产启动必须提供 `PAI_DATABASE_URL`。服务会先用 `TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1` 验证当前 PostgreSQL schema、列、复合外键、约束、函数 owner、SECURITY DEFINER/search_path、逐角色/PUBLIC EXECUTE 与函数行为，再开放 owner repository；验证失败必须阻止启动。

最低启动检查：

1. `/ready` 中 `owner_postgres` 为通过。
2. `eventing_transport_epochs` 当前 epoch 已激活，dispatcher/redriver 使用相同 epoch。
3. Trigger Process recovery runner 已注入真实 kind handler，并在服务启动后立即执行一次 claim；fake provider 只允许测试环境。
4. ObjectStore reconciliation worker 与 event dispatcher/redriver 独立存活。
5. 应用角色只有 manifest 声明的 SELECT 列和函数 EXECUTE，没有 owner table DML 权限。

生产 composition 固定启用 `require_complete_pipeline`。admission、process
control/observation、lifecycle、Context Snapshot owner read、Process Snapshot
owner read、Runtime Start reservation validation 或 recovery runner 任一缺失时，
`/ready` 必须返回 `503`；禁止用 caller payload、进程内状态或 fake provider
代替相邻 owner/ObjectStore adapter。

如果第 2～4 项无法由部署 readiness 自动证明，应保持实例不接流量，而不是以日志告警代替 gate。

## 3. 核心观测与告警

以下查询使用只读运维角色。时间比较必须使用数据库时钟。

### 3.1 Process backlog

```sql
SELECT phase, status, wait_reason, count(*) AS processes,
       min(updated_at) AS oldest_updated_at
FROM trigger_processor.trigger_processes
WHERE terminal_outcome_finalized_at IS NULL
GROUP BY phase, status, wait_reason
ORDER BY oldest_updated_at;
```

告警建议：同一 `phase/status/wait_reason` 的最老记录超过该阶段 deadline；`execution/preempt_requested`、`execution/cancelling` 或 `meta_enqueued/meta_enqueue_wait` 连续两个采样周期无推进；backlog 单调增长 10 分钟。

### 3.2 Work item 与 lease

```sql
SELECT work_kind, status, count(*) AS items,
       min(next_retry_at) AS earliest_retry,
       min(created_at) AS oldest_created_at
FROM trigger_processor.trigger_process_work_items
GROUP BY work_kind, status
ORDER BY work_kind, status;

SELECT id, trigger_process_id, work_kind, attempt_count,
       lease_owner, lease_generation, lease_until, updated_at
FROM trigger_processor.trigger_process_work_items
WHERE status = 'leased'
  AND lease_until <= clock_timestamp()
ORDER BY lease_until
LIMIT 200;
```

出现过期 lease 并不授权手工清锁。确认 recovery runner 存活后等待 DB claim writer 回收；持续存在时检查 DB 时钟、claim/ACK 错误与 handler 延迟。旧 token 或 generation 的 ACK 必须失败。

### 3.3 Event/command outbox

```sql
SELECT 'event' AS kind, status, target, count(*) AS rows,
       min(next_retry_at) AS earliest_retry, min(created_at) AS oldest_created_at
FROM trigger_processor.trigger_event_outbox
GROUP BY status, target
UNION ALL
SELECT 'command', status, target, count(*),
       min(next_retry_at), min(created_at)
FROM trigger_processor.trigger_command_outbox
GROUP BY status, target
ORDER BY kind, status, target;
```

告警建议：可投递 backlog 的最老年龄超过 60 秒；永久失败/DLQ 新增；sent transport reference probe 连续失败；dispatcher 使用的 transport epoch 与 owner active epoch 不一致。Redis 故障期间允许 PostgreSQL backlog 增长，但不得把 outbox 标为成功。

### 3.4 Foreground slot

```sql
SELECT s.bot_id, s.process_id, s.slot_generation,
       p.phase, p.status, p.updated_at
FROM trigger_processor.bot_foreground_slots AS s
LEFT JOIN trigger_processor.trigger_processes AS p ON p.id = s.process_id
WHERE p.id IS NULL
   OR p.terminal_outcome_finalized_at IS NOT NULL
   OR p.status NOT IN ('running', 'preempt_requested', 'cancelling');
```

任何结果都按 P1 处理：先停止该 bot 的新 admission，保留行和审计证据，核对最近 transition 与 writer 调用。只有 owner repair writer 能 release/transfer；不可手工删除 slot。

### 3.5 Snapshot、pending append 与 repair

```sql
SELECT status, count(*) AS rows, min(created_at) AS oldest_created_at
FROM trigger_processor.trigger_snapshot_pending_events
GROUP BY status;

SELECT status, repair_type, count(*) AS jobs,
       min(next_retry_at) AS earliest_retry, min(created_at) AS oldest_created_at
FROM trigger_processor.trigger_snapshot_repair_jobs
GROUP BY status, repair_type;

SELECT p.id, p.current_snapshot_id, c.last_append_sequence_no,
       s.snapshot_version, s.last_append_sequence_no AS snapshot_last
FROM trigger_processor.trigger_processes AS p
LEFT JOIN trigger_processor.trigger_snapshot_append_cursors AS c
  ON c.trigger_process_id = p.id
LEFT JOIN trigger_processor.trigger_process_snapshots AS s
  ON s.id = p.current_snapshot_id
WHERE p.current_snapshot_id IS NOT NULL
  AND (s.id IS NULL OR c.last_append_sequence_no <> s.last_append_sequence_no);
```

不要跳过缺口或伪造 snapshot hash。使用 `schedule_trigger_snapshot_repair_v1` 建立 durable repair，再由 fenced worker 收敛；repair 完成前 Snapshot resolve 必须 fail closed。

### 3.6 SSE replay

SSE `id` 是 `{trigger_process_id}:{append_sequence_no}`。客户端重连必须原样发送 `Last-Event-ID`；服务从 PostgreSQL projection 回放，并要求 sequence 严格连续。

- `cursor_ahead`：客户端游标超过当前 watermark，按客户端状态污染处理，不得回退到 latest。
- `replay_expired`：游标早于安全 replay cutoff，客户端改用 process detail/canonical snapshot 重新建立基线。
- `projection_contract_drift`：watermark 与 projection 存在不可解释缺口，停止该 process 的 SSE，检查 pending append/repair；不得静默跳号。
- 慢消费者由 socket backpressure 控制；写缓冲未 drain 时不继续读取下一页。单 bot 连接数达到上限返回 `rate_limited`。

## 4. 故障恢复流程

### 4.1 服务重启或 worker 崩溃

1. 保持 PostgreSQL 可用，不清理 leased rows。
2. 新实例 startup recovery 立即 claim；claim 只使用 DB `clock_timestamp()` 计算 lease。
3. handler 在租约安全余量前收到 abort；claim 往返已消耗预算时不启动副作用，等待 owner DB 到期后重新 claim。
4. ACK 必须携带原 `work_item_id + claim_token + lease_generation`。stale/no-op ACK 是失败，不可记成功。
5. 对 commit-then-disconnect 的 completed ACK 保持 outcome 不确定，按同一幂等身份核查 owner 事实；禁止转换成 `retry_wait`。

### 4.2 Redis 断开

1. Trigger/Process API 继续以 PostgreSQL 事实响应；Redis 不参与 admission、slot 或幂等判定。
2. dispatcher 保留/重试 outbox，不提前 ACK。
3. Redis 恢复后，先验证 transport epoch，再由 dispatcher/redriver 重放；consumer inbox 负责重复去重。
4. SSE 继续从 PostgreSQL projection catch-up；不得从 Redis 猜缺失 event。

### 4.3 Storage 成功、DB 失败

Context/Snapshot immutable put 使用“逻辑 attempt key + 内容 hash”的 content-addressed idempotency key、expected SHA-256 与固定 retention。同一份 canonical bytes 在数据库提交结果不确定时必须以完全相同的 key/hash/size 重试并 replay；若数据库明确回滚后 owner source 已推进，则新内容使用新的 hash 后缀，TP owner writer 仍以 process/context version 与 request hash 选择唯一 canonical ref，旧对象作为不可达 attempt 进入 reconciliation/GC，不能用原 key 覆盖。若 metadata finalization 失败，ObjectStore 必须保留 durable reconciliation work，不能 abort 已落盘 bytes。

对疑似 orphan：

1. 用 ObjectStore reconciliation claim/list 能力定位 pending reservation；不要仅凭 bucket listing 删除对象。
2. 核对 physical object hash、metadata reservation 与 TP durable ref。
3. 由 reconciliation worker 幂等 finalize 或安全清理；physical delete 失败时必须保留可追踪 metadata/work item。
4. TP 不直接修改 ObjectStore metadata。

### 4.4 Cancel / complete / preempt 竞态

核对 `trigger_process_transitions`、cancel request、runtime callback 与 foreground slot generation。合法结果只能是 owner 状态机允许的单一终态：

- complete 胜出 preempt 时必须带 `completion_won_preempt_race` 与对应 proof；
- preempt/cancel 胜出时 Runtime 必须回报 safe point/isolation proof；
- 迟到 callback 可写旧 run audit/artifact，但不能恢复 foreground ownership；
- 已终态 process 的重复命令只 replay，不产生第二次副作用。

无法由现有 evidence 唯一解释时暂停该 bot admission 并升级，不要人工选择一个终态写入。

## 5. 人工核查模板

查询单个 process 的完整证据链：

```sql
SELECT * FROM trigger_processor.trigger_processes WHERE id = $1;
SELECT * FROM trigger_processor.trigger_process_transitions
WHERE trigger_process_id = $1 ORDER BY created_at, id;
SELECT * FROM trigger_processor.trigger_process_cancel_requests
WHERE trigger_process_id = $1 ORDER BY created_at, id;
SELECT * FROM trigger_processor.runtime_start_reservations
WHERE trigger_process_id = $1 ORDER BY created_at, id;
SELECT * FROM trigger_processor.trigger_snapshot_append_audits
WHERE trigger_process_id = $1 ORDER BY append_sequence_no, created_at;
SELECT * FROM trigger_processor.trigger_process_work_items
WHERE trigger_process_id = $1 ORDER BY created_at, id;
```

若需要恢复，记录 incident id、process id、五元 scope、当前/期望版本、request hash、trace id 与证据 refs，通过经过部署验证的 owner writer 发起。任何 writer 返回 0 行、identity 漂移或 stale fence 都必须停止，不得扩大 selector 重试。

## 6. 发布前恢复验证

使用仓库锁定的 pnpm 版本，并连接一次性 PostgreSQL/Redis：

```bash
PAI_TEST_DATABASE_URL='postgresql://…' \
PAI_TEST_REDIS_URL='redis://…' \
corepack pnpm check
```

至少确认：

- 100 个相同并发 submit 只有一个 canonical trigger/process/outbox；同 key body drift 冲突。
- transaction rollback、outbox publish 前后崩溃、Redis 断开/恢复与 sent redrive 通过。
- cancel/complete/preempt、旧 slot generation、过期 work lease 与 ambiguous ACK 测试通过。
- SSE 重连、重复 event、cursor ahead/expired、projection gap 与 backpressure 测试通过。
- Context immutable put/DB failure replay、Snapshot full-range/hash/overflow/redaction 校验通过。
- fresh PostgreSQL introspection 与 commit/rollback/concurrency probes 无 skip。

## 7. Day 14 冻结接口与 fake provider 边界

冻结的 V1 下游合同包括 Runtime Start、Cancel/Preempt command、Runtime Event Append、Meta Job Create、Observation process/SSE、Context/Snapshot owner read。fake provider 必须：

- 只实现公开 V1 port，不读取 TP 表、Redis key 或共享 bucket path；
- 校验五元 scope、ref/version/hash、idempotency key、trace 与 fence；
- 能注入 timeout、commit-then-disconnect、重复、乱序、stale fence 和 schema drift；
- 不以 fixture 自报 manifest 代替真实 PostgreSQL deployment verification；
- 在未配置真实 provider 的生产环境阻止 readiness，不得回退到 fake。

新增字段只可遵守对应 owner catalog 的兼容规则；新增 event/command/purpose、改变 hash 规范、权限矩阵或状态语义必须按 owner contract 升版并同步 schema、OpenAPI/AsyncAPI、DB CHECK、fresh migration 与 fixtures。
