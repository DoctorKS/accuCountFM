import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SLOTS, SHIFT_TYPE_LABEL, type ShiftType, type Slot, CASE_BONUS_OUT_HOS, CASE_BONUS_IN_HOS } from "@/lib/constants";
import { formatBEFullDate } from "@/lib/buddhist";
import { fmtBaht } from "@/lib/utils";
import { useMonth, useAddCase } from "@/hooks/useShift";
import { computeDay } from "@/lib/calc-month";
import { ShiftSlotCard } from "@/components/shift/ShiftSlotCard";
import { SlotBreakdownCard } from "@/components/shift/SlotBreakdownCard";
import { DOCTORS, DOCTOR_COLOR_HEX, isDoctor, type Doctor } from "@/lib/doctors";
import { findIncompleteCases } from "@/lib/case-validation";

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
  const navigate = useNavigate();
  const shiftType: ShiftType = type === "in" ? "inHos" : "outHos";
  const ym = date ? date.slice(0, 7) : "";
  const backTo = `${type === "in" ? "/in" : "/out"}${ym ? `?ym=${ym}` : ""}`;
  const caseRate = shiftType === "outHos" ? CASE_BONUS_OUT_HOS : CASE_BONUS_IN_HOS;

  const month = useMonth(shiftType, ym);
  const day = useMemo(() => {
    if (!month.data || !date) return null;
    return computeDay(shiftType, date, month.data.assignments, month.data.cases, month.data.holidays);
  }, [month.data, shiftType, date]);

  /**
   * Spawn-and-focus state, lifted up so F1-F3 shortcuts can target any
   * slot (used to live in each ShiftSlotCard separately).
   */
  const [focusCaseId, setFocusCaseId] = useState<number | null>(null);
  const addCase = useAddCase();
  const addCaseToSlot = useCallback((slot: Slot) => {
    if (!date) return;
    addCase.mutate(
      { shiftType, date, slot },
      { onSuccess: (newId) => setFocusCaseId(newId) },
    );
  }, [date, shiftType, addCase]);

  /**
   * Guard the "back" action: any incomplete case (missing CS / leave / return)
   * blocks navigation. We blur the active input first so the most recent
   * keystroke gets flushed before the DB read.
   */
  const guardBack = useCallback((): boolean => {
    if (document.activeElement && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (!month.data || !date) return true;
    const todays = month.data.cases.filter((c) => c.date === date);
    const incomplete = findIncompleteCases(todays, shiftType);
    if (incomplete.length > 0) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return false;
    }
    return true;
  }, [month.data, date, shiftType]);

  /**
   * Keyboard shortcuts:
   *   PageDown → guardBack → navigate(backTo)
   *   F1       → spawn case in slot 0000-0800 + focus the new row
   *   F2       → spawn case in slot 0800-1600
   *   F3       → spawn case in slot 1600-2400
   *
   * preventDefault on F1-F3 because browsers map F1=Help, F2=rename,
   * F3=Find by default. preventDefault on PageDown to override page-scroll.
   */
  useEffect(() => {
    const SLOT_BY_KEY: Record<string, Slot> = {
      F1: "0000-0800",
      F2: "0800-1600",
      F3: "1600-2400",
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "PageDown") {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === "textarea") return;
        e.preventDefault();
        if (guardBack()) navigate(backTo);
        return;
      }
      const slot = SLOT_BY_KEY[e.key];
      if (slot) {
        e.preventDefault();
        addCaseToSlot(slot);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guardBack, navigate, backTo, addCaseToSlot]);

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
        <Link
          to={backTo}
          onClick={(e) => { if (!guardBack()) e.preventDefault(); }}
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" /> กลับไปหน้าก่อน
        </Link>
        <div className="text-center">
          <div className="text-xs text-zinc-500">{SHIFT_TYPE_LABEL[shiftType]}</div>
          <h1 className="text-xl font-bold">{date ? formatBEFullDate(date) : "—"}</h1>
        </div>
        <div className="w-44 text-right text-[10px] text-zinc-400 leading-tight">
          <div>กด PageDown เพื่อกลับ</div>
          <div>F1 / F2 / F3 = เพิ่มเคสใน slot 1 / 2 / 3</div>
        </div>
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
                  focusCaseId={focusCaseId}
                  onAddCase={() => addCaseToSlot(slot)}
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
