import { describe, it, expect, beforeEach } from "vitest";
import {
  clearActiveBusinessId,
  getActiveBusinessId,
  setActiveBusinessId,
} from "./business";

describe("active business id helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no business id stored", () => {
    expect(getActiveBusinessId()).toBeNull();
  });

  it("stores and retrieves the active business id", () => {
    setActiveBusinessId("biz-1");
    expect(getActiveBusinessId()).toBe("biz-1");
  });

  it("removes the active business id", () => {
    setActiveBusinessId("biz-1");
    clearActiveBusinessId();
    expect(getActiveBusinessId()).toBeNull();
  });
});
