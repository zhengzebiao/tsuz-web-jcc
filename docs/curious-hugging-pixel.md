# 前期实施草案

> 状态：已由正式方案接替（2026-09-15）
>
> 当前实施与验收基准请参见 [JCC 只读资料库实施方案](../plan/JCC_DATA_IMPLEMENTATION_PLAN.md)、[第 1 阶段实现计划](../plan/JCC_DATA_IMPLEMENTATION_PHASE_1_PLAN.md) 和 [第 1 阶段执行记录](../plan/JCC_DATA_IMPLEMENTATION_PHASE_1_EXECUTION.md)。本文保留实施开始前的上下文与原始步骤，其中“当前”仓库状态不再代表收尾阶段事实。

当前项目是从 admin 子应用模板复制而来的 React/qiankun 微前端。用户已初始化 Git，希望先清除 admin 业务代码并在该干净基础上创建 `template/subapp-base` 备用分支，再在当前开发分支接入本地 JCC 只读资料列表。JCC 后端 OpenAPI 已在 `http://127.0.0.1:8001` 提供 `/jcc/*` 接口，其中前端展示名称要求将 `adventures` 显示为“特殊机制”、将 `galaxies` 显示为“传送门”。目标是保留通用微前端、鉴权、请求和部署能力，不实现任何 admin 管理操作。

## 已核对的仓库事实

- 当前分支为 `main`，Git 尚无提交，工作区为初始化后的未跟踪项目文件；因此必须先形成一个提交，才能可靠地创建模板分支。
- [apps/app/src/App.tsx](apps/app/src/App.tsx) 目前只挂载用户、角色、权限三个 admin 路由；admin 页面、弹窗、服务和测试均集中在 `apps/app/src/pages/` 与 `apps/app/src/services/admin-*.ts`。
- [packages/api/src/index.ts](packages/api/src/index.ts) 已实现 Bearer Token 注入、401 回调和通用请求；[apps/app/src/services/api-client.ts](apps/app/src/services/api-client.ts) 已接入 qiankun 的 `getAccessToken`，继续复用。
- JCC 列表接口统一使用 `limit`/`offset` 分页并返回 `snapshot`、`items`、`total`；接口包括 heroes、traits、equipment、augments、adventures、galaxies。后端要求用户 Bearer Token，未提供 Token 时返回 401；真实数据验收不能伪造为通过。
- 当前 Docker/部署端口和包名仍包含历史 admin 标识；本次只清理 admin 业务，不擅自更改部署镜像、Compose 项目名、qiankun 入口等兼容标识。

## 实施方案

### 1. 建立可复用基础模板并创建分支

1. 补充必要的忽略规则，避免把 `node_modules`、`dist`、`.turbo`、`.DS_Store` 和本地环境文件写入首次提交。
2. 删除 admin 页面、admin 服务、角色/权限/用户关联弹窗及其测试；将应用入口改为不包含业务菜单的通用子应用壳，并移除 admin 专属 CSS 和测试断言。
3. 将 README 的业务描述改为通用子应用基础壳，同时注明包名/部署标识保留是为了兼容现有发布配置。
4. 执行基础 lint、测试和构建，确认 admin 清理后的壳可独立运行。
5. 在 `main` 上提交该清理节点（这是因为仓库尚无提交、创建分支所必需的本地提交），从该提交创建 `template/subapp-base`，然后回到 `main`。模板分支不包含 JCC 具体资料页面，作为后续子应用复用基线；不覆盖或重写用户已有分支。

### 2. 接入 JCC API 契约

1. 新增 `apps/app/src/services/jcc-api.ts`，按本地 OpenAPI 定义 `JccSnapshotMetadata`、六类资料项、列表响应和各自查询参数。
2. 实现 `listJccHeroes`、`listJccTraits`、`listJccEquipment`、`listJccAugments`、`listJccAdventures`、`listJccGalaxies`，统一将 `limit`、`offset` 以及筛选项传给 `/jcc/*`；底层仍使用现有 `ApiClient`，不增加依赖、不保存 Token。
3. 保留后端路径和内部 API 命名 `adventures`/`galaxies`，只在 UI 层映射为“特殊机制”/“传送门”，避免改变外部契约。
4. 为 API 方法补充 Mock 单元测试，覆盖路径、分页和筛选参数，确保 undefined 筛选不会被错误发送。

### 3. 实现 JCC 只读资料界面

1. 新增配置驱动的 `JccResourcePage`（及必要的类型/展示组件），复用 React Query、Ant Design Table、PageContainer 和现有 API 客户端。
2. 在 [apps/app/src/App.tsx](apps/app/src/App.tsx) 中将导航和路由替换为：
   - `/heroes`：英雄
   - `/traits`：羁绊
   - `/equipment`：装备
   - `/augments`：强化符文
   - `/special-mechanics`：特殊机制（请求 `/jcc/adventures`）
   - `/portals`：传送门（请求 `/jcc/galaxies`）
3. 每个资源提供符合字段的只读列和筛选：英雄支持名称、特质 ID、职业 ID、价格；羁绊支持名称和 race/job；装备支持名称和类型；强化符文支持名称和等级；特殊机制支持标题和价格；传送门支持名称。
4. 统一转换分页为 `limit=20`、`offset=(page-1)*20`，展示总数和快照元数据（模式、赛季、版本、修订号）；筛选或切换分类后回到第一页。
5. 通过详情弹窗展示当前行的完整资料、描述、组件/等级/特质等嵌套内容及可用图片/视频链接；只读展示，不加入创建、编辑、启用、删除等 admin 操作。列表接口失败时提供重试，401 继续走已有宿主 logout，503 显示资料暂不可用。
6. 更新样式为 JCC 资料页面使用的通用 class，补充 App 导航和列表/详情交互测试；测试使用 Mock，不调用真实服务。

### 4. 配置、文档与阶段记录

1. 为独立本地开发更新 `apps/app/.env.example` 的说明/默认示例，使其可指向 `http://127.0.0.1:8001`；部署默认 `/api` 和宿主传入的 `apiBaseUrl` 保持兼容，并明确本地接口仍需要有效 Bearer Token。
2. 更新 README 的路由、接口、Token、分页、端口和本地验证说明；保留历史包名/部署标识的兼容说明，不把它们误写成业务能力。
3. 按项目规则新增并维护：
   - `plan/JCC_DATA_IMPLEMENTATION_PLAN.md`：总方案、阶段状态、模板分支节点和后续范围；
   - `plan/JCC_DATA_IMPLEMENTATION_PHASE_1_PLAN.md`：本阶段清理、分支和只读列表契约；
   - `plan/JCC_DATA_IMPLEMENTATION_PHASE_1_EXECUTION.md`：实际改动、分支结果、测试输出、真实环境限制和验收映射。

## 验证计划

按顺序执行并如实记录：

```bash
pnpm --filter tsuz-web-admin-app test
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm git status --short --branch
```

同时用静态搜索确认业务源码和 README 不再引用 `/admin/*`、用户/角色/权限管理或 admin 操作；确认 UI 文案使用“特殊机制”和“传送门”，而不是“冒险”和“星系”。如果启动本地服务进行人工验证，检查六个路由、筛选、分页、详情和错误重试；由于当前接口实测无 Token 返回 401，未取得有效测试 Token 时只记录接口可达/鉴权边界，不宣称真实资料加载通过。需要真实 JCC 数据的浏览器验收由用户提供授权 Token 后执行，不在普通自动化测试中产生外部副作用。
