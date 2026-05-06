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

type DmTemplate = {
  id: string;
  template_key: "english" | "japanese" | "followup" | string;
  label: string;
  content: string;
  created_at: string | null;
  updated_at: string | null;
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

async function readApiJson(res: Response) {
  const text = await res.text();

  if (!text) {
    return { ok: res.ok };
  }

  try {
    return JSON.parse(text);
  } catch {
    return { ok: res.ok, raw: text };
  }
}

function applyTemplate(content: string, item: InfluencerLead) {
  return content
    .replaceAll("{{username}}", item.username ? `@${item.username}` : "")
    .replaceAll("{{name}}", item.display_name || item.username || "");
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

  const [templates, setTemplates] = useState<DmTemplate[]>([]);
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, string>>({});
  const [savingTemplateKey, setSavingTemplateKey] = useState<string | null>(null);

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
      const json = await readApiJson(res);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "조회 실패");
      }

      setItems(json.items || []);
      setStats(
        json.stats || {
          total: 0,
          newCount: 0,
          dmSentCount: 0,
          repliedCount: 0,
          closedCount: 0,
          followUpCount: 0,
          qualifiedCount: 0,
        }
      );

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

  async function fetchTemplates() {
    try {
      const res = await fetch("/api/internal/dm-templates", {
        cache: "no-store",
      });
      const json = await readApiJson(res);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "템플릿 조회 실패");
      }

      const templateOrder = ["english", "japanese", "followup"];

      const items = (json.items || []).sort((a: DmTemplate, b: DmTemplate) => {
        return (
          templateOrder.indexOf(a.template_key) -
          templateOrder.indexOf(b.template_key)
        );
      });

      setTemplates(items);

      const drafts: Record<string, string> = {};
      for (const item of items) {
        drafts[item.template_key] = item.content || "";
      }
      setTemplateDrafts(drafts);
    } catch (e: any) {
      setError(e?.message || "템플릿 조회 실패");
    }
  }

  useEffect(() => {
    fetchItems();
  }, [queryString, apiBase]);

  useEffect(() => {
    fetchTemplates();
  }, []);

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

      const json = await readApiJson(res);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "저장 실패");
      }

      if (json?.item) {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, ...json.item } : item))
        );
      }

      await fetchItems();
    } catch (e: any) {
      setError(e?.message || "저장 실패");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteItem(id: string) {
    const ok = window.confirm("이 데이터를 삭제할까?");
    if (!ok) return;

    try {
      setSavingId(id);
      setError("");

      const res = await fetch(`${apiBase}/${id}`, {
        method: "DELETE",
      });

      const json = await readApiJson(res);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "삭제 실패");
      }

      setItems((prev) => prev.filter((item) => item.id !== id));
      await fetchItems();
    } catch (e: any) {
      setError(e?.message || "삭제 실패");
    } finally {
      setSavingId(null);
    }
  }

  async function saveTemplate(templateKey: string) {
    try {
      setSavingTemplateKey(templateKey);
      setError("");

      const res = await fetch("/api/internal/dm-templates", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_key: templateKey,
          content: templateDrafts[templateKey] || "",
        }),
      });

      const json = await readApiJson(res);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "템플릿 저장 실패");
      }

      await fetchTemplates();
      alert("DM 템플릿이 저장됐어");
    } catch (e: any) {
      setError(e?.message || "템플릿 저장 실패");
    } finally {
      setSavingTemplateKey(null);
    }
  }

  async function copyTemplate(templateKey: string, item: InfluencerLead) {
    try {
      const template = templates.find((x) => x.template_key === templateKey);
      if (!template) {
        setError("템플릿을 찾을 수 없어");
        return;
      }

      const text = applyTemplate(template.content, item);
      await navigator.clipboard.writeText(text);
      setError("");
      alert("DM 문구가 복사됐어");
    } catch {
      setError("복사 실패");
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

      <div className="mb-4 rounded-2xl border bg-white p-4">
        <div className="mb-3">
          <h2 className="text-lg font-bold">DM 템플릿 관리</h2>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
            템플릿이 없어. Supabase의 dm_templates 테이블과 기본 데이터를 확인해줘.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {templates.map((template) => (
              <div key={template.template_key} className="rounded-2xl border p-3">
                <div className="mb-2 text-sm font-bold">{template.label}</div>

                <textarea
                  className="min-h-[220px] w-full rounded-xl border px-3 py-2 text-sm"
                  value={templateDrafts[template.template_key] || ""}
                  onChange={(e) =>
                    setTemplateDrafts((prev) => ({
                      ...prev,
                      [template.template_key]: e.target.value,
                    }))
                  }
                />

                <button
                  className="mt-2 w-full rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={() => saveTemplate(template.template_key)}
                  disabled={savingTemplateKey === template.template_key}
                >
                  {savingTemplateKey === template.template_key ? "저장중..." : "템플릿 저장"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">저장된 리스트</h2>
            <p className="mt-1 text-xs text-zinc-500">
              가로 스크롤 없이 카드형으로 관리
            </p>
          </div>

          <button
            className="rounded-xl border px-4 py-2 text-sm font-medium"
            onClick={() => fetchItems()}
          >
            새로고침
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
            불러오는 중...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
            데이터가 없어
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => {
              const qualified = (item.followers_count || 0) >= 50000;

              return (
                <div key={item.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1.2fr_1fr]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="max-w-full truncate text-lg font-bold">
                          @{item.username}
                        </div>

                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            qualified
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {qualified ? "5만 이상" : "확인 필요"}
                        </span>

                        {item.follow_up_needed ? (
                          <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                            🔥 팔로우업 필요
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 text-sm text-zinc-500">
                        {item.display_name || "-"}
                      </div>

                      {item.profile_url ? (
                        <a
                          href={item.profile_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block text-sm font-medium text-blue-600 underline"
                        >
                          프로필 열기
                        </a>
                      ) : null}

                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-xl bg-zinc-50 p-3">
                          <div className="text-xs text-zinc-500">팔로워</div>
                          <div className="mt-1 font-semibold">{item.followers_text || "-"}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {formatNum(item.followers_count)}
                          </div>
                        </div>

                        <div className="rounded-xl bg-zinc-50 p-3">
                          <div className="text-xs text-zinc-500">국가 / 언어</div>
                          <div className="mt-1 font-semibold">
                            {item.country || "-"} / {item.language || "-"}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {item.category || "-"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-bold">상태</div>

                      <div className="mb-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass(
                            item.status
                          )}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </div>

                      <select
                        className="w-full rounded-xl border px-3 py-2 text-sm"
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

                      <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">
                        <div>저장: {formatDate(item.created_at)}</div>
                        <div className="mt-1">DM: {formatDate(item.dm_sent_at)}</div>
                        <div className="mt-1">답장: {formatDate(item.replied_at)}</div>
                        <div className="mt-1">종료: {formatDate(item.closed_at)}</div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-bold">메모</div>
                      <textarea
                        className="min-h-[150px] w-full rounded-xl border px-3 py-2 text-sm"
                        value={draftNotes[item.id] ?? ""}
                        onChange={(e) =>
                          setDraftNotes((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="메모 입력"
                      />
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-bold">액션</div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          onClick={() => saveItem(item.id)}
                          disabled={savingId === item.id}
                        >
                          {savingId === item.id ? "처리중..." : "저장"}
                        </button>

                        <button
                          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          onClick={() => deleteItem(item.id)}
                          disabled={savingId === item.id}
                        >
                          삭제
                        </button>
                      </div>

                      <div className="mt-3 grid gap-2">
                        <button
                          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700"
                          onClick={() => copyTemplate("english", item)}
                        >
                          영문 DM 복사
                        </button>

                        <button
                          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700"
                          onClick={() => copyTemplate("japanese", item)}
                        >
                          일본어 DM 복사
                        </button>

                        <button
                          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700"
                          onClick={() => copyTemplate("followup", item)}
                        >
                          팔로우업 복사
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}