import { z } from "zod";

const apiEnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(1, "SESSION_SECRET is required"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export interface ApiConfig {
  connectionString: string;
  sessionSecret: string;
  port: number;
  nodeEnv: "development" | "test" | "production";
}

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsedEnvironment = apiEnvironmentSchema.parse(environment);

  return {
    connectionString: parsedEnvironment.DATABASE_URL,
    sessionSecret: parsedEnvironment.SESSION_SECRET,
    port: parsedEnvironment.PORT,
    nodeEnv: parsedEnvironment.NODE_ENV,
  };
}
