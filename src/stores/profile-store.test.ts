import { describe, expect, it, vi } from "vitest";

import type { ProfileClient } from "../services/profile-client";
import type { ProfileSummary } from "../types/profile";
import { emptyCoreSnapshot } from "./core-store";
import { createProfileStore } from "./profile-store";

const profile: ProfileSummary = {
  id: "p1",
  name: "本地配置",
  kind: "local",
  active: false,
  updated_at: "2026-07-22T00:00:00Z",
  last_checked_at: null,
  source_label: "profile.yaml",
  status: "ready",
  last_error: null,
  bytes: 120,
  revision: 3,
  subscription: null,
};

function client(overrides: Partial<ProfileClient> = {}): ProfileClient {
  return {
    isAvailable: () => true,
    list: vi.fn(() => Promise.resolve([profile])),
    importLocal: vi.fn(() => Promise.resolve(profile)),
    addSubscription: vi.fn(() => Promise.resolve(profile)),
    update: vi.fn(() => Promise.resolve(profile)),
    updateAll: vi.fn(() => Promise.resolve([profile])),
    rename: vi.fn(() => Promise.resolve(profile)),
    duplicate: vi.fn(() => Promise.resolve(profile)),
    delete: vi.fn(() => Promise.resolve()),
    getContent: vi.fn(() => Promise.resolve({ id: "p1", content: "mode: rule", revision: 3 })),
    saveContent: vi.fn(() => Promise.resolve({ ...profile, revision: 4 })),
    activate: vi.fn(() => Promise.resolve({ profile: { ...profile, active: true }, core: emptyCoreSnapshot })),
    ...overrides,
  };
}

describe("profile store", () => {
  it("loads the configuration list", async () => {
    const store = createProfileStore(client(), vi.fn());
    await store.getState().load();
    expect(store.getState().profiles).toEqual([profile]);
    expect(store.getState().initialized).toBe(true);
  });

  it("saves editor content with the loaded revision", async () => {
    const api = client();
    const store = createProfileStore(api, vi.fn());
    await store.getState().openEditor("p1", "本地配置");
    store.getState().updateEditorContent("mode: global");
    await store.getState().saveEditor();

    expect(api.saveContent).toHaveBeenCalledWith("p1", "mode: global", 3);
    expect(store.getState().editor?.revision).toBe(4);
  });

  it("preserves edits and surfaces revision conflicts", async () => {
    const api = client({
      saveContent: () =>
        Promise.reject(
          Object.assign(new Error("revision mismatch"), {
            code: "profile_revision_conflict",
          }),
        ),
    });
    const store = createProfileStore(api, vi.fn());
    await store.getState().openEditor("p1", "本地配置");
    store.getState().updateEditorContent("custom: value");
    await store.getState().saveEditor();

    expect(store.getState().revisionConflict).toBe(true);
    expect(store.getState().editor?.content).toBe("custom: value");
    expect(store.getState().editor?.revision).toBe(3);
  });

  it("keeps dialogs actionable by reporting failed mutations", async () => {
    const api = client({
      rename: vi.fn(() => Promise.reject(new Error("name already exists"))),
    });
    const store = createProfileStore(api, vi.fn());

    const success = await store.getState().rename("p1", "重复名称");

    expect(success).toBe(false);
    expect(store.getState().error).toBe("name already exists");
  });

  it("refuses to delete the active profile before calling the backend", async () => {
    const api = client();
    const store = createProfileStore(api, vi.fn());
    store.setState({ profiles: [{ ...profile, active: true }] });

    const success = await store.getState().deleteProfile("p1");

    expect(success).toBe(false);
    expect(api.delete).not.toHaveBeenCalled();
    expect(store.getState().error).toContain("当前激活配置不能删除");
  });

  it("does not call profile commands in a browser", async () => {
    const list = vi.fn(() => Promise.resolve([profile]));
    const store = createProfileStore(client({ isAvailable: () => false, list }), vi.fn());
    await store.getState().load();
    expect(list).not.toHaveBeenCalled();
    expect(store.getState().runtimeAvailable).toBe(false);
  });
});
