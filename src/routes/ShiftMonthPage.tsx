import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Upload, ChevronRight, ClipboardList } from "lucide-react";
import { type ShiftType, SHIFT_TYPE_LABEL } from "@/lib/constants";
import { DOCTORS, DOCTOR_BG_CLASS } from "@/lib/doctors";
import { currentYearMonth, formatBEMonth, daysInMonth, firstDowOfMonth, WEEKDAY_TH_SHORT } from "@/lib/buddhist";
import { fmtBaht } from "@/lib/utils";
import { useMonth } from "@/hooks/useShift";
import { computeMonthByDoctor } from "@/lib/calc-month";
import { OcrDialog } from "@/components/ocr/OcrDialog";
import { VerifyDialog } from "@/components/verify/VerifyDialog";
import { HolidayChips } from "@/components/shift/HolidayChips";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";

/**
 * /out and /in — month picker, calendar grid (left), 4 doctor cards (right).
 *
 * The active month lives in the URL as `?ym=YYYY-MM`. When the user enters
 * from the Dashboard (no query) we default to the current month; when they
 * navigate back from ShiftDayPage we preserve the month they were on.
 */
export function ShiftMonthPage({ shiftType }: { shiftType: ShiftType }) {
  const [params, setParams] = useSearchParams();
  const qsYm = params.get("ym");
  const ym = qsYm && /^\d{4}-\d{2}$/.test(qsYm) ? qsYm : currentYearMonth();
  const setYm = (next: string) => {
    // `replace` so back/forward doesn't pile up history entries for each pick.
    setParams({ ym: next }, { replace: true });
  };

  const [ocrOpen, setOcrOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const title = SHIFT_TYPE_LABEL[shiftType];
  const route = shiftType === "outHos" ? "out" : "in";

  const month = useMonth(shiftType, ym);

  const summary = useMemo(() => {
    if (!month.data) return null;
    return computeMonthByDoctor(shiftType, month.data.assignments, month.data.cases, month.data.holidays);
  }, [month.data, shiftType]);

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

  const dim = daysInMonth(ym);
  const startDow = firstDowOfMonth(ym);
  const holidays = month.data?.holidays ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> กลับหน้าหลัก
        </Link>
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="w-24" />
      </div>

      <div className="flex items-end justify-between gap-4">
        <MonthYearPicker value={ym} onChange={setYm} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVerifyOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-200"
          >
            <ClipboardList className="h-4 w-4" /> ตรวจสอบตารางเวร
          </button>
          <button
            type="button"
            onClick={() => setOcrOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
          >
            <Upload className="h-4 w-4" /> เพิ่มตารางเวร
          </button>
        </div>
      </div>

      <HolidayChips yearMonth={ym} />

      {ocrOpen && <OcrDialog yearMonth={ym} onClose={() => setOcrOpen(false)} />}
      {verifyOpen && <VerifyDialog yearMonth={ym} onClose={() => setVerifyOpen(false)} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ─── Calendar (smaller tiles to fit alongside doctor cards) ─── */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 lg:col-span-8">
          <div className="mb-3 text-sm font-semibold text-zinc-500">
            ปฏิทินรายวัน — {formatBEMonth(ym + "-01")}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_TH_SHORT.map((dow, i) => (
              <div
                key={dow}
                className={`py-1.5 text-center text-xs font-semibold ${i === 0 || i === 6 ? "text-rose-500" : "text-zinc-500"}`}
              >
                {dow}
              </div>
            ))}

            {Array.from({ length: startDow }, (_, i) => (
              <div key={`empty-${i}`} aria-hidden />
            ))}

            {Array.from({ length: dim }, (_, i) => i + 1).map((d) => {
              const date = `${ym}-${String(d).padStart(2, "0")}`;
              const status = dayStatus.get(date);
              const filled = status ? status.assigned : 0;
              const dot = filled === 3 ? "bg-emerald-500" : filled > 0 ? "bg-amber-400" : "bg-zinc-200";
              const dt = new Date(date + "T00:00:00Z");
              const dow = dt.getUTCDay();
              const isWeekend = dow === 0 || dow === 6;
              const isHoliday = holidays.includes(d);
              // Per request: weekend + holiday share the same light-red BG.
              const tileBg = (isWeekend || isHoliday)
                ? "bg-rose-50 border-rose-200 hover:bg-rose-100"
                : "bg-zinc-50 border-zinc-200 hover:bg-violet-50";
              return (
                <Link
                  key={d}
                  to={`/shift/${route}/${date}`}
                  className={`group relative flex h-16 flex-col items-center justify-center rounded-xl border text-zinc-700 transition-colors ${tileBg}`}
                  title={isHoliday ? "วันหยุดนักขัตฤกษ์" : isWeekend ? "วันหยุดสุดสัปดาห์" : ""}
                >
                  <div className="text-base font-semibold leading-none tabular-nums">{d}</div>
                  <div className={`mt-1 h-1.5 w-1.5 rounded-full ${dot}`} />
                  {status && status.cases > 0 && (
                    <div className="mt-0.5 text-[9px] tabular-nums text-zinc-500 group-hover:text-violet-600">
                      {status.cases} เคส
                    </div>
                  )}
                  {isHoliday && (
                    <div className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        {/* ─── Doctor summary cards (stacked vertically on the right) ──── */}
        <section className="space-y-3 lg:col-span-4">
          <h2 className="text-sm font-semibold text-zinc-500">สรุปเงิน{title}ทั้งเดือน</h2>
          {DOCTORS.map((d) => {
            const ds = summary?.find((s) => s.doctor === d);
            return (
              <div key={d} className={`flex items-center justify-between rounded-xl p-3 shadow-sm ring-1 ${DOCTOR_BG_CLASS[d]}`}>
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">แพทย์</div>
                  <div className="truncate text-base font-semibold text-zinc-900">{d}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-zinc-500">ยอดรวม</div>
                  <div className="text-lg font-bold text-zinc-900 tabular-nums">{fmtBaht(ds?.total ?? 0)}</div>
                </div>
                <Link
                  to={`/breakdown/${route}/${encodeURIComponent(d)}/${ym}`}
                  className="ml-2 inline-flex items-center gap-0.5 rounded-md bg-white/70 px-2 py-1 text-[10px] font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-white"
                >
                  แจกแจง <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
