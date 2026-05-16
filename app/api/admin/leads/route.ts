import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionUser = {
  email?: string | null;
  landing_key?: string | null;
};

function normalizeLandingKey(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return null;
}

async function getAllowedLandingKeys(adminId: string, userLK: string) {
  if (userLK === "00") return null; // 메인 admin = 전체

  const { data, error } = await supabaseAdmin
    .from("admin_landing_permissions")
    .select("landing_key")
    .eq("admin_id", adminId);

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
  const requestedLK = normalizeLandingKey(searchParams.get("landing_key"));

  let allowedKeys: string[] | null;

  try {
    const permissionAdminId =
      userLK === "00" ? "admin" : `admin${userLK}`;

    allowedKeys = await getAllowedLandingKeys(permissionAdminId, userLK);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Permission load failed" },
      { status: 500 }
    );
  }

  let q = supabaseAdmin
    .from("leads")
    .select("id, created_at, name, phone, status, memo, landing_key, utm_source")
    .order("created_at", { ascending: false })
    .limit(300);

  if (userLK === "00") {
    if (requestedLK && requestedLK !== "00") {
      q = q.eq("landing_key", requestedLK);
    }
  } else {
    if (requestedLK) {
      if (!allowedKeys?.includes(requestedLK)) {
        return NextResponse.json(
          { ok: false, error: "Forbidden landing_key" },
          { status: 403 }
        );
      }
      q = q.eq("landing_key", requestedLK);
    } else {
      q = q.in("landing_key", allowedKeys ?? [userLK]);
    }
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    landing_key: requestedLK ?? userLK,
    allowed_landing_keys: allowedKeys,
    items: data ?? [],
  });
}