# Horion 架构（v0.3.0）

## 1. 产品边界

Horion 是 Mihomo 的 Windows 桌面控制面，不重新实现代理协议、加密或流量转发。v0.3.0 的后端职责包括：

- 固定版本 Mihomo 的下载、校验、本地导入与进程生命周期；
- 本地配置和 HTTPS 订阅的持久化、校验、编辑、更新与激活；
- 通过受认证的 loopback Controller 读取节点/策略组、选择节点、测速及切换 Mihomo 模式；
- 有界日志、统一状态和失败回滚。

v0.3.0 **不会**修改 Windows 系统代理，不会启用 TUN，也未接入连接列表、实时上下行速率或累计流量指标。配置中即使包含 TUN 或额外入站，Horion 在生成运行时配置时也会移除这些能力。内核显示 `running` 只表示受管进程和 Controller 健康检查通过；系统流量不会因此自动进入代理。

## 2. 分层结构

```text
React pages
  ├─ Core / Profile / Proxy typed clients
  ├─ Zustand stores and view projections
  └─ allowlisted Tauri invoke calls
                  │
                  ▼
Rust command boundary
  ├─ CoreService
  │   ├─ pinned CoreInstaller
  │   ├─ exact child-process ownership
  │   ├─ runtime YAML hardening
  │   └─ authenticated Controller client
  └─ ProfileService
      ├─ atomic manifest/content store
      ├─ Windows Credential Manager
      ├─ subscription downloader
      └─ revision/history/rollback
                  │
                  ▼
Managed Mihomo child
  └─ random loopback Controller + in-memory secret
```

前端永远不接收 Controller 地址或 secret，也不能提交任意 Controller URL、任意可执行命令或 Mihomo 命令行参数。所有 Controller 请求由 Rust 根据当前私有运行时状态构造。

## 3. 主要模块

### 3.1 前端

- `src/types/core.ts`、`profile.ts`、`proxy.ts`：IPC 返回值的 TypeScript 契约。
- `src/services/*-client.ts`：固定 Tauri command 名和参数；浏览器预览环境不模拟真实后端。
- `src/stores/core-store.ts`、`profile-store.ts`、`proxy-store.ts`：异步状态、错误和用户操作。
- `src/core/proxy-view.ts`：节点筛选、分组和延迟排序等纯视图逻辑。

### 3.2 Rust 内核管理

- `src-tauri/src/core/install.rs`：固定官方资产下载、大小/SHA-256/ZIP 结构验证、本地 EXE 导入和 `-v` 身份检查。
- `src-tauri/src/core/manager.rs`：状态机、启动/停止、配置预检、Controller 健康检查、节点操作和有界日志。
- `src-tauri/src/core/model.rs`：生命周期、快照、日志及安装清单。
- `src-tauri/src/core/paths.rs`：受管路径解析和目录逃逸防护。

### 3.3 Rust 配置管理

- `src-tauri/src/profile/service.rs`：本地导入、订阅更新、原子写、revision、历史、激活和回滚。
- `src-tauri/src/profile/credentials.rs`：Windows Credential Manager 中的订阅 URL。
- `src-tauri/src/profile/model.rs`：`ProfileSummary`、用量、内容及激活结果。
- `src-tauri/src/profile/error.rs`：稳定错误码和不泄露 URL 的用户消息。

`CoreService` 持有可克隆的 `ProfileService`。因此启动、激活和 active profile 的重新应用能在 Rust 操作锁内协调，而不是由前端拼接多个不具原子性的命令。

## 4. IPC 命令

### 4.1 内核

| 命令 | 输入 | 返回/作用 |
| --- | --- | --- |
| `core_get_status` | 无 | `CoreSnapshot` |
| `core_install_official` | 无 | 下载、校验并安装固定官方资产 |
| `core_import_from_path` | `path` | 导入可信本地 Mihomo EXE |
| `core_start` | 无 | 预检并启动受管子进程 |
| `core_stop` | 无 | 仅停止 Horion 持有的精确子进程 |
| `core_restart` | 无 | 在同一后端操作序列中停止并启动 |
| `core_get_logs` | 无 | 返回当前进程内的有界日志快照 |

### 4.2 配置与订阅

| 命令 | 输入 | 返回/作用 |
| --- | --- | --- |
| `profile_list` | 无 | `ProfileSummary[]` |
| `profile_import_local` | `name`, `path` | 复制并校验本地 YAML |
| `profile_add_subscription` | `name`, `url`, `userAgent` | 下载、校验并保存 HTTPS 订阅 |
| `profile_update` | `id` | 更新单个订阅；本地配置则重读原绝对路径 |
| `profile_update_all` | 无 | 仅更新全部订阅，跳过本地配置 |
| `profile_rename` | `id`, `name` | 修改显示名称 |
| `profile_duplicate` | `id`, `name` | 创建独立 UUID、内容和订阅凭据 |
| `profile_delete` | `id` | 删除非 active 配置及其凭据/历史 |
| `profile_get_content` | `id` | `{ id, content, revision }` |
| `profile_save_content` | `id`, `content`, `expectedRevision` | 乐观锁保存并增加 revision |
| `profile_activate` | `id` | `{ profile, core }`，必要时安全重启内核 |

`ProfileSummary` 只返回订阅 host 作为 `source_label`，不返回完整 URL。订阅用量来自 `subscription-userinfo`，字段为可空的 `upload`、`download`、`total`、`expire`。

### 4.3 节点与策略组

| 命令 | 输入 | 返回/作用 |
| --- | --- | --- |
| `proxy_get_overview` | 无 | 当前模式、策略组、节点和更新时间 |
| `proxy_select` | `group`, `name` | 在存在的策略组中选择允许的成员 |
| `proxy_test_delay` | `name`, `timeoutMs` | 对已知节点执行有界 Controller 延迟测试 |
| `proxy_set_mode` | `mode` | 仅接受 `rule`、`global` 或 `direct`；只影响当前内核运行会话 |

节点和分组来自当前运行中 Mihomo 的 Controller 数据；`server`/`port` 只从 active YAML 的 `proxies` 元数据补充，密码、UUID、证书、订阅 URL 等字段不会进入返回值。节点选择、模式切换和测速均要求健康的受管 Controller，不能在内核停止时离线修改配置。

Overview 分别读取 `/configs` 和 `/proxies`，响应上限为 1 MiB 和 8 MiB，标准请求超时为 5 秒。选择节点前会重新读取快照并验证组、成员和节点仍然存在。测速只允许真实非内置节点，使用固定 `https://www.gstatic.com/generate_204`、`expected=204`，用户超时被限制到 1,000–30,000 ms，传输层额外保留 2 秒收尾时间。小型修改/测速响应上限为 64 KiB。名称不得为空、超过 512 字节或包含控制字符，路径段由 URL API 独立编码。

## 5. 配置持久化

应用数据根目录由 Tauri `app_data_dir` 解析。Windows 常见布局为：

```text
%APPDATA%\io.horion.desktop\
├─ core\
│  ├─ current.json
│  ├─ versions\<version>-<sha256-prefix>\
│  │  ├─ mihomo.exe
│  │  ├─ LICENSE.mihomo.txt
│  │  └─ NOTICE.mihomo.md
│  └─ runtime\
└─ profiles\
   ├─ profiles.json
   ├─ items\<uuid>.yaml
   └─ history\<uuid>\<revision>-<timestamp>.yaml
```

配置清单和内容使用原子替换写入。保存编辑或更新已有配置前，旧内容先写入历史目录；每个配置只保留最近 10 份。`revision` 从 1 开始，仅在内容提交成功后增加。`expectedRevision` 不匹配时返回冲突，不覆盖其他编辑。

删除非 active 配置时，内容和历史先通过同卷重命名移入受管 tombstone，再以清单原子写入作为提交点。未提交删除会在下次启动恢复；已提交但尚未完成的凭据或文件清理会在下次启动重试。

本地配置清单保存规范化的原路径，以支持显式重新读取；前端只显示文件名。订阅清单只保存凭据 key、host 标签和可选 User-Agent。完整订阅 URL 存在当前 Windows 用户的 Credential Manager，target 为 `Horion/Profile/<uuid>`。非 Windows 构建明确返回“不支持订阅凭据存储”，不会退化为明文文件。

## 6. 配置输入与订阅边界

- 配置内容必须为 UTF-8 YAML、顶层 mapping、非空且不超过 8 MiB。
- 本地路径必须是无 `.`/`..` 穿越组件的绝对路径、普通非符号链接文件，并使用 `.yml` 或 `.yaml` 扩展名。
- 每次新增、更新、编辑或激活都先解析 YAML，再使用已安装的 Mihomo `-t -f -` 验证最终运行时内容。
- 订阅 URL 最大 2,048 字节，仅允许 HTTPS，禁止 URL userinfo 和 fragment。
- 每一次重定向仍须满足 HTTPS 且无 userinfo，最多 8 次。
- HTTP 连接超时 10 秒、单次请求超时 30 秒；失败最多额外重试 2 次。
- 响应头和实际流式读取都执行 8 MiB 上限。
- 自定义 User-Agent 只能包含 1–256 个可打印 ASCII 字节；未提供时使用固定 Horion UA。
- 网络错误和持久化错误不包含完整 URL；日志还会通用替换 `http://`/`https://` 值。

下载、YAML 或 Mihomo 预检失败时，旧内容和旧 revision 保持不变，profile 状态变为 `error` 并记录脱敏原因。

## 7. 激活、更新与回滚

激活配置时：

1. 读取受管内容，验证 UUID、大小、YAML 和 Mihomo `-t`；
2. 获取 CoreService 串行操作锁并记录旧 active profile；
3. 若内核运行，停止当前精确子进程；
4. 原子写入新的 active ID；
5. 若此前运行，则用新配置启动并完成 `GET /version` 健康检查；
6. 失败时恢复旧 active ID，并尽力重新启动旧配置。

active profile 的订阅更新或编辑保存成功后，如果内核原本运行，会自动停止并重新启动以应用新 revision；如果内核原本停止，则仍保持停止。新 revision 启动失败时会恢复旧内容、旧 revision 和 active 元数据，再尽力恢复旧内核。非 active 配置更新不会影响运行中的进程。

## 8. 安全运行时 YAML

Horion 不原样执行用户 YAML。Rust 先展开 YAML merge key，再构造安全运行时配置：

- 强制 `allow-lan: false`；
- 强制 `bind-address: 127.0.0.1`；
- 注入随机 loopback `external-controller` 和随机 `secret`；
- 注入 `external-controller-cors: { allow-origins: [], allow-private-network: false }`；
- 移除其他 Controller、TLS/pipe/unix、routing mark、external DoH、认证跳过、外部 UI 和 CORS 覆盖；
- 移除 `tun`、`listeners`、`tunnels`、`tuic-server`、`iptables`、`ss-config`、`vmess-config`、`redir-port`、`tproxy-port`；
- 从 `dns` 子 mapping 中移除 `listen`。

普通 `port`、`socks-port`、`mixed-port` 可以保留，但受 `allow-lan: false` 和 loopback bind 限制。无 active profile 时使用最小 `DIRECT` 安全配置。

预检与正式子进程都通过 stdin 接收同一份配置，secret 不写入配置文件。启动前还会从子进程环境中清除：

```text
CLASH_CONFIG_FILE
CLASH_CONFIG_STRING
CLASH_AGE_SECRET_KEY
CLASH_OVERRIDE_EXTERNAL_UI_DIR
CLASH_OVERRIDE_EXTERNAL_CONTROLLER
CLASH_OVERRIDE_EXTERNAL_CONTROLLER_TLS
CLASH_OVERRIDE_EXTERNAL_CONTROLLER_UNIX
CLASH_OVERRIDE_EXTERNAL_CONTROLLER_PIPE
CLASH_OVERRIDE_EXTERNAL_CONTROLLER_ROUTING_MARK
CLASH_OVERRIDE_SECRET
CLASH_POST_UP
CLASH_POST_DOWN
SAFE_PATHS
```

这可防止父进程环境重新打开额外 Controller、替换配置或执行启动/停止 hook。

## 9. Controller 与日志

每次启动生成新的 32 字节随机 secret，并为 IPv4 loopback 临时保留随机端口。正式进程启动后，Rust 使用禁用系统代理的 HTTP 客户端和 `Bearer` secret 请求 `GET /version`；15 秒内未健康则终止该子进程。

Controller 节点命令复用 Rust 私有的 address、secret 和受限客户端。请求体、路径参数、模式与超时均由后端验证。secret 不序列化到 `CoreSnapshot`、profile、日志或前端。

stdout/stderr 单行最多 16 KiB，内存队列最多 1,000 条。Controller secret 和完整 URL 在进入队列前脱敏。日志只存在当前 Horion 进程内。

## 10. 明确未接入的能力

- Windows 系统代理开关与代理绕过列表；
- TUN 驱动、路由和管理员权限工作流；
- 连接列表、关闭连接；
- 实时上传/下载速率和累计流量图表；
- 规则编辑、provider 管理、DNS 管理和任意 Controller API 转发；
- 后台定时订阅更新。

后续能力仍必须经过窄化的 Tauri command、Rust 输入验证和显式用户动作，不能向前端暴露通用 Controller 请求接口。
