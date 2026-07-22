import {
  Activity,
  ArrowDown,
  ArrowUp,
  CircleCheck,
  Cpu,
  Gauge,
  Globe2,
  Power,
  RadioTower,
  Route,
  Timer,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { FeatureBadge } from "../components/ui/feature-badge";
import { MetricCard } from "../components/ui/metric-card";
import { PageHeading } from "../components/ui/page-heading";

const metrics = [
  { label: "上传速度", value: "—", detail: "等待内核流量数据", icon: ArrowUp },
  { label: "下载速度", value: "—", detail: "等待内核流量数据", icon: ArrowDown },
  { label: "活动连接", value: "—", detail: "等待 Controller API", icon: Activity },
  { label: "内存占用", value: "—", detail: "等待内核运行数据", icon: Cpu },
  { label: "累计上传", value: "—", detail: "本次内核会话", icon: Gauge },
  { label: "累计下载", value: "—", detail: "本次内核会话", icon: RadioTower },
  { label: "公网出口 IP", value: "—", detail: "尚未执行网络检测", icon: Globe2 },
  { label: "当前延迟", value: "—", detail: "尚未选择代理节点", icon: Timer },
] as const;

const readiness = [
  {
    title: "桌面界面",
    description: "路由、主题和响应式应用框架已启用",
    ready: true,
  },
  {
    title: "Mihomo 内核",
    description: "将在阶段 3 实现检测、校验和生命周期管理",
    ready: false,
  },
  {
    title: "Controller API",
    description: "将在阶段 4 连接实时状态和流量数据",
    ready: false,
  },
] as const;

export function DashboardPage() {
  return (
    <div className="space-y-5">
      <PageHeading
        description="Horion 当前运行在安全的未连接状态。接入经过校验的 Mihomo 内核后，这里将显示真实网络数据。"
        eyebrow="Overview"
        title="运行概览"
      />

      <Card className="relative overflow-hidden p-5 xl:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-raised px-3 py-1.5 text-xs font-semibold text-text-muted">
                <span className="size-1.5 rounded-full bg-text-subtle" />
                未连接
              </span>
              <FeatureBadge phase={3} />
            </div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-text">
              控制面板已经就绪
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">
              当前没有启动或探测任何代理内核，因此不会修改系统网络。内核安装与启动能力将在后续阶段接入。
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button disabled title="阶段 3 将实现此功能">
              <Power aria-hidden="true" size={15} />
              启动内核
            </Button>
            <Button disabled title="阶段 6 将实现此功能" variant="primary">
              <Route aria-hidden="true" size={15} />
              开启系统代理
            </Button>
          </div>
        </div>
      </Card>

      <section aria-labelledby="metrics-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="metrics-title" className="text-sm font-semibold text-text">
            实时指标
          </h2>
          <span className="text-[11px] text-text-subtle">数据源：未连接</span>
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
              <h2 className="text-sm font-semibold text-text">初始化进度</h2>
              <p className="mt-1 text-xs text-text-muted">按可验证阶段逐步接入能力</p>
            </div>
            <span className="text-xs font-semibold text-accent">1 / 3</span>
          </div>
          <div className="mt-5 space-y-4">
            {readiness.map((item, index) => (
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
                  {index < readiness.length - 1 ? (
                    <span className="my-1 h-6 w-px bg-line" />
                  ) : null}
                </div>
                <div className="pb-2">
                  <p className="text-sm font-semibold text-text">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-text-muted">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-text">安全基线</h2>
          <p className="mt-1 text-xs text-text-muted">阶段 1 不执行任何网络变更</p>
          <div className="mt-5 space-y-3">
            {[
              "未启动外部进程",
              "未修改系统代理",
              "未请求管理员权限",
              "未收集或上传数据",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2.5 rounded-[10px] bg-surface-raised px-3 py-2.5 text-xs text-text-muted"
              >
                <CircleCheck aria-hidden="true" className="text-positive" size={14} />
                {item}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
