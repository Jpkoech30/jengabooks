import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/auth-store';

/**
 * Hook that provides a refreshKey which increments whenever the company changes.
 * All data-fetching pages should include refreshKey in their useEffect dependencies
 * to automatically re-fetch data when the user switches companies.
 * 
 * Usage:
 *   const { refreshKey, companyId, companyName } = useCompanyRefresh();
 *   useEffect(() => { fetchData(); }, [refreshKey]);
 */
export function useCompanyRefresh() {
  const user = useAuthStore((state) => state.user);
  const companyId = user?.companyId;
  const companyName = user?.companyName;
  const [refreshKey, setRefreshKey] = useState(0);

  // Track the last known companyId to detect switches
  const [lastCompanyId, setLastCompanyId] = useState<string | undefined>(companyId);

  useEffect(() => {
    if (companyId && companyId !== lastCompanyId) {
      setLastCompanyId(companyId);
      setRefreshKey((k) => k + 1);
    }
  }, [companyId, lastCompanyId]);

  const forceRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { refreshKey, companyId, companyName, forceRefresh };
}
