# JCC Agent 会话：第 1 阶段“接入会话 API 和两个路由”实现计划

> 状态：实施中
>
> 总实施方案：[JCC Agent 会话实施方案](../docs/JCC_AGENT_CONVERSATION_IMPLEMENTATION_PLAN.md)
>
> 阶段执行记录：[第 1 阶段执行记录](./JCC_AGENT_CONVERSATION_IMPLEMENTATION_PHASE_1_EXECUTION.md)
>
> 范围：接入普通会话 REST API、会话列表/创建入口、最小详情路由和菜单；不提前实现历史消息交互、SSE、发送/停止和工具事件展示。

## 1. 阶段目标与基准

根据总方案第一步，接入会话普通 REST API，增加 `/jcc/conversations` 列表/创建入口、`/jcc/conversation/:conversationId` 最小详情页和菜单，并完成自动化测试。仓库已有 React Router、Ant Design、React Query、`PageContainer`、JCC 表格/分页模式以及 `createMfeApiClient` 鉴权桥，但没有 Agent 会话实现。

已确认契约：后端前缀为 `/jcc/agent/conversations`；创建字段为 `title`、`strategy_mode`；模式为 `gamble | operation`，默认 `gamble`。当前仓库未提供 Agent 真实响应样例，真实字段联调需后续在授权环境完成。

## 2. 实施范围

- 新增列表、创建、详情、历史消息、发送和取消的普通 REST wrapper；动态 ID 使用 URL 编码。
- 列表固定 `limit=20`、`offset=(page-1)*20`，展示标题、风格、状态、创建时间、最近更新时间和进入操作。
- 创建弹窗标题必填且 1–255 字符，提交前 trim，默认 `gamble`，支持 `operation`；成功跳详情，失败留弹窗并显示错误。
- 详情页加载基础信息、错误重试、返回列表和阶段性占位。
- 接入菜单、两个路由、详情路由菜单高亮和自动化测试。
- 复用 `createMfeApiClient(hostProps)`，不自行保存 Token；不涉及数据库、迁移、配置、依赖或锁文件。

## 3. 明确不实现

- 完整历史消息、角色分组、顶部向上加载和滚动位置保持；
- `events` SSE、`fetch + ReadableStream`、增量文本、Last-Event-ID、断线恢复；
- 发送输入框、Agent 执行状态、停止按钮、取消体验、工具/来源折叠；
- PATCH 编辑/归档、后端契约或鉴权机制变更、登录页和 Token 持久化。

## 4. 关键文件与设计

- `apps/app/src/services/jcc-agent-api.ts`：通过 `ApiClient.get/post` 封装六类普通 REST 调用，不自行管理认证。
- `apps/app/src/pages/JccConversationsPage.tsx`：React Query 列表与创建 mutation，复用 `PageContainer`、Ant Design Table/Form/Modal/Pagination/Alert。
- `apps/app/src/pages/JccConversationPage.tsx`：只调用详情 GET，不请求 `/messages`、`/events` 或 `/cancel`。
- `apps/app/src/App.tsx`：新增 Agent 会话菜单和两条路由，详情路径高亮会话菜单。
- `apps/app/src/services/jcc-agent-api.test.ts`：验证路径、query、body 和动态 ID 编码。
- `apps/app/src/pages/JccConversationsPage.test.tsx`：验证列表、分页、创建成功/失败、默认值和校验。
- `apps/app/src/pages/JccConversationPage.test.tsx`：验证详情加载、重试、返回列表及阶段边界。
- `apps/app/src/App.test.tsx`：保留资料路由/fallback 回归并验证新增菜单。

## 5. 验收标准

| 编号 | 标准 | 验证 |
| --- | --- | --- |
| AC-1-01 | 菜单可进入列表，详情路由存在并高亮会话菜单 | App 回归测试 |
| AC-1-02 | 列表固定 20 条并正确转换 offset | 列表/API 测试 |
| AC-1-03 | 展示规定列表字段和进入操作 | 列表测试 |
| AC-1-04 | 创建校验、默认 gamble、支持 operation | 列表测试 |
| AC-1-05 | 创建成功跳详情，失败留弹窗 | 列表测试 |
| AC-1-06 | 详情加载基础信息且不提前请求消息/SSE | 详情测试 |
| AC-1-07 | wrapper 覆盖六类 REST 调用并复用认证 | API 测试、类型检查 |
| AC-1-08 | API、弹窗、路由、分页均有测试 | 定向/全量测试 |
| AC-1-09 | 总方案、阶段计划、执行记录互链且状态真实 | 文档核对 |

## 6. 验证命令

```bash
pnpm --filter tsuz-web-admin-app exec vitest run src/services/jcc-agent-api.test.ts src/pages/JccConversationsPage.test.tsx src/pages/JccConversationPage.test.tsx src/App.test.tsx
pnpm --filter tsuz-web-admin-app test
pnpm --filter tsuz-web-admin-app lint
pnpm --filter tsuz-web-admin-app build
pnpm lint
pnpm build
git diff --check
```

真实 Agent API 联调、生产数据、部署和 Token 验证需要授权环境，本阶段不执行；服务端契约核对代理因 HTTP 502 未完成，执行记录中明确保留该限制。

## 7. 风险与后续入口

当前前端类型依据总方案假设 `id/items/total/status` 字段，真实联调时需确认；若字段不同，只调整 wrapper/adapter。后续阶段复用本阶段消息 wrapper，但再实现历史消息、SSE、发送和停止能力。
