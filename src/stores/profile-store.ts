import { create } from "zustand";

import { getErrorMessage } from "../services/core-client";
import { profileClient, type ProfileClient } from "../services/profile-client";
import type { CoreSnapshot } from "../types/core";
import type { ProfileContent, ProfileSummary } from "../types/profile";
import { useCoreStore } from "./core-store";

type ProfileAction =
  | "import"
  | "subscribe"
  | "update_all"
  | "update"
  | "activate"
  | "rename"
  | "duplicate"
  | "delete"
  | "load_content"
  | "save_content";

export interface ProfileStore {
  profiles: ProfileSummary[];
  runtimeAvailable: boolean;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  pendingAction: ProfileAction | null;
  pendingId: string | null;
  editor: ProfileContent | null;
  editorName: string | null;
  editorLoading: boolean;
  editorError: string | null;
  revisionConflict: boolean;
  load: () => Promise<void>;
  importLocal: (name: string, path: string) => Promise<boolean>;
  addSubscription: (
    name: string,
    url: string,
    userAgent: string | null,
  ) => Promise<boolean>;
  update: (id: string) => Promise<void>;
  updateAll: () => Promise<void>;
  rename: (id: string, name: string) => Promise<boolean>;
  duplicate: (id: string, name: string) => Promise<boolean>;
  deleteProfile: (id: string) => Promise<boolean>;
  activate: (id: string) => Promise<void>;
  openEditor: (id: string, name: string) => Promise<void>;
  closeEditor: () => void;
  updateEditorContent: (content: string) => void;
  saveEditor: () => Promise<void>;
  reloadEditor: () => Promise<void>;
  clearError: () => void;
}

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String(error.code);
  }
  return "";
}

function upsert(profiles: ProfileSummary[], profile: ProfileSummary): ProfileSummary[] {
  const existing = profiles.findIndex((item) => item.id === profile.id);
  if (existing < 0) return [profile, ...profiles];
  return profiles.map((item) => (item.id === profile.id ? profile : item));
}

export function createProfileStore(
  client: ProfileClient,
  onCoreActivated: (snapshot: CoreSnapshot) => void = (snapshot) => {
    useCoreStore.setState({ snapshot, initialized: true, statusError: null });
  },
) {
  let listRequest: Promise<void> | null = null;

  return create<ProfileStore>((set, get) => {
    const setPending = (action: ProfileAction | null, id: string | null = null) =>
      { set({ pendingAction: action, pendingId: id }); };

    const load = (): Promise<void> => {
      if (listRequest) return listRequest;
      if (!client.isAvailable()) {
        set({ runtimeAvailable: false, initialized: true, loading: false, error: null });
        return Promise.resolve();
      }
      set({ runtimeAvailable: true, loading: true });
      listRequest = client
        .list()
        .then((profiles) => { set({ profiles, initialized: true, error: null }); })
        .catch((error: unknown) =>
          { set({ initialized: true, error: getErrorMessage(error) }); },
        )
        .finally(() => {
          listRequest = null;
          set({ loading: false });
        });
      return listRequest;
    };

    const mutateOne = async (
      action: ProfileAction,
      id: string | null,
      operation: () => Promise<ProfileSummary>,
    ): Promise<ProfileSummary | null> => {
      if (!client.isAvailable() || get().pendingAction) return null;
      setPending(action, id);
      set({ error: null });
      try {
        const profile = await operation();
        set((state) => ({ profiles: upsert(state.profiles, profile) }));
        return profile;
      } catch (error: unknown) {
        set({ error: getErrorMessage(error) });
        return null;
      } finally {
        setPending(null);
      }
    };

    const openEditor = async (id: string, name: string): Promise<void> => {
      if (!client.isAvailable()) return;
      set({
        editorLoading: true,
        editorError: null,
        revisionConflict: false,
        editorName: name,
      });
      try {
        const editor = await client.getContent(id);
        set({ editor });
      } catch (error: unknown) {
        set({ editorError: getErrorMessage(error) });
      } finally {
        set({ editorLoading: false });
      }
    };

    return {
      profiles: [],
      runtimeAvailable: false,
      initialized: false,
      loading: false,
      error: null,
      pendingAction: null,
      pendingId: null,
      editor: null,
      editorName: null,
      editorLoading: false,
      editorError: null,
      revisionConflict: false,
      load,
      importLocal: async (name, path) =>
        Boolean(await mutateOne("import", null, () => client.importLocal(name, path))),
      addSubscription: async (name, url, userAgent) =>
        Boolean(
          await mutateOne("subscribe", null, () =>
            client.addSubscription(name, url, userAgent),
          ),
        ),
      update: async (id) => {
        await mutateOne("update", id, () => client.update(id));
      },
      updateAll: async () => {
        if (!client.isAvailable() || get().pendingAction) return;
        setPending("update_all");
        set({ error: null });
        try {
          const profiles = await client.updateAll();
          set({ profiles });
        } catch (error: unknown) {
          set({ error: getErrorMessage(error) });
        } finally {
          setPending(null);
        }
      },
      rename: async (id, name) => {
        return Boolean(await mutateOne("rename", id, () => client.rename(id, name)));
      },
      duplicate: async (id, name) => {
        return Boolean(await mutateOne("duplicate", id, () => client.duplicate(id, name)));
      },
      deleteProfile: async (id) => {
        if (!client.isAvailable() || get().pendingAction) return false;
        if (get().profiles.some((profile) => profile.id === id && profile.active)) {
          set({ error: "当前激活配置不能删除，请先激活其他配置。" });
          return false;
        }
        setPending("delete", id);
        set({ error: null });
        try {
          await client.delete(id);
          set((state) => ({ profiles: state.profiles.filter((item) => item.id !== id) }));
          return true;
        } catch (error: unknown) {
          set({ error: getErrorMessage(error) });
          return false;
        } finally {
          setPending(null);
        }
      },
      activate: async (id) => {
        if (!client.isAvailable() || get().pendingAction) return;
        setPending("activate", id);
        set({ error: null });
        try {
          const result = await client.activate(id);
          set((state) => ({
            profiles: state.profiles.map((item) =>
              item.id === result.profile.id
                ? { ...result.profile, active: true }
                : { ...item, active: false },
            ),
          }));
          onCoreActivated(result.core);
        } catch (error: unknown) {
          set({ error: getErrorMessage(error) });
        } finally {
          setPending(null);
        }
      },
      openEditor,
      closeEditor: () =>
        { set({
          editor: null,
          editorName: null,
          editorError: null,
          revisionConflict: false,
        }); },
      updateEditorContent: (content) =>
        { set((state) => ({
          editor: state.editor ? { ...state.editor, content } : null,
          editorError: null,
        })); },
      saveEditor: async () => {
        const editor = get().editor;
        if (!editor || get().pendingAction || !client.isAvailable()) return;
        setPending("save_content", editor.id);
        set({ editorError: null, revisionConflict: false });
        try {
          const summary = await client.saveContent(
            editor.id,
            editor.content,
            editor.revision,
          );
          set((state) => ({
            profiles: upsert(state.profiles, summary),
            editor: state.editor
              ? { ...state.editor, revision: summary.revision }
              : null,
          }));
        } catch (error: unknown) {
          const code = errorCode(error).toLocaleLowerCase();
          const message = getErrorMessage(error);
          set({
            editorError: message,
            revisionConflict:
              code.includes("revision") || message.toLocaleLowerCase().includes("revision"),
          });
        } finally {
          setPending(null);
        }
      },
      reloadEditor: async () => {
        const editor = get().editor;
        const name = get().editorName;
        if (editor && name) await openEditor(editor.id, name);
      },
      clearError: () => { set({ error: null }); },
    };
  });
}

export const useProfileStore = createProfileStore(profileClient);
