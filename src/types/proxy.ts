export type ProxyMode = "rule" | "global" | "direct";

export interface ProxyGroup {
  name: string;
  type: string;
  now: string;
  all: string[];
  alive: boolean;
  delay: number | null;
}

export interface ProxyNode {
  name: string;
  type: string;
  server: string | null;
  port: number | null;
  groups: string[];
  alive: boolean;
  delay: number | null;
}

export interface ProxyOverview {
  mode: ProxyMode;
  groups: ProxyGroup[];
  nodes: ProxyNode[];
  updated_at: string;
}

export interface ProxyDelayResult {
  delay: number;
}

export type ProxySort = "default" | "latency";
