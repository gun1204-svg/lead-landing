import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  created_at: string;
  landing_key: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
};

function groupCount(rows: LeadRow[], key: keyof LeadRow) {
  const map = new Map<string, number>();

  for (const row of rows) {
    const value = String(row[key] ?? "").trim() || "(미설정)";
    map.set(value, (map.get(value) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const landingKey = url.searchParams.get("landing_key") || "";
    const days = Number(url.searchParams.get("days") || "7");

    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let query = supabaseAdmin
      .from("leads")
      .select("id, created_at, landing_key, utm_source, utm_campaign, utm_content")
      .gte("created_at", fromDate)
      .order("created_at", { ascending: false });

    if (landingKey && landingKey !== "all") {
      query = query.eq("landing_key", landingKey);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as LeadRow[];

    const sourceStats = groupCount(rows, "utm_source");
    const campaignStats = groupCount(rows, "utm_campaign");
    const contentStats = groupCount(rows, "utm_content");
    const landingStats = groupCount(rows, "landing_key");

    return NextResponse.json({
      ok: true,
      summary: {
        totalLeads: rows.length,
        days,
      },
      stats: {
        bySource: sourceStats,
        byCampaign: campaignStats,
        byContent: contentStats,
        byLanding: landingStats,
      },
      items: rows.slice(0, 100),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}