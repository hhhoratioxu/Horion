import { ProxyTabs } from "../components/navigation/proxy-tabs";
import { FeatureBadge } from "../components/ui/feature-badge";
import { PageHeading } from "../components/ui/page-heading";
import { PageState } from "../components/ui/page-state";

export function ProxyGroupsPage() {
  return (
    <div className="space-y-5">
      <PageHeading
        action={<FeatureBadge phase={4} />}
        description="查看内核实际返回的代理组类型和当前选项。"
        eyebrow="Proxies"
        title="代理"
      />
      <ProxyTabs />
      <PageState
        description="Horion 不会预设或虚构 Mihomo 的代理组能力。连接内核后，此页面将按 API 响应呈现可用选项。"
        kind="development"
        title="代理组功能尚未接入"
      />
    </div>
  );
}
