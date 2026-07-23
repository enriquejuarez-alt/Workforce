import type { MatrizServicio, ServicioKey } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MatrizServicioRaw = Omit<MatrizServicio, "dias"> & { dias: any[] };

/** Convierte el Map de matrices a una estructura 100% JSON-serializable (Map -> entries, Date -> ISO). */
export function serializarMatrices(
  matrices: Map<ServicioKey, MatrizServicio>
): [ServicioKey, MatrizServicioRaw][] {
  return Array.from(matrices.entries()).map(([key, matriz]) => [
    key,
    {
      ...matriz,
      dias: matriz.dias.map((d) => ({ ...d, fecha: d.fecha.toISOString() })),
    },
  ]);
}

/** Inversa de serializarMatrices: reconstruye el Map con Date reales en dias[].fecha. */
export function deserializarMatrices(
  raw: [string, MatrizServicioRaw][]
): Map<ServicioKey, MatrizServicio> {
  return new Map(
    raw.map(([key, matriz]) => [
      key,
      {
        ...matriz,
        dias: matriz.dias.map((d) => ({ ...d, fecha: new Date(d.fecha) })),
      } as MatrizServicio,
    ])
  );
}
