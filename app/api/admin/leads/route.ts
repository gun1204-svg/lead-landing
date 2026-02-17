import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ ok:false }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ ok:false }, { status: 500 });
  return NextResponse.json({ ok:true, data });
}
