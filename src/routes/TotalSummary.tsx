import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Download, Loader2 } from "lucide-react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { DOCTORS, DOCTOR_COLOR_HEX, isDoctor, type Doctor } from "@/lib/doctors";
import {
  AUTOPSY_CUT_RATE, AUTOPSY_NON_CUT_RATE,
  type ShiftType,
} from "@/lib/constants";
import { currentYearMonth, formatBEMonth } from "@/lib/buddhist";
import { fmtBaht } from "@/lib/utils";
import { useMonth, useAutopsyCounts, useUpsertAutopsyCount } from "@/hooks/useShift";
import { computeMonthByDoctor, type DoctorMonthSummary } from "@/lib/calc-month";
import { exportMonthXlsx, type ShiftBundle } from "@/lib/tauri";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { CasesDialog } from "@/components/cases/CasesDialog";
import type { AssignmentRow, CaseRow } from "@/lib/db";

type Mode = "all" | "outHos" | "inHos";

/** Convert DB-snake_case rows into the camelCase payload Rust expects. */
function toBundle(shiftType: ShiftType, assignments: AssignmentRow[], cases: CaseRow[]): ShiftBundle {
  return {
    assignments: assignments.map((a) => ({
      shiftType, date: a.date, slot: a.slot, doctorName: a.doctor_name,
    })),
    cases: cases.map((c) => ({
      shiftType, date: c.date, slot: c.slot, leaveTime: c.leave_time, returnTime: c.return_time,
    })),
  };
}

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
  const [exporting, setExporting] = useState(false);

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
    const cutPay = ap.cuts * AUTOPSY_CUT_RATE;
    const nonCutPay = ap.non_cuts * AUTOPSY_NON_CUT_RATE;
    const bonusPlusAutopsy = (out?.bonusTotal ?? 0) + (inn?.bonusTotal ?? 0) + cutPay + nonCutPay;
    return {
      doctor: d,
      cuts: ap.cuts,
      nonCuts: ap.non_cuts,
      shiftHourPay,
      bonusPlusAutopsy,
      outTotal: out?.total ?? 0,
      inTotal: inn?.total ?? 0,
      grand: shiftHourPay + bonusPlusAutopsy,
    };
  }), [outByDoctor, inByDoctor, autopsyByDoctor]);

  async function doExport() {
    setExporting(true);
    try {
      const filename = `accuCountFM_${ym}.xlsx`;
      const savePath = await saveDialog({
        defaultPath: filename,
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
      if (!savePath) { setExporting(false); return; }
      const holidays = outMonth.data?.holidays ?? inMonth.data?.holidays ?? [];
      const result = await exportMonthXlsx({
        yearMonth: ym,
        savePath,
        holidays,
        outHos: outMonth.data ? toBundle("outHos", outMonth.data.assignments, outMonth.data.cases) : null,
        inHos: inMonth.data ? toBundle("inHos", inMonth.data.assignments, inMonth.data.cases) : null,
      });
      toast.success(`บันทึก ${result.path}`);
    } catch (e) {
      toast.error("Export ล้มเหลว: " + String(e));
    }
    setExporting(false);
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
          <button
            onClick={doExport}
            disabled={exporting || (outMonth.isLoading || inMonth.isLoading)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export Excel
          </button>
        </div>
      </header>

      {mode === "all"
        ? <AllTable rows={rows} yearMonth={ym} />
        : <SimpleTable
            rows={rows}
            mode={mode}
            yearMonth={ym}
            assignments={(mode === "outHos" ? outMonth.data?.assignments : inMonth.data?.assignments) ?? []}
            cases={(mode === "outHos" ? outMonth.data?.cases : inMonth.data?.cases) ?? []}
          />}
    </div>
  );
}

/* ───── Full 8-column table for /summary ───────────────────────────────── */

function AllTable({ rows, yearMonth }: {
  rows: Array<{
    doctor: Doctor;
    cuts: number;
    nonCuts: number;
    shiftHourPay: number;
    bonusPlusAutopsy: number;
    outTotal: number;
    inTotal: number;
    grand: number;
  }>;
  yearMonth: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-3 text-left">แพทย์</th>
            <th className="px-3 py-3 text-center">ผ่า</th>
            <th className="px-3 py-3 text-center">ผ่าไม่ตัดเนื้อ</th>
            <th className="px-3 py-3 text-right">ค่าชม.เวรนอกเวลา</th>
            <th className="px-3 py-3 text-right">ค่าผ่า+ชันสูตร</th>
            <th className="px-3 py-3 text-right">ค่าเวรชันสูตรนอก</th>
            <th className="px-3 py-3 text-right">ค่าเวรชันสูตรใน</th>
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
              </td>
              <td className="px-3 py-2 text-center">
                <AutopsyInput yearMonth={yearMonth} doctor={r.doctor} field="cuts" value={r.cuts} />
              </td>
              <td className="px-3 py-2 text-center">
                <AutopsyInput yearMonth={yearMonth} doctor={r.doctor} field="non_cuts" value={r.nonCuts} />
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{fmtBaht(r.shiftHourPay)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmtBaht(r.bonusPlusAutopsy)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-violet-700">{fmtBaht(r.outTotal)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{fmtBaht(r.inTotal)}</td>
              <td className="px-3 py-3 text-right font-bold tabular-nums">{fmtBaht(r.grand)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-zinc-50 text-sm font-semibold">
          <tr>
            <td className="px-3 py-3 text-right text-zinc-600" colSpan={3}>รวมทั้งหมด</td>
            <td className="px-3 py-3 text-right tabular-nums">{fmtBaht(sum(rows, "shiftHourPay"))}</td>
            <td className="px-3 py-3 text-right tabular-nums">{fmtBaht(sum(rows, "bonusPlusAutopsy"))}</td>
            <td className="px-3 py-3 text-right tabular-nums">{fmtBaht(sum(rows, "outTotal"))}</td>
            <td className="px-3 py-3 text-right tabular-nums">{fmtBaht(sum(rows, "inTotal"))}</td>
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

/** Editable integer for ผ่า / ผ่าไม่ตัดเนื้อ. Flush on blur or Enter. */
function AutopsyInput({
  yearMonth, doctor, field, value,
}: {
  yearMonth: string;
  doctor: Doctor;
  field: "cuts" | "non_cuts";
  value: number;
}) {
  const [local, setLocal] = useState(String(value));
  const upsert = useUpsertAutopsyCount();

  // Resync local input when the upstream value changes (e.g. after the
  // mutation's invalidation re-fetches and we get the persisted number back).
  // Was a useMemo before — that fires during render and doesn't reliably
  // catch the refetch round-trip, so the UI looked frozen even after save.
  useEffect(() => { setLocal(String(value)); }, [value]);

  const flush = () => {
    const n = parseInt(local || "0", 10);
    if (Number.isNaN(n) || n < 0) { setLocal(String(value)); return; }
    if (n === value) return;
    upsert.mutate({ yearMonth, doctorName: doctor, patch: { [field]: n } });
  };

  return (
    <input
      type="number"
      min={0}
      step={1}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={flush}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-1 text-center text-sm tabular-nums focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
    />
  );
}

/* ───── Simpler table for /summary/out and /summary/in ─────────────────── */

function SimpleTable({ rows, mode, yearMonth, assignments, cases }: {
  rows: Array<{ doctor: Doctor; outTotal: number; inTotal: number }>;
  mode: "outHos" | "inHos";
  yearMonth: string;
  assignments: AssignmentRow[];
  cases: CaseRow[];
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
    for (const c of cases) {
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
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left">แพทย์</th>
              <th className="px-4 py-3 text-center">CS</th>
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
