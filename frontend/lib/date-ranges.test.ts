import { describe, it, expect, vi, afterEach } from "vitest";
import { limaTodayRange, limaWeekRange, limaMonthRange } from "./date-ranges";

afterEach(() => {
  vi.useRealTimers();
});

describe("date-ranges", () => {
  it("resolves today's range using the Lima calendar day, not UTC", () => {
    // 2026-01-07T10:00:00Z is Wednesday 2026-01-07 in both UTC and Lima —
    // a simple baseline case.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-07T10:00:00.000Z"));

    const { from, to } = limaTodayRange();

    expect(from).toBe("2026-01-07T05:00:00.000Z");
    expect(to).toBe("2026-01-08T04:59:59.999Z");
  });

  it("uses the Lima calendar day even when UTC has already rolled to the next day", () => {
    // 2026-01-12T04:00:00Z is Monday in UTC but still Sunday 23:00 in Lima
    // (UTC-5) — the whole point of the reports module's timezone handling.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-12T04:00:00.000Z"));

    const { from, to } = limaTodayRange();

    expect(from).toBe("2026-01-11T05:00:00.000Z");
    expect(to).toBe("2026-01-12T04:59:59.999Z");
  });

  it("computes the week range from Monday through today (Lima)", () => {
    // Lima date 2026-01-07 is a Wednesday; Monday of that week is 2026-01-05.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-07T10:00:00.000Z"));

    const { from, to } = limaWeekRange();

    expect(from).toBe("2026-01-05T05:00:00.000Z");
    expect(to).toBe("2026-01-08T04:59:59.999Z");
  });

  it("wraps the week range into the previous month when needed", () => {
    // Lima date 2026-02-01 is a Sunday; Monday of that week is 2026-01-26.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T15:00:00.000Z"));

    const { from, to } = limaWeekRange();

    expect(from).toBe("2026-01-26T05:00:00.000Z");
    expect(to).toBe("2026-02-02T04:59:59.999Z");
  });

  it("computes the month range from day 1 through today (Lima)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-07T10:00:00.000Z"));

    const { from, to } = limaMonthRange();

    expect(from).toBe("2026-01-01T05:00:00.000Z");
    expect(to).toBe("2026-01-08T04:59:59.999Z");
  });
});
