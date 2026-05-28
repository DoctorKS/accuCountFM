import { X } from "lucide-react";
import { useMemo } from "react";
import type { ShiftType, Slot } from "@/lib/constants";
import { SLOTS } from "@/lib/constants";
import { DOCTORS, DOCTOR_BG_CLASS, isDoctor, type Doctor } from "@/lib/doctors";
import { useMonth, useSetAssignment } from "@/hooks/useShift";
import { formatBEMonth, WEEKDAY_TH_SHORT, daysInMonth } from "@/lib/buddhist";
import { isOffHour } from "@/lib/calc";

/**
 * ตรวจสอบตารางเวร — full-month grid for both shift_types side-by-side.
 *
 * Each cell is an inline doctor dropdown — changing it upserts the
 * assignment immediately (TanStack Query invalidates the month).
 * Holidays + weekends get a tinted row background; in-hour 08-16 cells
 * are dimmer to make off-hour status legible at a glance.
 *
 * Sources data from both useMonth("outHos") and useMonth("inHos") — they
 * share the holiday list (only depends on year_month).
 */
export function VerifyDialog({ yearMonth, onClose }: { yearMonth: string; onClose: () => void }) {
  const outMonth = useMonth("outHos", yearMonth);
  const inMonth = useMonth("inHos", yearMonth);
  const setAssign = useSetAssignment();

  const dim = daysInMonth(yearMonth);
  const holidays = outMonth.data?.holidays ?? inMonth.data?.holidays ?? [];

  // Pre-index assignments by (shiftType, date, slot) for O(1) cell lookup.
  const index = useMemo(() => {
    const m = new Map<string, Doctor | null>();
    const add = (shiftType: ShiftType, rows?: { date: string; slot: Slot; doctor_name: string | null }[]) => {
      if (!rows) return;
      for (const a of rows) {
        const d = a.doctor_name && isDoctor(a.doctor_name) ? a.doctor_name : null;
        m.set(`${shiftType}|${a.date}|${a.slot}`, d);
      }
    };
    add("outHos", outMonth.data?.assignments);
    add("inHos", inMonth.data?.assignments);
    return m;
  }, [outMonth.data, inMonth.data]);

  const handleChange = (shiftType: ShiftType, date: string, slot: Slot, value: string) => {
    const nextDoctor: Doctor | null = isDoctor(value) ? value : null;
    setAssign.mutate({ shiftType, date, slot, doctorName: nextDoctor });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <div>
            <h2 className="font-semibold">ตรวจสอบตารางเวร — {formatBEMonth(yearMonth + "-01")}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              คลิก dropdown ใน cell เพื่อเปลี่ยนแพทย์ — บันทึกอัตโนมัติ ·
              แถวสีอ่อน = วันหยุดเสาร์-อาทิตย์ / นักขัตฤกษ์ ·
              cell สีจาง = ในเวลา (08-16 weekday)
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 overflow-auto p-4">
          {(outMonth.isLoading || inMonth.isLoading) ? (
            <p className="text-center text-sm text-zinc-500">กำลังโหลด…</p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-center" rowSpan={2}>วันที่</th>
                  <th className="border border-zinc-200 bg-violet-50 px-2 py-2 text-center" colSpan={3}>เวรชันสูตรนอก</th>
                  <th className="border border-zinc-200 bg-emerald-50 px-2 py-2 text-center" colSpan={3}>เวรชันสูตรใน</th>
                </tr>
                <tr>
                  {[...SLOTS, ...SLOTS].map((s, i) => (
                    <th key={i} className="border border-zinc-200 bg-zinc-50 px-2 py-1 text-center font-normal">
                      {s.replace("-", "–")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: dim }, (_, i) => i + 1).map((d) => {
                  const date = `${yearMonth}-${String(d).padStart(2, "0")}`;
                  const dt = new Date(date + "T00:00:00Z");
                  const dow = dt.getUTCDay();
                  const isWeekend = dow === 0 || dow === 6;
                  const isHoliday = holidays.includes(d);
                  // Weekend + holiday share the same light-red row tint.
                  const rowTint = (isHoliday || isWeekend) ? "bg-rose-50/60" : "";

                  return (
                    <tr key={d} className={rowTint}>
                      <td className="border border-zinc-200 px-2 py-1 text-center">
                        <div className="font-semibold tabular-nums">{d}</div>
                        <div className="text-[10px] text-zinc-400">{WEEKDAY_TH_SHORT[dow]}</div>
                        {isHoliday && <div className="text-[9px] text-rose-600">นักขัตฤกษ์</div>}
                      </td>
                      {(["outHos", "inHos"] as ShiftType[]).flatMap((st) =>
                        SLOTS.map((slot) => {
                          const off = isOffHour(date, slot, holidays);
                          const doctor = index.get(`${st}|${date}|${slot}`) ?? null;
                          return (
                            <td
                              key={`${st}-${slot}`}
                              className={`border border-zinc-200 p-0 ${off ? "" : "bg-zinc-100/40"} ${doctor ? DOCTOR_BG_CLASS[doctor] : ""}`}
                            >
                              <select
                                value={doctor ?? ""}
                                onChange={(e) => handleChange(st, date, slot, e.target.value)}
                                className="w-full bg-transparent px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-300"
                              >
                                <option value="">—</option>
                                {DOCTORS.map((doc) => <option key={doc} value={doc}>{doc}</option>)}
                              </select>
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-zinc-200 px-5 py-3">
          <p className="text-xs text-zinc-500">
            แพทย์ {DOCTORS.length} คน · {dim} วัน · {holidays.length} วันหยุด
          </p>
          <button onClick={onClose} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
            เสร็จสิ้น
          </button>
        </footer>
      </div>
    </div>
  );
}
