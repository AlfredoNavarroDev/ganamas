import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home (landing)", () => {
  it("renders the headline and a login CTA pointing to /login", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /registrá rápido\.\s*decidí con datos\./i }),
    ).toBeInTheDocument();

    const cta = screen.getByRole("button", { name: /iniciar sesión/i });
    expect(cta).toHaveAttribute("href", "/login");
  });

  it("lists the three core features", () => {
    render(<Home />);

    expect(screen.getByText("Registro en segundos")).toBeInTheDocument();
    expect(screen.getByText("Corte semanal y rentabilidad")).toBeInTheDocument();
    expect(screen.getByText("Alerta de stock bajo")).toBeInTheDocument();
  });
});
