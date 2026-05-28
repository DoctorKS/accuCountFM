import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/** /settings — API key, default export folder, about. Stub. */
export function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> กลับหน้าหลัก
      </Link>
      <h1 className="text-2xl font-bold">ตั้งค่า</h1>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Anthropic API Key</h2>
        <p className="mt-1 text-xs text-zinc-500">
          ใช้สำหรับ OCR ตารางเวรผ่าน Claude vision API — key จะถูกเก็บใน Windows Credential Manager ไม่ใช่ในไฟล์
        </p>
        <input
          type="password"
          placeholder="sk-ant-..."
          disabled
          className="mt-3 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-mono"
        />
        <p className="mt-2 text-xs text-zinc-400">(ฟีเจอร์นี้จะเปิดใช้หลัง Rust backend พร้อม)</p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">About</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <dt className="text-zinc-500">App</dt><dd>accuCountFM</dd>
          <dt className="text-zinc-500">Version</dt><dd>0.1.0 (scaffolded)</dd>
          <dt className="text-zinc-500">License</dt><dd>Private</dd>
        </dl>
      </section>
    </div>
  );
}
