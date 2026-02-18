import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_STATUS = ["NEW", "CONTACTED", "NO_ANSWER", "DONE", "SPAM"] as const;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  // ✅ /api/admin/* 는 미들웨어(withAuth)에서 이미 보호됨
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));

  const status = typeof body.status === "string" ? body.status : undefined;
  const memo = typeof body.memo === "string" ? body.memo : undefined;

  const patch: Record<string, any> = {};

  if (status) {
    if (!ALLOWED_STATUS.includes(status as any)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    patch.status = status;
  }

  if (memo !== undefined) {
    patch.memo = memo;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("leads")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
