## 更新后的简要方案

我已核对 `tsuz-api-jcc` 的实际实现和文档。后端已经具备完整的会话与 Agent 执行链路，前端可以直接接入，不需要设计新的后端接口。

### 一、接口与路由约定

后端实际接口前缀为：

```text
/jcc/agent/conversations
```

前端页面路由按你的要求使用：

```text
/jcc/conversations
/jcc/conversation/:conversationId
```

需要区分两者：

- **前端页面路由**：`/jcc/conversation/:conversationId`
- **后端 API 路径**：`/jcc/agent/conversations/:conversationId`

已有接口：

```text
POST /jcc/agent/conversations
GET  /jcc/agent/conversations?limit=&offset=
GET  /jcc/agent/conversations/{conversation_id}
PATCH /jcc/agent/conversations/{conversation_id}
GET  /jcc/agent/conversations/{conversation_id}/messages?limit=&offset=
POST /jcc/agent/conversations/{conversation_id}/messages
GET  /jcc/agent/conversations/{conversation_id}/messages/{message_id}/events
POST /jcc/agent/conversations/{conversation_id}/messages/{message_id}/cancel
```

---

## 二、会话列表页：`/jcc/conversations`

### 页面布局

保持当前 JCC 资料页风格：

- `PageContainer`
- JCC 卡片容器
- Ant Design `Table`
- 统一的分页、空状态和错误状态
- 表格右侧保留操作列

建议表格字段：

| 字段 | 展示 |
|---|---|
| 会话标题 | 后端 `title` |
| 风格 | `赌狗` / `运营` |
| 状态 | 活跃 / 已归档 |
| 创建时间 | `created_at` |
| 最近更新 | `updated_at` |
| 操作 | 进入会话 |

### 新建会话流程

点击页面头部的“新建会话”按钮后，打开 Modal，而不是直接创建。

弹窗字段：

1. **会话标题**
   - 必填；
   - 长度遵循后端限制：1～255 个字符。

2. **会话风格**
   - 赌狗，默认；
   - 运营。

点击确认：

```text
POST /jcc/agent/conversations
{
  "title": "...",
  "strategy_mode": "gamble"
}
```

创建成功后：

```text
跳转到 /jcc/conversation/:conversationId
```

创建失败：

- 保留弹窗；
- 展示接口错误；
- 不进行跳转。

### 列表分页

复用当前资料页的分页模式：

```text
limit=20
offset=(page-1)*20
```

列表只展示当前用户有权限访问的会话，认证继续复用现有宿主 Token 注入机制。

---

## 三、会话问答页：`/jcc/conversation/:conversationId`

### 页面结构
```texxt
┌────────────────────────────────────┐
│ 动态会话标题                        │
│ 会话风格 · 会话状态                 │
├────────────────────────────────────┤
│                                    │
│        消息历史区域                  │
│                                    │
│                          用户消息   │
│  Agent 文本回答                     │
│  ▸ 工具调用（折叠）                  │
│  ▸ 工具结果（折叠）                  │
│                                    │
│        向上滚动加载更早消息           │
├────────────────────────────────────┤
│ 输入问题                  风格 ▼ 发送 │
├────────────────────────────────────┤
```
### 消息展示规则

后端消息角色包括：

```text
user
assistant
tool
system
```

前端展示策略：

- 不额外显示 `jcc-conversation-role` 角色标签；
- `user`：用户消息固定显示在右侧，使用正常的用户消息气泡样式，并按纯文本展示；
- `assistant`：Agent 消息固定显示在左侧，使用 Markdown/GFM 格式展示文本内容；
- `tool`：不单独作为左右气泡，归入对应 Agent 消息下方的折叠详情中，按纯文本显示工具名称、状态和摘要；
- `system`：不单独作为左右气泡，归入对应 Agent 消息下方的折叠详情中，按纯文本作为辅助信息展示；
- 未知角色消息同样作为折叠事件记录按纯文本展示；
- 空内容的工具/系统消息仍保留为可展开事件记录；
- 不展示 Agent 内部思考内容。

工具调用展开后可显示：

- 工具名称；
- 调用状态；
- 参数摘要；
- 返回结果摘要；
- 错误信息（如果失败）。

默认状态为折叠，避免工具执行过程淹没主要回答。

---

## 四、历史消息向上加载

首次进入页面：

```text
GET /jcc/agent/conversations/:conversationId/messages?limit=20&offset=0
```

需要注意后端分页接口是 `offset` 分页，而用户要求的是“向上滚动加载历史”。

建议前端维护：

```text
当前已加载消息范围
是否还有更早消息
是否正在加载历史
```

交互方式：

1. 首次加载最近一页消息；
2. 消息按 `sequence` 正序显示；
3. 用户滚动到顶部时，请求更早的一页；
4. 将旧消息插入顶部；
5. 保持滚动位置，避免页面突然跳动；
6. `total` 对应消息全部加载后停止请求。

如果后端当前 `offset=0` 返回最早消息而不是最近消息，则前端需要根据后端实际排序方式调整首次加载策略。这个行为应通过接口实测确认，不建议仅依赖字段名称推断。

---

## 五、发送消息与 SSE

### 发送流程

用户输入内容后：

1. 输入框为空时，发送按钮禁用；
2. 输入有效内容后，发送按钮亮起；
3. 调用：

```text
POST /jcc/agent/conversations/:conversationId/messages
{
  "content": "...",
  "strategy_mode": "gamble",
  "client_request_id": "..."
}
```

如果会话页面已加载到后端的风格，也可以默认使用会话风格；下拉框用于本次消息选择，默认仍为“赌狗”。

4. 后端返回 `202` 和已排队的消息；
5. 立即把用户消息加入页面；
6. 使用返回的 `message_id` 连接事件流：

```text
GET /jcc/agent/conversations/:conversationId/messages/:messageId/events
```

### SSE 客户端实现

不能使用浏览器原生 `EventSource`，因为现有鉴权机制需要在请求头中附带 Bearer Token。

采用：

```text
fetch() + ReadableStream
```

并支持：

```text
Authorization: Bearer <token>
Last-Event-ID: <lastEventId>
```

前端解析 SSE 事件：

```text
message.queued
run.started
text.delta
tool.started
tool.completed
source
message.completed
message.failed
message.cancelled
heartbeat
```

### 页面更新

- `text.delta`：追加到当前 Agent 消息；
- `tool.started` / `tool.completed`：更新折叠的工具事件；
- `source`：加入回答的来源信息；
- `message.completed`：结束 loading；
- `message.failed`：展示错误状态；
- `message.cancelled`：展示“已停止”状态；
- `heartbeat`：只用于维持连接，不显示给用户。

文本应增量渲染，工具事件和来源信息单独存储，避免把 SSE 原始事件直接混入回答文本。

---

## 六、停止 Agent 回答

Agent 返回期间：

- 发送按钮变为“停止”按钮；
- 输入框可以继续保持可编辑或暂时禁用，建议暂时禁用发送但允许编辑；
- 点击停止后：

```text
POST /jcc/agent/conversations/:conversationId/messages/:messageId/cancel
```

随后：

1. 中止前端 `fetch` SSE 读取；
2. 等待或处理后端返回的 `message.cancelled`；
3. 当前回答保留已经收到的文本；
4. 在消息底部显示“已停止”；
5. 恢复发送按钮。

不能只调用前端 `AbortController.abort()`，因为那只能断开浏览器连接，不能真正停止后端 Agent 执行。

---

## 七、页面状态和异常处理

需要覆盖：

- 会话不存在；
- 会话已归档；
- 会话列表加载失败；
- 历史消息加载失败；
- 消息提交失败；
- SSE 连接中断；
- Agent 执行失败；
- 用户 Token 失效；
- 重复点击发送；
- 用户快速离开页面；
- 浏览器刷新后恢复当前会话。

SSE 中断时建议：

- 保留已经显示的增量文本；
- 标记当前回答为“连接中断”；
- 提供“重新连接”或“刷新消息”入口；
- 使用 `Last-Event-ID` 尝试从上次事件继续接收；
- 不自动无限重试，避免重复创建或重复渲染。

---

## 八、建议的前端文件范围

```text
apps/app/src/pages/JccConversationsPage.tsx
apps/app/src/pages/JccConversationsPage.test.tsx

apps/app/src/pages/JccConversationPage.tsx
apps/app/src/pages/JccConversationPage.test.tsx

apps/app/src/services/jcc-agent-api.ts
apps/app/src/services/jcc-agent-api.test.ts

apps/app/src/components/jcc/ConversationMessageList.tsx
apps/app/src/components/jcc/ConversationComposer.tsx
apps/app/src/components/jcc/ConversationCreateModal.tsx

apps/app/src/styles/main.css
apps/app/src/App.tsx
packages/shared/src/index.ts
```

其中：

- `jcc-agent-api.ts`：会话、历史消息、发送、取消、SSE 解析；
- `JccConversationsPage`：会话列表和创建弹窗；
- `JccConversationPage`：会话详情、滚动历史、问答状态；
- `ConversationMessageList`：文本消息和折叠事件；
- `ConversationComposer`：输入框、风格选择、发送/停止按钮。

---

## 九、实施顺序建议

### 第一步：接入会话 API和两个路由

- 增加 API 类型；
- 增加列表、创建、详情、历史消息、发送和取消方法；
- 增加 `/jcc/conversations`；
- 增加 `/jcc/conversation/:conversationId`；
- 增加菜单项；
- 完成列表和创建弹窗。

### 第二步：实现历史消息页面

- 会话详情加载；
- 消息列表；
- 用户/Agent/工具/系统消息分组；
- 工具消息折叠；
- 顶部向上加载；
- 保持滚动位置。

### 第三步：实现 SSE 问答

- `fetch + ReadableStream`；
- SSE 事件解析；
- 文本增量显示；
- 工具事件折叠更新；
- 完成、失败、取消状态；
- 断线和 Last-Event-ID 恢复。

第三阶段实现计划：[第三阶段实现计划](../plan/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_3_PLAN.md)，当前状态为“已完成”；阶段执行事实及用户功能测试通过记录见[第三阶段执行记录](../plan/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_3_EXECUTION.md)。此前的页面工作区与输入栏改造也保留在该执行记录中。

### 第四步：测试和文档

- API 请求和 SSE 解析测试；
- 创建弹窗测试；
- 路由跳转测试；
- 分页和向上加载测试；
- 发送/停止状态测试；
- 工具事件折叠测试；
- 同步 JCC 总方案、阶段计划和阶段执行记录。

---

## 十、当前需要记录的接口事实

这次核对确认：

1. 后端创建会话的字段是 `title` 和 `strategy_mode`；
2. 风格值是：
   - `gamble`：赌狗；
   - `operation`：运营；
3. 后端默认 `strategy_mode` 是 `gamble`；
4. 消息提交接口返回 `202`，先进入队列；
5. SSE 使用独立的 `events` 接口；
6. SSE 支持文本增量、工具事件、来源和终态事件；
7. 停止需要调用后端 `cancel` 接口；
8. 由于鉴权要求，前端必须使用 `fetch` 流式读取，不能使用原生 `EventSource`；
9. 当前 OpenAPI 对 SSE 响应的声明与实际实现不完全同步：实现返回 `text/event-stream`，OpenAPI 仍显示为 JSON，需要在前端测试和阶段记录中注明这一事实。

## 十一、阶段一落地状态

阶段一“接入会话 API 和两个路由”已完成核心代码、定向测试和 App 回归（18 项通过）。全量测试、构建和完整质量检查留待后续补充；在补充完成前，阶段状态保持为“部分完成”。具体范围、验收标准和执行记录分别记录于：

- [阶段一实现计划](../plan/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_1_PLAN.md)；
- [阶段一执行记录](../plan/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_1_EXECUTION.md)。

阶段一已落地：会话普通 REST wrapper、`/jcc/conversations` 列表与创建弹窗、`/jcc/conversation/:conversationId` 最小详情页、菜单接入及自动化测试。阶段一明确未实现历史消息完整交互、顶部向上加载、SSE、发送/停止体验和工具/来源折叠；这些能力仍按本方案进入第二、三阶段。真实 Agent 服务联调和部署不在本次代码验证范围内。

## 十二、阶段二落地状态

阶段二“实现历史消息页面”已完成代码和修改/新增文件定向验证，阶段状态为“部分完成”：

- [阶段二实现计划](../plan/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_2_PLAN.md)；
- [阶段二执行记录](../plan/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_2_EXECUTION.md)。

阶段二已实现详情页历史消息查询、角色布局、工具/系统折叠事件、顶部 offset 分页和滚动位置恢复。由于消息类型尚无结构化工具关联字段，tool/system 当前按消息顺序挂到最近 assistant；由于未执行真实 Agent 服务联调，`offset=0` 的实际方向仍待确认。阶段二执行记录保留其原验收边界。

## 十三、阶段三落地状态

阶段三“实现 SSE 问答”已完成代码、定向验证和用户功能测试，阶段状态为“已完成”：

- [阶段三实现计划](../plan/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_3_PLAN.md)；
- [阶段三执行记录](../plan/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_3_EXECUTION.md)。

阶段三已实现鉴权 SSE 流、增量文本、工具/source 事件折叠、完成/失败/取消状态、后端取消、前端中止和 Last-Event-ID 手动恢复；用户已完成当前阶段功能测试并反馈通过。真实 Agent 服务契约、真实 Token、取消接口、事件 payload、Last-Event-ID 语义及部署仍未执行，继续作为发布前真实环境验证项追踪。

本次根据页面结构确认，已补充会话工作区 UI：保留动态标题/描述，删除底部返回按钮，消息区改为卡片内可伸缩滚动区域，并增加问题输入、风格选择和发送栏。复用既有发送 REST wrapper，发送成功后刷新历史消息；SSE、实时工具事件、停止/取消和断线恢复已在第三阶段实现。详见[第三阶段执行记录](../plan/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_3_EXECUTION.md)。
