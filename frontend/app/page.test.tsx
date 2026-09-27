import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home (landing)", () => {
  it("renders the Ganamás brand heading, the dedication to Zuhhey, and a login CTA", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: /ganamás/i })).toBeInTheDocument();
    expect(screen.getAllByText(/zuhhey/i).length).toBeGreaterThan(0);

    const cta = screen.getByRole("button", { name: /iniciar sesión/i });
    expect(cta).toHaveAttribute("href", "/login");
  });
});
