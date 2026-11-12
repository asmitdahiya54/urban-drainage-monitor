/**
 * Centralised DEMO / SIMULATED data for the homepage dashboard.
 * Every value here is fictional and must be labelled as demo data in the UI.
 * Replace with real API responses when Weather / Reports / ML services are connected:
 *   const data = realData ?? demoData;
 */
import type { CityRiskLevel, CityZone } from "@/components/city/types";

export type RiskLevel = CityRiskLevel;

// ---------- Risk zones (shared by 3D city, risk card, overview) ----------
type DemoZoneSeed = {
  name: string;
  risk: RiskLevel;
  issue: string;
  reportCount: number;
  unresolvedCount: number;
  position: [number, number, number];
};

const ZONE_SEEDS: DemoZoneSeed[] = [
  {
    name: "Sector 12",
    risk: "HIGH",
    issue: "Blocked drain",
    reportCount: 41,
    unresolvedCount: 14,
    position: [-7, 0, -3],
  },
  {
    name: "Sector 5",
    risk: "HIGH",
    issue: "Overflowing drain",
    reportCount: 36,
    unresolvedCount: 12,
    position: [8, 0, 6],
  },
  {
    name: "Sector 8",
    risk: "MEDIUM",
    issue: "Waterlogging",
    reportCount: 33,
    unresolvedCount: 13,
    position: [6, 0, -6],
  },
  {
    name: "Sector 14",
    risk: "MEDIUM",
    issue: "Waste blocking drain",
    reportCount: 30,
    unresolvedCount: 12,
    position: [-9, 0, 7],
  },
  {
    name: "Sector 9",
    risk: "MEDIUM",
    issue: "Water level rising",
    reportCount: 28,
    unresolvedCount: 11,
    position: [0, 0, 9],
  },
  {
    name: "Sector 21",
    risk: "LOW",
    issue: "Drainage normal",
    reportCount: 42,
    unresolvedCount: 12,
    position: [3, 0, 1],
  },
  {
    name: "Sector 17",
    risk: "LOW",
    issue: "Minor silt build-up",
    reportCount: 38,
    unresolvedCount: 11,
    position: [-2, 0, -9],
  },
];

export const demoRiskZones: CityZone[] = ZONE_SEEDS.map((z) => ({
  ...z,
  id: `demo-${z.name.toLowerCase().replace(/\s+/g, "-")}`,
  lastReported: null,
  source: "demonstration",
  reportIds: [],
}));

const countRisk = (level: RiskLevel) => demoRiskZones.filter((z) => z.risk === level).length;

// ---------- City overview ----------
const TOTAL = demoRiskZones.reduce((sum, z) => sum + z.reportCount, 0); // 248
const OPEN = demoRiskZones.reduce((sum, z) => sum + z.unresolvedCount, 0); // 85
const IN_PROGRESS = 67;
const CRITICAL = 18;

export const demoCityOverview = {
  total: TOTAL,
  critical: CRITICAL,
  inProgress: IN_PROGRESS,
  resolved: TOTAL - OPEN,
  open: OPEN,
  resolutionRate: Math.round(((TOTAL - OPEN) / TOTAL) * 100),
  highRiskZones: demoRiskZones.length,
  isDemo: true,
};

// ---------- Weather ----------
export type WeatherData = {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  rainProbability: number;
  visibility: number;
  timestamp: string;
  isDemo: boolean;
};

export const demoWeather: WeatherData = {
  location: "New Delhi / NCR",
  temperature: 28,
  condition: "Partly Cloudy",
  humidity: 72,
  rainfall: 12,
  windSpeed: 14,
  rainProbability: 68,
  visibility: 6.5,
  timestamp: new Date().toISOString(),
  isDemo: true,
};

export function rainfallLevel(mm: number): "low" | "moderate" | "heavy" {
  if (mm >= 25) return "heavy";
  if (mm >= 7.5) return "moderate";
  return "low";
}

// ---------- Risk prediction ----------
export type RiskFactor = { label: string; value: number };
export type RiskPredictionData = {
  riskScore: number;
  riskLevel: RiskLevel;
  highRiskZones: number;
  mediumRiskZones: number;
  lowRiskZones: number;
  factors: RiskFactor[];
  predictionTime: string;
  isDemo: boolean;
};

export const demoRiskPrediction: RiskPredictionData = {
  riskScore: 67,
  riskLevel: "MEDIUM",
  highRiskZones: countRisk("HIGH"),
  mediumRiskZones: countRisk("MEDIUM"),
  lowRiskZones: countRisk("LOW"),
  factors: [
    { label: "Rainfall intensity", value: 72 },
    { label: "Blocked drains", value: 61 },
    { label: "Historical incidents", value: 54 },
    { label: "Waterlogging reports", value: 68 },
    { label: "Drainage capacity", value: 43 },
  ],
  predictionTime: new Date().toISOString(),
  isDemo: true,
};

// ---------- Live feed ----------
export type FeedItem = {
  id: string;
  issue: string;
  location: string;
  risk: RiskLevel;
  minutesAgo: number;
  status: string;
  isDemo: boolean;
};

export const demoLiveFeed: FeedItem[] = [
  {
    id: "d1",
    issue: "Blocked Drain",
    location: "Sector 12",
    risk: "HIGH",
    minutesAgo: 8,
    status: "Under Investigation",
    isDemo: true,
  },
  {
    id: "d2",
    issue: "Waterlogging",
    location: "Sector 8",
    risk: "MEDIUM",
    minutesAgo: 17,
    status: "Crew Assigned",
    isDemo: true,
  },
  {
    id: "d3",
    issue: "Overflowing Drain",
    location: "Sector 5",
    risk: "HIGH",
    minutesAgo: 32,
    status: "Under Investigation",
    isDemo: true,
  },
  {
    id: "d4",
    issue: "Drainage Normal",
    location: "Sector 21",
    risk: "LOW",
    minutesAgo: 45,
    status: "Resolved",
    isDemo: true,
  },
  {
    id: "d5",
    issue: "Waste Blocking Drain",
    location: "Sector 14",
    risk: "MEDIUM",
    minutesAgo: 60,
    status: "Verified",
    isDemo: true,
  },
  {
    id: "d6",
    issue: "Water Level Rising",
    location: "Sector 9",
    risk: "MEDIUM",
    minutesAgo: 75,
    status: "Monitoring",
    isDemo: true,
  },
];

// ---------- Drainage network ----------
const MONITORED = 142;
const HEALTHY = 96;
const WARNING = 31;
const CRIT = MONITORED - HEALTHY - WARNING; // 15

export const demoDrainageNetwork = {
  coverage: 87,
  monitored: MONITORED,
  healthy: HEALTHY,
  warning: WARNING,
  critical: CRIT,
  healthyPct: Math.round((HEALTHY / MONITORED) * 100),
  warningPct: Math.round((WARNING / MONITORED) * 100),
  criticalPct:
    100 - Math.round((HEALTHY / MONITORED) * 100) - Math.round((WARNING / MONITORED) * 100),
  isDemo: true,
};

// ---------- Service status ----------
export const demoCityStatus = [
  { label: "Drainage Network", value: "Operational", tone: "low" },
  { label: "Risk Monitoring", value: "Active", tone: "low" },
  { label: "Citizen Reports", value: "Active", tone: "low" },
  { label: "AI Prediction", value: "Prototype", tone: "medium" },
  { label: "Weather", value: "Demo Data", tone: "medium" },
] as const;
