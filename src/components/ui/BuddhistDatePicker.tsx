import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { formatBEFullDate } from "@/lib/buddhist";
import { MonthYearPicker } from "./MonthYearPicker";

/** Display Buddhist-era dates while exchanging ISO Gregorian dates. */
export function BuddhistDatePicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => setMonth(value.slice(0, 7)), [value]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const [year, number] = month.split("-").map(Number);
  const offset = new Date(year, number - 1, 1).getDay();
  const count = new Date(year, number, 0).getDate();
  const move = (delta: number) => {
    const next = new Date(year, number - 1 + delta, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };
  const moveDay = (delta: number) => {
    const [y, m, d] = value.split("-").map(Number);
    const next = new Date(y, m - 1, d + delta);
    onChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`);
    setOpen(false);
  };
  return <div ref={wrap} className="relative inline-block">
    <div className="flex items-center gap-2">
    <button type="button" aria-label="วันก่อนหน้า" onClick={() => moveDay(-1)} className="rounded-lg border border-zinc-300 bg-white p-2 text-zinc-600 hover:bg-violet-50"><ChevronLeft className="h-5 w-5" /></button>
    <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xl font-bold shadow-sm hover:border-violet-400">
      <Calendar className="h-5 w-5 text-violet-500" />{formatBEFullDate(value)}
    </button>
    <button type="button" aria-label="วันถัดไป" onClick={() => moveDay(1)} className="rounded-lg border border-zinc-300 bg-white p-2 text-zinc-600 hover:bg-violet-50"><ChevronRight className="h-5 w-5" /></button>
    </div>
    {open && <div role="dialog" aria-label="เลือกวันที่ พ.ศ." className="absolute left-1/2 top-full z-40 mt-2 w-80 max-w-[90vw] -translate-x-1/2 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl">
      <div className="mb-3 flex items-end justify-between">
        <button type="button" aria-label="เดือนก่อนหน้า" onClick={() => move(-1)} className="rounded p-2 hover:bg-zinc-100"><ChevronLeft className="h-4 w-4" /></button>
        <MonthYearPicker value={month} onChange={setMonth} />
        <button type="button" aria-label="เดือนถัดไป" onClick={() => move(1)} className="rounded p-2 hover:bg-zinc-100"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map(day => <span key={day} className="py-1 text-zinc-500">{day}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          return <button key={date} type="button" aria-label={formatBEFullDate(date)} aria-pressed={date === value}
            onClick={() => { onChange(date); setOpen(false); }}
            className={`rounded-lg py-2 ${date === value ? "bg-violet-600 text-white" : "hover:bg-violet-100"}`}>{i + 1}</button>;
        })}
      </div>
    </div>}
  </div>;
}
