import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Upload, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ocrRun, hasApiKey, type OcrResult, type OcrSlot } from "@/lib/tauri";
import { setAssignmentDoctor } from "@/lib/db";
import { isDoctor, DOCTOR_BG_CLASS, type Doctor } from "@/lib/doctors";
import type { Slot } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";
import { formatBEMonth } from "@/lib/buddhist";
import { Link } from "react-router-dom";

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

  async function apply() {
    if (!result) return;
    setBusy("apply");
    try {
      // Sequential upserts — ~31 days × 3 slots × 2 types = ~186 ops, fine.
      for (const d of result.days) {
        const date = `${yearMonth}-${String(d.date).padStart(2, "0")}`;
        for (const [slot, cell] of Object.entries(d.shifts) as [Slot, OcrSlot][]) {
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
            <li>3. ตรวจ preview แล้วกด "ยืนยัน" เพื่อเติมเข้าตาราง (ทับของเดิม)</li>
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
                    {busy === "ocr" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    ส่งให้ OCR อ่าน
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>}
          {error?.includes("API Key") && (
            <Link to="/settings" onClick={onClose} className="text-xs text-violet-700 underline">ไปหน้าตั้งค่า →</Link>
          )}

          {result && <OcrPreview result={result} />}
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
    </div>
  );
}

function OcrPreview({ result }: { result: OcrResult }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200">
      <table className="w-full text-xs">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-2 py-2">วันที่</th>
            <th className="px-2 py-2">00-08 นอก</th>
            <th className="px-2 py-2">00-08 ใน</th>
            <th className="px-2 py-2">08-16 นอก</th>
            <th className="px-2 py-2">08-16 ใน</th>
            <th className="px-2 py-2">16-24 นอก</th>
            <th className="px-2 py-2">16-24 ใน</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {result.days.map((d) => (
            <tr key={d.date} className="hover:bg-zinc-50">
              <td className="px-2 py-1 text-center font-mono">{d.date} ({d.weekday})</td>
              <Cell name={d.shifts["0000-0800"].outHos} />
              <Cell name={d.shifts["0000-0800"].inHos} />
              <Cell name={d.shifts["0800-1600"].outHos} />
              <Cell name={d.shifts["0800-1600"].inHos} />
              <Cell name={d.shifts["1600-2400"].outHos} />
              <Cell name={d.shifts["1600-2400"].inHos} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ name }: { name: string }) {
  if (!name) return <td className="px-2 py-1 text-center text-zinc-300">—</td>;
  if (!isDoctor(name)) {
    return <td className="px-2 py-1 text-center text-rose-600" title="ชื่อไม่อยู่ในรายการ">{name}</td>;
  }
  const d = name as Doctor;
  return <td className={`px-2 py-1 text-center text-zinc-800 ${DOCTOR_BG_CLASS[d]}`}>{name}</td>;
}
