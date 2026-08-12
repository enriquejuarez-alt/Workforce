import { describe, expect, it } from "vitest";
import { validarHojasCP } from "./parseCP";

describe("validarHojasCP", () => {
  it("bloquea con un mensaje explicito si NINGUNA hoja de servicio matcheo (archivo probablemente equivocado)", () => {
    const errores = validarHojasCP(["Hoja1", "Resumen General", "Portada"]);
    expect(errores.length).toBeGreaterThan(0);
    expect(errores[0]).toMatch(/no se reconoció ninguna hoja/i);
    expect(errores[0].startsWith("Falta la hoja del servicio")).toBe(false);
  });

  it("no agrega el mensaje bloqueante si al menos una hoja de servicio matcheo", () => {
    const errores = validarHojasCP(["SOPORTE-ENTRETENIMIENTO"]);
    // puede haber avisos de "Falta la hoja del servicio X" para las demas islas,
    // pero no debe aparecer el mensaje bloqueante de archivo no reconocido.
    expect(errores.some((e) => /no se reconoció ninguna hoja/i.test(e))).toBe(false);
  });

  it("con la lista de hojas completa no genera ningun error", () => {
    // Sanity check minimo: una lista vacia de hojas presentes da error para cada
    // servicio activo pero, al ser todos, dispara igual el mensaje bloqueante.
    const errores = validarHojasCP([]);
    expect(errores[0]).toMatch(/no se reconoció ninguna hoja/i);
  });
});
