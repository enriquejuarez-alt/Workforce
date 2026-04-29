"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FileBarChart2, TrendingDown } from "lucide-react";
import { useResultados } from "@/store/useResultados";
import { ContratosMixChart } from "@/components/charts/ContratosMixChart";
import { ReduccionRankingChart } from "@/components/charts/ReduccionRankingChart";

const fade = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } };

export default function AnalisisPage() {
  const router = useRouter();
  const { resultado, agentes } = useResultados();

  useEffect(() => {
    if (!resultado) router.replace("/");
  }, [resultado, router]);

  if (!resultado) return null;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <motion.div {...fade} className="space-y-8">

        {/* Header */}
        <div className="border-b border-gray-100 pb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">Análisis</h2>
          <p className="text-sm text-gray-500">{resultado.mes} · {resultado.diasDelMes} días</p>
        </div>

        {/* Sección 1: Contratos */}
        <section>
          <div className="flex items-start gap-3 mb-5">
            <div className="h-8 w-8 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 mt-0.5">
              <FileBarChart2 className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Distribución de contratos por servicio</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Mix de contratos 30 / 35 / 36 hs y su impacto en la disponibilidad real.
                Contratos 30/35 hs cubren 5/7 días; 36 hs cubre 6/7.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <ContratosMixChart agentes={agentes} />
          </div>
        </section>

        {/* Sección 2: Reductores */}
        <section>
          <div className="flex items-start gap-3 mb-5">
            <div className="h-8 w-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0 mt-0.5">
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Ranking de horas perdidas por reductor</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Horas brutas que se pierden por deslogueo, ausentismo y rotación en cada servicio, ordenadas de mayor a menor impacto.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <ReduccionRankingChart resultados={resultado.resultados} />
          </div>
        </section>

      </motion.div>
    </div>
  );
}
