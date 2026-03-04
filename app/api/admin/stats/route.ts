import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionUser = { email?: string | null; landing_key?: string | null };

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if ((user?.landing_key ?? null) !== "00") {
    return NextResponse.json({ ok: false, error: "Root only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const admin_id = String(body?.admin_id ?? "").trim();
  const amount = Number(body?.amount ?? 0);
  const note = String(body?.note ?? "").trim() || null;

  if (!admin_id || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("topup_admin", {
    p_admin_id: admin_id,
    p_amount: amount,
    p_note: note,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data?.ok) return NextResponse.json(data, { status: 400 });

  return NextResponse.json(data);
}