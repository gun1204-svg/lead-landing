import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendSms } from "@/lib/smsSens";

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function fillTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// ✅ landing_key 정규화: "1" -> "01", 없으면 "00"
function normalizeLandingKey(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "00";
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

export async function POST(req: Request) {
  // ✅ landing_key를 body에서 같이 받기
  const { name, phone, utm, landing_key } = await req.json();

  const cleanName = (name || "").trim();
  const cleanPhone = normalizePhone(phone || "");
  if (!cleanName || !cleanPhone) {
    return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 });
  }

  // ✅ 최종 landing_key 결정
  const lk = normalizeLandingKey(landing_key);

  // 설정 읽기
  const { data: settings, error: sErr } = await supabaseAdmin
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (sErr) {
    console.error(sErr);
    return NextResponse.json({ ok: false, error: "SETTINGS_ERROR" }, { status: 500 });
  }

  // 리드 저장
  const { data: lead, error: lErr } = await supabaseAdmin
    .from("leads")
    .insert([
      {
        name: cleanName,
        phone: cleanPhone,

        // ✅ landing_key 저장 (핵심)
        landing_key: lk,

        source: utm?.source || null,
        utm_source: utm?.source || null,
        utm_campaign: utm?.campaign || null,
        utm_term: utm?.term || null,
        utm_content: utm?.content || null,
      },
    ])
    .select()
    .single();

  if (lErr) {
    console.error(lErr);
    return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
  }

  // 문자 발송(ON일 때만)
  if (settings.sms_enabled) {
    const vars = { name: cleanName, phone: cleanPhone };
    const customerMsg = fillTemplate(settings.customer_sms_template, vars);
    const adminMsg = fillTemplate(settings.admin_sms_template, vars);

    try {
      console.log("[SMS] sending customer...");
      await sendSms(cleanPhone, customerMsg);
      console.log("[SMS] customer sent");

      const adminPhone = normalizePhone(settings.admin_notify_phone || "");
      if (adminPhone) {
        console.log("[SMS] sending admin...");
        await sendSms(adminPhone, adminMsg);
        console.log("[SMS] admin sent");
      }

      await supabaseAdmin
        .from("leads")
        .update({ sms_sent: true, sms_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

      console.log("[SMS] db updated sms_sent=true");
    } catch (e) {
      console.error("[SMS] failed:", e);
    }
  }

  return NextResponse.json({ ok: true });
}