import { describe, expect, it } from "vitest";
import { obtenerFeriadosNacionales, esFeriadoNacionalArgentina } from "./feriadosArgentina";

describe("obtenerFeriadosNacionales", () => {
  it("incluye los feriados de fecha fija", () => {
    const f = obtenerFeriadosNacionales(2026);
    expect(f.has("2026-01-01")).toBe(true); // Año Nuevo
    expect(f.has("2026-03-24")).toBe(true); // Día de la Memoria
    expect(f.has("2026-04-02")).toBe(true); // Malvinas
    expect(f.has("2026-05-01")).toBe(true); // Trabajador
    expect(f.has("2026-05-25")).toBe(true); // Revolución de Mayo
    expect(f.has("2026-06-20")).toBe(true); // Belgrano
    expect(f.has("2026-07-09")).toBe(true); // Independencia
    expect(f.has("2026-12-08")).toBe(true); // Inmaculada Concepción
    expect(f.has("2026-12-25")).toBe(true); // Navidad
  });

  it("calcula Viernes Santo y Carnaval a partir de la Pascua (2026: Pascua 5/4)", () => {
    const f = obtenerFeriadosNacionales(2026);
    expect(f.has("2026-04-03")).toBe(true); // Viernes Santo (2 dias antes del domingo 5/4)
    expect(f.has("2026-02-16")).toBe(true); // Lunes de Carnaval (48 dias antes)
    expect(f.has("2026-02-17")).toBe(true); // Martes de Carnaval (47 dias antes)
  });

  it("calcula Pascua correctamente para otro año conocido (2024: Pascua 31/3)", () => {
    const f = obtenerFeriadosNacionales(2024);
    expect(f.has("2024-03-29")).toBe(true); // Viernes Santo
  });

  it("traslada San Martin/Diversidad/Soberania al lunes si caen martes-viernes", () => {
    // 2026: 17/8 es lunes -> no se traslada. 12/10 es lunes -> no se traslada.
    // 20/11 es viernes -> se traslada al lunes siguiente 23/11.
    const f = obtenerFeriadosNacionales(2026);
    expect(f.has("2026-08-17")).toBe(true);
    expect(f.has("2026-10-12")).toBe(true);
    expect(f.has("2026-11-23")).toBe(true);
    expect(f.has("2026-11-20")).toBe(false);
  });

  it("no inventa 'puentes' declarados por decreto (ej. 10/7 no es feriado nacional fijo)", () => {
    const f = obtenerFeriadosNacionales(2026);
    expect(f.has("2026-07-10")).toBe(false);
  });
});

describe("esFeriadoNacionalArgentina", () => {
  it("reconoce el 9 de julio (Independencia) sin importar el año", () => {
    expect(esFeriadoNacionalArgentina(new Date(Date.UTC(2026, 6, 9)))).toBe(true);
    expect(esFeriadoNacionalArgentina(new Date(Date.UTC(2027, 6, 9)))).toBe(true);
  });

  it("un dia habil comun no es feriado", () => {
    expect(esFeriadoNacionalArgentina(new Date(Date.UTC(2026, 6, 8)))).toBe(false);
  });
});
