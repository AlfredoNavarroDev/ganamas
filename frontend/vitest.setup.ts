import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// @testing-library/dom's waitFor/findBy* only detect fake timers via a global
// `jest` object (see @testing-library/dom/dist/helpers.js#jestFakeTimersAreEnabled).
// Vitest doesn't expose that global, so without this shim any test that calls
// vi.useFakeTimers() and then awaits a Testing Library query hangs forever:
// React's effect scheduler falls back to a (now-fake, never-advanced) timer,
// so effects never flush and the awaited text/role never appears.
if (typeof (globalThis as { jest?: unknown }).jest === "undefined") {
  (globalThis as { jest?: unknown }).jest = {
    advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
  };
}