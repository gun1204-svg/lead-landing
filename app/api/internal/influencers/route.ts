import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function needsFollowUp(item: {
  status?: string | null;
  dm_sent_at?: string | null;
  replied_at?: string | null;
}) {
  if (item.status !== "dm_sent") return false;
  if (!item.dm_sent_at) return false;
  if (item.replied_at) return false;

  const sent = new Date(item.dm_sent_at).getTime();
  const now = Date.now();
  const diffDays = (now - sent) / (1000 * 60 * 60 * 24);

  return diffDays >= 3;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    if ((session.user as any).role !== "internal") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "";
    const q = sp.get("q") || "";
    const minFollowers = Number(sp.get("min_followers") || "0");
    const followUpOnly = sp.get("follow_up_only") === "true";

    let query = supabaseAdmin
      .from("influencer_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (minFollowers > 0) {
      query = query.gte("followers_count", minFollowers);
    }

    if (q) {
      query = query.or(
        [
          `username.ilike.%${q}%`,
          `display_name.ilike.%${q}%`,
          `country.ilike.%${q}%`,
          `language.ilike.%${q}%`,
          `category.ilike.%${q}%`,
          `notes.ilike.%${q}%`,
        ].join(",")
      );
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const items = (data || []).map((item) => ({
      ...item,
      follow_up_needed: needsFollowUp(item),
    }));

    const filtered = followUpOnly ? items.filter((x) => x.follow_up_needed) : items;

    return NextResponse.json({
      ok: true,
      items: filtered,
      stats: {
        total: items.length,
        newCount: items.filter((x) => x.status === "new").length,
        dmSentCount: items.filter((x) => x.status === "dm_sent").length,
        repliedCount: items.filter((x) => x.status === "replied").length,
        closedCount: items.filter((x) => x.status === "closed").length,
        followUpCount: items.filter((x) => x.follow_up_needed).length,
        qualifiedCount: items.filter((x) => (x.followers_count || 0) >= 50000).length,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}