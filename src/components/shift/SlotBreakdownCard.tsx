import { SLOT_LABEL, DEDUCT_PER_HALF_HOUR } from "@/lib/constants";
import { fmtBaht } from "@/lib/utils";
import { DOCTOR_COLOR_HEX, isDoctor } from "@/lib/doctors";
import type { SlotComputed } from "@/lib/calc-month";

/**
 * Per-slot pay breakdown sub-card — rendered in the right-side gray panel
 * of ShiftDayPage. Decomposes the slot total into base / deduction / case
 * bonus so the user sees exactly where each baht came from.
 */
export function SlotBreakdownCard({
  computed, caseCount, caseRate,
}: {
  computed: SlotComputed;
  caseCount: number;
  caseRate: number;
}) {
  const { pay, doctor, slot } = computed;
  const deductUnits = pay.deduction > 0 ? Math.round(pay.deduction / DEDUCT_PER_HALF_HOUR) : 0;

  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-zinc-700">{SLOT_LABEL[slot]}</span>
        <span className="inline-flex items-center gap-1 text-zinc-600">
          {doctor && isDoctor(doctor) && (
            <span className="h-2 w-2 rounded-full" style={{ background: DOCTOR_COLOR_HEX[doctor] }} />
          )}
          {doctor ?? "—"}
        </span>
      </div>
      <div className="space-y-0.5 text-xs">
        {pay.base > 0 ? (
          <Line
            label={pay.offHour ? "เวรนอกเวลา" : "เวรในเวลา"}
            amount={pay.base}
          />
        ) : (
          <div className="text-[10px] italic text-zinc-400">ในเวลา 08-16 weekday — ไม่มีเงินเวร</div>
        )}
        {pay.deduction > 0 && (
          <Line
            label={`หักเวลาออก ${deductUnits}×${DEDUCT_PER_HALF_HOUR}`}
            amount={-pay.deduction}
            tone="negative"
          />
        )}
        {pay.caseBonus > 0 && (
          <Line
            label={`เคสชันสูตร ${caseCount}×${caseRate.toLocaleString()}`}
            amount={pay.caseBonus}
            tone="positive"
          />
        )}
        <div className="mt-1 flex items-center justify-between border-t border-zinc-100 pt-1 font-bold">
          <span className="text-zinc-700">รวม slot นี้</span>
          <span className="tabular-nums text-zinc-900">{fmtBaht(pay.total)}</span>
        </div>
      </div>
    </div>
  );
}

function Line({ label, amount, tone = "neutral" }: {
  label: string; amount: number; tone?: "neutral" | "negative" | "positive";
}) {
  const color =
    tone === "negative" ? "text-rose-700" :
    tone === "positive" ? "text-emerald-700" :
    "text-zinc-700";
  const sign = amount >= 0 ? "" : "−";
  return (
    <div className={`flex items-center justify-between ${color}`}>
      <span>{label}</span>
      <span className="tabular-nums">{sign}{fmtBaht(Math.abs(amount))}</span>
    </div>
  );
}
