import { Search, XCircle } from "lucide-react";

import { Button } from "../components/ui/button";
import { FeatureBadge } from "../components/ui/feature-badge";
import { PageHeading } from "../components/ui/page-heading";
import { PageState } from "../components/ui/page-state";

export function ConnectionsPage() {
  return (
    <div className="space-y-5">
      <PageHeading
        action={<FeatureBadge phase={4} />}
        description="通过 Mihomo Controller API 查看和管理实时连接。"
        eyebrow="Connections"
        title="连接"
      />
      <div className="flex justify-end gap-2">
        <Button disabled title="连接 API 尚未接入">
          <Search aria-hidden="true" size={15} />
          筛选连接
        </Button>
        <Button disabled title="连接 API 尚未接入">
          <XCircle aria-hidden="true" size={15} />
          关闭全部
        </Button>
      </div>
      <PageState
        description="当前没有连接数据源。缺失的进程名、目标地址等字段会在接入时按可空类型安全处理。"
        kind="offline"
        title="Controller 尚未连接"
      />
    </div>
  );
}
