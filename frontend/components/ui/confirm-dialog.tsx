// frontend/components/ui/confirm-dialog.tsx

"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  confirming?: boolean;
};

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  onConfirm,
  confirming = false,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/55 backdrop-blur-sm transition-opacity duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            "data-[starting-style]:opacity-0",
            "data-[ending-style]:opacity-0 data-[ending-style]:duration-[160ms] data-[ending-style]:ease-[cubic-bezier(0.4,0,1,1)]"
          )}
        />
        <Dialog.Popup
          data-slot="confirm-dialog"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(360px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[color:var(--glass-border)] bg-[var(--glass-bg-strong)] p-5 shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)]",
            // Tailwind v4 emits translate-*/scale-* as the standalone `translate`/`scale`
            // CSS properties, so those are what must be transitioned (not `transform`).
            // The enter/exit motion animates scale+opacity only: `translate` is owned by
            // the -translate-x-1/2 -translate-y-1/2 centering above, and overriding it
            // per-state would knock the popup off centre for the whole transition.
            "transition-[translate,scale,opacity] duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:duration-[160ms] data-[ending-style]:ease-[cubic-bezier(0.4,0,1,1)]"
          )}
        >
          <Dialog.Title className="text-base font-semibold text-foreground">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {description}
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button type="button" variant="destructive" disabled={confirming} onClick={onConfirm}>
              {confirming ? "Eliminando…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { ConfirmDialog };
export type { ConfirmDialogProps };
