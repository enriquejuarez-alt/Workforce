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
const ORANGE_DARK  = "FFE36A00";
const ORANGE_SOFT  = "FFFFF3E0";
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

// ── Column layout: Estado Actual ────────────────────────────────────────────
const CA = {
  SERVICIO:   1,
  HS_REQ:     2,
  HS_NETAS:   3,
  DIFERENCIA: 4,
  FALTANTE:   5,
  AG_APROX:   6,
  SEP:        7,
  DESLOGUEO:  8,
  AUSENTISMO: 9,
  ROTACION:  10,
  CUMPL:     11,
  TOTAL:     11,
};

// ── Column layout: Simulado ─────────────────────────────────────────────────
const CS = {
  SERVICIO:     1,
  HS_REQ:       2,
  HS_NETAS_ACT: 3,
  HS_NETAS_SIM: 4,
  DIFER_SIM:    5,
  FALT_SIM:     6,
  AG_SIM:       7,
  CUMPL_ACT:    8,
  CUMPL_SIM:    9,
  DELTA_PP:    10,
  TOTAL:       10,
};

export async function exportarSimulacion(
  mes: string,
  base: ResultadoServicio[],
  sim: ResultadoServicio[] = base
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Planificador Konecta";
  wb.created = new Date();

  buildEstadoActualSheet(wb, mes, base);
  buildSimuladoSheet(wb, mes, base, sim);
  buildBrechasSheet(wb, mes, base, sim);
  buildResumenSheet(wb, mes, base, sim);
  buildReductoresSheet(wb, mes, base);

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

// ── Hoja 1: Estado Actual + Reductores ────────────────────────────────────
function buildEstadoActualSheet(
  wb: ExcelJS.Workbook,
  mes: string,
  base: ResultadoServicio[]
) {
  const ws = wb.addWorksheet("Estado Actual", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  ws.getColumn(CA.SERVICIO).width   = 28;
  ws.getColumn(CA.HS_REQ).width     = 15;
  ws.getColumn(CA.HS_NETAS).width   = 15;
  ws.getColumn(CA.DIFERENCIA).width = 13;
  ws.getColumn(CA.FALTANTE).width   = 14;
  ws.getColumn(CA.AG_APROX).width   = 13;
  ws.getColumn(CA.SEP).width        = 2;
  ws.getColumn(CA.DESLOGUEO).width  = 13;
  ws.getColumn(CA.AUSENTISMO).width = 13;
  ws.getColumn(CA.ROTACION).width   = 13;
  ws.getColumn(CA.CUMPL).width      = 14;

  let row = 1;

  // Título
  ws.getRow(row).height = 22;
  const t = ws.getCell(row, 1);
  t.value = `ESTADO ACTUAL — ${mes.toUpperCase()}`;
  t.font  = { bold: true, size: 13, color: { argb: WHITE }, name: "Calibri" };
  t.fill  = fill(BLUE_HEADER);
  t.alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells(row, 1, row, CA.TOTAL);
  row++;

  // Cabecera secciones
  ws.getRow(row).height = 13;
  const sec = (col: number, span: number, label: string, bg: RGB) => {
    const c = ws.getCell(row, col);
    c.value = label; c.font = headerFont(); c.fill = fill(bg);
    c.alignment = { horizontal: "center", vertical: "middle" };
    if (span > 1) ws.mergeCells(row, col, row, col + span - 1);
  };
  sec(CA.SERVICIO,  6, "DOTACIÓN Y CUMPLIMIENTO", BLUE_LIGHT);
  sec(CA.DESLOGUEO, 3, "REDUCTORES OPERATIVOS",   ORANGE_DARK);
  sec(CA.CUMPL,     1, "CUMPLIMIENTO",             GRAY_DARK);
  row++;

  // Cabecera columnas
  ws.getRow(row).height = 16;
  const headers: [number, string, RGB][] = [
    [CA.SERVICIO,   "Servicio",         BLUE_LIGHT],
    [CA.HS_REQ,     "Hs Requeridas",    BLUE_LIGHT],
    [CA.HS_NETAS,   "Hs Netas",         BLUE_LIGHT],
    [CA.DIFERENCIA, "Diferencia",       BLUE_LIGHT],
    [CA.FALTANTE,   "Hs Faltantes ↓",  RED_MID],
    [CA.AG_APROX,   "Ag. para 103%",    BLUE_LIGHT],
    [CA.DESLOGUEO,  "Deslogueo",        ORANGE_DARK],
    [CA.AUSENTISMO, "Ausentismo",       ORANGE_DARK],
    [CA.ROTACION,   "Rotación",         ORANGE_DARK],
    [CA.CUMPL,      "Cumplimiento",     GRAY_DARK],
  ];
  for (const [col, label, bg] of headers) {
    const c = ws.getCell(row, col);
    c.value = label; c.font = headerFont(); c.fill = fill(bg);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = border();
  }
  row++;

  // Filas de datos
  base.forEach((b, idx) => {
    const dif    = b.hsNetas - b.hsRequeridas;
    const falt   = Math.max(0, b.hsRequeridas - b.hsNetas);
    const bg     = idx % 2 === 0 ? WHITE : GRAY_ROW;

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

    setCel(CA.SERVICIO,   b.servicio,                              { bold: true, align: "left", color: "FF1F4E79" });
    setCel(CA.HS_REQ,     num(b.hsRequeridas));
    setCel(CA.HS_NETAS,   num(b.hsNetas));
    setCel(CA.DIFERENCIA, num(dif),                                { color: dif >= 0 ? GREEN_HEADER : RED_MID });
    setCel(CA.FALTANTE,   falt > 0 ? num(falt) : "—",
      { color: falt > 0 ? WHITE : "FF888888", bold: falt > 0,
        bgOverride: falt > 0 ? (idx % 2 === 0 ? "FFFFF0F0" : "FFFDE0E0") : bg });
    setCel(CA.AG_APROX,   Math.ceil(Math.max(b.deltaHC103, 0)),   { color: b.deltaHC103 > 0 ? RED_MID : GREEN_HEADER });
    setCel(CA.DESLOGUEO,  pct(b.reductoRes.deslogueo  * 100),     { color: "FF000000", bgOverride: idx % 2 === 0 ? "FFFFF8F0" : "FFFEF0E0" });
    setCel(CA.AUSENTISMO, pct(b.reductoRes.ausentismo * 100),     { color: "FF000000", bgOverride: idx % 2 === 0 ? "FFFFF8F0" : "FFFEF0E0" });
    setCel(CA.ROTACION,   pct(b.reductoRes.rotacion   * 100),     { color: "FF000000", bgOverride: idx % 2 === 0 ? "FFFFF8F0" : "FFFEF0E0" });
    setCel(CA.CUMPL,      pct(b.cumplimiento),                    { color: cumplColor(b.cumplimiento), bold: true });

    // Sub-fila meta 103%
    row++;
    ws.getRow(row).height = 11;
    const bgSub   = idx % 2 === 0 ? GRAY_SUB : "FFF5F5F5";
    const req103  = b.hsRequeridas * 1.03;
    const dif103  = b.hsNetas - req103;
    const falt103 = Math.max(0, req103 - b.hsNetas);

    const setSub = (col: number, value: ExcelJS.CellValue, color = "FF999999") => {
      const c = ws.getCell(row, col);
      c.value = value;
      c.font  = { size: 8.5, name: "Calibri", italic: true, color: { argb: color } };
      c.fill  = fill(col >= CA.DESLOGUEO ? (idx % 2 === 0 ? "FFFFF8F0" : "FFFEF0E0") : bgSub);
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = border("FFEEEEEE");
    };
    setSub(CA.SERVICIO,   "→ Meta 103%",             "FFBBBBBB");
    setSub(CA.HS_REQ,     num(req103));
    setSub(CA.HS_NETAS,   num(b.hsNetas));
    setSub(CA.DIFERENCIA, num(dif103),                dif103 >= 0 ? "FF375623" : RED_MID);
    setSub(CA.FALTANTE,   falt103 > 0 ? num(falt103) : "—", falt103 > 0 ? RED_MID : "FF999999");
    setSub(CA.AG_APROX,   Math.ceil(Math.max(b.deltaHC103, 0)));
    setSub(CA.DESLOGUEO,  "");
    setSub(CA.AUSENTISMO, "");
    setSub(CA.ROTACION,   "");
    setSub(CA.CUMPL,      "");
    row++;
  });

  // Fila UNIFICADO
  row++;
  const totalReq   = base.reduce((a, r) => a + r.hsRequeridas, 0);
  const totalNetas = base.reduce((a, r) => a + r.hsNetas, 0);
  const totalFalt  = base.reduce((a, r) => a + r.faltante, 0);
  const totalDif   = totalNetas - totalReq;
  const cumplBase  = (totalNetas / Math.max(totalReq, 1)) * 100;
  const agBase     = base.reduce((a, r) => a + Math.ceil(Math.max(r.deltaHC103, 0)), 0);
  const deslProm   = base.length > 0 ? base.reduce((a, r) => a + r.reductoRes.deslogueo, 0)  / base.length : 0;
  const ausProm    = base.length > 0 ? base.reduce((a, r) => a + r.reductoRes.ausentismo, 0) / base.length : 0;
  const rotProm    = base.length > 0 ? base.reduce((a, r) => a + r.reductoRes.rotacion, 0)   / base.length : 0;
  const uniBg      = totalDif >= 0 ? GREEN_HEADER : RED_HEADER;

  ws.getRow(row).height = 18;
  const setUni = (col: number, value: ExcelJS.CellValue) => {
    const c = ws.getCell(row, col);
    c.value = value; c.font = headerFont(); c.fill = fill(uniBg);
    c.alignment = { horizontal: col === CA.SERVICIO ? "left" : "center", vertical: "middle" };
    c.border = border();
  };
  setUni(CA.SERVICIO,   "UNIFICADO");
  setUni(CA.HS_REQ,     num(totalReq));
  setUni(CA.HS_NETAS,   num(totalNetas));
  setUni(CA.DIFERENCIA, delta(totalDif));
  setUni(CA.FALTANTE,   totalFalt > 0 ? num(totalFalt) : "—");
  setUni(CA.AG_APROX,   agBase > 0 ? agBase : "✓");
  setUni(CA.DESLOGUEO,  pct(deslProm * 100));
  setUni(CA.AUSENTISMO, pct(ausProm  * 100));
  setUni(CA.ROTACION,   pct(rotProm  * 100));
  setUni(CA.CUMPL,      pct(cumplBase));

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 3, activeCell: "B4" }];
}

// ── Hoja 2: Simulado ──────────────────────────────────────────────────────
function buildSimuladoSheet(
  wb: ExcelJS.Workbook,
  mes: string,
  base: ResultadoServicio[],
  sim: ResultadoServicio[]
) {
  const haySimulacion = base.some((b, i) => Math.abs(b.hsNetas - sim[i].hsNetas) > 0.5);

  const ws = wb.addWorksheet("Simulado", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  ws.getColumn(CS.SERVICIO).width     = 28;
  ws.getColumn(CS.HS_REQ).width       = 15;
  ws.getColumn(CS.HS_NETAS_ACT).width = 14;
  ws.getColumn(CS.HS_NETAS_SIM).width = 14;
  ws.getColumn(CS.DIFER_SIM).width    = 13;
  ws.getColumn(CS.FALT_SIM).width     = 14;
  ws.getColumn(CS.AG_SIM).width       = 13;
  ws.getColumn(CS.CUMPL_ACT).width    = 13;
  ws.getColumn(CS.CUMPL_SIM).width    = 13;
  ws.getColumn(CS.DELTA_PP).width     = 11;

  let row = 1;

  // Título
  ws.getRow(row).height = 22;
  const t = ws.getCell(row, 1);
  t.value = `ESCENARIO SIMULADO — ${mes.toUpperCase()}`;
  t.font  = { bold: true, size: 13, color: { argb: WHITE }, name: "Calibri" };
  t.fill  = fill(GREEN_HEADER);
  t.alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells(row, 1, row, CS.TOTAL);
  row++;

  if (!haySimulacion) {
    ws.getRow(row).height = 16;
    const msg = ws.getCell(row, 1);
    msg.value = "Sin cambios en el simulador — los valores base y simulado son idénticos.";
    msg.font  = { size: 10, name: "Calibri", italic: true, color: { argb: GRAY_DARK } };
    msg.alignment = { horizontal: "left", vertical: "middle" };
    ws.mergeCells(row, 1, row, CS.TOTAL);
    return;
  }

  // Cabecera secciones
  ws.getRow(row).height = 13;
  const sec = (col: number, span: number, label: string, bg: RGB) => {
    const c = ws.getCell(row, col);
    c.value = label; c.font = headerFont(); c.fill = fill(bg);
    c.alignment = { horizontal: "center", vertical: "middle" };
    if (span > 1) ws.mergeCells(row, col, row, col + span - 1);
  };
  sec(CS.SERVICIO,     2, "SERVICIO",              BLUE_LIGHT);
  sec(CS.HS_NETAS_ACT, 1, "ACTUAL",                BLUE_LIGHT);
  sec(CS.HS_NETAS_SIM, 4, "SIMULADO",              GREEN_HEADER);
  sec(CS.CUMPL_ACT,    3, "CUMPLIMIENTO",           GRAY_DARK);
  row++;

  // Cabecera columnas
  ws.getRow(row).height = 16;
  const headers: [number, string, RGB][] = [
    [CS.SERVICIO,     "Servicio",         BLUE_LIGHT],
    [CS.HS_REQ,       "Hs Requeridas",    BLUE_LIGHT],
    [CS.HS_NETAS_ACT, "Hs Netas (actual)", BLUE_LIGHT],
    [CS.HS_NETAS_SIM, "Hs Netas (sim)",   GREEN_HEADER],
    [CS.DIFER_SIM,    "Diferencia",       GREEN_HEADER],
    [CS.FALT_SIM,     "Hs Faltantes ↓",  RED_MID],
    [CS.AG_SIM,       "Ag. para 103%",    GREEN_HEADER],
    [CS.CUMPL_ACT,    "Cumpl. actual",    GRAY_DARK],
    [CS.CUMPL_SIM,    "Cumpl. simulado",  GRAY_DARK],
    [CS.DELTA_PP,     "Δ pp",             GRAY_DARK],
  ];
  for (const [col, label, bg] of headers) {
    const c = ws.getCell(row, col);
    c.value = label; c.font = headerFont(); c.fill = fill(bg);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = border();
  }
  row++;

  base.forEach((b, idx) => {
    const s       = sim[idx];
    const difSim  = s.hsNetas - b.hsRequeridas;
    const faltSim = Math.max(0, b.hsRequeridas - s.hsNetas);
    const diff    = s.cumplimiento - b.cumplimiento;
    const bg      = idx % 2 === 0 ? WHITE : GRAY_ROW;
    const changed = Math.abs(b.hsNetas - s.hsNetas) > 0.5;

    ws.getRow(row).height = 15;

    const set = (col: number, value: ExcelJS.CellValue, opts?: {
      bold?: boolean; color?: RGB; bgOverride?: RGB; align?: ExcelJS.Alignment["horizontal"];
    }) => {
      const c = ws.getCell(row, col);
      c.value = value;
      c.font  = { ...dataFont(opts?.color ?? "FF000000"), bold: opts?.bold };
      c.fill  = fill(opts?.bgOverride ?? bg);
      c.alignment = { horizontal: opts?.align ?? "center", vertical: "middle" };
      c.border = border();
    };

    set(CS.SERVICIO,     b.servicio,                                  { bold: true, align: "left", color: "FF1F4E79" });
    set(CS.HS_REQ,       num(b.hsRequeridas));
    set(CS.HS_NETAS_ACT, num(b.hsNetas),                              { color: "FF555555" });
    set(CS.HS_NETAS_SIM, num(s.hsNetas),                              { bold: changed, color: changed ? GREEN_HEADER : "FF555555" });
    set(CS.DIFER_SIM,    num(difSim),                                  { color: difSim >= 0 ? GREEN_HEADER : RED_MID });
    set(CS.FALT_SIM,     faltSim > 0 ? num(faltSim) : "—",
      { color: faltSim > 0 ? WHITE : "FF888888", bold: faltSim > 0,
        bgOverride: faltSim > 0 ? (idx % 2 === 0 ? "FFFFF0F0" : "FFFDE0E0") : bg });
    set(CS.AG_SIM,       Math.ceil(Math.max(s.deltaHC103, 0)),        { color: s.deltaHC103 > 0 ? RED_MID : GREEN_HEADER });
    set(CS.CUMPL_ACT,    pct(b.cumplimiento),                         { color: cumplColor(b.cumplimiento), bold: true });
    set(CS.CUMPL_SIM,    pct(s.cumplimiento),                         { color: cumplColor(s.cumplimiento), bold: true });
    set(CS.DELTA_PP,     `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}pp`,
      { color: diff > 0 ? GREEN_HEADER : diff < 0 ? RED_MID : "FF888888", bold: Math.abs(diff) > 0.5 });

    row++;
  });

  // Fila UNIFICADO
  row++;
  const totalReq      = base.reduce((a, r) => a + r.hsRequeridas, 0);
  const totalNetas    = base.reduce((a, r) => a + r.hsNetas, 0);
  const totalNetasSim = sim.reduce((a, r) => a + r.hsNetas, 0);
  const totalFaltSim  = sim.reduce((a, r) => a + r.faltante, 0);
  const totalDifSim   = totalNetasSim - totalReq;
  const cumplBase     = (totalNetas    / Math.max(totalReq, 1)) * 100;
  const cumplSim      = (totalNetasSim / Math.max(totalReq, 1)) * 100;
  const agSim         = sim.reduce((a, r) => a + Math.ceil(Math.max(r.deltaHC103, 0)), 0);
  const totDiff       = cumplSim - cumplBase;
  const uniBg         = totalDifSim >= 0 ? GREEN_HEADER : RED_HEADER;

  ws.getRow(row).height = 18;
  const setUni = (col: number, value: ExcelJS.CellValue) => {
    const c = ws.getCell(row, col);
    c.value = value; c.font = headerFont(); c.fill = fill(uniBg);
    c.alignment = { horizontal: col === CS.SERVICIO ? "left" : "center", vertical: "middle" };
    c.border = border();
  };
  setUni(CS.SERVICIO,     "UNIFICADO");
  setUni(CS.HS_REQ,       num(totalReq));
  setUni(CS.HS_NETAS_ACT, num(totalNetas));
  setUni(CS.HS_NETAS_SIM, num(totalNetasSim));
  setUni(CS.DIFER_SIM,    delta(totalDifSim));
  setUni(CS.FALT_SIM,     totalFaltSim > 0 ? num(totalFaltSim) : "—");
  setUni(CS.AG_SIM,       agSim > 0 ? agSim : "✓");
  setUni(CS.CUMPL_ACT,    pct(cumplBase));
  setUni(CS.CUMPL_SIM,    pct(cumplSim));
  setUni(CS.DELTA_PP,     `${totDiff >= 0 ? "+" : ""}${totDiff.toFixed(1)}pp`);

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 3, activeCell: "B4" }];
}

// ── Hoja 3: Brechas ───────────────────────────────────────────────────────
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
    c.value = label; c.font = { bold: true, size: 12, color: { argb: WHITE }, name: "Calibri" };
    c.fill  = fill(bg); c.alignment = { horizontal: "left", vertical: "middle" };
    ws.mergeCells(row, 1, row, span); row++;
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

  // Sección 1: Déficit
  addBanner(`DÉFICIT DE HORAS — ${mes.toUpperCase()}`, RED_HEADER);
  const enDeficit = [...base].filter((b) => b.faltante > 0).sort((a, b) => b.faltante - a.faltante);

  if (enDeficit.length === 0) {
    ws.getRow(row).height = 16;
    const c = ws.getCell(row, 1);
    c.value = "✓ Todos los servicios superan el 100% de las horas requeridas";
    c.font  = { bold: true, size: 11, color: { argb: GREEN_HEADER }, name: "Calibri" };
    c.fill  = fill(GREEN_SOFT);
    ws.mergeCells(row, 1, row, 8); row++;
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

  row++;

  // Sección 2: Facturación
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

  row++;

  // Alerta críticos
  const criticos = base.filter((b) => b.cumplimiento < 90);
  if (criticos.length > 0) {
    ws.getRow(row).height = 14;
    const alert = ws.getCell(row, 1);
    alert.value = `⚠ ${criticos.length} servicio${criticos.length !== 1 ? "s" : ""} con cumplimiento crítico (<90%): ${criticos.map((b) => b.servicio).join(", ")}`;
    alert.font  = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
    alert.fill  = fill("FFCC0000");
    alert.alignment = { horizontal: "left", vertical: "middle" };
    ws.mergeCells(row, 1, row, 8); row++;
  }

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 0, activeCell: "A1" }];
}

// ── Hoja 4: Resumen ejecutivo ──────────────────────────────────────────────
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
  ws.mergeCells(row, 1, row, 6); row++;

  ws.getRow(row).height = 14;
  ["Servicio", "Hs Req.", "Faltantes", "Cumpl. actual", "Cumpl. sim.", "Δ pp"].forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h; c.font = headerFont(); c.fill = fill(BLUE_LIGHT);
    c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
    c.border = border();
  });
  row++;

  base.forEach((b, i) => {
    const s    = sim[i];
    const diff = s.cumplimiento - b.cumplimiento;
    const bg   = i % 2 === 0 ? WHITE : GRAY_ROW;
    const faltBg = b.faltante > 0 ? (i % 2 === 0 ? "FFFFF0F0" : "FFFDE0E0") : bg;

    ws.getRow(row).height = 13;
    const vals: [number, ExcelJS.CellValue, RGB, RGB][] = [
      [1, b.servicio,                                              "FF1F4E79", bg],
      [2, num(b.hsRequeridas),                                    "FF000000", bg],
      [3, b.faltante > 0 ? num(b.faltante) : "—",               b.faltante > 0 ? RED_MID : "FF888888", faltBg],
      [4, pct(b.cumplimiento),                                    cumplColor(b.cumplimiento), bg],
      [5, pct(s.cumplimiento),                                    cumplColor(s.cumplimiento), bg],
      [6, `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}pp`,        diff > 0 ? GREEN_HEADER : diff < 0 ? RED_MID : "FF888888", bg],
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

  const totReq  = base.reduce((a, r) => a + r.hsRequeridas, 0);
  const totFalt = base.reduce((a, r) => a + r.faltante, 0);
  const cumplB  = (base.reduce((a, r) => a + r.hsNetas, 0) / Math.max(totReq, 1)) * 100;
  const cumplS  = (sim.reduce((a, r) => a + r.hsNetas, 0)  / Math.max(totReq, 1)) * 100;
  const totDiff = cumplS - cumplB;
  const totalBg = cumplS >= 103 ? GREEN_HEADER : RED_HEADER;

  ws.getRow(row).height = 15;
  ["TOTAL", num(totReq), totFalt > 0 ? num(totFalt) : "—", pct(cumplB), pct(cumplS), `${totDiff >= 0 ? "+" : ""}${totDiff.toFixed(1)}pp`]
    .forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v; c.font = headerFont(); c.fill = fill(totalBg);
      c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
      c.border = border();
    });
}

// ── Hoja 5: Reductores calculados ─────────────────────────────────────────
function buildReductoresSheet(
  wb: ExcelJS.Workbook,
  mes: string,
  base: ResultadoServicio[]
) {
  const ws = wb.addWorksheet("Reductores");
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 14;
  ws.getColumn(7).width = 14;

  let row = 1;

  ws.getRow(row).height = 20;
  const title = ws.getCell(row, 1);
  title.value = `REDUCTORES CALCULADOS — ${mes.toUpperCase()}`;
  title.font  = { bold: true, size: 12, color: { argb: WHITE }, name: "Calibri" };
  title.fill  = fill(ORANGE_DARK);
  title.alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells(row, 1, row, 7); row++;

  ws.getRow(row).height = 14;
  const cols: [string, string][] = [
    ["Servicio",      ORANGE_DARK],
    ["Deslogueo",     ORANGE_DARK],
    ["Ausentismo",    ORANGE_DARK],
    ["Rotación",      ORANGE_DARK],
    ["Hs Brutas",     BLUE_LIGHT],
    ["Hs Netas",      BLUE_LIGHT],
    ["Hs Impactadas", RED_HEADER],
  ];
  cols.forEach(([label, bg], i) => {
    const c = ws.getCell(row, i + 1);
    c.value = label; c.font = headerFont(); c.fill = fill(bg);
    c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle", wrapText: true };
    c.border = border();
  });
  row++;

  base.forEach((b, idx) => {
    const bg      = idx % 2 === 0 ? WHITE : GRAY_ROW;
    const impacto = b.hsBrutas - b.hsNetas;

    ws.getRow(row).height = 14;

    const set = (col: number, value: ExcelJS.CellValue, color = "FF000000", bgOverride?: string, bold = false) => {
      const c = ws.getCell(row, col);
      c.value = value;
      c.font  = { size: 10, name: "Calibri", color: { argb: color }, bold };
      c.fill  = fill(bgOverride ?? bg);
      c.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle" };
      c.border = border();
    };

    set(1, b.servicio,                              "FF1F4E79", undefined, true);
    set(2, pct(b.reductoRes.deslogueo  * 100),     "FF000000", idx % 2 === 0 ? "FFFFF8F0" : "FFFEF0E0");
    set(3, pct(b.reductoRes.ausentismo * 100),     "FF000000", idx % 2 === 0 ? "FFFFF8F0" : "FFFEF0E0");
    set(4, pct(b.reductoRes.rotacion   * 100),     "FF000000", idx % 2 === 0 ? "FFFFF8F0" : "FFFEF0E0");
    set(5, num(b.hsBrutas),                        "FF000000", bg);
    set(6, num(b.hsNetas),                         "FF000000", bg);
    set(7, num(impacto),                           impacto > 0 ? RED_MID : GREEN_HEADER,
      impacto > 0 ? (idx % 2 === 0 ? ORANGE_SOFT : "FFFDE0D0") : bg, true);

    row++;
  });

  const totBrutas  = base.reduce((a, r) => a + r.hsBrutas, 0);
  const totNetas   = base.reduce((a, r) => a + r.hsNetas, 0);
  const totImpacto = totBrutas - totNetas;
  const deslProm   = base.length > 0 ? base.reduce((a, r) => a + r.reductoRes.deslogueo, 0)  / base.length : 0;
  const ausProm    = base.length > 0 ? base.reduce((a, r) => a + r.reductoRes.ausentismo, 0) / base.length : 0;
  const rotProm    = base.length > 0 ? base.reduce((a, r) => a + r.reductoRes.rotacion, 0)   / base.length : 0;

  ws.getRow(row).height = 16;
  const totals: ExcelJS.CellValue[] = [
    "PROMEDIO / TOTAL",
    pct(deslProm  * 100),
    pct(ausProm   * 100),
    pct(rotProm   * 100),
    num(totBrutas),
    num(totNetas),
    num(totImpacto),
  ];
  totals.forEach((v, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = v; c.font = headerFont(); c.fill = fill(ORANGE_DARK);
    c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
    c.border = border();
  });

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 2, activeCell: "B3" }];
}
