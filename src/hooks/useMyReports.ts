/** Loads the signed-in user's reports (admins receive every report). */
import { useCallback, useEffect, useState } from "react";

import { ApiError, reportsApi, type DrainageReport } from "@/services/api";

export function useMyReports() {
  const [reports, setReports] = useState<DrainageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { reports: fetched } = await reportsApi.list();
      setReports(fetched);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Your reports could not be loaded right now.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { reports, loading, error, reload: load };
}
