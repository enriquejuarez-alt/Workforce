import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseFrancos } from "./parseFrancos";

function bufferDesdeHojas(hojas: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [nombre, filas] of Object.entries(hojas)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), nombre);
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe("parseFrancos - formato agregado (% Francos Julio + Detalle Contratos)", () => {
  it("cruza ambas hojas por servicio normalizado", () => {
    const encabezadoFrancos = ["Servicio", "Dia", "Francos", "%"];
    const bloqueServicio = (nombre: string, pct: number[]) => [
      [nombre, null, null, null],
      ["Lunes", null, null, pct[0]],
      ["Martes", null, null, pct[1]],
      ["Miercoles", null, null, pct[2]],
      ["Jueves", null, null, pct[3]],
      ["Viernes", null, null, pct[4]],
      ["Sabado", null, null, pct[5]],
      ["Domingo", null, null, pct[6]],
    ];

    const buffer = bufferDesdeHojas({
      "% Francos Julio": [
        encabezadoFrancos,
        ...bloqueServicio("Soporte-CBS", [0, 0, 0, 0, 0, 0.5, 0.5]),
      ],
      "Detalle Contratos": [
        ["Cuenta", "Servicios"],
        ["1", "Soporte-CBS", ...Array(17).fill(null), 20, 6, 5],
        ["Total general"],
      ],
    });

    const { servicios, errores } = parseFrancos(buffer);
    expect(errores).toEqual([]);
    expect(servicios).toHaveLength(1);
    expect(servicios[0]).toMatchObject({
      servicio: "Soporte-CBS",
      servicioNorm: "soporte-cbs",
      dotacion: 20,
      ponderadoHoras: 6,
      ponderadoDias: 5,
      francoSabado: 0.5,
      francoDomingo: 0.5,
    });
  });
});

describe("parseFrancos - formato roster por agente (Nombre/DNI/Gestion/Horas/Dias/Lunes..Domingo)", () => {
  const header = [
    "NOMBRE",
    "DNI",
    "GESTION",
    "HORAS",
    "DIAS",
    "LUNES",
    "MARTES",
    "MIERCOLES",
    "JUEVES",
    "VIERNES",
    "SABADO",
    "DOMINGO",
  ];

  it("agrega dotacion, horas/dias promedio y % de franco por dia, por servicio", () => {
    const buffer = bufferDesdeHojas({
      Hoja1: [
        header,
        // Soporte-CBS: 2 agentes, franco domingo para ambos, uno tambien sabado
        ["Agente Uno", 30111222, "Soporte-CBS", 6, 6, 0, 0, 0, 0, 0, 0, 1],
        ["Agente Dos", 30111223, "Soporte-CBS", 7.2, 5, 0, 0, 0, 0, 0, 1, 1],
        // Otro servicio: 1 agente, franco miercoles
        ["Agente Tres", 30111224, "SMB Conectividad", 6, 6, 0, 0, 1, 0, 0, 0, 0],
      ],
    });

    const { servicios, errores } = parseFrancos(buffer);
    expect(errores).toEqual([]);
    expect(servicios).toHaveLength(2);

    const cbs = servicios.find((s) => s.servicioNorm === "soporte-cbs")!;
    expect(cbs.dotacion).toBe(2);
    expect(cbs.ponderadoHoras).toBeCloseTo((6 + 7.2) / 2, 5);
    expect(cbs.ponderadoDias).toBeCloseTo((6 + 5) / 2, 5);
    expect(cbs.francoDomingo).toBe(1); // ambos de franco el domingo
    expect(cbs.francoSabado).toBeCloseTo(0.5, 5); // solo uno de dos
    expect(cbs.francoLunes).toBe(0);

    const smb = servicios.find((s) => s.servicioNorm === "smb conectividad")!;
    expect(smb.dotacion).toBe(1);
    expect(smb.francoMiercoles).toBe(1);
  });

  it("fusiona filas cuya GESTION solo difiere en mayusculas/acentos", () => {
    const buffer = bufferDesdeHojas({
      Hoja1: [
        header,
        ["A", 1, "Onboarding", 6, 6, 0, 0, 0, 0, 0, 0, 1],
        ["B", 2, "ONBOARDING", 6, 6, 0, 0, 0, 0, 0, 1, 0],
      ],
    });

    const { servicios } = parseFrancos(buffer);
    expect(servicios).toHaveLength(1);
    expect(servicios[0].dotacion).toBe(2);
  });

  it("ignora filas sin GESTION", () => {
    const buffer = bufferDesdeHojas({
      Hoja1: [header, ["Sin servicio", 1, "", 6, 6, 0, 0, 0, 0, 0, 0, 1]],
    });

    const { servicios } = parseFrancos(buffer);
    expect(servicios).toHaveLength(0);
  });
});

describe("parseFrancos - formato no reconocido", () => {
  it("devuelve un error si no matchea ninguno de los dos formatos soportados", () => {
    const buffer = bufferDesdeHojas({
      Hoja1: [["Col A", "Col B"], [1, 2]],
    });

    const { servicios, errores } = parseFrancos(buffer);
    expect(servicios).toEqual([]);
    expect(errores.length).toBeGreaterThan(0);
  });
});
