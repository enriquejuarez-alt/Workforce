"use client";

import { motion } from "framer-motion";
import { FrancoRulesEditor } from "@/components/config/FrancoRulesEditor";

export default function ConfiguracionPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-6 max-w-3xl mx-auto space-y-8"
    >
      <div>
        <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">
          Parámetros globales que afectan los cálculos de planificación.
        </p>
      </div>

      <FrancoRulesEditor />
    </motion.div>
  );
}
