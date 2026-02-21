// app/api/admin/leads/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getLandingKeyFromSession(session: any) {
  return session?.user?.landing_key ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session: any = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const landingKey = getLandingKeyFromSession(session);
  if (!landingKey) return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 403 });

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
      .eq("landing_key", landingKey) // ✅ 핵심: 다른 랜딩 리드 수정 방지
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      // id는 맞지만 landing_key가 달라서 수정이 안 된 경우
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

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
  const session: any = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const landingKey = getLandingKeyFromSession(session);
  if (!landingKey) return NextResponse.json({ ok: false, error: "Missing landing_key" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("landing_key", landingKey) // ✅ 핵심: 다른 랜딩 리드 삭제 방지
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data });
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}