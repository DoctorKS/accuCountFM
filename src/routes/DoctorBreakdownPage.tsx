import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SHIFT_TYPE_LABEL, type ShiftType } from "@/lib/constants";
import { formatBEMonth } from "@/lib/buddhist";

/** /breakdown/:type/:doctor/:ym — row-by-row pay breakdown for one doctor one month one shift_type. */
export function DoctorBreakdownPage() {
  const { type, doctor, ym } = useParams<{ type: "out" | "in"; doctor: string; ym: string }>();
  const shiftType: ShiftType = type === "in" ? "inHos" : "outHos";
  const backTo = type === "in" ? "/in" : "/out";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link to={backTo} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> กลับ
        </Link>
        <h1 className="text-xl font-bold">
          แจกแจงเงิน {SHIFT_TYPE_LABEL[shiftType]} — {decodeURIComponent(doctor ?? "")}
        </h1>
        <div className="w-24" />
      </div>
      <p className="text-sm text-zinc-500">เดือน: {ym ? formatBEMonth(ym + "-01") : "—"}</p>
      <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-400">
        ตาราง row-by-row จะแสดงที่นี่หลัง backend พร้อม
      </div>
    </div>
  );
}
