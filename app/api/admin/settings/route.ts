import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin() {
  const session = await getServerSession();
  if (!session?.user?.email) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) return NextResponse.json({ ok: false, error: "DB" }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json();
  const patch: any = {};

  if (typeof body.sms_enabled === "boolean") patch.sms_enabled = body.sms_enabled;
  if (typeof body.admin_notify_phone === "string") patch.admin_notify_phone = body.admin_notify_phone;
  if (typeof body.customer_sms_template === "string") patch.customer_sms_template = body.customer_sms_template;
  if (typeof body.admin_sms_template === "string") patch.admin_sms_template = body.admin_sms_template;

  const { error } = await supabaseAdmin.from("settings").update(patch).eq("id", 1);
  if (error) return NextResponse.json({ ok: false, error: "DB" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
