import type { CoreState } from "../types/core";
import type { StatusTone } from "../types/status";

interface CoreStatePresentation {
  description: string;
  label: string;
  tone: StatusTone;
}

export const coreStatePresentation = {
  not_installed: {
    label: "未安装",
    description: "安装官方 Mihomo 内核，或导入本机已有的可执行文件。",
    tone: "neutral",
  },
  stopped: {
    label: "已停止",
    description: "内核已经安装，可以安全启动。",
    tone: "neutral",
  },
  downloading: {
    label: "正在下载",
    description: "正在下载官方 Mihomo 内核，请保持网络连接。",
    tone: "warning",
  },
  installing: {
    label: "正在安装",
    description: "正在校验并安装内核，请勿关闭 Horion。",
    tone: "warning",
  },
  starting: {
    label: "正在启动",
    description: "内核进程正在启动并接受健康检查。",
    tone: "warning",
  },
  running: {
    label: "运行中",
    description: "Mihomo 内核进程正在运行。",
    tone: "positive",
  },
  stopping: {
    label: "正在停止",
    description: "正在安全结束 Mihomo 内核进程。",
    tone: "warning",
  },
  crashed: {
    label: "异常退出",
    description: "内核进程意外退出，可查看日志并尝试重新启动。",
    tone: "negative",
  },
  error: {
    label: "错误",
    description: "内核管理发生错误，请查看错误信息和日志。",
    tone: "negative",
  },
} satisfies Record<CoreState, CoreStatePresentation>;

export const transitionalCoreStates: ReadonlySet<CoreState> = new Set([
  "downloading",
  "installing",
  "starting",
  "stopping",
]);

export function getCoreSourceLabel(source: string | null): string {
  switch (source) {
    case "official":
      return "官方校验版本";
    case "imported":
      return "本机导入";
    default:
      return source ?? "—";
  }
}
