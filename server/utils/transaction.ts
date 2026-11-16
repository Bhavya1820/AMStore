import mongoose, { ClientSession } from "mongoose";

let supported: boolean | null = null;

// Transactions need a replica set or sharded cluster (e.g. Atlas); a standalone mongod has none
async function transactionsSupported(): Promise<boolean> {
  if (supported !== null) return supported;
  try {
    const hello = await mongoose.connection.db?.admin().command({ hello: 1 });
    supported = Boolean(hello?.setName) || hello?.msg === "isdbgrid";
  } catch {
    supported = false;
  }
  return supported;
}

/**
 * Runs `fn` inside a MongoDB transaction when the deployment supports it, so multi-document
 * writes (invoice + stock + ledgers + balances) commit or roll back together.
 * On a standalone server it runs without a session. Pass the session to every write.
 */
export async function runAtomic<T>(fn: (session?: ClientSession) => Promise<T>): Promise<T> {
  if (!(await transactionsSupported())) return fn(undefined);

  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

