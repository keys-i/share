import "@testing-library/jest-dom/vitest";
import { transferableAbortController } from "node:util";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./mocks/server";

// Suppress console.error in tests to reduce noise from expected errors
// Comment this out if you need to debug test failures
vi.spyOn(console, "error").mockImplementation(() => {});

// Fetch runs in Node, so it requires Node signals rather than jsdom signals
const createTimeoutSignal = (ms: number): AbortSignal => {
  const controller = transferableAbortController();
  setTimeout(() => controller.abort(new DOMException("TimeoutError", "TimeoutError")), ms);
  return controller.signal;
};
AbortSignal.timeout = createTimeoutSignal;

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

// Reset handlers after each test (removes any runtime handlers added during tests)
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => server.close());
