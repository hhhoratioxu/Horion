import type { ProxyNode, ProxySort } from "../types/proxy";

export interface ProxyNodeFilter {
  protocol: string;
  query: string;
  sort: ProxySort;
}

function latencyRank(node: ProxyNode): number {
  return node.alive && node.delay !== null && node.delay > 0
    ? node.delay
    : Number.POSITIVE_INFINITY;
}

export function filterAndSortNodes(
  nodes: readonly ProxyNode[],
  filter: ProxyNodeFilter,
): ProxyNode[] {
  const query = filter.query.trim().toLocaleLowerCase();
  const protocol = filter.protocol.toLocaleLowerCase();
  const result = nodes.filter((node) => {
    const protocolMatches =
      protocol === "all" || node.type.toLocaleLowerCase() === protocol;
    const queryMatches =
      !query ||
      [node.name, node.type, node.server ?? "", ...node.groups]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    return protocolMatches && queryMatches;
  });

  if (filter.sort === "latency") {
    result.sort(
      (left, right) =>
        latencyRank(left) - latencyRank(right) ||
        left.name.localeCompare(right.name, "zh-CN"),
    );
  }
  return result;
}

export function formatDelay(delay: number | null, alive: boolean): string {
  if (!alive) return "不可用";
  if (delay === null || delay <= 0) return "未测试";
  return `${String(delay)} ms`;
}
