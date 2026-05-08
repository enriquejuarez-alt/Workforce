import * as XLSX from "xlsx";
import type { Reductor } from "../domain/types";
import { normalizar } from "../domain/mapeo";

const HOJA_REQUERIDA = "RESUMEN PONDERADO";

export interface ParseReductoresResult {
  reductores: Reductor[];
  errores: string[];
}

export function parseReductores(buffer: ArrayBuffer): ParseReductoresResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array" }) as any;
  const errores: string[] = [];

  if (!wb.SheetNames.includes(HOJA_REQUERIDA)) {
    return {
      reductores: [],
      errores: [
        `Falta la hoja '${HOJA_REQUERIDA}' en el archivo de reductores`,
      ],
    };
  }

  const ws = wb.Sheets[HOJA_REQUERIDA];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (rows.length < 2) {
    return {
      reductores: [],
      errores: ["La hoja de reductores está vacía"],
    };
  }

  const encabezado = (rows[0] as string[]).map((c) =>
    normalizar(String(c ?? ""))
  );

  const idxServicio = encabezado.findIndex(
    (c) => c.includes("servicio") || c === "servicio"
  );
  const idxDeslogueo = encabezado.findIndex(
    (c) => c.includes("deslog") || c.includes("login")
  );
  const idxAusentismo = encabezado.findIndex(
    (c) => c.includes("ausent")
  );
  const idxRotacion = encabezado.findIndex(
    (c) => c.includes("rotac")
  );

  if (idxServicio < 0 || idxDeslogueo < 0 || idxAusentismo < 0 || idxRotacion < 0) {
    errores.push(
      `Columnas no encontradas en '${HOJA_REQUERIDA}'. ` +
        `Buscadas: Servicio, Deslogueo, Ausentismo, Rotacion. ` +
        `Encontradas: ${encabezado.join(", ")}`
    );
    return { reductores: [], errores };
  }

  const reductores: Reductor[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[idxServicio]) continue;
    const servicio = String(row[idxServicio]).trim();
    if (!servicio) continue;

    const deslogueo = parseFloat(String(row[idxDeslogueo] ?? "0")) || 0;
    const ausentismo = parseFloat(String(row[idxAusentismo] ?? "0")) || 0;
    const rotacion = parseFloat(String(row[idxRotacion] ?? "0")) || 0;

    reductores.push({
      servicio,
      servicioNorm: normalizar(servicio),
      deslogueo,
      ausentismo,
      rotacion,
    });
  }

  return { reductores, errores };
}

export function validarHojasReductores(sheetNames: string[]): string[] {
  return sheetNames.includes(HOJA_REQUERIDA)
    ? []
    : [`Falta la hoja '${HOJA_REQUERIDA}'`];
}
