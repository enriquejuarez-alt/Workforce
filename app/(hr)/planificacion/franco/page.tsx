"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useResultados } from "@/store/useResultados";
import { useFrancoConfig } from "@/store/useFrancoConfig";
import { calcularFrancoPorServicio } from "@/lib/domain/francoEngine";
import { getServiciosKeys } from "@/lib/config/servicesRuntime";
import { FrancoGrid } from "@/components/tables/FrancoGrid";
import { SinDatos } from "@/components/SinDatos";
import { Info } from "lucide-react";
import Link from "next/link";

export default function FrancoPage() {
  const { agentes, matrices, resultado } = useResultados();
  const { reglas } = useFrancoConfig();

  const resultadosFranco = useMemo(() => {
    if (agentes.length === 0) return [];
    const servicios = getServiciosKeys();
    return calcularFrancoPorServicio(agentes, matrices, reglas, servicios);
  }, [agentes, matrices, reglas]);

  if (agentes.length === 0) {
    return <SinDatos />;
  }

  const mes = resultado?.mes ?? "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Planificación de francos</h1>
          {mes && (
            <p className="text-sm text-gray-500 mt-0.5 capitalize">{mes}</p>
          )}
        </div>
        <Link
          href="/configuracion"
          className="flex items-center gap-1.5 text-xs text-[#0054A6] hover:underline underline-offset-2"
        >
          <Info className="h-3.5 w-3.5" />
          Editar reglas de franco
        </Link>
      </div>

      {/* Info banner */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 flex gap-2">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          El HC disponible es <strong>esperado</strong>: asume distribución uniforme de francos dentro de cada ventana.
          El CP no incluye francos — esta vista muestra el gap real entre lo planificado y lo disponible por día.
        </span>
      </div>

      {/* Grid */}
      <FrancoGrid resultados={resultadosFranco} />
    </motion.div>
  );
}
