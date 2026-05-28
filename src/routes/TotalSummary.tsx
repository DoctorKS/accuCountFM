import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Download, Loader2 } from "lucide-react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { DOCTORS, DOCTOR_BG_CLASS, type Doctor } from "@/lib/doctors";
import { currentYearMonth, formatBEMonth } from "@/lib/buddhist";
import { fmtBaht } from "@/lib/utils";
import { useMonth } from "@/hooks/useShift";
import { computeMonthByDoctor } from "@/lib/calc-month";
import { exportMonthXlsx, type ShiftBundle } from "@/lib/tauri";
import type { AssignmentRow, CaseRow } from "@/lib/db";
import type { ShiftType } from "@/lib/constants";

type Mode = "all" | "outHos" | "inHos";

/** /summary, /summary/out, /summary/in — 4 doctors aggregated for one month. */
/** Convert DB-snake_case rows into the camelCase payload Rust expects. */
function toBundle(shiftType: ShiftType, assignments: AssignmentRow[], cases: CaseRow[]): ShiftBundle {
  return {
    assignments: assignments.map((a) => ({
      shiftType,
      date: a.date,
      slot: a.slot,
      doctorName: a.doctor_name,
    })),
    cases: cases.map((c) => ({
      shiftType,
      date: c.date,
      slot: c.slot,
      leaveTime: c.leave_time,
      returnTime: c.return_time,
    })),
  };
}

export function TotalSummary({ mode }: { mode: Mode }) {
  const [ym, setYm] = useState(currentYearMonth());
  const [exporting, setExporting] = useState(false);
  const showOut = mode === "all" || mode === "outHos";
  const showIn = mode === "all" || mode === "inHos";
  const headerLabel =
    mode === "all" ? "เงินเวรรวมทั้งหมด" : mode === "outHos" ? "สรุปเงินเวรชันสูตรนอก" : "สรุปเงินเวรชันสูตรใน";

  // Both queries fire in parallel; mode just decides which columns to show.
  const outMonth = useMonth("outHos", ym);
  const inMonth = useMonth("inHos", ym);

  async function doExport() {
    setExporting(true);
    try {
      const filename = `accuCountFM_${ym}.xlsx`;
      const savePath = await saveDialog({
        defaultPath: filename,
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
      if (!savePath) {
        setExporting(false);
        return;
      }
      const holidays = (outMonth.data?.holidays ?? inMonth.data?.holidays ?? []) as number[];
      const result = await exportMonthXlsx({
        yearMonth: ym,
        savePath,
        holidays,
        outHos: showOut && outMonth.data
          ? toBundle("outHos", outMonth.data.assignments, outMonth.data.cases)
          : null,
        inHos: showIn && inMonth.data
          ? toBundle("inHos", inMonth.data.assignments, inMonth.data.cases)
          : null,
      });
      toast.success(`บันทึก ${result.path}`);
    } catch (e) {
      toast.error("Export ล้มเหลว: " + String(e));
    }
    setExporting(false);
  }

  const totals = useMemo(() => {
    const out = Object.fromEntries(DOCTORS.map((d) => [d, 0])) as unknown as Record<Doctor, number>;
    const inn = Object.fromEntries(DOCTORS.map((d) => [d, 0])) as unknown as Record<Doctor, number>;
    if (outMonth.data) {
      for (const s of computeMonthByDoctor("outHos", outMonth.data.assignments, outMonth.data.cases, outMonth.data.holidays)) {
        out[s.doctor] = s.total;
      }
    }
    if (inMonth.data) {
      for (const s of computeMonthByDoctor("inHos", inMonth.data.assignments, inMonth.data.cases, inMonth.data.holidays)) {
        inn[s.doctor] = s.total;
      }
    }
    return { out, inn };
  }, [outMonth.data, inMonth.data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">{headerLabel}</h1>
          <p className="mt-1 text-sm text-zinc-500">{formatBEMonth(ym + "-01")}</p>
        </div>
        <div className="flex items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">เดือน / ปี</span>
            <input
              type="month"
              value={ym}
              onChange={(e) => setYm(e.target.value || currentYearMonth())}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm"
            />
          </label>
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

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left">แพทย์</th>
              {showOut && <th className="px-4 py-3 text-right">ชันสูตรนอก</th>}
              {showIn && <th className="px-4 py-3 text-right">ชันสูตรใน</th>}
              {mode === "all" && <th className="px-4 py-3 text-right">รวม</th>}
              <th className="px-4 py-3 text-right">แจกแจง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {DOCTORS.map((d) => {
              const o = totals.out[d];
              const i = totals.inn[d];
              const all = o + i;
              return (
                <tr key={d} className={`${DOCTOR_BG_CLASS[d]} hover:opacity-95`}>
                  <td className="px-4 py-3 font-semibold text-zinc-900">{d}</td>
                  {showOut && <td className="px-4 py-3 text-right tabular-nums">{fmtBaht(o)}</td>}
                  {showIn && <td className="px-4 py-3 text-right tabular-nums">{fmtBaht(i)}</td>}
                  {mode === "all" && <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtBaht(all)}</td>}
                  <td className="px-4 py-3 text-right">
                    {mode !== "inHos" && (
                      <Link className="inline-flex items-center gap-1 text-xs text-violet-700 hover:underline"
                            to={`/breakdown/out/${encodeURIComponent(d)}/${ym}`}>
                        out <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                    {mode !== "outHos" && (
                      <Link className="ml-3 inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                            to={`/breakdown/in/${encodeURIComponent(d)}/${ym}`}>
                        in <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
