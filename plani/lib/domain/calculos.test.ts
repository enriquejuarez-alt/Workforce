import { describe, expect, it } from "vitest";
import {
  calcularCumplimiento,
  calcularDeltaHC103,
  calcularFactorProductivo,
  calcularHsMensualBrutas,
} from "./calculos";
import { normalizar } from "./mapeo";

describe("calcularHsMensualBrutas", () => {
  it("calcula correctamente para 36hs en mes de 31 días", () => {
    const resultado = calcularHsMensualBrutas(36, 31);
    expect(resultado).toBeCloseTo(36 * (31 / 7), 5);
  });

  it("calcula correctamente para 30hs en mes de 28 días", () => {
    const resultado = calcularHsMensualBrutas(30, 28);
    expect(resultado).toBeCloseTo(30 * (28 / 7), 5);
  });
});

describe("calcularFactorProductivo - modo multiplicativo", () => {
  it("aplica reducción compuesta correctamente", () => {
    const factor = calcularFactorProductivo(0.02, 0.05, 0.01, "multiplicativo");
    expect(factor).toBeCloseTo((1 - 0.02) * (1 - 0.05) * (1 - 0.01), 6);
  });

  it("con cero reductores devuelve 1", () => {
    expect(calcularFactorProductivo(0, 0, 0, "multiplicativo")).toBe(1);
  });

  it("con reductores máximos devuelve cerca de 0", () => {
    const factor = calcularFactorProductivo(1, 0, 0, "multiplicativo");
    expect(factor).toBe(0);
  });
});

describe("calcularFactorProductivo - modo aditivo", () => {
  it("resta la suma de reductores", () => {
    const factor = calcularFactorProductivo(0.02, 0.05, 0.01, "aditivo");
    expect(factor).toBeCloseTo(1 - (0.02 + 0.05 + 0.01), 6);
  });

  it("multiplicativo da más que aditivo para reductores pequeños (sin interacción cruzada)", () => {
    // Para valores pequeños: multiplicativo = (1-d)(1-a)(1-r) > 1-(d+a+r) aditivo
    // porque el aditivo resta la suma directa sin descontar interacciones
    const d = 0.03;
    const a = 0.04;
    const r = 0.02;
    const mult = calcularFactorProductivo(d, a, r, "multiplicativo");
    const adit = calcularFactorProductivo(d, a, r, "aditivo");
    expect(mult).toBeGreaterThan(adit);
  });
});

describe("calcularCumplimiento", () => {
  it("100% cuando netas igual a requeridas", () => {
    expect(calcularCumplimiento(1000, 1000)).toBe(100);
  });

  it("50% cuando netas son la mitad", () => {
    expect(calcularCumplimiento(500, 1000)).toBe(50);
  });

  it("0 cuando requeridas es 0", () => {
    expect(calcularCumplimiento(500, 0)).toBe(0);
  });

  it("mayor a 100 cuando netas superan requeridas", () => {
    expect(calcularCumplimiento(1100, 1000)).toBeCloseTo(110, 5);
  });
});

describe("calcularDeltaHC103", () => {
  it("negativo cuando hay exceso de HC", () => {
    const delta = calcularDeltaHC103(200, 0.9, 36, 31, 5000);
    expect(delta).toBeLessThan(0);
  });

  it("positivo cuando falta HC", () => {
    const delta = calcularDeltaHC103(10, 0.9, 36, 31, 5000);
    expect(delta).toBeGreaterThan(0);
  });
});

describe("normalizar", () => {
  it("elimina espacios extremos y pasa a minúsculas", () => {
    expect(normalizar("  TECNICA  ")).toBe("tecnica");
  });

  it("colapsa espacios internos múltiples", () => {
    expect(normalizar("TECNICA  RRSS")).toBe("tecnica rrss");
  });

  it("maneja strings vacíos", () => {
    expect(normalizar("")).toBe("");
  });
});
