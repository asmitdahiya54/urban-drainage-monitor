import { ISSUE_TYPE_LABELS, publicMapApi, type MapReport, type MapSummary } from "@/services/api";
import type { CityData, CityRiskLevel, CityZone } from "./types";

const ACTIVE_STATUSES = new Set([
  "NEW",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
]);

export const DEMONSTRATION_ZONES: CityZone[] = [
  {
    id: "demo-sector-12",
    name: "Sector 12",
    risk: "HIGH",
    issue: "Blocked drain",
    reportCount: 12,
    unresolvedCount: 3,
    lastReported: null,
    position: [-6.5, 0, -2],
    source: "demonstration",
    reportIds: [],
  },
  {
    id: "demo-sector-8",
    name: "Sector 8",
    risk: "MEDIUM",
    issue: "Waterlogging",
    reportCount: 6,
    unresolvedCount: 4,
    lastReported: null,
    position: [5.5, 0, -4.5],
    source: "demonstration",
    reportIds: [],
  },
  {
    id: "demo-sector-21",
    name: "Sector 21",
    risk: "LOW",
    issue: "Drainage normal",
    reportCount: 2,
    unresolvedCount: 0,
    lastReported: null,
    position: [3.5, 0, 5.5],
    source: "demonstration",
    reportIds: [],
  },
];

function riskFor(reports: MapReport[]): CityRiskLevel {
  const severe = reports.filter((report) => ["HIGH", "CRITICAL"].includes(report.severity)).length;
  if (severe >= 2 || reports.length >= 8) return "HIGH";
  if (severe >= 1 || reports.length >= 4) return "MEDIUM";
  return "LOW";
}

function projectReports(reports: MapReport[]): CityZone[] {
  if (reports.length === 0) return [];
  const latitudes = reports.map((report) => report.latitude);
  const longitudes = reports.map((report) => report.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latSpan = Math.max(maxLat - minLat, 0.001);
  const lngSpan = Math.max(maxLng - minLng, 0.001);

  const buckets = new Map<string, MapReport[]>();
  reports.forEach((report) => {
    const xCell = Math.min(2, Math.floor(((report.longitude - minLng) / lngSpan) * 3));
    const zCell = Math.min(2, Math.floor(((report.latitude - minLat) / latSpan) * 3));
    const key = `${xCell}-${zCell}`;
    buckets.set(key, [...(buckets.get(key) ?? []), report]);
  });

  return [...buckets.entries()]
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 5)
    .map(([key, group], index) => {
      const [xCell = 1, zCell = 1] = key.split("-").map(Number);
      const commonIssue = [...group].sort(
        (a, b) =>
          group.filter((item) => item.issue_type === b.issue_type).length -
          group.filter((item) => item.issue_type === a.issue_type).length,
      )[0]?.issue_type;
      const latest = [...group]
        .map((report) => report.created_at)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1);

      return {
        id: `live-zone-${key}`,
        name: `City Zone ${index + 1}`,
        risk: riskFor(group),
        issue: commonIssue ? (ISSUE_TYPE_LABELS[commonIssue] ?? commonIssue) : "Drainage reports",
        reportCount: group.length,
        unresolvedCount: group.filter((report) => ACTIVE_STATUSES.has(report.status)).length,
        lastReported: latest ?? null,
        position: [(xCell - 1) * 6.5, 0, (zCell - 1) * 6.5] as [number, number, number],
        source: "live" as const,
        reportIds: group.map((report) => report.id),
      };
    });
}

export function adaptMapData(reports: MapReport[], summary: MapSummary): CityData {
  const zones = projectReports(reports);
  if (zones.length === 0) {
    return { zones: DEMONSTRATION_ZONES, summary, reports, source: "demonstration" };
  }
  return { zones, summary, reports, source: "live" };
}

export async function loadCityData(): Promise<CityData> {
  try {
    const result = await publicMapApi.reports();
    return adaptMapData(result.reports, result.summary);
  } catch {
    return {
      zones: DEMONSTRATION_ZONES,
      summary: null,
      reports: [],
      source: "demonstration",
    };
  }
}
