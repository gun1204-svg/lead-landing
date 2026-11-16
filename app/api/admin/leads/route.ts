
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionUser = {
  email?: string | null;
  landing_key?: string | null;
};

type SummaryLead = {
  created_at: string;
  status: string | null;
  landing_key: string | null;
  assigned_to: string | null;
};

const STATUS_KEYS = [
  "NEW",
  "BOOKED",
  "CALLED",
  "NO_ANSWER",
  "INVALID",
] as const;

const RESERVATION_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

function normalizeLandingKey(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return null;
}

function normalizeStatus(v: unknown): string | null {
  const s = String(v ?? "").trim().toUpperCase();
  return STATUS_KEYS.includes(
    s as (typeof STATUS_KEYS)[number]
  )
    ? s
    : null;
}

function normalizeReservationStatus(v: unknown): string | null {
  const s = String(v ?? "").trim().toUpperCase();
  return RESERVATION_STATUSES.includes(
    s as (typeof RESERVATION_STATUSES)[number]
  )
    ? s
    : null;
}

function toPositiveInt(
  v: string | null,
  fallback: number
): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return n;
}

function normalizeMonth(v: string | null): string | null {
  if (!v) return null;

  const s = v.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) {
    return null;
  }

  return s;
}

function normalizeSearchDate(value: string | null): string | null {
  if (!value) return null;
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Invalid date");
  const [year, month, day] = s.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) {
    throw new Error("Invalid date");
  }
  return s;
}


function getInclusiveDateRange(start: string, end: string) {
  const next = new Date(`${end}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    start: `${start}T00:00:00+09:00`,
    end: `${next.toISOString().slice(0, 10)}T00:00:00+09:00`,
  };
}

function getDateRange(date: string) {
  const nextDay = new Date(`${date}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return {
    start: `${date}T00:00:00+09:00`,
    end: `${nextDay.toISOString().slice(0, 10)}T00:00:00+09:00`,
  };
}

function getMonthRange(month: string) {
  const [year, m] = month.split("-").map(Number);

  const nextYear = m === 12 ? year + 1 : year;
  const nextMonth = m === 12 ? 1 : m + 1;

  const next = `${nextYear}-${String(nextMonth).padStart(
    2,
    "0"
  )}-01`;

  return {
    start: `${month}-01T00:00:00+09:00`,
    end: `${next}T00:00:00+09:00`,
  };
}

function normalizeDate(v: unknown): string | null {
  if (v === null || v === "") return null;

  if (typeof v !== "string") {
    throw new Error("Invalid reservation_date");
  }

  const s = v.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error("Invalid reservation_date");
  }

  const [year, month, day] = s.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Invalid reservation_date");
  }

  return s;
}

function normalizeTime(v: unknown): string | null {
  if (v === null || v === "") return null;

  if (typeof v !== "string") {
    throw new Error("Invalid reservation_time");
  }

  const s = v.trim();

  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(s)) {
    throw new Error("Invalid reservation_time");
  }

  return s;
}

async function getAllowedLandingKeys(
  adminId: string,
  userLK: string
): Promise<string[] | null> {
  if (userLK === "00") return null;

  const { data, error } = await supabaseAdmin
    .from("admin_landing_permissions")
    .select("landing_key")
    .eq("admin_id", adminId);

  if (error) throw error;

  const keys = (data ?? [])
    .map((row) => normalizeLandingKey(row.landing_key))
    .filter(Boolean) as string[];

  return Array.from(
    new Set(keys.length ? keys : [userLK])
  );
}

function applyLandingScope(
  query: any,
  userLK: string,
  requestedLK: string | null,
  allowedKeys: string[] | null
) {
  if (userLK === "00") {
    if (requestedLK && requestedLK !== "00") {
      return query.eq("landing_key", requestedLK);
    }
    return query;
  }

  if (requestedLK) {
    return query.eq("landing_key", requestedLK);
  }

  return query.in(
    "landing_key",
    allowedKeys ?? [userLK]
  );
}

async function getAdminContext() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  const adminId = String(user?.email ?? "").trim();

  if (!adminId) {
    throw new Error("Unauthorized");
  }

  const userLK = normalizeLandingKey(user?.landing_key);

  if (!userLK) {
    throw new Error("Missing landing_key");
  }

  // 기존 관리자 권한 조회 방식 유지
  const permissionAdminId =
    userLK === "00" ? "admin" : `admin${userLK}`;

  const allowedKeys = await getAllowedLandingKeys(
    permissionAdminId,
    userLK
  );

  return {
    adminId,
    userLK,
    allowedKeys,
  };
}

function handleError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown error";

  let status = 500;

  if (message === "Unauthorized") status = 401;
  else if (
    message === "Missing landing_key" ||
    message === "Forbidden landing_key"
  ) {
    status = 403;
  } else if (
    message.startsWith("Invalid ") ||
    message === "Nothing to update" ||
    message === "Missing lead id"
  ) {
    status = 400;
  } else if (message === "Lead not found") {
    status = 404;
  }

  return NextResponse.json(
    { ok: false, error: message },
    { status }
  );
}

async function loadSummary(
  userLK: string,
  requestedLK: string | null,
  allowedKeys: string[] | null
) {
  const batchSize = 1000;
  let from = 0;

  const rows: SummaryLead[] = [];

  while (true) {
    let q = supabaseAdmin
      .from("leads")
      .select(
        "created_at,status,landing_key,assigned_to"
      )
      .order("created_at", { ascending: false })
      .range(from, from + batchSize - 1);

    q = applyLandingScope(
      q,
      userLK,
      requestedLK,
      allowedKeys
    );

    const { data, error } = await q;

    if (error) throw error;

    const batch = (data ?? []) as SummaryLead[];
    rows.push(...batch);

    if (batch.length < batchSize) break;

    from += batchSize;
  }

  // 한국 시간 기준 오늘/이번 달 집계
  const now = new Date();
  const kstNow = new Date(
    now.getTime() + 9 * 60 * 60 * 1000
  );

  const todayString = kstNow
    .toISOString()
    .slice(0, 10);

  const monthString = todayString.slice(0, 7);

  const todayStart = new Date(
    `${todayString}T00:00:00+09:00`
  );

  const monthStart = new Date(
    `${monthString}-01T00:00:00+09:00`
  );

  const statusCounts: Record<string, number> = {
    NEW: 0,
    BOOKED: 0,
    CALLED: 0,
    NO_ANSWER: 0,
    INVALID: 0,
  };

  const managerCounts: Record<string, number> = {
    UNASSIGNED: 0,
  };

  const landingCounts: Record<
    string,
    { total: number; today: number; month: number }
  > = {};

  let today = 0;
  let month = 0;

  for (const row of rows) {
    const status = normalizeStatus(row.status) ?? "NEW";

    statusCounts[status] =
      (statusCounts[status] ?? 0) + 1;

    const managerKey =
      row.assigned_to || "UNASSIGNED";

    managerCounts[managerKey] =
      (managerCounts[managerKey] ?? 0) + 1;

    const lk =
      normalizeLandingKey(row.landing_key) ?? "00";

    if (!landingCounts[lk]) {
      landingCounts[lk] = {
        total: 0,
        today: 0,
        month: 0,
      };
    }

    landingCounts[lk].total += 1;

    const createdAt = new Date(row.created_at);

    if (createdAt >= monthStart) {
      month += 1;
      landingCounts[lk].month += 1;
    }

    if (createdAt >= todayStart) {
      today += 1;
      landingCounts[lk].today += 1;
    }
  }

  return {
    total: rows.length,
    today,
    month,
    status_counts: statusCounts,
    manager_counts: managerCounts,
    landing_counts: landingCounts,
  };
}

// =====================================
// GET - 리드 목록 조회
// 기존 조회 + 이름 검색 + 접수월 검색
// =====================================

export async function GET(req: Request) {
  try {
    const { userLK, allowedKeys } =
      await getAdminContext();

    const { searchParams } = new URL(req.url);

    const requestedLK = normalizeLandingKey(
      searchParams.get("landing_key")
    );

    if (
      userLK !== "00" &&
      requestedLK &&
      !allowedKeys?.includes(requestedLK)
    ) {
      throw new Error("Forbidden landing_key");
    }

    const page = Math.min(
      1000000,
      toPositiveInt(searchParams.get("page"), 1)
    );

    const pageSize = Math.min(
      100,
      toPositiveInt(
        searchParams.get("page_size"),
        50
      )
    );

    const status = normalizeStatus(
      searchParams.get("status")
    );

    const manager = String(
      searchParams.get("manager") ?? ""
    ).trim();

    // 새 검색 기능
    const search = String(
      searchParams.get("search") ??
      searchParams.get("q") ??
      ""
    ).trim();

    const monthParam = searchParams.get("month");
    const selectedMonth = normalizeMonth(monthParam);

    if (monthParam && !selectedMonth) {
      throw new Error("Invalid month");
    }

    const dateParam = searchParams.get("date");
    const selectedDate = normalizeSearchDate(dateParam);
    const startDateParam = searchParams.get("start_date");
    const endDateParam = searchParams.get("end_date");
    const startDate = normalizeSearchDate(startDateParam);
    const endDate = normalizeSearchDate(endDateParam);
    if (Boolean(startDate) !== Boolean(endDate)) {
      throw new Error("Invalid date range: start_date and end_date required");
    }
    if (startDate && endDate && startDate > endDate) {
      throw new Error("Invalid date range: start_date after end_date");
    }
    const phoneLast4 = String(searchParams.get("phone_last4") ?? "").trim();
    if (phoneLast4 && !/^\d{4}$/.test(phoneLast4)) {
      throw new Error("Invalid phone_last4");
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = supabaseAdmin
      .from("leads")
      .select(
        `
        id,
        created_at,
        name,
        phone,
        status,
        memo,
        landing_key,
        utm_source,
        assigned_to,
        reservation_date,
        reservation_time,
        reservation_memo,
        reservation_status
        `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    q = applyLandingScope(
      q,
      userLK,
      requestedLK,
      allowedKeys
    );

    // 기존 상태별 조회
    if (status) {
      q = q.eq("status", status);
    }

    // 기존 담당자별 조회
    if (manager === "UNASSIGNED") {
      q = q.is("assigned_to", null);
    } else if (manager) {
      q = q.eq("assigned_to", manager);
    }

    // 환자 이름 부분 검색
    if (search) {
      const cleanSearch = search
        .replace(/[%_\\]/g, "")
        .slice(0, 100);

      if (cleanSearch) {
        q = q.ilike("name", `%${cleanSearch}%`);
      }
    }

    // 전화번호 마지막 4자리: 기존 번호에 하이픈이 있어도 일치합니다.
    if (phoneLast4) {
      q = q.ilike("phone", `%${phoneLast4}`);
    }

    // 날짜 범위 우선, 구버전의 단일 접수일·접수월도 계속 지원합니다.
    // 한국 시간 기준 접수 시각(created_at), 종료일 포함.
    if (startDate && endDate) {
      const range = getInclusiveDateRange(startDate, endDate);
      q = q.gte("created_at", range.start).lt("created_at", range.end);
    } else if (selectedDate || selectedMonth) {
      const range = selectedDate ? getDateRange(selectedDate) : getMonthRange(selectedMonth!);
      q = q.gte("created_at", range.start).lt("created_at", range.end);
    }

    const [{ data, error, count }, summary] =
      await Promise.all([
        q,
        loadSummary(
          userLK,
          requestedLK,
          allowedKeys
        ),
      ]);

    if (error) throw error;

    const total = count ?? 0;

    return NextResponse.json({
      ok: true,
      landing_key: requestedLK ?? userLK,
      allowed_landing_keys: allowedKeys,
      items: data ?? [],
      total,
      page,
      page_size: pageSize,
      total_pages: Math.max(
        1,
        Math.ceil(total / pageSize)
      ),
      summary,
      filters: {
        search,
        month: selectedDate ? null : selectedMonth,
        date: startDate ? null : selectedDate,
        start_date: startDate,
        end_date: endDate,
        phone_last4: phoneLast4 || null,
        status,
        manager,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

// =====================================
// PATCH - 리드 수정 및 예약 정보 저장
// =====================================

export async function PATCH(req: Request) {
  try {
    const { userLK, allowedKeys } =
      await getAdminContext();

    const body = await req.json();

    if (!body || typeof body !== "object") {
      throw new Error("Invalid request body");
    }

    const id = String(body.id ?? "").trim();

    if (!id) {
      throw new Error("Missing lead id");
    }

    // 기존 클라이언트의 최상위 값 및
    // updates 객체 형식을 모두 지원
    const input =
      body.updates &&
      typeof body.updates === "object" &&
      !Array.isArray(body.updates)
        ? body.updates
        : body;

    // 수정 대상 리드의 랜딩 권한 확인
    const { data: existing, error: findError } =
      await supabaseAdmin
        .from("leads")
        .select(
          "id,landing_key,status,reservation_date,reservation_status"
        )
        .eq("id", id)
        .maybeSingle();

    if (findError) throw findError;

    if (!existing) {
      throw new Error("Lead not found");
    }

    const leadLK = normalizeLandingKey(
      existing.landing_key
    );

    if (
      userLK !== "00" &&
      (!leadLK || !allowedKeys?.includes(leadLK))
    ) {
      throw new Error("Forbidden landing_key");
    }

    const updates: Record<string, unknown> = {};

    // 기존 리드 상태 수정
    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "status"
      )
    ) {
      const status = normalizeStatus(input.status);

      if (!status) {
        throw new Error("Invalid status");
      }

      updates.status = status;
    }

    // 기존 메모 수정
    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "memo"
      )
    ) {
      if (
        input.memo !== null &&
        typeof input.memo !== "string"
      ) {
        throw new Error("Invalid memo");
      }

      updates.memo = input.memo ?? "";
    }

    // 기존 담당자 수정
    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "assigned_to"
      )
    ) {
      if (
        input.assigned_to !== null &&
        typeof input.assigned_to !== "string"
      ) {
        throw new Error("Invalid assigned_to");
      }

      const assigned = String(
        input.assigned_to ?? ""
      ).trim();

      updates.assigned_to = assigned || null;
    }

    // 예약 날짜
    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "reservation_date"
      )
    ) {
      updates.reservation_date = normalizeDate(
        input.reservation_date
      );
    }

    // 예약 시간
    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "reservation_time"
      )
    ) {
      updates.reservation_time = normalizeTime(
        input.reservation_time
      );
    }

    // 예약 메모
    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "reservation_memo"
      )
    ) {
      if (
        input.reservation_memo !== null &&
        typeof input.reservation_memo !== "string"
      ) {
        throw new Error("Invalid reservation_memo");
      }

      updates.reservation_memo =
        input.reservation_memo ?? null;
    }

    // 예약 상태
    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "reservation_status"
      )
    ) {
      if (
        input.reservation_status === null ||
        input.reservation_status === ""
      ) {
        updates.reservation_status = null;
      } else {
        const reservationStatus =
          normalizeReservationStatus(
            input.reservation_status
          );

        if (!reservationStatus) {
          throw new Error(
            "Invalid reservation_status"
          );
        }

        updates.reservation_status =
          reservationStatus;
      }
    }

    // 예약 날짜를 신규 등록하면서 상태를
    // 지정하지 않은 경우 예약 예정으로 처리
    if (
      updates.reservation_date &&
      !Object.prototype.hasOwnProperty.call(
        updates,
        "reservation_status"
      ) &&
      !existing.reservation_status
    ) {
      updates.reservation_status = "SCHEDULED";
    }

    // 예약 시간은 날짜가 있을 때만 저장
    const finalDate =
      Object.prototype.hasOwnProperty.call(
        updates,
        "reservation_date"
      )
        ? updates.reservation_date
        : existing.reservation_date;

    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        "reservation_time"
      ) &&
      updates.reservation_time &&
      !finalDate
    ) {
      throw new Error(
        "Invalid reservation_time: reservation_date required"
      );
    }

    if (Object.keys(updates).length === 0) {
      throw new Error("Nothing to update");
    }

    const { data, error } = await supabaseAdmin
      .from("leads")
      .update(updates)
      .eq("id", id)
      .select(
        `
        id,
        created_at,
        name,
        phone,
        status,
        memo,
        landing_key,
        utm_source,
        assigned_to,
        reservation_date,
        reservation_time,
        reservation_memo,
        reservation_status
        `
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error) {
    return handleError(error);
  }
}
