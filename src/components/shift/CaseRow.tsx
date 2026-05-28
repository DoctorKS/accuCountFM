import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { CaseRow as CaseRowT } from "@/lib/db";
import type { ShiftType } from "@/lib/constants";
import { useUpdateCase, useDeleteCase } from "@/hooks/useShift";
import { TimePicker24 } from "@/components/ui/TimePicker24";

/**
 * A single case row in a shift slot.
 *
 * outHos: shows case name + เวลาออก + เวลากลับ (24-hr dropdowns)
 * inHos:  shows case name only (each case = 10 min virtual time)
 *
 * Field flushes happen on blur (text) or onChange (time) — TanStack Query
 * invalidates the month so the slot total + day total + month total all
 * recompute via calc-month.ts.
 */
export function CaseRow({ row, shiftType }: { row: CaseRowT; shiftType: ShiftType }) {
  const isOut = shiftType === "outHos";
  const upd = useUpdateCase();
  const del = useDeleteCase();
  const [name, setName] = useState(row.case_name);

  const flushName = () => name !== row.case_name && upd.mutate({ id: row.id, patch: { case_name: name } });
  const setLeave = (v: string | null) =>
    v !== row.leave_time && upd.mutate({ id: row.id, patch: { leave_time: v } });
  const setReturn = (v: string | null) =>
    v !== row.return_time && upd.mutate({ id: row.id, patch: { return_time: v } });

  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/50 p-2">
      <input
        type="text"
        placeholder="ชื่อเคส (CS)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={flushName}
        className="flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
      />
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
