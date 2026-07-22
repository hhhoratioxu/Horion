# Horion 架构方案

## 1. 设计边界

Horion 是 Mihomo 的桌面控制面，不重复实现代理协议、加密或转发。协议能力、配置
字段与 Controller API 均以未来实际集成并验证的 Mihomo 版本为准。

阶段 1 只建立可运行的桌面壳层。UI 只展示可证明的状态：没有真实数据源时使用
“未连接”和 `—`，未实现操作保持禁用并标明开发阶段。

## 2. 分层结构

```text
React pages and feature modules
        │ typed view models
Zustand UI/application state
        │ typed Tauri invoke boundary (phase 2)
Rust commands and domain services
        ├─ core lifecycle (phase 3)
        ├─ Mihomo controller client (phase 4)
        ├─ profiles/subscriptions (phase 5)
        └─ system proxy / privileged TUN helper (phase 6)
```

- `src/app`：路由和应用级元数据。
- `src/components`：布局、导航、反馈状态和无业务基础组件。
- `src/pages`：页面编排，不执行系统命令。
- `src/stores`：当前只持久化非敏感 UI 偏好。
- `src/hooks`：主题等可复用 React 行为。
- `src/types`：跨组件共享的严格类型。
- `src-tauri/src`：Rust 入口；阶段 2 起按 `commands`、`core`、`security`、
  `storage` 等领域拆分。

## 3. 前端方案

- `createHashRouter` 避免桌面资源协议下的历史路由回退问题。
- Tailwind CSS 4 使用语义颜色变量，默认深色并支持浅色与跟随系统。
- Zustand 仅保存主题和侧边栏等非敏感偏好。内核状态后续按业务域单独建模。
- 路由错误页承接异常，避免 API 或渲染错误导致无说明白屏。
- 1366×768 为基础验证尺寸；主内容只有一个滚动区域，侧边栏在窄窗口紧凑显示。

## 4. Rust 与安全边界

阶段 2 起，所有系统能力必须通过窄接口 Tauri Command 暴露，并在 Rust 侧重新验证
输入。前端不能传入任意命令、任意路径或完整 Controller secret。

计划中的关键约束：

- Controller 只绑定 loopback，并使用随机 secret。
- 敏感数据使用操作系统凭据存储，不进入普通日志或前端持久化。
- 文件操作限定在应用管理目录，通过规范化路径和大小上限防止穿越与覆盖。
- Mihomo 下载仅允许官方来源，并在安装前验证签名或发布哈希。
- 子进程终止前核验 PID 与可执行文件身份，不使用全局进程终止命令。
- 系统代理修改采用快照、事务式应用和可恢复标记。
- TUN 高权限操作放入独立 helper/service，UI 不长期提权运行。

## 5. 后续目录演进

仅在实现相应阶段时创建非空模块，避免用空文件伪装架构：

```text
src/features/{core,proxies,profiles,connections,logs,settings}/
src/services/tauri/
src-tauri/src/commands/
src-tauri/src/core/
src-tauri/src/config/
src-tauri/src/system_proxy/
src-tauri/src/tun/
src-tauri/src/subscription/
src-tauri/src/security/
src-tauri/src/storage/
src-tauri/src/updater/
tests/fixtures/
scripts/
```

## 6. 阶段验收

每个阶段必须依次通过前端 Lint、测试和生产构建，以及 Rust 格式、Clippy、测试与
Tauri 检查。涉及真实内核的集成测试只能使用不含真实服务器或用户订阅的 fixture。
