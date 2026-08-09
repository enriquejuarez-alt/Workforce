import { describe, expect, it } from "vitest";
import {
  calcularHsLogueoDiaADia,
  calcularFrancoFeriados,
  derivarFrancoYPonderado,
  detectarDiasCerrados,
} from "./hsLogueoDiaADia";
import type { MatrizServicio } from "./types";

// Ejemplo real dado por el area de referencia (Individuos Abono Fijo, agosto 2026):
// nomina inicial 52, LP 8, rotacion 4.75%, ausentismo 3.00%, deslogueo 3.78%, ponderado 6.02hs.
describe("calcularHsLogueoDiaADia", () => {
  it("reproduce exacto el ejemplo del area para los dias 1, 2, 15, 30 y 31", () => {
    const francoPorDiaSemana = {
      lunes: 1.89 / 41.53,
      martes: 0,
      miercoles: 0,
      jueves: 0,
      viernes: 0,
      sabado: 18.97 / 43.92,
      domingo: 25.91 / 43.84,
    };

    const { dias, totalHsLogueo } = calcularHsLogueoDiaADia({
      nominaInicial: 52,
      diasDelMes: 31,
      anio: 2026,
      mes: 8,
      licenciaConstante: 8,
      rotacionMensual: 0.0475,
      ausentismoMensual: 0.03,
      deslogueoMensual: 0.0378,
      ponderadoHoras: 6.02,
      francoPorDiaSemana,
    });

    const esperado: Record<number, { nominaActiva: number; agentesFranco: number; hsLogueo: number }> = {
      1: { nominaActiva: 43.92, agentesFranco: 18.97, hsLogueo: 140.19 },
      2: { nominaActiva: 43.84, agentesFranco: 25.91, hsLogueo: 100.74 },
      15: { nominaActiva: 42.8, agentesFranco: 18.48, hsLogueo: 136.65 },
      30: { nominaActiva: 41.61, agentesFranco: 24.59, hsLogueo: 95.63 },
      31: { nominaActiva: 41.53, agentesFranco: 1.89, hsLogueo: 222.72 },
    };

    for (const [diaStr, exp] of Object.entries(esperado)) {
      const dia = dias[parseInt(diaStr) - 1];
      expect(dia.nominaActiva).toBeCloseTo(exp.nominaActiva, 1);
      expect(dia.agentesFranco).toBeCloseTo(exp.agentesFranco, 1);
      expect(dia.hsLogueo).toBeCloseTo(exp.hsLogueo, 1);
    }

    expect(totalHsLogueo).toBeGreaterThan(0);
  });

  it("sin franco ni rotacion, converge al equivalente del modelo plano (hsBrutas x factor)", () => {
    const { totalHsLogueo } = calcularHsLogueoDiaADia({
      nominaInicial: 20,
      diasDelMes: 28,
      anio: 2026,
      mes: 2,
      licenciaConstante: 0,
      rotacionMensual: 0,
      ausentismoMensual: 0.05,
      deslogueoMensual: 0.02,
      ponderadoHoras: 36 / 7,
      francoPorDiaSemana: { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0, sabado: 0, domingo: 0 },
    });

    // hsBrutas equivalente: 20 agentes * 36hs/semana * 28/7 semanas
    const hsBrutasPlano = 20 * 36 * (28 / 7);
    const hsNetasPlano = hsBrutasPlano * (1 - 0.05) * (1 - 0.02);
    expect(totalHsLogueo).toBeCloseTo(hsNetasPlano, 0);
  });

  it("un dia cerrado (franco 100%) no aporta horas ese dia", () => {
    const { dias } = calcularHsLogueoDiaADia({
      nominaInicial: 10,
      diasDelMes: 7,
      anio: 2026,
      mes: 8,
      licenciaConstante: 0,
      rotacionMensual: 0,
      ausentismoMensual: 0,
      deslogueoMensual: 0,
      ponderadoHoras: 6,
      francoPorDiaSemana: { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0, sabado: 1, domingo: 1 },
    });
    const cerrados = dias.filter((d) => d.diaSemana === "sabado" || d.diaSemana === "domingo");
    expect(cerrados.every((d) => d.hsLogueo === 0)).toBe(true);
  });

  it("con francoFeriadoPorDia y franco normal en 0, el feriado da directamente (1 - %hsRequeridasFeriado) de ausencia", () => {
    const { dias } = calcularHsLogueoDiaADia({
      nominaInicial: 10,
      diasDelMes: 7,
      anio: 2026,
      mes: 8,
      licenciaConstante: 0,
      rotacionMensual: 0,
      ausentismoMensual: 0,
      deslogueoMensual: 0,
      ponderadoHoras: 6,
      // Agosto 2026 dia 1 = sabado. Franco normal 0 todos los dias.
      francoPorDiaSemana: { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0, sabado: 0, domingo: 0 },
      francoFeriadoPorDia: new Map([[3, 0.5]]), // dia 3 (lunes) feriado, cliente pide 50% de lo habitual
    });
    // francoPct = 0 + (1-0)*(1-0.5) = 0.5
    expect(dias[2].agentesFranco).toBeCloseTo(5, 5); // 50% de 10
    expect(dias[2].hsLogueo).toBeCloseTo(30, 5); // 5 presentes * 6hs
    // El resto de los dias no se ve afectado
    expect(dias[0].agentesFranco).toBe(0);
    expect(dias[1].agentesFranco).toBe(0);
  });

  it("con franco normal > 0, el ajuste de feriado se SUMA sobre la gente que quedaria presente (no reemplaza el franco normal)", () => {
    const { dias } = calcularHsLogueoDiaADia({
      nominaInicial: 10,
      diasDelMes: 7,
      anio: 2026,
      mes: 8,
      licenciaConstante: 0,
      rotacionMensual: 0,
      ausentismoMensual: 0,
      deslogueoMensual: 0,
      ponderadoHoras: 6,
      // Dia 3 (lunes) tiene 20% de franco normal.
      francoPorDiaSemana: { lunes: 0.2, martes: 0, miercoles: 0, jueves: 0, viernes: 0, sabado: 0, domingo: 0 },
      francoFeriadoPorDia: new Map([[3, 0.5]]), // ese lunes es feriado, cliente pide 50% de lo habitual
    });
    // francoPct = 0.2 + (1-0.2)*(1-0.5) = 0.2 + 0.4 = 0.6 (NO 0.5)
    expect(dias[2].agentesFranco).toBeCloseTo(6, 5);
  });

  it("si el feriado pide el 100% de lo habitual, se comporta como un dia normal (sin ajuste extra)", () => {
    const { dias } = calcularHsLogueoDiaADia({
      nominaInicial: 10,
      diasDelMes: 7,
      anio: 2026,
      mes: 8,
      licenciaConstante: 0,
      rotacionMensual: 0,
      ausentismoMensual: 0,
      deslogueoMensual: 0,
      ponderadoHoras: 6,
      francoPorDiaSemana: { lunes: 0.2, martes: 0, miercoles: 0, jueves: 0, viernes: 0, sabado: 0, domingo: 0 },
      francoFeriadoPorDia: new Map([[3, 1]]),
    });
    expect(dias[2].agentesFranco).toBeCloseTo(2, 5); // igual que un lunes normal (20% de 10)
  });

  it("si el feriado es cierre total (pide 0%), todos los que quedaban presentes pasan a franco", () => {
    const { dias } = calcularHsLogueoDiaADia({
      nominaInicial: 10,
      diasDelMes: 7,
      anio: 2026,
      mes: 8,
      licenciaConstante: 0,
      rotacionMensual: 0,
      ausentismoMensual: 0,
      deslogueoMensual: 0,
      ponderadoHoras: 6,
      francoPorDiaSemana: { lunes: 0.2, martes: 0, miercoles: 0, jueves: 0, viernes: 0, sabado: 0, domingo: 0 },
      francoFeriadoPorDia: new Map([[3, 0]]),
    });
    expect(dias[2].agentesFranco).toBeCloseTo(10, 5); // 100% de franco
    expect(dias[2].hsLogueo).toBe(0);
  });

  // Caso real Soporte-Entretenimiento julio 2026: nomina 51, -5 el dia 8, -9 el
  // dia 16 (baja acumulada de 14 personas, la nomina se queda en 37 el resto del mes).
  it("eventosPorDia: un evento en un dia puntual desplaza la nomina desde ese dia en adelante", () => {
    const francoPorDiaSemana = { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0, sabado: 0, domingo: 0 };
    const { dias } = calcularHsLogueoDiaADia({
      nominaInicial: 51,
      diasDelMes: 31,
      anio: 2026,
      mes: 7,
      licenciaConstante: 2,
      rotacionMensual: 0,
      ausentismoMensual: 0,
      deslogueoMensual: 0,
      ponderadoHoras: 6,
      francoPorDiaSemana,
      eventosPorDia: new Map([[8, -5]]),
    });

    expect(dias[6].nominaBase).toBe(51); // dia 7, antes del evento
    expect(dias[7].nominaBase).toBe(46); // dia 8, el evento ya impacto
    expect(dias[30].nominaBase).toBe(46); // dia 31, se mantiene (evento es permanente)
    // nominaActiva = nominaBase - licencia (sin vacaciones/rotacion en este caso)
    expect(dias[7].nominaActiva).toBeCloseTo(44, 5);
  });

  it("eventosPorDia: dos eventos se acumulan (no se reemplazan)", () => {
    const francoPorDiaSemana = { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0, sabado: 0, domingo: 0 };
    const { dias } = calcularHsLogueoDiaADia({
      nominaInicial: 51,
      diasDelMes: 31,
      anio: 2026,
      mes: 7,
      licenciaConstante: 0,
      rotacionMensual: 0,
      ausentismoMensual: 0,
      deslogueoMensual: 0,
      ponderadoHoras: 6,
      francoPorDiaSemana,
      eventosPorDia: new Map([[8, -5], [16, -9]]),
    });

    expect(dias[7].nominaBase).toBe(46); // dia 8: 51-5
    expect(dias[14].nominaBase).toBe(46); // dia 15, antes del segundo evento
    expect(dias[15].nominaBase).toBe(37); // dia 16: 46-9
    expect(dias[30].nominaBase).toBe(37); // se mantiene el resto del mes
  });

  it("eventosPorDia: la rampa de rotacion sigue calculandose sobre la nomina inicial original, no sobre la nomina con eventos", () => {
    const francoPorDiaSemana = { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0, sabado: 0, domingo: 0 };
    const conEvento = calcularHsLogueoDiaADia({
      nominaInicial: 100,
      diasDelMes: 10,
      anio: 2026,
      mes: 1,
      licenciaConstante: 0,
      rotacionMensual: 0.1, // 10% del mes => 1%/dia sobre 100 = 1/dia
      ausentismoMensual: 0,
      deslogueoMensual: 0,
      ponderadoHoras: 1,
      francoPorDiaSemana,
      eventosPorDia: new Map([[5, -50]]),
    });
    // dia 5: nominaBase=50, bajasRotacion = (0.1/10)*5*100 = 5 (sobre nominaInicial=100, no sobre 50)
    expect(conEvento.dias[4].bajasRotacion).toBeCloseTo(5, 5);
    expect(conEvento.dias[4].nominaActiva).toBeCloseTo(45, 5); // 50 - 5
  });

  it("sin eventosPorDia, el comportamiento es identico al de antes (nominaBase = nominaInicial todo el mes)", () => {
    const { dias } = calcularHsLogueoDiaADia({
      nominaInicial: 30,
      diasDelMes: 5,
      anio: 2026,
      mes: 1,
      licenciaConstante: 0,
      rotacionMensual: 0,
      ausentismoMensual: 0,
      deslogueoMensual: 0,
      ponderadoHoras: 6,
      francoPorDiaSemana: { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0, sabado: 0, domingo: 0 },
    });
    expect(dias.every((d) => d.nominaBase === 30)).toBe(true);
  });
});

function buildMatriz(
  totalDiarioPorDia: number[],
  anio: number,
  mes: number,
  feriados: number[] = []
): MatrizServicio {
  return {
    servicio: "TEST",
    franjas: [],
    matriz: [],
    hcMatrix: [],
    totalMes: totalDiarioPorDia.reduce((a, b) => a + b, 0),
    totalDiario: totalDiarioPorDia,
    dias: totalDiarioPorDia.map((_, i) => ({
      fecha: new Date(Date.UTC(anio, mes - 1, i + 1)),
      diaSemana: "",
      esFeriado: feriados.includes(i + 1),
      indiceColumna: i,
    })),
  };
}

describe("calcularFrancoFeriados", () => {
  it("un feriado con la mitad del requerido habitual da %hsRequeridasFeriado = 0.5", () => {
    // Agosto 2026: dia 6 = jueves. Otros jueves (13, 20, 27) piden 200; el feriado (6) pide 100.
    const totalDiario = Array(31).fill(200);
    totalDiario[5] = 100; // dia 6 (indice 5), feriado
    const ratios = calcularFrancoFeriados(buildMatriz(totalDiario, 2026, 8, [6]));
    expect(ratios.get(6)).toBeCloseTo(0.5, 5);
  });

  it("un feriado con cierre total (requerido 0) da %hsRequeridasFeriado = 0", () => {
    const totalDiario = Array(31).fill(200);
    totalDiario[5] = 0;
    const ratios = calcularFrancoFeriados(buildMatriz(totalDiario, 2026, 8, [6]));
    expect(ratios.get(6)).toBe(0);
  });

  it("un feriado que pide lo mismo que un dia normal da %hsRequeridasFeriado = 1 (sin ajuste extra)", () => {
    const totalDiario = Array(31).fill(200);
    const ratios = calcularFrancoFeriados(buildMatriz(totalDiario, 2026, 8, [6]));
    expect(ratios.get(6)).toBeCloseTo(1, 5);
  });

  it("sin otros dias con el mismo dia de semana para comparar, no genera entrada", () => {
    // Un solo dia en la matriz, marcado feriado: no hay "dias similares" no-feriados.
    const ratios = calcularFrancoFeriados(buildMatriz([50], 2026, 8, [1]));
    expect(ratios.has(1)).toBe(false);
  });

  it("dias no feriados nunca generan entrada, sea cual sea su requerido", () => {
    const totalDiario = Array(31).fill(200);
    totalDiario[5] = 0; // dia 6 con requerido 0 pero NO marcado feriado
    const ratios = calcularFrancoFeriados(buildMatriz(totalDiario, 2026, 8, []));
    expect(ratios.size).toBe(0);
  });
});

describe("detectarDiasCerrados", () => {
  it("marca como cerrado un dia de la semana con requerido en 0 todo el mes (Integral Movil Amba: fin de semana)", () => {
    // Agosto 2026: dia 1 = sabado. 31 dias, fin de semana en 0, resto ~110.
    const totalDiario = Array.from({ length: 31 }, (_, i) => {
      const dow = new Date(Date.UTC(2026, 7, i + 1)).getUTCDay();
      return dow === 0 || dow === 6 ? 0 : 110;
    });
    const cerrados = detectarDiasCerrados(buildMatriz(totalDiario, 2026, 8));
    expect(cerrados.has("sabado")).toBe(true);
    expect(cerrados.has("domingo")).toBe(true);
    expect(cerrados.has("lunes")).toBe(false);
  });

  it("no marca cerrado un dia con demanda reducida pero no nula (feriado tipo Ventas IN)", () => {
    const totalDiario = Array.from({ length: 31 }, (_, i) => {
      const dow = new Date(Date.UTC(2026, 7, i + 1)).getUTCDay();
      if (dow === 0) return 0; // domingo cerrado
      if (i === 16) return 229; // feriado 17/8: demanda reducida, no nula
      return 435;
    });
    const cerrados = detectarDiasCerrados(buildMatriz(totalDiario, 2026, 8));
    expect(cerrados.has("domingo")).toBe(true);
    expect(cerrados.has("lunes")).toBe(false); // el feriado no alcanza para cerrar todos los lunes
  });

  it("sin datos de curva (todo en 0), no rompe y devuelve set vacio o todos cerrados segun corresponda", () => {
    const cerrados = detectarDiasCerrados(buildMatriz(Array(31).fill(0), 2026, 8));
    expect(cerrados.size).toBe(7);
  });
});

describe("derivarFrancoYPonderado", () => {
  it("sin dias cerrados, deriva ponderado de un contrato 36hs (6 dias/semana segun FRANCO_DEFAULTS)", () => {
    const { ponderadoHoras, francoPorDiaSemana } = derivarFrancoYPonderado(new Map([[36, 10]]));
    expect(ponderadoHoras).toBeCloseTo(6, 5);
    // El descanso semanal (1 dia) se reparte entre los 7 dias abiertos
    expect(francoPorDiaSemana.lunes).toBeGreaterThan(0);
  });

  it("con cierre de fin de semana que ya cubre el descanso contractual, no agrega franco entre semana", () => {
    const cerrados = new Set<"sabado" | "domingo">(["sabado", "domingo"]);
    const { francoPorDiaSemana, ponderadoHoras } = derivarFrancoYPonderado(new Map([[36, 15]]), cerrados as any);
    expect(francoPorDiaSemana.lunes).toBe(0);
    expect(francoPorDiaSemana.sabado).toBe(1);
    expect(francoPorDiaSemana.domingo).toBe(1);
    // 36hs / 5 dias abiertos (sin descanso adicional, el cierre ya cubre el descanso contractual)
    expect(ponderadoHoras).toBeCloseTo(36 / 5, 5);
  });
});
