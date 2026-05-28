import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CaseRow as CaseRowT } from "@/lib/db";
import type { ShiftType } from "@/lib/constants";
import { useUpdateCase, useDeleteCase } from "@/hooks/useShift";
import { TimePicker24 } from "@/components/ui/TimePicker24";
import { isLiveCaseComplete } from "@/lib/case-validation";

/**
 * A single case row in a shift slot.
 *
 * outHos shows case prefix (number) + auto "/yy" suffix + เวลาออก/กลับ.
 * inHos shows case prefix only (each case = 10min virtual time).
 *
 * Enter in the CS input flushes the current value and triggers `onAddNext`
 * (parent ShiftSlotCard handles the addCase mutation and routes focus to
 * the freshly-created row via `autoFocus`).
 */
export function CaseRow({
  row, shiftType, autoFocus = false, onAddNext,
}: {
  row: CaseRowT;
  shiftType: ShiftType;
  autoFocus?: boolean;
  onAddNext?: () => void;
}) {
  const isOut = shiftType === "outHos";
  const upd = useUpdateCase();
  const del = useDeleteCase();

  // CS suffix = "/" + last 2 digits of พ.ศ. year of the case's date.
  // Example: row.date = "2026-05-12" → พ.ศ. 2569 → "/69".
  const yearSuffix = csYearSuffix(row.date);

  // Stored value typically looks like "123/69". UI shows just "123" in the
  // input + a fixed suffix span. If stored doesn't end with the current
  // suffix (legacy / cross-year data), we leave it raw so nothing's lost.
  const stripped = row.case_name.endsWith(yearSuffix)
    ? row.case_name.slice(0, -yearSuffix.length)
    : row.case_name;
  const [prefix, setPrefix] = useState(stripped);

  // Keep local state in sync when row.case_name changes from elsewhere.
  useEffect(() => {
    setPrefix(row.case_name.endsWith(yearSuffix) ? row.case_name.slice(0, -yearSuffix.length) : row.case_name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.case_name]);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const flush = () => {
    const trimmed = prefix.trim();
    const next = trimmed ? `${trimmed}${yearSuffix}` : "";
    if (next !== row.case_name) upd.mutate({ id: row.id, patch: { case_name: next } });
  };

  const setLeave = (v: string | null) =>
    v !== row.leave_time && upd.mutate({ id: row.id, patch: { leave_time: v } });
  const setReturn = (v: string | null) =>
    v !== row.return_time && upd.mutate({ id: row.id, patch: { return_time: v } });

  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/50 p-2">
      <div className="flex flex-1 items-center rounded-md border border-zinc-200 bg-white focus-within:border-violet-400 focus-within:ring-1 focus-within:ring-violet-200">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="หมายเลข CS"
          value={prefix}
          // Strip non-digits in onChange so the input is digits-only regardless
          // of input method (typing, paste, IME). Keeping type="text" gives us
          // full control — type="number" would allow "e", "+", "-", ".".
          onChange={(e) => setPrefix(e.target.value.replace(/\D/g, ""))}
          onBlur={flush}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              // Enter advances to a new case row only when the CURRENT row is
              // complete (CS + leave + return for outHos; CS only for inHos).
              if (!isLiveCaseComplete(prefix, row.leave_time, row.return_time, shiftType)) {
                toast.error("กรุณากรอกข้อมูลให้ครบ");
                return;
              }
              flush();
              onAddNext?.();
            }
          }}
          className="flex-1 rounded-l-md bg-transparent px-2.5 py-1.5 text-sm focus:outline-none"
        />
        <span className="select-none border-l border-zinc-200 bg-zinc-50 px-2 py-1.5 font-mono text-sm text-zinc-500">
          {yearSuffix}
        </span>
      </div>
      {isOut && (
        <>
          <label className="flex items-center gap-1 text-xs text-zinc-500">
            <span>ออก</span>
            <TimePicker24 value={row.leave_time} onChange={setLeave} ariaLabel="เวลาออก" />
          </label>
          <label className="flex items-center gap-1 text-xs text-zinc-500">
            <span>กลับ</span>
            <TimePicker24 value={row.return_time} onChange={setReturn} ariaLabel="เวลากลับ" />
          </label>
        </>
      )}
      <button
        type="button"
        onClick={() => del.mutate(row.id)}
        className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50"
        title="ลบเคสนี้"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/** "/69" for 2026-05-12 (พ.ศ. 2569). */
export function csYearSuffix(isoDate: string): string {
  const y = Number(isoDate.slice(0, 4));
  if (!Number.isInteger(y)) return "";
  return `/${String((y + 543) % 100).padStart(2, "0")}`;
}
