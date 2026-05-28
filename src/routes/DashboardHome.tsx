import { Link } from "react-router-dom";
import { Stethoscope, Building2 } from "lucide-react";

/**
 * Dashboard home — two big buttons. Per requirement, this is the user's first
 * landing screen on every cold start.
 */
export function DashboardHome() {
  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col items-center justify-center gap-8 p-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">accuCountFM</h1>
        <p className="mt-2 text-sm text-zinc-500">คำนวณเงินเวรแพทย์นิติเวช · เลือกประเภทเวรที่ต้องการ</p>
      </header>

      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
        <BigButton
          to="/out"
          title="เวรชันสูตรนอก"
          subtitle="ชันสูตรพลิกศพนอกโรงพยาบาล"
          tone="violet"
          Icon={Stethoscope}
        />
        <BigButton
          to="/in"
          title="เวรชันสูตรใน"
          subtitle="ชันสูตรในรพ. + รับปรึกษารพช."
          tone="emerald"
          Icon={Building2}
        />
      </div>
    </div>
  );
}

function BigButton({
  to, title, subtitle, tone, Icon,
}: {
  to: string; title: string; subtitle: string; tone: "violet" | "emerald";
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const styles =
    tone === "violet"
      ? "bg-violet-50 ring-violet-200 hover:bg-violet-100 text-violet-900"
      : "bg-emerald-50 ring-emerald-200 hover:bg-emerald-100 text-emerald-900";
  return (
    <Link
      to={to}
      className={`flex flex-col items-start justify-between rounded-2xl p-8 ring-1 transition-all hover:scale-[1.01] hover:shadow-md ${styles}`}
    >
      <Icon className="h-12 w-12 opacity-80" />
      <div className="mt-12">
        <div className="text-2xl font-bold">{title}</div>
        <div className="mt-1 text-sm opacity-75">{subtitle}</div>
      </div>
    </Link>
  );
}
