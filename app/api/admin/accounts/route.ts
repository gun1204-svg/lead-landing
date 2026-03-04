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

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const userLK = normalizeLandingKey(user?.landing_key);
  if (!userLK) return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const lk = normalizeLandingKey(searchParams.get("landing_key"));

  // 루트(00): 전체 목록도 가능
  if (userLK === "00") {
    if (lk) {
      const { data, error } = await supabaseAdmin
        .from("admin_accounts")
        .select("admin_id, landing_key, balance, price_per_lead, is_active, updated_at")
        .eq("landing_key", lk)
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, item: data });
    }

    const { data, error } = await supabaseAdmin
      .from("admin_accounts")
      .select("admin_id, landing_key, balance, price_per_lead, is_active, updated_at")
      .order("landing_key", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  }

  // 일반 admin: 자기 landing_key만 조회 가능
  const targetLK = lk ?? userLK;
  if (targetLK !== userLK) {
    return NextResponse.json({ ok: false, error: "Forbidden landing_key" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("admin_accounts")
    .select("admin_id, landing_key, balance, price_per_lead, is_active, updated_at")
    .eq("landing_key", targetLK)
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const userLK = normalizeLandingKey(user?.landing_key);
  if (userLK !== "00") {
    return NextResponse.json({ ok: false, error: "Root only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const landing_key = normalizeLandingKey(body?.landing_key);
  const admin_id = String(body?.admin_id ?? "").trim();

  if (!landing_key || !admin_id) {
    return NextResponse.json({ ok: false, error: "Missing landing_key/admin_id" }, { status: 400 });
  }

  const patch: any = {};
  if (body.balance !== undefined) patch.balance = Number(body.balance);
  if (body.price_per_lead !== undefined) patch.price_per_lead = Number(body.price_per_lead);
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

  const { data, error } = await supabaseAdmin
    .from("admin_accounts")
    .update(patch)
    .eq("landing_key", landing_key)
    .eq("admin_id", admin_id)
    .select("admin_id, landing_key, balance, price_per_lead, is_active, updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}