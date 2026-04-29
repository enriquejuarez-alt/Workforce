"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useResultados } from "@/store/useResultados";
import { ContratosMixChart } from "@/components/charts/ContratosMixChart";
import { ReduccionRankingChart } from "@/components/charts/ReduccionRankingChart";

export default function AnalisisPage() {
  const router = useRouter();
  const { resultado, agentes } = useResultados();

  useEffect(() => {
    if (!resultado) router.replace("/");
  }, [resultado, router]);

  if (!resultado) return null;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-8"
      >
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">Análisis</h2>
          <p className="text-sm text-gray-500">
            {resultado.mes} · {resultado.diasDelMes} días
          </p>
        </div>

        <section>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Distribución de contratos por servicio
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Mix de contratos 30/35/36 hs y su impacto en la disponibilidad real.
              Personas con 30/35 hs cubren 5/7 días; 36 hs cubre 6/7.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <ContratosMixChart agentes={agentes} />
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Ranking de horas perdidas por reductor
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Cuántas horas brutas se pierden por deslogueo, ausentismo y rotación
              en cada servicio. Ordenado de mayor a menor impacto.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <ReduccionRankingChart resultados={resultado.resultados} />
          </div>
        </section>
      </motion.div>
    </div>
  );
}
