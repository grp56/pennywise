import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

function describeUnexpectedFetch(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

const confirmMock = vi.fn(() => true);
const scrollToMock = vi.fn();
const fetchMock = vi.fn(async (input: string | URL | Request) => {
  throw new Error(
    `Unexpected fetch() call in a component test for '${describeUnexpectedFetch(input)}'. Mock the apiClient helpers instead.`,
  );
});

Object.defineProperty(window, "confirm", {
  configurable: true,
  writable: true,
  value: confirmMock,
});

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  writable: true,
  value: scrollToMock,
});

Object.defineProperty(globalThis, "fetch", {
  configurable: true,
  writable: true,
  value: fetchMock,
});

beforeEach(() => {
  confirmMock.mockReset();
  confirmMock.mockReturnValue(true);

  scrollToMock.mockReset();

  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: string | URL | Request) => {
    throw new Error(
      `Unexpected fetch() call in a component test for '${describeUnexpectedFetch(input)}'. Mock the apiClient helpers instead.`,
    );
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
