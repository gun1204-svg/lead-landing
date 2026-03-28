import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = ["new", "dm_sent", "replied", "closed"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    if ((session.user as any).role !== "internal") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const status = typeof body.status === "string" ? body.status : undefined;
    const notes = typeof body.notes === "string" ? body.notes : undefined;

    if (status && !ALLOWED_STATUS.includes(status as any)) {
      return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
    }

    const { data: current, error: currentError } = await supabaseAdmin
      .from("influencer_leads")
      .select("*")
      .eq("id", id)
      .single();

    if (currentError || !current) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const patch: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof notes === "string") {
      patch.notes = notes;
    }

    if (status) {
      patch.status = status;

      if (status === "dm_sent" && !current.dm_sent_at) {
        patch.dm_sent_at = new Date().toISOString();
      }

      if (status === "replied" && !current.replied_at) {
        patch.replied_at = new Date().toISOString();
      }

      if (status === "closed" && !current.closed_at) {
        patch.closed_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabaseAdmin
      .from("influencer_leads")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    if ((session.user as any).role !== "internal") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await params;

    const { error } = await supabaseAdmin
      .from("influencer_leads")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}