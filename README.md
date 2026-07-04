# Jan Agent Team

基于 [janhq/jan](https://github.com/janhq/jan) 二次开发的 AI 客户端，在 Jan 原有的本地模型、云模型、助手、MCP 和 OpenAI-compatible API 体验上，增加了 Agent / Agent Team 多角色团队聊天能力。

> 当前版本是预览版。UI 和交互尽量保持 Jan 客户端原有风格；多 Agent 编排通过本地 AG2 Python runtime 实现，优先支持云端 OpenAI-compatible 模型。

<p align="center">
  <a href="README.md">中文</a> ·
  <a href="README.zh.md">中文备份</a> ·
  <a href="https://github.com/janhq/jan">Upstream Jan</a>
</p>

## 下载

最新预览版：

[Jan Agent Team v0.8.3-agent-team-1](https://github.com/tadej7153/jan-agent-team/releases/tag/v0.8.3-agent-team-1)

| 平台 | 安装包 |
| --- | --- |
| macOS Apple Silicon | [Jan_0.8.3_aarch64.dmg](https://github.com/tadej7153/jan-agent-team/releases/download/v0.8.3-agent-team-1/Jan_0.8.3_aarch64.dmg) |
| Windows x64 | [Jan_0.8.3_x64-setup.exe](https://github.com/tadej7153/jan-agent-team/releases/download/v0.8.3-agent-team-1/Jan_0.8.3_x64-setup.exe) |
| Windows x64 MSI | [Jan_0.8.3_x64_en-US.msi](https://github.com/tadej7153/jan-agent-team/releases/download/v0.8.3-agent-team-1/Jan_0.8.3_x64_en-US.msi) |

这些安装包目前未签名。macOS Gatekeeper 或 Windows SmartScreen 可能会在首次打开时提示风险。

## 这个 fork 增加了什么

- **Agent 管理**：创建、编辑、删除 Agent，并配置名称、头像、模型、system prompt、工具权限和职责描述。
- **Agent Team 管理**：创建团队，配置成员、发言顺序、最大讨论轮数、总结员和手动点名能力。
- **多 Agent 对话**：在同一个 Jan thread 中让多个 Agent 轮流发言，消息显示 Agent 名字和头像。
- **@Agent 点名**：用户可以点名单个 Agent，由该 Agent 单独回复。
- **团队讨论和总结**：团队成员按配置顺序讨论，最后可由总结员输出结论。
- **统一对话角色选择器**：原 Assistant 选择入口现在支持选择 `无 / Assistant / Agent / Agent Team`。
- **真实 AG2 runtime 链路**：选择 Agent 或 Agent Team 后，会走本地 AG2 runtime，不只是前端假显示。

## 和 Jan 原版的关系

这个项目不是从零开发的客户端，而是 Jan 的 fork：

- Jan 仍负责客户端主体、会话、UI、模型配置、助手、MCP、OpenAI-compatible API 等基础能力。
- Agent Team 功能在 Jan 设置页和聊天入口中扩展。
- 多 Agent 编排由随应用启动的本地 Python runtime 负责。
- 上游 Jan 使用 Apache 2.0 许可证，本项目继续保留对应许可证和声明。

如果你只需要官方 Jan，请使用 [janhq/jan](https://github.com/janhq/jan) 或 [jan.ai](https://jan.ai/)。

## AG2 runtime

Agent / Agent Team 模式会懒启动本地 runtime：

- 地址：`127.0.0.1:8765`
- 健康检查：`GET /health`
- 多 Agent 对话：`POST /v1/agent-team/runs`
- runtime 源码位置：`src-tauri/resources/agent-runtime`

前端会把当前会话模型配置、Agent 专属模型配置、team 配置和用户输入发送给本机 runtime。API key 只发往 `127.0.0.1`，不会展示在错误信息中。

## 当前支持

- 云端 OpenAI-compatible API
- 单 Agent 按“单成员 Agent Team”运行
- Team round-robin / 顺序流水线式讨论
- 讨论结束后的总结员输出
- 设置页中的 Agents 管理页和团队管理页
- macOS Apple Silicon DMG
- Windows x64 exe / MSI

## 当前限制

- 预览版默认面向云端模型；Jan 官方 MLX 本地后端不是当前重点。
- `auto`、`random`、`manual` 等更复杂发言调度会先降级为稳定可用的顺序策略。
- Agent / Team 模式第一版以文本输入为主，附件、多模态和复杂工具链还需要继续增强。
- 安装包未签名，首次运行可能需要手动确认。

## 使用方式

1. 安装并打开应用。
2. 在设置里配置云端模型提供方，例如 OpenAI-compatible API。
3. 进入 `设置 -> Agent 团队`。
4. 在 `Agents` 页创建 Agent。
5. 在 `团队` 页创建 Agent Team，并选择成员、顺序、轮数和总结员。
6. 回到聊天页，在对话角色选择器中选择 Assistant、Agent 或 Agent Team。
7. 发送消息，或使用 `@AgentName` 点名单个 Agent。

## 从源码运行

### 环境要求

- Node.js >= 20
- Yarn >= 4.5.3
- Rust stable
- Tauri 所需系统依赖
- macOS Apple Silicon 构建本地包时需要 Xcode Command Line Tools

### 安装依赖

```bash
corepack enable
corepack prepare yarn@4.5.3 --activate
yarn install
```

### 开发运行

```bash
yarn dev
```

### 构建 macOS Apple Silicon

```bash
yarn tauri build --target aarch64-apple-darwin
```

### 关键测试

```bash
yarn workspace @janhq/web-app tsc -b
yarn workspace @janhq/web-app test
```

## 后续更新 Jan 上游

建议把官方 Jan 保留为 `upstream` remote，定期合并：

```bash
git remote add upstream https://github.com/janhq/jan.git
git fetch upstream
git checkout main
git merge upstream/main
```

合并上游时，需要重点检查：

- Jan 的 thread / assistant / provider 数据结构变化
- Tauri 打包资源和权限变化
- web-app 路由和设置页结构变化
- runtime resource 打包路径变化

## License

Apache 2.0. See [LICENSE](LICENSE).

## Acknowledgements

Built on:

- [Jan](https://github.com/janhq/jan)
- [AG2](https://github.com/ag2ai/ag2)
- [Tauri](https://tauri.app/)
- [Llama.cpp](https://github.com/ggerganov/llama.cpp)
