export interface RegistrationTokenPayload{
  email: string;
  purpose: "registration";
}

export interface AccessTokenPayload{
  userId: string;
  storeId: string;
  role: "admin" | "purchase" | "sales";
}