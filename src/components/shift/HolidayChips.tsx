import { useState } from "react";
import { Plus, X, CalendarOff } from "lucide-react";
import { useHolidays, useRemoveHoliday } from "@/hooks/useShift";
import { toThaiNumerals } from "@/lib/buddhist";
import { HolidayPickerDialog } from "@/components/holiday/HolidayPickerDialog";

/**
 * Inline holiday chip display on ShiftMonthPage.
 *
 * Chips show existing holidays — click X to remove. The "+เพิ่มวันหยุด"
 * button opens HolidayPickerDialog (port of Shift_count's calendar
 * popup pattern) for visual day selection.
 */
export function HolidayChips({ yearMonth }: { yearMonth: string }) {
  const holidays = useHolidays(yearMonth);
  const remove = useRemoveHoliday();
  const [pickerOpen, setPickerOpen] = useState(false);

  const list = holidays.data ?? [];

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-600">
        <CalendarOff className="h-4 w-4 text-rose-500" />
        วันหยุดนักขัตฤกษ์ ({list.length})
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {list.map((h) => (
          <button
            key={h.day}
            type="button"
            onClick={() => remove.mutate({ yearMonth, day: h.day })}
            className="group inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
            title={h.note ?? "ลบวันหยุดนี้"}
          >
            <span className="font-semibold">{toThaiNumerals(h.day)}</span>
            {h.note && <span className="text-rose-500/80">· {h.note}</span>}
            <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
          </button>
        ))}

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
        >
          <Plus className="h-3 w-3" /> เพิ่มวันหยุด
        </button>
      </div>

      {pickerOpen && <HolidayPickerDialog yearMonth={yearMonth} onClose={() => setPickerOpen(false)} />}
    </section>
  );
}
