# Review 计划：docs/上下文漏斗沉淀分析_zcode reviewed.md

已用 3 个并行 Explore agent 将方案中全部事实断言逐条对照 `AIBase_with_example/package/ai-base` 源码核查完毕（含 backend 透传链路与引用的 TODO 文档）。review 文档内容如下：

## 文档结构（写入 docs/上下文漏斗沉淀分析_zcode reviewed.md）

### 0. 总评
- **方案通过，可作为实施蓝本**：三层正交漏斗框架（沉淀/注入/装填）成立；L0–L4 分层定义与 L3/L4 判据合理；演进顺序（装填纠偏优先）方向正确；「刻意不做」两条（不动 backend 网关、不逐条 LLM 摘要）均赞同。
- 但有 **2 处诊断需修正、9 项遗漏事实（其中约半数会影响落地设计）、演进步骤 1 需扩充为三件事**。

### 1. 事实核查表（逐条，含 file:line 证据）
方案断言全部核查，结论示例：
- ✅ contextBudget 120k/85%/slice(-12) + 英文 notice（contextBudget.ts:3-62）
- ✅ getContextUsagePercent 计 systemPrompt 而 compact 触发只看 history 的不对称（contextBudget.ts:23-30 vs 40）
- ✅ display 不进模型（normalizeToolResult.ts:308-318）；8000 字符预算 + 列表按条裁保留 total/hint（toolResultBudget.ts:35-78）
- ✅ 引用 JSON.stringify 整包进 user 文本（formatChatReferences.ts:3-20）
- ✅ plan 模块级单例、每个新 turn 被 beginTurn({plan:[]}) 重置（agentPlanState.ts:33、useAIBaseChat.ts:769-775）
- ✅ 后端 /chat/completions 纯透传、无记忆（llmGateway.js:15-39 messages 原样透传）
- ✅ 引用的《AI数据底座Agent重设计方案.md》四处（原则3/P2-1/原则4/P1-3）均存在
- ⚠️ 精度修正：「批量聚合」是 opt-in（per-skill resultAggregation 配置才开），非默认开启；「localStorage 不进 LLM」有例外（decisionPreference/autoNavigate 会改 system prompt 措辞）

### 2. 方案遗漏的关键事实（按影响排序，9 项）
1. **compaction 是破坏性的**：不只裁 API 视图，还永久删除 IndexedDB 历史（useAIBaseChat.ts:533-538）——与 L0「可回放」直接冲突，装填纠偏必须同步改为「只裁视图、不删库」
2. **字符估算把 base64 图片按全长度计入**：一张图（~1M 字符）即触发 compaction 到 12 条——装填漏斗的前置修复项
3. **turn 内无压缩**：loopMessages 在 tool loop（≤32 轮）中无上限增长；方案的装填优先级只覆盖历史轴
4. **ask_user 恢复即清空 plan**：HITL 决策门恢复时 beginTurn({plan:[]})，比「下一句用户话」更严重——会话级 plan store 的第一个验收用例
5. **聚合在预算截断之后解析序列化文本**：截断后 JSON 不可解析被计为 failed——证明 L1 抽取必须挂信封层（executeOneToolCall/recordToolOutcome），不能解析序列化文本；方案「从已有信封规则抽取」方向恰好正确
6. sanitizeMessagesForPersist 的 schema 已预留 toolSteps 字段（从未写入）——L0 的现成落点
7. 多模态附件刷新后从 LLM 历史静默消失（apiContent 不持久化，只留占位文本）
8. P1-3 多会话污染的具体触发路径：window 事件通道无 isRequesting 守卫（AIChatPanel.tsx:454-458）
9. aiSurfaceRegistry 无作用域、id 重复静默覆盖——L2 scene card 落地需处理

### 3. 诊断修正（2 处）
- 「compaction 会把早期约定/任务清单 slice 掉」归因不精确：plan 从不进 history、从不在 system prompt，slice 丢的是早期用户任务规格/引用块/assistant 摘要；任务清单失忆的真因是 turn 边界重置 + ask_user 恢复。**含义：只改 compactHistoryForApi 救不了任务清单，「plan 提升为会话级」应从步骤 1 的后半句升为同等优先级**
- 「IndexedDB 仅 user/assistant 正文」需补充：还保留 reasoningContent；toolSteps 是死字段

### 4. 设计建议评价
- 三漏斗正交、L0–L4 定义、装填 P0–P3 优先级：赞同；补一条前置（估算器修复）
- L1 信封抽取：方向正确，且信封 kind 枚举已覆盖方案列的典型 type（user_choice_request→user_decision、verified→mutation_result）；给出具体挂点建议
- L2 scene card 自动注入替代唯一入口：赞同；L4 先本地：赞同（userHabit 是现成载体）

### 5. 演进顺序调整建议
步骤 1「装填纠偏」扩为三件事：①非破坏性 compaction + 结构化摘要 ②估算器修复 ③会话级 plan store（顺带修复 ask_user 失忆与 P1-3）；每步附验收用例（ask_user 恢复、多会话并发、含图消息）。

### 6. 结论
方案通过，按上述修正执行。

## 执行动作
仅新建一个文件 `docs/上下文漏斗沉淀分析_zcode reviewed.md`（中文，结构同上，含完整核查表与 file:line 证据），不改任何代码。