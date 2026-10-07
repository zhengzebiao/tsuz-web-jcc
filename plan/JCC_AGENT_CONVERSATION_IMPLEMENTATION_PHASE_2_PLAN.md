# JCC Agent 会话：第 2 阶段“实现历史消息页面”实现计划

> 状态：已实施
>
> 总方案：[JCC Agent 会话实施方案](../docs/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PLAN.md)
>
> 前置阶段计划：[第 1 阶段实现计划](./JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_1_PLAN.md)
>
> 前置阶段记录：[第 1 阶段执行记录](./JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_1_EXECUTION.md)
>
> 本阶段执行记录：[第 2 阶段执行记录](./JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_2_EXECUTION.md)

## 1. 阶段目标

在第一阶段会话详情页和 REST 消息 wrapper 的基础上，实现只读历史消息页面：加载首批消息、按顺序展示不同角色、折叠工具/系统事件、顶部加载更早消息并保持滚动位置。

## 2. 范围与非目标

### 2.1 本阶段实现

- `JccConversationPage` 保留详情查询，并增加消息历史 `useInfiniteQuery`。
- 首次请求固定使用 `limit=20&offset=0`；后续按 offset 加载更早页。
- 合并分页结果时按消息 id 去重；列表按 `sequence` 排序，同类缺少 sequence 时按 `created_at` 和稳定原始顺序兜底。
- user 消息右对齐，assistant 消息左对齐。
- tool、system 和未知角色作为默认折叠事件；事件按顺序挂到最近 assistant，没有可挂载对象时形成独立事件组；空内容仍保留。
- 支持加载中、空态、无更多历史、失败和独立重试。
- 顶部按钮和滚动触顶均可加载更早消息；prepend 后按高度差恢复 scrollTop。

### 2.2 明确不实现

- 不请求 `/events`，不实现 SSE、ReadableStream、事件解析、Last-Event-ID 或断线恢复。
- 不实现发送输入框、发送消息、运行状态、停止/取消。
- 不改变后端接口、数据库、鉴权、配置、依赖或锁文件。

## 3. 现有能力与契约限制

- 复用 `apps/app/src/services/jcc-agent-api.ts` 的 `listJccAgentMessages`，本阶段不改变 API wrapper。
- 复用 `createMfeApiClient(hostProps)` 的鉴权链路。
- 当前消息类型没有工具名、状态、参数、结果或 parent/tool-call 关联字段，因此只展示角色、时间和内容，不虚构结构化工具信息。
- `offset=0` 的真实方向尚未完成 Agent 服务联调。测试按“offset=0 为最近页、offset=20 为更早页”的方案假设验证，真实语义须在后续联调确认，不做自动探测。

## 4. 技术设计

### 4.1 页面

修改 `apps/app/src/pages/JccConversationPage.tsx`：

- 使用 query key `["jcc-agent", "conversation", conversationId, "messages"]` 的 `useInfiniteQuery`。
- 每页 20 条；以分页结果的唯一 id 数量与 `total` 判断是否还有下一页。
- 页面只编排查询和状态，把已去重消息交给列表组件；详情错误与消息错误相互独立。

### 4.2 消息列表

新增 `apps/app/src/components/jcc/ConversationMessageList.tsx` 及测试：

- 提供排序、事件分组、左右气泡和 Ant Design Collapse 折叠事件。
- 事件内容为空时显示“空事件记录”，未知角色不丢弃。
- 在稳定滚动容器中记录加载前 `{ scrollTop, scrollHeight }`，消息数量变化后按 `oldTop + (newHeight - oldHeight)` 恢复位置。

### 4.3 样式

在 `apps/app/src/styles/main.css` 增加 `jcc-conversation-*` 前缀样式，覆盖消息滚动区、角色布局、气泡、事件和状态提示；保留既有 Ant Design reset 导入。

## 5. 验收与验证

只执行本阶段修改或新增文件对应的定向测试，不执行全量测试、全量 lint 或构建：

```bash
pnpm --filter tsuz-web-admin-app exec vitest run \
  src/components/jcc/ConversationMessageList.test.tsx \
  src/pages/JccConversationPage.test.tsx \
  src/services/jcc-agent-api.test.ts
pnpm --filter tsuz-web-admin-app exec tsc -p tsconfig.json --noEmit
git diff --check
```

验收标准：

- 详情和首批消息均加载；
- 消息角色、排序、去重和事件折叠正确；
- 顶部加载请求下一 offset，并保持滚动位置；
- 空态、加载失败和独立重试可见；
- 不请求 SSE/events/cancel，不显示发送/停止控件；
- 本计划、执行记录和总方案互相链接。

## 6. 后续入口

第三阶段继续负责发送/停止、SSE 增量事件、终态和断线恢复；真实 offset 方向及结构化工具关联字段也须在授权服务联调中确认。
