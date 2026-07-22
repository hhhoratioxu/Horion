export type DataSourceState =
  | "not_connected"
  | "connecting"
  | "connected"
  | "error";

export type PageStateKind =
  | "loading"
  | "empty"
  | "offline"
  | "error"
  | "development";

export type StatusTone = "neutral" | "positive" | "warning" | "negative";
