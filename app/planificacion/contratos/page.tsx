"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Save } from "lucide-react";
import { FrancoRulesEditor } from "@/components/config/FrancoRulesEditor";
import { useFrancoConfig } from "@/store/useFrancoConfig";
import { usePlaniConfig } from "@/store/usePlaniConfig";

export default function ContratosPage() {
  const router = useRouter();
  const serviciosNomina = usePlaniConfig((s) => s.serviciosNomina);
  const { selectedServicioKey, setSelectedServicioKey, reglasByServicio, reglas } = useFrancoConfig();
  const [saved, setSaved] = useState(false);

  const servicios = useMemo(
    () => serviciosNomina?.map((s) => ({ key: String(s.id), label: s.nombre })) ?? [],
    [serviciosNomina]
  );

  const activeReglas = selectedServicioKey
    ? (reglasByServicio[selectedServicioKey] ?? reglas)
    : reglas;

  const isCustomized = selectedServicioKey
    ? Boolean(reglasByServicio[selectedServicioKey])
    : false;

  const handleGuardar = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const handleVolverCarga = () => {
    router.push("/planificacion");
    if (window.parent !== window) {
      window.parent.postMessage({ type: "PLANI_PAGE_CHANGE", page: "carga" }, "*");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-6 max-w-5xl mx-auto space-y-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contratos y francos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configurá cómo se comporta cada contrato en la planificación: horas semanales,
          cantidad de francos y días posibles para tomarlos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleVolverCarga}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 shadow-sm transition-colors hover:border-[#0054A6]/30 hover:text-[#0054A6]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a carga
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0054A6] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#003D7C]"
          >
            {saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Guardado" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Servicio
          </label>
          <p className="mt-0.5 text-xs text-gray-400">
            Seleccioná un servicio para configurar sus contratos. Sin selección, editás los
            valores por defecto que aplican a todos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedServicioKey ?? ""}
            onChange={(e) => setSelectedServicioKey(e.target.value || null)}
            disabled={servicios.length === 0}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-[#0054A6] min-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {servicios.length === 0 ? "Sin servicios cargados" : "Valores por defecto"}
            </option>
            {servicios.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>

          {isCustomized && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#0054A6]">
              Personalizado
            </span>
          )}
        </div>
      </div>

      <FrancoRulesEditor activeReglas={activeReglas} />
    </motion.div>
  );
}
