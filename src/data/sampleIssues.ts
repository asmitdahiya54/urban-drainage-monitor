/**
 * SAMPLE drainage issues for the Issues Map demo.
 * Fictional records at illustrative points around New Delhi — not real citizen
 * reports and not officially verified. Every record carries `source: "sample"`.
 */
export type MapIssueSource = "sample" | "local-demo" | "live";
export type MapIssueSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type MapIssueStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export type MapIssue = {
  id: string;
  title: string;
  category: string;
  severity: MapIssueSeverity;
  status: MapIssueStatus;
  location: string;
  description: string;
  reported_at: string;
  latitude: number;
  longitude: number;
  source: MapIssueSource;
};

export const MAP_CATEGORIES = [
  "Blocked Drain",
  "Waterlogging",
  "Overflowing Manhole",
  "Drain Damage",
  "Garbage Blocking Drain",
  "Other",
];

export const MAP_STATUS_LABELS: Record<MapIssueStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

const daysAgo = (d: number, h = 0) =>
  new Date(Date.UTC(2026, 8, 30, 10 - h) - d * 86400000).toISOString();

export const SAMPLE_ISSUES: MapIssue[] = [
  {
    id: "SAMPLE-001",
    title: "Drain choked near market gate",
    category: "Blocked Drain",
    severity: "HIGH",
    status: "OPEN",
    location: "Sample Sector 12 · Market Road",
    description:
      "Sample record: storm drain inlet covered with silt; water backs up after short showers.",
    reported_at: daysAgo(1, 2),
    latitude: 28.6321,
    longitude: 77.2195,
    source: "sample",
  },
  {
    id: "SAMPLE-002",
    title: "Underpass waterlogged",
    category: "Waterlogging",
    severity: "CRITICAL",
    status: "IN_PROGRESS",
    location: "Sample Sector 5 · Ring Road underpass",
    description: "Sample record: knee-deep water in the underpass, traffic diverted.",
    reported_at: daysAgo(0, 5),
    latitude: 28.5921,
    longitude: 77.229,
    source: "sample",
  },
  {
    id: "SAMPLE-003",
    title: "Manhole overflowing onto street",
    category: "Overflowing Manhole",
    severity: "CRITICAL",
    status: "OPEN",
    location: "Sample Sector 8 · School Lane",
    description: "Sample record: sewage overflow from manhole outside a school entrance.",
    reported_at: daysAgo(2),
    latitude: 28.6512,
    longitude: 77.1905,
    source: "sample",
  },
  {
    id: "SAMPLE-004",
    title: "Broken drain cover",
    category: "Drain Damage",
    severity: "MEDIUM",
    status: "OPEN",
    location: "Sample Sector 14 · Park Avenue",
    description: "Sample record: cracked concrete cover, partly open and unsafe for pedestrians.",
    reported_at: daysAgo(3),
    latitude: 28.6105,
    longitude: 77.2468,
    source: "sample",
  },
  {
    id: "SAMPLE-005",
    title: "Plastic waste blocking culvert",
    category: "Garbage Blocking Drain",
    severity: "HIGH",
    status: "IN_PROGRESS",
    location: "Sample Sector 9 · Canal Bridge",
    description: "Sample record: garbage piled at culvert mouth, slowing flow.",
    reported_at: daysAgo(4),
    latitude: 28.6668,
    longitude: 77.2302,
    source: "sample",
  },
  {
    id: "SAMPLE-006",
    title: "Standing water at bus stop",
    category: "Waterlogging",
    severity: "MEDIUM",
    status: "RESOLVED",
    location: "Sample Sector 21 · Bus Terminal",
    description: "Sample record: shallow pooling after rain; cleared by maintenance crew.",
    reported_at: daysAgo(6),
    latitude: 28.5735,
    longitude: 77.198,
    source: "sample",
  },
  {
    id: "SAMPLE-007",
    title: "Slow-draining roadside channel",
    category: "Blocked Drain",
    severity: "LOW",
    status: "OPEN",
    location: "Sample Sector 17 · Residential Block C",
    description: "Sample record: channel drains slowly; minor leaves and debris visible.",
    reported_at: daysAgo(5),
    latitude: 28.624,
    longitude: 77.1712,
    source: "sample",
  },
  {
    id: "SAMPLE-008",
    title: "Collapsed drain wall",
    category: "Drain Damage",
    severity: "HIGH",
    status: "OPEN",
    location: "Sample Sector 12 · Old Town",
    description: "Sample record: side wall of open drain has partly collapsed.",
    reported_at: daysAgo(1, 7),
    latitude: 28.6398,
    longitude: 77.2101,
    source: "sample",
  },
  {
    id: "SAMPLE-009",
    title: "Leaf litter on grate",
    category: "Garbage Blocking Drain",
    severity: "LOW",
    status: "RESOLVED",
    location: "Sample Sector 3 · Civic Park",
    description: "Sample record: grate covered by leaves; cleaned during routine sweep.",
    reported_at: daysAgo(9),
    latitude: 28.6012,
    longitude: 77.2085,
    source: "sample",
  },
  {
    id: "SAMPLE-010",
    title: "Manhole lid lifting during rain",
    category: "Overflowing Manhole",
    severity: "MEDIUM",
    status: "IN_PROGRESS",
    location: "Sample Sector 5 · Hospital Road",
    description: "Sample record: lid pushed up by pressure during heavy rainfall.",
    reported_at: daysAgo(2, 3),
    latitude: 28.585,
    longitude: 77.2405,
    source: "sample",
  },
  {
    id: "SAMPLE-011",
    title: "Courtyard flooding",
    category: "Waterlogging",
    severity: "LOW",
    status: "OPEN",
    location: "Sample Sector 18 · Housing Society",
    description: "Sample record: rainwater collects in courtyard for several hours.",
    reported_at: daysAgo(7),
    latitude: 28.656,
    longitude: 77.162,
    source: "sample",
  },
  {
    id: "SAMPLE-012",
    title: "Silted storm drain",
    category: "Blocked Drain",
    severity: "MEDIUM",
    status: "OPEN",
    location: "Sample Sector 14 · Stadium Road",
    description: "Sample record: heavy silt reduces drain capacity by about half.",
    reported_at: daysAgo(3, 4),
    latitude: 28.618,
    longitude: 77.2555,
    source: "sample",
  },
];
