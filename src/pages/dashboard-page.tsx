import {
  Activity,
  ArrowDown,
  ArrowUp,
  CircleCheck,
  Cpu,
  Download,
  Gauge,
  Globe2,
  LoaderCircle,
  Play,
  RadioTower,
  RotateCw,
  Route,
  Square,
  Timer,
} from "lucide-react";

import {
  coreStatePresentation,
  getCoreSourceLabel,
  transitionalCoreStates,
} from "../core/core-status";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { FeatureBadge } from "../components/ui/feature-badge";
import { MetricCard } from "../components/ui/metric-card";
import { PageHeading } from "../components/ui/page-heading";
import { useCoreStore } from "../stores/core-store";
import { cn } from "../utils/cn";

const metrics = [
  { label: "上传速度", value: "—", detail: "等待 Controller 流量数据", icon: ArrowUp },
  { label: "下载速度", value: "—", detail: "等待 Controller 流量数据", icon: ArrowDown },
  { label: "活动连接", value: "—", detail: "等待 Controller API", icon: Activity },
  { label: "内存占用", value: "—", detail: "等待内核运行数据", icon: Cpu },
  { label: "累计上传", value: "—", detail: "等待 Controller 流量数据", icon: Gauge },
  { label: "累计下载", value: "—", detail: "等待 Controller 流量数据", icon: RadioTower },
  { label: "公网出口 IP", value: "—", detail: "尚未执行网络检测", icon: Globe2 },
  { label: "当前延迟", value: "—", detail: "尚未选择代理节点", icon: Timer },
] as const;

const actionLabels = {
  install_official: "正在安装…",
  import_from_path: "正在导入…",
  start: "正在启动…",
  stop: "正在停止…",
  restart: "正在重启…",
} as const;

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

  const presentation = coreStatePresentation[snapshot.state];
  const transitioning = transitionalCoreStates.has(snapshot.state);
  const controlsDisabled = Boolean(pendingAction) || transitioning || !runtimeAvailable;
  const visibleError = actionError ?? snapshot.last_error ?? statusError;
  const coreReady = snapshot.installed;
  const controllerReady = snapshot.controller_available;
  const readyCount = 1 + Number(coreReady) + Number(controllerReady);
  const sourceLabel = getCoreSourceLabel(snapshot.source);

  return (
    <div className="space-y-5">
      <PageHeading
        description="安装、启动并监控本机 Mihomo 内核。系统代理仍保持关闭，除非后续明确启用。"
        eyebrow="Overview"
        title="运行概览"
      />

      <Card
        aria-busy={Boolean(pendingAction) || transitioning}
        className="relative overflow-hidden p-5 xl:p-6"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                  presentation.tone === "positive" &&
                    "border-positive/25 bg-positive-soft text-positive",
                  presentation.tone === "warning" &&
                    "border-warning/25 bg-warning-soft text-warning",
                  presentation.tone === "negative" &&
                    "border-negative/25 bg-negative-soft text-negative",
                  presentation.tone === "neutral" &&
                    "border-line bg-surface-raised text-text-muted",
                )}
                role="status"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full bg-current",
                    (transitioning || pendingAction) && "animate-pulse",
                  )}
                />
                {!initialized
                  ? "正在检测"
                  : pendingAction
                    ? actionLabels[pendingAction]
                    : presentation.label}
              </span>
              {snapshot.version ? (
                <span className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-text-muted">
                  v{snapshot.version}
                </span>
              ) : null}
            </div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-text">
              Mihomo 内核管理
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">
              {!runtimeAvailable && initialized
                ? "当前是浏览器预览环境。请启动 Horion 桌面应用来管理本机内核。"
                : presentation.description}
            </p>
            {visibleError ? (
              <p
                className="mt-3 rounded-[10px] border border-negative/25 bg-negative-soft px-3 py-2 text-xs leading-5 text-negative"
                role="alert"
              >
                {visibleError}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {!snapshot.installed ? (
              <Button
                disabled={controlsDisabled}
                onClick={() => void installOfficial()}
                variant="primary"
              >
                {pendingAction === "install_official" ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
                ) : (
                  <Download aria-hidden="true" size={15} />
                )}
                安装已验证版本 v1.19.29
              </Button>
            ) : null}
            {snapshot.installed && snapshot.state !== "running" ? (
              <Button
                disabled={controlsDisabled}
                onClick={() =>
                  void (snapshot.state === "crashed" || snapshot.state === "error"
                    ? restart()
                    : start())
                }
                variant="primary"
              >
                {pendingAction === "start" || pendingAction === "restart" ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
                ) : snapshot.state === "crashed" || snapshot.state === "error" ? (
                  <RotateCw aria-hidden="true" size={15} />
                ) : (
                  <Play aria-hidden="true" size={15} />
                )}
                {snapshot.state === "crashed" || snapshot.state === "error"
                  ? "重新启动"
                  : "启动内核"}
              </Button>
            ) : null}
            {snapshot.state === "running" ? (
              <>
                <Button disabled={controlsDisabled} onClick={() => void stop()}>
                  <Square aria-hidden="true" size={14} />
                  停止
                </Button>
                <Button disabled={controlsDisabled} onClick={() => void restart()}>
                  <RotateCw aria-hidden="true" size={15} />
                  重启
                </Button>
              </>
            ) : null}
            <Button disabled title="系统代理能力尚未接入">
              <Route aria-hidden="true" size={15} />
              系统代理未接入
            </Button>
          </div>
        </div>

        {snapshot.installed ? (
          <dl className="relative mt-5 grid gap-3 border-t border-line pt-4 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-text-subtle">来源</dt>
              <dd className="mt-1 font-semibold text-text">{sourceLabel}</dd>
            </div>
            <div>
              <dt className="text-text-subtle">进程 PID</dt>
              <dd className="mt-1 font-semibold text-text">{snapshot.pid ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-subtle">健康检查</dt>
              <dd className="mt-1 font-semibold text-text">
                {snapshot.healthy ? "正常" : "未通过"}
              </dd>
            </div>
            <div>
              <dt className="text-text-subtle">Controller</dt>
              <dd className="mt-1 font-semibold text-text">
                {snapshot.controller_available ? "可用" : "不可用"}
              </dd>
            </div>
          </dl>
        ) : null}
      </Card>

      <section aria-labelledby="metrics-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="metrics-title" className="text-sm font-semibold text-text">
            实时指标
          </h2>
          <span className="text-[11px] text-text-subtle">
            数据源：{snapshot.controller_available ? "Controller 已连接，指标待接入" : "未连接"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-text">运行能力</h2>
              <p className="mt-1 text-xs text-text-muted">只标记后端已确认的真实状态</p>
            </div>
            <span className="text-xs font-semibold text-accent">{readyCount} / 3</span>
          </div>
          <div className="mt-5 space-y-4">
            {[
              {
                title: "桌面界面",
                description: "路由、主题和内核控制界面已启用",
                ready: true,
              },
              {
                title: "Mihomo 内核",
                description: coreReady ? "已检测到可管理的内核文件" : "尚未安装或导入内核",
                ready: coreReady,
              },
              {
                title: "Controller API",
                description: controllerReady ? "后端健康检查已通过" : "尚未建立 Controller 连接",
                ready: controllerReady,
              },
            ].map((item, index, items) => (
              <div key={item.title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={
                      item.ready
                        ? "grid size-7 place-items-center rounded-full bg-positive-soft text-positive"
                        : "grid size-7 place-items-center rounded-full border border-line bg-surface-raised text-text-subtle"
                    }
                  >
                    {item.ready ? (
                      <CircleCheck aria-hidden="true" size={15} />
                    ) : (
                      <span className="text-[11px] font-semibold">{index + 1}</span>
                    )}
                  </div>
                  {index < items.length - 1 ? <span className="my-1 h-6 w-px bg-line" /> : null}
                </div>
                <div className="pb-2">
                  <p className="text-sm font-semibold text-text">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-text-muted">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text">网络边界</h2>
              <p className="mt-1 text-xs text-text-muted">启动内核不等于启用系统代理</p>
            </div>
            <FeatureBadge phase={4} />
          </div>
          <div className="mt-5 space-y-3">
            {["系统代理未接入", "TUN 未接入", "未选择代理节点", "流量与连接数据尚未接入"].map(
              (item) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5 rounded-[10px] bg-surface-raised px-3 py-2.5 text-xs text-text-muted"
                >
                  <CircleCheck aria-hidden="true" className="text-positive" size={14} />
                  {item}
                </div>
              ),
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
