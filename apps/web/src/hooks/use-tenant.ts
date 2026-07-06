import React, { useEffect } from 'react';
import { useUiStore } from '../stores/ui-store';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
}

/**
 * Hook that provides tenant context for multi-tenancy.
 * Manages the active tenant selection and persists it.
 */
export function useTenant() {
  const [activeTenantId, setActiveTenantId] = React.useState<string | null>(null);

  useEffect(() => {
    // Restore tenant preference from storage
    const savedTenantId = localStorage.getItem('jengabooks_tenant_id');
    if (savedTenantId) {
      setActiveTenantId(savedTenantId);
    }
  }, []);

  const switchTenant = (tenantId: string) => {
    setActiveTenantId(tenantId);
    localStorage.setItem('jengabooks_tenant_id', tenantId);
  };

  const getTenantFromStorage = (): Tenant | null => {
    const id = localStorage.getItem('jengabooks_tenant_id');
    const name = localStorage.getItem('jengabooks_tenant_name');
    if (id && name) {
      return { id, name, slug: name.toLowerCase().replace(/\s+/g, '-') };
    }
    return null;
  };

  return {
    activeTenantId,
    switchTenant,
    getTenantFromStorage,
  };
}
