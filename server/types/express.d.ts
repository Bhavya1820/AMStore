import { AuthContext } from "./auth";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      // Set by requireStoreAccess after verifying the user may act on this store
      storeId?: string;
    }
  }
}

export {};