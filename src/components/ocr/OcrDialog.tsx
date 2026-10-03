import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Upload, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ocrRun, hasApiKey, type OcrResult, type OcrSlot } from "@/lib/tauri";
import { isOffHour } from "@/lib/calc";
import { setAssignmentDoctor, listMonthHolidays } from "@/lib/db";
import { isDoctor, DOCTORS, DOCTOR_BG_CLASS } from "@/lib/doctors";
import type { Slot, ShiftType } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";
import { formatBEMonth } from "@/lib/buddhist";
import { Link } from "react-router-dom";
import { OcrSkullOverlay, SkullSpinner } from "@/components/ui/SkullSpinner";

/**
 * Modal: pick image → invoke OCR → preview → apply.
 *
 * The same image fills BOTH outHos AND inHos assignments for the month —
 * the printed roster has one row per day with columns for both. After OCR
 * runs once, we upsert into shift_assignments for the whole month at once.
 */
export function OcrDialog({ yearMonth, onClose }: { yearMonth: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [busy, setBusy] = useState<"idle" | "ocr" | "apply">("idle");
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pickFile() {
    const picked = await openDialog({
      multiple: false,
      directory: false,
      filters: [{ name: "รูปภาพตารางเวร", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (typeof picked === "string") {
      setImagePath(picked);
      setResult(null);
      setError(null);
    }
  }

  async function runOcr() {
    if (!imagePath) return;
    setBusy("ocr");
    setError(null);
    try {
      const hasKey = await hasApiKey();
      if (!hasKey) {
        setError("ยังไม่ได้ตั้ง Anthropic API Key — ไปที่หน้าตั้งค่า");
        setBusy("idle");
        return;
      }
      const r = await ocrRun({ imagePath, yearMonth });
      if (r.month !== yearMonth) {
        setError(`OCR คืน month '${r.month}' ไม่ตรงกับเดือนปัจจุบัน '${yearMonth}'`);
        setBusy("idle");
        return;
      }
      setResult(r);
    } catch (e) {
      setError(String(e));
    }
    setBusy("idle");
  }

  function editDoctor(day: number, slot: Slot, type: ShiftType, name: string) {
    setResult(previous => previous && ({ ...previous, days: previous.days.map(d =>
      d.date === day ? { ...d, shifts: { ...d.shifts, [slot]: { ...d.shifts[slot], [type]: name } } } : d) }));
    setError(null);
  }

  async function apply() {
    if (!result) return;
    setBusy("apply");
    try {
      const holidays = (await listMonthHolidays(yearMonth)).map(h => h.day);
      for (const d of result.days) {
        const date = `${yearMonth}-${String(d.date).padStart(2, "0")}`;
        for (const [slot, cell] of Object.entries(d.shifts) as [Slot, OcrSlot][]) {
          if (isDoctor(cell.outHos) && cell.outHos === cell.inHos && isOffHour(date, slot, holidays)) {
            throw new Error(`${date} ${slot}: แพทย์อยู่เวรสองประเภทพร้อมกันได้เฉพาะในเวลาราชการ`);
          }
        }
      }
      // Sequential upserts — ~31 days × 3 slots × 2 types = ~186 ops, fine.
      for (const d of result.days) {
        const date = `${yearMonth}-${String(d.date).padStart(2, "0")}`;
        for (const [slot, cell] of Object.entries(d.shifts) as [Slot, OcrSlot][]) {
          // Clear the pair first so swapping two doctors cannot hit an old assignment.
          await setAssignmentDoctor("outHos", date, slot, null);
          await setAssignmentDoctor("inHos", date, slot, null);
          await setAssignmentDoctor("outHos", date, slot, isDoctor(cell.outHos) ? cell.outHos : null);
          await setAssignmentDoctor("inHos", date, slot, isDoctor(cell.inHos) ? cell.inHos : null);
        }
      }
      qc.invalidateQueries({ queryKey: ["month"] });
      toast.success(`เติมตารางเวร ${result.days.length} วันสำเร็จ`);
      onClose();
    } catch (e) {
      setError("apply ล้มเหลว: " + String(e));
    }
    setBusy("idle");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 className="font-semibold">เพิ่มตารางเวร — {formatBEMonth(yearMonth + "-01")}</h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <ol className="text-xs text-zinc-500">
            <li>1. เลือกรูปตารางเวรของเดือนนี้</li>
            <li>2. กด "ส่งให้ OCR อ่าน" — Claude vision จะคืนข้อมูล</li>
            <li>3. ตรวจ preview และแก้ชื่อแพทย์จาก dropdown แล้วกด "ยืนยัน" เพื่อเติมเข้าตาราง (ทับของเดิม)</li>
          </ol>

          <div className="rounded-xl border-2 border-dashed border-zinc-300 p-6">
            {!imagePath ? (
              <button onClick={pickFile} className="mx-auto flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
                <Upload className="h-4 w-4" /> เลือกรูปภาพ
              </button>
            ) : (
              <div className="space-y-3">
                <div className="font-mono text-xs text-zinc-600 break-all">{imagePath}</div>
                <div className="flex gap-2">
                  <button onClick={pickFile} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50">เปลี่ยนรูป</button>
                  <button
                    onClick={runOcr}
                    disabled={busy !== "idle"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {busy === "ocr"
                      ? <SkullSpinner size={14} className="text-white" />
                      : null}
                    ส่งให้ OCR อ่าน
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && !result && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>}
          {error?.includes("API Key") && (
            <Link to="/settings" onClick={onClose} className="text-xs text-violet-700 underline">ไปหน้าตั้งค่า →</Link>
          )}

          {result && <OcrPreview result={result} error={error} disabled={busy !== "idle"} onChange={editDoctor} />}
        </div>

        {result && (
          <footer className="border-t border-zinc-200 px-5 py-3 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50">ยกเลิก</button>
            <button
              onClick={apply}
              disabled={busy !== "idle"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === "apply" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              ยืนยัน — ทับ {result.days.length} วันในเดือนนี้
            </button>
          </footer>
        )}
      </div>

      {/* Full-screen skull overlay during OCR — port of Shift_count's UX. */}
      {busy === "ocr" && <OcrSkullOverlay message="กำลังประมวลผล OCR…" />}
    </div>
  );
}

export function OcrPreview({ result, error, disabled = false, onChange }: {
  result: OcrResult; error?: string | null; disabled?: boolean;
  onChange: (day: number, slot: Slot, type: ShiftType, name: string) => void;
}) {
  const slots: Slot[] = ["0000-0800", "0800-1600", "1600-2400"];
  return <div className="max-h-[45vh] overflow-auto rounded-xl border border-zinc-200">
    <table className="w-full text-xs">
      <thead className="sticky top-0 z-10 bg-zinc-50 shadow-sm">
        {error && <tr><th colSpan={7} className="bg-white p-2 text-left font-normal">
          <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>
        </th></tr>}
        <tr>
        <th className="px-2 py-2">วันที่</th>
        {slots.flatMap(slot => (["outHos", "inHos"] as const).map(type =>
          <th key={slot + type} className="px-2 py-2">{slot.slice(0, 2)}-{slot.slice(5, 7)} {type === "outHos" ? "นอก" : "ใน"}</th>))}
      </tr></thead>
      <tbody className="divide-y divide-zinc-100">{result.days.map(d => <tr key={d.date}>
        <td className="px-2 py-1 text-center font-mono">{d.date} ({d.weekday})</td>
        {slots.flatMap(slot => (["outHos", "inHos"] as const).map(type => {
          const name = d.shifts[slot][type];
          return <td key={slot + type} className={`px-1 py-1 ${isDoctor(name) ? DOCTOR_BG_CLASS[name] : "bg-rose-50"}`}>
            <select value={name} disabled={disabled}
              aria-label={`วันที่ ${d.date} ${slot} ${type === "outHos" ? "ชันสูตรนอก" : "ชันสูตรใน"}`}
              onChange={e => onChange(d.date, slot, type, e.target.value)}
              className="w-full min-w-20 rounded border border-zinc-200 bg-white/70 px-1 py-1 text-xs disabled:opacity-50">
              <option value="">— ไม่ระบุ —</option>
              {name && !isDoctor(name) && <option value={name}>ชื่อไม่ถูกต้อง: {name}</option>}
              {DOCTORS.map(doctor => <option key={doctor} value={doctor}>{doctor}</option>)}
            </select>
          </td>;
        }))}
      </tr>)}</tbody>
    </table>
  </div>;
}
