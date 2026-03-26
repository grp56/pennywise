import type { AuthSession, AuthUser, LoginRequest } from "@pennywise/contracts";
import { authSessionSchema, loginRequestSchema } from "@pennywise/contracts";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { type Request, type RequestHandler, Router } from "express";

import type { ApiDatabase } from "./db/client.js";
import { users } from "./db/schema.js";
import { ApiHttpError, createUnauthorizedError, createValidationError } from "./errors.js";

function parseLoginRequest(body: unknown): LoginRequest {
  const parsed = loginRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw createValidationError(parsed.error);
  }

  return parsed.data;
}

async function saveSession(request: Request): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    request.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function destroySession(request: Request): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    request.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function getSessionUser(request: Request): AuthUser | undefined {
  return request.session.authUser;
}

export const requireAuthenticatedUser: RequestHandler = (request, response, next) => {
  const authUser = getSessionUser(request);

  if (!authUser) {
    next(createUnauthorizedError());
    return;
  }

  response.locals.authUser = authUser;
  next();
};

export function createAuthRouter(database: ApiDatabase, secureCookies: boolean): Router {
  const router = Router();

  router.post("/auth/login", async (request, response) => {
    const credentials = parseLoginRequest(request.body);
    const [user] = await database
      .select({
        id: users.id,
        username: users.username,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.username, credentials.username))
      .limit(1);

    if (!user) {
      throw createUnauthorizedError("Invalid username or password");
    }

    const passwordMatches = await bcrypt.compare(credentials.password, user.passwordHash);

    if (!passwordMatches) {
      throw createUnauthorizedError("Invalid username or password");
    }

    request.session.authUser = {
      id: user.id,
      username: user.username,
    };

    await saveSession(request);

    const sessionResponse: AuthSession = authSessionSchema.parse({
      user: request.session.authUser,
    });

    response.status(200).json(sessionResponse);
  });

  router.post("/auth/logout", async (request, response) => {
    await destroySession(request);
    response.clearCookie("connect.sid", {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: secureCookies,
    });
    response.status(204).send();
  });

  router.get("/me", requireAuthenticatedUser, (request, response) => {
    if (!response.locals.authUser) {
      throw new ApiHttpError(500, "INTERNAL_ERROR", "Authenticated user context is missing");
    }

    const sessionResponse: AuthSession = authSessionSchema.parse({
      user: response.locals.authUser,
    });

    response.status(200).json(sessionResponse);
  });

  return router;
}
