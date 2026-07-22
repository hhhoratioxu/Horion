import { Download, Pause, Search, Trash2 } from "lucide-react";

import { Button } from "../components/ui/button";
import { FeatureBadge } from "../components/ui/feature-badge";
import { PageHeading } from "../components/ui/page-heading";
import { PageState } from "../components/ui/page-state";

export function LogsPage() {
  return (
    <div className="space-y-5">
      <PageHeading
        action={<FeatureBadge phase="3–4" />}
        description="查看经过隐私脱敏的应用与内核日志。"
        eyebrow="Logs"
        title="日志"
      />
      <div className="flex justify-end gap-2">
        <Button disabled title="实时日志流尚未接入">
          <Search aria-hidden="true" size={15} />
          搜索
        </Button>
        <Button disabled title="实时日志流尚未接入">
          <Pause aria-hidden="true" size={15} />
          暂停
        </Button>
        <Button disabled title="日志导出尚未接入">
          <Download aria-hidden="true" size={15} />
          导出
        </Button>
        <Button disabled title="当前没有可清空的日志">
          <Trash2 aria-hidden="true" size={15} />
          清空
        </Button>
      </div>
      <PageState
        description="日志采集将在内核生命周期管理完成后接入，并在前后端双层屏蔽 secret、Token、UUID 和订阅凭据。"
        kind="offline"
        title="日志数据源尚未连接"
      />
    </div>
  );
}
