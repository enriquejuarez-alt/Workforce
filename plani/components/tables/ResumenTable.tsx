"use client";

import React, { useState } from "react";
import type { ResultadoServicio } from "@/lib/domain/types";
import { nivelCumplimiento } from "@/lib/domain/types";
import { BadgeCumplimiento } from "@/components/ui/badge";
import { fmtHoras, fmtNumero, fmtPct, fmtDelta } from "@/lib/utils/formato";
import { cn } from "@/lib/utils/cn";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  resultados: ResultadoServicio[];
}

type SortKey = "servicio" | "hcActivos" | "cumplimiento" | "deltaHC103" | "teoricoFacturable";
type SortDir = "asc" | "desc";

export function ResumenTable({ resultados }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("servicio");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandidoEq, setExpandidoEq] = useState<string | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const ordenados = [...resultados].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "servicio") cmp = a.servicio.localeCompare(b.servicio);
    else if (sortKey === "hcActivos") cmp = a.hcActivos - b.hcActivos;
    else if (sortKey === "cumplimiento") cmp = a.cumplimiento - b.cumplimiento;
    else if (sortKey === "deltaHC103") cmp = a.deltaHC103 - b.deltaHC103;
    else if (sortKey === "teoricoFacturable") cmp = a.teoricoFacturable - b.teoricoFacturable;
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortIcon({ campo }: { campo: SortKey }) {
    if (sortKey !== campo)
      return <ChevronDown className="h-3 w-3 opacity-30 inline ml-1" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 text-[#0054A6] inline ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 text-[#0054A6] inline ml-1" />
    );
  }

  function ThSort({ campo, label }: { campo: SortKey; label: string }) {
    return (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-gray-800 select-none"
        onClick={() => toggleSort(campo)}
      >
        {label}
        <SortIcon campo={campo} />
      </th>
    );
  }

  return (
    <div className="overflow-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <ThSort campo="servicio" label="Servicio" />
            <ThSort campo="hcActivos" label="Personas activas" />
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">En licencia</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Hs Brutas</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Reductor</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Hs Netas</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Hs Requeridas</th>
            <ThSort campo="cumplimiento" label="Cumplimiento" />
            <ThSort campo="deltaHC103" label="Faltan para 103%" />
            <ThSort campo="teoricoFacturable" label="Teórico facturar" />
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Recorte</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Capa</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Ag. Eq.</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((r, i) => {
            const nivel = nivelCumplimiento(r.cumplimiento);
            const pctReductor = ((1 - r.factorProductivo) * 100).toFixed(1);
            const eq = r.agentesEquivalentes;
            const tieneDeficit = r.deltaHC103 > 0;

            return (
              <React.Fragment key={r.servicio}>
                <tr className={cn(
                  "border-b border-gray-100 transition-colors hover:bg-gray-50",
                  i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                )}>
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{r.servicio}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-700">{fmtNumero(r.hcActivos)}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-500">{fmtNumero(r.hcLP)}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">{fmtHoras(r.hsBrutas)}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-500">-{pctReductor}%</td>
                  <td className="px-4 py-3 tabular-nums text-gray-700">{fmtHoras(r.hsNetas)}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">{fmtHoras(r.hsRequeridas)}</td>
                  <td className="px-4 py-3">
                    <BadgeCumplimiento nivel={nivel} valor={fmtPct(r.cumplimiento)} />
                  </td>
                  <td className={cn("px-4 py-3 tabular-nums font-medium", r.deltaHC103 > 0 ? "text-red-600" : "text-green-600")}>
                    {fmtDelta(r.deltaHC103)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[#0054A6] font-medium">{fmtHoras(r.teoricoFacturable)}</td>
                  <td className={cn("px-4 py-3 tabular-nums", r.recorte > 0 ? "text-violet-600" : "text-gray-300")}>
                    {r.recorte > 0 ? fmtHoras(r.recorte) : "—"}
                  </td>
                  <td className={cn("px-4 py-3 tabular-nums", r.hcCapa > 0 ? "text-amber-600" : "text-gray-300")}>
                    {r.hcCapa > 0 ? fmtNumero(r.hcCapa) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {tieneDeficit ? (
                      <button
                        onClick={() => setExpandidoEq(expandidoEq === r.servicio ? null : r.servicio)}
                        className="text-xs text-[#0054A6] hover:underline underline-offset-2 transition-colors"
                      >
                        Ver
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
                {expandidoEq === r.servicio && tieneDeficit && (
                  <tr className="bg-blue-50 border-b border-blue-100">
                    <td colSpan={13} className="px-6 py-3">
                      <div className="flex items-center gap-6 text-xs">
                        <span className="text-gray-500">Agentes necesarios para cerrar el gap:</span>
                        <span className="text-gray-700">
                          <span className="text-gray-400">30 hs:</span>{" "}
                          <strong className="text-red-600">{Math.ceil(eq.hs30)}</strong>
                        </span>
                        <span className="text-gray-700">
                          <span className="text-gray-400">35 hs:</span>{" "}
                          <strong className="text-red-600">{Math.ceil(eq.hs35)}</strong>
                        </span>
                        <span className="text-gray-700">
                          <span className="text-gray-400">36 hs:</span>{" "}
                          <strong className="text-red-600">{Math.ceil(eq.hs36)}</strong>
                        </span>
                        <span className="text-gray-700">
                          <span className="text-gray-400">Mix actual:</span>{" "}
                          <strong className="text-amber-600">{Math.ceil(eq.mix)} personas</strong>
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
