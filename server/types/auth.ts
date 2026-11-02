export type Role = "owner" | "admin" | "purchase" | "sales";

export interface RegistrationTokenPayload{
  email: string;
  purpose: "registration";
}

export interface AccessTokenPayload{
  userId: string;
  tenantId: string;
  // Empty array = access to all stores in the tenant
  storeIds: string[];
  role: Role;
}

// Built by the authenticate middleware from the database on every request,
// so deactivation and permission changes take effect immediately.
export interface AuthContext {
  userId: string;
  tenantId: string;
  role: Role;
  isOwner: boolean;
  // Empty array = all stores (owner only)
  storeIds: string[];
  permissions: Set<string>;
  mustChangePassword: boolean;
}