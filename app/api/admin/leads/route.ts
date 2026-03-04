import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionUser = {
  email?: string | null;
  landing_key?: string | null; // "00" | "01" ...
};

function normalizeLandingKey(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return null;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  const email = user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userLK = normalizeLandingKey(user?.landing_key);
  if (!userLK) {
    return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const requestedLK = normalizeLandingKey(searchParams.get("landing_key"));

  // ✅ 기본값: 쿼리가 없으면 내 LK
  const lk = requestedLK ?? userLK;

  // ✅ 권한 체크: 루트만 다른 LK 조회 가능
  if (userLK !== "00" && lk !== userLK) {
    return NextResponse.json({ ok: false, error: "Forbidden landing_key" }, { status: 403 });
  }

  let q = supabaseAdmin
    .from("leads")
    .select("id, created_at, name, phone, status, memo, landing_key")
    .order("created_at", { ascending: false })
    .limit(300);

  if (lk === "00") {
    // 루트에서는 NULL + 00 같이
    q = q.or("landing_key.is.null,landing_key.eq.00");
  } else {
    q = q.eq("landing_key", lk);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, landing_key: lk, items: data ?? [] });
}