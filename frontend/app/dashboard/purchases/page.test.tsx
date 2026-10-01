import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PurchasesPage from "./page";
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
      <PurchasesPage />
    </ToastProvider>,
  );
}

const product = {
  id: "product-1",
  name: "Coca Cola 500ml",
  unit: "unidad" as const,
  stock: "10.00",
  avgCost: "2.50",
};

const purchase = {
  id: "purchase-1",
  product: { id: "product-1", name: "Coca Cola 500ml", unit: "unidad" as const },
  quantity: "20.00",
  unitCost: "2.20",
  totalCost: "44.00",
  purchasedAt: "2026-09-29T14:00:00.000Z",
};

function stubLoad(products: unknown[], purchases: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/products")) return jsonResponse(products);
      if (url.includes("/purchases")) return jsonResponse({ data: purchases, total: purchases.length });
      throw new Error(`unexpected url ${url}`);
    }),
  );
}

describe("PurchasesPage", () => {
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

  it("shows an empty state when there are no purchases", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad([product], []);
    renderPage();

    expect(await screen.findByText(/todavía no registraste compras/i)).toBeInTheDocument();
  });

  it("lists existing purchases", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad([product], [purchase]);
    renderPage();

    expect(await screen.findByText("Coca Cola 500ml")).toBeInTheDocument();
    expect(screen.getByText(/44\.00/)).toBeInTheDocument();
  });

  it("prompts to create a product first when there are none", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad([], []);
    renderPage();

    expect(
      await screen.findByText(/creá un producto primero para poder registrar compras/i),
    ).toBeInTheDocument();
  });

  it("creates a purchase", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([product]))
      .mockResolvedValueOnce(jsonResponse({ data: [], total: 0 }))
      .mockResolvedValueOnce(jsonResponse(purchase))
      .mockResolvedValueOnce(jsonResponse([{ ...product, stock: "30.00", avgCost: "2.30" }]));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/todavía no registraste compras/i);
    await user.type(screen.getByLabelText(/cantidad comprada/i), "20");
    await user.type(screen.getByLabelText(/costo unitario/i), "2.20");
    await user.click(screen.getByRole("button", { name: /registrar compra/i }));

    expect(await screen.findByText("Coca Cola 500ml")).toBeInTheDocument();
  });

  it("shows an error alert when purchases fail to load", async () => {
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
