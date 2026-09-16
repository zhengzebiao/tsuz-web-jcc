# GitHub Actions CI/CD：第 1 阶段“工作流与部署隔离配置”执行记录

> 状态：已完成
>
> 执行日期：2026-09-17
>
> 总实施方案：[GitHub Actions CI/CD 实施方案](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PLAN.md)
>
> 阶段实现计划：[第 1 阶段实现计划](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_PLAN.md)

## 1. 执行范围与结论

本次根据总方案完成第 1 阶段“工作流与部署隔离配置”。代码与本地无副作用验收已完成，可进入 GitHub Environment 配置和 test 发布前准备；真实标签发布和部署未执行。

本阶段实际完成：

1. 从 `tsuz-web-admin` 复刻 CI、test/product 标签发布和手动回滚工作流；
2. 将 Docker 镜像、容器、Compose 项目、端口和资源前缀适配为 JCC 独立部署标识；
3. 增加部署 env 示例、README 使用说明和三层 CI/CD 实施文档；
4. 完成冻结锁文件安装、格式、lint、全量测试、构建、Compose 解析、YAML 解析、静态搜索和 diff 检查。

本阶段明确未实现或未执行：

- 未创建或修改 GitHub `test` / `product` Environments、Variables、Secrets 或保护规则；
- 未创建/推送发布标签、登录镜像仓库、推送镜像、SSH 连接服务器或执行 Compose 部署；
- 未修改主应用仓库或外层 Nginx；
- 未执行 `actionlint`，因为本机未安装该工具；已用 Ruby YAML parser 验证两个文件可解析，并以与 admin 参考文件的逐字适配 diff 作为补充证据。

## 2. 实际代码与配置变更

### 2.1 CI 与 Deploy

- [.github/workflows/ci.yml](../.github/workflows/ci.yml)：在 `main` / `master` push 和 PR 上配置 Node 20、pnpm 8.15.9，执行冻结安装、lint、格式、测试和构建；
- [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)：支持 `test-vX.Y.Z` / `product-vX.Y.Z` 不可变标签发布和按环境校验的历史镜像回滚。

关键发布链路：

```text
标签解析与环境校验
  → 部署服务器精确检出并验证 GitHub SHA
  → 以 JCC 构建变量构建并推送镜像
  → 上传 Compose 与非 Secret .env
  → tsuz-web-jcc-<environment> 项目 up --no-build
  → 检查目标容器 running 状态
```

Deploy 保留了参考流程中的镜像名、用户名、端口、路径、标签和 SHA 校验；回滚跳过构建，仅拉取选定的不可变历史镜像。Actions 权限为 `contents: read`，同仓库部署通过 concurrency 串行执行。

### 2.2 JCC 部署隔离

- [docker-compose.yml](../docker-compose.yml)：默认项目、镜像和容器名由 `tsuz-web-admin` 改为 `tsuz-web-jcc`，端口保持 `7202:80`；
- [package.json](../package.json)：本地 Docker build/run 镜像名改为 `tsuz-web-jcc`，两个 workflow 纳入 Prettier；
- [.env.deploy.example](../.env.deploy.example)：提供 JCC test 镜像、独立源码/运行目录、容器/项目、7202 和 `/subapps/jcc/` 的占位配置。

最终默认约定：

```text
image/container/compose: tsuz-web-jcc*
host port: 7202
production asset base: /subapps/jcc/
workspace package / qiankun app name: 保留历史兼容值
```

### 2.3 文档

- [README.md](../README.md)：增加 GitHub Environment Variables/Secrets、服务器前提、标签发布、手动回滚、构建时变量和主应用/外层 Nginx 接入说明；
- [GitHub Actions CI/CD 实施方案](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PLAN.md)：记录完整流程、配置、安全、回滚、验收和外部待办；
- [第 1 阶段实现计划](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_PLAN.md)：记录本阶段契约和验证命令；
- [JCC 只读资料库实施方案](JCC_DATA_IMPLEMENTATION_PLAN.md)：同步原“部署标识暂不改”的旧决策，链接独立 CI/CD 方案。

### 2.4 数据、迁移和公共契约

不涉及数据结构、迁移、缓存、队列或持久业务状态变更。本阶段未改变 JCC HTTP API、前端业务路由或宿主鉴权契约；新增的是发布标签、GitHub Environment 配置键和部署资源命名契约。

### 2.5 配置、依赖和外部服务

- 未新增或升级依赖，`pnpm-lock.yaml` 无 diff；
- `DOCKER_REGISTRY_TOKEN`、`SSH_PRIVATE_KEY` 和可选 `SSH_KNOWN_HOSTS` 仅声明注入方式，仓库未写入真实值；
- 工作流上传的运行时 `.env` 不包含 registry Token 或 SSH 私钥；
- 未真实调用 GitHub 配置 API、镜像仓库、SSH、服务器 Docker 或外层代理。

## 3. 关键设计结果

1. CI 与 admin 保持同一质量门禁，JCC 的差异仅限部署身份、7202 和 `/subapps/jcc/`；
2. Deploy 以完整环境标签和远端 tag/SHA 校验保证镜像源码可追溯，拒绝 `latest` 和环境前缀错配；
3. JCC 使用 `tsuz-web-jcc-<environment>` Compose 项目及独立容器名，不会以默认配置管理 admin stack；
4. `VITE_API_BASE_URL`、`VITE_PUBLIC_BASE`、`VITE_APP_ENV` 为镜像构建时配置，修改配置必须构建新标签，历史镜像回滚不会漂移；
5. 当前健康检查只确认容器处于 `running`，HTTP、主应用挂载和真实 API 验收继续作为 test 发布后的环境检查。

## 4. 与阶段计划的差异

| 差异               | 计划内容                    | 实际实施                                          | 原因                                       | 影响与处理                                                                                                  |
| ------------------ | --------------------------- | ------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Workflow 专用 lint | 本机存在时运行 `actionlint` | 未执行；工具未安装                                | 计划明确不为此新增依赖                     | YAML parser 通过；JCC workflow 与按三项替换后的 admin 参考文件无 diff，真实 Actions 仍待首次 CI/Deploy 验证 |
| env 示例格式化     | 与文档一起执行 Prettier     | Prettier 无法为 `.env.deploy.example` 推断 parser | env 示例为纯 dotenv，无需 YAML/JSON parser | 其余目标已格式化；示例通过人工/静态核对                                                                     |

除此之外，实现与阶段计划一致，无范围或设计偏差。

## 5. 测试与验证结果

### 5.1 验证汇总

| 检查           | 命令或方法                                               | 结果   | 证据/说明                                                                          |
| -------------- | -------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| 冻结依赖安装   | `pnpm install --frozen-lockfile`                         | 通过   | 5 个 workspace 项目，lockfile 已是最新，782ms                                      |
| 根格式检查     | `pnpm format:check`                                      | 通过   | package、workspace、两个 workflow、Prettier 配置均匹配                             |
| Lint           | `pnpm lint`                                              | 通过   | Turbo 4/4 tasks 成功                                                               |
| 全量测试       | `pnpm test`                                              | 通过   | Turbo 4/4 tasks；API 3、shared 3、app 41 个测试通过，UI 无配置测试                 |
| 生产构建       | `pnpm build`                                             | 通过   | Turbo 4/4 tasks；Vite 3072 modules，构建成功；存在既有 >500 kB chunk 警告          |
| Compose 解析   | `docker compose config`                                  | 通过   | 项目/网络 `tsuz-web-jcc`，镜像/容器 `tsuz-web-jcc`，宿主端口 7202，build args 正确 |
| Workflow YAML  | Ruby `YAML.load_file` 解析两个 workflow                  | 通过   | `ci.yml: YAML_OK`、`deploy.yml: YAML_OK`                                           |
| 参考一致性     | `diff` 比较 admin CI 与三项 JCC 替换后的 Deploy/env 示例 | 通过   | 三条 diff 命令均无输出                                                             |
| 冲突默认值搜索 | `grep -E 'subapps/admin\|7201\|tsuz-web-admin' ...`      | 通过   | deploy workflow、env 示例和 Compose 无匹配；JCC 值静态搜索命中预期位置             |
| Diff 检查      | `git diff --check`                                       | 通过   | 无 whitespace 错误                                                                 |
| 产物与锁文件   | `git status` / `git diff -- pnpm-lock.yaml`              | 通过   | 已恢复验证产生的 `.turbo` 日志和 `dist/index.html`；lockfile 无变化                |
| actionlint     | `command -v actionlint`                                  | 未执行 | 本机未安装；没有为验证引入项目依赖                                                 |

### 5.2 失败与未执行项

- 首次组合 Prettier 命令对 `.env.deploy.example` 返回“无法推断 parser”，但同一命令已成功格式化其余文件；该 env 文件不在根 `format:check` 契约内，内容已与 admin 参考示例按 JCC 替换后逐字比对通过。
- `actionlint` 未执行，原因见上表；不将 YAML parser 结果表述为完整 Actions 语义验证。
- Vite 构建提示单个 JS chunk 大于 500 kB。这是既有前端产物警告，构建退出码为 0，本次 CI/CD 配置未改变应用 bundling。

### 5.3 真实环境或人工验证

| 验证项                            | 环境                            | 副作用/授权                    | 结果   |
| --------------------------------- | ------------------------------- | ------------------------------ | ------ |
| GitHub CI 实际运行                | GitHub Actions                  | 需推送分支/PR；本次未授权推送  | 未执行 |
| test 标签构建和部署               | GitHub + registry + test server | 会推送镜像、上传配置并重启容器 | 未执行 |
| 手动历史镜像回滚                  | test/product                    | 会拉取镜像并重启容器           | 未执行 |
| 外层 `/subapps/jcc/` 与主应用挂载 | 真实环境                        | 需修改/读取外部环境配置        | 未执行 |
| product 发布                      | production                      | 需生产审批和明确授权           | 未执行 |

## 6. 阶段验收结果

| 编号    | 验收标准                                            | 结果 | 验证证据                                                                     |
| ------- | --------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| AC-1-01 | CI 按参考流程运行五步质量门禁                       | 通过 | [ci.yml](../.github/workflows/ci.yml)；五个本地对应命令通过                  |
| AC-1-02 | Deploy 支持环境标签发布和匹配历史标签回滚           | 通过 | [deploy.yml](../.github/workflows/deploy.yml) 静态审查、YAML 解析及参考 diff |
| AC-1-03 | 保留输入、SHA、路径、镜像与 Secret 安全边界         | 通过 | Deploy 与按 JCC 三项替换后的 admin 参考文件无 diff                           |
| AC-1-04 | JCC 默认标识、7202 和 `/subapps/jcc/` 与 admin 隔离 | 通过 | `docker compose config` 与无 admin 默认值静态搜索                            |
| AC-1-05 | pnpm CI 命令与 Compose 解析通过                     | 通过 | 冻结安装、格式、lint、test、build、Compose 均退出码 0                        |
| AC-1-06 | README 和三层实施文档可追溯，外部资源不误记就绪     | 通过 | README、总方案、阶段计划、本执行记录互链并列出未执行项                       |
| AC-1-07 | 不产生 lockfile 或无关构建产物变更                  | 通过 | 最终状态无 `pnpm-lock.yaml`、`.turbo` 或 `dist` 变更                         |

本阶段所有代码和本地必需验收项已通过；真实发布项明确属于发布前环境验证，不阻止本阶段标记“已完成”。

## 7. 安全、兼容性与可观测性核对

### 安全

- Actions 仅申请 `contents: read`，不授予仓库写权限；
- 标签、环境、镜像名、registry、用户名、端口、目录和 SHA 在使用前校验，非法输入 fail closed；
- Secret 未进入仓库示例或运行时 `.env`，registry Token 经 stdin 传输；
- `SSH_KNOWN_HOSTS` 支持固定 host key；未配置时使用参考实现的 `ssh-keyscan`，发布前优先配置固定值；
- 远端 Git origin、tag 与提交 SHA 必须匹配当前仓库和 Actions 事件。

### 兼容性

- workspace 包名和 qiankun `mfe-app` 标识保持不变，应用源码和宿主协议不受影响；
- Docker/Compose 默认值改为 JCC 独立标识，这是为避免与 admin 运行冲突的有意变更；
- 旧的手工部署若依赖 admin 默认镜像名，需改用新的 JCC 默认值或显式 env；README 和 env 示例已同步；
- 回滚复用同一 Compose 契约和历史镜像，不改变数据。

### 可观测性

- Actions 日志会记录解析错误、远端源码校验、镜像 inspect、容器等待状态和失败时的 Compose ps/末尾日志；
- 不记录 Token、私钥或业务数据；
- 未新增 HTTP 健康端点、指标或告警，必须在首次 test 发布中另行验证业务可用性。

## 8. 遗留问题与后续入口

| 问题                                           | 影响                               | 负责人/条件                                 | 处理阶段              |
| ---------------------------------------------- | ---------------------------------- | ------------------------------------------- | --------------------- |
| GitHub Environments/Variables/Secrets 尚未配置 | Deploy 首次运行会 fail closed      | 仓库/发布负责人安全配置                     | 首次 test 发布前      |
| 外层 Nginx 与主应用 JCC entry 尚未真实核对     | 子应用可能无法由主应用加载         | 有实际环境权限后验证                        | 首次 test 发布前      |
| actionlint 未安装                              | 缺少专用 Actions 静态语义检查      | 可在开发机安装或由 GitHub 首次运行验证      | 合并/发布前建议补充   |
| 尚未执行 test 发布与回滚演练                   | 不能证明外部凭证、网络和服务器前提 | 明确授权并准备 test 环境                    | production 前必须完成 |
| 容器检查仅为 `running`                         | 可能漏掉 HTTP/业务不可用           | 首次 test 发布执行静态资源、挂载和 API 验收 | 发布前                |

下一步直接复用 [README 的 GitHub 配置清单](../README.md) 创建环境和凭证，再推送首个 test 标签。必须继续使用不可变环境标签和 JCC 独立容器/Compose 名；未经明确授权不要执行 product 发布。

## 9. 文档同步记录

- [GitHub Actions CI/CD 实施方案](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PLAN.md)：更新第一阶段状态、执行记录链接、风险状态和结论；
- [第 1 阶段实现计划](GITHUB_ACTIONS_CICD_IMPLEMENTATION_PHASE_1_PLAN.md)：更新状态、执行记录、验收结果和计划差异；
- [JCC 只读资料库实施方案](JCC_DATA_IMPLEMENTATION_PLAN.md)：同步部署标识决策及发布前检查；
- [README](../README.md)：新增完整 CI/CD 配置和操作说明；
- 本执行记录：记录真实改动、验证和所有未执行的外部副作用。

## 10. 阶段结论

第 1 阶段已完成：

- CI、不可变标签部署、手动回滚和 JCC 运行隔离配置已落地；
- 本地 CI 等价命令、Compose/YAML 解析、参考一致性和 diff 检查通过；
- 未写入真实敏感信息，未触发任何发布或服务器副作用；
- 可以进入 GitHub Environment 配置与 test 发布准备，但在外部配置和 test 演练完成前不能宣称真实部署通过。
