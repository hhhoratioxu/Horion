import { invoke, isTauri } from "@tauri-apps/api/core";

import type {
  ProfileActivation,
  ProfileContent,
  ProfileSummary,
} from "../types/profile";

export interface ProfileClient {
  isAvailable: () => boolean;
  list: () => Promise<ProfileSummary[]>;
  importLocal: (name: string, path: string) => Promise<ProfileSummary>;
  addSubscription: (
    name: string,
    url: string,
    userAgent: string | null,
  ) => Promise<ProfileSummary>;
  update: (id: string) => Promise<ProfileSummary>;
  updateAll: () => Promise<ProfileSummary[]>;
  rename: (id: string, name: string) => Promise<ProfileSummary>;
  duplicate: (id: string, name: string) => Promise<ProfileSummary>;
  delete: (id: string) => Promise<void>;
  getContent: (id: string) => Promise<ProfileContent>;
  saveContent: (
    id: string,
    content: string,
    expectedRevision: number,
  ) => Promise<ProfileSummary>;
  activate: (id: string) => Promise<ProfileActivation>;
}

export const profileClient: ProfileClient = {
  isAvailable: isTauri,
  list: () => invoke<ProfileSummary[]>("profile_list"),
  importLocal: (name, path) =>
    invoke<ProfileSummary>("profile_import_local", { name, path }),
  addSubscription: (name, url, userAgent) =>
    invoke<ProfileSummary>("profile_add_subscription", {
      name,
      url,
      userAgent,
    }),
  update: (id) => invoke<ProfileSummary>("profile_update", { id }),
  updateAll: () => invoke<ProfileSummary[]>("profile_update_all"),
  rename: (id, name) => invoke<ProfileSummary>("profile_rename", { id, name }),
  duplicate: (id, name) =>
    invoke<ProfileSummary>("profile_duplicate", { id, name }),
  delete: async (id) => {
    await invoke("profile_delete", { id });
  },
  getContent: (id) => invoke<ProfileContent>("profile_get_content", { id }),
  saveContent: (id, content, expectedRevision) =>
    invoke<ProfileSummary>("profile_save_content", {
      id,
      content,
      expectedRevision,
    }),
  activate: (id) => invoke<ProfileActivation>("profile_activate", { id }),
};
