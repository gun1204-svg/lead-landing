// app/api/admin/leads/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const landingKey = (session.user as any)?.landing_key ?? null;
  if (!landingKey) {
    return NextResponse.json(
      { ok: false, error: "Missing landing_key" },
      { status: 403 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("landing_key", landingKey)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}