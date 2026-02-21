import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const landingKey = (session.user as any)?.landing_key ?? null;
  if (!landingKey) return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 403 });

  let q = supabaseAdmin
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  if (landingKey === "00") {
    // ✅ 루트(00)에서는 기존 NULL 데이터도 같이 노출
    q = q.or("landing_key.is.null,landing_key.eq.00");
  } else {
    q = q.eq("landing_key", landingKey);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data });
}