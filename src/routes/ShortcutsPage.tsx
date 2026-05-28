import { Link } from "react-router-dom";
import { ArrowLeft, Keyboard } from "lucide-react";

/**
 * Cheat sheet for every keyboard shortcut wired into the app.
 *
 * Source of truth: each shortcut's actual implementation lives next to the
 * page that owns it (ShiftDayPage, ShiftMonthPage, CaseRow). When you add
 * or change one of those, update the matching row here too — there's no
 * compile-time link between code and docs.
 */
export function ShortcutsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> กลับหน้าหลัก
        </Link>
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold">
          <Keyboard className="h-6 w-6 text-violet-500" /> ปุ่มลัด
        </h1>
        <div className="w-24" />
      </div>

      <p className="text-sm text-zinc-500">
        สรุปปุ่ม shortcut ทั้งหมดที่ใช้ในแอป — กรอกข้อมูลและสลับหน้าได้เร็วขึ้นโดยไม่ต้องใช้เมาส์
      </p>

      <Section title="หน้าเวรรายวัน (Shift_page)" subtitle="`/shift/:type/:date`">
        <ShortcutRow keys={["F1"]} desc="เพิ่มเคสชันสูตรใน slot 00.00 – 08.00 น. + auto-focus ช่อง CS" />
        <ShortcutRow keys={["F2"]} desc="เพิ่มเคสชันสูตรใน slot 08.00 – 16.00 น. + auto-focus" />
        <ShortcutRow keys={["F3"]} desc="เพิ่มเคสชันสูตรใน slot 16.00 – 24.00 น. + auto-focus" />
        <ShortcutRow keys={["Enter"]} desc='กดใน CS input → flush ค่าปัจจุบัน + เพิ่ม row ถัดไป (ถ้าครบ CS + เวลาออก + เวลากลับ)' />
        <ShortcutRow keys={["PageDown"]} desc="กลับไปหน้าก่อน (เดือนที่ค้างไว้) — ต้องกรอกข้อมูลครบทุกเคสก่อน ไม่งั้น toast เตือน" />
      </Section>

      <Section title="หน้าเวรรายเดือน (Shift_month_page)" subtitle="`/out` และ `/in`">
        <ShortcutRow keys={["PageDown"]} desc="กลับไป Dashboard" />
      </Section>

      <Section title="ทั่วทั้งแอป" subtitle="พฤติกรรมมาตรฐานของฟอร์ม">
        <ShortcutRow keys={["Tab"]} desc="ย้าย focus ไปช่องถัดไป (input → time picker → ...)" />
        <ShortcutRow keys={["Shift", "Tab"]} desc="ย้าย focus ไปช่องก่อนหน้า" />
        <ShortcutRow keys={["Esc"]} desc="ปิด modal (OCR dialog, ตรวจสอบตารางเวร, วันนักขัตฤกษ์)" />
      </Section>

      <p className="text-[11px] text-zinc-400">
        ⚠ F1 / F2 / F3 ปกติเป็น Help / Rename / Find ของ Edge — แอปบล็อก default behavior ด้วย{" "}
        <code className="rounded bg-zinc-100 px-1">preventDefault()</code> เพื่อให้ใช้เพิ่มเคสได้
      </p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-baseline gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">{title}</h2>
        {subtitle && <span className="font-mono text-[11px] text-zinc-400">{subtitle}</span>}
      </header>
      <div className="divide-y divide-zinc-100">{children}</div>
    </section>
  );
}

function ShortcutRow({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-4 py-2">
      <div className="flex flex-wrap items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="contents">
            {i > 0 && <span className="text-xs text-zinc-400">+</span>}
            <kbd className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 font-mono text-xs font-semibold text-zinc-700 shadow-sm">
              {k}
            </kbd>
          </span>
        ))}
      </div>
      <p className="text-sm text-zinc-700">{desc}</p>
    </div>
  );
}
