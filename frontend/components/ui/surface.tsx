import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const surfaceVariants = cva("border backdrop-blur-[var(--glass-blur)]", {
  variants: {
    variant: {
      card: "rounded-2xl border-[color:var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--glass-shadow)]",
      nav: "rounded-full border-[color:var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--glass-shadow)]",
      modal:
        "rounded-2xl border-[color:var(--glass-border)] bg-[var(--glass-bg-strong)] shadow-[var(--glass-shadow)]",
    },
  },
  defaultVariants: {
    variant: "card",
  },
});

function Surface({
  className,
  variant = "card",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof surfaceVariants>) {
  return (
    <div
      data-slot="surface"
      data-variant={variant}
      className={cn(surfaceVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Surface, surfaceVariants };
