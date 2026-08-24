export const SHOP_PERMISSION_GROUPS = [
  {
    id: 'sales',
    label: 'Sales & till',
    description: 'Quick till, sales history, and deal corrections.',
    permissions: [
      {
        key: 'access_till',
        label: 'Quick till',
        hint: 'Open the till page and checkout basket sales.',
      },
      {
        key: 'access_sales',
        label: 'Sales history',
        hint: 'View past sales, receipts, and swap records.',
      },
      {
        key: 'record_sales',
        label: 'Record sales',
        hint: 'Sell items from inventory or the till.',
      },
      {
        key: 'record_swaps',
        label: 'Record swaps',
        hint: 'Complete trade-in / swap deals.',
      },
      {
        key: 'process_returns',
        label: 'Returns & RMA',
        hint: 'Process refunds and exchanges on completed sales.',
      },
      {
        key: 'edit_sales',
        label: 'Edit completed sales',
        hint: 'Correct sale date, customer details, and price on closed sales.',
      },
      {
        key: 'edit_swaps',
        label: 'Edit completed swaps',
        hint: 'Correct swap date, customer details, and amounts on closed swaps.',
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Stock list, products, transfers, and cost visibility.',
    permissions: [
      {
        key: 'view_inventory',
        label: 'View inventory',
        hint: 'Browse stock, item details, and quantities.',
      },
      {
        key: 'add_items',
        label: 'Add products',
        hint: 'Add new inventory items and receive stock.',
      },
      {
        key: 'edit_items',
        label: 'Edit products',
        hint: 'Update prices, details, identifiers, and status.',
      },
      {
        key: 'delete_items',
        label: 'Delete products',
        hint: 'Remove items from active inventory.',
      },
      {
        key: 'transfer_stock',
        label: 'Transfer stock',
        hint: 'Move items between branches.',
      },
      {
        key: 'view_profit',
        label: 'View profit & cost',
        hint: 'See cost price, margin, and profit across inventory and sales.',
      },
    ],
  },
  {
    id: 'money',
    label: 'Money & purchasing',
    description: 'Cash counting, expenses, supplier purchases, and customer credit.',
    permissions: [
      {
        key: 'access_cashup',
        label: 'Cash & expenses',
        hint: 'Cash-up sessions, till counts, and shop expenses.',
      },
      {
        key: 'access_purchasing',
        label: 'Purchasing',
        hint: 'Record supplier purchases and pay suppliers.',
      },
      {
        key: 'manage_credits',
        label: 'Customer credits',
        hint: 'View outstanding credit sales and record payments.',
      },
    ],
  },
  {
    id: 'stock_take',
    label: 'Stock accountability',
    description: 'Open/close stock sessions and stock-take reports.',
    permissions: [
      {
        key: 'access_stock_take',
        label: 'Stock-take sessions',
        hint: 'View stock session history and summaries.',
      },
      {
        key: 'manage_stock_sessions',
        label: 'Run stock sessions',
        hint: 'Open and close stock counts for a branch.',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Repairs & contacts',
    description: 'Repair tracking and supplier/customer directory.',
    permissions: [
      {
        key: 'access_repairs',
        label: 'Repairs',
        hint: 'Send units to engineers and track repair jobs.',
      },
      {
        key: 'access_contacts',
        label: 'Contacts',
        hint: 'View and manage suppliers and customers.',
      },
    ],
  },
  {
    id: 'insights',
    label: 'Reports & insights',
    description: 'Analytics, reports, alerts, and audit trail.',
    permissions: [
      {
        key: 'access_analytics',
        label: 'Pricing & profit analytics',
        hint: 'Analytics page with trends and top earners.',
      },
      {
        key: 'access_reports',
        label: 'Reports',
        hint: 'Business reports and exports.',
      },
      {
        key: 'access_audit_log',
        label: 'Audit log',
        hint: 'Shop activity and change history.',
      },
      {
        key: 'access_alerts',
        label: 'Low stock alerts',
        hint: 'Alerts page for low-stock notifications.',
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Price list',
    description: 'Shareable customer price list.',
    permissions: [
      {
        key: 'access_price_list',
        label: 'Price list',
        hint: 'Generate and share the public price list.',
      },
    ],
  },
  {
    id: 'shop_admin',
    label: 'Shop & team',
    description: 'Settings, branches, teammates, and roles.',
    permissions: [
      {
        key: 'access_settings',
        label: 'Open settings',
        hint: 'Access the settings page (theme and personal options).',
      },
      {
        key: 'manage_shop_settings',
        label: 'Shop profile & branches',
        hint: 'Edit shop name, branches, warranty policy, and logo.',
      },
      {
        key: 'manage_team',
        label: 'Manage team',
        hint: 'Invite teammates, add accounts, and edit branch access.',
      },
      {
        key: 'manage_roles',
        label: 'Manage roles',
        hint: 'Create and edit custom roles and permissions.',
      },
    ],
  },
] as const;

type GroupPermission = (typeof SHOP_PERMISSION_GROUPS)[number]['permissions'][number];
export type ShopPermissionKey = GroupPermission['key'];

export type ShopPermissions = Record<ShopPermissionKey, boolean>;

export type ShopPermissionMeta = {
  key: ShopPermissionKey;
  label: string;
  hint: string;
  groupId: string;
  groupLabel: string;
};

export const SHOP_PERMISSION_KEYS = SHOP_PERMISSION_GROUPS.flatMap(group =>
  group.permissions.map(permission => permission.key),
) as ShopPermissionKey[];

export const SHOP_PERMISSION_CATALOG: ShopPermissionMeta[] = SHOP_PERMISSION_GROUPS.flatMap(group =>
  group.permissions.map(permission => ({
    key: permission.key,
    label: permission.label,
    hint: permission.hint,
    groupId: group.id,
    groupLabel: group.label,
  })),
);

export const ROUTE_PERMISSIONS: Record<string, ShopPermissionKey | ShopPermissionKey[]> = {
  '/till': 'access_till',
  '/inventory': 'view_inventory',
  '/inventory/new': 'add_items',
  '/sales': 'access_sales',
  '/share': 'access_price_list',
  '/cashup': 'access_cashup',
  '/contacts': 'access_contacts',
  '/purchasing': 'access_purchasing',
  '/analytics': 'access_analytics',
  '/audit-log': 'access_audit_log',
  '/credits': 'manage_credits',
  '/repair': 'access_repairs',
  '/repairs': 'access_repairs',
  '/reports': 'access_reports',
  '/reports/stock-sessions': 'access_stock_take',
  '/alerts': 'access_alerts',
  '/settings': ['access_settings', 'manage_shop_settings', 'manage_team', 'manage_roles'],
};

export type ShopRoleRecord = {
  id: string;
  business_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  permissions: ShopPermissions;
  is_system: boolean;
  sort_order: number;
  created_at: string;
};

const LEGACY_FINANCIAL_KEYS = [
  'access_cashup',
  'access_purchasing',
  'manage_credits',
  'access_analytics',
  'access_reports',
  'access_audit_log',
] as const;

function allTrue(): ShopPermissions {
  return Object.fromEntries(SHOP_PERMISSION_KEYS.map(key => [key, true])) as ShopPermissions;
}

function fromEntries(entries: Partial<ShopPermissions>): ShopPermissions {
  const base = emptyShopPermissions();
  for (const key of SHOP_PERMISSION_KEYS) {
    if (typeof entries[key] === 'boolean') base[key] = entries[key]!;
  }
  return base;
}

export const OWNER_PERMISSIONS = allTrue();

export const DEFAULT_STAFF_PERMISSIONS = fromEntries({
  access_till: true,
  access_sales: true,
  record_sales: true,
  record_swaps: true,
  process_returns: true,
  view_inventory: true,
  add_items: true,
  edit_items: true,
  transfer_stock: true,
  access_repairs: true,
  access_contacts: true,
  access_price_list: true,
  access_alerts: true,
  access_settings: true,
});

export const DEFAULT_MANAGER_PERMISSIONS = fromEntries({
  ...DEFAULT_STAFF_PERMISSIONS,
  delete_items: true,
  view_profit: true,
  access_cashup: true,
  access_purchasing: true,
  manage_credits: true,
  access_stock_take: true,
  manage_stock_sessions: true,
  access_analytics: true,
  access_reports: true,
  access_audit_log: true,
  manage_shop_settings: true,
  manage_team: true,
  edit_sales: true,
  edit_swaps: true,
});

export function emptyShopPermissions(): ShopPermissions {
  return Object.fromEntries(SHOP_PERMISSION_KEYS.map(key => [key, false])) as ShopPermissions;
}

function migrateLegacyPermissionKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const next = { ...raw };

  if (next.access_financial_nav === true) {
    for (const key of LEGACY_FINANCIAL_KEYS) next[key] = true;
    next.access_settings = true;
  }

  if (next.manage_business_settings === true) {
    next.manage_shop_settings = true;
    next.access_settings = true;
  }

  if (next.invite_team_members === true) {
    next.manage_team = true;
    next.access_settings = true;
  }

  if (next.manage_roles === true) {
    next.access_settings = true;
  }

  if (next.view_profit === true) {
    next.view_profit = true;
  }

  if (next.edit_sales === true || next.edit_swaps === true) {
    next.edit_sales = next.edit_sales ?? true;
    next.edit_swaps = next.edit_swaps ?? true;
  }

  return next;
}

export function normalizeShopPermissions(raw: unknown): ShopPermissions {
  const base = emptyShopPermissions();
  if (!raw || typeof raw !== 'object') return base;
  const migrated = migrateLegacyPermissionKeys(raw as Record<string, unknown>);
  for (const key of SHOP_PERMISSION_KEYS) {
    const value = migrated[key];
    if (typeof value === 'boolean') base[key] = value;
  }
  return base;
}

export function hasShopPermission(
  permissions: ShopPermissions,
  key: ShopPermissionKey,
): boolean {
  return permissions[key] === true;
}

export function hasAnyShopPermission(
  permissions: ShopPermissions,
  keys: ShopPermissionKey | ShopPermissionKey[],
): boolean {
  const list = Array.isArray(keys) ? keys : [keys];
  return list.some(key => hasShopPermission(permissions, key));
}

export function resolveMemberPermissions(input: {
  isOwner: boolean;
  rolePermissions?: unknown;
  branchRestricted?: boolean;
}): ShopPermissions {
  if (input.isOwner) return { ...OWNER_PERMISSIONS };
  const permissions = normalizeShopPermissions(input.rolePermissions);
  if (input.branchRestricted) {
    permissions.manage_shop_settings = false;
  }
  return permissions;
}

export function permissionsFromLegacyRole(role: string): ShopPermissions {
  if (role === 'owner') return { ...OWNER_PERMISSIONS };
  if (role === 'manager') return { ...DEFAULT_MANAGER_PERMISSIONS };
  return { ...DEFAULT_STAFF_PERMISSIONS };
}

export function permissionKeysForPath(pathname: string): ShopPermissionKey | ShopPermissionKey[] | null {
  if (ROUTE_PERMISSIONS[pathname]) return ROUTE_PERMISSIONS[pathname];
  if (pathname.startsWith('/inventory/') && pathname.endsWith('/edit')) return 'edit_items';
  if (pathname.startsWith('/inventory/')) return 'view_inventory';
  if (pathname.startsWith('/reports/stock-sessions/')) return 'access_stock_take';
  if (pathname.startsWith('/stock/open/') || pathname.startsWith('/stock/close/')) {
    return 'manage_stock_sessions';
  }
  return null;
}

export function canAccessPath(pathname: string, permissions: ShopPermissions): boolean {
  const required = permissionKeysForPath(pathname);
  if (!required) return true;
  return hasAnyShopPermission(permissions, required);
}

export function countEnabledPermissions(permissions: ShopPermissions): number {
  return SHOP_PERMISSION_KEYS.filter(key => permissions[key]).length;
}

export function applyGroupPreset(
  permissions: ShopPermissions,
  groupId: (typeof SHOP_PERMISSION_GROUPS)[number]['id'],
  enabled: boolean,
): ShopPermissions {
  const group = SHOP_PERMISSION_GROUPS.find(entry => entry.id === groupId);
  if (!group) return permissions;
  const next = { ...permissions };
  for (const permission of group.permissions) {
    next[permission.key] = enabled;
  }
  return next;
}

export function isGroupFullyEnabled(
  permissions: ShopPermissions,
  groupId: (typeof SHOP_PERMISSION_GROUPS)[number]['id'],
): boolean {
  const group = SHOP_PERMISSION_GROUPS.find(entry => entry.id === groupId);
  if (!group) return false;
  return group.permissions.every(permission => permissions[permission.key]);
}

export function isGroupPartiallyEnabled(
  permissions: ShopPermissions,
  groupId: (typeof SHOP_PERMISSION_GROUPS)[number]['id'],
): boolean {
  const group = SHOP_PERMISSION_GROUPS.find(entry => entry.id === groupId);
  if (!group) return false;
  const enabledCount = group.permissions.filter(permission => permissions[permission.key]).length;
  return enabledCount > 0 && enabledCount < group.permissions.length;
}

/** Back-compat helpers used across the app during migration to `hasPermission`. */
export function viewProfitAllowed(permissions: ShopPermissions): boolean {
  return hasShopPermission(permissions, 'view_profit');
}

export function financialNavAllowed(permissions: ShopPermissions): boolean {
  return hasAnyShopPermission(permissions, [
    'access_cashup',
    'access_purchasing',
    'manage_credits',
    'access_analytics',
    'access_reports',
    'access_audit_log',
    'access_stock_take',
  ]);
}

export function manageBusinessSettingsAllowed(permissions: ShopPermissions): boolean {
  return hasShopPermission(permissions, 'manage_shop_settings');
}

export function inviteTeamAllowed(permissions: ShopPermissions): boolean {
  return hasShopPermission(permissions, 'manage_team');
}

export function manageRolesAllowed(permissions: ShopPermissions): boolean {
  return hasShopPermission(permissions, 'manage_roles');
}

export function editSalesAllowed(permissions: ShopPermissions): boolean {
  return hasShopPermission(permissions, 'edit_sales');
}

export function editSwapsAllowed(permissions: ShopPermissions): boolean {
  return hasShopPermission(permissions, 'edit_swaps');
}

/** Server-side invite check still uses this permission name. */
export const INVITE_TEAM_PERMISSION_KEY = 'manage_team' as const;
export const MANAGE_ROLES_PERMISSION_KEY = 'manage_roles' as const;
