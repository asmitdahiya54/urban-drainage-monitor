import type { IssueType, MapReport, MapSummary, ReportStatus, Severity } from "@/services/api";

export type CityRiskLevel = "HIGH" | "MEDIUM" | "LOW";

export type CityZone = {
  id: string;
  name: string;
  risk: CityRiskLevel;
  issue: string;
  reportCount: number;
  unresolvedCount: number;
  lastReported: string | null;
  position: [number, number, number];
  source: "live" | "demonstration";
  reportIds: number[];
};

export type CityData = {
  zones: CityZone[];
  summary: MapSummary | null;
  reports: MapReport[];
  source: "live" | "demonstration";
};

export type CityLayers = {
  buildings: boolean;
  drainage: boolean;
  risk: boolean;
};

export type CityPalette = {
  background: string;
  ground: string;
  cyan: string;
  cyanBright: string;
  building: string;
  high: string;
  medium: string;
  low: string;
};

export type CityReportLike = {
  id: number;
  issue_type: IssueType;
  severity: Severity;
  status: ReportStatus;
  latitude: number;
  longitude: number;
  created_at: string | null;
};
