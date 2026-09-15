# tsuz-web-jcc

这是一个基于 React、Vite 和 qiankun 的通用微前端子应用基础工程。项目最初由 admin 子应用模板生成，当前已移除用户、角色、权限等 admin 业务代码，保留可独立运行和被主应用挂载的基础能力。

> 包名、Docker 镜像名和部分部署标识暂时保留历史 `admin` 名称，以兼容现有发布配置；它们不代表当前业务功能。

## 技术栈

- React
- TypeScript
- Vite
- qiankun / vite-plugin-qiankun
- React Router
- Zustand
- TanStack Query
- Ant Design
- Vitest / Testing Library
- Docker / nginx / docker compose
- pnpm workspace / Turbo

## 本地开发

安装依赖并启动子应用：

```bash
pnpm install
pnpm dev
```

子应用默认运行在 <http://localhost:7202>。当前基础模板不提供具体业务页面，后续业务子应用应在此基础上增加自己的路由和页面。

## 主应用挂载

主应用运行在 7200 端口、当前子应用运行在 7202 端口时，主应用可以通过 qiankun 挂载本子应用。挂载时可传入：

- `apiBaseUrl`：API 基地址；
- `getAccessToken`：读取当前登录用户 Token；
- `getCurrentUser`：读取当前用户信息；
- `logout`：收到 401 时执行登出；
- `basename` 和 `container`：由 qiankun 提供的路由与挂载容器信息。

请求客户端会自动将 `getAccessToken` 返回的值作为 Bearer Token 注入请求，不在子应用中保存 Token。

## 配置

复制 `apps/app/.env.example` 为本地环境文件后按需修改：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | 独立运行时的 API 基地址；由宿主传入时优先使用宿主配置 |
| `VITE_PUBLIC_BASE` | `/` | Vite 静态资源基路径 |
| `VITE_APP_ENV` | `local` | 构建环境标识 |

本地 JCC API 可将 `VITE_API_BASE_URL` 设置为 `http://127.0.0.1:8001`。API 受 Bearer Token 保护，未配置有效 Token 时返回 401 属于预期行为。

## 质量检查

```bash
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

## 项目结构

| 路径 | 用途 |
| --- | --- |
| `apps/app/src/main.tsx` | 独立启动和 qiankun 生命周期导出 |
| `apps/app/src/bootstrap.tsx` | React 根节点渲染与销毁边界 |
| `apps/app/src/qiankun.ts` | qiankun bootstrap、mount、unmount、update |
| `apps/app/src/App.tsx` | 子应用基础路由壳 |
| `apps/app/src/providers/AppProviders.tsx` | React Query、Router 和 Ant Design Provider |
| `apps/app/src/stores/app.store.ts` | 独立运行和 qiankun 挂载状态 |
| `apps/app/src/services/api-client.ts` | 带鉴权桥接的 API 客户端 |
| `packages/api/src/index.ts` | 通用 fetch API 客户端 |
| `packages/shared/src/index.ts` | 微前端、鉴权和路由契约 |
| `packages/ui/src/index.tsx` | 通用 UI 基础组件 |
| `Dockerfile` | nginx 生产镜像构建 |
| `nginx/nginx.conf` | SPA fallback 和 qiankun 跨域响应头 |
| `docker-compose.yml` | 本地容器编排，默认映射 7202 端口 |

## API 与安全边界

当前基础模板不定义具体业务 API。业务子应用应复用 `createMfeApiClient` 和 `@tsuz/api`，通过宿主提供的 Token 访问受保护接口。401 应继续交由宿主的 `logout` 处理；不得将 Token、Secret 或真实用户数据提交到仓库、日志或测试固件中。

## Docker

```bash
pnpm docker:build
pnpm docker:run
pnpm compose:up
pnpm compose:down
```

`VITE_API_BASE_URL`、`VITE_PUBLIC_BASE` 和 `VITE_APP_ENV` 都是构建时变量，修改部署值需要重新构建镜像。现有 Docker、nginx、Compose 和 CI/CD 标识暂不重命名，避免影响既有部署流程。

## 模板分支

清理 admin 业务并通过基础质量检查后，将创建 `template/subapp-base` 分支，保存不包含具体业务页面的通用子应用基础壳。后续 JCC 资料功能在开发分支继续实现，模板分支作为复用和回溯基线。
