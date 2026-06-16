import type { ServiceDefinition } from "./services";

export const SERVICIOS_PPAY: ServiceDefinition[] = [
  {
    key: "PPAY-GENERAL",
    label: "Pay General",
    hojaCP: "PAY GENERAL",
    segmentosNomina: [
      "Personal Pay",
      "PERSONAL PAY",
      "PPAY",
      "PAY GENERAL",
      "Pay General",
      "PAY DIGITAL",
      "Pay Digital",
    ],
    reductorNombres: ["PPAY", "Personal Pay", "PAY GENERAL", "Pay General"],
  },
  {
    key: "PPAY-CASHIN",
    label: "Cash In",
    hojaCP: "CASHIN",
    segmentosNomina: [
      "CASHIN",
      "Cash In",
      "CASH IN",
      "PPAY CASHIN",
      "Pay Cash In",
    ],
    reductorNombres: ["CASHIN", "Cash In", "PPAY CASHIN"],
  },
  {
    key: "PPAY-WSP",
    label: "WSP + Mail",
    hojaCP: "WSP + MAIL",
    segmentosNomina: [
      "WSP + MAIL",
      "WSP+MAIL",
      "WSP MAIL",
      "REDES",
      "PPAY WSP",
      "WSP",
      "Wsp Mail",
      "Wsp+Mail",
    ],
    reductorNombres: ["WSP + MAIL", "WSP MAIL", "PPAY WSP", "WSP+MAIL"],
  },
  {
    key: "PPAY-LOGUIN",
    label: "Loguin",
    hojaCP: "LOGUIN",
    segmentosNomina: [
      "LOGUIN",
      "Login",
      "LOGIN",
      "PPAY LOGIN",
      "PPAY LOGUIN",
      "Pay Login",
    ],
    reductorNombres: ["LOGUIN", "Login", "PPAY LOGIN", "PPAY LOGUIN"],
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
