import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { SHIFT_TYPE_LABEL, SLOT_LABEL, CASE_BONUS_OUT_HOS, CASE_BONUS_IN_HOS, type ShiftType } from "@/lib/constants";
import { formatBEMonth } from "@/lib/buddhist";
import { fmtBaht } from "@/lib/utils";
import { useMonth } from "@/hooks/useShift";
import { computeMonthByDoctor } from "@/lib/calc-month";
import { isDoctor } from "@/lib/doctors";

/** Row-by-row pay breakdown for one doctor, one type, one month. */
export function DoctorBreakdownPage() {
  const { type, doctor, ym } = useParams<{ type: "out" | "in"; doctor: string; ym: string }>();
  const shiftType: ShiftType = type === "in" ? "inHos" : "outHos";
  // Carry ym back to the month page so the picker stays on the right month.
  const backTo = `${type === "in" ? "/in" : "/out"}${ym ? `?ym=${ym}` : ""}`;
  const doctorName = doctor ? decodeURIComponent(doctor) : "";
  const valid = isDoctor(doctorName);
  const caseRate = shiftType === "outHos" ? CASE_BONUS_OUT_HOS : CASE_BONUS_IN_HOS;

  const month = useMonth(shiftType, ym ?? "");
  const summary = useMemo(() => {
    if (!month.data || !valid) return null;
    return computeMonthByDoctor(shiftType, month.data.assignments, month.data.cases, month.data.holidays)
      .find((s) => s.doctor === doctorName) ?? null;
  }, [month.data, shiftType, valid, doctorName]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link to={backTo} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> กลับ
        </Link>
        <div>
          <div className="text-center text-xs text-zinc-500">{SHIFT_TYPE_LABEL[shiftType]}</div>
          <h1 className="text-center text-xl font-bold">แจกแจงเงินเวร — {doctorName}</h1>
        </div>
        <div className="w-24" />
      </div>
      <p className="text-sm text-zinc-500">{ym ? formatBEMonth(ym + "-01") : "—"}</p>

      {!valid && <p className="text-rose-600">ชื่อแพทย์ไม่ตรงรายชื่อในระบบ</p>}
      {month.isLoading && <p>กำลังโหลด…</p>}

      {summary && (
        <>
          <div className="rounded-2xl bg-violet-50 p-5 ring-1 ring-violet-200">
            <div className="text-xs font-semibold uppercase tracking-wide text-violet-700">รวมเดือน</div>
            <div className="mt-1 text-3xl font-bold text-violet-900 tabular-nums">{fmtBaht(summary.total)}</div>
            <div className="mt-1 text-xs text-violet-700/70">{summary.slots.length} slot</div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 text-left">วันที่</th>
                  <th className="px-4 py-3 text-left">ช่วงเวลา</th>
                  <th className="px-4 py-3 text-right">ฐาน</th>
                  <th className="px-4 py-3 text-right">หักเวลาออก</th>
                  <th className="px-4 py-3 text-right">เคสชันสูตร</th>
                  <th className="px-4 py-3 text-right">รวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {summary.slots.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-400">ยังไม่มีเวรในเดือนนี้</td></tr>
                )}
                {summary.slots.map((s) => (
                  <tr key={`${s.date}|${s.slot}`} className="hover:bg-zinc-50">
                    <td className="px-4 py-2 font-mono text-xs tabular-nums">{s.date}</td>
                    <td className="px-4 py-2">
                      {SLOT_LABEL[s.slot]}{" "}
                      {s.pay.offHour ? (
                        <span className="ml-1 text-[10px] text-rose-600">นอกเวลา</span>
                      ) : (
                        <span className="ml-1 text-[10px] text-zinc-400">ในเวลา</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtBaht(s.pay.base)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-rose-600">
                      {s.pay.deduction ? "−" + fmtBaht(s.pay.deduction) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-700">
                      {s.caseCount > 0
                        ? <><span className="tabular-nums">{s.caseCount}</span> × {caseRate.toLocaleString()}</>
                        : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{fmtBaht(s.pay.total)}</td>
                  </tr>
                ))}
              </tbody>
              {summary.slots.length > 0 && (
                <tfoot className="bg-zinc-50 text-sm font-semibold">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-zinc-600">รวมเดือน</td>
                    <td className="px-4 py-3 text-right tabular-nums text-violet-900">{fmtBaht(summary.total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
