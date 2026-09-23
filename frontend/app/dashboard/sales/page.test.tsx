import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SalesPage from "./page";
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
    render(<SalesPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("redirects to /dashboard when there is no active business", async () => {
    setToken("token-123");
    render(<SalesPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows an empty state when there are no sales", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad([product], []);
    render(<SalesPage />);

    expect(await screen.findByText(/todavía no registraste ventas/i)).toBeInTheDocument();
  });

  it("lists existing sales", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad([product], [sale]);
    render(<SalesPage />);

    expect(await screen.findByText(/2\.00 kg × 5\.00 = 10\.00 · efectivo/)).toBeInTheDocument();
  });

  it("prefills the unit price with the selected product's catalog price", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    stubLoad([product], []);
    render(<SalesPage />);

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
    render(<SalesPage />);

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
    render(<SalesPage />);

    await screen.findByLabelText(/precio unitario/i);
    await user.type(screen.getByLabelText(/^cantidad$/i), "999");
    await user.click(screen.getByRole("button", { name: /registrar venta/i }));

    expect(await screen.findByText(/stock insuficiente/i)).toBeInTheDocument();
  });

  it("deletes a sale", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/products")) return jsonResponse([product]);
      if (init?.method === "DELETE") return jsonResponse({});
      if (url.includes("/sales")) return jsonResponse({ data: [sale], total: 1 });
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SalesPage />);

    const rowText = /2\.00 kg × 5\.00 = 10\.00 · efectivo/;
    await screen.findByText(rowText);
    await user.click(screen.getByRole("button", { name: /eliminar/i }));

    await waitFor(() => expect(screen.queryByText(rowText)).not.toBeInTheDocument());
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
    render(<SalesPage />);

    expect(await screen.findByText(/no se pudo conectar con el servidor/i)).toBeInTheDocument();
  });
});
