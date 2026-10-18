/**
 * Chart blocks: pure helpers (no browser APIs — unit-tested by
 * scripts/chartHarness.ts). The SVG is built as a string so the note view
 * and the HTML export draw exactly the same picture; every label is escaped.
 */
import type { ChartBlock, ChartKind } from "../../../types/notes";

export const CHART_COLORS = ["#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#EF4444", "#14B8A6"];

export const CHART_KINDS: { kind: ChartKind; label: string }[] = [
  { kind: "bar", label: "Bar" },
  { kind: "line", label: "Line" },
  { kind: "pie", label: "Pie" },
];

export interface ChartDatum {
  label: string;
  value: number;
}

/** The points that have a value (labels default to their position). */
export function chartData(block: Pick<ChartBlock, "points">): ChartDatum[] {
  return block.points
    .map((p, i) => ({ label: p.label.trim() || `#${i + 1}`, value: p.value }))
    .filter((d): d is ChartDatum => typeof d.value === "number" && Number.isFinite(d.value));
}

// ───────────────────────── numbers ─────────────────────────

/** "1,234", "€ 12.5", "45%", "1.234,5", "(30)" → number; null when it isn't one. */
export function parseNumber(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[\s$€£₹¥%]/g, "");
  if (s.startsWith("-") || s.startsWith("−")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // The later separator is the decimal point.
    s = lastDot > lastComma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0) {
    // Thousands groups (1,234 or Indian 2,50,000) — else a decimal comma.
    s = /^\d{1,3}(,\d{2,3})*,\d{3}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, ""); // 1.234.567
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function formatNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10_000) return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  return new Intl.NumberFormat("en", { maximumFractionDigits: abs < 1 && abs > 0 ? 3 : 2 }).format(n);
}

/**
 * Rows pasted from a spreadsheet or typed as "Label, 12" / "Label: 12" lines.
 * A header row (no number in it) is skipped. A lone number is a value with
 * no label.
 */
export function parseChartRows(text: string): { label: string; value: number | null }[] {
  const rows: { label: string; value: number | null }[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    let label = "";
    let value: number | null = null;
    const cells = line.split("\t").map((c) => c.trim());
    if (cells.length > 1) {
      // First numeric cell after the first column is the value.
      const vi = cells.findIndex((c, i) => i > 0 && parseNumber(c) !== null);
      if (vi > 0) {
        label = cells.slice(0, vi).filter(Boolean).join(" ");
        value = parseNumber(cells[vi]);
      } else if (parseNumber(cells[0]) !== null && cells.length === 1) {
        value = parseNumber(cells[0]);
      } else {
        label = cells.filter(Boolean).join(" ");
      }
    } else {
      const m = line.match(/^(.*?)(?:\s*[,;:=|]\s*|\s+)([-+−(]?[$€£₹¥]?\s*[\d.,]+\)?\s*%?)$/);
      if (m && parseNumber(m[2]) !== null) {
        label = m[1].trim();
        value = parseNumber(m[2]);
      } else if (parseNumber(line) !== null) {
        value = parseNumber(line);
      } else {
        label = line;
      }
    }
    rows.push({ label, value });
  }
  // Drop a leading header ("Month  Sales") when the rest has numbers.
  if (rows.length > 1 && rows[0].value === null && rows.slice(1).some((r) => r.value !== null)) rows.shift();
  return rows;
}

// ───────────────────────── SVG ─────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const r1 = (n: number) => Math.round(n * 10) / 10;

function niceStep(range: number, count: number): number {
  const raw = range / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}

function niceScale(values: number[]): { min: number; max: number; ticks: number[] } {
  let lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  if (lo === hi) hi = lo + 1;
  const step = niceStep(hi - lo, 4);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t / step) * step);
  return { min: lo, max: hi, ticks };
}

function clip(label: string, maxChars: number): string {
  if (label.length <= maxChars) return label;
  return maxChars <= 1 ? "…" : `${label.slice(0, maxChars - 1)}…`;
}

const FONT = 'font-family="Inter,system-ui,-apple-system,Segoe UI,sans-serif"';

export const CHART_WIDTH = 360;
export const CHART_HEIGHT = 200;

function axisChart(data: ChartDatum[], kind: "bar" | "line", W: number, H: number): string {
  const { min, max, ticks } = niceScale(data.map((d) => d.value));
  const labelW = Math.max(...ticks.map((t) => formatNumber(t).length)) * 6.2 + 10;
  const left = Math.max(28, labelW);
  const right = 8;
  const top = 14;
  const bottom = 24;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const y = (v: number) => top + plotH - ((v - min) / (max - min)) * plotH;
  const band = plotW / data.length;
  const cx = (i: number) => left + band * (i + 0.5);
  const parts: string[] = [];

  for (const t of ticks) {
    parts.push(
      `<line x1="${left}" x2="${W - right}" y1="${r1(y(t))}" y2="${r1(y(t))}" stroke="${t === 0 ? "#d4d4d4" : "#f0f0f0"}" stroke-width="1"/>`,
      `<text x="${left - 6}" y="${r1(y(t) + 3.5)}" text-anchor="end" font-size="10" fill="#a3a3a3">${esc(formatNumber(t))}</text>`
    );
  }
  const maxChars = Math.max(2, Math.floor(band / 6));
  const every = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 34))));
  data.forEach((d, i) => {
    if (i % every === 0) {
      parts.push(
        `<text x="${r1(cx(i))}" y="${H - 7}" text-anchor="middle" font-size="10" fill="#737373">${esc(clip(d.label, maxChars * every))}</text>`
      );
    }
  });

  if (kind === "bar") {
    const bw = Math.min(42, band * 0.62);
    data.forEach((d, i) => {
      const y0 = y(Math.max(0, d.value));
      const h = Math.abs(y(d.value) - y(0));
      parts.push(
        `<rect x="${r1(cx(i) - bw / 2)}" y="${r1(y0)}" width="${r1(bw)}" height="${r1(Math.max(h, d.value ? 1 : 0))}" rx="3" fill="${CHART_COLORS[0]}"><title>${esc(`${d.label}: ${formatNumber(d.value)}`)}</title></rect>`
      );
      if (data.length <= 12) {
        const ty = d.value >= 0 ? y0 - 4 : y0 + h + 11;
        parts.push(`<text x="${r1(cx(i))}" y="${r1(ty)}" text-anchor="middle" font-size="9.5" fill="#525252">${esc(formatNumber(d.value))}</text>`);
      }
    });
  } else {
    const pts = data.map((d, i) => `${r1(cx(i))},${r1(y(d.value))}`);
    const base = r1(y(Math.max(min, Math.min(0, max))));
    parts.push(
      `<polygon points="${r1(cx(0))},${base} ${pts.join(" ")} ${r1(cx(data.length - 1))},${base}" fill="${CHART_COLORS[0]}" fill-opacity="0.08"/>`,
      `<polyline points="${pts.join(" ")}" fill="none" stroke="${CHART_COLORS[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
    );
    data.forEach((d, i) => {
      parts.push(
        `<circle cx="${r1(cx(i))}" cy="${r1(y(d.value))}" r="3" fill="#fff" stroke="${CHART_COLORS[0]}" stroke-width="2"><title>${esc(`${d.label}: ${formatNumber(d.value)}`)}</title></circle>`
      );
    });
  }
  return parts.join("");
}

function pieChart(data: ChartDatum[], W: number, H: number): string | null {
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (!slices.length || total <= 0) return null;
  const r = Math.min(H / 2 - 10, W * 0.27);
  const cx = r + 12;
  const cy = H / 2;
  const parts: string[] = [];
  let angle = -Math.PI / 2;
  slices.forEach((d, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const share = d.value / total;
    const tip = `<title>${esc(`${d.label}: ${formatNumber(d.value)} (${Math.round(share * 100)}%)`)}</title>`;
    if (share >= 0.9999) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${r1(r)}" fill="${color}">${tip}</circle>`);
      return;
    }
    const a2 = angle + share * Math.PI * 2;
    const large = share > 0.5 ? 1 : 0;
    const p = (a: number) => `${r1(cx + r * Math.cos(a))},${r1(cy + r * Math.sin(a))}`;
    parts.push(
      `<path d="M${cx},${cy} L${p(angle)} A${r1(r)},${r1(r)} 0 ${large} 1 ${p(a2)} Z" fill="${color}" stroke="#fff" stroke-width="1.5">${tip}</path>`
    );
    angle = a2;
  });
  // Legend
  const lx = cx + r + 18;
  const rows = Math.min(slices.length, Math.floor((H - 16) / 18));
  const startY = cy - (rows * 18) / 2 + 9;
  const maxChars = Math.max(4, Math.floor((W - lx - 48) / 6));
  slices.slice(0, rows).forEach((d, i) => {
    const yy = startY + i * 18;
    const pct = `${Math.round((d.value / total) * 100)}%`;
    parts.push(
      `<rect x="${r1(lx)}" y="${r1(yy - 8)}" width="9" height="9" rx="2.5" fill="${CHART_COLORS[i % CHART_COLORS.length]}"/>`,
      `<text x="${r1(lx + 15)}" y="${r1(yy)}" font-size="10.5" fill="#404040">${esc(clip(d.label, maxChars))} <tspan fill="#a3a3a3">${pct}</tspan></text>`
    );
  });
  if (slices.length > rows) {
    parts.push(`<text x="${r1(lx + 15)}" y="${r1(startY + rows * 18)}" font-size="10" fill="#a3a3a3">+${slices.length - rows} more</text>`);
  }
  return parts.join("");
}

/** The chart as an SVG string; null when there's nothing to draw yet. */
export function chartSvg(
  block: Pick<ChartBlock, "kind" | "points" | "title">,
  width = CHART_WIDTH,
  height = CHART_HEIGHT
): string | null {
  const data = chartData(block);
  if (!data.length) return null;
  const body = block.kind === "pie" ? pieChart(data, width, height) : axisChart(data, block.kind, width, height);
  if (!body) return null;
  const label = block.title.trim() || `${block.kind} chart`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(label)}" ${FONT}>${body}</svg>`;
}

/** Tab-separated rows for copying / plain-text export. */
export function chartToText(block: Pick<ChartBlock, "title" | "points">): string {
  const rows = block.points
    .filter((p) => p.label.trim() || p.value !== null)
    .map((p) => `${p.label.trim()}\t${p.value ?? ""}`);
  return [block.title.trim(), ...rows].filter(Boolean).join("\n");
}
