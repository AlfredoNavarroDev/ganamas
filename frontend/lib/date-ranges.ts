const LIMA_TIME_ZONE = "America/Lima";

const WEEKDAY_OFFSET_FROM_MONDAY: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export type DateRange = { from: string; to: string };

function limaDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function limaWeekdayShort(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: LIMA_TIME_ZONE,
    weekday: "short",
  }).format(date);
}

// Treats `dateString` as a plain calendar date (no timezone conversion) and
// shifts it by `deltaDays`, returning a new "YYYY-MM-DD" string. Uses UTC
// internally purely as calendar-math scratch space.
function shiftDateString(dateString: string, deltaDays: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays, 12));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

// Lima is UTC-5 with no DST: local midnight is always 05:00 UTC the same day.
function limaDayBounds(dateString: string): DateRange {
  const from = new Date(`${dateString}T05:00:00.000Z`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function limaTodayRange(): DateRange {
  return limaDayBounds(limaDateString(new Date()));
}

export function limaWeekRange(): DateRange {
  const now = new Date();
  const today = limaDateString(now);
  const monday = shiftDateString(today, -WEEKDAY_OFFSET_FROM_MONDAY[limaWeekdayShort(now)]);
  return { from: limaDayBounds(monday).from, to: limaDayBounds(today).to };
}

export function limaMonthRange(): DateRange {
  const today = limaDateString(new Date());
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  return { from: limaDayBounds(firstOfMonth).from, to: limaDayBounds(today).to };
}
