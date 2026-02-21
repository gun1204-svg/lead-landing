// app/api/admin/leads/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const status = body?.status;
    const memo = body?.memo;

    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    if (!status || typeof status !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
    }

    const patch: Record<string, any> = { status };
    if (typeof memo === "string") patch.memo = memo;

    const { data, error } = await supabaseAdmin
      .from("leads")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // ✅ 규격 통일
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("leads")
    .delete()
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data });
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}