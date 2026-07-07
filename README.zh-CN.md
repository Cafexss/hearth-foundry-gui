# Hearth 🔥⚒

**为 [Foundry](https://github.com/foundry-rs/foundry) 工具链打造的温暖优雅的桌面图形界面。**

[English](README.md) · 中文 · [日本語](README.ja.md) · [한국어](README.ko.md)

Hearth 将本地的 `forge`、`cast`、`anvil`、`chisel` 封装为一个 Claude 风格的简洁桌面应用——部署合约、发送交易、追踪失败原因、启动本地链，全程无需记忆任何命令行参数。

<p align="center">
  <img src="docs/screenshot.png" alt="Hearth — light" width="49.5%">
  <img src="docs/screenshot-dark.png" alt="Hearth — dark" width="49.5%">
</p>

## 下载

从 [**Releases**](https://github.com/Cafexss/hearth-foundry-gui/releases) 下载最新 `.dmg`（Apple Silicon 与 Intel 双版本）。
应用未签名——首次启动请右键点击应用选择「打开」，或执行 `xattr -dr com.apple.quarantine /Applications/Hearth.app`。

## 依赖

- [Foundry](https://getfoundry.sh)（`forge` / `cast` / `anvil` / `chisel` 位于 `~/.foundry/bin` 或 PATH 中）
- Node.js ≥ 18

## 运行

```bash
npm install
npm start
```

## 功能

| 模块 | 说明 |
|------|------|
| **仪表盘** | 网络实时状态（区块高度、gas 价格、RPC 延迟）、工具链版本、快速余额查询、本地交易历史 |
| **项目构建 & 测试** (forge) | 新建或打开 Foundry 项目，一键 build / test / fmt / snapshot / coverage，流式输出与测试过滤 |
| **合约部署** (forge create / script) | 单合约部署（自动解析构造函数参数、dry-run 模拟），以及完整的 `forge script` 支持——模拟、广播、自动解析 `run-latest.json` 中的全部交易 |
| **ABI 工作台** | 从项目编译产物或粘贴的 JSON 加载 ABI，生成可点击的函数面板：一键批量读取、带参调用、写函数估算与发送、payable 附带 ETH |
| **转账** (cast send) | 原生代币转账（含「全部余额留 gas」按钮）、ERC-20 转账（自动按 decimals 换算）、approve / 无限授权 / allowance 查询 |
| **合约调用** (cast call / send) | 按签名读写、以真实发送者估算 gas、Raw Calldata 模式（支持未开源合约）、原始 cast 命令直通 |
| **链上查询** (cast) | 余额 / Nonce / 代码 / 交易 / 回执 / 区块 / 存储槽 |
| **调试 & 日志** (cast run / logs) | 交易 Trace 重放、模拟调用跟踪（着色输出）、按地址+签名+区块范围查询事件日志 |
| **编码 & 转换** (cast) | 单位与进制转换、Keccak-256、选择器与事件主题、ABI 编码 / Calldata 解码、校验和、4byte 反查 |
| **钱包工具** (cast wallet) | 生成钱包与助记词、私钥推导地址、消息签名与验证、Keystore 导入与列表 |
| **Anvil 节点** | 一键本地链，支持主网分叉；10 个测试账户自动解析成可复制表格 |
| **链操作** (cast rpc) | 挖块、时间快进、状态快照与回滚、任意地址设置余额、impersonate 大户账户 |
| **多链** | 内置以太坊 / Sepolia / Base / Arbitrum / Optimism / Polygon / BSC / Anvil，自定义 RPC，一键切换，所有操作自动跟随当前网络 |
| **多语言 & 主题** | 中文 / English / 日本語 / 한국어，明暗双主题 |

## 安全说明

- 私钥仅作为参数传给本地 `forge` / `cast` 进程，**不会被存储**；日志中自动脱敏。
- 更安全的方式：在钱包工具页用 `cast wallet import` 导入 Keystore，之后用账户名 + 密码签名。
- 全部配置（网络、历史、偏好）保存在本地 `userData` 目录。

## 性能与稳定性

子进程输出在主进程按约 40ms 窗口合并后再走 IPC，渲染层按动画帧批量写 DOM 并限制节点数——5000 行测试日志（369KB）约 0.5 秒渲染完毕，UI 零卡顿。配置防抖合并 + 原子写入，单实例锁防止双开，渲染进程崩溃自动恢复，孤儿子进程自动回收。

## 技术结构

```
main.js        Electron 主进程：命令执行、流式进程、项目扫描、配置存储
preload.js     contextBridge 安全桥接
renderer/      原生 HTML/CSS/JS 界面（无构建步骤）
renderer/i18n.js  四语词典与运行时切换
build/         应用图标（SVG 源文件、PNG、macOS .icns）
```

## 致谢

本应用由 **Claude (Fable 5)** 设计与开发。Foundry 是 [Paradigm / foundry-rs](https://github.com/foundry-rs/foundry) 的项目。

## 许可证

[MIT](LICENSE)
