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

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("telegram env missing");
    return;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`telegram send failed: ${res.status} ${body}`);
  }
}

export async function POST(req: Request) {
  try {
    const { name, phone, utm, landing_key } = await req.json();

    const cleanName = (name || "").trim();
    const cleanPhone = normalizePhone(phone || "");

    if (!cleanName || !cleanPhone) {
      return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 });
    }

    const lk = normalizeLandingKey(landing_key);

    // ✅ 중복 리드 체크 (같은 전화 + 같은 랜딩 + 최근 7일)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: existing } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("phone", cleanPhone)
      .eq("landing_key", lk)
      .gte("created_at", sevenDaysAgo)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log("duplicate lead blocked:", cleanPhone, lk);

      return NextResponse.json({
        ok: true,
        duplicate: true,
      });
    }

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

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data?.ok) {
      const code = data?.error === "INSUFFICIENT_BALANCE" ? 402 : 400;
      return NextResponse.json(data, { status: code });
    }

    try {
      await sendTelegram(
`🔥 새 상담 리드 접수

🏥 랜딩: ${lk}
👤 이름: ${cleanName}
📞 전화: ${cleanPhone}
tel:${cleanPhone}

📊 광고 정보
utm_source: ${utm?.source ?? ""}
utm_campaign: ${utm?.campaign ?? ""}
utm_term: ${utm?.term ?? ""}
utm_content: ${utm?.content ?? ""}

🕒 접수시간
${now}`
      );
    } catch (tgErr) {
      console.error("telegram alert error:", tgErr);
    }

    return NextResponse.json(data);

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}