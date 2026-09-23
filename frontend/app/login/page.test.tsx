import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";
import { getToken } from "@/lib/auth";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Usuario"), "admin");
  await user.type(screen.getByLabelText("Contraseña"), "change-me");
  await user.click(screen.getByRole("button", { name: /ingresar/i }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("stores the token and redirects to /dashboard on success", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accessToken: "token-123" }),
    });

    const user = userEvent.setup();
    render(<LoginPage />);
    await fillAndSubmit(user);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(getToken()).toBe("token-123");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "change-me" }),
      }),
    );
  });

  it("shows an error and does not redirect on invalid credentials", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    const user = userEvent.setup();
    render(<LoginPage />);
    await fillAndSubmit(user);

    expect(
      await screen.findByText("Usuario o contraseña incorrectos."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(getToken()).toBeNull();
  });

  it("shows a connection error when the request fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("network down"),
    );

    const user = userEvent.setup();
    render(<LoginPage />);
    await fillAndSubmit(user);

    expect(
      await screen.findByText(
        "No se pudo conectar con el servidor. Probá de nuevo.",
      ),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText("Contraseña");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /mostrar contraseña/i }));
    expect(passwordInput).toHaveAttribute("type", "text");
  });
});
