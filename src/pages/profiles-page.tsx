import { FileUp, Plus, RefreshCw } from "lucide-react";

import { Button } from "../components/ui/button";
import { FeatureBadge } from "../components/ui/feature-badge";
import { PageHeading } from "../components/ui/page-heading";
import { PageState } from "../components/ui/page-state";

export function ProfilesPage() {
  return (
    <div className="space-y-5">
      <PageHeading
        action={<FeatureBadge phase={5} />}
        description="安全地管理本地配置、远程订阅、备份和版本历史。"
        eyebrow="Profiles"
        title="配置"
      />
      <div className="flex justify-end gap-2">
        <Button disabled title="阶段 5 将实现安全的本地导入">
          <FileUp aria-hidden="true" size={15} />
          导入配置
        </Button>
        <Button disabled title="阶段 5 将实现安全的订阅存储">
          <Plus aria-hidden="true" size={15} />
          添加订阅
        </Button>
        <Button disabled title="阶段 5 将实现可回滚的订阅更新">
          <RefreshCw aria-hidden="true" size={15} />
          更新全部
        </Button>
      </div>
      <PageState
        description="订阅 URL 和认证信息涉及敏感数据。安全存储、路径校验与回滚机制完成前，不开放导入操作。"
        kind="development"
        title="配置管理正在开发"
      />
    </div>
  );
}
