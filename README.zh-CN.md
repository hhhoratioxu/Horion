# Horion

Horion 是一款安全优先的 Windows 桌面 Mihomo 控制端，使用 Tauri 2、Rust、React、
TypeScript、Vite 和 Tailwind CSS 构建。

> 当前版本：**v0.3.0 —— 配置、订阅与节点管理**。Horion 可以安装并管理 Mihomo，
> 导入本地 YAML、添加 HTTPS 订阅、切换策略组、选择节点、测速以及修改当前代理模式。
> **系统代理与 TUN 尚未接入，因此内核运行不等于 Windows 流量已经自动走代理。**

## v0.3.0 已实现

- 安装固定版本的官方 Mihomo，或导入受信任的本机 Mihomo 可执行文件
- 启动、停止、重启、健康检查、精确子进程回收与有界日志
- 导入本地 `.yaml` / `.yml`，支持拖入文件或填写绝对路径
- 添加和更新 HTTPS 订阅；订阅完整 URL 仅存入 Windows 凭据管理器
- 配置重命名、复制、删除、带 revision 冲突保护的 YAML 编辑
- 修改前自动备份，单份配置最多保留 10 个历史版本
- 激活配置前运行真实 `mihomo -t`；失败时保留旧版本并回滚运行状态
- 读取真实 Controller 节点和策略组，支持搜索、协议筛选、延迟排序与最多 4 路并发测速
- 切换 Selector 选项，以及在规则、全局、直连模式之间切换（模式只影响当前会话）
- 全新深色/浅色桌面界面、运行概览与明确的加载、空、离线和错误状态

## 快速开始

1. 从 [GitHub Releases](https://github.com/hhhoratioxu/Horion/releases) 下载最新版
   `Horion_*_x64-setup.exe` 并安装。
2. 在“运行概览”中安装已验证的官方 Mihomo 内核。
3. 打开“配置”，导入本地 YAML 或添加一个可信的 HTTPS 订阅。
4. 激活配置并启动内核。
5. 在“代理节点”测速，在“策略组”中选择节点。

未签名的个人项目安装包可能触发 Windows SmartScreen。请只从本仓库 Release 下载，
并在运行前核对 Release 页面提供的 SHA-256。

## 能力边界

v0.3.0 会使用激活配置中的本地 HTTP、SOCKS 或 Mixed 端口，但强制这些端口只监听
loopback。以下能力仍未实现：

- 自动修改 Windows 系统代理
- TUN、独立入站服务器与局域网共享
- 实时流量、连接、规则与内存指标
- 托盘控制以及应用/内核自动更新

远程配置中的 TUN、自定义 listeners/tunnels、DNS 监听、TUIC/SS/VMess 服务端、外部
Controller、Web UI 与 CORS 设置会在运行前被移除。它们不能绕过 Horion 管理的
loopback Controller 和随机 secret。

## 固定的官方内核

Horion v0.3.0 不解析可变的 `latest`，官方安装固定使用 Mihomo `v1.19.29`：

| 架构 | 官方资产 | 压缩包字节数 | SHA-256 |
| --- | --- | ---: | --- |
| Windows x86_64 | `mihomo-windows-amd64-v1-v1.19.29.zip` | 17,509,589 | `4a5b4cdf76f1879043cea7488162517fd3fb95d5b7a205d89601f1942791ee39` |
| Windows ARM64 | `mihomo-windows-arm64-v1.19.29.zip` | 15,430,938 | `f71736f9c2a17abb8909a726c69ac55279d0cb43d1d9f2c85afdbb70a0f326a3` |

只有用户点击“安装官方内核”后 Horion 才会连接 GitHub Release。下载内容会经过准确
字节数、SHA-256、ZIP 条目和 `mihomo -v` 校验，再提交到管理目录。Mihomo 是独立的
GPL-3.0 第三方项目，不嵌入 Horion 安装包；详见
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 从源码运行

环境要求：Windows 10/11、WebView2、Node.js 24 LTS、Rust stable（MSVC host），以及
Microsoft C++ Build Tools 的“使用 C++ 的桌面开发”工作负载。

```powershell
npm.cmd install
npm.cmd run tauri:dev
```

`npm.cmd run dev` 只启动浏览器预览，不会访问本机内核、配置或 Controller。完整测试与
发布构建说明见 [`docs/development.md`](docs/development.md)。

## 数据与隐私

常规 Windows 安装的数据目录为 `%APPDATA%\io.horion.desktop\`：

- `core\`：受管 Mihomo 可执行文件与运行数据
- `profiles\`：配置副本、元数据和最多 10 份历史版本
- Windows 凭据管理器：订阅完整 URL（可能包含访问令牌）

Controller secret 每次启动重新生成，只留在 Rust 后端并通过 stdin 发送给 Mihomo。
订阅 URL、配置内容和 secret 不写入浏览器 localStorage，也不会在普通日志中完整展示。
Horion 不包含广告、分析或遥测。安全细节见 [`SECURITY.md`](SECURITY.md)。

## 许可证

Horion 使用 MIT License。第三方组件继续适用各自许可证；Mihomo `v1.19.29` 作为独立
进程受 GPL-3.0 约束，固定源码与许可证信息见
[`third_party/mihomo/NOTICE.md`](third_party/mihomo/NOTICE.md)。
