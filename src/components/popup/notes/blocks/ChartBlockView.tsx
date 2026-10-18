import { useEffect, useMemo, useRef, useState } from "react";
import { ChartColumn, ChartLine, ChartPie, Plus, X } from "lucide-react";

import BlockShell from "./BlockShell";
import { useCopy } from "../useCopy";
import { isBlockEmpty } from "../blockTypes";
import { CHART_KINDS, chartSvg, chartToText, formatNumber, parseChartRows, parseNumber } from "../chart";
import { useNotesStore } from "../../../../stores/notesStore";

import type { ChartBlock, ChartKind, ChartPoint } from "../../../../types/notes";

const KIND_ICON: Record<ChartKind, typeof ChartColumn> = { bar: ChartColumn, line: ChartLine, pie: ChartPie };

const newPoint = (label = "", value: number | null = null): ChartPoint => ({ id: crypto.randomUUID(), label, value });

/**
 * A chart drawn from labelled values. The data table shows while you work
 * in the block (or while there's nothing to draw); otherwise just the chart.
 * Paste rows from a spreadsheet into any cell to fill it in.
 */
export default function ChartBlockView({ block }: { block: ChartBlock }) {
  const updateBlock = useNotesStore((s) => s.updateBlock);
  const transformBlock = useNotesStore((s) => s.transformBlock);
  const focusBlockId = useNotesStore((s) => s.focusBlockId);
  const focusAt = useNotesStore((s) => s.focusAt);
  const consumeFocus = useNotesStore((s) => s.consumeFocus);
  const [copied, copy] = useCopy();

  const empty = isBlockEmpty(block);
  const svg = useMemo(() => chartSvg(block), [block]);
  const [focused, setFocused] = useState(false);
  const editing = focused || !svg;
  /** What's typed in a value cell, until it's left (so "1." stays "1."). */
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const pendingFocus = useRef<{ row: number; col: 0 | 1 } | null>(null);
  const [, setTick] = useState(0);
  /** Move to a cell (it may only exist after the next render). */
  const focusCell = (row: number, col: 0 | 1) => {
    pendingFocus.current = { row, col };
    setTick((t) => t + 1);
  };

  useEffect(() => {
    if (focusBlockId !== block.id) return;
    if (focusAt === "end" && !empty) {
      const values = rootRef.current?.querySelectorAll<HTMLInputElement>("[data-col='1']");
      (values?.[values.length - 1] ?? titleRef.current)?.focus();
    } else {
      titleRef.current?.focus();
    }
    consumeFocus();
  }, [focusBlockId, focusAt, block.id, empty, consumeFocus]);

  // Focus a cell after the rows changed (Enter / paste / remove).
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    rootRef.current
      ?.querySelector<HTMLInputElement>(`[data-row='${target.row}'][data-col='${target.col}']`)
      ?.focus();
  });

  const setPoints = (points: ChartPoint[]) => updateBlock(block.id, { points });

  function setCell(index: number, patch: Partial<ChartPoint>) {
    setPoints(block.points.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function onValueChange(index: number, raw: string) {
    const p = block.points[index];
    setDrafts((d) => ({ ...d, [p.id]: raw }));
    const n = parseNumber(raw);
    if (raw.trim() === "") setCell(index, { value: null });
    else if (n !== null) setCell(index, { value: n });
  }

  function addRow(after = block.points.length - 1) {
    const next = [...block.points];
    next.splice(after + 1, 0, newPoint());
    pendingFocus.current = { row: after + 1, col: 0 };
    setPoints(next);
  }

  function removeRow(index: number) {
    if (block.points.length <= 1) {
      setPoints([newPoint()]);
      return;
    }
    pendingFocus.current = { row: Math.max(0, index - 1), col: 1 };
    setPoints(block.points.filter((_, i) => i !== index));
  }

  /** Pasted rows fill the table from this row down (replacing what's there). */
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>, index: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\n\t]/.test(text.trim())) return; // a single value: normal paste
    const rows = parseChartRows(text);
    if (!rows.length) return;
    e.preventDefault();
    const head = block.points.slice(0, index);
    const pasted = rows.map((r) => newPoint(r.label, r.value));
    const tail = block.points.slice(index + rows.length);
    pendingFocus.current = { row: index + rows.length - 1, col: 1 };
    setPoints([...head, ...pasted, ...tail]);
  }

  function onCellKey(e: React.KeyboardEvent<HTMLInputElement>, index: number, col: 0 | 1) {
    const p = block.points[index];
    if (e.key === "Enter") {
      e.preventDefault();
      if (col === 0) focusCell(index, 1);
      else if (index === block.points.length - 1) addRow(index);
      else focusCell(index + 1, 0);
      return;
    }
    if ((e.key === "ArrowDown" && index < block.points.length - 1) || (e.key === "ArrowUp" && index > 0)) {
      e.preventDefault();
      focusCell(index + (e.key === "ArrowDown" ? 1 : -1), col);
      return;
    }
    if (e.key === "Backspace" && !p.label && p.value === null && !(drafts[p.id] ?? "")) {
      if (col === 1) return; // first step back into the label
      e.preventDefault();
      removeRow(index);
    }
  }

  return (
    <BlockShell id={block.id} onCopy={() => copy(chartToText(block))} copied={copied} empty={empty}>
      <div
        ref={rootRef}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setFocused(false);
            setDrafts({});
          }
        }}
        className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5"
      >
        <div className="flex items-center gap-2">
          <input
            ref={titleRef}
            value={block.title}
            placeholder="Chart title"
            aria-label="Chart title"
            onChange={(e) => updateBlock(block.id, { title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && empty) {
                e.preventDefault();
                transformBlock(block.id, "text");
              }
              if (e.key === "Enter") {
                e.preventDefault();
                setFocused(true);
                focusCell(0, 0);
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-neutral-800 outline-none placeholder:font-medium placeholder:text-neutral-300"
          />
          <div role="radiogroup" aria-label="Chart type" className="flex shrink-0 items-center gap-0.5 rounded-lg bg-neutral-100 p-0.5">
            {CHART_KINDS.map(({ kind, label }) => {
              const Icon = KIND_ICON[kind];
              const on = block.kind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${label} chart`}
                  title={`${label} chart`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateBlock(block.id, { kind })}
                  className={[
                    "flex h-6 w-7 items-center justify-center rounded-md transition-colors",
                    on ? "bg-white text-indigo-600 shadow-sm" : "text-neutral-400 hover:text-neutral-700",
                  ].join(" ")}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
        </div>

        {svg ? (
          <div
            className="mt-2 cursor-default select-none"
            onMouseDown={(e) => {
              if (editing) return;
              e.preventDefault();
              setFocused(true);
              focusCell(0, 0);
            }}
            // Built by chartSvg from escaped text only.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <p className="mt-1 text-xs text-neutral-400">Add values below to draw the chart.</p>
        )}

        {editing && (
          <div className="mt-2 border-t border-neutral-100 pt-2">
            <div className="grid grid-cols-[1fr_88px_20px] items-center gap-x-2 gap-y-1">
              <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Label</span>
              <span className="px-1 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Value</span>
              <span />
              {block.points.map((p, i) => (
                <div key={p.id} className="contents">
                  <input
                    data-row={i}
                    data-col={0}
                    value={p.label}
                    placeholder={`Item ${i + 1}`}
                    aria-label={`Label ${i + 1}`}
                    onChange={(e) => setCell(i, { label: e.target.value })}
                    onKeyDown={(e) => onCellKey(e, i, 0)}
                    onPaste={(e) => onPaste(e, i)}
                    className="min-w-0 rounded-md bg-neutral-50 px-2 py-1 text-sm text-neutral-800 outline-none placeholder:text-neutral-300 focus:bg-neutral-100"
                  />
                  <input
                    data-row={i}
                    data-col={1}
                    inputMode="decimal"
                    value={drafts[p.id] ?? (p.value === null ? "" : String(p.value))}
                    placeholder="0"
                    aria-label={`Value ${i + 1}`}
                    onChange={(e) => onValueChange(i, e.target.value)}
                    onKeyDown={(e) => onCellKey(e, i, 1)}
                    onPaste={(e) => onPaste(e, i)}
                    title={p.value === null ? undefined : formatNumber(p.value)}
                    className={[
                      "min-w-0 rounded-md bg-neutral-50 px-2 py-1 text-right text-sm tabular-nums outline-none placeholder:text-neutral-300 focus:bg-neutral-100",
                      drafts[p.id] && parseNumber(drafts[p.id]) === null ? "text-red-500" : "text-neutral-800",
                    ].join(" ")}
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => removeRow(i)}
                    aria-label={`Remove row ${i + 1}`}
                    className="flex h-5 w-5 items-center justify-center rounded text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addRow()}
                className="flex items-center gap-1.5 pl-[2px] text-xs text-neutral-400 transition-colors hover:text-neutral-600"
              >
                <Plus size={13} /> Add row
              </button>
              <span className="truncate text-[11px] text-neutral-300">Tip: paste rows from a spreadsheet</span>
            </div>
          </div>
        )}
      </div>
    </BlockShell>
  );
}
