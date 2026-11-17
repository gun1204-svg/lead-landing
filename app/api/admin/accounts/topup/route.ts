import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionUser = { email?: string | null; landing_key?: string | null };

function normalizeLandingKey(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return /^\d{1,2}$/.test(s) ? s.padStart(2, "0") : null;
}

function normalizeAdminId(v: unknown): string {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return `admin${s.padStart(2, "0")}`;
  return s;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (user.email !== "admin" || normalizeLandingKey(user.landing_key) !== "00") {
    return NextResponse.json({ ok: false, error: "Root only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const admin_id = normalizeAdminId(body?.admin_id);
  const amount = body?.amount;
  const note = String(body?.note ?? "").trim() || null;

  if (!/^admin\d{2}$/.test(admin_id) ||
      typeof amount !== "number" ||
      !Number.isSafeInteger(amount) || amount === 0 ||
      amount < -2147483648 || amount > 2147483647) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("topup_admin", {
      p_admin_id: admin_id,
      p_amount: amount,
      p_note: note,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data || data.ok !== true) {
      const code = typeof data?.error === "string" ? data.error : "TOPUP_FAILED";
      const status = code === "ADMIN_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ ok: false, error: code, balance: data?.balance ?? null }, { status });
    }

    return NextResponse.json({
      ok: true,
      balance: data.balance,
      action: data.action,
    });
  } catch (e) {
    console.error("topup_admin failed", e);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
