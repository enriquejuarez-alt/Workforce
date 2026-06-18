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
    () =>
      (serviciosNomina ?? [])
        .map((s) => ({ key: String(s.id), label: s.nombre }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
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
      className="min-h-full bg-gradient-to-b from-slate-50 to-white px-4 py-5 sm:px-6"
    >
      <div className="mx-auto max-w-4xl space-y-5">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Contratos y francos</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Configurá las horas semanales, francos y ventanas de días por contrato.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold text-white shadow-sm transition-all ${
                saved
                  ? "bg-emerald-500"
                  : "bg-[#0054A6] hover:bg-[#003D7C]"
              }`}
            >
              {saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {saved ? "Guardado" : "Guardar"}
            </button>
          </div>
        </div>

        {/* Service selector */}
        {servicios.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <div>
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Servicio</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {selectedServicioKey
                    ? `Editando: ${servicios.find((s) => s.key === selectedServicioKey)?.label ?? "—"}${isCustomized ? " · valores personalizados" : ""}`
                    : "Sin selección — editás los valores por defecto que aplican a todos"}
                </p>
              </div>
              {selectedServicioKey && (
                <button
                  onClick={() => setSelectedServicioKey(null)}
                  className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Ver defaults
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 p-3.5">
              <button
                onClick={() => setSelectedServicioKey(null)}
                className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all ${
                  !selectedServicioKey
                    ? "bg-[#0054A6] text-white border-[#0054A6] shadow-sm"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                }`}
              >
                Todos (default)
              </button>
              {servicios.map((s) => {
                const active = selectedServicioKey === s.key;
                const personalizado = Boolean(reglasByServicio[s.key]);
                return (
                  <button
                    key={s.key}
                    onClick={() => setSelectedServicioKey(s.key)}
                    className={`relative rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all ${
                      active
                        ? "bg-[#0054A6] text-white border-[#0054A6] shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-[#0054A6]/50 hover:bg-blue-50/40 hover:text-[#0054A6]"
                    }`}
                  >
                    {s.label}
                    {personalizado && !active && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <FrancoRulesEditor activeReglas={activeReglas} />
      </div>
    </motion.div>
  );
}
