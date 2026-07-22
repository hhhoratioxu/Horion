import { CircleAlert, RotateCcw } from "lucide-react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

export function RouteErrorPage() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `路由请求返回 ${String(error.status)} ${error.statusText}`
    : "页面渲染遇到未预期错误。应用数据没有被修改。";

  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-6 text-text">
      <section className="w-full max-w-lg rounded-[14px] border border-negative/25 bg-surface p-6 shadow-card">
        <div className="grid size-11 place-items-center rounded-[12px] bg-negative-soft text-negative">
          <CircleAlert aria-hidden="true" size={21} />
        </div>
        <h1 className="mt-5 text-xl font-semibold">页面无法显示</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">{detail}</p>
        <button
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-[10px] border border-line bg-surface-raised px-3.5 text-sm font-semibold outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus"
          onClick={() => {
            window.location.reload();
          }}
          type="button"
        >
          <RotateCcw aria-hidden="true" size={15} />
          重新加载
        </button>
      </section>
    </main>
  );
}
