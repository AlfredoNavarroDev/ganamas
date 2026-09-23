import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardPage from "./page";
import { getToken, setToken } from "@/lib/auth";
import { getActiveBusinessId } from "@/lib/business";

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

describe("DashboardPage", () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
    replace.mockClear();
  });

  it("redirects to /login when there is no token", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Sesión iniciada")).not.toBeInTheDocument();
  });

  it("renders the welcome card when a token is present", async () => {
    setToken("token-123");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([])));
    render(<DashboardPage />);
    expect(await screen.findByText("Sesión iniciada")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("clears the token and redirects to /login on logout", async () => {
    setToken("token-123");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([])));
    const user = userEvent.setup();
    render(<DashboardPage />);

    await screen.findByText("Sesión iniciada");
    await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    expect(getToken()).toBeNull();
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("shows a create-business form when the user has no businesses", async () => {
    setToken("token-123");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([])));
    render(<DashboardPage />);

    expect(await screen.findByLabelText(/creá tu primer negocio/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear negocio/i })).toBeInTheDocument();
  });

  it("creates a business and activates it", async () => {
    setToken("token-123");
    const created = { id: "biz-1", name: "Frutas", active: true };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(created));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DashboardPage />);

    await screen.findByLabelText(/creá tu primer negocio/i);
    await user.type(screen.getByLabelText(/creá tu primer negocio/i), "Frutas");
    await user.click(screen.getByRole("button", { name: /crear negocio/i }));

    await waitFor(() => expect(getActiveBusinessId()).toBe("biz-1"));
    expect(await screen.findByRole("combobox", { name: /negocio activo/i })).toHaveValue("biz-1");
  });

  it("auto-selects the first business when none is active yet", async () => {
    setToken("token-123");
    const businesses = [
      { id: "biz-1", name: "Frutas", active: true },
      { id: "biz-2", name: "Verduras", active: true },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(businesses)));
    render(<DashboardPage />);

    const select = await screen.findByRole("combobox", { name: /negocio activo/i });
    expect(select).toHaveValue("biz-1");
    await waitFor(() => expect(getActiveBusinessId()).toBe("biz-1"));
  });

  it("lets the user switch between businesses", async () => {
    setToken("token-123");
    const businesses = [
      { id: "biz-1", name: "Frutas", active: true },
      { id: "biz-2", name: "Verduras", active: true },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(businesses)));
    const user = userEvent.setup();
    render(<DashboardPage />);

    const select = await screen.findByRole("combobox", { name: /negocio activo/i });
    await user.selectOptions(select, "biz-2");

    expect(getActiveBusinessId()).toBe("biz-2");
  });

  it("shows a link to the products page when a business is active", async () => {
    setToken("token-123");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([{ id: "biz-1", name: "Frutas", active: true }])));
    render(<DashboardPage />);

    const link = await screen.findByRole("button", { name: /productos/i });
    expect(link).toHaveAttribute("href", "/dashboard/products");
  });

  it("shows a link to the sales page when a business is active", async () => {
    setToken("token-123");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([{ id: "biz-1", name: "Frutas", active: true }])));
    render(<DashboardPage />);

    const link = await screen.findByRole("button", { name: /^ventas$/i });
    expect(link).toHaveAttribute("href", "/dashboard/sales");
  });

  it("shows an error alert when businesses fail to load", async () => {
    setToken("token-123");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    render(<DashboardPage />);

    expect(await screen.findByText(/no se pudo conectar con el servidor/i)).toBeInTheDocument();
  });
});
