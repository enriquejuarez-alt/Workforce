"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useResultados } from "@/store/useResultados";
import { CurvaTemporalChart } from "@/components/charts/CurvaTemporalChart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ServicioKey } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { SinDatos } from "@/components/SinDatos";

export default function CurvasPage() {
  const { resultado, matrices } = useResultados();
  const serviciosDisponibles = resultado?.resultados.map((r) => r.servicio) ?? [];
  const [servicioActivo, setServicioActivo] = useState<ServicioKey | null>(null);

  if (!resultado) return <SinDatos />;

  const servicioEfectivo = (servicioActivo ?? serviciosDisponibles[0]) as ServicioKey;
  const resultadoServicio = resultado.resultados.find((r) => r.servicio === servicioEfectivo);
  const matriz = matrices.get(servicioEfectivo);

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
            Horas requeridas vs. disponibles día a día · usá los presets, los botones ‹ › o ingresá el rango manualmente
          </p>
        </div>

        <Tabs
          value={servicioEfectivo}
          onValueChange={(v) => setServicioActivo(v as ServicioKey)}
        >
          <TabsList className="flex-wrap h-auto gap-1 mb-6">
            {serviciosDisponibles.map((k) => (
              <TabsTrigger key={k} value={k} className="text-xs">
                {k}
              </TabsTrigger>
            ))}
          </TabsList>

          {serviciosDisponibles.map((k) => (
            <TabsContent key={k} value={k}>
              {resultadoServicio && matriz ? (
                <div className="space-y-4">
                  {/* KPIs */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Agentes activos</p>
                      <p className="text-2xl font-bold text-gray-900 tabular-nums">
                        {resultadoServicio.hcActivos}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Cumplimiento</p>
                      <p className={cn(
                        "text-2xl font-bold tabular-nums",
                        resultadoServicio.cumplimiento >= 100 ? "text-emerald-600" :
                        resultadoServicio.cumplimiento >= 90  ? "text-amber-600"   : "text-red-600"
                      )}>
                        {resultadoServicio.cumplimiento.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Diferencia mensual</p>
                      <p className={cn(
                        "text-2xl font-bold tabular-nums",
                        resultadoServicio.hsNetas >= matriz.totalMes ? "text-emerald-600" : "text-red-600"
                      )}>
                        {resultadoServicio.hsNetas - matriz.totalMes >= 0 ? "+" : ""}
                        {(resultadoServicio.hsNetas - matriz.totalMes).toFixed(0)} hs
                      </p>
                    </div>
                  </div>

                  {/* Curva temporal */}
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-0.5">
                      Curva temporal
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">
                      Usá los presets de días, los botones ‹ › para navegar, o escribí el rango exacto en los campos
                    </p>
                    <CurvaTemporalChart
                      matriz={matriz}
                      resultado={resultadoServicio}
                      diasDelMes={resultado.diasDelMes}
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
