import { RoleName } from "../models/Role";

export interface PermissionDef {
  key: string;
  description: string;
}

// module:action. This is the single source of truth; it is upserted into the Permission collection at startup.
export const PERMISSION_CATALOG: PermissionDef[] = [
  { key: "store:view", description: "View store details" },
  { key: "store:manage", description: "Edit store details and create stores" },
  { key: "user:view", description: "View users" },
  { key: "user:manage", description: "Create and manage users" },
  { key: "item:view", description: "View items" },
  { key: "item:manage", description: "Create, edit and deactivate items" },
  { key: "category:view", description: "View categories" },
  { key: "category:manage", description: "Create and edit categories" },
  { key: "party:view", description: "View vendors/parties" },
  { key: "party:manage", description: "Create and edit vendors/parties" },
  { key: "sale:view", description: "View sales invoices" },
  { key: "sale:create", description: "Create sales invoices" },
  { key: "sale:cancel", description: "Cancel sales invoices" },
  { key: "sale_return:create", description: "Create sales returns" },
  { key: "purchase:view", description: "View purchase invoices" },
  { key: "purchase:create", description: "Create purchase invoices" },
  { key: "purchase:cancel", description: "Cancel purchase invoices" },
  { key: "purchase_return:create", description: "Create purchase returns" },
  { key: "payment:view", description: "View payments" },
  { key: "payment:create", description: "Record payments in/out" },
  { key: "ledger:view", description: "View ledgers" },
  { key: "stock:adjust", description: "Adjust stock manually" },
  { key: "cashsession:manage", description: "Open and close cash sessions" },
  { key: "report:view", description: "View reports" },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_CATALOG.map((p) => p.key);

// Permissions that can never be given to sales/purchase staff
const NON_DELEGABLE = new Set(["store:view", "store:manage", "user:view", "user:manage"]);

export const DELEGABLE_PERMISSION_KEYS: string[] = ALL_PERMISSION_KEYS.filter((k) => !NON_DELEGABLE.has(k));

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  owner: ALL_PERMISSION_KEYS,
  admin: ALL_PERMISSION_KEYS.filter((k) => k !== "store:manage"),
  sales: [
    "item:view",
    "category:view",
    "sale:view",
    "sale:create",
    "sale_return:create",
    "cashsession:manage",
  ],
  purchase: [
    "item:view",
    "category:view",
    "party:view",
    "party:manage",
    "purchase:view",
    "purchase:create",
    "purchase_return:create",
    "payment:view",
    "payment:create",
  ],
};
