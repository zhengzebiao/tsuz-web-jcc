# JCC 只读资料库：第 1 阶段“模板基线与资料接入”实现计划

> 状态：实施中
>
> 总实施方案：[JCC 只读资料库实施方案](JCC_DATA_IMPLEMENTATION_PLAN.md)
>
> 阶段执行记录：[JCC_DATA_IMPLEMENTATION_PHASE_1_EXECUTION.md](JCC_DATA_IMPLEMENTATION_PHASE_1_EXECUTION.md)
>
> 范围：完成基础模板分支、六类 JCC 只读资料接入、自动化验证与文档收尾；不实现管理写操作、后端同步或生产部署。

> 本计划于初版代码进入收尾审查时按项目协作规则补齐。实施前事实来自原始草案和当前工作区；下列内容是本阶段继续实施的契约，而不是对尚未验证结果的完成声明。

## 1. 背景与阶段基准

### 1.1 前置状态

- `main` 和 `template/subapp-base` 均指向 `e63ad97`，该提交已移除 admin 业务页面并保留 qiankun、鉴权、请求、状态、构建和部署基础能力；
- [createMfeApiClient](../apps/app/src/services/api-client.ts) 已将宿主 `apiBaseUrl`、`getAccessToken` 和 `logout` 交给 [通用 API 客户端](../packages/api/src/index.ts)；
- JCC 六个列表服务、六个路由和资料页面初版已在未提交工作区；此前定向测试和构建曾通过，但本阶段必须在最终代码上重新验证；
- 成功加载真实资料仍需用户提供有效 Token，不阻塞 Mock 自动化和代码收尾。

### 1.2 当前仓库事实

- [App.tsx](../apps/app/src/App.tsx) 初版将 wildcard 直接渲染成英雄页，导致未知 URL 与菜单/内容不一致；
- [JccResourcePage.tsx](../apps/app/src/pages/JccResourcePage.tsx) 初版由同一个组件实例承载不同资源，会复用页码、筛选和抽屉；也未处理 total 收缩后的页码越界；
- 查询错误时 React Query 可能保留上一成功查询数据，初版仍会展示旧快照、总数和分页；
- 初版详情遗漏 OpenAPI 中的英雄战斗/法力/技能值、羁绊 tier 元数据、地图 ID 和背景媒体字段；
- `Badge`、`Divider`、`JccListResponse` 为无用导入，`fetchResource` 使用 `as never` 弱化资源参数边界；
- `.turbo/*.log` 和 `apps/app/dist/index.html` 是基础提交中已跟踪的生成文件，运行验证后会产生无关工作区变更，最终必须恢复到模板基线；
- README 仍以基础模板为主，三份正式 JCC 方案文档尚未齐备。

上述差异属于初版实现的收尾缺口，不改变总方案业务目标。

### 1.3 本阶段目标

1. 固定无 JCC 业务的模板分支，并在 `main` 工作区完成六类只读资料契约和页面；
2. 修复路由、资源切换、分页、错误态、详情完整性和交互可访问性问题；
3. 为 API、导航和资料页核心行为补充自动化测试；
4. 清理生成产物与旧业务残留，并同步总方案、阶段计划和执行记录。

## 2. 范围与约束

### 2.1 本阶段实现

- 六个 `/jcc/*` 列表 GET 方法及 OpenAPI 对应 TypeScript 类型；
- 六个公开前端路由、配置驱动菜单和 fallback 重定向；
- 资源独立筛选状态、固定 20 条分页、总数越界校正、快照元数据、表格和完整列表项详情；
- 401/503/通用错误状态和手动重试；
- API、导航、页面交互测试及 workspace 全量质量检查；
- README、env 示例、总方案、阶段计划与执行记录；
- 验证后恢复 `.turbo` 日志与 app 构建输出的工作区变更。

### 2.2 本阶段明确不实现

- JCC 新增、编辑、删除、同步、上下线或其他 admin 管理能力；
- 登录页、Token 存储、权限策略或后端接口调整；
- 数据库、缓存、队列、迁移或后端数据导入；
- 包名、Docker/Compose 名、端口和 qiankun app name 的重命名；
- 未经授权的真实 Token 调用、生产部署、消息发送或其他外部副作用。

### 2.3 已确认约束

- UI 必须使用“特殊机制”和“传送门”，后端路径/内部资源 key 保留 `adventures` 和 `galaxies`；
- 分页固定 `limit=20`，offset 为零基；筛选或切换资源时回到第一页；
- 继续复用 `createMfeApiClient`，Token 只从宿主回调按请求获取；
- 详情统一复用列表响应中的完整项目，不为只有部分资源存在的接口制造不一致调用；
- 失败时 fail closed，不把旧查询数据展示为新查询成功结果；
- 不新增依赖，遵循现有 React、TypeScript、Ant Design、TanStack Query 和 Vitest 风格。

### 2.4 临时数据与隔离测试规则

本阶段不创建数据库、缓存或队列资源。所有普通测试使用固定非生产 Mock 响应和内存中的 `QueryClient`，不访问长期保留环境，不写入 Token、Secret 或真实用户数据。无 Token 的 GET 鉴权边界检查只读且无数据副作用；真实成功响应验证需要另行授权。

### 2.5 前置依赖与环境条件

| 依赖                   | 所需状态                    | 当前状态                  | 不满足时的处理                    |
| ---------------------- | --------------------------- | ------------------------- | --------------------------------- |
| `template/subapp-base` | 指向无 JCC 业务的基础壳提交 | 已满足：`e63ad97`         | 不移动分支，只复核                |
| 本地 OpenAPI           | `/jcc/*` Schema 可读取      | 已满足：2026-09-15 已核对 | 以已获取契约和类型测试继续        |
| 有效用户 Token         | 仅真实成功数据验收需要      | 未提供                    | 自动化用 Mock；执行记录标注未执行 |
| pnpm workspace 依赖    | 本地已安装，可运行测试/构建 | 待最终验证                | 命令失败则如实排查并记录          |

## 3. 详细设计与修改文件

### 3.1 路由和导航

修改：

- [App.tsx](../apps/app/src/App.tsx)：以单一资源配置生成菜单和路由；使用 `Navigate replace` 处理根、未知和旧管理地址；为资料页设置资源 key；
- [App.test.tsx](../apps/app/src/App.test.tsx)：验证六个菜单、直接路由、fallback、菜单选中、状态隔离和禁止文案。

设计：

1. 路由配置同时保存前端 path、后端资源 key、标题、说明和 icon，避免菜单/路由漂移；
2. 仅六个 path 是有效页面；其余地址统一重定向 `/heroes`；
3. `key={resource}` 使 React 在资源变化时卸载旧资料页，确保页码、筛选和详情不泄漏；
4. App 不参与数据请求，也不新增旧 URL 的兼容页面。

### 3.2 JCC API 契约

新增/修改：

- [jcc-api.ts](../apps/app/src/services/jcc-api.ts)：快照、六类项目、筛选和列表响应类型；六个 list 方法；
- [jcc-api.test.ts](../apps/app/src/services/jcc-api.test.ts)：路径、分页、资源筛选与空值清理。

设计：

- `cleanQuery` 只删除 `undefined` 和空字符串，保留合法数字 `0`；
- 每个公开 list 方法接收本资源精确参数类型并调用固定 GET 路径；
- 页面按资源分支构造显式参数，避免把其他资源筛选透传给后端；
- 不在服务层翻译 UI 名称，不保存 Token，也不加入请求重试逻辑。

### 3.3 资料页状态、分页和错误

新增/修改：

- [JccResourcePage.tsx](../apps/app/src/pages/JccResourcePage.tsx)：筛选草稿/已应用值、查询、表格、分页、错误、详情；
- `apps/app/src/pages/JccResourcePage.test.tsx`：核心页面行为；
- [main.css](../apps/app/src/styles/main.css)：资料页和可访问详情按钮样式。

设计：

1. 查询 key 包含资源、页码和清理后的筛选；`queryFn` 只传当前资源允许字段；
2. 查询/重置设置页码 1，翻页与结果集变化关闭旧详情；
3. 成功响应后计算 `max(1, ceil(total/20))`；当前页过大时只更新到最后有效页并由查询 key 获取正确页；
4. `query.isError` 时不将 `query.data` 传给快照、总数、列表或分页；手动重试沿用当前参数；
5. 行点击打开详情；“查看”使用带 aria-label 的按钮并停止冒泡；
6. 详情逐项覆盖 OpenAPI 中的当前 item 字段。数组和对象使用可读标签/键值列表；空值展示 `-`；媒体链接新窗口打开并带 `noreferrer`。

### 3.4 数据、迁移或状态

不涉及数据结构、迁移或持久状态变更。React 本地状态在资源组件卸载时清除；React Query 缓存只在内存中按 query key 隔离。

### 3.5 API、Schema 或公共契约

本阶段不改变后端公共契约。前端新增的可观察契约为六个路由和只读行为；根、未知和旧管理路由重定向到 `/heroes`。后端状态码语义由现有 `ApiError.status` 传给页面标题映射。

### 3.6 配置、依赖和外部服务

- 修改 [apps/app/.env.example](../apps/app/.env.example)、[vite.config.ts](../apps/app/vite.config.ts) 和 [vite-env.d.ts](../apps/app/src/vite-env.d.ts)：浏览器保持请求 `/api`，仅在设置 `VITE_API_PROXY_TARGET` 时由 Vite 开发服务器代理到本地 JCC endpoint，绕开本地服务 CORS 限制；
- 修改 [README.md](../README.md)：路由/API/Token/分页/错误/代理/模板分支/验证说明；
- 修改根 [package.json](../package.json)：移除不存在的 `.github/workflows/*.yml` 格式检查参数，使仓库现有 `format:check` 可执行；不变更 lockfile 或依赖；
- 外部调用仅为 JCC GET；自动化全部 Mock；Secret 继续由宿主注入且不得记录。

### 3.7 安全、权限与可观测性

- Bearer Token 由现有请求客户端按调用获取，401 先调用宿主 logout 再抛错；
- 页面不实现越权绕过、写操作或任意 endpoint；输入只进入 URL 查询参数并由后端继续校验；
- 错误状态不展示旧结果，避免把缓存误认为当前授权查询结果；
- 媒体外链使用 `target="_blank" rel="noreferrer"`；
- 本阶段不新增日志、指标或告警，也不输出认证信息。

## 4. 实施步骤

1. 建立总方案和本阶段实现计划，记录初版代码与审查差距；
2. 重构 App 资源配置、fallback 和组件 key，并补导航测试；
3. 修复资料页分页、错误态、参数映射和详情交互，删除无用导入；
4. 对照 OpenAPI补齐完整详情和对应样式；
5. 新增资料页测试并完善 API/中性夹具；
6. 更新 README、env 示例和原始草案状态；
7. 执行定向测试、应用测试、lint、格式、全量测试、build、静态搜索和 diff 检查；
8. 清除构建 assets，恢复已跟踪生成文件到 `template/subapp-base`，再复核 Git 状态；
9. 按真实命令结果创建/更新执行记录，并同步总方案与本计划状态。

真实 Token 和生产部署不在本阶段普通执行中；无授权时仅记录未执行。

## 5. 测试与验证计划

### 5.1 定向测试

| 测试文件/范围                        | 覆盖行为                                  | 预期结果                           |
| ------------------------------------ | ----------------------------------------- | ---------------------------------- |
| `src/services/jcc-api.test.ts`       | 六路径、各资源筛选、limit/offset、空值    | 调用固定 endpoint 且 query 精确    |
| `src/pages/JccResourcePage.test.tsx` | 首屏、翻页、筛选、越界校正、错误态、详情  | 状态和请求随用户操作正确变化       |
| `src/App.test.tsx`                   | 六路由/菜单、fallback、资源隔离、禁止文案 | path、菜单和页面一致，无旧业务入口 |

### 5.2 回归与质量检查

```bash
pnpm --filter tsuz-web-admin-app exec vitest run src/services/jcc-api.test.ts src/pages/JccResourcePage.test.tsx src/App.test.tsx
pnpm --filter tsuz-web-admin-app test
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm exec prettier --check apps/app/src/App.tsx apps/app/src/App.test.tsx apps/app/src/pages/JccResourcePage.tsx apps/app/src/pages/JccResourcePage.test.tsx apps/app/src/services/jcc-api.ts apps/app/src/services/jcc-api.test.ts README.md docs/curious-hugging-pixel.md plan/JCC_DATA_IMPLEMENTATION_*.md
git diff --check
git status --short --branch
git branch --all --verbose --no-abbrev
```

根 `format:check` 只检查仓库原有配置清单，不覆盖业务源码/Markdown，因此额外执行明确文件的 Prettier check。

### 5.3 真实环境验证

- 获取 `http://127.0.0.1:8001/openapi.json` 用于契约静态核对，无副作用；
- 无 Token 调用任一 `/jcc/*`，预期 401，用于证明鉴权边界；
- 六类真实成功响应和浏览器人工操作需要有效受控 Token，默认不进入 CI，未获授权时不执行；
- 不执行生产部署、写 API、数据迁移或外部消息操作。

## 6. 验收标准与追踪

| 编号    | 验收标准                                                                       | 实现位置                    | 验证方式                                 | 状态               |
| ------- | ------------------------------------------------------------------------------ | --------------------------- | ---------------------------------------- | ------------------ |
| AC-1-01 | 模板分支固定在无 JCC 业务的 `e63ad97`                                          | Git 分支                    | `git branch --all --verbose --no-abbrev` | 已满足，待最终复核 |
| AC-1-02 | 六个 UI 路由映射六个 JCC 列表，名称为“特殊机制”“传送门”                        | App、jcc-api                | App/API 测试和静态搜索                   | 实施中             |
| AC-1-03 | 每页 20 条，offset 正确；筛选/资源变化回第一页，total 收缩校正页码             | JccResourcePage             | 页面测试                                 | 实施中             |
| AC-1-04 | 详情覆盖 OpenAPI 列表项全部字段，查看按钮不重复触发行点击                      | JccResourcePage             | 页面测试和代码核对                       | 实施中             |
| AC-1-05 | 401/503/通用失败可理解且失败不显示旧元数据/结果                                | API client、JccResourcePage | 既有 API 测试 + 页面测试                 | 实施中             |
| AC-1-06 | 无旧管理路由/操作或可见“冒险/星系”文案；兼容 admin 标识仅保留于部署/包配置说明 | App、README、配置           | 测试和静态搜索                           | 实施中             |
| AC-1-07 | 定向、lint、格式、全量测试、build 和 diff 检查通过                             | workspace                   | 验证命令                                 | 待执行             |
| AC-1-08 | 三份正式文档互链、状态和真实结果一致，工作区不含生成产物 diff                  | plan、Git                   | 文档核对和 `git status`                  | 实施中             |
| AC-1-09 | 未授权的真实数据成功加载不被误记为通过                                         | 执行记录                    | 文档核对                                 | 待执行             |

## 7. 风险、回滚与异常处理

| 风险或失败场景    | 影响                      | 预防/检测                     | 回滚或恢复                                                 |
| ----------------- | ------------------------- | ----------------------------- | ---------------------------------------------------------- |
| 状态在资源间复用  | 错误筛选/API 参数或旧详情 | route key + App/页面测试      | 回退对应 App 改动                                          |
| total 收缩        | 停在空白高页              | 成功响应后页码校正测试        | 回到第一页或最后有效页                                     |
| Query 缓存残留    | 错误时误导用户            | 错误分支显式不使用 data       | 重试当前请求                                               |
| 详情字段遗漏      | 不满足“完整资料”          | OpenAPI 字段逐项映射 + 测试   | 补齐显示，不改后端                                         |
| 构建改动污染 diff | 提交无关日志/产物         | 最后恢复模板基线并检查 status | `git restore --source=template/subapp-base` 仅针对生成文件 |
| 外部服务不可用    | 无法真实联调              | Mock 自动化与真实验收分开     | 不修改数据，服务恢复后再验收                               |

应用改动均为无持久状态的前端文件，可按文件回退；模板分支不移动。清理只针对本轮忽略 assets 和已确认的生成文件，不删除用户业务源码。

## 8. 阶段交付物

代码与配置：App 路由、JCC API、资源页面、样式、env 示例。

测试：App、JCC API、JCC 资源页，以及现有 workspace 回归。

文档：

- 更新 [总实施方案](JCC_DATA_IMPLEMENTATION_PLAN.md) 的阶段状态与链接；
- 更新本阶段计划的状态和最终设计调整；
- 创建或更新 [第 1 阶段执行记录](JCC_DATA_IMPLEMENTATION_PHASE_1_EXECUTION.md)；
- 更新 [README](../README.md) 和 [原始草案](../docs/curious-hugging-pixel.md) 的当前指引。

## 9. 计划调整记录

| 调整项   | 原始草案                               | 最终阶段契约                              | 原因                                                                       | 对后续影响                       |
| -------- | -------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------- | -------------------------------- |
| 阶段划分 | 草案按模板/API/UI/文档列为四个实施段落 | 统一作为第 1 阶段的依赖顺序               | 这些内容已经在同一未提交工作区连续实施，拆为多个“已完成阶段”会制造虚假历史 | 无后续代码阶段                   |
| fallback | wildcard 直接渲染英雄页                | `Navigate replace` 到 `/heroes`           | 保证 URL、菜单、页面一致                                                   | 旧/未知 URL 行为明确             |
| 详情来源 | “详情弹窗展示完整资料”                 | 使用列表 item，不额外请求详情             | OpenAPI 只有英雄存在详情 endpoint，六类统一复用列表可避免契约猜测          | 若后端未来补齐详情接口可另行设计 |
| 本地 API | env 可直接指向 `http://127.0.0.1:8001` | 浏览器请求 `/api`，Vite 通过 `VITE_API_PROXY_TARGET` 转发 | 浏览器验收发现本地 API 的 401 响应没有 CORS 头，直接跨域只能显示网络失败 | 独立开发可观察真实 401；部署不受影响 |
| 格式检查 | 根 `pnpm format:check` | 修正不存在的 workflow 参数，并额外检查业务/文档文件 | 首次执行发现仓库没有脚本引用的 `.github/workflows/*.yml`，且根脚本不覆盖源码/Markdown | 命令恢复可执行，验证覆盖更完整 |
