import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LANDING_KEY = "09";

type RequestBody = {
  name?: unknown;
  line_id?: unknown;

  // 기존 프론트 코드와의 임시 호환용
  line_name?: unknown;

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    const name = cleanText(body.name, 50);

    /*
     * line_id를 우선 사용하고,
     * 기존 Landing09Client와의 호환을 위해 line_name도 허용한다.
     */
    const lineId = cleanText(
      body.line_id ?? body.line_name,
      50
    ).toLowerCase();

    const selectedLabels = getSelectedLabels(
      body.selected_labels
    );

    /*
     * LINE ID 허용 문자:
     * 영문 소문자, 숫자, 마침표, 하이픈, 언더바
     */
    const isValidLineId = /^[a-z0-9._-]+$/.test(lineId);

    if (
      !name ||
      !lineId ||
      !isValidLineId ||
      selectedLabels.length === 0
    ) {
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
     * 기존 leads.phone 컬럼을 그대로 사용한다.
     * 09번 일본어 리드는 아래 형식으로 저장된다.
     *
     * LINE_ID:yamada_123
     */
    const contact = `LINE_ID:${lineId}`;

    /*
     * 기존 source 컬럼에 유입 방식과 SELF CHECK 결과를 저장한다.
     */
    const source = `JP-LINE-ID | ${selectedLabels.join(
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

      return NextResponse.json(
        {
          ok: false,
          error:
            error.message || "LEAD_CREATE_FAILED",
        },
        {
          status: 500,
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

    return NextResponse.json({
      ok: true,
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