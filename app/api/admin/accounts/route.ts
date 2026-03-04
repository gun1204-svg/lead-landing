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

function toInt(v: any, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userLK = normalizeLandingKey(user?.landing_key);
  if (!userLK) {
    return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const lk = normalizeLandingKey(searchParams.get("landing_key"));

  const selectCols = "admin_id, landing_key, balance, price_per_lead, is_active, updated_at";

  // ✅ Root(00): 전체 목록 or 특정 LK 조회
  if (userLK === "00") {
    if (lk) {
      const { data, error } = await supabaseAdmin
        .from("admin_accounts")
        .select(selectCols)
        .eq("landing_key", lk)
        .single();

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, item: data });
    }

    const { data, error } = await supabaseAdmin
      .from("admin_accounts")
      .select(selectCols)
      .order("landing_key", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  }

  // ✅ 일반 admin: 자기 LK만
  const targetLK = lk ?? userLK;
  if (targetLK !== userLK) {
    return NextResponse.json({ ok: false, error: "Forbidden landing_key" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("admin_accounts")
    .select(selectCols)
    .eq("landing_key", targetLK)
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ✅ Root만 단가/활성 수정 가능
  const userLK = normalizeLandingKey(user?.landing_key);
  if (userLK !== "00") {
    return NextResponse.json({ ok: false, error: "Root only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const landing_key = normalizeLandingKey(body?.landing_key);
  if (!landing_key) {
    return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 400 });
  }

  // ✅ landing_key만으로 업데이트 (PK)
  const patch: any = {};

  if (body.balance !== undefined) {
    const v = toInt(body.balance, NaN as any);
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json({ ok: false, error: "INVALID_BALANCE" }, { status: 400 });
    }
    patch.balance = v;
  }

  if (body.price_per_lead !== undefined) {
    const v = toInt(body.price_per_lead, NaN as any);
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json({ ok: false, error: "INVALID_PRICE" }, { status: 400 });
    }
    patch.price_per_lead = v;
  }

  if (body.is_active !== undefined) {
    patch.is_active = Boolean(body.is_active);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "NO_FIELDS" }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  const selectCols = "admin_id, landing_key, balance, price_per_lead, is_active, updated_at";

  const { data, error } = await supabaseAdmin
    .from("admin_accounts")
    .update(patch)
    .eq("landing_key", landing_key)
    .select(selectCols)
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}