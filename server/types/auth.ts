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