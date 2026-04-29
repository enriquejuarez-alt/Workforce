"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useResultados } from "@/store/useResultados";
import { CurvaFranjaChart } from "@/components/charts/CurvaFranjaChart";
import { CurvaTemporalChart, type Granularity } from "@/components/charts/CurvaTemporalChart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ServicioKey } from "@/lib/domain/types";
import { SERVICIOS_KEYS } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

const GRANULARIDADES: { key: Granularity; label: string }[] = [
  { key: "dias",    label: "Días" },
  { key: "semanas", label: "Semanas" },
  { key: "mes",     label: "Mes" },
];

export default function CurvasPage() {
  const router = useRouter();
  const { resultado, matrices } = useResultados();
  const [servicioActivo, setServicioActivo] = useState<ServicioKey>(SERVICIOS_KEYS[0]);
  const [granularity, setGranularity] = useState<Granularity>("dias");

  useEffect(() => {
    if (!resultado) router.replace("/");
  }, [resultado, router]);

  if (!resultado) return null;

  const resultadoServicio = resultado.resultados.find((r) => r.servicio === servicioActivo);
  const matriz = matrices.get(servicioActivo);

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">Curvas</h2>
          <p className="text-sm text-gray-500">
            Personas requeridas vs. disponibles por franja y por período
          </p>
        </div>

        <Tabs
          value={servicioActivo}
          onValueChange={(v) => setServicioActivo(v as ServicioKey)}
        >
          <TabsList className="flex-wrap h-auto gap-1 mb-6">
            {SERVICIOS_KEYS.map((k) => (
              <TabsTrigger key={k} value={k} className="text-xs">
                {k}
              </TabsTrigger>
            ))}
          </TabsList>

          {SERVICIOS_KEYS.map((k) => (
            <TabsContent key={k} value={k}>
              {resultadoServicio && matriz ? (
                <div className="space-y-5">
                  {/* KPIs mini */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Personas activas</p>
                      <p className="text-2xl font-bold text-gray-900 tabular-nums">
                        {resultadoServicio.hcActivos}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Cumplimiento</p>
                      <p className={cn(
                        "text-2xl font-bold tabular-nums",
                        resultadoServicio.cumplimiento >= 100 ? "text-emerald-600" :
                        resultadoServicio.cumplimiento >= 90 ? "text-amber-600" : "text-red-600"
                      )}>
                        {resultadoServicio.cumplimiento.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Curva por franja */}
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">
                      Curva por franja horaria
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">
                      Distribución uniforme por turno (aproximación)
                    </p>
                    <CurvaFranjaChart
                      matriz={matriz}
                      hcActivos={resultadoServicio.hcActivos}
                    />
                  </div>

                  {/* Curva temporal */}
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700">
                          Curva temporal
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {granularity === "dias" && "Vista día a día — puntos amarillos = feriados"}
                          {granularity === "semanas" && "Horas agrupadas por semana calendario"}
                          {granularity === "mes" && "Totales del mes completo"}
                        </p>
                      </div>

                      {/* Toggle granularidad */}
                      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
                        {GRANULARIDADES.map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => setGranularity(key)}
                            className={cn(
                              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                              granularity === key
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <CurvaTemporalChart
                      matriz={matriz}
                      resultado={resultadoServicio}
                      diasDelMes={resultado.diasDelMes}
                      granularity={granularity}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400 text-sm">
                  Sin datos para {k}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </motion.div>
    </div>
  );
}
