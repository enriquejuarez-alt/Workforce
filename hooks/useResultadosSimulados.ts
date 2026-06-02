"use client";

import { useMemo } from "react";
import { useResultados } from "@/store/useResultados";
import { useSimulador, type PeriodoReplan } from "@/store/useSimulador";
import { useUploads } from "@/store/useUploads";
import {
  calcularFactorProductivo,
  calcularCumplimiento,
  calcularDeltaHC103,
  calcularAgentesEquivalentes,
} from "@/lib/domain/calculos";
import type { ResultadoServicio, ServicioKey } from "@/lib/domain/types";

function calcularDiasEfectivos(
  periodoDesde: PeriodoReplan | null,
  periodoHasta: PeriodoReplan | null,
  mesActual: number,
  anioActual: number,
  diasDelMes: number
): number {
  if (!periodoDesde || !periodoHasta) return diasDelMes;

  const mesStart = new Date(anioActual, mesActual - 1, 1);
  const mesEnd   = new Date(anioActual, mesActual - 1, diasDelMes);
  const desde    = new Date(periodoDesde.anio, periodoDesde.mes - 1, periodoDesde.dia);
  const hasta    = new Date(periodoHasta.anio, periodoHasta.mes - 1, periodoHasta.dia);

  const efectivoInicio = desde < mesStart ? mesStart : desde;
  const efectivoFin    = hasta > mesEnd   ? mesEnd   : hasta;

  if (efectivoInicio > efectivoFin) return 0;

  return Math.round((efectivoFin.getTime() - efectivoInicio.getTime()) / 86_400_000) + 1;
}

export function useResultadosSimulados(): ResultadoServicio[] {
  const { resultado, diasDelMes, agentes } = useResultados();
  const { ajustes, modificaciones, periodoDesde, periodoHasta } = useSimulador();
  const { modoReductor } = useUploads();

  return useMemo(() => {
    if (!resultado) return [];

    const diasEfectivos = calcularDiasEfectivos(
      periodoDesde,
      periodoHasta,
      resultado.mesNum,
      resultado.anioNum,
      diasDelMes
    );

    const deltaHC      = new Map<ServicioKey, number>();
    const deltaHsTotal = new Map<ServicioKey, number>();
    const reducerOvr   = new Map<ServicioKey, { deslogueo?: number; ausentismo?: number; rotacion?: number }>();

    for (const mod of modificaciones) {
      const base = resultado.resultados.find((r) => r.servicio === mod.servicio);
      if (!base) continue;

      if (mod.tipo === "add_agents") {
        deltaHC.set(mod.servicio, (deltaHC.get(mod.servicio) ?? 0) + mod.cantidad);
        const hsExtra = mod.cantidad * (mod.hsSemanal ?? 36) * (diasEfectivos / 7);
        deltaHsTotal.set(mod.servicio, (deltaHsTotal.get(mod.servicio) ?? 0) + hsExtra);
      }

      if (mod.tipo === "remove_agents") {
        const hsPorAgente = (base.hsBrutas / Math.max(base.hcActivos, 1)) * (diasEfectivos / diasDelMes);
        deltaHC.set(mod.servicio, (deltaHC.get(mod.servicio) ?? 0) - mod.cantidad);
        deltaHsTotal.set(mod.servicio, (deltaHsTotal.get(mod.servicio) ?? 0) - mod.cantidad * hsPorAgente);
      }

      if (mod.tipo === "change_contract" && mod.hsSemanal) {
        const hsPorAgenteBase = base.hsBrutas / Math.max(base.hcActivos, 1);
        const hsSemanalBase   = hsPorAgenteBase / (diasDelMes / 7);
        const deltaHs = mod.cantidad * (mod.hsSemanal - hsSemanalBase) * (diasEfectivos / 7);
        deltaHsTotal.set(mod.servicio, (deltaHsTotal.get(mod.servicio) ?? 0) + deltaHs);
      }

      if (mod.tipo === "move_agents" && mod.servicioDestino) {
        const hsPorAgente = (base.hsBrutas / Math.max(base.hcActivos, 1)) * (diasEfectivos / diasDelMes);
        deltaHC.set(mod.servicio, (deltaHC.get(mod.servicio) ?? 0) - mod.cantidad);
        deltaHsTotal.set(mod.servicio, (deltaHsTotal.get(mod.servicio) ?? 0) - mod.cantidad * hsPorAgente);
        deltaHC.set(mod.servicioDestino, (deltaHC.get(mod.servicioDestino) ?? 0) + mod.cantidad);
        deltaHsTotal.set(mod.servicioDestino, (deltaHsTotal.get(mod.servicioDestino) ?? 0) + mod.cantidad * hsPorAgente);
      }

      if (mod.tipo === "move_named_agent" && mod.servicioDestino) {
        const agente = agentes.find((a) => a.dni === mod.agenteDni);
        const hsMensual = mod.hsMensualBrutas ?? agente?.hsMensualBrutas ?? (base.hsBrutas / Math.max(base.hcActivos, 1));
        const hsProrrateadas = hsMensual * (diasEfectivos / diasDelMes);
        deltaHC.set(mod.servicio, (deltaHC.get(mod.servicio) ?? 0) - 1);
        deltaHsTotal.set(mod.servicio, (deltaHsTotal.get(mod.servicio) ?? 0) - hsProrrateadas);
        deltaHC.set(mod.servicioDestino, (deltaHC.get(mod.servicioDestino) ?? 0) + 1);
        deltaHsTotal.set(mod.servicioDestino, (deltaHsTotal.get(mod.servicioDestino) ?? 0) + hsProrrateadas);
      }

      if (mod.tipo === "change_reducer") {
        reducerOvr.set(mod.servicio, {
          deslogueo:  mod.deslogueoOverride  ?? undefined,
          ausentismo: mod.ausentismoOverride ?? undefined,
          rotacion:   mod.rotacionOverride   ?? undefined,
        });
      }
    }

    return resultado.resultados.map((base) => {
      const ajuste = ajustes[base.servicio];
      const ov     = reducerOvr.get(base.servicio) ?? {};

      const deslogueo  = ov.deslogueo  !== undefined ? ov.deslogueo  : ajuste.deslogueoOverride  !== null ? ajuste.deslogueoOverride  : base.reductoRes.deslogueo;
      const ausentismo = ov.ausentismo !== undefined ? ov.ausentismo : ajuste.ausentismoOverride !== null ? ajuste.ausentismoOverride : base.reductoRes.ausentismo;
      const rotacion   = ov.rotacion   !== undefined ? ov.rotacion   : ajuste.rotacionOverride   !== null ? ajuste.rotacionOverride   : base.reductoRes.rotacion;

      const factorProductivo    = calcularFactorProductivo(deslogueo, ausentismo, rotacion, modoReductor);
      const hcExtraSimple       = ajuste.hcExtra;
      const hcExtraMods         = deltaHC.get(base.servicio) ?? 0;
      const hcExtra             = hcExtraSimple + hcExtraMods;

      const hsBrutasExtraSimple = hcExtraSimple > 0
        ? hcExtraSimple * ajuste.hsSemanalExtra * (diasEfectivos / 7)
        : hcExtraSimple * (base.hsBrutas / Math.max(base.hcActivos, 1)) * (diasEfectivos / diasDelMes);
      const hsBrutasExtraMods = deltaHsTotal.get(base.servicio) ?? 0;

      const hcActivos    = base.hcActivos + hcExtra;
      const hsBrutas     = base.hsBrutas + hsBrutasExtraSimple + hsBrutasExtraMods;
      const hsNetas      = hsBrutas * factorProductivo;
      const cumplimiento = calcularCumplimiento(hsNetas, base.hsRequeridas);

      // Recuperar hs/semana de los mods usando diasEfectivos (no diasDelMes) para mantener la tasa semanal
      const hsSemanalProm = hcActivos > 0
        ? ((base.hcActivos * base.hsSemanalPromedio) +
           (hcExtraSimple > 0 ? hcExtraSimple * ajuste.hsSemanalExtra : 0) +
           (diasEfectivos > 0 ? hsBrutasExtraMods / (diasEfectivos / 7) : 0)) / hcActivos
        : 36;

      const deltaHC103          = calcularDeltaHC103(hcActivos, factorProductivo, hsSemanalProm, diasDelMes, base.hsRequeridas);
      const agentesEquivalentes = calcularAgentesEquivalentes(deltaHC103, factorProductivo, diasDelMes, hsSemanalProm);
      const { tope }            = base;
      const teoricoFacturable   = Math.min(hsNetas, tope);
      const recorte             = Math.max(0, hsNetas - tope);
      const faltante            = Math.max(0, base.hsRequeridas - hsNetas);

      return { ...base, hcActivos, hsBrutas, factorProductivo, hsNetas, cumplimiento, deltaHC103, agentesEquivalentes, hsSemanalPromedio: hsSemanalProm, reductoRes: { deslogueo, ausentismo, rotacion }, tope, teoricoFacturable, recorte, faltante };
    });
  }, [resultado, ajustes, modificaciones, modoReductor, diasDelMes, periodoDesde, periodoHasta, agentes]);
}

export { calcularDiasEfectivos };
