import { describe, expect, it } from "vitest";

import { authSessionSchema, authUserSchema, loginRequestSchema } from "../src/index.js";

describe("loginRequestSchema", () => {
  it("accepts username/password pairs", () => {
    expect(
      loginRequestSchema.safeParse({
        username: "demo",
        password: "demo-password",
      }).success,
    ).toBe(true);
  });

  it("rejects empty credentials", () => {
    expect(
      loginRequestSchema.safeParse({
        username: "",
        password: "",
      }).success,
    ).toBe(false);
  });
});

describe("authUserSchema", () => {
  it("requires a UUID id and username", () => {
    expect(
      authUserSchema.safeParse({
        id: "63c3f9f5-7b06-48d8-83de-42b8b6d40164",
        username: "demo",
      }).success,
    ).toBe(true);
    expect(authUserSchema.safeParse({ id: "not-a-uuid", username: "demo" }).success).toBe(false);
  });
});

describe("authSessionSchema", () => {
  it("requires a nested auth user", () => {
    expect(
      authSessionSchema.safeParse({
        user: {
          id: "63c3f9f5-7b06-48d8-83de-42b8b6d40164",
          username: "demo",
        },
      }).success,
    ).toBe(true);
  });
});
