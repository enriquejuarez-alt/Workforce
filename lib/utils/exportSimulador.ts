import ExcelJS from "exceljs";
import type { ResultadoServicio } from "@/lib/domain/types";

// ── Palette ────────────────────────────────────────────────────────────────
const BLUE_HEADER  = "FF1F4E79";
const BLUE_LIGHT   = "FF2E75B6";
const RED_HEADER   = "FFC00000";
const RED_SOFT     = "FFFCE4D6";
const RED_MID      = "FFC00000";
const GREEN_HEADER = "FF375623";
const GREEN_SOFT   = "FFE2EFDA";
const VIOLET_DARK  = "FF5B2C6F";
const VIOLET_SOFT  = "FFF3E8FF";
const AMBER_DARK   = "FF7F6000";
const WHITE        = "FFFFFFFF";
const GRAY_ROW     = "FFF2F2F2";
const GRAY_DARK    = "FF595959";
const GRAY_SUB     = "FFFAFAFA";

type RGB = string;

function fill(argb: RGB): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function border(color = "FFD9D9D9"): Partial<ExcelJS.Borders> {
  const side = { style: "thin" as ExcelJS.BorderStyle, color: { argb: color } };
  return { top: side, bottom: side, left: side, right: side };
}

function headerFont(color = WHITE): Partial<ExcelJS.Font> {
  return { bold: true, color: { argb: color }, size: 10, name: "Calibri" };
}

function dataFont(color = "FF000000"): Partial<ExcelJS.Font> {
  return { size: 10, name: "Calibri", color: { argb: color } };
}

function pct(v: number) { return `${v.toFixed(1)}%`; }
function num(v: number) { return Math.round(v); }
function delta(v: number) { return v > 0 ? `+${Math.round(v)}` : String(Math.round(v)); }
function cumplColor(v: number): RGB { return v >= 103 ? GREEN_HEADER : v >= 90 ? AMBER_DARK : RED_MID; }

// ── Column layout para hoja Detalle ────────────────────────────────────────
const C = {
  SERVICIO:      1,
  HS_REQ:        2,
  HS_NETAS:      3,
  DIFERENCIA:    4,
  FALTANTE:      5,   // ← nuevo: horas de déficit
  AG_APROX:      6,
  SEP:           7,
  SIM_HS_NETAS:  8,
  SIM_DIFER:     9,
  SIM_FALTANTE: 10,   // ← nuevo
  SIM_AG:       11,
  CUMPL_ACTUAL: 12,
  CUMPL_SIM:    13,
  TOTAL_COLS:   13,
};

export async function exportarSimulacion(
  mes: string,
  base: ResultadoServicio[],
  sim: ResultadoServicio[] = base
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Planificador Konecta";
  wb.created = new Date();

  buildDetalleSheet(wb, mes, base, sim);
  buildBrechasSheet(wb, mes, base, sim);
  buildResumenSheet(wb, mes, base, sim);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planificador_${mes.replace(/ /g, "_")}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ── Hoja 1: Detalle con columna Hs Faltantes ──────────────────────────────
function buildDetalleSheet(
  wb: ExcelJS.Workbook,
  mes: string,
  base: ResultadoServicio[],
  sim: ResultadoServicio[]
) {
  const ws = wb.addWorksheet("Detalle", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  ws.getColumn(C.SERVICIO).width     = 26;
  ws.getColumn(C.HS_REQ).width       = 15;
  ws.getColumn(C.HS_NETAS).width     = 15;
  ws.getColumn(C.DIFERENCIA).width   = 13;
  ws.getColumn(C.FALTANTE).width     = 14;
  ws.getColumn(C.AG_APROX).width     = 11;
  ws.getColumn(C.SEP).width          = 2;
  ws.getColumn(C.SIM_HS_NETAS).width = 15;
  ws.getColumn(C.SIM_DIFER).width    = 13;
  ws.getColumn(C.SIM_FALTANTE).width = 14;
  ws.getColumn(C.SIM_AG).width       = 11;
  ws.getColumn(C.CUMPL_ACTUAL).width = 13;
  ws.getColumn(C.CUMPL_SIM).width    = 13;

  let row = 1;

  // Título
  ws.getRow(row).height = 22;
  const t = ws.getCell(row, 1);
  t.value = `PLANIFICADOR DE DOTACIÓN — ${mes.toUpperCase()}`;
  t.font  = { bold: true, size: 13, color: { argb: WHITE }, name: "Calibri" };
  t.fill  = fill(BLUE_HEADER);
  t.alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells(row, 1, row, C.TOTAL_COLS);
  row++;

  // Cabecera secciones
  ws.getRow(row).height = 13;
  const sec = (col: number, span: number, label: string, bg: RGB) => {
    const c = ws.getCell(row, col);
    c.value = label; c.font = headerFont(); c.fill = fill(bg);
    c.alignment = { horizontal: "center", vertical: "middle" };
    if (span > 1) ws.mergeCells(row, col, row, col + span - 1);
  };
  sec(1, 6, "ESTADO ACTUAL", BLUE_LIGHT);
  sec(8, 4, "ESCENARIO SIMULADO", GREEN_HEADER);
  sec(12, 1, "CUMPL. ACTUAL", GRAY_DARK);
  sec(13, 1, "CUMPL. SIMULADO", GRAY_DARK);
  row++;

  // Cabecera columnas
  ws.getRow(row).height = 16;
  const headers: [number, string, RGB][] = [
    [C.SERVICIO,      "Servicio",           BLUE_LIGHT],
    [C.HS_REQ,        "Hs Requeridas",      BLUE_LIGHT],
    [C.HS_NETAS,      "Hs Netas",           BLUE_LIGHT],
    [C.DIFERENCIA,    "Diferencia",         BLUE_LIGHT],
    [C.FALTANTE,      "Hs Faltantes ↓",     RED_MID],
    [C.AG_APROX,      "Ag. para 103%",      BLUE_LIGHT],
    [C.SIM_HS_NETAS,  "Hs Netas (sim)",     GREEN_HEADER],
    [C.SIM_DIFER,     "Diferencia",         GREEN_HEADER],
    [C.SIM_FALTANTE,  "Hs Faltantes ↓",    RED_MID],
    [C.SIM_AG,        "Ag. para 103%",      GREEN_HEADER],
    [C.CUMPL_ACTUAL,  "Cumpl. actual",      GRAY_DARK],
    [C.CUMPL_SIM,     "Cumpl. simulado",    GRAY_DARK],
  ];
  for (const [col, label, bg] of headers) {
    const c = ws.getCell(row, col);
    c.value = label; c.font = headerFont(); c.fill = fill(bg);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = border();
  }
  row++;

  // Filas por servicio
  base.forEach((b, idx) => {
    const s = sim[idx];
    const difBase    = b.hsNetas - b.hsRequeridas;
    const difSim     = s.hsNetas - b.hsRequeridas;
    const faltBase   = Math.max(0, b.hsRequeridas - b.hsNetas);
    const faltSim    = Math.max(0, b.hsRequeridas - s.hsNetas);
    const bg         = idx % 2 === 0 ? WHITE : GRAY_ROW;

    ws.getRow(row).height = 15;

    const setCel = (col: number, value: ExcelJS.CellValue, opts?: {
      bold?: boolean; color?: RGB; align?: ExcelJS.Alignment["horizontal"]; bgOverride?: RGB;
    }) => {
      const c = ws.getCell(row, col);
      c.value = value;
      c.font  = { ...dataFont(opts?.color ?? "FF000000"), bold: opts?.bold };
      c.fill  = fill(opts?.bgOverride ?? bg);
      c.alignment = { horizontal: opts?.align ?? "center", vertical: "middle" };
      c.border = border();
    };

    setCel(C.SERVICIO,     b.servicio,             { bold: true, align: "left", color: "FF1F4E79" });
    setCel(C.HS_REQ,       num(b.hsRequeridas));
    setCel(C.HS_NETAS,     num(b.hsNetas));
    setCel(C.DIFERENCIA,   num(difBase),            { color: difBase >= 0 ? GREEN_HEADER : RED_MID });
    setCel(C.FALTANTE,     faltBase > 0 ? num(faltBase) : "—",
      { color: faltBase > 0 ? WHITE : "FF888888", bold: faltBase > 0, bgOverride: faltBase > 0 ? (idx % 2 === 0 ? "FFFFF0F0" : "FFFDE0E0") : bg });
    setCel(C.AG_APROX,     Math.ceil(Math.max(b.deltaHC103, 0)),
      { color: b.deltaHC103 > 0 ? RED_MID : GREEN_HEADER });
    setCel(C.SIM_HS_NETAS, num(s.hsNetas));
    setCel(C.SIM_DIFER,    num(difSim),             { color: difSim >= 0 ? GREEN_HEADER : RED_MID });
    setCel(C.SIM_FALTANTE, faltSim > 0 ? num(faltSim) : "—",
      { color: faltSim > 0 ? WHITE : "FF888888", bold: faltSim > 0, bgOverride: faltSim > 0 ? (idx % 2 === 0 ? "FFFFF0F0" : "FFFDE0E0") : bg });
    setCel(C.SIM_AG,       Math.ceil(Math.max(s.deltaHC103, 0)),
      { color: s.deltaHC103 > 0 ? RED_MID : GREEN_HEADER });
    setCel(C.CUMPL_ACTUAL, pct(b.cumplimiento),     { color: cumplColor(b.cumplimiento), bold: true });
    setCel(C.CUMPL_SIM,    pct(s.cumplimiento),     { color: cumplColor(s.cumplimiento), bold: true });

    // Sub-fila meta 103%
    row++;
    ws.getRow(row).height = 11;
    const bgSub = idx % 2 === 0 ? GRAY_SUB : "FFF5F5F5";
    const req103     = b.hsRequeridas * 1.03;
    const dif103Base = b.hsNetas - req103;
    const dif103Sim  = s.hsNetas - req103;
    const falt103B   = Math.max(0, req103 - b.hsNetas);
    const falt103S   = Math.max(0, req103 - s.hsNetas);

    const setSub = (col: number, value: ExcelJS.CellValue, color = "FF999999") => {
      const c = ws.getCell(row, col);
      c.value = value;
      c.font  = { size: 8.5, name: "Calibri", italic: true, color: { argb: color } };
      c.fill  = fill(bgSub);
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = border("FFEEEEEE");
    };
    setSub(C.SERVICIO,     "→ Meta 103%",             "FFBBBBBB");
    setSub(C.HS_REQ,       num(req103));
    setSub(C.HS_NETAS,     num(b.hsNetas));
    setSub(C.DIFERENCIA,   num(dif103Base),            dif103Base >= 0 ? "FF375623" : RED_MID);
    setSub(C.FALTANTE,     falt103B > 0 ? num(falt103B) : "—", falt103B > 0 ? RED_MID : "FF999999");
    setSub(C.AG_APROX,     Math.ceil(Math.max(b.deltaHC103, 0)));
    setSub(C.SIM_HS_NETAS, num(s.hsNetas));
    setSub(C.SIM_DIFER,    num(dif103Sim),             dif103Sim >= 0 ? "FF375623" : RED_MID);
    setSub(C.SIM_FALTANTE, falt103S > 0 ? num(falt103S) : "—", falt103S > 0 ? RED_MID : "FF999999");
    setSub(C.SIM_AG,       Math.ceil(Math.max(s.deltaHC103, 0)));
    setSub(C.CUMPL_ACTUAL, "");
    setSub(C.CUMPL_SIM,    "");
    row++;
  });

  // UNIFICADO
  row++;
  const totalReq      = base.reduce((a, r) => a + r.hsRequeridas, 0);
  const totalNetas    = base.reduce((a, r) => a + r.hsNetas, 0);
  const totalNetasSim = sim.reduce((a, r) => a + r.hsNetas, 0);
  const totalFalt     = base.reduce((a, r) => a + r.faltante, 0);
  const totalFaltSim  = sim.reduce((a, r) => a + r.faltante, 0);
  const totalDif      = totalNetas - totalReq;
  const totalDifSim   = totalNetasSim - totalReq;
  const cumplBase     = (totalNetas / Math.max(totalReq, 1)) * 100;
  const cumplSim      = (totalNetasSim / Math.max(totalReq, 1)) * 100;
  const agBase        = base.reduce((a, r) => a + Math.ceil(Math.max(r.deltaHC103, 0)), 0);
  const agSim         = sim.reduce((a, r) => a + Math.ceil(Math.max(r.deltaHC103, 0)), 0);
  const uniBg         = totalDifSim >= 0 ? GREEN_HEADER : RED_HEADER;

  ws.getRow(row).height = 18;
  const setUni = (col: number, value: ExcelJS.CellValue) => {
    const c = ws.getCell(row, col);
    c.value = value;
    c.font  = headerFont();
    c.fill  = fill(uniBg);
    c.alignment = { horizontal: col === C.SERVICIO ? "left" : "center", vertical: "middle" };
    c.border = border();
  };
  setUni(C.SERVICIO,     "UNIFICADO");
  setUni(C.HS_REQ,       num(totalReq));
  setUni(C.HS_NETAS,     num(totalNetas));
  setUni(C.DIFERENCIA,   delta(totalDif));
  setUni(C.FALTANTE,     totalFalt > 0 ? num(totalFalt) : "—");
  setUni(C.AG_APROX,     agBase > 0 ? agBase : "✓");
  setUni(C.SIM_HS_NETAS, num(totalNetasSim));
  setUni(C.SIM_DIFER,    delta(totalDifSim));
  setUni(C.SIM_FALTANTE, totalFaltSim > 0 ? num(totalFaltSim) : "—");
  setUni(C.SIM_AG,       agSim > 0 ? agSim : "✓");
  setUni(C.CUMPL_ACTUAL, pct(cumplBase));
  setUni(C.CUMPL_SIM,    pct(cumplSim));

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 3, activeCell: "B4" }];
}

// ── Hoja 2: Brechas (déficit + facturación) ───────────────────────────────
function buildBrechasSheet(
  wb: ExcelJS.Workbook,
  mes: string,
  base: ResultadoServicio[],
  sim: ResultadoServicio[]
) {
  const ws = wb.addWorksheet("Brechas");
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 13;
  ws.getColumn(6).width = 16;
  ws.getColumn(7).width = 13;
  ws.getColumn(8).width = 13;

  let row = 1;

  const addBanner = (label: string, bg: RGB, span = 8) => {
    ws.getRow(row).height = 20;
    const c = ws.getCell(row, 1);
    c.value = label;
    c.font  = { bold: true, size: 12, color: { argb: WHITE }, name: "Calibri" };
    c.fill  = fill(bg);
    c.alignment = { horizontal: "left", vertical: "middle" };
    ws.mergeCells(row, 1, row, span);
    row++;
  };

  const addColHeaders = (headers: string[], bgs: RGB[]) => {
    ws.getRow(row).height = 14;
    headers.forEach((h, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = h; c.font = headerFont(); c.fill = fill(bgs[i] ?? GRAY_DARK);
      c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle", wrapText: true };
      c.border = border();
    });
    row++;
  };

  const addDataRow = (
    values: (string | number)[],
    colors: (RGB | null)[],
    fills: (RGB | null)[],
    isEven: boolean
  ) => {
    const bg = isEven ? WHITE : GRAY_ROW;
    ws.getRow(row).height = 14;
    values.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      c.font  = { size: 10, name: "Calibri", color: { argb: colors[i] ?? "FF000000" }, bold: fills[i] !== null && fills[i] !== bg };
      c.fill  = fill(fills[i] ?? bg);
      c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
      c.border = border();
    });
    row++;
  };

  const addTotalRow = (values: (string | number)[], bg: RGB) => {
    ws.getRow(row).height = 16;
    values.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v; c.font = headerFont(); c.fill = fill(bg);
      c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
      c.border = border();
    });
    row++;
  };

  // ── SECCIÓN 1: Déficit de horas ─────────────────────────────────────────
  addBanner(`DÉFICIT DE HORAS — ${mes.toUpperCase()}`, RED_HEADER);

  const enDeficit = [...base]
    .filter((b) => b.faltante > 0)
    .sort((a, b) => b.faltante - a.faltante);

  if (enDeficit.length === 0) {
    ws.getRow(row).height = 16;
    const c = ws.getCell(row, 1);
    c.value = "✓ Todos los servicios superan el 100% de las horas requeridas";
    c.font  = { bold: true, size: 11, color: { argb: GREEN_HEADER }, name: "Calibri" };
    c.fill  = fill(GREEN_SOFT);
    ws.mergeCells(row, 1, row, 8);
    row++;
  } else {
    addColHeaders(
      ["Servicio", "Hs Requeridas", "Hs Disponibles", "Hs Faltantes", "Cumplimiento", "Personas necesarias", "Ag. 36 hs", "Ag. 30 hs"],
      [RED_HEADER, RED_HEADER, RED_HEADER, "FFA00000", RED_HEADER, RED_HEADER, RED_HEADER, RED_HEADER]
    );

    enDeficit.forEach((b, i) => {
      const eq = b.agentesEquivalentes;
      addDataRow(
        [b.servicio, num(b.hsRequeridas), num(b.hsNetas), num(b.faltante), pct(b.cumplimiento), Math.ceil(eq.mix), Math.ceil(eq.hs36), Math.ceil(eq.hs30)],
        ["FF1F4E79", "FF000000", "FF000000", WHITE, WHITE, WHITE, "FF000000", "FF000000"],
        [null, null, null, RED_MID, RED_MID, RED_MID, RED_SOFT, RED_SOFT],
        i % 2 === 0
      );
    });

    const totalFalt = enDeficit.reduce((a, r) => a + r.faltante, 0);
    const totalReq  = enDeficit.reduce((a, r) => a + r.hsRequeridas, 0);
    const totalAg   = enDeficit.reduce((a, r) => a + Math.ceil(r.agentesEquivalentes.mix), 0);
    addTotalRow(
      [`TOTAL (${enDeficit.length} servicio${enDeficit.length !== 1 ? "s" : ""})`, num(totalReq), "—", num(totalFalt), "—", totalAg, "—", "—"],
      RED_HEADER
    );
  }

  row++; // espacio

  // ── SECCIÓN 2: Impacto en facturación ───────────────────────────────────
  addBanner("IMPACTO EN FACTURACIÓN", BLUE_HEADER, 7);

  const hasRecorte = base.some((b) => b.recorte > 0);

  addColHeaders(
    ["Servicio", "Hs Requeridas", "Tope (cap)", "Hs Netas", "Teórico Facturable", "Recorte", "Cumplimiento"],
    [BLUE_LIGHT, BLUE_LIGHT, BLUE_LIGHT, BLUE_LIGHT, GREEN_HEADER, VIOLET_DARK, GRAY_DARK]
  );

  const allServices = [...base].sort((a, b) => a.faltante - b.faltante || b.recorte - a.recorte);

  allServices.forEach((b, i) => {
    const tieneRecorte  = b.recorte > 0;
    const tieneFaltante = b.faltante > 0;
    addDataRow(
      [b.servicio, num(b.hsRequeridas), num(b.tope), num(b.hsNetas), num(b.teoricoFacturable), tieneRecorte ? num(b.recorte) : "—", pct(b.cumplimiento)],
      ["FF1F4E79", "FF000000", "FF555555", "FF000000", WHITE, tieneRecorte ? WHITE : "FF888888", cumplColor(b.cumplimiento)],
      [null, null, null, tieneFaltante ? RED_SOFT : null, GREEN_SOFT, tieneRecorte ? VIOLET_SOFT : null, null],
      i % 2 === 0
    );
  });

  const totReq     = base.reduce((a, r) => a + r.hsRequeridas, 0);
  const totTope    = base.reduce((a, r) => a + r.tope, 0);
  const totNetas   = base.reduce((a, r) => a + r.hsNetas, 0);
  const totFact    = base.reduce((a, r) => a + r.teoricoFacturable, 0);
  const totRecorte = base.reduce((a, r) => a + r.recorte, 0);
  const cumplTotal = (totNetas / Math.max(totReq, 1)) * 100;
  addTotalRow(
    ["TOTAL", num(totReq), num(totTope), num(totNetas), num(totFact), hasRecorte ? num(totRecorte) : "—", pct(cumplTotal)],
    cumplTotal >= 100 ? GREEN_HEADER : RED_HEADER
  );

  row++; // espacio

  // ── SECCIÓN 3: Alerta visual si hay déficit grave ────────────────────────
  const criticos = base.filter((b) => b.cumplimiento < 90);
  if (criticos.length > 0) {
    ws.getRow(row).height = 14;
    const alert = ws.getCell(row, 1);
    alert.value = `⚠ ${criticos.length} servicio${criticos.length !== 1 ? "s" : ""} con cumplimiento crítico (<90%): ${criticos.map((b) => b.servicio).join(", ")}`;
    alert.font  = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
    alert.fill  = fill("FFCC0000");
    alert.alignment = { horizontal: "left", vertical: "middle" };
    ws.mergeCells(row, 1, row, 8);
    row++;
  }

  // ── SECCIÓN 4: Comparación base vs simulado (si difieren) ───────────────
  const haySimulacion = base.some((b, i) => Math.abs(b.hsNetas - sim[i].hsNetas) > 1);
  if (haySimulacion) {
    row++;
    addBanner("COMPARACIÓN BASE vs SIMULADO — DÉFICIT", GREEN_HEADER, 6);
    addColHeaders(
      ["Servicio", "Faltante actual", "Faltante simulado", "Mejora (hs)", "Cumpl. actual", "Cumpl. simulado"],
      [GRAY_DARK, RED_HEADER, GREEN_HEADER, BLUE_LIGHT, GRAY_DARK, GRAY_DARK]
    );

    base.forEach((b, i) => {
      const s = sim[i];
      const mejora = b.faltante - s.faltante;
      const isEven = i % 2 === 0;
      addDataRow(
        [b.servicio, b.faltante > 0 ? num(b.faltante) : "—", s.faltante > 0 ? num(s.faltante) : "—", mejora > 0 ? `+${num(mejora)}` : mejora < 0 ? String(num(mejora)) : "—", pct(b.cumplimiento), pct(s.cumplimiento)],
        ["FF1F4E79", b.faltante > 0 ? WHITE : "FF888888", s.faltante > 0 ? WHITE : "FF888888", mejora > 0 ? GREEN_HEADER : mejora < 0 ? RED_MID : "FF888888", cumplColor(b.cumplimiento), cumplColor(s.cumplimiento)],
        [null, b.faltante > 0 ? RED_MID : null, s.faltante > 0 ? RED_MID : null, null, null, null],
        isEven
      );
    });
  }

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 0, activeCell: "A1" }];
}

// ── Hoja 3: Resumen ejecutivo ──────────────────────────────────────────────
function buildResumenSheet(
  wb: ExcelJS.Workbook,
  mes: string,
  base: ResultadoServicio[],
  sim: ResultadoServicio[]
) {
  const ws = wb.addWorksheet("Resumen");
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 14;

  let row = 1;

  ws.getRow(row).height = 18;
  const t = ws.getCell(row, 1);
  t.value = `RESUMEN EJECUTIVO — ${mes.toUpperCase()}`;
  t.font  = { bold: true, size: 12, color: { argb: WHITE }, name: "Calibri" };
  t.fill  = fill(BLUE_HEADER);
  t.alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells(row, 1, row, 6);
  row++;

  ws.getRow(row).height = 14;
  ["Servicio", "Hs Req.", "Faltantes", "Cumpl. actual", "Cumpl. sim.", "Δ pp"].forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h; c.font = headerFont(); c.fill = fill(BLUE_LIGHT);
    c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
    c.border = border();
  });
  row++;

  base.forEach((b, i) => {
    const s = sim[i];
    const diff = s.cumplimiento - b.cumplimiento;
    const bg   = i % 2 === 0 ? WHITE : GRAY_ROW;
    const faltBg = b.faltante > 0 ? (i % 2 === 0 ? "FFFFF0F0" : "FFFDE0E0") : bg;

    ws.getRow(row).height = 13;
    const vals: [number, ExcelJS.CellValue, RGB, RGB][] = [
      [1, b.servicio,                       "FF1F4E79", bg],
      [2, num(b.hsRequeridas),              "FF000000", bg],
      [3, b.faltante > 0 ? num(b.faltante) : "—", b.faltante > 0 ? RED_MID : "FF888888", faltBg],
      [4, pct(b.cumplimiento),              cumplColor(b.cumplimiento), bg],
      [5, pct(s.cumplimiento),              cumplColor(s.cumplimiento), bg],
      [6, `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}pp`, diff > 0 ? GREEN_HEADER : diff < 0 ? RED_MID : "FF888888", bg],
    ];
    vals.forEach(([col, value, color, bgCol]) => {
      const c = ws.getCell(row, col);
      c.value = value;
      c.font  = { size: 10, name: "Calibri", color: { argb: color }, bold: col === 3 && b.faltante > 0 };
      c.fill  = fill(bgCol);
      c.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle" };
      c.border = border();
    });
    row++;
  });

  const totReq   = base.reduce((a, r) => a + r.hsRequeridas, 0);
  const totFalt  = base.reduce((a, r) => a + r.faltante, 0);
  const cumplB   = (base.reduce((a, r) => a + r.hsNetas, 0) / Math.max(totReq, 1)) * 100;
  const cumplS   = (sim.reduce((a, r) => a + r.hsNetas, 0) / Math.max(totReq, 1)) * 100;
  const totDiff  = cumplS - cumplB;
  const totalBg  = cumplS >= 103 ? GREEN_HEADER : RED_HEADER;

  ws.getRow(row).height = 15;
  ["TOTAL", num(totReq), totFalt > 0 ? num(totFalt) : "—", pct(cumplB), pct(cumplS), `${totDiff >= 0 ? "+" : ""}${totDiff.toFixed(1)}pp`]
    .forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v; c.font = headerFont(); c.fill = fill(totalBg);
      c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
      c.border = border();
    });
}
