import * as XLSX from "xlsx";
import type { MatrizServicio, ServicioKey } from "../domain/types";
import { SERVICIOS_ONB } from "../config/servicesOnb";
import { normalizar } from "../config/services";
import {
  esDiaFeriado,
  generarFranjas,
  safeNum,
  serialToDate,
} from "../utils/excel";

export interface ParseCPOnbResult {
  matrices: Map<ServicioKey, MatrizServicio>;
  diasDelMes: number;
  mes: string;
  errores: string[];
}

function resolverHoja(
  hojaCP: string | string[],
  hojasPresentes: string[]
): string | null {
  const aliases = Array.isArray(hojaCP) ? hojaCP : [hojaCP];
  return (
    aliases.find((alias) =>
      hojasPresentes.some((hoja) => normalizar(hoja) === normalizar(alias))
    ) ?? null
  );
}

function buscarFilaHoras(raw: unknown[][]): number {
  return raw.findIndex(
    (row) => normalizar(String((row as unknown[] | undefined)?.[0] ?? "")) === "horas"
  );
}

function buscarFilaFechas(raw: unknown[][]): number {
  return raw.findIndex((row) => {
    const values = row as unknown[] | undefined;
    if (!values) return false;
    const fechas = values.filter(
      (value) => typeof value === "number" && value > 40000
    );
    return fechas.length >= 25;
  });
}

export function parseCPOnb(buffer: ArrayBuffer): ParseCPOnbResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false }) as any;
  const hojasPresentes = wb.SheetNames as string[];
  const errores: string[] = [];
  const matrices = new Map<ServicioKey, MatrizServicio>();
  let diasDelMes = 0;
  let mes = "";

  for (const servicioDef of SERVICIOS_ONB) {
    const nombreHoja = resolverHoja(servicioDef.hojaCP, hojasPresentes);
    if (!nombreHoja) {
      const aliases = Array.isArray(servicioDef.hojaCP)
        ? servicioDef.hojaCP
        : [servicioDef.hojaCP];
      errores.push(
        `Falta la hoja del servicio '${servicioDef.key}' (esperadas: ${aliases.join(", ")})`
      );
      continue;
    }

    const ws = wb.Sheets[nombreHoja];
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: true,
    });

    if (raw.length < 51) {
      errores.push(`Hoja '${nombreHoja}' tiene menos de 51 filas`);
      continue;
    }

    const indiceFilaFechas = buscarFilaFechas(raw);
    if (indiceFilaFechas < 0) {
      errores.push(`Hoja '${nombreHoja}' no tiene fila de fechas valida`);
      continue;
    }

    const filaDiaSemana = raw[Math.max(0, indiceFilaFechas - 1)] as (string | number)[];
    const filaFechas = raw[indiceFilaFechas] as (string | number)[];
    const dias = [];
    const columnasValidas: number[] = [];

    for (let col = 1; col < filaFechas.length; col++) {
      const serial = filaFechas[col];
      if (!serial || typeof serial !== "number" || serial < 1) continue;
      const fecha = serialToDate(serial);
      if (isNaN(fecha.getTime())) continue;
      const diaSemanaRaw = String(filaDiaSemana[col] ?? "");
      dias.push({
        fecha,
        diaSemana: diaSemanaRaw,
        esFeriado: esDiaFeriado(diaSemanaRaw, fecha),
        indiceColumna: col,
      });
      columnasValidas.push(col);
    }

    if (dias.length === 0) {
      errores.push(`Hoja '${nombreHoja}' no tiene fechas validas`);
      continue;
    }

    if (dias.length > diasDelMes) diasDelMes = dias.length;
    mes = dias[0].fecha.toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    const matriz: number[][] = [];
    const filaInicioMatriz = indiceFilaFechas + 1;
    for (let fila = filaInicioMatriz; fila < filaInicioMatriz + 48; fila++) {
      matriz.push(columnasValidas.map((col) => safeNum(raw[fila]?.[col])));
    }

    const hcMatrix = matriz;
    const totalDiario = Array(dias.length).fill(0);
    const filaHoras = buscarFilaHoras(raw);
    if (filaHoras >= 0) {
      for (let i = 0; i < columnasValidas.length; i++) {
        totalDiario[i] = safeNum(raw[filaHoras]?.[columnasValidas[i]]);
      }
    } else {
      for (let dia = 0; dia < dias.length; dia++) {
        for (const fila of hcMatrix) {
          totalDiario[dia] += fila[dia] * 0.5;
        }
      }
    }

    const totalMes = totalDiario.reduce((sum, total) => sum + total, 0);

    matrices.set(servicioDef.key, {
      servicio: servicioDef.key,
      franjas: generarFranjas(),
      dias,
      matriz,
      hcMatrix,
      totalDiario,
      totalMes,
    });
  }

  return { matrices, diasDelMes, mes, errores };
}

export function validarHojasCPOnb(sheetNames: string[]): string[] {
  const errores: string[] = [];

  for (const servicio of SERVICIOS_ONB) {
    if (!resolverHoja(servicio.hojaCP, sheetNames)) {
      const aliases = Array.isArray(servicio.hojaCP)
        ? servicio.hojaCP
        : [servicio.hojaCP];
      errores.push(
        `Falta la hoja del servicio '${servicio.key}' (esperadas: ${aliases.join(", ")})`
      );
    }
  }

  if (!sheetNames.some((hoja) => normalizar(hoja) === normalizar("Resumen"))) {
    errores.push("Falta la hoja 'Resumen'");
  }

  return errores;
}

export function getSheetNamesOnb(buffer: ArrayBuffer): string[] {
  const wb = XLSX.read(buffer, { type: "array" }) as any;
  return wb.SheetNames as string[];
}
