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

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  const email = user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userLandingKey = user?.landing_key ?? null;
  if (!userLandingKey) {
    return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 403 });
  }

  // ✅ 사용자가 클릭한 landing_key는 query로 받기
  const { searchParams } = new URL(req.url);
  const requestedLandingKey = searchParams.get("landing_key"); // e.g. "01"

  // ✅ 기본값: 요청이 없으면 사용자 landing_key를 사용
  const landingKey = (requestedLandingKey ?? userLandingKey).toString();

  // ✅ 권한 체크:
  // - 루트(00)만 다른 landing_key 조회 가능
  // - 그 외에는 자기 landing_key만 가능
  if (userLandingKey !== "00" && landingKey !== userLandingKey) {
    return NextResponse.json({ ok: false, error: "Forbidden landing_key" }, { status: 403 });
  }

  // ✅ SMS/UTM 등 빼고 필요한 컬럼만 내려주기 (UI도 깔끔)
  let q = supabaseAdmin
    .from("leads")
    .select("id, created_at, name, phone, status, memo, landing_key")
    .order("created_at", { ascending: false })
    .limit(300);

  if (landingKey === "00") {
    // ✅ 루트(00)에서는 NULL + "00" 같이 노출(기존 정책 유지)
    q = q.or("landing_key.is.null,landing_key.eq.00");
  } else {
    q = q.eq("landing_key", landingKey);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, landing_key: landingKey, items: data ?? [] });
}