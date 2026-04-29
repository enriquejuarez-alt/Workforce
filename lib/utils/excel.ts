// Helpers para conversión de tipos de SheetJS

const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30));

export function serialToDate(serial: number): Date {
  const ms = (serial - 1) * 24 * 60 * 60 * 1000;
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
  const match = contrato?.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 36;
}

export function esFeriado(diaSemana: string): boolean {
  return diaSemana.toLowerCase().includes("feriado");
}

/** Convierte cualquier valor a número seguro; devuelve fallback si es NaN/null/undefined. */
export function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v ?? fallback);
  return isNaN(n) ? fallback : n;
}
