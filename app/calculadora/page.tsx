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
  { label: "Mes actual", deslogueo: "", ausentismo: "", rotacion: "", peso: "40" },
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
      deslogueo: pct(m.deslogueo),
      ausentismo: pct(m.ausentismo),
      rotacion: pct(m.rotacion),
      peso: parseFloat(m.peso) || 0,
    }));

    const totalPeso = parsed.reduce((s, m) => s + m.peso, 0);
    if (totalPeso === 0) return null;
    if (parsed.some((m) => m.deslogueo === null || m.ausentismo === null || m.rotacion === null)) return null;

    const wmDeslogueo = parsed.reduce((s, m) => s + (m.deslogueo! * m.peso), 0) / totalPeso;
    const wmAusentismo = parsed.reduce((s, m) => s + (m.ausentismo! * m.peso), 0) / totalPeso;
    const wmRotacion = parsed.reduce((s, m) => s + (m.rotacion! * m.peso), 0) / totalPeso;

    const factorMult = (1 - wmDeslogueo) * (1 - wmAusentismo) * (1 - wmRotacion);
    const factorAdit = 1 - (wmDeslogueo + wmAusentismo + wmRotacion);
    const factor = modo === "multiplicativo" ? factorMult : factorAdit;

    return { wmDeslogueo, wmAusentismo, wmRotacion, factor, factorMult, factorAdit, totalPeso };
  }, [meses, modo]);

  const totalPesos = meses.reduce((s, m) => s + (parseFloat(m.peso) || 0), 0);
  const pesosOk = Math.abs(totalPesos - 100) < 0.01;

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Calculator className="h-4 w-4 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-100">Calculadora de ponderado</h2>
          </div>
          <p className="text-sm text-zinc-500">
            Calculá el ponderado trimestral de reductores usando pesos configurables por mes.
            El resultado puede usarse como referencia para el archivo de reductores.
          </p>
        </div>

        {/* Modo */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs text-zinc-500">Modo reductor:</span>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
            {(["multiplicativo", "aditivo"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                  modo === m ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de entrada */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Período</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Peso (%)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Deslogueo (%)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Ausentismo (%)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Rotación (%)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Factor</th>
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
                    "border-b border-zinc-800/50",
                    isActual ? "bg-emerald-500/5" : "bg-transparent"
                  )}>
                    <td className="px-4 py-3">
                      <span className={cn("text-sm font-medium", isActual ? "text-emerald-300" : "text-zinc-300")}>
                        {m.label}
                      </span>
                      {isActual && <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5">Más reciente</span>}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={m.peso}
                        onChange={(e) => update(i, "peso", e.target.value)}
                        className="w-16 h-7 px-2 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 tabular-nums focus:outline-none focus:border-zinc-500 text-right"
                        placeholder="0"
                      />
                    </td>
                    {(["deslogueo", "ausentismo", "rotacion"] as const).map((campo) => (
                      <td key={campo} className="px-4 py-3">
                        <input
                          value={m[campo]}
                          onChange={(e) => update(i, campo, e.target.value)}
                          className="w-20 h-7 px-2 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 tabular-nums focus:outline-none focus:border-zinc-500 text-right"
                          placeholder="0,00"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 tabular-nums text-xs">
                      {factorFila !== null
                        ? <span className={cn(factorFila >= 0.85 ? "text-emerald-400" : factorFila >= 0.75 ? "text-amber-400" : "text-rose-400")}>
                            {(factorFila * 100).toFixed(2)}%
                          </span>
                        : <span className="text-zinc-600">—</span>
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
          <div className="mb-4 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Los pesos suman {totalPesos.toFixed(1)}%. Se recomienda que sumen 100%.
          </div>
        )}

        {/* Resultado */}
        {resultado ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
            <h3 className="text-sm font-semibold text-emerald-300 mb-4">Resultado ponderado</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <ResultCard label="Deslogueo pond." value={fmtPct(resultado.wmDeslogueo)} color="text-zinc-200" />
              <ResultCard label="Ausentismo pond." value={fmtPct(resultado.wmAusentismo)} color="text-zinc-200" />
              <ResultCard label="Rotación pond." value={fmtPct(resultado.wmRotacion)} color="text-zinc-200" />
              <ResultCard
                label={`Factor (${modo})`}
                value={fmtPct(resultado.factor)}
                color={resultado.factor >= 0.85 ? "text-emerald-400" : resultado.factor >= 0.75 ? "text-amber-400" : "text-rose-400"}
                big
              />
            </div>

            {modo === "multiplicativo" && (
              <div className="text-xs text-zinc-500 border-t border-zinc-800 pt-4">
                <span className="text-zinc-400 font-mono">
                  Factor = (1 − {fmtPct(resultado.wmDeslogueo)}) × (1 − {fmtPct(resultado.wmAusentismo)}) × (1 − {fmtPct(resultado.wmRotacion)}) = {fmtPct(resultado.factor)}
                </span>
              </div>
            )}
            {modo === "aditivo" && (
              <div className="text-xs text-zinc-500 border-t border-zinc-800 pt-4">
                <span className="text-zinc-400 font-mono">
                  Factor = 1 − ({fmtPct(resultado.wmDeslogueo)} + {fmtPct(resultado.wmAusentismo)} + {fmtPct(resultado.wmRotacion)}) = {fmtPct(resultado.factor)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
            <p className="text-sm text-zinc-500">Completá los datos de los tres meses para ver el ponderado.</p>
          </div>
        )}

        <div className="mt-6 flex items-start gap-2 text-xs text-zinc-600">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Konecta usa por defecto pesos 25/35/40 (mes más antiguo al más reciente).
            El resultado es informativo — para aplicarlo al cálculo, actualizá el archivo de reductores con estos valores.
          </span>
        </div>

      </motion.div>
    </div>
  );
}

function ResultCard({ label, value, color, big }: { label: string; value: string; color: string; big?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("tabular-nums font-bold", big ? "text-2xl" : "text-lg", color)}>{value}</p>
    </div>
  );
}
