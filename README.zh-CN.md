# Horion

Horion 是一款安全优先的 Windows 桌面 Mihomo 控制端，技术栈为 Tauri 2、Rust、React、
TypeScript、Vite 和 Tailwind CSS。

> 当前版本：**v0.2.0 —— 已接入真实内核生命周期**。Horion 现在可以安装或导入
> Mihomo，并控制其启动、停止、重启、健康检查和日志展示。订阅、节点、系统代理、TUN
> 与 Controller 指标仍未接入。**内核显示“运行中”不代表 Windows 流量已经走代理。**

## v0.2.0 已实现

- 由用户明确点击后，下载固定版本的官方 Mihomo
- 导入本机 Mihomo 可执行文件，并复制到 Horion 管理的数据目录
- 安装时校验文件大小、SHA-256、ZIP 唯一条目及 `mihomo -v` 输出
- 启动、停止和重启由 Horion 创建并持有的准确子进程
- Controller 仅绑定 loopback，端口随机，且每次启动生成新的随机 secret
- 携带认证访问 `GET /version`，并核对返回版本的健康检查
- 有容量上限的内存日志：stdout、stderr 与生命周期事件
- 桌面界面展示真实内核状态和可操作错误
- 单实例运行；重复启动时聚焦已有主窗口
- 深色、浅色、跟随系统主题与响应式桌面导航

## 能力边界

v0.2.0 使用最小化的 direct 模式配置启动 Mihomo，不会装载代理配置，不会开放本地代理
监听端口，也不会更改 Windows 系统代理或启用 TUN。以下能力尚未实现：

- 订阅与配置档案管理
- 代理节点与策略组选择
- 系统代理和 TUN 控制
- Controller 流量、连接、规则等指标
- 托盘控制以及应用/内核更新流程

界面会把这些区域标为“未接入”或“开发中”。Horion 不脱离实际安装的 Mihomo 版本
单独声称支持某种代理协议。

## 固定的官方内核

Horion v0.2.0 不解析可变的 `latest`，官方安装固定使用 Mihomo `v1.19.29`，并在
编译时按架构选择以下资产：

| 架构 | 官方资产 | 压缩包字节数 | SHA-256 |
| --- | --- | ---: | --- |
| Windows x86_64 | `mihomo-windows-amd64-v1-v1.19.29.zip` | 17,509,589 | `4a5b4cdf76f1879043cea7488162517fd3fb95d5b7a205d89601f1942791ee39` |
| Windows ARM64 | `mihomo-windows-arm64-v1.19.29.zip` | 15,430,938 | `f71736f9c2a17abb8909a726c69ac55279d0cb43d1d9f2c85afdbb70a0f326a3` |

仅打开 Horion 不会触发此下载。只有用户点击“安装官方内核”后，Horion 才会连接
GitHub Release 基础设施。下载后会核对准确字节数和 SHA-256；ZIP 必须只有一个白名单
条目且解压大小吻合；随后运行提取出的程序并校验 `-v`，全部通过才提交到管理目录。

完整信任与生命周期设计见 [`docs/core-management.md`](docs/core-management.md)。
Mihomo 是独立的 GPL-3.0 第三方项目，不嵌入 Horion 安装包；详见
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 环境要求

- Windows 10 或 Windows 11
- Microsoft Edge WebView2 Runtime
- 源码开发还需要 Node.js 24 LTS、Rust stable（MSVC host），以及包含“使用 C++ 的桌面
  开发”工作负载的 Microsoft C++ Build Tools

## 从源码运行

```powershell
npm.cmd install
npm.cmd run tauri:dev
```

在 PowerShell 中使用 `npm.cmd` 可避免执行策略拦截。`npm.cmd run dev` 只能运行网页
前端，真实内核命令必须在 Tauri 桌面运行时中使用。完整构建、测试以及需主动开启的真实
Mihomo 测试见 [`docs/development.md`](docs/development.md)。

## 数据与隐私

内核文件保存在 Tauri 的应用数据目录。常规 Windows 安装对应
`%APPDATA%\io.horion.desktop\core\`。Controller secret 每次启动重新生成，通过 stdin
发送给 Mihomo，不进入前端状态；采集进程输出时也会进行脱敏。

Horion 不包含广告、分析或遥测。安装官方内核必然会连接 GitHub；导入本机程序时会执行
该文件的 `-v` 参数，因此只能导入你信任的 Mihomo 可执行文件。安全细节见
[`SECURITY.md`](SECURITY.md)。

## 许可证

Horion 使用 MIT License，第三方组件继续适用各自许可证。Mihomo `v1.19.29` 作为独立
进程受 GPL-3.0 约束；固定源码与许可证信息见
[`third_party/mihomo/NOTICE.md`](third_party/mihomo/NOTICE.md)。
