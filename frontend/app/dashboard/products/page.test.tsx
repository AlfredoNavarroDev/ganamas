import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductsPage from "./page";
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

describe("ProductsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
    replace.mockClear();
  });

  it("redirects to /login when there is no token", async () => {
    render(<ProductsPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("redirects to /dashboard when there is no active business", async () => {
    setToken("token-123");
    render(<ProductsPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows an empty state when the business has no products", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([])));
    render(<ProductsPage />);

    expect(await screen.findByText(/todavía no tenés productos/i)).toBeInTheDocument();
  });

  it("lists existing products", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([product])));
    render(<ProductsPage />);

    expect(await screen.findByText("Palta hass")).toBeInTheDocument();
    expect(screen.getByText(/5\.00/)).toBeInTheDocument();
  });

  it("creates a product", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(product));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ProductsPage />);

    await screen.findByText(/todavía no tenés productos/i);
    await user.type(screen.getByLabelText(/^nombre$/i), "Palta hass");
    await user.type(screen.getByLabelText(/^precio$/i), "5.00");
    await user.click(screen.getByRole("button", { name: /agregar producto/i }));

    expect(await screen.findByText("Palta hass")).toBeInTheDocument();
  });

  it("edits a product", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const updated = { ...product, price: "6.00" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([product]))
      .mockResolvedValueOnce(jsonResponse(updated));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ProductsPage />);

    await screen.findByText("Palta hass");
    await user.click(screen.getByRole("button", { name: /editar/i }));

    const priceInput = screen.getAllByLabelText(/^precio$/i)[1];
    await user.clear(priceInput);
    await user.type(priceInput, "6.00");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/6\.00/)).toBeInTheDocument();
  });

  it("deletes a product", async () => {
    setToken("token-123");
    setActiveBusinessId("biz-1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([product]))
      .mockResolvedValueOnce(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ProductsPage />);

    await screen.findByText("Palta hass");
    await user.click(screen.getByRole("button", { name: /eliminar/i }));

    await waitFor(() => expect(screen.queryByText("Palta hass")).not.toBeInTheDocument());
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
    render(<ProductsPage />);

    expect(await screen.findByText(/no se pudo conectar con el servidor/i)).toBeInTheDocument();
  });
});
