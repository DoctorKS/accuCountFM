import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, ChevronRight } from "lucide-react";
import dayjs from "dayjs";
import type { ShiftType } from "@/lib/constants";
import { SHIFT_TYPE_LABEL } from "@/lib/constants";
import { DOCTORS } from "@/lib/doctors";
import { currentYearMonth, formatBEMonth, toThaiNumerals } from "@/lib/buddhist";
import { fmtBaht } from "@/lib/utils";

/**
 * /out and /in — month-level dashboard:
 *   - Month/year picker (top-left, default = current month)
 *   - "+ เพิ่มตารางเวร" upload button (top-right) — wires to OCR dialog later
 *   - 4 doctor summary cards (อนิรุต / พฤพงศ์ / กนก / กวินท์)
 *
 * Stub: monthly totals shown as ฿ 0 until calc + DB wiring lands.
 */
export function ShiftMonthPage({ shiftType }: { shiftType: ShiftType }) {
  const [ym, setYm] = useState(currentYearMonth());
  const title = SHIFT_TYPE_LABEL[shiftType];
  const route = shiftType === "outHos" ? "out" : "in";

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
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
          disabled
          title="ฟีเจอร์ OCR จะเชื่อมหลัง backend พร้อม"
        >
          <Upload className="h-4 w-4" /> เพิ่มตารางเวร
        </button>
      </div>

      {/* TODO: Interactive Buddhist calendar opens here when ym field is clicked */}
      <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-400">
        ปฏิทินรายวันของ {formatBEMonth(ym + "-01")} จะแสดงที่นี่ (กดวันที่ → เข้าหน้ากรอกเวร)
        <div className="mt-3 grid grid-cols-7 gap-2">
          {Array.from({ length: dayjs(ym + "-01").daysInMonth() }, (_, i) => i + 1).map((d) => {
            const date = `${ym}-${String(d).padStart(2, "0")}`;
            return (
              <Link
                key={d}
                to={`/shift/${route}/${date}`}
                className="rounded-lg border border-zinc-200 bg-white py-2 text-center text-xs font-medium text-zinc-700 hover:border-violet-300 hover:bg-violet-50"
              >
                {toThaiNumerals(d)}
              </Link>
            );
          })}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-500">สรุปเงิน{title}ทั้งเดือน</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {DOCTORS.map((d) => (
            <div key={d} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div>
                <div className="text-xs font-medium text-zinc-500">แพทย์</div>
                <div className="text-lg font-semibold text-zinc-900">{d}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500">ยอดรวม</div>
                <div className="text-xl font-bold text-zinc-900">{fmtBaht(0)}</div>
              </div>
              <Link
                to={`/breakdown/${route}/${encodeURIComponent(d)}/${ym}`}
                className="ml-3 inline-flex items-center gap-1 rounded-lg bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"
              >
                แจกแจงเงินเวร <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
