import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { SLOTS, SHIFT_TYPE_LABEL, type ShiftType, type Slot, CASE_BONUS_OUT_HOS, CASE_BONUS_IN_HOS } from "@/lib/constants";
import { formatBEFullDate } from "@/lib/buddhist";
import { fmtBaht } from "@/lib/utils";
import { useMonth } from "@/hooks/useShift";
import { computeDay } from "@/lib/calc-month";
import { ShiftSlotCard } from "@/components/shift/ShiftSlotCard";
import { SlotBreakdownCard } from "@/components/shift/SlotBreakdownCard";
import { DOCTORS, DOCTOR_COLOR_HEX, isDoctor, type Doctor } from "@/lib/doctors";

/**
 * One day's shift schedule for a given shift_type.
 *
 * Layout: 2-column on lg+ —
 *   Left  col-span-8 : 3 slot cards (input)
 *   Right col-span-4 : gray sticky panel with per-slot breakdown + per-doctor
 *                       totals (all output / read-only).
 */
export function ShiftDayPage() {
  const { type, date } = useParams<{ type: "out" | "in"; date: string }>();
  const shiftType: ShiftType = type === "in" ? "inHos" : "outHos";
  const ym = date ? date.slice(0, 7) : "";
  // Preserve the user's selected month on the way back to /out or /in.
  // (Dashboard → /out or /in stays parameter-less, so opens on the current month.)
  const backTo = `${type === "in" ? "/in" : "/out"}${ym ? `?ym=${ym}` : ""}`;
  const caseRate = shiftType === "outHos" ? CASE_BONUS_OUT_HOS : CASE_BONUS_IN_HOS;

  const month = useMonth(shiftType, ym);
  const day = useMemo(() => {
    if (!month.data || !date) return null;
    return computeDay(shiftType, date, month.data.assignments, month.data.cases, month.data.holidays);
  }, [month.data, shiftType, date]);

  // Per-doctor totals — sum across the 3 slots if same doctor.
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
    <div className="mx-auto max-w-7xl space-y-6 p-6">
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ─── Left column: input cards ───────────────────────────────── */}
          <div className="space-y-4 lg:col-span-8">
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

          {/* ─── Right column: gray summary panel ───────────────────────── */}
          <aside className="lg:col-span-4">
            <div className="sticky top-4 space-y-3 rounded-2xl bg-zinc-100 p-4 ring-1 ring-zinc-200">
              <div>
                <h3 className="text-sm font-bold text-zinc-700">สรุปเงิน{SHIFT_TYPE_LABEL[shiftType]}วันนี้</h3>
                <p className="mt-0.5 text-[10px] text-zinc-500">{date ? formatBEFullDate(date) : ""}</p>
              </div>

              {/* Per-slot breakdown cards */}
              <div className="space-y-2">
                {SLOTS.map((slot: Slot) => {
                  const c = day?.slots[slot] ?? null;
                  if (!c) return (
                    <div key={slot} className="rounded-xl bg-white/60 px-3 py-2 text-[11px] text-zinc-400 ring-1 ring-zinc-200">
                      <span className="font-semibold">{slot.replace("-", "–")}</span> · ยังไม่มีแพทย์
                    </div>
                  );
                  const cs = month.data.cases.filter((cc) => cc.date === date && cc.slot === slot);
                  return (
                    <SlotBreakdownCard
                      key={slot}
                      computed={c}
                      caseCount={cs.length}
                      caseRate={caseRate}
                    />
                  );
                })}
              </div>

              {/* Per-doctor totals */}
              {perDoctor.length > 0 && (
                <div className="space-y-2 border-t border-zinc-300 pt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    รวมต่อแพทย์
                  </div>
                  {perDoctor.map(({ doctor, total, slots }) => (
                    <div
                      key={doctor}
                      className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="h-2 w-2 rounded-full" style={{ background: DOCTOR_COLOR_HEX[doctor] }} />
                        <span className="font-semibold text-zinc-900">{doctor}</span>
                        <span className="text-zinc-400">({slots} slot)</span>
                      </div>
                      <div className="text-sm font-bold tabular-nums text-zinc-900">{fmtBaht(total)}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl bg-violet-600 px-4 py-3 text-white">
                <span className="text-xs font-semibold uppercase tracking-wide">รวมวันนี้</span>
                <span className="text-xl font-bold tabular-nums">{fmtBaht(day?.total ?? 0)}</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
