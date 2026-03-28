"use client";

import { useEffect, useMemo, useState } from "react";

type InfluencerLead = {
  id: string;
  username: string;
  profile_url: string | null;
  display_name: string | null;
  followers_text: string | null;
  followers_count: number | null;
  country: string | null;
  language: string | null;
  category: string | null;
  notes: string | null;
  status: "new" | "dm_sent" | "replied" | "closed";
  dm_sent_at: string | null;
  replied_at: string | null;
  closed_at: string | null;
  found_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  follow_up_needed?: boolean;
};

type Stats = {
  total: number;
  newCount: number;
  dmSentCount: number;
  repliedCount: number;
  closedCount: number;
  followUpCount: number;
  qualifiedCount: number;
};

const STATUS_OPTIONS: InfluencerLead["status"][] = [
  "new",
  "dm_sent",
  "replied",
  "closed",
];

function formatNum(v?: number | null) {
  if (!v) return "-";
  return v.toLocaleString("ko-KR");
}

function formatDate(v?: string | null) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("ko-KR");
  } catch {
    return v;
  }
}

function statusLabel(status: InfluencerLead["status"]) {
  switch (status) {
    case "new":
      return "신규";
    case "dm_sent":
      return "DM 발송";
    case "replied":
      return "답장";
    case "closed":
      return "종료";
    default:
      return status;
  }
}

function statusClass(status: InfluencerLead["status"]) {
  switch (status) {
    case "new":
      return "bg-blue-100 text-blue-700";
    case "dm_sent":
      return "bg-amber-100 text-amber-700";
    case "replied":
      return "bg-green-100 text-green-700";
    case "closed":
      return "bg-zinc-200 text-zinc-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

export default function AdminInfluencersClient({
  apiBase = "/api/internal/influencers",
}: {
  apiBase?: string;
}) {
  const [items, setItems] = useState<InfluencerLead[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    newCount: 0,
    dmSentCount: 0,
    repliedCount: 0,
    closedCount: 0,
    followUpCount: 0,
    qualifiedCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  const [qualifiedOnly, setQualifiedOnly] = useState(false);
  const [followUpOnly, setFollowUpOnly] = useState(false);

  const [draftStatus, setDraftStatus] = useState<Record<string, InfluencerLead["status"]>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("status", statusFilter);
    if (q.trim()) sp.set("q", q.trim());
    if (qualifiedOnly) sp.set("min_followers", "50000");
    if (followUpOnly) sp.set("follow_up_only", "true");
    return sp.toString();
  }, [statusFilter, q, qualifiedOnly, followUpOnly]);

  async function fetchItems() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${apiBase}?${queryString}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "조회 실패");
      }

      setItems(json.items || []);
      setStats(json.stats || stats);

      const nextStatus: Record<string, InfluencerLead["status"]> = {};
      const nextNotes: Record<string, string> = {};

      for (const item of json.items || []) {
        nextStatus[item.id] = item.status;
        nextNotes[item.id] = item.notes || "";
      }

      setDraftStatus(nextStatus);
      setDraftNotes(nextNotes);
    } catch (e: any) {
      setError(e?.message || "조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
  }, [queryString, apiBase]);

  async function saveItem(id: string) {
    try {
      setSavingId(id);
      setError("");

      const res = await fetch(`${apiBase}/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: draftStatus[id],
          notes: draftNotes[id] ?? "",
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "저장 실패");
      }

      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...json.item } : item))
      );

      await fetchItems();
    } catch (e: any) {
      setError(e?.message || "저장 실패");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">인플루언서 관리</h1>
        <p className="mt-1 text-sm text-zinc-500">
          내부 전용 인플루언서 / DM / 팔로우업 관리
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-zinc-500">전체</div>
          <div className="mt-1 text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-zinc-500">신규</div>
          <div className="mt-1 text-2xl font-bold">{stats.newCount}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-zinc-500">DM 발송</div>
          <div className="mt-1 text-2xl font-bold">{stats.dmSentCount}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-zinc-500">답장</div>
          <div className="mt-1 text-2xl font-bold">{stats.repliedCount}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-zinc-500">팔로우업 필요</div>
          <div className="mt-1 text-2xl font-bold">{stats.followUpCount}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-zinc-500">5만 이상</div>
          <div className="mt-1 text-2xl font-bold">{stats.qualifiedCount}</div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[160px_1fr_auto_auto_auto]">
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">전체 상태</option>
            <option value="new">new</option>
            <option value="dm_sent">dm_sent</option>
            <option value="replied">replied</option>
            <option value="closed">closed</option>
          </select>

          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="아이디 / 국가 / 언어 / 카테고리 / 메모 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={qualifiedOnly}
              onChange={(e) => setQualifiedOnly(e.target.checked)}
            />
            5만 이상만
          </label>

          <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={followUpOnly}
              onChange={(e) => setFollowUpOnly(e.target.checked)}
            />
            팔로우업만
          </label>

          <button
            className="rounded-xl border px-4 py-2 text-sm font-medium"
            onClick={() => fetchItems()}
          >
            새로고침
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[1300px] w-full text-sm">
            <thead className="bg-zinc-50">
              <tr className="text-left text-zinc-600">
                <th className="px-4 py-3">계정</th>
                <th className="px-4 py-3">팔로워</th>
                <th className="px-4 py-3">국가/언어</th>
                <th className="px-4 py-3">카테고리</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">메모</th>
                <th className="px-4 py-3">기록</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-10 text-center text-zinc-500" colSpan={8}>
                    불러오는 중...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-zinc-500" colSpan={8}>
                    데이터가 없어
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const qualified = (item.followers_count || 0) >= 50000;

                  return (
                    <tr key={item.id} className="border-t align-top">
                      <td className="px-4 py-4">
                        <div className="font-semibold">@{item.username}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {item.display_name || "-"}
                        </div>
                        {item.profile_url ? (
                          <a
                            href={item.profile_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-xs text-blue-600 underline"
                          >
                            프로필 열기
                          </a>
                        ) : null}
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium">{item.followers_text || "-"}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          변환값: {formatNum(item.followers_count)}
                        </div>
                        <div className="mt-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              qualified
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {qualified ? "5만 이상" : "확인 필요"}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div>{item.country || "-"}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {item.language || "-"}
                        </div>
                      </td>

                      <td className="px-4 py-4">{item.category || "-"}</td>

                      <td className="px-4 py-4">
                        <div className="mb-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass(
                              item.status
                            )}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </div>

                        {item.follow_up_needed ? (
                          <div className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                            🔥 팔로우업 필요
                          </div>
                        ) : null}

                        <select
                          className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                          value={draftStatus[item.id] || item.status}
                          onChange={(e) =>
                            setDraftStatus((prev) => ({
                              ...prev,
                              [item.id]: e.target.value as InfluencerLead["status"],
                            }))
                          }
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-4">
                        <textarea
                          className="min-h-[96px] w-full rounded-xl border px-3 py-2 text-sm"
                          value={draftNotes[item.id] ?? ""}
                          onChange={(e) =>
                            setDraftNotes((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          placeholder="메모 입력"
                        />
                      </td>

                      <td className="px-4 py-4 text-xs text-zinc-500">
                        <div>저장: {formatDate(item.created_at)}</div>
                        <div className="mt-1">DM: {formatDate(item.dm_sent_at)}</div>
                        <div className="mt-1">답장: {formatDate(item.replied_at)}</div>
                        <div className="mt-1">종료: {formatDate(item.closed_at)}</div>
                      </td>

                      <td className="px-4 py-4">
                        <button
                          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          onClick={() => saveItem(item.id)}
                          disabled={savingId === item.id}
                        >
                          {savingId === item.id ? "저장중..." : "저장"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}