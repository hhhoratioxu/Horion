import type { CoreSnapshot } from "./core";

export type ProfileKind = "local" | "subscription";
export type ProfileStatus = "ready" | "updating" | "error";

export interface SubscriptionUsage {
  upload: number | null;
  download: number | null;
  total: number | null;
  expire: number | null;
}

export interface ProfileSummary {
  id: string;
  name: string;
  kind: ProfileKind;
  active: boolean;
  updated_at: string;
  last_checked_at: string | null;
  source_label: string;
  status: ProfileStatus;
  last_error: string | null;
  bytes: number;
  revision: number;
  subscription: SubscriptionUsage | null;
}

export interface ProfileContent {
  id: string;
  content: string;
  revision: number;
}

export interface ProfileActivation {
  profile: ProfileSummary;
  core: CoreSnapshot;
}
