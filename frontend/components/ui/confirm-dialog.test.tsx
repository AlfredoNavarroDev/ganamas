// frontend/components/ui/confirm-dialog.test.tsx

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  it("does not render its content when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="¿Eliminar producto?"
        description="Esta acción no se puede deshacer."
        onConfirm={() => {}}
      />
    );
    expect(screen.queryByText("¿Eliminar producto?")).not.toBeInTheDocument();
  });

  it("shows title/description and calls onConfirm when confirmed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="¿Eliminar producto?"
        description="Esta acción no se puede deshacer."
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("¿Eliminar producto?")).toBeInTheDocument();
    expect(screen.getByText("Esta acción no se puede deshacer.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenChange(false) when Cancelar is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="¿Eliminar producto?"
        description="Esta acción no se puede deshacer."
        onConfirm={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
