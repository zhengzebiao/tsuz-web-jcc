# JCC 只读资料库实施方案

> 状态：实施中
>
> 本方案基于 React/Vite/qiankun 子应用、2026-09-15 获取的本地 JCC OpenAPI，以及当前仓库和 `template/subapp-base` 分支事实。
>
> 原始实施草案：[curious-hugging-pixel](../docs/curious-hugging-pixel.md)
>
> 第一阶段：[实现计划](JCC_DATA_IMPLEMENTATION_PHASE_1_PLAN.md)｜[执行记录](JCC_DATA_IMPLEMENTATION_PHASE_1_EXECUTION.md)
>
> 后续运维配置：[GitHub Actions CI/CD 实施方案](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PLAN.md)

## 1. 已确认业务配置与关键决策

| 项目         | 决策或配置                                                                                         | 状态/来源                      |
| ------------ | -------------------------------------------------------------------------------------------------- | ------------------------------ |
| 产品范围     | 提供 JCC 六类资料的只读检索、分页和详情，不提供新增、编辑、启用、删除等管理操作                    | 已确认；用户要求与原始草案     |
| 前端命名     | 后端 `adventures` 在 UI 显示为“特殊机制”，`galaxies` 显示为“传送门”                                | 已确认；用户要求               |
| 前端路由     | `/heroes`、`/traits`、`/equipment`、`/augments`、`/special-mechanics`、`/portals`                  | 已确认；原始草案               |
| 分页         | 固定每页 20 条，转换为 `limit=20`、`offset=(page-1)*20`                                            | 已确认；原始草案和后端契约     |
| 认证         | 复用宿主 `getAccessToken` 注入 Bearer Token；401 复用宿主 `logout`，子应用不持久化 Token           | 已确认；现有通用请求实现       |
| 模板基线     | `template/subapp-base` 保留不含 JCC 业务的通用子应用壳，指向提交 `e63ad97`                         | 已落实；Git 分支事实           |
| 兼容标识     | workspace 包名和 qiankun 应用名中的 `admin`/`mfe-app` 暂不重命名；Docker/Compose 改用 JCC 独立标识 | 已确认；用户后续要求接入 CI/CD |
| 真实数据验收 | 无有效用户 Token 时只验证接口可达和 401 边界，不声称真实资料加载通过                               | 已确认；安全与环境边界         |

## 2. 背景与现状

### 2.1 背景

项目由 admin 子应用模板复制而来。第一步已清除用户、角色和权限管理业务，并在 `template/subapp-base` 保存可复用基础壳；当前要在 `main` 工作区完成面向登录用户的 JCC 资料观测站，使其可独立开发或由 qiankun 主应用挂载。

### 2.2 当前架构

- [应用入口](../apps/app/src/App.tsx) 负责菜单和 React Router 路由；
- [JCC 资料页](../apps/app/src/pages/JccResourcePage.tsx) 复用 TanStack Query、Ant Design Table/Drawer 和 `PageContainer`；
- [JCC API](../apps/app/src/services/jcc-api.ts) 描述 OpenAPI 字段、查询参数和六个列表调用；
- [API 客户端桥接](../apps/app/src/services/api-client.ts) 将宿主配置交给 [通用请求客户端](../packages/api/src/index.ts)；
- [应用状态](../apps/app/src/stores/app.store.ts) 保存 qiankun 挂载参数，但不保存 Token；
- [构建配置](../apps/app/vite.config.ts)、[Dockerfile](../Dockerfile) 和 [nginx 配置](../nginx/nginx.conf) 继续承担既有开发与部署能力。

### 2.3 现状差距

JCC API、六个路由和初版资料页已经进入工作区，但正式收尾前仍需：修复 fallback 路由与跨资源状态复用、分页越界、失败时旧元数据残留和详情字段不完整；补充资料页行为测试；同步正式方案/阶段记录；清理测试及构建产物变更。

## 3. 目标与非目标

### 3.1 目标

1. 六类资料均可按契约筛选、固定 20 条分页、查看完整列表项详情，并展示当前快照元数据；
2. 根路径、未知路径和旧管理路由明确重定向到 `/heroes`，资源切换不复用上一类资料的页码、筛选或详情；
3. 401、503 和一般请求失败给出可理解的只读错误状态与重试入口；
4. 保持 qiankun 鉴权、基础路径和部署兼容，不引入新依赖或敏感配置；
5. 以自动化测试、全量质量检查和三层方案文档形成可追溯交付。

### 3.2 非目标

- JCC 数据的创建、编辑、删除、上下线、同步触发或其他 admin 操作；
- 在前端持久化 Token、实现登录页或改变宿主权限模型；
- 修改后端 `/jcc/*` 契约、数据库、缓存或数据同步流程；
- 重命名历史包、镜像、Compose 和 qiankun 兼容标识；
- 在没有授权 Token 时伪造真实环境成功验收。

## 4. 需求与核心流程

| 参与者   | 前置条件                         | 操作                     | 预期结果                                           |
| -------- | -------------------------------- | ------------------------ | -------------------------------------------------- |
| 登录用户 | 宿主提供有效 Token 和 API 基地址 | 进入任一资料路由         | 获取对应 `/jcc/*` 列表并看到快照、总数和首屏数据   |
| 登录用户 | 列表加载成功                     | 输入资源允许的筛选并查询 | 页码回到 1，只发送当前资源允许的非空参数           |
| 登录用户 | 列表有多页                       | 切换页码                 | 按固定 20 条换算 offset；总数收缩时回到最后有效页  |
| 登录用户 | 列表有数据                       | 点击行或“查看”按钮       | 只读抽屉展示列表响应中该项的完整字段和可用媒体链接 |

```text
前端资源路由
  ↓ 选择资源配置、筛选和页码
JccResourcePage / TanStack Query
  ↓ createMfeApiClient（宿主 Token/401 回调）
GET /jcc/{resource}?limit=20&offset=...
  ↓
快照 + 列表 + 总数 / 明确错误状态
```

异常与边界：空筛选不发送；筛选和资源切换回第一页；越界页自动校正；新查询失败时不展示旧查询的快照、总数或详情；401 触发既有登出桥；503 显示资料暂不可用；其余错误显示通用失败并允许重试。

## 5. 当前架构适配与总体设计

### 5.1 设计原则

- 继续复用 `createMfeApiClient`、`@tsuz/api`、React Query 和现有宿主状态，不另建请求或鉴权层；
- 以前端资源配置驱动菜单和路由，后端资源 key 只停留在契约/内部类型层；
- 详情直接使用列表返回的完整项目。OpenAPI 仅为英雄提供单项接口，若为其他类型擅自新增详情请求会形成不一致能力；
- 数据只保存在 React/React Query 内存状态，不增加持久状态或外部副作用；
- API 和 UI 测试使用 Mock，真实 Token 仅用于用户明确授权的人工验收。

### 5.2 模块边界

- `App`：定义六个公开前端路由、菜单、选中态和 fallback；不处理请求；
- `JccResourcePage`：管理当前资源的筛选、分页、查询状态、表格和详情；不保存认证信息；
- `jcc-api`：维护后端数据类型和六个 GET 列表契约；不包含 UI 文案；
- `createMfeApiClient` / `@tsuz/api`：解析 API 基地址、注入 Token、执行 401 回调和抛出带状态码错误。

### 5.3 兼容策略

部署默认 API 基地址仍为 `/api`，宿主 `apiBaseUrl` 优先。独立本地开发保持浏览器请求 `/api`，并由可选的 `VITE_API_PROXY_TARGET` 将请求代理到本地 JCC 服务，避免服务未开放 CORS 时被浏览器拦截。本业务阶段不改 qiankun app name 或包名。用户后续确认接入 GitHub Actions 后，Docker 镜像、容器、Compose 项目和 `/subapps/jcc/` 静态资源前缀改为 JCC 独立标识，具体发布与回滚契约见 [GitHub Actions CI/CD 实施方案](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PLAN.md)。业务代码回滚仍不涉及数据回滚。

## 6. 接口与数据契约

所有列表均为受 Bearer Token 保护的 `GET` 请求，响应统一为：

```text
{
  snapshot: { mode, mode_name, season, version, revision, content_hash, source_updated_at },
  items: T[],
  total: number,
  limit: number,
  offset: number
}
```

| 后端路径          | 允许的业务筛选                          | 前端页面                         |
| ----------------- | --------------------------------------- | -------------------------------- |
| `/jcc/heroes`     | `name`、`trait_id`、`class_id`、`price` | `/heroes`                        |
| `/jcc/traits`     | `kind=race\|job`、`name`                | `/traits`                        |
| `/jcc/equipment`  | `name`、`type`                          | `/equipment`                     |
| `/jcc/augments`   | `name`、`level`                         | `/augments`                      |
| `/jcc/adventures` | `title`、`price`                        | `/special-mechanics`（特殊机制） |
| `/jcc/galaxies`   | `name`                                  | `/portals`（传送门）             |

共同分页参数为 `limit`（1..100）和非负 `offset`；本前端固定使用 20。预期后端边界为 401（无效用户 Token）、403（权限不足）、422（参数校验失败）和 503（资料不可用）。本阶段不改变公共后端 Schema。

## 7. 数据、配置与外部服务

不涉及数据库、迁移、缓存、队列或持久状态变更，也不新增 npm 依赖。

```dotenv
# 独立开发通过 Vite 同源代理访问本地服务；生产不设置代理目标
VITE_API_BASE_URL=/api
VITE_API_PROXY_TARGET=http://127.0.0.1:8001
VITE_PUBLIC_BASE=/
VITE_APP_ENV=local
```

`VITE_API_PROXY_TARGET` 只由 Vite 开发服务器读取，不注入浏览器运行时代码；未设置时不创建开发代理。Token 必须由宿主 `getAccessToken` 在请求时提供，不进入 env 示例、源码、测试固件或日志。JCC 服务的重试沿用 React Query 默认策略；页面同时提供失败后的手动重试。

## 8. 代码变更清单

### 应用、服务与样式

- 修改 [App.tsx](../apps/app/src/App.tsx)：菜单、路由、fallback 与资源状态隔离；
- 新增 [JccResourcePage.tsx](../apps/app/src/pages/JccResourcePage.tsx)：筛选、分页、列表、错误态与详情；
- 新增 [jcc-api.ts](../apps/app/src/services/jcc-api.ts)：OpenAPI 对应类型和列表调用；
- 修改 [main.css](../apps/app/src/styles/main.css)：JCC 导航、资料卡片、表格和详情样式；
- 修改 [.env.example](../apps/app/.env.example)、[vite.config.ts](../apps/app/vite.config.ts)、[vite-env.d.ts](../apps/app/src/vite-env.d.ts) 与 [README](../README.md)：本地同源代理、类型和使用说明。

### 测试和文档

- 修改 [App.test.tsx](../apps/app/src/App.test.tsx)：六个路由、重定向、状态隔离和旧管理文案回归；
- 新增 `apps/app/src/pages/JccResourcePage.test.tsx`：分页、筛选、错误态和详情行为；
- 新增 [jcc-api.test.ts](../apps/app/src/services/jcc-api.test.ts)：路径、分页和空参数；
- 新增本总方案、[阶段计划](JCC_DATA_IMPLEMENTATION_PHASE_1_PLAN.md) 和 [执行记录](JCC_DATA_IMPLEMENTATION_PHASE_1_EXECUTION.md)。

## 9. 异常、安全与可观测性

| 场景             | 用户可见结果             | 内部处理                                                |
| ---------------- | ------------------------ | ------------------------------------------------------- |
| 401              | 登录状态已失效           | `ApiError` 抛出前调用宿主 `logout`；不泄漏 Token        |
| 403/422/其他错误 | 资料加载失败，可重试     | 隐藏旧快照、总数和结果；保留错误对象供 React Query 管理 |
| 503              | JCC 资料暂不可用，可重试 | fail closed，不展示缓存为当前成功结果                   |
| 页码越界         | 自动回到最后一个有效页   | 根据成功响应 `total` 重新计算页码                       |

页面仅拼装固定路径和显式筛选字段，不接受任意 URL；媒体 URL 仅用于浏览器图片和带 `rel="noreferrer"` 的新窗口链接。认证、授权和服务端限流由既有宿主/API 边界负责。前端不新增业务日志、指标或追踪，也不记录请求头、Token、Secret 或用户数据。

## 10. 测试与验收

### 自动化与静态检查

- API 单元测试：六个路径、分页、筛选映射和空值清理；
- 页面测试：初始/翻页 offset、筛选重置、页码校正、失败不显示旧元数据、完整详情和媒体链接；
- 导航测试：六个公开路由、fallback、跨资源状态和无 admin 操作；
- 回归命令：应用定向测试、应用全量测试、workspace lint/format/test/build、Prettier 源码/文档检查、`git diff --check`；
- 静态搜索：可见 UI 无“冒险”“星系”或管理操作；旧管理路由不再挂载；后端 `adventures`/`galaxies` 仅作为契约和内部标识。

### 真实环境边界

无 Token 请求用于确认本地 API 的 401 边界，不产生写入副作用。成功加载真实资料需要受控用户 Token，不进入普通自动化测试；未获授权时记录“未执行”，不得由 Mock 结论替代。

## 11. 部署与回滚检查

- [ ] 定向及全量自动化检查通过；
- [ ] 构建后不保留 `.turbo` 日志和 app `dist` 工作区变更；
- [ ] 各环境继续安全注入宿主 Token 和 API 基地址；
- [ ] 发布前在受控环境人工检查六个路由、筛选、分页、详情、401/503；
- [ ] GitHub `test` / `product` Environment、Variables 和 Secrets 已按 [CI/CD 方案](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PLAN.md) 配置；
- [ ] 外层 Nginx 已将 `/subapps/jcc/` 转发到 JCC 服务，主应用 `VITE_JCC_APP_ENTRY` 已同步；
- [ ] 真实 Token 验收、标签/镜像发布与 test/product 部署仅在另行授权后执行。

应用回滚不涉及数据：回退 JCC 前端版本即可；必要时可使用 `template/subapp-base@e63ad97` 恢复无业务壳。配置回退为既有 `/api` 及宿主参数，后端数据无需变更。

## 12. 分阶段实施顺序

本方案只有一个开发阶段，避免把同一批只读能力拆成相互重叠的阶段。真实部署验收是发布动作，不是另一个代码阶段。

### 第一阶段：模板基线与 JCC 只读资料接入

> 状态：实施中
>
> 阶段计划：[JCC_DATA_IMPLEMENTATION_PHASE_1_PLAN.md](JCC_DATA_IMPLEMENTATION_PHASE_1_PLAN.md)
>
> 执行记录：[JCC_DATA_IMPLEMENTATION_PHASE_1_EXECUTION.md](JCC_DATA_IMPLEMENTATION_PHASE_1_EXECUTION.md)

前置依赖：通用子应用壳、宿主鉴权桥和本地 JCC OpenAPI 可用；成功真实数据验收另需有效 Token。

开发内容：

1. 清理 admin 业务并固定 `template/subapp-base` 基线；
2. 接入六个列表契约、只读路由、筛选、分页、详情和错误状态；
3. 补充测试、使用说明、三层实施文档和 Git 产物清理。

本阶段不实现：写操作、登录、后端数据同步、生产发布和兼容标识重命名。

阶段验收：

- 六个公开路由与六个后端列表契约一一对应，UI 使用“特殊机制”“传送门”；
- 分页/筛选/详情/错误与资源切换边界有自动化证据；
- 模板分支不含 JCC 业务，最终 diff 不含构建/测试产物；
- 全量质量检查通过，真实环境未授权项被如实记录。

## 13. 风险、待确认项与决策记录

| 风险                                         | 影响                       | 缓解措施                                          | 状态             |
| -------------------------------------------- | -------------------------- | ------------------------------------------------- | ---------------- |
| 列表 total 在翻页间变化                      | 当前页可能为空             | 成功响应后校正到最后有效页                        | 计划处理         |
| React Router 复用同类型页面                  | 筛选或详情串到另一资源     | 资源 route 配置加稳定 key，并测试切换             | 计划处理         |
| 查询失败仍有缓存数据                         | 用户误以为旧数据是当前结果 | 错误态隐藏旧快照、总数、列表和详情                | 计划处理         |
| 无测试 Token                                 | 无法证明真实数据成功加载   | 自动化使用 Mock；发布前保留受控验收项             | 开放，非代码阻塞 |
| workspace/qiankun 标识仍含 `admin`/`mfe-app` | 静态搜索可能误判           | 文档明确源码兼容例外；运行时部署使用 JCC 独立标识 | 已缓解           |

当前没有阻塞代码实施的待确认项。

| 决策                    | 原因                                 | 未采用方案                            | 确认来源           |
| ----------------------- | ------------------------------------ | ------------------------------------- | ------------------ |
| 使用一个配置驱动资料页  | 六类列表行为一致，减少重复状态逻辑   | 六套独立页面会重复分页/错误代码       | 仓库结构与用户范围 |
| 详情复用列表项目        | 只有英雄存在单项接口，统一行为更可靠 | 为六类猜测详情 endpoint 会违反契约    | 本地 OpenAPI       |
| 未知/旧路由重定向英雄页 | URL、菜单和内容必须一致              | wildcard 直接渲染英雄页会保留错误 URL | 收尾审查           |

## 14. 完成标准

```text
用户进入六个前端路由之一
  ↓ 当前资源独立状态 + 明确筛选/分页
Bearer GET /jcc/*
  ↓
成功展示快照、列表和完整只读详情；失败显示明确错误并可重试
```

方案完成要求：第一阶段全部必需验收项有真实命令或测试证据；模板分支和源码兼容标识保持不变，运行时部署按独立 [CI/CD 方案](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PLAN.md) 隔离；工作区不含生成产物变更；总方案、阶段计划和执行记录互相链接且状态一致；未授权的真实数据和部署验证明确保留为发布前事项。
