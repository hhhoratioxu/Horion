import { Search, XCircle } from "lucide-react";

import { Button } from "../components/ui/button";
import { PageHeading } from "../components/ui/page-heading";
import { PageState } from "../components/ui/page-state";

export function ConnectionsPage() {
  return (
    <div className="space-y-5">
      <PageHeading
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
        description="连接数据接口尚未接入。接入后将只展示 Controller 返回的真实连接，缺失字段保持为空。"
        kind="offline"
        title="实时连接尚未接入"
      />
    </div>
  );
}
