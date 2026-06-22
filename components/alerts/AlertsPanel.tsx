"use client";

import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { Alerta, AlertSeveridad } from "@/lib/domain/types";

interface Props {
  alertas: Alerta[];
  compact?: boolean;
  onServiceClick?: (servicio: string) => void;
}

const CONFIG: Record<AlertSeveridad, { icon: typeof AlertTriangle; color: string; bg: string; border: string; label: string }> = {
  critical: {
    icon: AlertCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    label: "Crítico",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    label: "Advertencia",
  },
  info: {
    icon: Info,
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
    label: "Info",
  },
};

function AlertaItem({ alerta, onServiceClick }: { alerta: Alerta; onServiceClick?: (s: string) => void }) {
  const [expandido, setExpandido] = useState(false);
  const cfg = CONFIG[alerta.severidad];
  const Icon = cfg.icon;

  return (
    <div className={cn("rounded-lg border p-3", cfg.bg, cfg.border)}>
      <div
        className="flex items-start gap-2.5 cursor-pointer"
        onClick={() => alerta.detalle && setExpandido(!expandido)}
      >
        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", cfg.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-800">{alerta.mensaje}</p>
            <div className="flex items-center gap-2 shrink-0">
              {alerta.servicio !== "global" && (
                onServiceClick ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onServiceClick(alerta.servicio); }}
                    className="text-xs text-[#0054A6] border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded px-1.5 py-0.5 transition-colors"
                  >
                    {alerta.servicio} →
                  </button>
                ) : (
                  <span className="text-xs text-gray-500 border border-gray-200 bg-white rounded px-1.5 py-0.5">
                    {alerta.servicio}
                  </span>
                )
              )}
              {alerta.metrica !== undefined && (
                <span className={cn("text-xs font-semibold tabular-nums", cfg.color)}>
                  {alerta.metrica > 0 ? "+" : ""}{alerta.metrica.toFixed(1)} {alerta.metricaLabel}
                </span>
              )}
              {alerta.detalle &&
                (expandido ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                ))}
            </div>
          </div>
          {expandido && alerta.detalle && (
            <p className="text-xs text-gray-500 mt-1.5">{alerta.detalle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AlertsPanel({ alertas, compact = false, onServiceClick }: Props) {
  const criticas = alertas.filter((a) => a.severidad === "critical");
  const warnings = alertas.filter((a) => a.severidad === "warning");
  const infos = alertas.filter((a) => a.severidad === "info");

  if (alertas.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-400">
        Sin alertas activas
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {criticas.length > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            <AlertCircle className="h-3 w-3" />
            {criticas.length}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-3 w-3" />
            {warnings.length}
          </span>
        )}
        {infos.length > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-sky-600 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">
            <Info className="h-3 w-3" />
            {infos.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {[...criticas, ...warnings, ...infos].map((a) => (
        <AlertaItem key={a.id} alerta={a} onServiceClick={onServiceClick} />
      ))}
    </div>
  );
}
