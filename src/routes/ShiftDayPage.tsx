import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { SLOTS, SHIFT_TYPE_LABEL, type ShiftType, type Slot } from "@/lib/constants";
import { formatBEFullDate } from "@/lib/buddhist";
import { fmtBaht } from "@/lib/utils";
import { useMonth } from "@/hooks/useShift";
import { computeDay } from "@/lib/calc-month";
import { ShiftSlotCard } from "@/components/shift/ShiftSlotCard";
import { DOCTORS, DOCTOR_BG_CLASS, DOCTOR_COLOR_HEX, isDoctor, type Doctor } from "@/lib/doctors";

/**
 * One day's shift schedule for a given shift_type.
 * Loads the full month so chain detection (16-24 → next-day 00-08) works.
 */
export function ShiftDayPage() {
  const { type, date } = useParams<{ type: "out" | "in"; date: string }>();
  const shiftType: ShiftType = type === "in" ? "inHos" : "outHos";
  const backTo = type === "in" ? "/in" : "/out";
  const ym = date ? date.slice(0, 7) : "";

  const month = useMonth(shiftType, ym);
  const day = useMemo(() => {
    if (!month.data || !date) return null;
    return computeDay(shiftType, date, month.data.assignments, month.data.cases, month.data.holidays);
  }, [month.data, shiftType, date]);

  // Per-doctor totals for THIS day — sum across the 3 slots if the same
  // doctor was assigned to more than one. Doctors who appear nowhere today
  // are omitted.
  const perDoctor = useMemo(() => {
    if (!day) return [] as { doctor: Doctor; total: number; slots: number }[];
    const map = new Map<Doctor, { total: number; slots: number }>();
    for (const slot of Object.values(day.slots)) {
      if (!slot || !slot.doctor) continue;
      const cur = map.get(slot.doctor) ?? { total: 0, slots: 0 };
      cur.total += slot.pay.total;
      cur.slots += 1;
      map.set(slot.doctor, cur);
    }
    return DOCTORS
      .filter((d) => map.has(d))
      .map((d) => ({ doctor: d, ...(map.get(d)!) }));
  }, [day]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link to={backTo} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> กลับเดือน
        </Link>
        <div className="text-center">
          <div className="text-xs text-zinc-500">{SHIFT_TYPE_LABEL[shiftType]}</div>
          <h1 className="text-xl font-bold">{date ? formatBEFullDate(date) : "—"}</h1>
        </div>
        <div className="w-24" />
      </div>

      {month.isLoading && <p className="text-sm text-zinc-500">กำลังโหลด…</p>}
      {month.error && <p className="text-sm text-rose-600">โหลดข้อมูลล้มเหลว: {String(month.error)}</p>}

      {month.data && date && (
        <div className="space-y-4">
          {SLOTS.map((slot: Slot) => {
            const assignment = month.data.assignments.find((a) => a.date === date && a.slot === slot);
            const doctor = assignment?.doctor_name && isDoctor(assignment.doctor_name) ? assignment.doctor_name : null;
            const cases = month.data.cases.filter((c) => c.date === date && c.slot === slot);
            return (
              <ShiftSlotCard
                key={slot}
                shiftType={shiftType}
                date={date}
                slot={slot}
                assignedDoctor={doctor}
                cases={cases}
                computed={day?.slots[slot] ?? null}
              />
            );
          })}
        </div>
      )}

      {/* ─── Per-doctor day summary (instead of single-total card) ────── */}
      <aside className="rounded-2xl bg-violet-50 p-5 ring-1 ring-violet-200">
        <div className="text-xs font-semibold uppercase tracking-wide text-violet-700">
          สรุปเงิน{SHIFT_TYPE_LABEL[shiftType]}วันนี้
        </div>
        {perDoctor.length === 0 ? (
          <div className="mt-3 text-sm text-violet-700/70">ยังไม่มีแพทย์ในเวรวันนี้</div>
        ) : (
          <div className="mt-3 space-y-2">
            {perDoctor.map(({ doctor, total, slots }) => (
              <div
                key={doctor}
                className={`flex items-center justify-between rounded-xl bg-white/70 px-4 py-3 ring-1 ring-zinc-200 ${DOCTOR_BG_CLASS[doctor]}`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: DOCTOR_COLOR_HEX[doctor] }} />
                  <span className="font-semibold text-zinc-900">{doctor}</span>
                  <span className="text-xs text-zinc-500">({slots} slot)</span>
                </div>
                <div className="text-xl font-bold text-zinc-900 tabular-nums">{fmtBaht(total)}</div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-violet-200 pt-2 text-sm font-semibold text-violet-900">
              <span>รวมทั้งหมด</span>
              <span className="tabular-nums">{fmtBaht(day?.total ?? 0)}</span>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
