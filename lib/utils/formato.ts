export function fmtPct(valor: number, decimales = 1): string {
  return `${valor.toFixed(decimales)}%`;
}

export function fmtHoras(valor: number, decimales = 0): string {
  return valor.toFixed(decimales) + " hs";
}

export function fmtNumero(valor: number, decimales = 0): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}

export function fmtDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} HC`;
}

export const COLOR_NIVEL = {
  critico: {
    bg: "bg-rose-500/15",
    text: "text-rose-400",
    border: "border-rose-500/30",
    hex: "#f43f5e",
  },
  bajo: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
    hex: "#f59e0b",
  },
  ideal: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    hex: "#10b981",
  },
  alto: {
    bg: "bg-sky-500/15",
    text: "text-sky-400",
    border: "border-sky-500/30",
    hex: "#0ea5e9",
  },
  exceso: {
    bg: "bg-violet-500/15",
    text: "text-violet-400",
    border: "border-violet-500/30",
    hex: "#8b5cf6",
  },
} as const;
