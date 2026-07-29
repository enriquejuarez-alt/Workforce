import { describe, expect, it } from "vitest";
import {
  calcularHsLogueoDiaADia,
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
});

function buildMatriz(totalDiarioPorDia: number[], anio: number, mes: number): MatrizServicio {
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
      esFeriado: false,
      indiceColumna: i,
    })),
  };
}

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
