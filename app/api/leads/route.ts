import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getLandingConfig } from "@/lib/landing";

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function normalizeLandingKey(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "00";
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

function normalizePhoneForMeta(phone?: string | null) {
  if (!phone) return undefined;
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return undefined;

  if (digits.startsWith("0")) {
    return `82${digits.slice(1)}`;
  }
  if (digits.startsWith("82")) {
    return digits;
  }
  return digits;
}

function sha256(value?: string | null) {
  if (!value) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function getClientIp(req: Request) {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0]?.trim();
  }

  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return xRealIp;

  return undefined;
}

function getDefaultPageUrl(req: Request, landingKey: string) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host");

  if (!host) return `https://bienptns.com/${landingKey}`;
  return `${proto}://${host}/${landingKey}`;
}

function normalizeConcerns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

function buildConcernMemo(concerns: string[]) {
  if (!concerns.length) return "";
  return `[상담 체크 항목]\n${concerns.map((v) => `- ${v}`).join("\n")}`;
}

function pickUtmValue(...values: unknown[]) {
  for (const value of values) {
    const s = String(value ?? "").trim();
    if (s) return s;
  }
  return "";
}

async function sendTelegram(text: string, chatId?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

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

async function sendMetaLeadEvent(input: {
  eventId: string;
  pageUrl: string;
  name: string;
  phone: string;
  landingKey: string;
  leadId?: string;
  fbp?: string;
  fbc?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
}) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  const testEventCode = process.env.META_TEST_EVENT_CODE;

  if (!pixelId || !accessToken) {
    console.log("meta env missing");
    return { ok: false, skipped: true as const };
  }

  const endpoint = `https://graph.facebook.com/v23.0/${pixelId}/events?access_token=${encodeURIComponent(
    accessToken
  )}`;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: input.pageUrl,
        event_id: input.eventId,
        user_data: {
          client_ip_address: input.clientIpAddress,
          client_user_agent: input.clientUserAgent,
          fbp: input.fbp,
          fbc: input.fbc,
          external_id: sha256(input.leadId),
          fn: sha256(input.name),
          ph: sha256(normalizePhoneForMeta(input.phone)),
        },
        custom_data: {
          content_name: `landing_${input.landingKey}`,
          landing_key: input.landingKey,
        },
      },
    ],
  };

  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const result = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("meta capi error:", result);
    return { ok: false, error: result };
  }

  return { ok: true, data: result };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body?.name ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const landing_key = body?.landing_key;
    const event_id = body?.event_id;
    const page_url = body?.page_url;
    const fbp = body?.fbp;
    const fbc = body?.fbc;
    const concerns = normalizeConcerns(body?.concerns);

    const utmObj = body?.utm ?? {};

    const utmSource = pickUtmValue(
      body?.utm_source,
      utmObj?.utm_source,
      utmObj?.source
    );
    const utmMedium = pickUtmValue(
      body?.utm_medium,
      utmObj?.utm_medium,
      utmObj?.medium
    );
    const utmCampaign = pickUtmValue(
      body?.utm_campaign,
      utmObj?.utm_campaign,
      utmObj?.campaign
    );
    const utmTerm = pickUtmValue(
      body?.utm_term,
      utmObj?.utm_term,
      utmObj?.term
    );
    const utmContent = pickUtmValue(
      body?.utm_content,
      utmObj?.utm_content,
      utmObj?.content
    );

    const cleanName = name;
    const cleanPhone = normalizePhone(phone);

    if (!cleanName || !cleanPhone) {
      return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 });
    }

    const lk = normalizeLandingKey(landing_key);
    const landingConfig = getLandingConfig(lk);

    const eventId = String(event_id ?? "").trim();
    const pageUrl = String(page_url ?? "").trim() || getDefaultPageUrl(req, lk);

    // 같은 전화번호 + 같은 랜딩 + 최근 7일 중복 차단
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("phone", cleanPhone)
      .eq("landing_key", lk)
      .gte("created_at", sevenDaysAgo)
      .limit(1);

    if (existingError) {
      return NextResponse.json(
        { ok: false, error: existingError.message },
        { status: 500 }
      );
    }

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
      p_source: utmSource || null,
      p_utm_source: utmSource || null,
      p_utm_campaign: utmCampaign || null,
      p_utm_term: utmTerm || null,
      p_utm_content: utmContent || null,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data?.ok) {
      const code = data?.error === "INSUFFICIENT_BALANCE" ? 402 : 400;
      return NextResponse.json(data, { status: code });
    }

    const leadId = data?.lead_id ? String(data.lead_id) : undefined;

    // concerns를 memo에 추가 저장
    if (leadId && concerns.length > 0) {
      const concernMemo = buildConcernMemo(concerns);

      const { data: leadRow } = await supabaseAdmin
        .from("leads")
        .select("memo")
        .eq("id", leadId)
        .maybeSingle();

      const prevMemo = String(leadRow?.memo ?? "").trim();
      const nextMemo = prevMemo
        ? `${prevMemo}\n\n${concernMemo}`
        : concernMemo;

      const { error: memoUpdateError } = await supabaseAdmin
        .from("leads")
        .update({ memo: nextMemo })
        .eq("id", leadId);

      if (memoUpdateError) {
        console.error("memo update error:", memoUpdateError);
      }
    }

    // Meta Conversion API 전송
    try {
      if (eventId) {
        await sendMetaLeadEvent({
          eventId,
          pageUrl,
          name: cleanName,
          phone: cleanPhone,
          landingKey: lk,
          leadId,
          fbp: typeof fbp === "string" ? fbp : undefined,
          fbc: typeof fbc === "string" ? fbc : undefined,
          clientIpAddress: getClientIp(req),
          clientUserAgent: req.headers.get("user-agent") ?? undefined,
        });
      }
    } catch (metaErr) {
      console.error("meta capi send error:", metaErr);
    }

    // 텔레그램 알림
    try {
      const now = new Date().toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
      });

      const concernText =
        concerns.length > 0
          ? `\n📝 체크한 고민\n${concerns.map((v) => `- ${v}`).join("\n")}\n`
          : "\n";

      await sendTelegram(
`🔥 새 상담 리드 접수

🏥 병원: ${landingConfig.hospitalName}
🗂 랜딩: ${lk}
👤 이름: ${cleanName}
📞 전화: ${cleanPhone}${concernText}
📊 광고 정보
utm_source: ${utmSource}
utm_medium: ${utmMedium}
utm_campaign: ${utmCampaign}
utm_term: ${utmTerm}
utm_content: ${utmContent}

🕒 접수시간
${now}`,
        landingConfig.telegramChatId
      );
    } catch (tgErr) {
      console.error("telegram alert error:", tgErr);
    }

    return NextResponse.json({
      ...data,
      duplicate: false,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}