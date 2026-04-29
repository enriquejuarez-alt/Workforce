"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface MesData {
  label: string;
  deslogueo: string;
  ausentismo: string;
  rotacion: string;
  peso: string;
}

const MES_DEFAULTS: MesData[] = [
  { label: "Mes anterior (2)", deslogueo: "", ausentismo: "", rotacion: "", peso: "25" },
  { label: "Mes anterior (1)", deslogueo: "", ausentismo: "", rotacion: "", peso: "35" },
  { label: "Mes actual",       deslogueo: "", ausentismo: "", rotacion: "", peso: "40" },
];

function pct(v: string) {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? null : n / 100;
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

export default function CalculadoraPage() {
  const [meses, setMeses] = useState<MesData[]>(MES_DEFAULTS);
  const [modo, setModo] = useState<"multiplicativo" | "aditivo">("multiplicativo");

  const update = (i: number, campo: keyof MesData, valor: string) => {
    setMeses((prev) => prev.map((m, idx) => idx === i ? { ...m, [campo]: valor } : m));
  };

  const resultado = useMemo(() => {
    const parsed = meses.map((m) => ({
      deslogueo:  pct(m.deslogueo),
      ausentismo: pct(m.ausentismo),
      rotacion:   pct(m.rotacion),
      peso:       parseFloat(m.peso) || 0,
    }));

    const totalPeso = parsed.reduce((s, m) => s + m.peso, 0);
    if (totalPeso === 0) return null;
    if (parsed.some((m) => m.deslogueo === null || m.ausentismo === null || m.rotacion === null)) return null;

    const wmDeslogueo  = parsed.reduce((s, m) => s + (m.deslogueo!  * m.peso), 0) / totalPeso;
    const wmAusentismo = parsed.reduce((s, m) => s + (m.ausentismo! * m.peso), 0) / totalPeso;
    const wmRotacion   = parsed.reduce((s, m) => s + (m.rotacion!   * m.peso), 0) / totalPeso;

    const factorMult = (1 - wmDeslogueo) * (1 - wmAusentismo) * (1 - wmRotacion);
    const factorAdit = 1 - (wmDeslogueo + wmAusentismo + wmRotacion);
    const factor = modo === "multiplicativo" ? factorMult : factorAdit;

    return { wmDeslogueo, wmAusentismo, wmRotacion, factor, factorMult, factorAdit, totalPeso };
  }, [meses, modo]);

  const totalPesos = meses.reduce((s, m) => s + (parseFloat(m.peso) || 0), 0);
  const pesosOk    = Math.abs(totalPesos - 100) < 0.01;

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-5">

        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#0054A6]/10 flex items-center justify-center shrink-0">
            <Calculator className="h-4 w-4 text-[#0054A6]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Calculadora de ponderado</h2>
            <p className="text-sm text-gray-500">
              Calculá el ponderado trimestral de reductores con pesos configurables por mes.
            </p>
          </div>
        </div>

        {/* Modo */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Modo reductor:</span>
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
            {(["multiplicativo", "aditivo"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                  modo === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de entrada */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Período</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Peso (%)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deslogueo (%)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ausentismo (%)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rotación (%)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Factor</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m, i) => {
                const d = pct(m.deslogueo);
                const a = pct(m.ausentismo);
                const r = pct(m.rotacion);
                const factorFila = d !== null && a !== null && r !== null
                  ? modo === "multiplicativo"
                    ? (1 - d) * (1 - a) * (1 - r)
                    : 1 - (d + a + r)
                  : null;
                const isActual = i === meses.length - 1;

                return (
                  <tr key={i} className={cn(
                    "border-b border-gray-100",
                    isActual ? "bg-[#0054A6]/5" : "bg-white"
                  )}>
                    <td className="px-4 py-3">
                      <span className={cn("text-sm font-medium", isActual ? "text-[#0054A6]" : "text-gray-700")}>
                        {m.label}
                      </span>
                      {isActual && (
                        <span className="ml-2 text-[10px] bg-[#0054A6]/10 text-[#0054A6] rounded px-1.5 py-0.5 font-medium">
                          Más reciente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={m.peso}
                        onChange={(e) => update(i, "peso", e.target.value)}
                        className="w-16 h-7 px-2 rounded-lg bg-white border border-gray-300 text-xs text-gray-700 tabular-nums focus:outline-none focus:ring-1 focus:ring-[#0054A6] text-right"
                        placeholder="0"
                      />
                    </td>
                    {(["deslogueo", "ausentismo", "rotacion"] as const).map((campo) => (
                      <td key={campo} className="px-4 py-3">
                        <input
                          value={m[campo]}
                          onChange={(e) => update(i, campo, e.target.value)}
                          className="w-20 h-7 px-2 rounded-lg bg-white border border-gray-300 text-xs text-gray-700 tabular-nums focus:outline-none focus:ring-1 focus:ring-[#0054A6] text-right"
                          placeholder="0,00"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 tabular-nums text-xs">
                      {factorFila !== null
                        ? <span className={cn("font-semibold", factorFila >= 0.85 ? "text-emerald-600" : factorFila >= 0.75 ? "text-amber-600" : "text-red-600")}>
                            {(factorFila * 100).toFixed(2)}%
                          </span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Validación de pesos */}
        {!pesosOk && totalPesos > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Los pesos suman {totalPesos.toFixed(1)}%. Se recomienda que sumen 100%.
          </div>
        )}

        {/* Resultado */}
        {resultado ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <h3 className="text-sm font-semibold text-emerald-700 mb-4">Resultado ponderado</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <ResultCard label="Deslogueo pond."  value={fmtPct(resultado.wmDeslogueo)}  />
              <ResultCard label="Ausentismo pond." value={fmtPct(resultado.wmAusentismo)} />
              <ResultCard label="Rotación pond."   value={fmtPct(resultado.wmRotacion)}   />
              <ResultCard
                label={`Factor (${modo})`}
                value={fmtPct(resultado.factor)}
                color={resultado.factor >= 0.85 ? "text-emerald-600" : resultado.factor >= 0.75 ? "text-amber-600" : "text-red-600"}
                big
              />
            </div>

            <div className="text-xs text-gray-500 border-t border-emerald-200 pt-4">
              <span className="font-mono text-gray-600">
                {modo === "multiplicativo"
                  ? `Factor = (1 − ${fmtPct(resultado.wmDeslogueo)}) × (1 − ${fmtPct(resultado.wmAusentismo)}) × (1 − ${fmtPct(resultado.wmRotacion)}) = ${fmtPct(resultado.factor)}`
                  : `Factor = 1 − (${fmtPct(resultado.wmDeslogueo)} + ${fmtPct(resultado.wmAusentismo)} + ${fmtPct(resultado.wmRotacion)}) = ${fmtPct(resultado.factor)}`
                }
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-400">Completá los datos de los tres meses para ver el ponderado.</p>
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-gray-400">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Konecta usa por defecto pesos 25/35/40 (mes más antiguo al más reciente).
            El resultado es informativo — para aplicarlo, actualizá el archivo de reductores con estos valores.
          </span>
        </div>

      </motion.div>
    </div>
  );
}

function ResultCard({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div className="rounded-lg border border-white bg-white shadow-sm p-3">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("tabular-nums font-bold text-gray-900", big ? "text-2xl" : "text-lg", color)}>{value}</p>
    </div>
  );
}
