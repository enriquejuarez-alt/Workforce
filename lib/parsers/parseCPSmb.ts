import * as XLSX from "xlsx";
import type { MatrizServicio, ServicioKey } from "../domain/types";
import { SERVICIOS_SMB } from "../config/servicesSmb";
import { normalizar } from "../config/services";
import {
  esDiaFeriado,
  generarFranjas,
  safeNum,
  serialToDate,
} from "../utils/excel";

export interface ParseCPSmbResult {
  matrices: Map<ServicioKey, MatrizServicio>;
  diasDelMes: number;
  mes: string;
  errores: string[];
}

interface SeccionSmb {
  nombre: string;
  filaHeader: number;
  filaInicio: number;
  totalHoras: number;
}

function detectarSecciones(raw: unknown[][], nombreHoja: string): SeccionSmb[] {
  const secciones: SeccionSmb[] = [];

  for (let fila = 1; fila < raw.length; fila++) {
    const row = raw[fila] as unknown[] | undefined;
    const labelRaw = row?.[1];
    const label = typeof labelRaw === "string" ? labelRaw.trim() : "";
    if (!label) continue;

    const siguiente = raw[fila + 1] as unknown[] | undefined;
    const primeraSiguiente = siguiente?.[0];
    const empiezaMatriz =
      typeof primeraSiguiente === "number" ||
      /^\d{1,2}:\d{2}/.test(String(primeraSiguiente ?? ""));

    if (!empiezaMatriz) continue;

    secciones.push({
      nombre: label || nombreHoja,
      filaHeader: fila,
      filaInicio: fila + 1,
      totalHoras: safeNum(row?.[0]),
    });
  }

  if (secciones.length === 0 && raw.length > 2) {
    secciones.push({
      nombre: nombreHoja,
      filaHeader: 1,
      filaInicio: 2,
      totalHoras: safeNum((raw[1] as unknown[] | undefined)?.[0]),
    });
  }

  return secciones;
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

export function parseCPSmb(buffer: ArrayBuffer): ParseCPSmbResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array", cellDates: false }) as any;
  const hojasPresentes = wb.SheetNames as string[];
  const errores: string[] = [];
  const matrices = new Map<ServicioKey, MatrizServicio>();
  let diasDelMes = 0;
  let mes = "";

  for (const servicioDef of SERVICIOS_SMB) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: true,
    });

    if (raw.length < 3) {
      errores.push(`Hoja '${nombreHoja}' tiene menos de 3 filas`);
      continue;
    }

    const filaDiaSemana = raw[0] as (string | number)[];
    const filaFechas = raw[1] as (string | number)[];
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

    const secciones = detectarSecciones(raw, nombreHoja).filter(
      (seccion) => seccion.totalHoras > 0 && !seccion.nombre.includes("+")
    );

    if (secciones.length === 0) {
      matrices.set(servicioDef.key, {
        servicio: servicioDef.key,
        franjas: generarFranjas(),
        dias,
        matriz: Array.from({ length: 48 }, () => Array(dias.length).fill(0)),
        hcMatrix: Array.from({ length: 48 }, () => Array(dias.length).fill(0)),
        totalDiario: Array(dias.length).fill(0),
        totalMes: 0,
      });
      continue;
    }

    const matriz: number[][] = Array.from({ length: 48 }, () =>
      Array(dias.length).fill(0)
    );

    for (const seccion of secciones) {
      for (let offset = 0; offset < 48; offset++) {
        const fila = seccion.filaInicio + offset;
        if (fila >= raw.length) break;
        for (let i = 0; i < columnasValidas.length; i++) {
          matriz[offset][i] += safeNum(raw[fila]?.[columnasValidas[i]]);
        }
      }
    }

    const totalDiario = Array(dias.length).fill(0);
    for (let dia = 0; dia < dias.length; dia++) {
      for (let fila = 0; fila < matriz.length; fila++) {
        totalDiario[dia] += matriz[fila][dia] * 0.5;
      }
    }

    const totalMes = totalDiario.reduce((sum, total) => sum + total, 0);

    matrices.set(servicioDef.key, {
      servicio: servicioDef.key,
      franjas: generarFranjas(),
      dias,
      matriz,
      hcMatrix: matriz,
      totalDiario,
      totalMes,
    });
  }

  return { matrices, diasDelMes, mes, errores };
}

export function validarHojasCPSmb(sheetNames: string[]): string[] {
  const errores: string[] = [];

  for (const servicio of SERVICIOS_SMB) {
    if (!resolverHoja(servicio.hojaCP, sheetNames)) {
      const aliases = Array.isArray(servicio.hojaCP)
        ? servicio.hojaCP
        : [servicio.hojaCP];
      errores.push(
        `Falta la hoja del servicio '${servicio.key}' (esperadas: ${aliases.join(", ")})`
      );
    }
  }

  if (!sheetNames.some((hoja) => normalizar(hoja) === normalizar("TOTAL HS"))) {
    errores.push("Falta la hoja 'TOTAL HS'");
  }

  return errores;
}

export function getSheetNamesSmb(buffer: ArrayBuffer): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array" }) as any;
  return wb.SheetNames as string[];
}
