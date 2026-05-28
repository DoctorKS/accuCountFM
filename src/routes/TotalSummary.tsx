import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { DOCTORS, DOCTOR_BG_CLASS, type Doctor } from "@/lib/doctors";
import { currentYearMonth, formatBEMonth } from "@/lib/buddhist";
import { fmtBaht } from "@/lib/utils";
import { useMonth } from "@/hooks/useShift";
import { computeMonthByDoctor } from "@/lib/calc-month";

type Mode = "all" | "outHos" | "inHos";

/** /summary, /summary/out, /summary/in — 4 doctors aggregated for one month. */
export function TotalSummary({ mode }: { mode: Mode }) {
  const [ym, setYm] = useState(currentYearMonth());
  const showOut = mode === "all" || mode === "outHos";
  const showIn = mode === "all" || mode === "inHos";
  const headerLabel =
    mode === "all" ? "เงินเวรรวมทั้งหมด" : mode === "outHos" ? "สรุปเงินเวรชันสูตรนอก" : "สรุปเงินเวรชันสูตรใน";

  // Both queries fire in parallel; mode just decides which columns to show.
  const outMonth = useMonth("outHos", ym);
  const inMonth = useMonth("inHos", ym);

  const totals = useMemo(() => {
    const out = Object.fromEntries(DOCTORS.map((d) => [d, 0])) as unknown as Record<Doctor, number>;
    const inn = Object.fromEntries(DOCTORS.map((d) => [d, 0])) as unknown as Record<Doctor, number>;
    if (outMonth.data) {
      for (const s of computeMonthByDoctor("outHos", outMonth.data.assignments, outMonth.data.cases)) {
        out[s.doctor] = s.total;
      }
    }
    if (inMonth.data) {
      for (const s of computeMonthByDoctor("inHos", inMonth.data.assignments, inMonth.data.cases)) {
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
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">เดือน / ปี</span>
          <input
            type="month"
            value={ym}
            onChange={(e) => setYm(e.target.value || currentYearMonth())}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm"
          />
        </label>
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
