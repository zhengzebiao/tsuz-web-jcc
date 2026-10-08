# JCC Agent 会话：第三阶段“实现 SSE 问答”实现计划

> 状态：已完成
>
> 总实施方案：[JCC Agent 会话实施方案](../docs/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PLAN.md)
>
> 阶段执行记录：[第三阶段执行记录](./JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_3_EXECUTION.md)
>
> 范围：实现发送后的鉴权 SSE 问答、增量回答、停止与手动断线恢复；不提前实现第四阶段之外的部署或真实服务验收。

## 1. 阶段基准

第一阶段已提供会话 REST wrapper、路由和创建流程；第二阶段已提供历史消息分页、角色展示和事件折叠；已有第三阶段前置 UI 执行记录提供输入栏和工作区。前置阶段的真实 Agent 联调、offset 方向、工具结构化关联和全量质量检查仍待环境验证，本阶段不将 Mock 结果当作真实契约。

当前代码事实：`ApiClient` 原先只消费 JSON/文本，页面发送成功后仅刷新历史；取消 wrapper 已存在但未接入；页面尚无 `/events` 流读取、Last-Event-ID 或 live 草稿。

## 2. 范围与约束

### 本阶段实现

- 公共 API client 原始响应入口，复用 base URL、Bearer Token 和 401 处理；
- JCC SSE URL、SSE framing/parser、跨 chunk UTF-8、事件回调和未知事件保留；
- 发送后创建本地用户/assistant 草稿，处理 `text.delta`、工具/来源事件、completed/failed/cancelled；
- 使用后端 cancel 与前端 AbortController 的双路径停止；断流保留结果并允许带 `Last-Event-ID` 手动恢复；
- Composer 停止按钮、消息列表 live 回答/事件/终态展示及定向测试。

### 明确不实现

- 不修改后端、数据库、OpenAPI、配置、依赖或锁文件；
- 不使用原生 EventSource，不自动无限重连，不在前端保存 Token；
- 不执行真实 Agent 服务、生产部署或真实消息发送；这些仅作为受控环境验证项。

## 3. 技术设计

`packages/api/src/index.ts` 增加 `rawRequest`，成功时返回未消费的 `Response`，失败时沿用 `ApiError` 和 401 handler。JCC service 通过 `rawRequest` 请求 `Accept: text/event-stream`，parser 处理 `id/event/data`、空行、CRLF/LF、EOF 和 JSON data，并把解析事件回调给页面。

页面以单一 active run 管理 message id、assistant 草稿、事件、状态、AbortController 和 last event id。完成后刷新历史；失败、取消或断线保留本地增量文本。停止必须先调用 cancel，再 abort 浏览器读取；断线只进入 disconnected，由用户触发重连，不重复 POST。

工具和 source 事件以原始结构化 payload 作为折叠事件摘要，不臆造未确认的后端字段；heartbeat 不展示，内部思考不展示。

## 4. 文件与步骤

1. 修改 `packages/api/src/index.ts` 及测试，增加 raw authenticated response。
2. 修改 `apps/app/src/services/jcc-agent-api.ts` 及测试，增加事件类型、parser 和 stream wrapper。
3. 修改 `JccConversationPage.tsx`，接入发送、流事件、取消、断线状态和 Last-Event-ID。
4. 修改 `ConversationComposer.tsx`/测试，增加停止交互。
5. 修改 `ConversationMessageList.tsx`/测试和 `main.css`，增加 live assistant、工具/source 折叠和终态。
6. 同步总方案、阶段计划和执行记录，并运行定向测试、类型检查、lint、build、diff 检查。

## 5. 验收标准

| 编号 | 验收标准 | 验证方式 |
| --- | --- | --- |
| AC-3-01 | SSE 请求使用正确 events URL、Bearer、Accept 和可选 Last-Event-ID | API 测试；真实服务待授权 |
| AC-3-02 | 跨 chunk/UTF-8/SSE 行边界事件可正确解析，heartbeat 不展示 | parser 测试 |
| AC-3-03 | text.delta 增量显示，工具/source 作为折叠事件保留 | 页面/列表测试 |
| AC-3-04 | completed、failed、cancelled 终态可见且恢复发送 | 页面/Composer 测试 |
| AC-3-05 | 停止同时调用后端 cancel 和前端 abort，重复停止受保护 | 页面测试；真实取消待授权 |
| AC-3-06 | 断线保留文本并可使用 Last-Event-ID 手动恢复，不重复 POST | 页面/API 测试 |
| AC-3-07 | 页面卸载清理流，Token 不落盘，未知事件不丢失 | 代码检查和测试 |

## 6. 风险与真实验证

后端 OpenAPI 当前声明与实际 SSE `text/event-stream` 不一致；POST 202 返回字段和事件 payload 需真实服务确认。真实 Token、SSE 长连接、取消、重连、offset 和浏览器人工体验不在普通测试中执行，执行记录必须如实标记待环境验证。

## 7. 实施状态

本阶段代码已完成，定向质量检查通过，且用户已完成当前阶段功能测试并反馈通过。真实 Agent 服务联调、部署和生产环境验证不属于本地实施结论，继续按执行记录作为发布前验证项追踪。
