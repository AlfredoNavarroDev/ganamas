import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SalesPage from "./page";
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
      <SalesPage />
    </ToastProvider>
  );
}

const product = {
  id: "prod-1",
  name: "Palta hass",
  price: "5.00",
  unit: "kg",
  category: "palta",
  stock: "10.00",
  active: true,
};

const sale = {
  id: "sale-1",
  product: { id: "prod-1", name: "Palta hass", unit: "kg" },
  quantity: "2.00",
  unitPrice: "5.00",
  listPrice: "5.00",
  total: "10.00",
  profit: "4.00",
  paymentMethod: "efectivo",
  soldAt: "2026-01-15T19:00:00.000Z",
};

function stubLoad(products: unknown[], sales: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/products")) return jsonResponse(products);
      if (url.includes("/sales")) return jsonResponse({ data: sales, total: sales.length });
      throw new Error(`unexpected url ${url}`);
    }),
  );
}

describe("SalesPage", () => {
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

  it("shows an empty state when there are no sales", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad([product], []);
    renderPage();

    expect(await screen.findByText(/todavía no registraste ventas/i)).toBeInTheDocument();
  });

  it("lists existing sales", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad([product], [sale]);
    renderPage();

    expect(await screen.findByText(/2\.00 kg × 5\.00 = 10\.00 · efectivo/)).toBeInTheDocument();
  });

  it("prefills the unit price with the selected product's catalog price", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad([product], []);
    renderPage();

    const priceInput = await screen.findByLabelText(/precio unitario/i);
    await waitFor(() => expect(priceInput).toHaveValue("5.00"));
  });

  it("registers a sale", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/products")) return jsonResponse([product]);
      if (url.includes("/sales") && init?.method === "POST") return jsonResponse(sale);
      if (url.includes("/sales")) return jsonResponse({ data: [], total: 0 });
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await screen.findByLabelText(/precio unitario/i);
    await user.type(screen.getByLabelText(/^cantidad$/i), "2");
    await user.click(screen.getByRole("button", { name: /registrar venta/i }));

    expect(await screen.findByText(/2\.00 kg × 5\.00 = 10\.00 · efectivo/)).toBeInTheDocument();
  });

  it("shows a translated error when stock is insufficient", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/products")) return jsonResponse([product]);
      if (url.includes("/sales") && init?.method === "POST") {
        return jsonResponse({ statusCode: 400, message: "Insufficient stock" }, 400);
      }
      if (url.includes("/sales")) return jsonResponse({ data: [], total: 0 });
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await screen.findByLabelText(/precio unitario/i);
    await user.type(screen.getByLabelText(/^cantidad$/i), "999");
    await user.click(screen.getByRole("button", { name: /registrar venta/i }));

    expect(await screen.findByText(/stock insuficiente/i)).toBeInTheDocument();
  });

  it("shows an error alert when sales fail to load", async () => {
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

const productOption = {
  id: "prod-1",
  name: "Arroz 1kg",
  price: "4.50",
  unit: "kg" as const,
  stock: "24",
  active: true,
};

const deleteFlowSale = {
  id: "sale-1",
  product: { id: "prod-1", name: "Arroz 1kg", unit: "kg" as const },
  quantity: "2",
  unitPrice: "4.50",
  total: "9.00",
  paymentMethod: "efectivo" as const,
  soldAt: "2026-09-22T10:00:00.000Z",
};

describe("SalesPage delete flow", () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
    replace.mockClear();
    setToken("token-123");
    setActiveBusinessId("biz-1");
  });

  it("shows a confirmation dialog instead of deleting immediately", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([productOption]))
      .mockResolvedValueOnce(jsonResponse({ data: [deleteFlowSale] }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Eliminar" }));

    expect(screen.getByText('¿Eliminar esta venta?')).toBeInTheDocument();
  });

  it("does not delete when Cancelar is clicked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([productOption]))
      .mockResolvedValueOnce(jsonResponse({ data: [deleteFlowSale] }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Eliminar" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText('¿Eliminar esta venta?')).not.toBeInTheDocument();
    expect(screen.getByText("Arroz 1kg")).toBeInTheDocument();
  });

  it("deletes and shows a toast when confirmed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([productOption]))
      .mockResolvedValueOnce(jsonResponse({ data: [deleteFlowSale] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse([productOption]));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Eliminar" }));
    await user.click(screen.getByRole("button", { name: "Eliminar venta" }));

    await waitFor(() => expect(screen.queryByText("Arroz 1kg")).not.toBeInTheDocument());
    expect(await screen.findByText("Venta eliminada")).toBeInTheDocument();
  });

  it("shows a skeleton while sales are loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderPage();

    expect(screen.getByTestId("sales-skeleton")).toBeInTheDocument();
  });
});
