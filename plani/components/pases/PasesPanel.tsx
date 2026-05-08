"use client";

import { useState } from "react";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { useResultados } from "@/store/useResultados";
import { SERVICIOS_KEYS } from "@/lib/domain/types";
import type { Pase, ServicioKey } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

let _id = 0;
function nextId() {
  return `pase-${Date.now()}-${_id++}`;
}

export function PasesPanel() {
  const { pases, addPase, removePase, agentes } = useResultados();

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [origen, setOrigen] = useState<ServicioKey>("Conectividad");
  const [destino, setDestino] = useState<ServicioKey>("Entretenimiento");
  const [tipo, setTipo] = useState<"temporal" | "definitivo">("temporal");
  const [error, setError] = useState("");

  const handleAdd = () => {
    setError("");
    if (!dni.trim() && !nombre.trim()) {
      setError("Ingresá DNI o nombre del agente.");
      return;
    }
    if (origen === destino) {
      setError("El servicio origen y destino deben ser distintos.");
      return;
    }
    addPase({ id: nextId(), nombre: nombre.trim(), dni: dni.trim(), servicioOrigen: origen, servicioDestino: destino, tipo });
    setNombre("");
    setDni("");
  };

  // Sugerencias de agentes para autocomplete
  const sugerencias = dni.length >= 3
    ? agentes.filter((a) => a.dni.includes(dni) || a.nombre.toLowerCase().includes(dni.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Tabla de pases</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Reasignar agentes entre servicios para el cálculo</p>
        </div>
        <span className="text-xs text-zinc-600">{pases.length} pase{pases.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Formulario */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-2 mb-3 items-end">
        <div className="relative">
          <label className="text-[11px] text-zinc-500 mb-1 block">DNI / Nombre</label>
          <input
            value={dni}
            onChange={(e) => { setDni(e.target.value); setNombre(""); }}
            placeholder="Buscar agente…"
            className="w-full h-8 px-2.5 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          {sugerencias.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 shadow-lg">
              {sugerencias.map((a) => (
                <button
                  key={a.dni}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                  onClick={() => { setDni(a.dni); setNombre(a.nombre); }}
                >
                  <span className="text-zinc-500 mr-2">{a.dni}</span>{a.nombre}
                  <span className="ml-2 text-zinc-600">({a.segmentoNorm})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[11px] text-zinc-500 mb-1 block">Nombre (opcional)</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del agente"
            className="w-full h-8 px-2.5 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div>
          <label className="text-[11px] text-zinc-500 mb-1 block">Origen</label>
          <select
            value={origen}
            onChange={(e) => setOrigen(e.target.value as ServicioKey)}
            className="h-8 px-2 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
          >
            {SERVICIOS_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-zinc-500 mb-1 block">Destino</label>
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value as ServicioKey)}
            className="h-8 px-2 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
          >
            {SERVICIOS_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-zinc-500 mb-1 block">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "temporal" | "definitivo")}
            className="h-8 px-2 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
          >
            <option value="temporal">Temporal</option>
            <option value="definitivo">Definitivo</option>
          </select>
        </div>

        <div className="flex items-end">
          <Button size="sm" onClick={handleAdd} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}

      {/* Lista de pases */}
      {pases.length > 0 && (
        <div className="space-y-1.5">
          {pases.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-zinc-200 truncate">{p.nombre || p.dni || "—"}</span>
                  {p.dni && p.nombre && <span className="text-zinc-600">{p.dni}</span>}
                  <span className={cn(
                    "rounded px-1.5 py-0.5 font-medium",
                    p.tipo === "definitivo" ? "bg-rose-500/15 text-rose-400" : "bg-amber-500/15 text-amber-400"
                  )}>
                    {p.tipo}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-zinc-500">
                  <span className="text-zinc-400">{p.servicioOrigen}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-emerald-400">{p.servicioDestino}</span>
                </div>
              </div>
              <button
                onClick={() => removePase(p.id)}
                className="shrink-0 text-zinc-600 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {pases.length === 0 && (
        <p className="text-xs text-zinc-600 text-center py-2">
          No hay pases configurados. Los agentes se procesan según su segmento en la nómina.
        </p>
      )}

      {pases.length > 0 && (
        <p className="text-[11px] text-amber-500/70 mt-3">
          Los pases se aplican al procesar los archivos. Volvé a procesar para ver el impacto.
        </p>
      )}
    </div>
  );
}
