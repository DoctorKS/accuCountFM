import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { CaseRow as CaseRowT } from "@/lib/db";
import type { ShiftType } from "@/lib/constants";
import { useUpdateCase, useDeleteCase } from "@/hooks/useShift";

/** A single case row in a shift slot. outHos shows time fields; inHos shows only the case name. */
export function CaseRow({ row, shiftType }: { row: CaseRowT; shiftType: ShiftType }) {
  const isOut = shiftType === "outHos";
  const upd = useUpdateCase();
  const del = useDeleteCase();
  const [name, setName] = useState(row.case_name);
  const [leave, setLeave] = useState(row.leave_time ?? "");
  const [ret, setRet] = useState(row.return_time ?? "");

  const flushName = () => name !== row.case_name && upd.mutate({ id: row.id, patch: { case_name: name } });
  const flushLeave = () => leave !== (row.leave_time ?? "") && upd.mutate({ id: row.id, patch: { leave_time: leave || null } });
  const flushReturn = () => ret !== (row.return_time ?? "") && upd.mutate({ id: row.id, patch: { return_time: ret || null } });

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
          <TimeField label="ออก" value={leave} onChange={setLeave} onBlur={flushLeave} />
          <TimeField label="กลับ" value={ret} onChange={setRet} onBlur={flushReturn} />
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

function TimeField({ label, value, onChange, onBlur }: {
  label: string; value: string; onChange: (v: string) => void; onBlur: () => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-zinc-500">
      <span>{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
      />
    </label>
  );
}
