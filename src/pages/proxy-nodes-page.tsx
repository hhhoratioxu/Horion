import { Search, TimerReset } from "lucide-react";

import { ProxyTabs } from "../components/navigation/proxy-tabs";
import { Button } from "../components/ui/button";
import { FeatureBadge } from "../components/ui/feature-badge";
import { PageHeading } from "../components/ui/page-heading";
import { PageState } from "../components/ui/page-state";

export function ProxyNodesPage() {
  return (
    <div className="space-y-5">
      <PageHeading
        action={<FeatureBadge phase={4} />}
        description="查看、筛选和测试 Mihomo 提供的代理节点。"
        eyebrow="Proxies"
        title="代理"
      />
      <div className="flex items-center justify-between gap-3">
        <ProxyTabs />
        <div className="flex gap-2">
          <Button disabled title="阶段 4 将实现节点搜索">
            <Search aria-hidden="true" size={15} />
            搜索
          </Button>
          <Button disabled title="阶段 4 将实现并发受限的延迟测试">
            <TimerReset aria-hidden="true" size={15} />
            测试全部
          </Button>
        </div>
      </div>
      <PageState
        description="节点数据必须来自已认证的本地 Controller API。完成内核管理后，将在阶段 4 接入真实节点列表。"
        kind="development"
        title="节点功能尚未接入"
      />
    </div>
  );
}
