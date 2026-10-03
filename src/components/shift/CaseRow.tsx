import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CaseRow as CaseRowT } from "@/lib/db";
import { DOCTORS } from "@/lib/doctors";
import type { ShiftType } from "@/lib/constants";
import { useUpdateCase, useDeleteCase } from "@/hooks/useShift";
import { TimePicker24 } from "@/components/ui/TimePicker24";

export function CaseRow({ row, autoFocus = false, onAddNext }: {
  row: CaseRowT; shiftType?: ShiftType; autoFocus?: boolean; onAddNext?: () => void;
}) {
  const surgery = row.case_kind === "surgery";
  const showTimes = surgery || row.shift_type === "outHos";
  const upd = useUpdateCase();
  const del = useDeleteCase();
  const [name, setName] = useState(row.case_name);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setName(row.case_name), [row.case_name]);
  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  const flush = () => {
    if (name.trim() !== row.case_name) upd.mutate({ id: row.id, patch: { case_name: name.trim() } });
  };
  const timeFields = <>
      <label className="flex items-center gap-1 text-xs text-zinc-500">
        <span>{surgery ? "เริ่มผ่า" : "ออก"}</span>
        <TimePicker24 value={row.leave_time} ariaLabel={surgery ? "เวลาเริ่มผ่า" : "เวลาออก"}
          onChange={v => upd.mutate({ id: row.id, patch: { leave_time: v } })} />
      </label>
      <label className="flex items-center gap-1 text-xs text-zinc-500">
        <span>{surgery ? "ผ่าเสร็จสิ้น" : "กลับ"}</span>
        <TimePicker24 value={row.return_time} ariaLabel={surgery ? "เวลาผ่าเสร็จสิ้น" : "เวลากลับ"}
          onChange={v => upd.mutate({ id: row.id, patch: { return_time: v } })} />
      </label>
  </>;
  return <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-2">
    <div className="flex items-center gap-2 overflow-x-auto [&>label]:shrink-0 [&>select]:shrink-0 [&>button]:shrink-0">
    <input ref={input} aria-label="ชื่อ นามสกุล" placeholder="ชื่อ นามสกุล" value={name}
      onChange={e => setName(e.target.value)} onBlur={flush}
      onKeyDown={e => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (!name.trim() || (showTimes && (!row.leave_time || !row.return_time))) {
          toast.error("กรุณากรอกข้อมูลให้ครบ"); return;
        }
        flush(); onAddNext?.();
      }} className="min-w-40 flex-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm" />
    {!surgery && row.shift_type === "inHos" && <label className="flex items-center gap-1 text-xs text-zinc-500">
      <span>เวลาชันสูตร</span>
      <TimePicker24 value={row.examination_time ?? null} ariaLabel="เวลาชันสูตร"
        onChange={v => upd.mutate({ id: row.id, patch: { examination_time: v } })} />
    </label>}
    {surgery && timeFields}
    {surgery ? <select aria-label="แพทย์ผู้ผ่า" value={row.surgeon_name ?? ""}
      onChange={e => upd.mutate({ id: row.id, patch: { surgeon_name: (e.target.value || null) as typeof row.surgeon_name } })}
      className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm">
      <option value="">— เลือกแพทย์ผู้ผ่า —</option>
      {DOCTORS.map(d => <option key={d} value={d}>{d}</option>)}
    </select> : <select aria-label={surgery ? "เวรที่รับค่าผ่า" : "ประเภทชันสูตร"} value={row.shift_type}
      onChange={e => upd.mutate({ id: row.id, patch: {
        shift_type: e.target.value as ShiftType,
        ...(!surgery && e.target.value === "inHos" ? { leave_time: null, return_time: null } : {}),
      } })} className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm">
      <option value="inHos">{surgery ? "แพทย์เวรใน รพ." : "ชันสูตรในโรงพยาบาล"}</option>
      <option value="outHos">{surgery ? "แพทย์เวรนอก รพ." : "ชันสูตรนอกโรงพยาบาล"}</option>
    </select>}
    {surgery && <span className="text-xs font-semibold text-[#455766]">เคสผ่า</span>}

    <button type="button" aria-label="ลบเคส" onClick={() => del.mutate(row.id)} className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
    </div>
    {!surgery && row.shift_type === "outHos" && <div className="mt-2 flex items-center gap-3 overflow-x-auto [&>label]:shrink-0">{timeFields}</div>}
    {upd.error && <p role="alert" className="w-full text-xs text-rose-600">บันทึกล้มเหลว: {String(upd.error)}</p>}
  </div>;
}
