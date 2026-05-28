import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { hasApiKey, setApiKey, clearApiKey, appInfo } from "@/lib/tauri";

/** API key (Windows Credential Manager) + about. */
export function SettingsPage() {
  const [keyPresent, setKeyPresent] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<{ version: string; name: string } | null>(null);

  useEffect(() => {
    hasApiKey().then(setKeyPresent).catch(() => setKeyPresent(false));
    appInfo().then(setInfo).catch(() => setInfo(null));
  }, []);

  async function save() {
    if (!input.trim()) return;
    setBusy(true);
    try {
      await setApiKey(input.trim());
      setKeyPresent(true);
      setInput("");
      toast.success("บันทึก API Key ลง Windows Credential Manager แล้ว");
    } catch (e) {
      toast.error("บันทึกล้มเหลว: " + String(e));
    }
    setBusy(false);
  }

  async function clear() {
    setBusy(true);
    try {
      await clearApiKey();
      setKeyPresent(false);
      toast.success("ลบ API Key แล้ว");
    } catch (e) {
      toast.error("ลบล้มเหลว: " + String(e));
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> กลับหน้าหลัก
      </Link>
      <h1 className="text-2xl font-bold">ตั้งค่า</h1>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-violet-600" />
          <h2 className="text-sm font-semibold">Anthropic API Key</h2>
        </div>
        <p className="text-xs text-zinc-500">
          ใช้สำหรับ OCR ตารางเวรผ่าน Claude vision · key เก็บใน Windows Credential Manager (encrypted by Windows DPAPI)
        </p>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${keyPresent ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200"}`}>
              {keyPresent ? <><Check className="h-3 w-3" /> ตั้งค่าแล้ว</> : "ยังไม่ได้ตั้ง"}
            </span>
            {keyPresent && (
              <button onClick={clear} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                <Trash2 className="h-3 w-3" /> ลบ
              </button>
            )}
          </div>
          <input
            type="password"
            placeholder="sk-ant-..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <button
            onClick={save}
            disabled={busy || !input.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <Check className="h-3 w-3" /> บันทึก
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">About</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <dt className="text-zinc-500">App</dt><dd>{info?.name ?? "accuCountFM"}</dd>
          <dt className="text-zinc-500">Version</dt><dd>{info?.version ?? "—"}</dd>
          <dt className="text-zinc-500">License</dt><dd>Private</dd>
        </dl>
      </section>
    </div>
  );
}
