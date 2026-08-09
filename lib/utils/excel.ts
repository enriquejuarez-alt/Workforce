// Helpers para conversión de tipos de SheetJS

import { esFeriadoNacionalArgentina } from "../config/feriadosArgentina";

const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30));

/**
 * Reconstruye un File desde un buffer ya leido, en vez de guardar el File
 * original (atado al disco/nube). Los flujos de carga leen el buffer una vez
 * para validar el archivo al soltarlo, pero lo guardan en el store para
 * volver a leerlo recien al Procesar — si el archivo original ya no esta
 * disponible para ese entonces (ej: OneDrive lo "deshidrato" a solo-nube),
 * ese segundo read tira NotReadableError. Un File armado desde el buffer
 * vive enteramente en memoria y no depende de que el archivo original siga
 * accesible.
 */
export function archivoEnMemoria(file: File, buffer: ArrayBuffer): File {
  return new File([buffer], file.name, { type: file.type, lastModified: file.lastModified });
}

export function serialToDate(serial: number): Date {
  const ms = serial * 24 * 60 * 60 * 1000;
  return new Date(EXCEL_EPOCH.getTime() + ms);
}

export function fraccionDiaAHHMM(fraccion: number): string {
  const totalMinutos = Math.round(fraccion * 24 * 60);
  const horas = Math.floor(totalMinutos / 60) % 24;
  const minutos = totalMinutos % 60;
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

export function generarFranjas(): string[] {
  const franjas: string[] = [];
  for (let i = 0; i < 48; i++) {
    const horas = Math.floor(i / 2);
    const minutos = i % 2 === 0 ? "00" : "30";
    franjas.push(`${String(horas).padStart(2, "0")}:${minutos}`);
  }
  return franjas;
}

export function normalizarNombreColumna(nombre: string): string {
  return nombre.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function extraerHorasContrato(contrato: string): number {
  const raw = String(contrato ?? "").trim().toLowerCase();
  if (!raw) return 36;

  const normalizado = raw
    .replace(",", ".")
    .replace("½", " 1/2")
    .replace(/\by\s+media\b/g, " 1/2")
    .replace(/\bmedia\b/g, "1/2");

  const mixto = normalizado.match(/(\d+(?:\.\d+)?)\s+(1\/2)/);
  if (mixto) return Number(mixto[1]) + 0.5;

  const decimal = normalizado.match(/(\d+(?:\.\d+)?)/);
  return decimal ? Number(decimal[1]) : 36;
}

export function esFeriado(diaSemana: string): boolean {
  return diaSemana.toLowerCase().includes("feriado");
}

/**
 * true si el CP marca el dia como feriado en su propio texto, O si la fecha
 * cae en un feriado nacional de Argentina (fallback para CPs que no marcan
 * el feriado — ver `lib/config/feriadosArgentina.ts` para el detalle y las
 * limitaciones: no cubre "dias no laborables" declarados por decreto).
 */
export function esDiaFeriado(diaSemana: string, fecha: Date): boolean {
  return esFeriado(diaSemana) || esFeriadoNacionalArgentina(fecha);
}

/** Convierte cualquier valor a número seguro; devuelve fallback si es NaN/null/undefined. */
export function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v ?? fallback);
  return isNaN(n) ? fallback : n;
}
