import {
  FileStack,
  Gauge,
  Network,
  ScrollText,
  Settings2,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
  matchPrefix?: string;
}

export const navigationItems: readonly NavigationItem[] = [
  {
    label: "首页",
    description: "运行概览",
    path: "/",
    icon: Gauge,
  },
  {
    label: "代理",
    description: "节点与策略组",
    path: "/proxies/nodes",
    matchPrefix: "/proxies",
    icon: Waypoints,
  },
  {
    label: "连接",
    description: "实时连接",
    path: "/connections",
    icon: Network,
  },
  {
    label: "配置",
    description: "配置与订阅",
    path: "/profiles",
    icon: FileStack,
  },
  {
    label: "日志",
    description: "内核运行日志",
    path: "/logs",
    icon: ScrollText,
  },
  {
    label: "设置",
    description: "应用偏好",
    path: "/settings",
    icon: Settings2,
  },
] as const;
