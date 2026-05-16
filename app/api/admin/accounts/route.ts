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

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

async function getAllowedLandingKeys(sessionAdminId: string, userLK: string) {
  if (userLK === "00") return null;

  const permissionAdminIds = uniqueStrings([
    sessionAdminId,
    `admin${userLK}`,
  ]);

  const { data, error } = await supabaseAdmin
    .from("admin_landing_permissions")
    .select("landing_key")
    .in("admin_id", permissionAdminIds);

  if (error) throw error;

  const keys = (data ?? [])
    .map((row) => normalizeLandingKey(row.landing_key))
    .filter(Boolean) as string[];

  return Array.from(new Set(keys.length ? keys : [userLK]));
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  const sessionAdminId = String(user?.email ?? "").trim();

  if (!sessionAdminId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userLK = normalizeLandingKey(user?.landing_key);

  if (!userLK) {
    return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const lk = normalizeLandingKey(searchParams.get("landing_key"));

  const selectCols = "admin_id, landing_key, balance, price_per_lead, is_active, updated_at";

  if (userLK === "00") {
    if (lk) {
      const { data, error } = await supabaseAdmin
        .from("admin_accounts")
        .select(selectCols)
        .eq("landing_key", lk)
        .single();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, item: data });
    }

    const { data, error } = await supabaseAdmin
      .from("admin_accounts")
      .select(selectCols)
      .order("landing_key", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, items: data ?? [] });
  }

  const targetLK = lk ?? userLK;

  let allowedKeys: string[];

  try {
    allowedKeys = await getAllowedLandingKeys(sessionAdminId, userLK);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Permission load failed" },
      { status: 500 }
    );
  }

  if (!allowedKeys.includes(targetLK)) {
    return NextResponse.json({ ok: false, error: "Forbidden landing_key" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("admin_accounts")
    .select(selectCols)
    .eq("landing_key", targetLK)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    item: data,
    allowed_landing_keys: allowedKeys,
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userLK = normalizeLandingKey(user?.landing_key);

  if (userLK !== "00") {
    return NextResponse.json({ ok: false, error: "Root only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const landing_key = normalizeLandingKey(body?.landing_key);

  if (!landing_key) {
    return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 400 });
  }

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

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: data });
}