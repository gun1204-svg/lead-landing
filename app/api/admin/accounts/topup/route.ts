import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionUser = { email?: string | null; landing_key?: string | null };

function normalizeLandingKey(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return null;
}

// ✅ admin_id 입력을 유연하게: "01" -> "admin01"
function normalizeAdminId(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d{1,2}$/.test(s)) return `admin${s.padStart(2, "0")}`;
  return s;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ✅ Root(00)만 충전 가능
  const userLK = normalizeLandingKey(user?.landing_key);
  if (userLK !== "00") {
    return NextResponse.json({ ok: false, error: "Root only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const admin_id = normalizeAdminId(body?.admin_id);
  const amount = Number(body?.amount ?? 0);
  const note = String(body?.note ?? "").trim() || null;

  if (!admin_id || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  // ✅ 핵심: topup_admin이 returns void면 data는 null일 수 있음
  const { error } = await supabaseAdmin.rpc("topup_admin", {
    p_admin_id: admin_id,
    p_amount: Math.floor(amount),
    p_note: note,
  });

  if (error) {
    // Supabase 함수에서 raise exception하면 여기로 온다
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // ✅ 성공이면 ok:true로 고정 응답
  return NextResponse.json({ ok: true });
}