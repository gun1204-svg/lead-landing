import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}
function normalizeLandingKey(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "00";
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

export async function POST(req: Request) {
  const { name, phone, utm, landing_key } = await req.json();

  const cleanName = (name || "").trim();
  const cleanPhone = normalizePhone(phone || "");
  if (!cleanName || !cleanPhone) {
    return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 });
  }

  const lk = normalizeLandingKey(landing_key);

  const { data, error } = await supabaseAdmin.rpc("create_lead_and_charge", {
    p_name: cleanName,
    p_phone: cleanPhone,
    p_landing_key: lk,
    p_source: utm?.source ?? null,
    p_utm_source: utm?.source ?? null,
    p_utm_campaign: utm?.campaign ?? null,
    p_utm_term: utm?.term ?? null,
    p_utm_content: utm?.content ?? null,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (!data?.ok) {
    // 잔액 부족 -> 402로 내려서 프론트에서 “마감” 처리 가능
    const code = data?.error === "INSUFFICIENT_BALANCE" ? 402 : 400;
    return NextResponse.json(data, { status: code });
  }

  return NextResponse.json(data);
}