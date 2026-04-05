"use client";

import { useEffect, useMemo, useState } from "react";

type StatItem = {
  name: string;
  count: number;
};

type AnalyticsResponse = {
  ok: boolean;
  summary: {
    totalLeads: number;
    days: number;
  };
  stats: {
    bySource: StatItem[];
    byCampaign: StatItem[];
    byContent: StatItem[];
    byLanding: StatItem[];
  };
  items: {
    id: string;
    created_at: string;
    landing_key: string | null;
    utm_source: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
  }[];
  error?: string;
};

function StatTable({
  title,
  items,
}: {
  title: string;
  items: StatItem[];
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-black">{title}</h3>

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
            데이터 없음
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3"
            >
              <div className="min-w-0 pr-3 text-sm font-medium text-gray-800">
                {item.name}
              </div>
              <div className="shrink-0 text-sm font-bold text-black">
                {item.count}건
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminAnalyticsClient() {
  const [days, setDays] = useState("7");
  const [landingKey, setLandingKey] = useState("all");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyticsResponse | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/analytics?days=${days}&landing_key=${landingKey}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      setData(json);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [days, landingKey]);

  const total = useMemo(() => data?.summary?.totalLeads ?? 0, [data]);

  return (
    <div className="min-h-screen bg-[#f6f7f9] p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">광고 분석 대시보드</h1>
            <p className="mt-1 text-sm text-gray-600">
              UTM 기준으로 어떤 광고에서 리드가 들어오는지 확인합니다
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm"
            >
              <option value="1">최근 1일</option>
              <option value="7">최근 7일</option>
              <option value="30">최근 30일</option>
              <option value="90">최근 90일</option>
            </select>

            <select
              value={landingKey}
              onChange={(e) => setLandingKey(e.target.value)}
              className="h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm"
            >
              <option value="all">전체 랜딩</option>
              <option value="00">00</option>
              <option value="01">01</option>
              <option value="02">02</option>
              <option value="03">03</option>
              <option value="04">04</option>
              <option value="05">05</option>
            </select>

            <button
              onClick={fetchData}
              className="h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white"
            >
              새로고침
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">총 리드</div>
            <div className="mt-2 text-3xl font-bold text-black">
              {loading ? "-" : total}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">분석 기간</div>
            <div className="mt-2 text-3xl font-bold text-black">
              {data?.summary?.days ?? days}일
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">선택 랜딩</div>
            <div className="mt-2 text-3xl font-bold text-black">
              {landingKey === "all" ? "전체" : landingKey}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <StatTable title="utm_source별 리드" items={data?.stats?.bySource ?? []} />
          <StatTable title="utm_campaign별 리드" items={data?.stats?.byCampaign ?? []} />
          <StatTable title="utm_content별 리드" items={data?.stats?.byContent ?? []} />
          <StatTable title="landing_key별 리드" items={data?.stats?.byLanding ?? []} />
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-black">최근 유입 100건</h3>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="px-3 py-3">시간</th>
                  <th className="px-3 py-3">랜딩</th>
                  <th className="px-3 py-3">소스</th>
                  <th className="px-3 py-3">캠페인</th>
                  <th className="px-3 py-3">콘텐츠</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-3 py-3 text-gray-700">
                      {new Date(row.created_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-3 py-3 font-medium text-black">
                      {row.landing_key || "-"}
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      {row.utm_source || "(미설정)"}
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      {row.utm_campaign || "(미설정)"}
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      {row.utm_content || "(미설정)"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}