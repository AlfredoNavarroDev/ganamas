import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExpensesPage from "./page";
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
      <ExpensesPage />
    </ToastProvider>,
  );
}

const expense = {
  id: "expense-1",
  amount: "25.00",
  description: "Bolsas para empacar",
  expensedAt: "2026-09-29T14:00:00.000Z",
};

function stubLoad(expenses: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/expenses")) return jsonResponse({ data: expenses, total: expenses.length });
      throw new Error(`unexpected url ${url}`);
    }),
  );
}

describe("ExpensesPage", () => {
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

  it("shows an empty state when there are no expenses", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad([]);
    renderPage();

    expect(await screen.findByText(/todavía no registraste gastos/i)).toBeInTheDocument();
  });

  it("lists existing expenses", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad([expense]);
    renderPage();

    expect(await screen.findByText("Bolsas para empacar")).toBeInTheDocument();
    expect(screen.getByText(/25\.00/)).toBeInTheDocument();
  });

  it("creates an expense", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [], total: 0 }))
      .mockResolvedValueOnce(jsonResponse(expense));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/todavía no registraste gastos/i);
    await user.type(screen.getByLabelText(/^monto$/i), "25.00");
    await user.type(screen.getByLabelText(/^descripción$/i), "Bolsas para empacar");
    await user.click(screen.getByRole("button", { name: /agregar gasto/i }));

    expect(await screen.findByText("Bolsas para empacar")).toBeInTheDocument();
  });

  it("shows an error alert when expenses fail to load", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    renderPage();

    expect(await screen.findByText(/no se pudo conectar con el servidor/i)).toBeInTheDocument();
  });
});
