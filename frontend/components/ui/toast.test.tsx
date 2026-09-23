import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./toast";

function Trigger() {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast("Producto creado", "success")}>
      disparar
    </button>
  );
}

describe("ToastProvider", () => {
  it("shows a toast message when toast() is called", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );

    await user.click(screen.getByRole("button", { name: "disparar" }));

    expect(await screen.findByText("Producto creado")).toBeInTheDocument();
  });

  it("throws when useToast is used outside a ToastProvider", () => {
    function Bare() {
      useToast();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(
      "useToast must be used within a ToastProvider"
    );
  });
});
