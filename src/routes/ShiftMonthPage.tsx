import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, ChevronRight } from "lucide-react";
import dayjs from "dayjs";
import { type ShiftType, SHIFT_TYPE_LABEL } from "@/lib/constants";
import { DOCTORS, DOCTOR_BG_CLASS } from "@/lib/doctors";
import { currentYearMonth, formatBEMonth, toThaiNumerals } from "@/lib/buddhist";
import { fmtBaht } from "@/lib/utils";
import { useMonth } from "@/hooks/useShift";
import { computeMonthByDoctor } from "@/lib/calc-month";
import { OcrDialog } from "@/components/ocr/OcrDialog";

/** /out and /in — month picker, calendar grid, 4 doctor summary cards. */
export function ShiftMonthPage({ shiftType }: { shiftType: ShiftType }) {
  const [ym, setYm] = useState(currentYearMonth());
  const [ocrOpen, setOcrOpen] = useState(false);
  const title = SHIFT_TYPE_LABEL[shiftType];
  const route = shiftType === "outHos" ? "out" : "in";

  const month = useMonth(shiftType, ym);

  const summary = useMemo(() => {
    if (!month.data) return null;
    return computeMonthByDoctor(shiftType, month.data.assignments, month.data.cases, month.data.holidays);
  }, [month.data, shiftType]);

  // Day-status hint for the calendar grid: red dot if all 3 slots assigned;
  // amber dot if 1-2 slots assigned; gray if 0.
  const dayStatus = useMemo(() => {
    const m = new Map<string, { assigned: number; cases: number }>();
    if (!month.data) return m;
    for (const a of month.data.assignments) {
      const entry = m.get(a.date) ?? { assigned: 0, cases: 0 };
      if (a.doctor_name) entry.assigned += 1;
      m.set(a.date, entry);
    }
    for (const c of month.data.cases) {
      const entry = m.get(c.date) ?? { assigned: 0, cases: 0 };
      entry.cases += 1;
      m.set(c.date, entry);
    }
    return m;
  }, [month.data]);

  const dim = dayjs(`${ym}-01`).daysInMonth();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> กลับหน้าหลัก
        </Link>
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="w-24" />
      </div>

      <div className="flex items-end justify-between gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">เดือน / ปี</span>
          <input
            type="month"
            value={ym}
            onChange={(e) => setYm(e.target.value || currentYearMonth())}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <span className="mt-1 text-sm font-semibold text-zinc-700">{formatBEMonth(ym + "-01")}</span>
        </label>

        <button
          type="button"
          onClick={() => setOcrOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
        >
          <Upload className="h-4 w-4" /> เพิ่มตารางเวร
        </button>
      </div>

      {ocrOpen && <OcrDialog yearMonth={ym} onClose={() => setOcrOpen(false)} />}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-zinc-500">ปฏิทินรายวัน — {formatBEMonth(ym + "-01")}</div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: dim }, (_, i) => i + 1).map((d) => {
            const date = `${ym}-${String(d).padStart(2, "0")}`;
            const status = dayStatus.get(date);
            const filled = status ? status.assigned : 0;
            const dot = filled === 3 ? "bg-emerald-500" : filled > 0 ? "bg-amber-400" : "bg-zinc-200";
            return (
              <Link
                key={d}
                to={`/shift/${route}/${date}`}
                className="group relative rounded-lg border border-zinc-200 bg-zinc-50 py-3 text-center text-sm font-medium text-zinc-700 hover:border-violet-300 hover:bg-violet-50"
              >
                <div className="text-base font-semibold">{toThaiNumerals(d)}</div>
                <div className={`mx-auto mt-1 h-1.5 w-1.5 rounded-full ${dot}`} />
                {status && status.cases > 0 && (
                  <div className="text-[10px] text-zinc-400 group-hover:text-violet-500">{toThaiNumerals(status.cases)} เคส</div>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-500">สรุปเงิน{title}ทั้งเดือน</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {DOCTORS.map((d) => {
            const ds = summary?.find((s) => s.doctor === d);
            return (
              <div key={d} className={`flex items-center justify-between rounded-xl p-4 shadow-sm ring-1 ${DOCTOR_BG_CLASS[d]}`}>
                <div>
                  <div className="text-xs font-medium text-zinc-500">แพทย์</div>
                  <div className="text-lg font-semibold text-zinc-900">{d}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500">ยอดรวม</div>
                  <div className="text-xl font-bold text-zinc-900 tabular-nums">{fmtBaht(ds?.total ?? 0)}</div>
                </div>
                <Link
                  to={`/breakdown/${route}/${encodeURIComponent(d)}/${ym}`}
                  className="ml-3 inline-flex items-center gap-1 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-white"
                >
                  แจกแจง <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
