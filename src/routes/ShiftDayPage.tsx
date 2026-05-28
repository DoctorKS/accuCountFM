import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { SLOTS, SLOT_LABEL, SHIFT_TYPE_LABEL, type ShiftType } from "@/lib/constants";
import { DOCTORS } from "@/lib/doctors";
import { formatBEFullDate } from "@/lib/buddhist";
import { fmtBaht } from "@/lib/utils";

/** /shift/:type/:date — 3 shift cards stacked, with case rows + doctor dropdown each. */
export function ShiftDayPage() {
  const { type, date } = useParams<{ type: "out" | "in"; date: string }>();
  const shiftType: ShiftType = type === "in" ? "inHos" : "outHos";
  const backTo = type === "in" ? "/in" : "/out";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link to={backTo} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> กลับเดือน
        </Link>
        <div className="text-center">
          <div className="text-xs text-zinc-500">{SHIFT_TYPE_LABEL[shiftType]}</div>
          <h1 className="text-xl font-bold">{date ? formatBEFullDate(date) : "—"}</h1>
        </div>
        <div className="w-24" />
      </div>

      <div className="space-y-4">
        {SLOTS.map((slot) => (
          <article key={slot} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">{SLOT_LABEL[slot]}</h2>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">ชื่อแพทย์</span>
                <select className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm">
                  <option value="">—</option>
                  {DOCTORS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
            </header>

            <div className="space-y-2">
              <p className="text-xs text-zinc-400">ยังไม่มีเคส — กด "เพิ่มเคสชันสูตร" ด้านล่าง</p>
            </div>

            <button
              type="button"
              disabled
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
            >
              <Plus className="h-3 w-3" /> เพิ่มเคสชันสูตร
            </button>
          </article>
        ))}
      </div>

      <aside className="rounded-2xl bg-violet-50 p-5 ring-1 ring-violet-200">
        <div className="text-xs font-semibold uppercase tracking-wide text-violet-700">สรุปเงิน{SHIFT_TYPE_LABEL[shiftType]}</div>
        <div className="mt-1 text-3xl font-bold text-violet-900">{fmtBaht(0)}</div>
        <p className="mt-2 text-xs text-violet-700/70">รายละเอียดที่มาของเงินเวรจะแสดงที่นี่หลัง backend พร้อม</p>
      </aside>
    </div>
  );
}
