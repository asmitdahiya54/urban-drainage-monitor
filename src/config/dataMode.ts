/**
 * Data-source switch for the future backend integration (Phase 8+).
 *
 * "demo" (default): screens use sample data + browser storage.
 * "api": screens should call the Flask API through src/services/api.ts.
 *
 * NOT yet read by any screen — screens still decide per-session (demo token or
 * backend unreachable). See BACKEND_INTEGRATION_PLAN.md. Browser-safe value only.
 */
export type DataMode = "demo" | "api";

export const DATA_MODE: DataMode = import.meta.env["VITE_DATA_MODE"] === "api" ? "api" : "demo";

export const isApiMode = DATA_MODE === "api";
