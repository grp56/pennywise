declare module "connect-pg-simple" {
  import type session from "express-session";
  import type { Pool } from "pg";

  interface ConnectPgSimpleOptions {
    createTableIfMissing?: boolean;
    pool: Pool;
    tableName?: string;
  }

  type SessionStoreClass = new (options: ConnectPgSimpleOptions) => session.Store;

  export default function connectPgSimple(sessionModule: typeof session): SessionStoreClass;
}
