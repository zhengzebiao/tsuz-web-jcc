# tsuz-web-jcc

这是一个基于 React、Vite 和 qiankun 的 JCC 只读资料子应用。登录用户可以检索六类当前版本资料、按 20 条分页并查看完整详情；应用不提供创建、编辑、启用、删除或同步等管理操作。

> 包名、Docker 镜像名和部分部署标识暂时保留历史 `admin` 名称，以兼容现有发布配置；它们不代表当前业务功能。

## 功能与路由

| 前端路由             | 页面名称 | 后端列表接口          | 筛选                         |
| -------------------- | -------- | --------------------- | ---------------------------- |
| `/heroes`            | 英雄     | `GET /jcc/heroes`     | 名称、特质 ID、职业 ID、价格 |
| `/traits`            | 羁绊     | `GET /jcc/traits`     | 名称、种族/职业              |
| `/equipment`         | 装备     | `GET /jcc/equipment`  | 名称、类型                   |
| `/augments`          | 强化符文 | `GET /jcc/augments`   | 名称、等级                   |
| `/special-mechanics` | 特殊机制 | `GET /jcc/adventures` | 标题、价格                   |
| `/portals`           | 传送门   | `GET /jcc/galaxies`   | 名称                         |

根路径、未知地址和旧业务地址统一重定向到 `/heroes`。前端只在后端契约和内部类型中保留 `adventures`、`galaxies` 标识；用户界面统一使用“特殊机制”和“传送门”。

所有列表固定每页 20 条，将页码转换为 `limit=20` 和 `offset=(page-1)*20`。筛选、重置或切换资源时回到第一页；服务端总数收缩后，页面会回到最后一个有效页。详情直接展示列表响应中的完整项目字段和可用图片/视频链接。

## 技术栈

- React 19 / TypeScript / Vite
- qiankun / vite-plugin-qiankun
- React Router
- Zustand / TanStack Query
- Ant Design
- Vitest / Testing Library
- pnpm workspace / Turbo
- Docker / nginx / docker compose

## 本地开发

安装依赖，复制环境示例，然后启动子应用：

```bash
pnpm install
cp apps/app/.env.example apps/app/.env.local
pnpm dev
```

子应用默认运行在 <http://localhost:7202>。环境示例让浏览器请求同源 `/api`，再由 Vite 开发服务器代理到 <http://127.0.0.1:8001>，避免本地 JCC 服务未开放 CORS 时被浏览器拦截。该服务受 Bearer Token 保护，单独启动页面但没有宿主 Token 时收到 401 属于预期行为。

若本地 JCC 服务使用其他地址，可调整 `.env.local` 中的 `VITE_API_PROXY_TARGET`；若已有同源代理，则可以不设置代理目标并按需修改 `VITE_API_BASE_URL`。不要把 Token、Secret 或真实用户数据写入 env 示例、源码或测试。

## 主应用挂载

主应用可通过 qiankun 挂载本子应用，并传入：

- `apiBaseUrl`：API 基地址，优先于独立运行环境配置；
- `getAccessToken`：按请求读取当前用户 Token；
- `getCurrentUser`：读取当前用户信息；
- `logout`：API 返回 401 时执行登出；
- `basename` 和 `container`：路由基础路径与挂载容器。

请求客户端会将 `getAccessToken` 的非空值作为 Bearer Token 注入请求，不在子应用状态或持久存储中保存 Token。401 显示“登录状态已失效”并继续走宿主 logout；503 显示“JCC 资料暂不可用”；其他错误显示通用失败，均可手动重新加载。失败状态不会把上一次查询的快照、总数或结果显示为当前成功数据。

## 配置

| 变量                    | 独立开发示例 / 默认行为     | 用途                                         |
| ----------------------- | -------------------------- | -------------------------------------------- |
| `VITE_API_BASE_URL`     | `/api`                     | 浏览器请求基地址；宿主传值优先               |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8001`    | 仅供 Vite 开发服务器代理 `/api`；不进入前端  |
| `VITE_PUBLIC_BASE`      | `/`                        | Vite 静态资源基路径                          |
| `VITE_APP_ENV`          | `local`                    | 构建环境标识                                 |

这些变量都是构建时变量，修改部署值需要重新构建镜像。

## 质量检查

```bash
pnpm --filter tsuz-web-admin-app exec vitest run \
  src/services/jcc-api.test.ts \
  src/pages/JccResourcePage.test.tsx \
  src/App.test.tsx
pnpm --filter tsuz-web-admin-app test
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

自动化测试使用 Mock，不调用真实 JCC 数据服务。真实数据成功加载需要受控用户 Token，应在获得明确授权的环境中人工检查六个路由、筛选、分页、详情和错误重试；不能用 Mock 结果替代该验收。

## 项目结构

| 路径                                      | 用途                                         |
| ----------------------------------------- | -------------------------------------------- |
| `apps/app/src/App.tsx`                    | JCC 菜单、六个公开路由和 fallback            |
| `apps/app/src/pages/JccResourcePage.tsx`  | 配置驱动的筛选、分页、列表、错误与详情页     |
| `apps/app/src/services/jcc-api.ts`        | JCC OpenAPI 对应类型和六个列表调用           |
| `apps/app/src/services/api-client.ts`     | 带宿主鉴权桥接的 API 客户端                  |
| `apps/app/src/stores/app.store.ts`        | 独立运行和 qiankun 挂载状态                  |
| `apps/app/src/providers/AppProviders.tsx` | React Query、Router 和 Ant Design Provider   |
| `packages/api/src/index.ts`               | 通用 fetch API 客户端和 401 回调             |
| `packages/shared/src/index.ts`            | 微前端、鉴权和路由契约                       |
| `packages/ui/src/index.tsx`               | 通用 UI 基础组件                             |
| `plan/JCC_DATA_IMPLEMENTATION_PLAN.md`    | JCC 总实施方案                               |
| `Dockerfile` / `nginx/nginx.conf`         | 生产镜像、SPA fallback 和 qiankun 跨域响应头 |

## Docker

```bash
pnpm docker:build
pnpm docker:run
pnpm compose:up
pnpm compose:down
```

现有 Docker、nginx、Compose、包名和 CI/CD 标识暂不重命名，避免影响既有发布流程。本仓库中的 JCC 改动不包含生产部署或真实数据迁移。

## 模板分支与实施记录

`template/subapp-base` 已固定在提交 `e63ad97`，保存不包含 JCC 具体业务页面的通用子应用基础壳。JCC 资料功能在 `main` 工作区继续开发，模板分支不得被当前业务变更污染。

方案与阶段事实参见：

- [JCC 只读资料库实施方案](plan/JCC_DATA_IMPLEMENTATION_PLAN.md)
- [第 1 阶段实现计划](plan/JCC_DATA_IMPLEMENTATION_PHASE_1_PLAN.md)
- [第 1 阶段执行记录](plan/JCC_DATA_IMPLEMENTATION_PHASE_1_EXECUTION.md)
- [前期实施草案](docs/curious-hugging-pixel.md)
