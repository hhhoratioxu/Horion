import { useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  Check,
  CircleAlert,
  CloudDownload,
  Copy,
  FileCode2,
  FileUp,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Modal } from "../components/ui/modal";
import { PageHeading } from "../components/ui/page-heading";
import { PageState } from "../components/ui/page-state";
import { useProfileStore } from "../stores/profile-store";
import type { ProfileSummary } from "../types/profile";
import { cn } from "../utils/cn";

type AddPanel = "local" | "subscription" | null;
type NameDialog = { kind: "rename" | "duplicate"; profile: ProfileSummary } | null;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatDate(value: string | null): string {
  if (!value) return "从未";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function suggestedName(path: string): string {
  return path.split(/[\\/]/).pop()?.replace(/\.(yaml|yml)$/i, "") ?? "本地配置";
}

export function ProfilesPage() {
  const [panel, setPanel] = useState<AddPanel>(null);
  const [localName, setLocalName] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [dragging, setDragging] = useState(false);
  const [subscriptionName, setSubscriptionName] = useState("");
  const [subscriptionUrl, setSubscriptionUrl] = useState("");
  const [userAgent, setUserAgent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [nameDialog, setNameDialog] = useState<NameDialog>(null);
  const [dialogName, setDialogName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProfileSummary | null>(null);

  const profiles = useProfileStore((state) => state.profiles);
  const runtimeAvailable = useProfileStore((state) => state.runtimeAvailable);
  const initialized = useProfileStore((state) => state.initialized);
  const loading = useProfileStore((state) => state.loading);
  const error = useProfileStore((state) => state.error);
  const pendingAction = useProfileStore((state) => state.pendingAction);
  const pendingId = useProfileStore((state) => state.pendingId);
  const editor = useProfileStore((state) => state.editor);
  const editorName = useProfileStore((state) => state.editorName);
  const editorLoading = useProfileStore((state) => state.editorLoading);
  const editorError = useProfileStore((state) => state.editorError);
  const revisionConflict = useProfileStore((state) => state.revisionConflict);
  const load = useProfileStore((state) => state.load);
  const importLocal = useProfileStore((state) => state.importLocal);
  const addSubscription = useProfileStore((state) => state.addSubscription);
  const update = useProfileStore((state) => state.update);
  const updateAll = useProfileStore((state) => state.updateAll);
  const rename = useProfileStore((state) => state.rename);
  const duplicate = useProfileStore((state) => state.duplicate);
  const deleteProfile = useProfileStore((state) => state.deleteProfile);
  const activate = useProfileStore((state) => state.activate);
  const openEditor = useProfileStore((state) => state.openEditor);
  const closeEditor = useProfileStore((state) => state.closeEditor);
  const updateEditorContent = useProfileStore((state) => state.updateEditorContent);
  const saveEditor = useProfileStore((state) => state.saveEditor);
  const reloadEditor = useProfileStore((state) => state.reloadEditor);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/webview").then(async ({ getCurrentWebview }) => {
      if (disposed) return;
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setDragging(true);
        } else if (event.payload.type === "leave") {
          setDragging(false);
        } else {
          setDragging(false);
          const path = event.payload.paths.find((item) => /\.ya?ml$/i.test(item));
          if (path) {
            setPanel("local");
            setLocalPath(path);
            setLocalName((current) => current || suggestedName(path));
            setFormError(null);
          }
        }
      });
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const orderedProfiles = useMemo(
    () => [...profiles].sort((a, b) => Number(b.active) - Number(a.active)),
    [profiles],
  );
  const busy = Boolean(pendingAction);
  const subscriptions = profiles.filter((profile) => profile.kind === "subscription");

  const submitLocal = async () => {
    const name = localName.trim();
    const path = localPath.trim();
    if (!name || !path) {
      setFormError("请填写配置名称和完整绝对路径。");
      return;
    }
    const success = await importLocal(name, path);
    if (success) {
      setPanel(null);
      setLocalName("");
      setLocalPath("");
      setFormError(null);
    }
  };

  const submitSubscription = async () => {
    const name = subscriptionName.trim();
    const url = subscriptionUrl.trim();
    if (!name || !url) {
      setFormError("请填写订阅名称和 HTTPS 地址。");
      return;
    }
    try {
      if (new URL(url).protocol !== "https:") throw new Error("HTTPS required");
    } catch {
      setFormError("订阅地址必须是有效的 HTTPS URL。");
      return;
    }
    const success = await addSubscription(name, url, userAgent.trim() || null);
    if (success) {
      setPanel(null);
      setSubscriptionName("");
      setSubscriptionUrl("");
      setUserAgent("");
      setFormError(null);
    }
  };

  let listContent;
  if (!initialized && loading) {
    listContent = <PageState description="正在读取本机配置索引。" kind="loading" title="正在载入配置" />;
  } else if (!runtimeAvailable) {
    listContent = <PageState description="浏览器预览不会读取本机路径或订阅。请启动 Horion 桌面应用。" kind="offline" title="仅桌面应用可管理配置" />;
  } else if (error && profiles.length === 0) {
    listContent = <PageState action={<Button onClick={() => void load()}><RefreshCw aria-hidden="true" size={15} />重试</Button>} description={error} kind="error" title="配置读取失败" />;
  } else if (profiles.length === 0) {
    listContent = <PageState action={<Button onClick={() => { setPanel("local"); }} variant="primary"><FileUp aria-hidden="true" size={15} />导入第一份配置</Button>} description="导入本机 YAML，或添加一个可信的 HTTPS 订阅。" kind="empty" title="还没有配置" />;
  } else {
    listContent = (
      <div className="space-y-3" aria-label="配置列表">
        {orderedProfiles.map((profile) => {
          const pending = pendingId === profile.id;
          const usage = profile.subscription;
          const used = usage ? (usage.upload ?? 0) + (usage.download ?? 0) : 0;
          const usagePercent = usage?.total ? Math.min(100, (used / usage.total) * 100) : null;
          return (
            <Card key={profile.id} className={cn("overflow-hidden transition-colors", profile.active && "border-accent/45 ring-1 ring-accent/10")}>
              <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-center">
                <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl", profile.active ? "bg-accent text-accent-contrast" : "bg-surface-raised text-text-muted")}>
                  {profile.kind === "subscription" ? <CloudDownload aria-hidden="true" size={18} /> : <FileCode2 aria-hidden="true" size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-text">{profile.name}</h2>
                    {profile.active ? <span className="inline-flex items-center gap-1 rounded-full bg-positive-soft px-2 py-0.5 text-[10px] font-bold text-positive"><Check aria-hidden="true" size={10} />当前配置</span> : null}
                    <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-text-subtle">{profile.kind === "subscription" ? "订阅" : "本地"}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-text-muted" title={profile.source_label}>{profile.source_label}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-subtle">
                    <span>{formatBytes(profile.bytes)}</span>
                    <span>修订 {profile.revision}</span>
                    <span>更新于 {formatDate(profile.updated_at)}</span>
                    {profile.kind === "subscription" ? <span>检查于 {formatDate(profile.last_checked_at)}</span> : null}
                  </div>
                  {usagePercent !== null ? (
                    <div className="mt-2.5 max-w-sm">
                      <div className="mb-1 flex justify-between text-[10px] text-text-subtle"><span>已用 {formatBytes(used)}</span><span>{formatBytes(usage?.total ?? 0)}</span></div>
                      <div className="h-1 overflow-hidden rounded-full bg-surface-raised"><div className="h-full rounded-full bg-accent" style={{ width: `${String(usagePercent)}%` }} /></div>
                    </div>
                  ) : null}
                  {profile.last_error ? <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-negative"><CircleAlert aria-hidden="true" size={12} />{profile.last_error}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  {!profile.active ? <Button className="h-8 text-xs" disabled={busy} onClick={() => void activate(profile.id)} variant="primary">{pending && pendingAction === "activate" ? <LoaderCircle aria-hidden="true" className="animate-spin" size={13} /> : <Play aria-hidden="true" size={13} />}激活</Button> : null}
                  {profile.kind === "subscription" ? <Button aria-label={`更新 ${profile.name}`} className="h-8 px-2.5 text-xs" disabled={busy} onClick={() => void update(profile.id)}><RefreshCw aria-hidden="true" className={cn(pending && pendingAction === "update" && "animate-spin")} size={13} />更新</Button> : null}
                  <Button aria-label={`编辑 ${profile.name}`} className="h-8 px-2.5 text-xs" disabled={busy} onClick={() => void openEditor(profile.id, profile.name)}><FileCode2 aria-hidden="true" size={13} />编辑</Button>
                  <div className="group relative">
                    <Button aria-label={`更多 ${profile.name}`} className="h-8 px-2" disabled={busy}><MoreHorizontal aria-hidden="true" size={15} /></Button>
                    <div className="invisible absolute right-0 top-full z-20 mt-1 w-36 rounded-xl border border-line bg-surface p-1 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                      <button className="menu-item" onClick={() => { setNameDialog({ kind: "rename", profile }); setDialogName(profile.name); }} type="button"><Pencil aria-hidden="true" size={13} />重命名</button>
                      <button className="menu-item" onClick={() => { setNameDialog({ kind: "duplicate", profile }); setDialogName(`${profile.name} 副本`); }} type="button"><Copy aria-hidden="true" size={13} />复制</button>
                      {!profile.active ? <button className="menu-item text-negative" onClick={() => { setDeleteTarget(profile); }} type="button"><Trash2 aria-hidden="true" size={13} />删除</button> : null}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeading
        action={<span className="rounded-full border border-line bg-surface-raised px-3 py-1.5 text-xs font-semibold text-text-muted">{profiles.length} 份配置</span>}
        description="管理本地 YAML 与远程订阅，内容只保留在受控的后端数据目录。"
        eyebrow="Profiles"
        title="配置"
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button disabled={!runtimeAvailable || busy} onClick={() => { setPanel(panel === "local" ? null : "local"); setFormError(null); }}><FileUp aria-hidden="true" size={15} />导入本地</Button>
        <Button disabled={!runtimeAvailable || busy} onClick={() => { setPanel(panel === "subscription" ? null : "subscription"); setFormError(null); }}><Plus aria-hidden="true" size={15} />添加订阅</Button>
        <Button disabled={!runtimeAvailable || busy || subscriptions.length === 0} onClick={() => void updateAll()} variant="primary">{pendingAction === "update_all" ? <LoaderCircle aria-hidden="true" className="animate-spin" size={14} /> : <RefreshCw aria-hidden="true" size={14} />}更新全部</Button>
      </div>

      {panel ? (
        <Card className="p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            {panel === "local" ? (
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submitLocal(); }}>
                <div><h2 className="text-sm font-semibold text-text">导入本地配置</h2><p className="mt-1 text-xs text-text-muted">后端会验证绝对路径、大小和 YAML 内容，再复制到应用数据目录。</p></div>
                <div className="grid gap-3 md:grid-cols-[0.7fr_1.3fr]">
                  <label className="field-label">名称<input autoComplete="off" className="control mt-1.5 h-10 w-full" onChange={(event) => { setLocalName(event.target.value); }} placeholder="例如：家庭网络" value={localName} /></label>
                  <label className="field-label">YAML 绝对路径<input autoComplete="off" className="control mt-1.5 h-10 w-full font-mono text-xs" onChange={(event) => { setLocalPath(event.target.value); }} placeholder="C:\Configs\profile.yaml" spellCheck={false} value={localPath} /></label>
                </div>
                <div className={cn("rounded-xl border border-dashed px-4 py-3 text-xs transition-colors", dragging ? "border-accent bg-accent-soft text-accent" : "border-line text-text-subtle")}><UploadCloud aria-hidden="true" className="mr-2 inline" size={15} />也可以把 `.yaml` / `.yml` 文件拖到窗口；Horion 只填入路径，不会自动导入。</div>
                {formError ? <p className="notice-error" role="alert">{formError}</p> : null}
                <div className="flex justify-end gap-2"><Button onClick={() => { setPanel(null); }}>取消</Button><Button disabled={busy} type="submit" variant="primary">{pendingAction === "import" ? <LoaderCircle aria-hidden="true" className="animate-spin" size={14} /> : <FileUp aria-hidden="true" size={14} />}验证并导入</Button></div>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submitSubscription(); }}>
                <div><h2 className="text-sm font-semibold text-text">添加远程订阅</h2><p className="mt-1 text-xs text-text-muted">只接受 HTTPS 地址；更新由 Rust 后端执行并保留可回滚版本。</p></div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="field-label">名称<input autoComplete="off" className="control mt-1.5 h-10 w-full" onChange={(event) => { setSubscriptionName(event.target.value); }} placeholder="例如：主要订阅" value={subscriptionName} /></label>
                  <label className="field-label">User-Agent（可选）<input autoComplete="off" className="control mt-1.5 h-10 w-full" onChange={(event) => { setUserAgent(event.target.value); }} placeholder="留空使用默认值" value={userAgent} /></label>
                </div>
                <label className="field-label">HTTPS 订阅地址<input autoComplete="off" className="control mt-1.5 h-10 w-full font-mono text-xs" onChange={(event) => { setSubscriptionUrl(event.target.value); }} placeholder="https://example.com/subscription" spellCheck={false} type="url" value={subscriptionUrl} /></label>
                {formError ? <p className="notice-error" role="alert">{formError}</p> : null}
                <div className="flex justify-end gap-2"><Button onClick={() => { setPanel(null); }}>取消</Button><Button disabled={busy} type="submit" variant="primary">{pendingAction === "subscribe" ? <LoaderCircle aria-hidden="true" className="animate-spin" size={14} /> : <Plus aria-hidden="true" size={14} />}安全添加</Button></div>
              </form>
            )}
            <aside className="rounded-xl border border-warning/25 bg-warning-soft p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-warning"><ShieldAlert aria-hidden="true" size={15} />敏感信息提示</div>
              <p className="mt-2 text-xs leading-5 text-text-muted">订阅 URL 可能包含访问令牌。Horion 不会把 URL、配置内容或认证信息写入 localStorage，也不会在界面日志中显示完整订阅地址。</p>
            </aside>
          </div>
        </Card>
      ) : null}

      {error && profiles.length ? <p className="notice-error" role="alert">{error}</p> : null}
      {listContent}

      {nameDialog ? (
        <Modal footer={<><Button onClick={() => { setNameDialog(null); }}>取消</Button><Button disabled={!dialogName.trim() || busy} onClick={() => { const operation = nameDialog.kind === "rename" ? rename(nameDialog.profile.id, dialogName.trim()) : duplicate(nameDialog.profile.id, dialogName.trim()); void operation.then((success) => { if (success) setNameDialog(null); }); }} variant="primary">确认</Button></>} onClose={() => { setNameDialog(null); }} title={nameDialog.kind === "rename" ? "重命名配置" : "复制配置"}>
          <label className="field-label">新名称<input autoFocus className="control mt-1.5 h-10 w-full" onChange={(event) => { setDialogName(event.target.value); }} value={dialogName} /></label>
          {error ? <p className="notice-error mt-3" role="alert">{error}</p> : null}
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal footer={<><Button onClick={() => { setDeleteTarget(null); }}>取消</Button><Button className="border-negative/30 text-negative hover:bg-negative-soft" disabled={busy || deleteTarget.active} onClick={() => void deleteProfile(deleteTarget.id).then((success) => { if (success) setDeleteTarget(null); })}><Trash2 aria-hidden="true" size={14} />删除</Button></>} onClose={() => { setDeleteTarget(null); }} title="删除配置">
          <p className="text-sm leading-6 text-text-muted">确定删除“<span className="font-semibold text-text">{deleteTarget.name}</span>”吗？此操作会删除 Horion 管理的数据副本，无法撤销。</p>
          {error ? <p className="notice-error mt-3" role="alert">{error}</p> : null}
        </Modal>
      ) : null}

      {(editor || editorLoading) ? (
        <Modal
          description="保存时会携带当前 revision；若文件已被其他操作修改，Horion 会拒绝覆盖。"
          footer={<><span className="mr-auto text-[11px] text-text-subtle">{editor ? `Revision ${String(editor.revision)}` : "读取中"}</span><Button onClick={closeEditor}>关闭</Button><Button disabled={!editor || pendingAction === "save_content" || revisionConflict} onClick={() => void saveEditor()} variant="primary">{pendingAction === "save_content" ? <LoaderCircle aria-hidden="true" className="animate-spin" size={14} /> : <Save aria-hidden="true" size={14} />}保存</Button></>}
          onClose={closeEditor}
          title={`编辑配置${editorName ? ` · ${editorName}` : ""}`}
          wide
        >
          {editorLoading && !editor ? <div className="grid min-h-80 place-items-center text-text-muted"><LoaderCircle aria-hidden="true" className="animate-spin" size={24} /></div> : editor ? <textarea aria-label="配置内容" className="min-h-[420px] w-full resize-none rounded-xl border border-line bg-code p-4 font-mono text-xs leading-5 text-text outline-none focus:border-accent/60 focus:ring-2 focus:ring-focus" onChange={(event) => { updateEditorContent(event.target.value); }} spellCheck={false} value={editor.content} /> : null}
          {editorError ? <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-negative/25 bg-negative-soft px-3 py-2.5 text-xs text-negative" role="alert"><span>{revisionConflict ? "检测到 revision 冲突：服务器版本已变化，未覆盖你的内容。" : editorError}</span>{revisionConflict ? <Button className="h-7 shrink-0 border-negative/25 px-2 text-[11px]" onClick={() => void reloadEditor()}><RefreshCw aria-hidden="true" size={12} />载入最新版本</Button> : null}</div> : null}
        </Modal>
      ) : null}
    </div>
  );
}
