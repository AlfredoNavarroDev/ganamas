import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductsPage from "./page";
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
      <ProductsPage />
    </ToastProvider>
  );
}

const sampleProduct = {
  id: "prod-1",
  name: "Palta hass",
  price: "5.00",
  unit: "kg",
  category: "palta",
  stock: "10.00",
  active: true,
};

describe("ProductsPage", () => {
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

  it("shows an empty state when the business has no products", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([])));
    renderPage();

    expect(await screen.findByText(/todavía no tenés productos/i)).toBeInTheDocument();
  });

  it("lists existing products", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([sampleProduct])));
    renderPage();

    expect(await screen.findByText("Palta hass")).toBeInTheDocument();
    expect(screen.getByText(/5\.00/)).toBeInTheDocument();
  });

  it("creates a product", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(sampleProduct));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/todavía no tenés productos/i);
    await user.type(screen.getByLabelText(/^nombre$/i), "Palta hass");
    await user.type(screen.getByLabelText(/^precio$/i), "5.00");
    await user.click(screen.getByRole("button", { name: /agregar producto/i }));

    expect(await screen.findByText("Palta hass")).toBeInTheDocument();
  });

  it("edits a product", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const updated = { ...sampleProduct, price: "6.00" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([sampleProduct]))
      .mockResolvedValueOnce(jsonResponse(updated));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Palta hass");
    await user.click(screen.getByRole("button", { name: /editar/i }));

    const priceInput = screen.getAllByLabelText(/^precio$/i)[1];
    await user.clear(priceInput);
    await user.type(priceInput, "6.00");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/6\.00/)).toBeInTheDocument();
  });

  it("shows an error alert when products fail to load", async () => {
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

const product = {
  id: "prod-1",
  name: "Arroz 1kg",
  price: "4.50",
  unit: "kg" as const,
  category: null,
  stock: "24",
  active: true,
};

describe("ProductsPage delete flow", () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
    replace.mockClear();
    setToken("token-123");
    setActiveBusinessId("biz-1");
  });

  it("shows a confirmation dialog instead of deleting immediately", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([product])));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Eliminar" }));

    expect(screen.getByText('¿Eliminar "Arroz 1kg"?')).toBeInTheDocument();
  });

  it("does not delete when Cancelar is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([product])));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Eliminar" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText('¿Eliminar "Arroz 1kg"?')).not.toBeInTheDocument();
    expect(screen.getByText("Arroz 1kg")).toBeInTheDocument();
  });

  it("deletes and shows a toast when confirmed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([product]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Eliminar" }));
    await user.click(screen.getByRole("button", { name: "Eliminar producto" }));

    await waitFor(() => expect(screen.queryByText("Arroz 1kg")).not.toBeInTheDocument());
    expect(await screen.findByText("Producto eliminado")).toBeInTheDocument();
  });

  it("shows a skeleton while products are loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderPage();

    expect(screen.getByTestId("products-skeleton")).toBeInTheDocument();
  });
});
