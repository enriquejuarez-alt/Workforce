"use client";

import { motion } from "framer-motion";
import { FrancoRulesEditor } from "@/components/config/FrancoRulesEditor";

export default function ContratosPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-6 max-w-5xl mx-auto space-y-6"
    >
      <div>
        <h1 className="text-xl font-bold text-gray-900">Contratos y francos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configurá cómo se comporta cada contrato en la planificación: horas semanales,
          cantidad de francos y días posibles para tomarlos.
        </p>
      </div>

      <FrancoRulesEditor />
    </motion.div>
  );
}
