# Horion 架构（v0.2.0）

## 1. 设计边界

Horion 是 Mihomo 的桌面控制面，不重新实现代理协议、加密或流量转发。v0.2.0 的范围是
“可信地安装一个内核，并安全地管理这个子进程”。订阅、节点、代理配置、系统代理、TUN
以及 Controller 指标均不在本版本范围内。

当前启动配置使用 `mode: direct`，只提供内部健康检查所需的 Controller，不配置任何本地
代理监听器。因此，生命周期状态为 `running` 仅表示 Mihomo 子进程存活且 Controller
版本检查通过，不能解释为系统流量已被代理。

## 2. 分层结构

```text
React pages / core status controls / log viewer
        │ typed CoreSnapshot and CoreLogEntry
        ▼
Frontend core client and Zustand state
        │ allowlisted Tauri commands
        ▼
Rust CoreService
        ├── CoreInstaller ──► pinned GitHub release or local import
        ├── managed manifest and immutable version directories
        ├── exact Mihomo child-process ownership
        ├── stdout/stderr capture with secret redaction
        └── loopback Controller GET /version health check
```

- `src/types/core.ts`：前后端共享语义对应的内核状态和日志类型。
- `src/services/core-client.ts`：固定的 Tauri invoke 边界，不接受任意命令行参数。
- `src/stores/core-store.ts`：界面侧状态同步与用户操作，不保存 Controller secret。
- `src/components/core/core-provider.tsx`：在桌面环境加载状态并保持界面一致。
- `src-tauri/src/core/model.rs`：生命周期、快照、日志与安装清单模型。
- `src-tauri/src/core/install.rs`：官方下载、校验、导入、`-v` 检查和原子提交。
- `src-tauri/src/core/manager.rs`：启动、停止、重启、健康检查与有界日志。
- `src-tauri/src/core/paths.rs`：应用数据目录解析及路径穿越防护。

## 3. Tauri 命令边界

v0.2.0 只向前端暴露以下内核命令：

| 命令 | 输入 | 作用 |
| --- | --- | --- |
| `core_get_status` | 无 | 刷新子进程并返回当前快照 |
| `core_install_official` | 无 | 下载并安装固定官方资产 |
| `core_import_from_path` | 本机路径 | 复制并验证用户选择的 Mihomo 程序 |
| `core_start` | 无 | 启动已管理的内核并等待健康检查 |
| `core_stop` | 无 | 终止并回收 Horion 持有的准确子进程 |
| `core_restart` | 无 | 串行停止后重新启动 |
| `core_get_logs` | 无 | 返回当前进程内的有界日志快照 |

安装与生命周期操作通过互斥锁串行执行。状态机包含 `not_installed`、`stopped`、
`downloading`、`installing`、`starting`、`running`、`stopping`、`crashed` 和 `error`，
并拒绝不合法的跨状态操作。

## 4. 内核安装信任链

### 4.1 官方安装

官方下载固定到 Mihomo `v1.19.29`，不访问发行版的 `latest` 别名：

| 架构 | ZIP | ZIP 大小 | ZIP SHA-256 | 唯一允许条目 | 解压大小 |
| --- | --- | ---: | --- | --- | ---: |
| x86_64 | `mihomo-windows-amd64-v1-v1.19.29.zip` | 17,509,589 | `4a5b4cdf76f1879043cea7488162517fd3fb95d5b7a205d89601f1942791ee39` | `mihomo-windows-amd64-v1.exe` | 47,484,928 |
| ARM64 | `mihomo-windows-arm64-v1.19.29.zip` | 15,430,938 | `f71736f9c2a17abb8909a726c69ac55279d0cb43d1d9f2c85afdbb70a0f326a3` | `mihomo-windows-arm64.exe` | 42,606,080 |

只有用户在界面中明确发起安装，Rust 后端才进行 HTTPS 请求。重定向限制为固定的 GitHub
发行资产主机集合，并设有连接、请求与整体操作超时。安装依次执行：

1. 下载到 `versions` 下的临时目录，并限制最大写入量。
2. 同时校验响应所报大小（若存在）、实际字节数和 SHA-256。
3. 要求 ZIP 仅有一个条目；条目名、封闭路径、文件类型和解压大小必须完全吻合。
4. 将可执行文件提取为 `mihomo.exe`，附带上游许可证与 notice。
5. 隐藏窗口运行 `mihomo.exe -v`，最多等待 10 秒，并要求输出匹配
   `Mihomo Meta vX.Y.Z`；官方安装还必须恰好报告 `1.19.29`。
6. 按版本与可执行文件哈希提交到不可变目录，并原子写入当前清单。

### 4.2 本机导入

导入路径在 Rust 端规范化，必须指向非空普通文件；Windows 下要求 `.exe`，大小上限为
200 MiB。Horion 不会直接从原路径长期运行，而是先复制到临时目录、计算 SHA-256，再
执行同样的 `-v` 身份检查并提交到管理目录。

`-v` 检查会实际执行该程序。它只能确认输出符合 Mihomo 的预期格式，不构成代码签名或
来源证明，因此用户必须只导入可信文件。

## 5. 应用数据目录

根目录由 Tauri 的 `app_data_dir` 解析。常规 Windows 安装通常为：

```text
%APPDATA%\io.horion.desktop\
└── core\
    ├── current.json
    ├── versions\
    │   └── <version>-<sha256-prefix>\
    │       ├── mihomo.exe
    │       ├── LICENSE.mihomo.txt
    │       └── NOTICE.mihomo.md
    └── runtime\
```

`current.json` 只保存版本、来源、相对可执行路径、SHA-256 与安装时间。每次加载清单时都会
拒绝绝对路径、父目录跳转和管理根目录之外的解析结果，并重新计算受管可执行文件哈希。
运行时目录用于 Mihomo 的工作目录；包含 secret 的最小配置通过 stdin 发送，不写入配置
文件。

## 6. 进程与 Controller

启动时，Horion：

1. 重新加载清单并核对受管路径与可执行文件 SHA-256。
2. 在 `127.0.0.1` 上申请并暂时保留一个随机可用端口。
3. 通过系统随机源生成 32 字节随机值并编码为 secret。
4. 先用同一份内存配置执行 `-t -d <runtime> -f -` 预检；预检最多等待 10 秒，失败则不
   创建正式运行进程。
5. 预检通过后释放端口预留，立即以 `-d <runtime> -f -` 启动受管的 `mihomo.exe`，再次
   通过 stdin 发送同一份配置。
6. 捕获预检及正式进程的 stdout 与 stderr；每行最多 16 KiB，日志队列最多 1,000 条，
   并脱敏 secret。
7. 最多等待 15 秒，携带 `Bearer <secret>` 请求 loopback Controller 的
   `GET /version`，且必须与安装清单版本相同。

secret 留在 Rust 运行时中，不返回给前端。健康检查客户端禁用系统代理，避免本机代理
配置干扰 loopback 请求。停止时只操作当前 `Child` 句柄，等待并回收该准确进程，不使用
按名称全局结束进程的命令。应用退出时也执行同一清理流程；意外退出会进入 `crashed`
状态并记录错误。

## 7. 单实例与当前未接入模块

Tauri 单实例插件保证重复启动时聚焦已有主窗口。它不改变内核生命周期的权限边界。

以下界面模块尚无真实后端数据源：订阅、节点/策略组、系统代理、TUN、流量、连接、规则
和其他 Controller 指标。后续阶段必须继续通过窄 Tauri 命令、Rust 端输入校验和明确的
用户动作接入，不能通过前端传入任意命令、任意 Controller 地址或 secret。

## 8. 验收

常规提交必须通过前端 lint、单元测试和生产构建，以及 Rust 格式检查、Clippy、单元测试
与完整 Tauri 编译。真实内核测试默认忽略，只有设置 `HORION_LIVE_CORE_TEST=1` 并显式
选择 ignored test 时才会联网下载和执行固定 Mihomo 资产。具体命令见
[`development.md`](development.md)。
