import { useState } from "react";
import { X, Plus } from "lucide-react";
import dayjs from "dayjs";
import { useHolidays, useAddHoliday, useRemoveHoliday } from "@/hooks/useShift";
import { formatBEMonth, WEEKDAY_TH_SHORT, toThaiNumerals } from "@/lib/buddhist";

/**
 * Holiday picker — port of Shift_count's two-pane modal:
 *   Top    chip grid: existing holidays with X to delete + "+" tile to open calendar
 *   Bottom calendar grid: 7-col month, click a day to toggle holiday on/off
 *
 * Weekend days are tinted (red text) but NOT auto-flagged as holidays —
 * the off-hour rule already treats Sat/Sun as off-hour without needing an
 * explicit holiday entry. This dialog is for นักขัตฤกษ์ only.
 *
 * Optional `note` (เช่น "แรงงาน") set via a small input below the calendar;
 * applied to whichever day is added next. Empty note is fine.
 */
export function HolidayPickerDialog({ yearMonth, onClose }: { yearMonth: string; onClose: () => void }) {
  const holidays = useHolidays(yearMonth);
  const add = useAddHoliday();
  const remove = useRemoveHoliday();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingNote, setPendingNote] = useState("");

  const days = new Set((holidays.data ?? []).map((h) => h.day));
  const noteByDay = new Map((holidays.data ?? []).map((h) => [h.day, h.note]));

  const dt = dayjs(yearMonth + "-01");
  const dim = dt.daysInMonth();
  const startDow = dt.day(); // 0 = Sun

  function toggleDay(day: number) {
    if (days.has(day)) {
      remove.mutate({ yearMonth, day });
    } else {
      add.mutate({ yearMonth, day, note: pendingNote.trim() || undefined });
      setPendingNote("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 className="font-semibold">วันนักขัตฤกษ์ — {formatBEMonth(yearMonth + "-01")}</h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-100" aria-label="ปิด">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* ─── Chip grid — existing holidays + add tile ─────────────────── */}
          <div className="flex flex-wrap gap-2">
            {(holidays.data ?? []).map((h) => (
              <div
                key={h.day}
                className="group relative flex h-14 w-14 items-center justify-center rounded-xl bg-rose-50 text-base font-bold text-rose-700 ring-1 ring-rose-200"
                title={h.note ?? `วันที่ ${h.day}`}
              >
                <span className="leading-none">{toThaiNumerals(h.day)}</span>
                {h.note && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-1.5 py-0.5 text-[9px] font-medium text-rose-600 ring-1 ring-rose-200">
                    {h.note}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove.mutate({ yearMonth, day: h.day })}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow hover:bg-rose-700"
                  aria-label="ลบ"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCalendarOpen((o) => !o)}
              className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-dashed border-violet-300 text-2xl font-light text-violet-500 hover:bg-violet-50"
              title="เปิด/ปิดปฏิทินเลือกวัน"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {/* ─── Calendar grid — click day to toggle ──────────────────────── */}
          {calendarOpen && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <label className="text-xs text-zinc-500">หมายเหตุ (optional):</label>
                <input
                  type="text"
                  value={pendingNote}
                  onChange={(e) => setPendingNote(e.target.value)}
                  placeholder='เช่น "วันแรงงาน"'
                  className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
                />
              </div>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAY_TH_SHORT.map((dow) => (
                  <div key={dow} className="py-1 text-center text-[10px] font-semibold text-zinc-500">{dow}</div>
                ))}
                {Array.from({ length: startDow }, (_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: dim }, (_, i) => i + 1).map((d) => {
                  const dow = dayjs(yearMonth + "-01").date(d).day();
                  const isWeekend = dow === 0 || dow === 6;
                  const isHoliday = days.has(d);
                  const note = noteByDay.get(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      title={isHoliday ? `คลิกเพื่อลบ${note ? ` (${note})` : ""}` : "คลิกเพื่อตั้งเป็นวันหยุด"}
                      className={`aspect-square rounded-lg text-sm font-medium transition-colors ${
                        isHoliday
                          ? "bg-rose-100 font-bold text-rose-700 ring-1 ring-rose-300"
                          : isWeekend
                            ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "bg-zinc-50 text-zinc-700 hover:bg-violet-100"
                      }`}
                    >
                      {toThaiNumerals(d)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-zinc-400">
                แตะวันเพื่อเปิด/ปิดวันนักขัตฤกษ์ · สีอำพันคือเสาร์-อาทิตย์ (ถือเป็นนอกเวลาอยู่แล้ว ไม่ต้องตั้ง)
              </p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-zinc-200 px-5 py-3">
          <p className="text-xs text-zinc-500">{(holidays.data ?? []).length} วันหยุดในเดือนนี้</p>
          <button onClick={onClose} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
            เสร็จสิ้น
          </button>
        </footer>
      </div>
    </div>
  );
}
