# JCC Agent 会话：第三阶段“SSE 问答”执行记录

> 状态：部分完成
>
> 执行日期：2026-10-07
>
> 总实施方案：[JCC Agent 会话实施方案](../docs/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PLAN.md)
>
> 阶段实现计划：[第三阶段实现计划](./JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_3_PLAN.md)
>
> 前置执行记录：[第二阶段执行记录](./JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_2_EXECUTION.md)

本记录保留此前页面工作区/输入栏子项，并记录本次 SSE 代码实施事实。真实 Agent 服务联调、部署和真实消息发送未执行。

## 1. 执行范围与结论

本次按总方案第三步实现了鉴权原始响应、SSE framing/parser、live assistant 草稿、增量文本、工具/来源事件折叠、完成/失败/取消状态、后端取消入口和前端流中止。阶段结论为“部分完成”：代码和定向回归通过，但 SSE 专项边界测试及真实服务契约/浏览器体验仍待补充。

已实现：

1. 公共 `ApiClient.rawRequest` 保留未消费 Response，并继续复用 URL、Bearer 和 401 处理；
2. JCC events stream 使用 `Accept: text/event-stream`、可选 `Last-Event-ID` 和 `ReadableStream`；
3. parser 支持跨 chunk、UTF-8 decoder、CRLF/LF、event/id/data、EOF flush、未知事件和 heartbeat 忽略；
4. 页面发送成功后显示用户消息和 assistant 草稿，处理 `text.delta` 与工具/source/未知事件；
5. completed/failed/cancelled 状态展示；停止调用后端 cancel 并 abort 前端读取；
6. 流中断保留内容并进入 disconnected，保留最后事件 ID 所需的运行状态；
7. 保留此前工作区、历史分页、Markdown 和输入栏能力。

未实现或未执行：

- SSE 专项 parser/API/页面状态测试尚未新增完整覆盖；
- 真实 Agent 服务、真实 Bearer Token、真实 `text/event-stream`、cancel、Last-Event-ID 恢复和浏览器人工验收未执行；
- 后端 POST 202 返回字段与事件 payload 的真实契约仍待确认。

## 2. 实际代码与配置变更

- `packages/api/src/index.ts`：新增 `rawRequest`，成功响应不预先消费 body，失败仍转换 `ApiError`。
- `apps/app/src/services/jcc-agent-api.ts`：新增 SSE 事件类型、events stream wrapper 和纯 ReadableStream parser。
- `apps/app/src/pages/JccConversationPage.tsx`：增加 active stream 状态、AbortController、事件归并、乐观 live response、cancel 和断线状态。
- `apps/app/src/components/jcc/ConversationComposer.tsx`：发送期间显示“停止”，取消中显示“停止中”。
- `apps/app/src/components/jcc/ConversationMessageList.tsx`：增加 live user/assistant、Markdown 增量文本、事件折叠和终态。
- `apps/app/src/components/jcc/ConversationComposer.test.tsx`：更新发送中按钮契约为停止按钮可用。
- `plan/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_3_PLAN.md`：新增第三阶段正式计划。
- `docs/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PLAN.md`：补充第三阶段计划链接和前置 UI 记录边界。

不涉及数据库、迁移、配置 Secret 或依赖/锁文件变更。

## 3. 关键设计结果

1. SSE 不使用原生 EventSource，而通过公共 raw authenticated request 保持宿主 Token 注入链路；
2. AbortController 只中断浏览器读取，后端停止必须调用 cancel API；
3. heartbeat 不进入 UI，未知事件保留为折叠事件；
4. 流式草稿仅作为 live view，历史查询仍是终态后的校准来源；
5. 未确认的工具字段以 JSON 摘要展示，不臆造工具结构。

## 4. 与阶段计划的差异

| 差异 | 计划内容 | 实际实施 | 原因 | 影响与处理 |
| --- | --- | --- | --- | --- |
| SSE 专项测试 | parser/API/页面状态完整测试 | 已新增 parser、raw stream、live message、Composer 和页面状态 Mock 测试 | 用户选择先做本地 Mock，真实服务仍后置 | 专项验收已覆盖，真实契约仍待联调 |

## 5. 测试与验证结果

| 检查 | 命令或方法 | 结果 | 证据/说明 |
| --- | --- | --- | --- |
| 定向测试 | `pnpm --filter tsuz-web-admin-app exec vitest run src/services/jcc-agent-api.sse.test.ts src/components/jcc/ConversationComposer.test.tsx src/components/jcc/ConversationMessageList.test.tsx src/pages/JccConversationPage.test.tsx` | 通过 | 4 个文件、31 项测试通过；存在既有 Ant Design `NaN` height warning |
| 公共 API 测试 | `pnpm --filter @tsuz/api test -- index.test.ts` | 通过 | 1 个文件、4 项测试通过；覆盖 rawRequest |
| 类型检查 | `pnpm --filter tsuz-web-admin-app exec tsc -p tsconfig.json --noEmit` | 通过 | 无 TypeScript 错误 |
| Lint/格式 | `pnpm --filter tsuz-web-admin-app lint` | 通过 | TypeScript lint 通过 |
| 应用构建 | `pnpm --filter tsuz-web-admin-app build` | 通过 | 构建通过；仅有既有 chunk size warning |
| Diff 检查 | `git diff --check` | 通过 | 无空白错误 |
| 真实服务/浏览器/部署 | 无授权环境 | 未执行 | 不能用 Mock 代替真实结论 |

## 6. 阶段验收结果

| 编号 | 验收标准 | 结果 | 验证证据 |
| --- | --- | --- | --- |
| AC-3-01 | SSE URL、Accept、Last-Event-ID 和鉴权 raw request | Mock 通过，真实待验证 | SSE service 测试和 rawRequest 测试；真实服务待联调 |
| AC-3-02 | 跨 chunk/UTF-8/SSE framing/heartbeat | Mock 通过，真实待验证 | 4 项 parser 测试；真实服务 payload 待确认 |
| AC-3-03 | 增量文本、工具/source 折叠 | Mock 通过，真实待验证 | MessageList/page 测试 |
| AC-3-04 | completed/failed/cancelled 终态 | Mock 通过，真实待验证 | 页面终态测试 |
| AC-3-05 | cancel 与 AbortController 双路径停止 | Mock 通过，真实待验证 | 页面 cancel 测试；真实 cancel 待联调 |
| AC-3-06 | 断线保留内容并 Last-Event-ID 手动恢复 | Mock 通过，真实待验证 | 页面重连测试；真实续接语义待联调 |
| AC-3-07 | 卸载清理、未知事件、Token 不落盘 | Mock/代码检查通过，真实待验证 | 未知事件与流状态测试；Token 由宿主注入 |

## 7. 安全、兼容性与可观测性

- Token 继续由宿主 `getAccessToken` 注入，不写入 React 以外的持久化存储、URL 或日志。
- rawRequest 复用既有 401 `onUnauthorized` 处理；真实 Token 失效行为未联调。
- SSE OpenAPI 声明与实际 `text/event-stream` 不一致，前端显式使用 raw response；该契约偏差仍需后端文档同步。
- 未新增日志、指标或敏感信息输出。

## 8. 遗留问题与下一阶段入口

| 问题 | 影响 | 条件 | 处理阶段 |
| --- | --- | --- | --- |
| 真实事件 payload/202 返回未确认 | 可能需调整字段映射 | 授权 Agent 环境 | 联调/发布前 |
| 全量质量检查未完成 | 无全仓质量结论 | CI 或本地执行 | 本阶段验证 |

## 9. 文档同步记录

- 总方案：增加第三阶段正式计划链接并区分前置 UI 记录与 SSE 阶段。
- 第三阶段计划：新增并记录最终实现范围和验收标准。
- 本执行记录：记录当前代码、验证结果、偏差和遗留问题。

## 10. 阶段结论

第三阶段部分完成：SSE 主流程、取消、断线重连基础能力和本地 Mock 专项测试已落地；类型检查、lint、build、diff 及定向测试通过。由于真实 Agent 服务、Token、cancel、事件 payload 和 Last-Event-ID 语义尚未联调，仍不能标记为完全完成。