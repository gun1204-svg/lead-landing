import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LANDING_KEY = "09";

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    const name = cleanText(body.name, 50);
    const selectedLabels = getSelectedLabels(
      body.selected_labels
    );

    /*
     * 이름과 고민 선택값만 필수로 검사한다.
     * LINE ID는 더 이상 수집하지 않는다.
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
     * 실제 연락처 대신 접수번호를 phone 컬럼에 저장한다.
     *
     * 예:
     * LINE_FOLLOW_UP:JP09-20260804-043915-A7K3
     */
    const receiptNumber = createReceiptNumber();
    const contact = `LINE_FOLLOW_UP:${receiptNumber}`;

    /*
     * source 컬럼에는 유입 방식과 선택한 고민을 저장한다.
     */
    const source = `JP-LINE-FOLLOW-UP | ${selectedLabels.join(
      " | "
    )}`;

    const { data, error } = await supabaseAdmin.rpc(
      "create_lead_and_charge",
      {
        p_name: name,
        p_phone: contact,
        p_landing_key: LANDING_KEY,
        p_source: source,
        p_utm_source: cleanText(body.utm_source, 120),
        p_utm_campaign: cleanText(
          body.utm_campaign,
          200
        ),
        p_utm_term: cleanText(body.utm_term, 200),
        p_utm_content: cleanText(
          body.utm_content,
          200
        ),
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
     * Supabase 함수가 배열 또는 객체로 반환되는 경우를
     * 모두 처리한다.
     */
    const result = getRpcResult(data);
    const resultOk = result.ok;
    const resultError = cleanText(result.error, 100);

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
     * 프론트에서 이 접수번호를 받아
     * LINE 미리 작성 메시지에 포함한다.
     */
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