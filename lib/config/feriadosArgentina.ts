/**
 * Calendario de feriados nacionales de Argentina, usado como red de seguridad
 * cuando el archivo CP no marca un feriado en su fila de día de semana (ver
 * `esDiaFeriado` en `lib/utils/excel.ts`).
 *
 * Cubre los feriados INAMOVIBLES (fecha fija todos los años) y los feriados
 * con fecha religiosa (Pascua, calculada con el algoritmo de Gauss) y los
 * "trasladables" (Ley 27.399: se mueven al lunes más cercano si no caen en
 * Lunes/Sábado/Domingo).
 *
 * OJO — esto NO reemplaza al decreto anual: los "días no laborables con fines
 * turísticos" (puentes) que el Gobierno agrega cada año no siguen ninguna
 * regla fija y no se pueden predecir acá. Si un CP tiene un puente sin marcar,
 * hay que corregirlo a mano en el archivo — este fallback solo cubre los
 * feriados que se repiten todos los años.
 */

function fechaUTC(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes - 1, dia));
}

// Algoritmo de Gauss para el Domingo de Pascua.
function domingoDePascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return fechaUTC(anio, mes, dia);
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 86_400_000);
}

// Ley 27.399: si cae martes o miércoles se traslada al lunes anterior; si cae
// jueves o viernes, al lunes siguiente. Si ya cae lunes (o fin de semana, que
// no es día laboral) no se traslada.
function feriadoTrasladable(anio: number, mes: number, dia: number): Date {
  const base = fechaUTC(anio, mes, dia);
  const diaSemana = base.getUTCDay(); // 0=domingo … 6=sabado
  if (diaSemana === 2 || diaSemana === 3) return sumarDias(base, -(diaSemana - 1));
  if (diaSemana === 4 || diaSemana === 5) return sumarDias(base, 8 - diaSemana);
  return base;
}

/** Devuelve el set de feriados nacionales (YYYY-MM-DD) para un año dado. */
export function obtenerFeriadosNacionales(anio: number): Set<string> {
  const fechas: Date[] = [
    fechaUTC(anio, 1, 1),   // Año Nuevo
    fechaUTC(anio, 3, 24),  // Día Nacional de la Memoria
    fechaUTC(anio, 4, 2),   // Día del Veterano y los Caídos en Malvinas
    fechaUTC(anio, 5, 1),   // Día del Trabajador
    fechaUTC(anio, 5, 25),  // Día de la Revolución de Mayo
    fechaUTC(anio, 6, 20),  // Paso a la Inmortalidad del Gral. Belgrano
    fechaUTC(anio, 7, 9),   // Día de la Independencia
    fechaUTC(anio, 12, 8),  // Inmaculada Concepción de María
    fechaUTC(anio, 12, 25), // Navidad
  ];

  const pascua = domingoDePascua(anio);
  fechas.push(sumarDias(pascua, -48)); // Lunes de Carnaval
  fechas.push(sumarDias(pascua, -47)); // Martes de Carnaval
  fechas.push(sumarDias(pascua, -2));  // Viernes Santo

  fechas.push(feriadoTrasladable(anio, 8, 17));  // Paso a la Inmortalidad del Gral. San Martín
  fechas.push(feriadoTrasladable(anio, 10, 12)); // Día del Respeto a la Diversidad Cultural
  fechas.push(feriadoTrasladable(anio, 11, 20)); // Día de la Soberanía Nacional

  return new Set(fechas.map((f) => f.toISOString().slice(0, 10)));
}

/** true si `fecha` cae en un feriado nacional argentino (fijo, religioso o trasladable). */
export function esFeriadoNacionalArgentina(fecha: Date): boolean {
  return obtenerFeriadosNacionales(fecha.getUTCFullYear()).has(fecha.toISOString().slice(0, 10));
}
