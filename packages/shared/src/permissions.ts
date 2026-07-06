import { CompanyRole } from './enums';

export type Permission =
  | 'company:create' | 'company:read' | 'company:update' | 'company:delete'
  | 'account:create' | 'account:read' | 'account:update' | 'account:delete'
  | 'journal:create' | 'journal:read' | 'journal:update' | 'journal:delete'
  | 'period:create' | 'period:read' | 'period:lock' | 'period:reopen'
  | 'etims:generate' | 'etims:submit' | 'etims:view' | 'etims:retry' | 'etims:override'
  | 'mpesa:upload' | 'mpesa:approve' | 'mpesa:delete' | 'mpesa:map'
  | 'hitl:view' | 'hitl:resolve' | 'hitl:assign'
  | 'report:generate' | 'report:export' | 'report:share'
  | 'user:invite' | 'user:deactivate' | 'user:reset-password'
  | 'admin:health' | 'admin:redis' | 'admin:queues' | 'admin:backup' | 'admin:migrate'
  | 'gamification:view' | 'gamification:adjust';

// Role-based permission map
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [CompanyRole.FIRM_OWNER]: [
    'company:create', 'company:read', 'company:update', 'company:delete',
    'account:create', 'account:read', 'account:update', 'account:delete',
    'journal:create', 'journal:read', 'journal:update', 'journal:delete',
    'period:create', 'period:lock', 'period:reopen',
    'etims:generate', 'etims:submit', 'etims:view', 'etims:retry',
    'mpesa:upload', 'mpesa:approve', 'mpesa:delete', 'mpesa:map',
    'hitl:view', 'hitl:resolve', 'hitl:assign',
    'report:generate', 'report:export', 'report:share',
    'user:invite', 'user:deactivate', 'user:reset-password',
    'gamification:view',
  ],
  [CompanyRole.ACCOUNTANT]: [
    'account:create', 'account:read', 'account:update',
    'journal:create', 'journal:read', 'journal:update',
    'period:lock',
    'etims:generate', 'etims:submit', 'etims:view', 'etims:retry',
    'mpesa:upload', 'mpesa:approve', 'mpesa:map',
    'hitl:view', 'hitl:resolve',
    'report:generate', 'report:export', 'report:share',
    'gamification:view',
  ],
  [CompanyRole.SME_OWNER]: [
    'company:read', 'company:update',
    'account:read',
    'journal:create', 'journal:read',
    'etims:view',
    'mpesa:upload',
    'report:generate', 'report:share',
    'gamification:view',
  ],
  [CompanyRole.VIEWER]: [
    'company:read',
    'account:read',
    'journal:read',
    'report:generate',
  ],
  [CompanyRole.AUDITOR]: [
    'account:read',
    'journal:read',
    'period:read',
    'etims:view',
    'report:generate',
  ],
};

// Helper to check if a role has a specific permission
export function hasPermission(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
