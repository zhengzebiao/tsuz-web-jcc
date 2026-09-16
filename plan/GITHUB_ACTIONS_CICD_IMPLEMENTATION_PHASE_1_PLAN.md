# GitHub Actions CI/CD：第 1 阶段“工作流与部署隔离配置”实现计划

> 状态：已完成
>
> 总实施方案：[GitHub Actions CI/CD 实施方案](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PLAN.md)
>
> 阶段执行记录：[GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_EXECUTION.md](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_EXECUTION.md)
>
> 范围：复刻 admin 的 CI/Deploy，适配 JCC 独立部署标识并补齐本地验证和文档；不实际发布或修改外部环境。

## 1. 背景与阶段基准

### 1.1 前置状态

- 当前仓库已有 Node 20 Docker 多阶段构建、nginx 和单服务 Compose；
- 根 workspace 已提供 `lint`、`format:check`、`test`、`build`；
- JCC 独立开发端口与主应用默认入口均为 7202；
- `../tsuz-web-admin` 已有可复用的 CI、标签发布、服务器端构建和历史镜像回滚工作流。

### 1.2 当前仓库事实

- 实施前无 `.github/workflows`，CI/CD 尚未配置；
- Docker 与 Compose 默认镜像/容器/项目仍使用历史 `tsuz-web-admin`，与 JCC 业务和 7202 端口不一致；
- 根 Prettier 脚本只检查少量基础配置，不包含即将新增的 workflow；
- GitHub Environment、Secret、镜像仓库和服务器事实未获授权读取，均视为待配置；
- 工作区实施前干净，已从 `main` 创建 `feat/jcc-cicd` 分支。

### 1.3 本阶段目标

1. CI 在 PR/主分支执行与本地一致的五步质量门禁；
2. Deploy 支持 test/product 不可变标签发布和环境匹配的历史镜像回滚；
3. JCC 默认部署标识与 admin 隔离，端口和资源路径匹配主应用契约；
4. 配置、发布前条件、验证结果和未执行副作用可追溯。

## 2. 范围与约束

### 2.1 本阶段实现

- 新增 CI 和 Deploy workflow；
- 更新 Prettier、Docker 和 Compose 默认配置；
- 新增无敏感值部署 env 示例；
- 更新 README、总方案、本阶段计划和执行记录；
- 执行本地格式、lint、测试、构建、Compose 解析、workflow 静态检查和 diff 检查。

### 2.2 本阶段明确不实现

- GitHub Environment、Variables、Secrets 或保护规则的实际创建；
- 标签创建/推送、镜像构建推送、SSH、服务器 Compose 或真实部署；
- 主应用和外层 Nginx 的配置改动；
- workspace 包名和 qiankun 名重构；
- HTTP 健康检查、蓝绿/金丝雀、部署通知等超出参考流程的增强。

### 2.3 已确认约束

- 原样保留 admin 工作流的不可变标签、环境前缀、远端 SHA、输入和路径校验；
- JCC 默认使用 `tsuz-web-jcc`、7202、`/subapps/jcc/`；
- test/product 配置通过 GitHub Environment 注入，不提交真实敏感值；
- 构建变量进入镜像，回滚不允许改变历史镜像配置；
- 不新增 npm 依赖或修改 lockfile。

### 2.4 临时数据与隔离测试规则

本阶段不访问数据库、缓存、队列或真实业务 API。验证只读取本地文件、运行现有测试/构建和解析 Compose；不使用真实 Secret，不写入共享环境。Docker 镜像构建不是必需验收项，普通 `pnpm build` 验证相同应用构建路径。

### 2.5 前置依赖与环境条件

| 依赖              | 所需状态       | 当前状态             | 不满足时处理                 |
| ----------------- | -------------- | -------------------- | ---------------------------- |
| admin workflow    | 本地可读取     | 已满足               | 以当前文件为参考基准         |
| pnpm workspace    | 已安装依赖     | 已满足并完成全量验证 | 命令结果见执行记录           |
| Docker Compose    | CLI 可用       | 已满足并完成解析     | 解析结果见执行记录           |
| actionlint        | 可选本地工具   | 未安装               | 未新增依赖；执行记录如实保留 |
| GitHub/服务器凭证 | 仅真实发布需要 | 未确认               | 本阶段未调用，发布前配置     |

## 3. 详细设计与修改文件

### 3.1 CI 质量门禁

新增 [.github/workflows/ci.yml](../.github/workflows/ci.yml)：

1. 监听 `main` / `master` 的 `pull_request` 与 `push`；
2. 使用 checkout v4、pnpm setup v4（8.15.9）、Node setup v4（20 + pnpm cache）；
3. 执行 `pnpm install --frozen-lockfile`、`lint`、`format:check`、`test`、`build`；
4. 不写仓库、不发布制品、不读取部署 Secret。

### 3.2 标签发布与回滚

新增 [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)：

- `resolve-deploy`：解析标签/手工输入，拒绝 `latest`、非完整语义版本和环境错配；
- `prepare-image`：校验镜像和 SSH 配置，在部署服务器检出准确 tag/SHA、清理工作树、构建并推送镜像；
- `deploy`：上传 Compose 与生成的非 Secret `.env`，标签发布直接使用本地构建镜像，回滚则拉取历史镜像；
- 最终轮询独立 JCC 容器的 `running` 状态，失败时输出 Compose 状态和末尾日志；
- 使用仓库级 concurrency 串行执行，避免发布交错。

### 3.3 部署隔离与本地脚本

修改：

- [docker-compose.yml](../docker-compose.yml)：默认项目、镜像、容器改为 `tsuz-web-jcc`，端口保持 7202；
- [package.json](../package.json)：Docker 脚本镜像改为 `tsuz-web-jcc`，Prettier 覆盖两个 workflow；
- [.env.deploy.example](../.env.deploy.example)：提供 JCC 镜像、独立目录、容器、7202 和 `/subapps/jcc/` 的非敏感示例。

不修改 Dockerfile 构建参数，因为现有 `VITE_API_BASE_URL`、`VITE_PUBLIC_BASE`、`VITE_APP_ENV` 已满足 Deploy 注入。

### 3.4 数据、迁移与公共契约

不涉及数据结构、迁移或持久状态变更，也不改变 JCC HTTP API 或前端业务路由。新增对外运维契约为标签格式、GitHub Environment 配置键和 JCC 部署资源命名。

### 3.5 配置、依赖和外部服务

- 不新增/升级依赖，`pnpm-lock.yaml` 不应变化；
- 环境变量与 Secret 清单以总方案和 README 为准；
- 真实镜像仓库、GitHub API、SSH 和服务器 Compose 均不在本地测试调用；
- 部署服务器克隆私有仓库所需 deploy key/访问权独立于 Actions 的 SSH 私钥，由运维环境配置。

### 3.6 安全、权限与可观测性

- Actions 权限仅 `contents: read`；
- 标签、镜像名、用户名、端口和路径进入 shell 前校验；
- Secret 不写入上传的 `.env`，镜像仓库 Token 只通过 stdin 传输；
- 优先使用固定 `SSH_KNOWN_HOSTS`；未配置时参考流程使用 `ssh-keyscan`，发布前应评估 host key 固定；
- 当前可观测性限于 Actions 日志、Docker inspect、Compose ps/logs，不加入业务数据日志。

## 4. 实施步骤

1. 基于 admin 文件新增 CI 与 Deploy；
2. 替换 JCC 资源路径、端口、容器和 Compose 默认名；
3. 更新根格式/Docker 脚本和 Compose；
4. 新增部署 env 示例及 README 运维说明；
5. 新建并互链总方案、阶段计划与执行记录；
6. 运行 Prettier 并执行全量 CI 命令；
7. 解析 Compose，运行可用的 workflow lint、静态搜索和 diff 检查；
8. 将真实结果写入执行记录，并同步总方案/阶段计划状态。

## 5. 测试与验证计划

### 5.1 验证范围

| 范围            | 覆盖行为                                 | 预期结果                         |
| --------------- | ---------------------------------------- | -------------------------------- |
| CI 命令         | install 契约、类型、格式、测试、生产构建 | 所有命令退出码 0                 |
| Compose         | 默认镜像/容器/项目/7202 与 build args    | `docker compose config` 正确解析 |
| Deploy 静态配置 | JCC 默认值、无 admin 路径/7201 残留      | 静态搜索无冲突值                 |
| Workflow YAML   | Actions 语法和常见 shell 问题            | `actionlint` 通过或如实记录缺失  |
| 文档            | 变量、Secret、发布/回滚和外部边界        | 三层文档与 README 一致           |

### 5.2 回归与质量检查

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm test
pnpm build
docker compose config
actionlint .github/workflows/ci.yml .github/workflows/deploy.yml
git diff --check
git status --short --branch
```

`actionlint` 仅在本机已安装时执行；不为此增加项目依赖。构建可能修改已跟踪的 `apps/app/dist/index.html`，验证后只恢复该生成文件，不覆盖业务改动。

### 5.3 真实环境验证

以下检查具有外部副作用且本阶段不执行：推送 tag、触发 GitHub Deploy、登录镜像仓库、SSH 到服务器、上传 Compose、启动容器、修改外层 Nginx和生产验收。待 test 环境就绪后先执行 test 标签发布和手动回滚，再考虑 product。

## 6. 验收标准与追踪

| 编号    | 验收标准                                            | 实现位置                    | 验证方式                      | 状态   |
| ------- | --------------------------------------------------- | --------------------------- | ----------------------------- | ------ |
| AC-1-01 | CI 按参考流程运行五步质量门禁                       | `ci.yml`                    | 本地对应命令 + YAML/参考 diff | 已满足 |
| AC-1-02 | Deploy 支持环境标签发布和匹配历史标签回滚           | `deploy.yml`                | 静态审查 + YAML/参考 diff     | 已满足 |
| AC-1-03 | 保留输入、SHA、路径、镜像与 Secret 安全边界         | `deploy.yml`                | 代码核对 + 参考 diff          | 已满足 |
| AC-1-04 | JCC 默认标识、7202 和 `/subapps/jcc/` 与 admin 隔离 | workflow、Compose、env 示例 | Compose config + 静态搜索     | 已满足 |
| AC-1-05 | pnpm CI 命令与 Compose 解析通过                     | workspace                   | 验证命令                      | 已满足 |
| AC-1-06 | README 和三层实施文档可追溯，外部资源不误记就绪     | README、plan                | 文档核对                      | 已满足 |
| AC-1-07 | 不产生 lockfile 或无关构建产物变更                  | Git diff                    | `git status` / `git diff`     | 已满足 |

## 7. 风险、回滚与异常处理

| 风险或失败场景    | 影响                  | 预防/检测                                 | 回滚或恢复                        |
| ----------------- | --------------------- | ----------------------------------------- | --------------------------------- |
| 错误环境标签      | 部署到错误环境        | 前缀与环境双向校验                        | workflow 失败，不部署             |
| 远端源码漂移      | 镜像与 tag 不一致     | `ls-remote`、fetch、checkout SHA 三重核对 | 失败并保留旧容器                  |
| 与 admin 名称冲突 | 错误重建/停止容器     | JCC 独立项目和容器名                      | 恢复旧 Compose 或重新部署历史镜像 |
| 构建变量错误      | 静态资源/API 地址错误 | 不可变镜像 + test 验收                    | 回滚历史标签；修配置需新标签      |
| 环境未配置        | 首次工作流失败        | README 清单和必填校验                     | 补齐环境后重新运行                |

配置回滚可撤销本阶段文件；发布后的应用回滚使用历史镜像标签，不涉及数据回滚。

## 8. 阶段交付物

代码与配置：CI/Deploy workflow、JCC Compose/Docker 脚本默认值、部署 env 示例。

测试：现有 workspace 全量回归、Compose 解析、workflow 静态检查、diff 检查。

文档：更新 [总方案](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PLAN.md)、本阶段计划、阶段执行记录、[README](../README.md) 和关联的 [JCC 业务方案](JCC_DATA_IMPLEMENTATION_PLAN.md)。

## 9. 计划调整记录

| 调整项             | 原计划                      | 调整后                                                                       | 原因                                | 对总方案/后续阶段的影响                  |
| ------------------ | --------------------------- | ---------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------- |
| Workflow 专用 lint | 本机可用时运行 `actionlint` | 未安装，因此使用 YAML parser、参考文件逐字适配 diff 和首次 GitHub 运行待验证 | 不为一次验证新增项目依赖            | 本地必需验收不受阻；执行记录保留未执行项 |
| env 示例格式化     | 与其他文件一起执行 Prettier | `.env.deploy.example` 无可推断 parser，改用参考示例逐字适配 diff             | Prettier 不支持该无扩展 dotenv 文件 | 无配置语义影响                           |
