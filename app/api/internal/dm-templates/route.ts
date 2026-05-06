import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function requireInternal() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 }) };
  }

  if ((session.user as any).role !== "internal") {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 }) };
  }

  return { ok: true as const };
}

export async function GET() {
  const auth = await requireInternal();
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("dm_templates")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items: data || [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireInternal();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const templateKey = String(body.template_key || "").trim();
  const content = String(body.content || "");

  if (!templateKey || !content.trim()) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("dm_templates")
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("template_key", templateKey)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: data });
}