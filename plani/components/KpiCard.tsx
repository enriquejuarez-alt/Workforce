import { cn } from "@/lib/utils/cn";

interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "blue" | "rose" | "amber" | "sky" | "violet" | "gray" | "emerald";
  className?: string;
}

const ACCENT = {
  blue:    { value: "text-[#0054A6]", bar: "bg-[#0054A6]" },
  emerald: { value: "text-emerald-600", bar: "bg-emerald-500" },
  rose:    { value: "text-red-600",     bar: "bg-red-500"     },
  amber:   { value: "text-amber-600",   bar: "bg-amber-500"   },
  sky:     { value: "text-sky-600",     bar: "bg-sky-500"     },
  violet:  { value: "text-violet-600",  bar: "bg-violet-500"  },
  gray:    { value: "text-gray-700",    bar: "bg-gray-400"    },
};

export function KpiCard({ label, value, sublabel, accent = "blue", className }: KpiCardProps) {
  const a = ACCENT[accent];
  return (
    <div className={cn(
      "relative rounded-xl border border-gray-200 bg-white px-5 py-4 flex flex-col gap-1 overflow-hidden shadow-sm",
      className
    )}>
      <div className={cn("absolute top-0 left-0 right-0 h-0.5", a.bar)} />
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-0.5">
        {label}
      </p>
      <p className={cn("text-3xl font-bold tabular-nums leading-tight", a.value)}>
        {value}
      </p>
      {sublabel && (
        <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}
