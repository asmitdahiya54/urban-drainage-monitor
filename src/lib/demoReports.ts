/**
 * FRONTEND DEMO REPORT STORE — browser-only, not sent to any server.
 * Used when signed in with a demo account or when the backend is unreachable.
 */
export type DemoReport = {
  reference: string;
  title: string;
  category: string;
  severity: string;
  description: string;
  latitude: number;
  longitude: number;
  landmark: string;
  photos: string[]; // downscaled data URLs
  created_at: string;
  owner_email: string;
  isDemo: true;
};

const KEY = "udm.demo_reports";
const COUNTER_KEY = "udm.demo_report_counter";

export function listDemoReports(ownerEmail?: string): DemoReport[] {
  if (typeof window === "undefined") return [];
  try {
    const all = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as DemoReport[];
    return ownerEmail ? all.filter((r) => r.owner_email === ownerEmail) : all;
  } catch {
    return [];
  }
}

export function saveDemoReport(input: Omit<DemoReport, "reference" | "created_at" | "isDemo">) {
  const next = Number(window.localStorage.getItem(COUNTER_KEY) ?? "0") + 1;
  const report: DemoReport = {
    ...input,
    reference: `UDM-DEMO-${String(next).padStart(4, "0")}`,
    created_at: new Date().toISOString(),
    isDemo: true,
  };
  const all = [...listDemoReports(), report];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full: keep the record but drop its photos.
    all[all.length - 1] = { ...report, photos: [] };
    window.localStorage.setItem(KEY, JSON.stringify(all));
  }
  window.localStorage.setItem(COUNTER_KEY, String(next));
  return report;
}

/** Shrinks a photo so a few fit in browser storage. */
export function downscaleImage(file: File, maxSide = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image."));
    };
    img.src = url;
  });
}
