import { describe, expect, it } from "vitest";

import type { ProxyNode } from "../types/proxy";
import { filterAndSortNodes } from "./proxy-view";

const nodes: ProxyNode[] = [
  { name: "Tokyo A", type: "ss", server: "jp.example", port: 443, groups: ["自动"], alive: true, delay: 82 },
  { name: "香港 B", type: "vmess", server: "hk.example", port: 443, groups: ["手动"], alive: true, delay: 31 },
  { name: "Offline", type: "ss", server: null, port: null, groups: [], alive: false, delay: null },
];

describe("proxy node view", () => {
  it("filters by query and protocol without mutating source data", () => {
    const result = filterAndSortNodes(nodes, { query: "example", protocol: "ss", sort: "default" });
    expect(result.map((node) => node.name)).toEqual(["Tokyo A"]);
    expect(nodes.map((node) => node.name)).toEqual(["Tokyo A", "香港 B", "Offline"]);
  });

  it("sorts measured healthy nodes first by latency", () => {
    const result = filterAndSortNodes(nodes, { query: "", protocol: "all", sort: "latency" });
    expect(result.map((node) => node.name)).toEqual(["香港 B", "Tokyo A", "Offline"]);
  });
});
