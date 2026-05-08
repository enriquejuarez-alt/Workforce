import * as React from "react";
import { cn } from "@/lib/utils/cn";
import type { NivelCumplimiento } from "@/lib/domain/types";
import { COLOR_NIVEL } from "@/lib/utils/formato";

interface BadgeCumplimientoProps {
  nivel: NivelCumplimiento;
  valor: string;
}

export function BadgeCumplimiento({ nivel, valor }: BadgeCumplimientoProps) {
  const col = COLOR_NIVEL[nivel];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border",
        col.bg,
        col.text,
        col.border
      )}
    >
      {valor}
    </span>
  );
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-gray-100 text-gray-700 border border-gray-200",
        variant === "secondary" && "bg-gray-100 text-gray-600",
        variant === "outline" && "border border-gray-300 text-gray-500",
        className
      )}
      {...props}
    />
  );
}
