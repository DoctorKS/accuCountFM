import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Download, Loader2 } from "lucide-react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { DOCTORS, DOCTOR_COLOR_HEX, DOCTOR_FULL_NAME, isDoctor, type Doctor } from "@/lib/doctors";
import {
  AUTOPSY_CUT_RATE, AUTOPSY_NON_CUT_RATE,
  type ShiftType,
} from "@/lib/constants";
import { currentYearMonth, formatBEMonth } from "@/lib/buddhist";
import { fmtBaht } from "@/lib/utils";
import { useMonth, useAutopsyCounts } from "@/hooks/useShift";
import { computeMonthByDoctor, type DoctorMonthSummary } from "@/lib/calc-month";
import { exportInHosDoctorXlsx, exportCaseDoctorXlsx } from "@/lib/tauri";
import { buildCaseDoctorReport, buildInHosDoctorReport, buildOutHosDoctorReport } from "@/lib/doctor-report";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { CasesDialog } from "@/components/cases/CasesDialog";
import type { AssignmentRow, CaseRow } from "@/lib/db";

type Mode = "all" | "outHos" | "inHos";

/**
 * /summary (mode=all) — 8 columns (per the May 2026 product change):
 *   แพทย์ | ผ่า | ผ่าไม่ตัดเนื้อ | ค่าชม.เวรนอกเวลา | ค่าผ่า+ชันสูตร
 *        | ค่าเวรชันสูตรนอก | ค่าเวรชันสูตรใน | รวม
 *
 * - ผ่า, ผ่าไม่ตัดเนื้อ: editable integer inputs, persist to doctor_autopsy_counts.
 * - ค่าชม.เวรนอกเวลา = Σ (base − deduction) over off-hour slots, both types.
 * - ค่าผ่า+ชันสูตร = Σ case_bonus (both types) + cuts × 4,500 + non_cuts × 2,250.
 * - ค่าเวรชันสูตรนอก / ใน = per-type slot totals (existing computation).
 * - รวม = ค่าชม.เวรนอกเวลา + ค่าผ่า+ชันสูตร.
 *
 * /summary/out (mode=outHos) and /summary/in (mode=inHos) show a 2-column
 * stripped view — doctor + their type total.
 */
export function TotalSummary({ mode }: { mode: Mode }) {
  const [ym, setYm] = useState(currentYearMonth());
  const [exportingDoctor, setExportingDoctor] = useState<Doctor | null>(null);

  const outMonth = useMonth("outHos", ym);
  const inMonth = useMonth("inHos", ym);
  const autopsy = useAutopsyCounts(ym);

  const headerLabel =
    mode === "all" ? "เงินเวรรวมทั้งหมด" :
    mode === "outHos" ? "สรุปเงินเวรชันสูตรนอก" :
    "สรุปเงินเวรชันสูตรใน";

  const outByDoctor = useMemo(() => {
    if (!outMonth.data) return new Map<Doctor, DoctorMonthSummary>();
    return new Map(
      computeMonthByDoctor("outHos", outMonth.data.assignments, outMonth.data.cases, outMonth.data.holidays)
        .map((s) => [s.doctor, s]),
    );
  }, [outMonth.data]);

  const inByDoctor = useMemo(() => {
    if (!inMonth.data) return new Map<Doctor, DoctorMonthSummary>();
    return new Map(
      computeMonthByDoctor("inHos", inMonth.data.assignments, inMonth.data.cases, inMonth.data.holidays)
        .map((s) => [s.doctor, s]),
    );
  }, [inMonth.data]);

  const autopsyByDoctor = useMemo(() => {
    const m = new Map<string, { cuts: number; non_cuts: number }>();
    for (const r of autopsy.data ?? []) {
      m.set(r.doctor_name, { cuts: r.cuts, non_cuts: r.non_cuts });
    }
    return m;
  }, [autopsy.data]);

  const rows = useMemo(() => DOCTORS.map((d) => {
    const out = outByDoctor.get(d);
    const inn = inByDoctor.get(d);
    const ap = autopsyByDoctor.get(d) ?? { cuts: 0, non_cuts: 0 };
    const shiftHourPay = (out?.offHourBaseTotal ?? 0) + (inn?.offHourBaseTotal ?? 0);
    const surgeryCount = (data: typeof outMonth.data) => data?.cases.filter(c => c.case_kind === "surgery" && (c.surgeon_name ? c.surgeon_name === d : data.assignments.some(a => a.date === c.date && a.slot === c.slot && a.doctor_name === d))).length ?? 0;
    const outSurgery = surgeryCount(outMonth.data) * AUTOPSY_CUT_RATE;
    const inSurgery = surgeryCount(inMonth.data) * AUTOPSY_CUT_RATE;
    const cutPay = ap.cuts * AUTOPSY_CUT_RATE;
    const surgeryPay = cutPay + outSurgery + inSurgery;
    const nonCutPay = ap.non_cuts * AUTOPSY_NON_CUT_RATE;
    const bonusPlusAutopsy = (out?.bonusTotal ?? 0) + (inn?.bonusTotal ?? 0) - outSurgery - inSurgery + nonCutPay;
    return {
      doctor: d,
      cuts: ap.cuts,
      nonCuts: ap.non_cuts,
      shiftHourPay,
      bonusPlusAutopsy,
      surgeryPay,
      outTotal: (out?.total ?? 0) - outSurgery,
      inTotal: (inn?.total ?? 0) - inSurgery,
      grand: shiftHourPay + bonusPlusAutopsy + surgeryPay,
    };
  }), [outByDoctor, inByDoctor, autopsyByDoctor, outMonth.data, inMonth.data]);

  async function doExportDoctor(doctor: Doctor) {
    const data = mode === "outHos" ? outMonth.data : inMonth.data;
    if (!data || exportingDoctor) return;
    setExportingDoctor(doctor);
    try {
      const savePath = await saveDialog({
        defaultPath: `รายงานเวรชันสูตร${mode === "outHos" ? "นอก" : "ใน"}_${doctor}_${ym}.xlsx`,
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
      if (!savePath) return;
      const path = await exportInHosDoctorXlsx({
        yearMonth: ym, doctorFullName: DOCTOR_FULL_NAME[doctor], savePath,
        shiftType: mode === "outHos" ? "outHos" : "inHos",
        rows: (mode === "outHos" ? buildOutHosDoctorReport : buildInHosDoctorReport)(doctor, ym, data.assignments, data.cases, data.holidays),
      });
      toast.success(`บันทึก ${path}`);
    } catch (error) {
      toast.error("Export ล้มเหลว: " + String(error));
    } finally {
      setExportingDoctor(null);
    }
  }

  async function doExportCases(doctor: Doctor) {
    if (!outMonth.data || !inMonth.data) return;
    setExportingDoctor(doctor);
    try {
      const reportRows = buildCaseDoctorReport(doctor, ym,
        [...outMonth.data.assignments, ...inMonth.data.assignments],
        [...outMonth.data.cases, ...inMonth.data.cases]);
      const savePath = await saveDialog({ defaultPath: `รายงานเคส_${doctor}_${ym}.xlsx`, filters: [{ name: "Excel", extensions: ["xlsx"] }] });
      if (!savePath) return;
      const path = await exportCaseDoctorXlsx({ yearMonth: ym, doctorFullName: DOCTOR_FULL_NAME[doctor], savePath, rows: reportRows });
      toast.success(`บันทึก ${path}`);
    } catch (error) { toast.error("Export ล้มเหลว: " + String(error)); }
    finally { setExportingDoctor(null); }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">{headerLabel}</h1>
          <p className="mt-1 text-sm text-zinc-500">{formatBEMonth(ym + "-01")}</p>
        </div>
        <div className="flex items-end gap-3">
          <MonthYearPicker value={ym} onChange={setYm} />

        </div>
      </header>

      {(outMonth.error || inMonth.error || autopsy.error) && <p role="alert" className="text-sm text-rose-600">โหลดข้อมูลล้มเหลว: {String(outMonth.error ?? inMonth.error ?? autopsy.error)}</p>}
      {mode === "all"
        ? <AllTable rows={rows} onExportDoctor={outMonth.data && inMonth.data ? doExportCases : undefined} exportingDoctor={exportingDoctor} />
        : <SimpleTable
            rows={rows}
            mode={mode}
            yearMonth={ym}
            onExportDoctor={(mode === "outHos" ? outMonth.data : inMonth.data) ? doExportDoctor : undefined}
            exportingDoctor={exportingDoctor}
            assignments={(mode === "outHos" ? outMonth.data?.assignments : inMonth.data?.assignments) ?? []}
            cases={(mode === "outHos" ? outMonth.data?.cases : inMonth.data?.cases) ?? []}
          />}
    </div>
  );
}

/* ───── Full 8-column table for /summary ───────────────────────────────── */

function AllTable({ rows, onExportDoctor, exportingDoctor }: {
  onExportDoctor?: (doctor: Doctor) => void;
  exportingDoctor: Doctor | null;
  rows: Array<{
    doctor: Doctor;
    cuts: number;
    nonCuts: number;
    shiftHourPay: number;
    bonusPlusAutopsy: number;
    surgeryPay: number;
    outTotal: number;
    inTotal: number;
    grand: number;
  }>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-3 text-left">แพทย์</th>
            <th className="px-3 py-3 text-right">ค่าชม.เวรนอกเวลา</th>
            <th className="px-3 py-3 text-right">ค่าเวรชันสูตรนอก</th>
            <th className="px-3 py-3 text-right">ค่าเวรชันสูตรใน</th>
            <th className="px-3 py-3 text-right">ค่าผ่าชันสูตร</th>
            <th className="px-3 py-3 text-right">รวม</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <tr key={r.doctor} className="hover:bg-zinc-50">
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <span className="h-2 w-2 rounded-full" style={{ background: DOCTOR_COLOR_HEX[r.doctor] }} />
                  {r.doctor}
                </span>
                <button onClick={() => onExportDoctor?.(r.doctor)} disabled={!onExportDoctor || exportingDoctor !== null}
                  className="ml-2 inline-flex items-center gap-1 rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-700 disabled:opacity-50">
                  {exportingDoctor === r.doctor ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Export Excel
                </button>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{fmtBaht(r.shiftHourPay)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-violet-700">{fmtBaht(r.outTotal)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{fmtBaht(r.inTotal)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-[#455766]">{fmtBaht(r.surgeryPay)}</td>
              <td className="px-3 py-3 text-right font-bold tabular-nums">{fmtBaht(r.grand)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-zinc-50 text-sm font-semibold">
          <tr>
            <td className="px-3 py-3 text-right text-zinc-600" >รวมทั้งหมด</td>
            <td className="px-3 py-3 text-right tabular-nums">{fmtBaht(sum(rows, "shiftHourPay"))}</td>
            <td className="px-3 py-3 text-right tabular-nums">{fmtBaht(sum(rows, "outTotal"))}</td>
            <td className="px-3 py-3 text-right tabular-nums">{fmtBaht(sum(rows, "inTotal"))}</td>
            <td className="px-3 py-3 text-right tabular-nums">{fmtBaht(sum(rows, "surgeryPay"))}</td>
            <td className="px-3 py-3 text-right tabular-nums text-violet-900">{fmtBaht(sum(rows, "grand"))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function sum<T, K extends keyof T>(arr: T[], key: K): number {
  return arr.reduce<number>((acc, x) => acc + (x[key] as unknown as number), 0);
}

/* ───── Simpler table for /summary/out and /summary/in ─────────────────── */

function SimpleTable({ rows, mode, yearMonth, assignments, cases, onExportDoctor, exportingDoctor }: {
  rows: Array<{ doctor: Doctor; outTotal: number; inTotal: number }>;
  mode: "outHos" | "inHos";
  yearMonth: string;
  assignments: AssignmentRow[];
  cases: CaseRow[];
  onExportDoctor?: (doctor: Doctor) => void;
  exportingDoctor?: Doctor | null;
}) {
  const isOut = mode === "outHos";
  const shiftType: ShiftType = isOut ? "outHos" : "inHos";
  const colLabel = isOut ? "ค่าเวรชันสูตรนอก" : "ค่าเวรชันสูตรใน";
  const tone = isOut ? "text-violet-700" : "text-emerald-700";
  const route = isOut ? "out" : "in";
  const [csDialogDoctor, setCsDialogDoctor] = useState<Doctor | null>(null);

  // Group cases by the doctor assigned to each (date, slot). Cases without
  // an assigned doctor are dropped from per-doctor totals (they'd pay nobody).
  const casesByDoctor = useMemo(() => {
    const slotToDoctor = new Map<string, Doctor>();
    for (const a of assignments) {
      if (a.doctor_name && isDoctor(a.doctor_name)) {
        slotToDoctor.set(`${a.date}|${a.slot}`, a.doctor_name);
      }
    }
    const m = new Map<Doctor, CaseRow[]>();
    for (const c of cases.filter(c => c.case_kind !== "surgery")) {
      const d = slotToDoctor.get(`${c.date}|${c.slot}`);
      if (!d) continue;
      const arr = m.get(d) ?? [];
      arr.push(c);
      m.set(d, arr);
    }
    return m;
  }, [assignments, cases]);

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left">แพทย์</th>
              <th className="px-4 py-3 text-center">เคสชันสูตร</th>
              <th className="px-4 py-3 text-right">{colLabel}</th>
              <th className="px-4 py-3 text-right">แจกแจง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => {
              const v = isOut ? r.outTotal : r.inTotal;
              const csCount = casesByDoctor.get(r.doctor)?.length ?? 0;
              return (
                <tr key={r.doctor} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <span className="h-2 w-2 rounded-full" style={{ background: DOCTOR_COLOR_HEX[r.doctor] }} />
                      {r.doctor}
                    </span>
                    {!isOut && <button type="button" onClick={() => onExportDoctor?.(r.doctor)}
                      disabled={!onExportDoctor || !!exportingDoctor}
                      className="ml-3 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                      aria-label={`Export เวรชันสูตรในของ ${r.doctor}`}>
                      {exportingDoctor === r.doctor ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      Export
                    </button>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {csCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setCsDialogDoctor(r.doctor)}
                        className={`rounded-md px-2.5 py-1 text-sm font-semibold tabular-nums ring-1 ring-zinc-200 hover:bg-zinc-100 ${tone}`}
                        title="คลิกเพื่อดูรายการ CS"
                      >
                        {csCount}
                      </button>
                    ) : (
                      <span className="text-zinc-300 tabular-nums">0</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${tone}`}>{fmtBaht(v)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/breakdown/${route}/${encodeURIComponent(r.doctor)}/${yearMonth}`}
                      className={`inline-flex items-center gap-1 text-xs hover:underline ${tone}`}
                    >
                      ดู row-by-row <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-zinc-50 text-sm font-semibold">
            <tr>
              <td className="px-4 py-3 text-right text-zinc-600">รวมทั้งหมด</td>
              <td className="px-4 py-3 text-center tabular-nums">
                {Array.from(casesByDoctor.values()).reduce((a, arr) => a + arr.length, 0)}
              </td>
              <td className={`px-4 py-3 text-right tabular-nums ${tone}`}>
                {fmtBaht(rows.reduce((a, r) => a + (isOut ? r.outTotal : r.inTotal), 0))}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {csDialogDoctor && (
        <CasesDialog
          doctor={csDialogDoctor}
          shiftType={shiftType}
          yearMonth={yearMonth}
          cases={casesByDoctor.get(csDialogDoctor) ?? []}
          onClose={() => setCsDialogDoctor(null)}
        />
      )}
    </>
  );
}
