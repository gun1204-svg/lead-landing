import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getLandingConfig } from "@/lib/landing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LANDING_KEY = "09";

/*
 * 09번 리드 텔레그램 알림은
 * 02번 랜딩이 사용하는 텔레그램 방으로 보낸다.
 */
const TELEGRAM_LANDING_KEY = "02";

type RequestBody = {
  name?: unknown;
  selected_labels?: unknown;
  utm_source?: unknown;
  utm_campaign?: unknown;
  utm_term?: unknown;
  utm_content?: unknown;
};

function cleanText(value: unknown, maxLength = 200) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function getSelectedLabels(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => cleanText(item, 80))
    .filter(Boolean)
    .slice(0, 5);
}

function getRpcResult(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) {
    const first = data[0];

    if (first && typeof first === "object") {
      return first as Record<string, unknown>;
    }

    return {};
  }

  if (data && typeof data === "object") {
    return data as Record<string, unknown>;
  }

  return {};
}

function getJapanDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

/*
 * 일본 시간 기준 접수번호
 *
 * 예:
 * JP09-20260804-043915-A7K3
 */
function createReceiptNumber() {
  const {
    year,
    month,
    day,
    hour,
    minute,
    second,
  } = getJapanDateParts();

  const randomCode = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 4)
    .toUpperCase();

  return `JP09-${year}${month}${day}-${hour}${minute}${second}-${randomCode}`;
}

/*
 * 기존 랜딩과 동일한 텔레그램 전송 방식
 */
async function sendTelegram(
  text: string,
  chatId?: string
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token || !chatId) {
    console.log("09 telegram env/chat id missing");
    return;
  }

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const responseBody = await res
      .text()
      .catch(() => "");

    throw new Error(
      `telegram send failed: ${res.status} ${responseBody}`
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    const name = cleanText(body.name, 50);

    const selectedLabels = getSelectedLabels(
      body.selected_labels
    );

    const utmSource = cleanText(
      body.utm_source,
      120
    );

    const utmCampaign = cleanText(
      body.utm_campaign,
      200
    );

    const utmTerm = cleanText(
      body.utm_term,
      200
    );

    const utmContent = cleanText(
      body.utm_content,
      200
    );

    /*
     * 이름과 고민 선택값만 필수.
     * LINE ID는 수집하지 않는다.
     */
    if (!name || selectedLabels.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_INPUT",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 실제 연락처 대신 접수번호를 phone 컬럼에 저장
     */
    const receiptNumber = createReceiptNumber();

    const contact =
      `LINE_FOLLOW_UP:${receiptNumber}`;

    /*
     * source에는 선택한 고민 저장
     */
    const source =
      `JP-LINE-FOLLOW-UP | ${selectedLabels.join(
        " | "
      )}`;

    const { data, error } = await supabaseAdmin.rpc(
      "create_lead_and_charge",
      {
        p_name: name,
        p_phone: contact,
        p_landing_key: LANDING_KEY,
        p_source: source,
        p_utm_source: utmSource,
        p_utm_campaign: utmCampaign,
        p_utm_term: utmTerm,
        p_utm_content: utmContent,
      }
    );

    if (error) {
      console.error("09 lead RPC error:", error);

      const rpcError = cleanText(
        error.message || "LEAD_CREATE_FAILED",
        200
      );

      return NextResponse.json(
        {
          ok: false,
          error: rpcError,
        },
        {
          status:
            rpcError === "INSUFFICIENT_BALANCE"
              ? 402
              : 500,
        }
      );
    }

    /*
     * Supabase 함수가 배열 또는 객체로 반환되는 경우
     * 모두 처리
     */
    const result = getRpcResult(data);

    const resultOk = result.ok;

    const resultError = cleanText(
      result.error,
      100
    );

    if (resultOk === false || resultError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            resultError || "LEAD_CREATE_FAILED",
        },
        {
          status:
            resultError === "INSUFFICIENT_BALANCE"
              ? 402
              : 400,
        }
      );
    }

    /*
     * DB 등록 성공 후
     * 02번 텔레그램 방으로 알림
     */
    try {
      const telegramConfig = getLandingConfig(
        TELEGRAM_LANDING_KEY
      );

      const {
        year,
        month,
        day,
        hour,
        minute,
        second,
      } = getJapanDateParts();

      const japanTime =
        `${year}-${month}-${day} ` +
        `${hour}:${minute}:${second}`;

      const telegramMessage = [
        "🇯🇵 일본 신규 상담 리드",
        "",
        "🏥 랜딩: 09 일본 코상담",
        `👤 이름: ${name}`,
        "",
        "📝 체크한 고민",
        ...selectedLabels.map(
          (label) => `- ${label}`
        ),
        "",
        `🔖 접수번호: ${receiptNumber}`,
        "💬 상담방식: LINE 친구추가",
        "",
        "📊 광고 정보",
        `utm_source: ${utmSource || "-"}`,
        `utm_campaign: ${utmCampaign || "-"}`,
        `utm_term: ${utmTerm || "-"}`,
        `utm_content: ${utmContent || "-"}`,
        "",
        "🕒 접수시간 (일본)",
        japanTime,
      ].join("\n");

      await sendTelegram(
        telegramMessage,
        telegramConfig.telegramChatId
      );
    } catch (tgErr) {
      /*
       * 텔레그램 전송 실패가
       * 리드 접수 실패로 이어지지 않게 한다.
       */
      console.error(
        "09 telegram alert error:",
        tgErr
      );
    }

    return NextResponse.json({
      ok: true,
      receipt_number: receiptNumber,
    });
  } catch (error) {
    console.error("09 lead API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "SERVER_ERROR",
      },
      {
        status: 500,
      }
    );
  }
}