import path from "node:path";

import connectPgSimple from "connect-pg-simple";
import express, { type ErrorRequestHandler, type Request } from "express";
import session from "express-session";

import { createAuthRouter } from "./auth.js";
import { createBusinessRouter } from "./business.js";
import type { ApiConfig } from "./config.js";
import { type ApiDatabase, createDatabase, createPool } from "./db/client.js";
import { ApiHttpError, createInternalError } from "./errors.js";

export interface ApiAppRuntime {
  app: ReturnType<typeof express>;
  database: ApiDatabase;
  close: () => Promise<void>;
}

function shouldServeFrontendShell(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  if (request.path.startsWith("/api")) {
    return false;
  }

  if (!request.accepts("html")) {
    return false;
  }

  return path.posix.extname(request.path) === "";
}

export function createApp(config: ApiConfig): ApiAppRuntime {
  const pool = createPool(config.connectionString);
  const database = createDatabase(pool);
  const app = express();
  const PgSessionStore = connectPgSimple(session);
  const secureCookies = config.nodeEnv === "production";
  const frontendIndexPath = path.join(config.frontendDistPath, "index.html");

  if (secureCookies) {
    app.set("trust proxy", 1);
  }

  app.use(express.json());
  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookies,
      },
      store: new PgSessionStore({
        pool,
        createTableIfMissing: false,
        tableName: "session",
      }),
    }),
  );

  app.use("/api", createAuthRouter(database, secureCookies));
  app.use("/api", createBusinessRouter(database));

  if (config.serveFrontendAssets) {
    app.use(
      express.static(config.frontendDistPath, {
        index: false,
      }),
    );

    app.use((request, response, next) => {
      if (!shouldServeFrontendShell(request)) {
        next();
        return;
      }

      response.sendFile(frontendIndexPath);
    });
  }

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof SyntaxError && "status" in error && error.status === 400) {
      response.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Malformed JSON request body",
      });
      return;
    }

    if (error instanceof ApiHttpError) {
      response.status(error.statusCode).json(error.responseBody);
      return;
    }

    console.error(error);
    const internalError = createInternalError();
    response.status(internalError.statusCode).json(internalError.responseBody);
  };

  app.use(errorHandler);

  return {
    app,
    database,
    close: async () => {
      await pool.end();
    },
  };
}
