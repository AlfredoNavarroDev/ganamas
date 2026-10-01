import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import KpisPage from "./page";
import { ToastProvider } from "@/components/ui/toast";
import { setToken } from "@/lib/auth";
import { setActiveBusinessId } from "@/lib/business";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage() {
  return render(
    <ToastProvider>
      <KpisPage />
    </ToastProvider>,
  );
}

const summary = {
  revenue: "10.00",
  profit: "4.00",
  count: 2,
  avgTicket: "5.00",
  topProduct: { productId: "prod-1", productName: "Palta hass", profit: "4.00" },
  byPaymentMethod: [{ paymentMethod: "efectivo", revenue: "10.00" }],
};

const business = { id: "biz-1", name: "Frutas", active: true, dailyProfitGoal: null as string | null };

function stubLoad(overrides: {
  summaryResponse?: unknown;
  todayStatus?: number;
  todayBody?: unknown;
  history?: unknown[];
  businessResponse?: unknown;
}) {
  const {
    summaryResponse = summary,
    todayStatus = 404,
    todayBody = null,
    history = [],
    businessResponse = [business],
  } = overrides;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/reports/summary")) return jsonResponse(summaryResponse);
      if (url.includes("/closings/today")) {
        return todayStatus === 200 ? jsonResponse(todayBody) : jsonResponse({ message: "not found" }, 404);
      }
      if (url.includes("/closings")) return jsonResponse(history);
      if (url.includes("/businesses")) return jsonResponse(businessResponse);
      throw new Error(`unexpected url ${url}`);
    }),
  );
}

describe("KpisPage", () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
    replace.mockClear();
  });

  it("redirects to /login when there is no token", async () => {
    renderPage();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("redirects to /dashboard when there is no active business", async () => {
    setToken("token-123");
    renderPage();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows a skeleton while the summary is loading", () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderPage();

    expect(screen.getByTestId("kpis-skeleton")).toBeInTheDocument();
  });

  it("shows the day's summary by default", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad({});
    renderPage();

    expect(await screen.findByTestId("kpi-revenue")).toHaveTextContent("S/ 10.00");
    expect(screen.getByTestId("kpi-profit")).toHaveTextContent("S/ 4.00");
    expect(screen.getByText("Palta hass · ganancia S/ 4.00")).toBeInTheDocument();
  });

  it("refetches the summary with a different range when switching tabs", async () => {
    // Fixed instant so "day" and "week" ranges are deterministically different:
    // Lima date 2026-01-07 is a Wednesday, so the week's Monday is 2026-01-05.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-07T10:00:00.000Z"));
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/reports/summary")) return jsonResponse(summary);
      if (url.includes("/closings/today")) return jsonResponse({ message: "not found" }, 404);
      if (url.includes("/closings")) return jsonResponse([]);
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await screen.findByTestId("kpi-revenue");
    const dayCall = fetchMock.mock.calls.find(([url]) => url.includes("/reports/summary"));
    expect(dayCall?.[0]).toContain("from=2026-01-07T05:00:00.000Z");

    fetchMock.mockClear();
    await user.click(screen.getByRole("button", { name: "Semana" }));

    await waitFor(() => {
      const weekCall = fetchMock.mock.calls.find(([url]) => url.includes("/reports/summary"));
      expect(weekCall?.[0]).toContain("from=2026-01-05T05:00:00.000Z");
    });

    vi.useRealTimers();
  });

  it("shows an enabled close button when today has not been closed yet", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad({ todayStatus: 404 });
    renderPage();

    const button = await screen.findByRole("button", { name: "Cerrar día" });
    expect(button).toBeEnabled();
  });

  it("shows the close time and a disabled button when today is already closed", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad({
      todayStatus: 200,
      todayBody: { id: "closing-1", closedDate: "2026-01-07", closedAt: "2026-01-07T20:00:00.000Z", snapshot: summary },
    });
    renderPage();

    const button = await screen.findByRole("button", { name: /^Cerrado a las/ });
    expect(button).toBeDisabled();
  });

  it("closes the day and shows a toast", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const created = {
      id: "closing-1",
      closedDate: "2026-01-07",
      closedAt: "2026-01-07T20:00:00.000Z",
      snapshot: summary,
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/closings/today")) return jsonResponse({ message: "not found" }, 404);
      if (url.includes("/closings") && init?.method === "POST") return jsonResponse(created, 201);
      if (url.includes("/closings")) return jsonResponse([]);
      if (url.includes("/reports/summary")) return jsonResponse(summary);
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Cerrar día" }));

    expect(await screen.findByText("Día cerrado")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^Cerrado a las/ })).toBeDisabled();
  });

  it("shows a destructive toast when the day was already closed by someone else", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/closings/today")) return jsonResponse({ message: "not found" }, 404);
      if (url.includes("/closings") && init?.method === "POST") {
        return jsonResponse({ statusCode: 409, message: "El día ya fue cerrado." }, 409);
      }
      if (url.includes("/closings")) return jsonResponse([]);
      if (url.includes("/reports/summary")) return jsonResponse(summary);
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Cerrar día" }));

    expect(await screen.findByText("El día ya estaba cerrado.")).toBeInTheDocument();
  });

  it("shows an input to set the goal when the business has none", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad({});
    renderPage();

    expect(await screen.findByLabelText(/meta diaria de ganancia/i)).toBeInTheDocument();
  });

  it("shows progress against the goal when the business has one", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad({ businessResponse: [{ ...business, dailyProfitGoal: "10.00" }] });
    renderPage();

    expect(await screen.findByText(/S\/ 4\.00 \/ S\/ 10\.00/)).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("saves a new daily goal", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/reports/summary")) return jsonResponse(summary);
      if (url.includes("/closings/today")) return jsonResponse({ message: "not found" }, 404);
      if (url.includes("/closings")) return jsonResponse([]);
      if (url.includes("/businesses/biz-1") && init?.method === "PATCH") {
        return jsonResponse({ ...business, dailyProfitGoal: "10.00" });
      }
      if (url.includes("/businesses")) return jsonResponse([business]);
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText(/meta diaria de ganancia/i), "10.00");
    await user.click(screen.getByRole("button", { name: /guardar meta/i }));

    expect(await screen.findByText(/S\/ 4\.00 \/ S\/ 10\.00/)).toBeInTheDocument();
  });
});