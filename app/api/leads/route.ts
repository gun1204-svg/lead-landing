import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

// ✅ landing_key 정규화: "1" -> "01", 없으면 "00"
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

  const { error: lErr } = await supabaseAdmin.from("leads").insert([
    {
      name: cleanName,
      phone: cleanPhone,
      landing_key: lk,

      // utm는 지금 구조 유지 (프론트가 utm 객체로 보내도 됨)
      source: utm?.source || null,
      utm_source: utm?.source || null,
      utm_campaign: utm?.campaign || null,
      utm_term: utm?.term || null,
      utm_content: utm?.content || null,
    },
  ]);

  if (lErr) {
    console.error(lErr);
    return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}