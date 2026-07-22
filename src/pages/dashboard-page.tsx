import { useEffect, useMemo } from "react";
import {
  Activity,
  ArrowRight,
  Circle,
  Download,
  FileStack,
  Gauge,
  Layers3,
  LoaderCircle,
  Network,
  Play,
  RotateCw,
  Route,
  Square,
  Timer,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  coreStatePresentation,
  transitionalCoreStates,
} from "../core/core-status";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { PageHeading } from "../components/ui/page-heading";
import { useCoreStore } from "../stores/core-store";
import { useProfileStore } from "../stores/profile-store";
import { useProxyStore } from "../stores/proxy-store";
import { cn } from "../utils/cn";

const modeLabels = { rule: "规则", global: "全局", direct: "直连" } as const;

export function DashboardPage() {
  const snapshot = useCoreStore((state) => state.snapshot);
  const runtimeAvailable = useCoreStore((state) => state.runtimeAvailable);
  const initialized = useCoreStore((state) => state.initialized);
  const pendingAction = useCoreStore((state) => state.pendingAction);
  const statusError = useCoreStore((state) => state.statusError);
  const actionError = useCoreStore((state) => state.actionError);
  const installOfficial = useCoreStore((state) => state.installOfficial);
  const start = useCoreStore((state) => state.start);
  const stop = useCoreStore((state) => state.stop);
  const restart = useCoreStore((state) => state.restart);
  const profiles = useProfileStore((state) => state.profiles);
  const loadProfiles = useProfileStore((state) => state.load);
  const overview = useProxyStore((state) => state.overview);
  const loadOverview = useProxyStore((state) => state.load);

  const connected = snapshot.state === "running" && snapshot.controller_available;
  useEffect(() => {
    if (runtimeAvailable) void loadProfiles();
  }, [loadProfiles, runtimeAvailable]);
  useEffect(() => {
    if (runtimeAvailable && connected) void loadOverview();
  }, [connected, loadOverview, runtimeAvailable]);

  const activeProfile = profiles.find((profile) => profile.active);
  const aliveNodes = overview?.nodes.filter((node) => node.alive).length ?? 0;
  const measuredDelays = useMemo(
    () => overview?.nodes.flatMap((node) => node.delay && node.delay > 0 ? [node.delay] : []) ?? [],
    [overview],
  );
  const averageDelay = measuredDelays.length
    ? Math.round(measuredDelays.reduce((sum, delay) => sum + delay, 0) / measuredDelays.length)
    : null;
  const presentation = coreStatePresentation[snapshot.state];
  const transitioning = transitionalCoreStates.has(snapshot.state);
  const controlsDisabled = Boolean(pendingAction) || transitioning || !runtimeAvailable;
  const visibleError = actionError ?? snapshot.last_error ?? statusError;
  const online = snapshot.state === "running" && snapshot.healthy;

  const stats = [
    { label: "当前配置", value: activeProfile?.name ?? "未激活", detail: activeProfile ? activeProfile.source_label : "前往配置页导入或添加订阅", icon: FileStack },
    { label: "代理模式", value: overview ? modeLabels[overview.mode] : "—", detail: overview ? `Controller 更新于 ${new Date(overview.updated_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : "等待 Controller 数据", icon: Route },
    { label: "可用节点", value: overview ? `${String(aliveNodes)} / ${String(overview.nodes.length)}` : "—", detail: overview ? `${String(overview.groups.length)} 个策略组` : "尚未读取节点", icon: Network },
    { label: "平均延迟", value: averageDelay ? `${String(averageDelay)} ms` : "—", detail: measuredDelays.length ? `基于 ${String(measuredDelays.length)} 个已测速节点` : "尚无测速结果", icon: Timer },
  ] as const;

  return (
    <div className="space-y-5">
      <PageHeading description="控制本地 Mihomo，并查看当前配置与代理状态。" eyebrow="Overview" title="运行概览" />

      <Card aria-busy={Boolean(pendingAction) || transitioning} className="relative overflow-hidden p-5 xl:p-6">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", online ? "border-positive/25 bg-positive-soft text-positive" : snapshot.state === "error" || snapshot.state === "crashed" ? "border-negative/25 bg-negative-soft text-negative" : "border-line bg-surface-raised text-text-muted")}>
                <Circle aria-hidden="true" className={cn("fill-current", (transitioning || pendingAction) && "animate-pulse")} size={7} />
                {!initialized ? "正在检测" : presentation.label}
              </span>
              {snapshot.version ? <span className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-text-subtle">Mihomo v{snapshot.version}</span> : null}
              {snapshot.pid ? <span className="font-mono text-[11px] text-text-subtle">PID {snapshot.pid}</span> : null}
            </div>
            <h2 className="mt-4 text-[26px] font-semibold tracking-[-0.035em] text-text">
              {online ? "本地代理内核运行正常" : snapshot.installed ? "内核已就绪，当前未连接" : "安装内核以开始使用"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
              {!runtimeAvailable && initialized
                ? "当前是浏览器预览环境，不会访问本机进程或配置。"
                : online
                  ? "Controller 健康检查已通过。是否接管系统流量仍由尚未接入的系统代理与 TUN 能力决定。"
                  : presentation.description}
            </p>
            {visibleError ? <p className="notice-error mt-4 max-w-2xl" role="alert">{visibleError}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-72 lg:justify-end">
            {!snapshot.installed ? (
              <Button disabled={controlsDisabled} onClick={() => void installOfficial()} variant="primary">
                {pendingAction === "install_official" ? <LoaderCircle aria-hidden="true" className="animate-spin" size={15} /> : <Download aria-hidden="true" size={15} />}
                安装已验证内核
              </Button>
            ) : snapshot.state === "running" ? (
              <>
                <Button disabled={controlsDisabled} onClick={() => void stop()}><Square aria-hidden="true" size={13} />停止</Button>
                <Button disabled={controlsDisabled} onClick={() => void restart()}><RotateCw aria-hidden="true" size={14} />重启</Button>
              </>
            ) : (
              <Button disabled={controlsDisabled} onClick={() => void start()} variant="primary">
                {pendingAction === "start" ? <LoaderCircle aria-hidden="true" className="animate-spin" size={15} /> : <Play aria-hidden="true" size={15} />}
                启动内核
              </Button>
            )}
            <Button disabled title="系统代理能力尚未接入"><Route aria-hidden="true" size={14} />系统代理未接入</Button>
          </div>
        </div>
      </Card>

      <section aria-labelledby="network-state-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text" id="network-state-title">网络状态</h2>
          <span className="text-[11px] text-text-subtle">仅展示后端已确认的数据</span>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {stats.map(({ icon: Icon, ...item }) => (
            <Card key={item.label} className="min-w-0 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-xs font-medium text-text-muted">{item.label}</p><p className="mt-2 truncate text-lg font-semibold tracking-[-0.02em] text-text" title={item.value}>{item.value}</p></div>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Icon aria-hidden="true" size={17} /></span>
              </div>
              <p className="mt-3 truncate text-[10px] text-text-subtle" title={item.detail}>{item.detail}</p>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-text">快速管理</h2><p className="mt-1 text-xs text-text-muted">继续配置或检查本机代理状态</p></div><Gauge aria-hidden="true" className="text-accent" size={18} /></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              { to: "/profiles", title: "配置", detail: activeProfile ? "管理当前配置" : "导入第一份配置", icon: FileStack },
              { to: "/proxies/nodes", title: "节点", detail: overview ? `${String(overview.nodes.length)} 个节点` : "读取 Controller", icon: Network },
              { to: "/logs", title: "日志", detail: "查看内核输出", icon: Activity },
            ].map(({ icon: Icon, ...item }) => (
              <Link key={item.to} className="group rounded-xl border border-line bg-surface-raised p-3 outline-none transition-colors hover:border-line-strong hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus" to={item.to}>
                <div className="flex items-center justify-between"><Icon aria-hidden="true" className="text-text-muted group-hover:text-accent" size={16} /><ArrowRight aria-hidden="true" className="text-text-subtle" size={14} /></div>
                <p className="mt-3 text-xs font-semibold text-text">{item.title}</p><p className="mt-1 text-[10px] text-text-subtle">{item.detail}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-text">流量接管</h2><p className="mt-1 text-xs text-text-muted">内核运行不代表系统流量已接管</p></div><Layers3 aria-hidden="true" className="text-text-subtle" size={18} /></div>
          <dl className="mt-4 divide-y divide-line text-xs">
            <div className="flex items-center justify-between py-2.5"><dt className="text-text-muted">Mihomo Controller</dt><dd className={snapshot.controller_available ? "font-semibold text-positive" : "text-text-subtle"}>{snapshot.controller_available ? "已连接" : "未连接"}</dd></div>
            <div className="flex items-center justify-between py-2.5"><dt className="text-text-muted">系统代理</dt><dd className="text-text-subtle">未接入</dd></div>
            <div className="flex items-center justify-between py-2.5"><dt className="text-text-muted">TUN</dt><dd className="text-text-subtle">未接入</dd></div>
            <div className="flex items-center justify-between py-2.5"><dt className="text-text-muted">实时流量</dt><dd className="text-text-subtle">未接入</dd></div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
