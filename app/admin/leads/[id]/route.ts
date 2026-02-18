import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions"; // 너희 프로젝트 구조에 맞게 경로만 맞춰줘
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_STATUS = ["NEW", "CONTACTED", "NO_ANSWER", "DONE", "SPAM"] as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const status = typeof body.status === "string" ? body.status : undefined;
  const memo = typeof body.memo === "string" ? body.memo : undefined;

  const patch: any = {};
  if (status) {
    if (!ALLOWED_STATUS.includes(status as any)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    patch.status = status;
  }
  if (memo !== undefined) patch.memo = memo;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("leads")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
