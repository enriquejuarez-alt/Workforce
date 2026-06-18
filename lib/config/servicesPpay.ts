import type { ServiceDefinition } from "./services";

export const SERVICIOS_PPAY: ServiceDefinition[] = [
  {
    key: "PPAY",
    label: "Personal Pay",
    hojaCP: "KON",
    segmentosNomina: [
      "Personal Pay",
      "PERSONAL PAY",
      "PPAY",
      "PAY GENERAL",
      "Pay General",
      "PAY DIGITAL",
      "Pay Digital",
      "CASHIN",
      "Cash In",
      "CASH IN",
      "PPAY CASHIN",
      "Pay Cash In",
      "WSP + MAIL",
      "WSP+MAIL",
      "WSP MAIL",
      "REDES",
      "PPAY WSP",
      "WSP",
      "Wsp Mail",
      "Wsp+Mail",
      "LOGUIN",
      "Login",
      "LOGIN",
      "PPAY LOGIN",
      "PPAY LOGUIN",
      "Pay Login",
    ],
    reductorNombres: [
      "PPAY",
      "Personal Pay",
      "PAY GENERAL",
      "Pay General",
      "CASHIN",
      "Cash In",
      "PPAY CASHIN",
      "WSP + MAIL",
      "WSP MAIL",
      "PPAY WSP",
      "WSP+MAIL",
      "LOGUIN",
      "Login",
      "PPAY LOGIN",
      "PPAY LOGUIN",
    ],
  },
];

export function normalizar(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolverServicioPpayPorSegmento(segmentoRaw: string): string | null {
  const norm = normalizar(segmentoRaw);
  for (const def of SERVICIOS_PPAY) {
    if (def.segmentosNomina.some((alias) => normalizar(alias) === norm)) {
      return def.key;
    }
  }
  return null;
}

export function resolverServicioPpayPorReductor(nombreReductor: string): string | null {
  const norm = normalizar(nombreReductor);
  for (const def of SERVICIOS_PPAY) {
    if (def.reductorNombres.some((alias) => normalizar(alias) === norm)) {
      return def.key;
    }
  }
  return null;
}
