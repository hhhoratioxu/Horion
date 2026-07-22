import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { Card } from "../components/ui/card";

export function NotFoundPage() {
  return (
    <Card className="grid min-h-[420px] place-items-center p-8 text-center">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-accent uppercase">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-text">页面不存在</h1>
        <p className="mt-2 text-sm text-text-muted">这个地址不属于当前 Horion 桌面应用。</p>
        <Link
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-contrast outline-none focus-visible:ring-2 focus-visible:ring-focus"
          to="/"
        >
          <ArrowLeft aria-hidden="true" size={15} />
          返回首页
        </Link>
      </div>
    </Card>
  );
}
