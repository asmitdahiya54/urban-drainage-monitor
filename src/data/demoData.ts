/**
 * Centralised DEMO / SIMULATED data for the homepage dashboard.
 * Every value here is fictional and must be labelled as demo data in the UI.
 * Replace with real API responses when Weather / Reports / ML services are connected:
 *   const data = realData ?? demoData;
 */
import type { CityRiskLevel } from "@/components/city/types";

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
