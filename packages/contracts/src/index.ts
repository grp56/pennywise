import { z } from "zod";

const uuidSchema = z.string().uuid();

export const loginRequestSchema = z
  .object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export const authUserSchema = z
  .object({
    id: uuidSchema,
    username: z.string().min(1, "Username is required"),
  })
  .strict();

export const authSessionSchema = z
  .object({
    user: authUserSchema,
  })
  .strict();

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
