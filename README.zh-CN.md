# Horion

Horion 是一款正在开发中的安全优先桌面代理控制端，计划管理官方
[Mihomo](https://github.com/MetaCubeX/mihomo) 可执行文件。技术栈为 Tauri 2、Rust、
React、TypeScript、Vite 和 Tailwind CSS。

> 当前进度：**阶段 1 — 桌面应用壳层**。路由、导航、响应式布局以及深色/浅色/
> 跟随系统主题已经实现。Mihomo 尚未下载、启动或受控；Horion 当前不会修改系统
> 代理或 TUN 设置。

## 截图

完成 Windows 多 DPI 验证后补充阶段 1 截图。

## 阶段 1 已实现

- 面向 Windows 10/11 的 Tauri 2 工程
- React、TypeScript 严格模式和 Vite 构建
- Tailwind CSS 4 语义主题变量
- 适合桌面打包的 Hash 路由与六个一级页面
- 深色、浅色和跟随系统主题
- 响应式侧边栏与运行状态标题栏
- 对未实现功能明确显示“未连接”或“开发中”
- 前端 Lint、测试和生产构建脚本

## 尚未实现

Mihomo 生命周期、Controller API、配置与订阅、系统代理、TUN、托盘以及自动更新
属于后续阶段。在读取实际安装的 Mihomo 版本和能力前，本项目不会声明协议支持。

## 环境要求

- Windows 10 或 Windows 11
- Node.js 24 LTS（含 npm）
- Rust stable MSVC 工具链
- Microsoft C++ Build Tools 的“使用 C++ 的桌面开发”工作负载
- Microsoft Edge WebView2 Runtime

开发环境与完整命令见 [`docs/development.md`](docs/development.md)。

## 运行

```powershell
npm.cmd install
npm.cmd run tauri:dev
```

在 Windows PowerShell 中使用 `npm.cmd` 可避免执行策略拦截；其他已启用
`npm` 的终端可直接使用 `npm`。只运行前端可使用 `npm.cmd run dev`。

## Mihomo 说明

Mihomo 是独立的第三方项目，并非由 Horion 原创。后续阶段只会下载官方发布文件、
验证完整性，并以实际安装版本报告的能力决定 UI 中可用的功能。

## 隐私与许可证

Horion 不包含广告、遥测或用户追踪。阶段 1 不执行代理配置，也不发送应用数据。
项目采用 MIT License；第三方组件继续适用其自身许可证，详见
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 已知限制

- 阶段 1 尚未集成 Mihomo 和 Controller API。
- 系统代理、TUN、订阅、托盘与安装程序尚不可用。
- 已为 Windows ARM64 预留架构空间，但阶段 1 不提供对应构建。
