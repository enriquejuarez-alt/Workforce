import { describe, expect, it } from "vitest";
import { aplicarDiasAlMes, construirVacacionesPorDni } from "./parseNomina";
import type { Agente } from "../domain/types";

function agente(overrides: Partial<Agente> = {}): Agente {
  return {
    dni: "30111222",
    nombre: "Test",
    usuario: "test",
    segmento: "X",
    segmentoNorm: "X",
    estado: "ACTIVO",
    hsSemanal: 35,
    hsMensualBrutas: 0,
    entryTime: null,
    exitTime: null,
    sitio: "",
    modalidad: "",
    jefe: "",
    superior: "",
    fechaInicioAtencion: null,
    esCapa: false,
    ...overrides,
  };
}

describe("construirVacacionesPorDni", () => {
  const mesInicio = new Date(2026, 7, 1);
  const mesFin = new Date(2026, 7, 31);

  it("suma los dias de vacaciones dentro del mes", () => {
    const mapa = construirVacacionesPorDni(
      [{ agente_dni: "30.111.222", fecha_desde: "2026-08-10", fecha_hasta: "2026-08-14" }],
      mesInicio,
      mesFin
    );
    expect(mapa.get("30111222")).toBe(5);
  });

  it("recorta el periodo si empieza antes o termina despues del mes", () => {
    const mapa = construirVacacionesPorDni(
      [{ agente_dni: "30111222", fecha_desde: "2026-07-28", fecha_hasta: "2026-08-03" }],
      mesInicio,
      mesFin
    );
    expect(mapa.get("30111222")).toBe(3); // 1, 2, 3 de agosto
  });

  it("ignora periodos que no se superponen con el mes", () => {
    const mapa = construirVacacionesPorDni(
      [{ agente_dni: "30111222", fecha_desde: "2026-06-01", fecha_hasta: "2026-06-10" }],
      mesInicio,
      mesFin
    );
    expect(mapa.has("30111222")).toBe(false);
  });

  it("acumula varios periodos del mismo DNI", () => {
    const mapa = construirVacacionesPorDni(
      [
        { agente_dni: "30111222", fecha_desde: "2026-08-01", fecha_hasta: "2026-08-02" },
        { agente_dni: "30111222", fecha_desde: "2026-08-20", fecha_hasta: "2026-08-21" },
      ],
      mesInicio,
      mesFin
    );
    expect(mapa.get("30111222")).toBe(4);
  });
});

describe("aplicarDiasAlMes con vacaciones", () => {
  it("sin vacaciones no cambia el calculo", () => {
    const [a] = aplicarDiasAlMes([agente()], 31);
    expect(a.hsMensualBrutas).toBeCloseTo(35 * (31 / 7), 5);
  });

  it("prorratea hsMensualBrutas restando los dias de vacaciones", () => {
    const vacaciones = new Map([["30111222", 10]]);
    const [a] = aplicarDiasAlMes([agente()], 31, vacaciones);
    const esperado = 35 * (31 / 7) * (1 - 10 / 31);
    expect(a.hsMensualBrutas).toBeCloseTo(esperado, 5);
  });

  it("combina vacaciones con el prorrateo de agentes CAPA", () => {
    const vacaciones = new Map([["30111222", 5]]);
    const fechaInicioAtencion = "2026-08-11";
    const capa = agente({ esCapa: true, fechaInicioAtencion });
    const [a] = aplicarDiasAlMes([capa], 31, vacaciones);
    const diaInicio = new Date(fechaInicioAtencion).getDate();
    const proporcionCapa = (31 - diaInicio + 1) / 31;
    const esperado = 35 * (31 / 7) * proporcionCapa * (1 - 5 / 31);
    expect(a.hsMensualBrutas).toBeCloseTo(esperado, 5);
  });

  it("no descuenta de mas si las vacaciones superan los dias del mes", () => {
    const vacaciones = new Map([["30111222", 40]]);
    const [a] = aplicarDiasAlMes([agente()], 31, vacaciones);
    expect(a.hsMensualBrutas).toBe(0);
  });
});
