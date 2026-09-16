# GitHub Actions CI/CD 实施方案

> 状态：已完成（代码配置；真实发布待环境验证）
>
> 本方案基于当前 pnpm/Turbo、Docker/nginx/Compose 架构，以及 `../tsuz-web-admin/.github/workflows/ci.yml` 和 `deploy.yml` 的既有发布流程。
>
> 第一阶段：[实现计划](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_PLAN.md)｜[执行记录](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_EXECUTION.md)
>
> 相关业务方案：[JCC 只读资料库实施方案](JCC_DATA_IMPLEMENTATION_PLAN.md)

## 1. 已确认配置与关键决策

| 项目       | 决策或配置                                                                 | 状态/来源                     |
| ---------- | -------------------------------------------------------------------------- | ----------------------------- |
| 参考实现   | 复用 `tsuz-web-admin` 的 CI、标签发布和手动回滚流程                        | 已确认；用户要求              |
| CI 门禁    | Node 20、pnpm 8.15.9，执行冻结安装、lint、格式、测试和构建                 | 已确认；参考工作流与当前脚本  |
| 发布标签   | `test-vX.Y.Z` 对应 `test`，`product-vX.Y.Z` 对应 `product`                 | 已确认；参考工作流            |
| JCC 隔离   | 镜像/容器/Compose 使用 `tsuz-web-jcc`，端口 7202，资源前缀 `/subapps/jcc/` | 合理默认；当前 JCC/主应用配置 |
| 兼容范围   | workspace 包名 `tsuz-web-admin*` 和 qiankun 名 `mfe-app` 本阶段不改        | 已确认；降低无关兼容风险      |
| 外部资源   | GitHub Environments、Variables、Secrets、镜像仓库和部署服务器需发布前配置  | 待环境配置；不能视为已就绪    |
| 副作用边界 | 本阶段不创建标签、不推送镜像、不 SSH 部署、不修改 GitHub 配置              | 已确认；用户仅要求代码修改    |

## 2. 背景与现状

### 2.1 背景

JCC 子应用已有可生产构建的 Docker/nginx/Compose 资产，但仓库缺少 GitHub Actions，无法在 PR/主分支自动执行质量门禁，也没有与 admin 一致的可审计标签发布和历史镜像回滚入口。

### 2.2 当前架构

- [package.json](../package.json) 提供 Turbo 的 `lint`、`test`、`build` 与 Prettier 命令；
- [Dockerfile](../Dockerfile) 通过 Node 20 构建 Vite 产物并由 nginx 提供静态文件；
- [docker-compose.yml](../docker-compose.yml) 运行单个 JCC app 服务，宿主端口为 7202；
- [vite.config.ts](../apps/app/vite.config.ts) 从 `VITE_PUBLIC_BASE` 生成部署资源基路径；
- 主应用已支持 `VITE_JCC_APP_ENTRY` 和 7202 的 JCC 入口，外层 Nginx 映射仍由实际环境负责。

### 2.3 现状差距

仓库没有 `.github/workflows`，根格式脚本也未覆盖 workflow；Docker/Compose 默认名称仍为 `tsuz-web-admin`，若直接复制 admin 部署文件可能导致容器和 Compose 项目冲突。GitHub 环境变量、Secret 与目标服务器状态无法从仓库确认。

## 3. 目标与非目标

### 3.1 目标

1. PR 与主分支提交自动执行完整质量门禁；
2. 使用不可变标签完成服务器端精确源码构建、镜像推送和隔离部署；
3. 支持按环境校验的历史镜像手动回滚；
4. 以 JCC 独立标识运行，并完整记录配置、安全和运维前提。

### 3.2 非目标

- 本阶段不实际创建 GitHub Environment、Variables 或 Secrets；
- 不创建/推送标签、镜像，不连接服务器或执行真实 test/product 部署；
- 不修改主应用仓库或真实外层 Nginx；
- 不重命名 workspace 包、源码 import 或 qiankun 内部应用名；
- 不改变 JCC API、业务数据或用户功能。

## 4. 核心流程与边界

### 4.1 CI

```text
push / pull_request（main 或 master）
  ↓ checkout + Node 20 + pnpm 8.15.9
冻结锁文件安装
  ↓
lint → format:check → test → build
```

任一步失败即阻断该 job，不发布任何制品。

### 4.2 标签发布

```text
test-vX.Y.Z / product-vX.Y.Z
  ↓ 解析并校验环境、不可变标签
部署服务器检出标签并校验 GitHub SHA
  ↓ Docker build（JCC 构建参数）
镜像仓库 push
  ↓ 上传 Compose 与运行时 .env
独立 Compose 项目 up --no-build
  ↓ 最多 30 次检查容器 running 状态
```

### 4.3 手动回滚

`workflow_dispatch` 只接受环境匹配的完整历史标签，跳过源码构建，登录仓库、拉取指定镜像并通过同一 Compose 配置启动。`latest`、非法标签和 test/product 前缀错配均 fail closed。

## 5. 总体设计与兼容策略

- 复制 admin 已验证的工作流结构及输入校验，不另建发布系统；
- GitHub Environment 按 `test` / `product` 隔离配置，并可为 product 增加审批；
- 服务器源码目录与运行目录必须分离，远端 tag 解析结果必须匹配当前 Actions SHA；
- 构建时固定注入 `VITE_API_BASE_URL`、`VITE_PUBLIC_BASE`、`VITE_APP_ENV`，历史镜像保留当时配置；
- JCC 使用 `/subapps/jcc/`、7202 和独立容器/Compose 名，不影响 admin 7201；
- 保留现有包名和 qiankun 名，避免将部署隔离扩展成源码重命名。

## 6. 配置与外部契约

### 6.1 GitHub Environment Variables

`DOCKER_REGISTRY`、`DOCKER_IMAGE_NAME`、`DOCKER_REGISTRY_USERNAME`、`DOCKER_BUILD_PLATFORM`、`DEPLOY_HOST`、`DEPLOY_PORT`、`DEPLOY_USER`、`DEPLOY_PATH`、`DEPLOY_REPO_PATH`、`CONTAINER_NAME`、`APP_PORT`、`APP_ENV`、`VITE_API_BASE_URL`、`VITE_PUBLIC_BASE`。

默认约定：`DOCKER_BUILD_PLATFORM=linux/amd64`、`DEPLOY_PORT=22`、`APP_PORT=7202`、`VITE_API_BASE_URL=/api`、`VITE_PUBLIC_BASE=/subapps/jcc/`。真实域名、账号、路径和镜像名按环境注入，仓库不声明其已就绪。

### 6.2 Secrets

- `DOCKER_REGISTRY_TOKEN`：仅通过 stdin 传给 `docker login`，不写入运行时 `.env`；
- `SSH_PRIVATE_KEY`：写入 Actions runner 的临时私钥文件并设为 600；
- `SSH_KNOWN_HOSTS`：可选固定 host key；为空时沿用参考流程的 `ssh-keyscan`。

### 6.3 服务器与网络前提

部署服务器需安装 Git、Docker、Docker Compose plugin，能访问 GitHub 与镜像仓库，并拥有当前私有仓库的只读权限。外层 Nginx 需将 `/subapps/jcc/` 转发至 JCC 7202，主应用构建时需将 `VITE_JCC_APP_ENTRY` 指向对应入口。

本方案不涉及数据库、缓存、队列、迁移或持久业务状态，也不新增 npm 依赖。

## 7. 模块与文件变更

- 新增 [.github/workflows/ci.yml](../.github/workflows/ci.yml)：PR/主分支质量门禁；
- 新增 [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)：标签发布和手动回滚；
- 新增 [.env.deploy.example](../.env.deploy.example)：无敏感值的手工部署配置示例；
- 修改 [package.json](../package.json)：workflow 格式检查及 JCC Docker 镜像脚本；
- 修改 [docker-compose.yml](../docker-compose.yml)：JCC 独立默认镜像、容器与项目名；
- 修改 [README.md](../README.md)：GitHub 配置、发布、回滚和主应用接入说明；
- 更新本方案、[阶段计划](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_PLAN.md)和[阶段执行记录](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_EXECUTION.md)。

## 8. 异常、安全与可观测性

| 场景                 | 结果                                 | 保护                       |
| -------------------- | ------------------------------------ | -------------------------- |
| 非法或环境错配标签   | 解析 job 失败                        | 完整正则和前缀校验         |
| 镜像名/路径/端口非法 | 构建或部署前失败                     | shell 白名单校验           |
| 远端标签 SHA 不一致  | 禁止构建                             | 同时核对轻量/附注 tag 解析 |
| 回滚镜像不存在       | pull 失败，旧容器不被宣称成功        | Compose 命令 fail closed   |
| 容器未运行           | 最多等待 150 秒后输出 ps/logs 并失败 | 显式状态检查               |
| 缺少凭证或变量       | 对应 job 立即失败                    | `${VAR:?}` 校验            |

工作流不打印 Secret；运行时 `.env` 仅含镜像、版本、容器和公开构建配置并设为 600。并发组按仓库串行部署，防止同仓库环境部署互相穿插。当前只检查容器 `running`，不等价于 HTTP 业务健康检查，发布环境应结合外部探针继续验证。

## 9. 测试与验收

- 执行 `pnpm format:check`、`pnpm lint`、`pnpm test`、`pnpm build`；
- 执行 `docker compose config`，核对镜像、项目、容器、端口和构建参数；
- 若本机存在 `actionlint` 则检查两个 workflow，否则记录未执行；
- 执行 `git diff --check` 和静态搜索，确保 deploy 不残留 admin 资源前缀、7201 或 admin 容器默认名；
- 标签推送、镜像仓库、SSH、外层 Nginx 和真实部署属于发布前环境验证，不以本地静态检查替代。

## 10. 部署与回滚检查清单

- [ ] GitHub `test` / `product` Environments 已创建；
- [ ] Variables 和 Secrets 已通过安全渠道配置，未提交到仓库；
- [ ] product 审批规则按实际发布制度配置；
- [ ] 服务器工具、仓库只读权限、目录权限和镜像仓库网络可用；
- [ ] 外层 Nginx `/subapps/jcc/` 和主应用 `VITE_JCC_APP_ENTRY` 已配置；
- [ ] 首个 test 标签发布后验证静态资源、六个路由、API 和回滚；
- [ ] production 发布前完成同版本 test 验收。

回滚使用 Actions → Deploy 的手动入口选择环境和历史标签。它不会改变数据库；若新版本异常，回滚到上一不可变镜像并复核容器、静态资源、主应用挂载和 API 调用。

## 11. 分阶段实施顺序

### 第一阶段：工作流与部署隔离配置

> 状态：已完成（真实发布待环境验证）
>
> 阶段计划：[GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_PLAN.md](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_PLAN.md)
>
> 执行记录：[GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_EXECUTION.md](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_EXECUTION.md)

前置依赖：现有 Docker/nginx/Compose 构建可用，admin 工作流可读取；真实 GitHub/服务器配置不作为代码实施前提。

开发内容：复刻 CI/Deploy、适配 JCC 标识、增加部署示例和文档、执行本地无副作用验证。

本阶段不实现：外部资源配置、标签/镜像推送、真实部署、外层 Nginx 或主应用修改。

阶段验收：本地 CI 命令通过；Compose 和 workflow 配置可解析；JCC 与 admin 默认部署标识隔离；未执行的外部验证被明确记录。

## 12. 风险与决策记录

| 风险                        | 影响                           | 缓解措施                                          | 状态         |
| --------------------------- | ------------------------------ | ------------------------------------------------- | ------------ |
| JCC 与 admin 使用同一默认名 | Compose 可能重建错误容器       | 使用独立镜像、容器和项目名                        | 已缓解       |
| 环境变量未配置              | 首次发布失败                   | README 和示例列出完整清单，变量缺失时 fail closed | 发布前待配置 |
| 静态资源路径未代理          | 主应用无法加载 JCC             | 固定 `/subapps/jcc/` 并记录外层 Nginx 前提        | 发布前待验证 |
| 容器运行但应用不可用        | 当前状态检查不足以证明业务健康 | test 发布后执行 HTTP/主应用人工验收               | 开放         |

当前没有阻塞代码实施的待确认项。真实环境参数由发布负责人在 GitHub Environments 配置。

| 决策               | 原因                               | 未采用方案                                     | 确认来源       |
| ------------------ | ---------------------------------- | ---------------------------------------------- | -------------- |
| 复用 admin 工作流  | 两仓库构建结构一致，减少新流程风险 | 重新设计 Actions 会扩大范围                    | 用户要求       |
| 服务器端构建       | 保持现有基础设施与参考流程一致     | Actions runner build/push 需另行调整网络与缓存 | 参考实现       |
| 使用不可变环境标签 | 可审计并支持精确回滚               | `latest` 无法证明历史版本                      | 参考实现       |
| 只改部署标识       | 足以避免运行冲突                   | 全量包名重命名与 CI/CD 无关                    | 当前仓库兼容性 |

## 13. 完成标准

```text
代码提交 / PR → CI 质量门禁
版本标签 → 精确源码构建 → 不可变镜像 → JCC 独立 Compose 部署
历史标签 → 镜像拉取 → JCC 回滚
```

第一阶段代码配置和本地验收已完成，证据见 [执行记录](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_EXECUTION.md)。GitHub Environment、首个 test 发布、外层代理和 production 发布继续作为明确的发布前事项，不得因本地测试通过而视为真实部署完成。
