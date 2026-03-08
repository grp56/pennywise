import type { AuthUser } from "@pennywise/contracts";

declare module "express-session" {
  interface SessionData {
    authUser?: AuthUser;
  }
}

declare global {
  namespace Express {
    interface Locals {
      authUser?: AuthUser;
    }
  }
}
