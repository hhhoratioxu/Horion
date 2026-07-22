# Mihomo 内核、配置与节点管理

本文说明 Horion v0.3.0 已实现的真实行为和安全边界。

## “运行中”不等于“系统已经代理”

- `running`：Horion 持有的 Mihomo 子进程仍存活。
- `healthy`：Rust 使用私有随机 secret 访问 `GET /version` 成功，且版本与安装清单一致。
- 节点和策略组页面可用：健康 Controller 已返回当前运行时数据。

以上状态都不表示 Windows 系统代理已打开。v0.3.0 尚未修改系统代理，也不会启用 TUN。浏览器或其他程序只有在自行指向 active 配置提供的本地 HTTP/SOCKS/mixed 端口后，才可能使用该代理。

## 1. 安装 Mihomo

### 安装固定官方版本

在首页或“设置 → Mihomo 内核”点击安装。只有这次明确操作会触发下载；打开 Horion、查看状态或管理配置不会自动下载内核。

v0.3.0 固定使用 Mihomo `v1.19.29`，不访问 `latest`：

| 架构 | 资产 | ZIP 大小 | SHA-256 |
| --- | --- | ---: | --- |
| Windows x86_64 | `mihomo-windows-amd64-v1-v1.19.29.zip` | 17,509,589 | `4a5b4cdf76f1879043cea7488162517fd3fb95d5b7a205d89601f1942791ee39` |
| Windows ARM64 | `mihomo-windows-arm64-v1.19.29.zip` | 15,430,938 | `f71736f9c2a17abb8909a726c69ac55279d0cb43d1d9f2c85afdbb70a0f326a3` |

后端验证 HTTPS 重定向目标、响应长度、实际字节数、SHA-256、唯一 ZIP 条目、条目路径和解压大小。解压后隐藏窗口执行 `mihomo.exe -v`，只在输出严格符合 Mihomo 版本格式且报告 `1.19.29` 时提交安装。

### 导入本地内核

输入可信 `mihomo.exe` 的完整绝对路径。Horion 会要求它是普通、非空、不超过 200 MiB 的 `.exe` 文件，将其复制到临时受管目录，计算 SHA-256，再实际执行副本的 `-v`。

`-v` 输出检查不是数字签名或来源证明。不要导入未知程序；不确定时使用固定官方安装。

## 2. 添加配置

配置管理要求先安装 Mihomo，因为所有配置在提交前都要经过真实的 `mihomo.exe -t` 预检。

### 导入本地 YAML

本地路径必须：

- 是完整绝对路径；
- 不含 `.` 或 `..` 路径穿越组件；
- 指向普通非符号链接文件；
- 使用 `.yaml` 或 `.yml`；
- 非空且不超过 8 MiB。

Horion 把内容复制到应用数据目录，但保留规范化的原路径，以支持日后对该配置执行单独“更新”。前端只显示原文件名，不显示完整本地路径。

### 添加 HTTPS 订阅

订阅 URL 仅允许 HTTPS，禁止 `user:password@host` 和 fragment，最大 2,048 字节。重定向仍必须是无 userinfo 的 HTTPS，最多 8 次。响应和实际读取均限制为 8 MiB；请求失败最多额外重试两次。

完整 URL 不会写入 `profiles.json` 或返回前端，而是存入当前 Windows 用户的 Credential Manager：

```text
Target: Horion/Profile/<profile-uuid>
```

磁盘清单只包含 credential key、host 显示标签和可选 User-Agent。自定义 User-Agent 必须是 1–256 个可打印 ASCII 字节。删除订阅或复制订阅时，Horion 同步删除或创建对应的独立凭据。

如果响应包含 `subscription-userinfo`，界面可以显示 upload、download、total 和 expire；缺失或格式错误的字段保持为空。

## 3. 更新、编辑和历史

- “更新全部”只更新 subscription，不会重新读取 local 配置。
- 对单个 local 配置执行“更新”时，才重新读取其原绝对路径。
- 下载、读取、YAML 解析或 Mihomo 预检失败时，旧内容和旧 revision 保持可用。
- 编辑器读取 `{ id, content, revision }`，保存时发送 `expectedRevision`。
- revision 已变化时返回冲突，Horion 不覆盖较新的内容；前端保留本地编辑文本供用户处理。

更新或保存前，Horion 将旧内容备份到该 profile 的历史目录。每个 profile 最多保留最近 10 份。内容与 `profiles.json` 都采用原子替换写入；只有完整提交后 revision 才增加。

active profile 更新或保存后：

- 内核正在运行：自动停止并使用新 revision 启动；
- 内核原本停止：继续保持停止；
- 新 revision 启动失败：恢复旧内容、旧 revision 和 active 元数据，并尽力重新启动旧配置。

active profile 不能直接删除。请先激活另一个配置。

删除其他配置使用可恢复事务：内容和历史先移入受管隔离区，清单提交成功后才视为删除完成；若应用中途退出，下次启动会恢复未提交删除或继续清理已提交删除。

## 4. 激活配置

点击激活后，Rust 后端会：

1. 验证 profile UUID、受管路径、8 MiB 上限和 YAML 顶层 mapping；
2. 对安全净化后的最终内容执行 Mihomo `-t -f -`；
3. 记录旧 active profile；
4. 若内核正在运行，停止 Horion 持有的精确子进程；
5. 原子切换 active ID；
6. 若此前运行，启动新配置并等待 Controller 健康；
7. 失败时恢复旧 active ID，并尽力恢复旧运行配置。

激活不会自动打开系统代理或 TUN。

## 5. 安全运行时配置

用户 YAML 不会原样交给 Mihomo。Horion 先展开 YAML merge key，然后执行以下净化：

- 强制 `allow-lan: false` 和 `bind-address: 127.0.0.1`；
- 覆盖为随机 loopback Controller 和每次启动新生成的 secret；
- 强制 Controller CORS origins 为空，禁止 private-network；
- 删除额外 Controller TLS/unix/pipe、routing mark、外部 UI、认证跳过及外部 DoH 入口；
- 删除 `tun`、额外 listeners/tunnels、TUIC server、iptables、Shadowsocks/VMess server 配置、redir/tproxy 端口；
- 删除 `dns.listen`。

普通 `port`、`socks-port` 和 `mixed-port` 可以保留，但只能在 loopback 上使用。没有 active profile 时，Horion 使用不开放本地代理端口的最小 `DIRECT` 配置。

预检和正式启动均通过 stdin 传递同一份配置。Horion 还会从 Mihomo 子进程环境中移除配置覆盖、Controller 覆盖、secret 覆盖、post-up/post-down hook 和 `SAFE_PATHS` 等 `CLASH_*` 环境变量，防止父环境绕过净化。

## 6. 启动、停止与状态

启动流程：

1. 重新校验安装清单、受管路径和 `mihomo.exe` SHA-256；
2. 读取 active profile，或在没有 active profile 时构造安全 `DIRECT` 配置；
3. 申请并暂时保留随机 IPv4 loopback Controller 端口；
4. 生成 32 字节随机 secret；
5. 使用 stdin 执行 `-t -d <runtime> -f -`，最多等待 10 秒；
6. 使用同一份配置启动正式子进程；
7. 最多等待 15 秒，通过带 `Bearer` secret 的 `GET /version` 健康检查；
8. 只有版本与安装清单一致时进入 `running`。

| 状态 | 含义 |
| --- | --- |
| `not_installed` | 没有可用的受管内核 |
| `downloading` | 正在下载固定官方资产 |
| `installing` | 正在校验、导入或提交 |
| `stopped` | 已安装但没有受管子进程 |
| `starting` | 正在预检、启动或等待健康 |
| `running` | 子进程存活且最近健康检查通过 |
| `stopping` | 正在停止并回收精确子进程 |
| `crashed` | 受管子进程意外退出 |
| `error` | 安装、配置、进程或状态转换失败 |

停止操作只使用 Horion 持有的 `Child` 句柄，不会按进程名称结束其他 Mihomo。关闭 Horion 时执行同一清理流程。

## 7. 节点、策略组和模式

内核运行且 Controller 健康后，节点页会显示当前模式、策略组、节点成员、当前选择、存活状态和已知延迟。节点 server/port 仅从 active YAML 中的 `proxies` 安全元数据补充；密码、token、UUID、证书和订阅 URL 不会返回界面。

支持的操作：

- 在策略组允许的成员中选择节点；
- 对已知非内置节点执行单次延迟测试；测试地址固定为 `https://www.gstatic.com/generate_204` 并要求 HTTP 204，超时参数限制为 1–30 秒；
- 最多 4 个前端并发任务执行“全部测速”，取消时停止尚未开始的队列；
- 在 `rule`、`global`、`direct` 三种 Mihomo 模式间切换。

模式切换只修改当前 Mihomo 运行会话，不改写 active YAML；内核重启或重新激活配置后，模式会回到该配置声明的值。

所有操作都由 Rust 使用私有 Controller address/secret 发起。前端无法指定 Controller URL、测速 URL 或 secret，也不能把任意 API 路径转发给 Mihomo。每次用户操作都会重新确认当前进程及 Controller 健康；选择节点还会重新读取快照，验证节点仍属于该组。内核停止、Controller 不健康、组/节点不存在、节点不属于该组或模式非法都会被后端拒绝；测速超时会被收敛到安全范围。

测速只是按需 Controller 请求，不是实时流量监控。

## 8. 日志与脱敏

- 日志只保存在当前 Horion 进程内；
- 队列最多 1,000 条；
- 单行最多 16 KiB；
- Controller secret 替换为 `[REDACTED]`；
- `http://` 和 `https://` 完整值在写入日志或错误状态前替换；
- 订阅错误只报告 host 和安全原因。

## 9. 数据位置

Windows 常见路径：

```text
%APPDATA%\io.horion.desktop\
├─ core\
│  ├─ current.json
│  ├─ versions\...
│  └─ runtime\
└─ profiles\
   ├─ profiles.json
   ├─ items\<uuid>.yaml
   └─ history\<uuid>\...
```

不要在 Horion 运行时手工修改这些文件。删除应用数据前先停止内核并退出 Horion。Credential Manager 中的订阅 URL 不位于该目录，卸载或手动删目录不等同于删除所有 credential target。

## 10. 当前未接入

- Windows 系统代理与绕过列表；
- TUN、路由和管理员权限流程；
- 连接列表及关闭连接；
- 实时上传/下载速率、累计流量和图表；
- 规则/provider/DNS 图形化管理；
- 后台定时更新订阅。

因此“节点可见且内核运行”仍不代表应用流量已自动接管。

## 常见问题

### 添加配置提示“内核未安装”

先安装或导入 Mihomo。Horion 使用真实的已安装内核进行 `-t` 校验，不会只做宽松的 YAML 语法检查。

### 订阅更新失败但旧节点仍在

这是预期的保守行为。失败不会覆盖旧内容；配置状态会显示 `error` 和脱敏原因。修复网络或订阅后再次更新。

### 保存时提示 revision 冲突

配置在编辑期间已被更新或由另一操作保存。保留当前编辑文本，重新读取最新 revision，人工合并后再保存。

### 节点页面不可用

确认已激活包含节点的配置，并且内核状态为 `running`、`healthy`。节点命令不会在内核停止时读取 YAML 伪造在线状态。

### 内核运行但浏览器没有代理

v0.3.0 不修改 Windows 系统代理，也不启用 TUN。需要手工把应用指向配置中的本地代理端口；否则流量不会进入 Mihomo。
