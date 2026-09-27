// frontend/components/ui/select.tsx

"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "cn";

function Select(props: SelectPrimitive.Root.Props<any>) {
  return <SelectPrimitive.Root {...props} />;
}

function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm transition-colors outline-none",
        "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue(props: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectContent({ className, children, sideOffset = 6, ...props }: SelectPrimitive.Popup.Props & { sideOffset?: number }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={sideOffset} className="z-50 outline-none">
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "max-h-[min(24rem,var(--available-height))] w-[var(--anchor-width)] min-w-[10rem] overflow-y-auto rounded-2xl border border-[color:var(--glass-border)] bg-[var(--glass-bg-strong)] p-1 shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)]",
            "origin-[var(--transform-origin)] transition-[scale,opacity] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:duration-100 data-[ending-style]:ease-[cubic-bezier(0.4,0,1,1)]",
            className
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none select-none",
        "data-[highlighted]:bg-white/10 data-[highlighted]:text-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4 shrink-0" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
