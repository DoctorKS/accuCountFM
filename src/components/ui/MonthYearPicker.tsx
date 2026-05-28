import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { MONTHS_TH } from "@/lib/buddhist";

/**
 * Thai Buddhist-era month/year picker.
 *
 * Click trigger → popover with year nav + 4×3 month grid.
 * Replaces `<input type="month">` so the displayed value is always Thai
 * ("พฤษภาคม 2569") regardless of browser locale.
 *
 * Value & callback use the ISO "YYYY-MM" (Gregorian) format — same as DB.
 */
export function MonthYearPicker({
  value,
  onChange,
  label = "เดือน / ปี",
}: {
  value: string;             // "YYYY-MM" Gregorian
  onChange: (next: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Selected year is in dropdown's local state (lets user browse years
  // without committing until they pick a month).
  const [gregYear, monthIdx] = parseYM(value);
  const [browseYear, setBrowseYear] = useState(gregYear);
  useEffect(() => setBrowseYear(gregYear), [gregYear]);

  // Click outside → close
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (mIdx: number) => {
    const next = `${browseYear}-${String(mIdx + 1).padStart(2, "0")}`;
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative inline-block">
      <span className="block text-xs font-medium text-zinc-500">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-1 inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:border-violet-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
      >
        <Calendar className="h-4 w-4 text-violet-500" />
        {MONTHS_TH[monthIdx]} {gregYear + 543}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setBrowseYear((y) => y - 1)}
              className="rounded-md p-1 text-zinc-600 hover:bg-zinc-100"
              aria-label="ปีก่อนหน้า"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold">พ.ศ. {browseYear + 543}</div>
            <button
              type="button"
              onClick={() => setBrowseYear((y) => y + 1)}
              className="rounded-md p-1 text-zinc-600 hover:bg-zinc-100"
              aria-label="ปีถัดไป"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS_TH.map((name, idx) => {
              const isSelected = browseYear === gregYear && idx === monthIdx;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => pick(idx)}
                  className={`rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-50 text-zinc-700 hover:bg-violet-100"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function parseYM(ym: string): [number, number] {
  const [y, m] = ym.split("-").map(Number);
  return [y, (m ?? 1) - 1];
}
