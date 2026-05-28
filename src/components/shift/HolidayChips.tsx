import { useState } from "react";
import { Plus, X, CalendarOff } from "lucide-react";
import dayjs from "dayjs";
import { useHolidays, useAddHoliday, useRemoveHoliday } from "@/hooks/useShift";
import { toThaiNumerals } from "@/lib/buddhist";

/**
 * Inline chip-list of holiday days for the current month. Used on
 * ShiftMonthPage. Adding a holiday promotes ANY in-hour slot on that day
 * to off-hour pay (780 ฿) — see calc::is_off_hour.
 */
export function HolidayChips({ yearMonth }: { yearMonth: string }) {
  const holidays = useHolidays(yearMonth);
  const add = useAddHoliday();
  const remove = useRemoveHoliday();
  const [open, setOpen] = useState(false);
  const [dayInput, setDayInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  const dim = dayjs(yearMonth + "-01").daysInMonth();
  const list = holidays.data ?? [];

  function submit() {
    const day = Number(dayInput);
    if (!Number.isInteger(day) || day < 1 || day > dim) return;
    add.mutate({ yearMonth, day, note: noteInput.trim() || undefined });
    setDayInput(""); setNoteInput(""); setOpen(false);
  }

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

        {open ? (
          <div className="flex items-center gap-1.5 rounded-full bg-zinc-50 px-2 py-1 ring-1 ring-zinc-200">
            <input
              type="number"
              min={1}
              max={dim}
              autoFocus
              placeholder="วันที่"
              value={dayInput}
              onChange={(e) => setDayInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
              className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs"
            />
            <input
              type="text"
              placeholder="เช่น 'แรงงาน'"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
              className="w-32 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs"
            />
            <button onClick={submit} className="rounded-md bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">เพิ่ม</button>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-800"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
          >
            <Plus className="h-3 w-3" /> เพิ่มวันหยุด
          </button>
        )}
      </div>
    </section>
  );
}
