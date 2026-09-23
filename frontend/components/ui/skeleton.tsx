import * as React from "react";
import { cn } from "cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-2xl border border-[color:var(--glass-border)] bg-[var(--glass-bg)]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
