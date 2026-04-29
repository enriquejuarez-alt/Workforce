"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useResultados } from "@/store/useResultados";
import { HeatmapGaps } from "@/components/charts/HeatmapGaps";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ServicioKey } from "@/lib/domain/types";
import { SERVICIOS_KEYS } from "@/lib/domain/types";

export default function HeatmapPage() {
  const router = useRouter();
  const { resultado, matrices, coverages } = useResultados();
  const [servicioActivo, setServicioActivo] = useState<ServicioKey>(SERVICIOS_KEYS[0]);

  useEffect(() => {
    if (!resultado) router.replace("/");
  }, [resultado, router]);

  if (!resultado) return null;

  const resultadoServicio = resultado.resultados.find((r) => r.servicio === servicioActivo);
  const matriz = matrices.get(servicioActivo);
  const coverage = coverages.get(servicioActivo);

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-zinc-100 mb-1">Heatmap de cobertura</h2>
          <p className="text-sm text-zinc-500">
            Personas disponibles vs. requeridas por franja horaria y día del mes
          </p>
        </div>

        <Tabs value={servicioActivo} onValueChange={(v) => setServicioActivo(v as ServicioKey)}>
          <TabsList className="flex-wrap h-auto gap-1 mb-6">
            {SERVICIOS_KEYS.map((k) => {
              const r = resultado.resultados.find((r) => r.servicio === k);
              return (
                <TabsTrigger key={k} value={k} className="text-xs">
                  {k}
                  {r && r.cumplimiento < 95 && (
                    <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 inline-block" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {SERVICIOS_KEYS.map((k) => (
            <TabsContent key={k} value={k}>
              {resultadoServicio && matriz ? (
                <HeatmapGaps
                  matriz={matriz}
                  coverage={coverage}
                  hcActivos={resultadoServicio.hcActivos}
                  hsSemanalPromedio={resultadoServicio.hsSemanalPromedio}
                />
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-500 text-sm">
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
