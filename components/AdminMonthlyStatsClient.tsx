"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type StatGroup = { total: number; status: Record<string, number> };
type Stats = {
  ok: boolean;
  month: string;
  total: number;
  previous_total: number;
  booked: number;
  booking_rate: number;
  allowed_landing_keys: string[] | null;
  status_counts: Record<string, number>;
  by_landing: Record<string, StatGroup>;
  by_manager: {
    id: string;
    name: string;
    total: number;
    booked: number;
    active: boolean | null;
  }[];
  by_day: Record<string, number>;
  by_source: Record<string, number>;
};
const LABELS: Record<string, string> = {
  "01":"01 랜딩", "02":"02 눈밑지방재배치", "03":"03 코성형",
  "04":"04 코재수술", "05":"05 코재수술 (윤석호)", "06":"06 눈썹거상",
  "07":"07 기능코", "08":"08 비개방 코성형", "09":"09 일본 코성형", "10":"10 얼굴라인",
};
const STATUS: Record<string,string> = { NEW:"신규", BOOKED:"예약", CALLED:"통화", NO_ANSWER:"부재", INVALID:"무효" };
const fmt = (n: number) => n.toLocaleString("ko-KR");
function thisMonth() {
  return new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit"}).format(new Date()).replace("/", "-");
}
function StatCard({ label, value }: {label: string;value: string}) {
  return <div style={{background:"#f8fafc",padding:20,borderRadius:14,border:"1px solid #e2e8f0"}}>
    <div style={{color:"#64748b",fontSize:13}}>{label}</div>
    <div style={{fontSize:26,fontWeight:800,marginTop:8}}>{value}</div>
  </div>;
}
export default function AdminMonthlyStatsClient() {
  const path = usePathname();
  const router = useRouter();
  const {status, data:session} = useSession();
  const pageLK = path.split("/")[1] || "00";
  const userLK = String((session?.user as {landing_key?:string}|undefined)?.landing_key ?? "");
  const [month,setMonth] = useState(thisMonth);
  const [landing,setLanding] = useState("all");
  const [data,setData] = useState<Stats|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  useEffect(()=>{
    if (status !== "authenticated") return;
    if (userLK !== pageLK) { router.replace(`/${userLK}/admin/stats`); return; }
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/admin/monthly-stats?month=${encodeURIComponent(month)}&landing_key=${encodeURIComponent(landing)}`, {signal:controller.signal,cache:"no-store"})
      .then(async r=>{const result=await r.json();if(!r.ok)throw new Error(result.error || "조회 실패");return result as Stats;})
      .then(setData).catch(e=>{if(e.name!=="AbortError")setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[month,landing,status,userLK,pageLK,router]);
  const landingKeys = data?.allowed_landing_keys ?? Object.keys(data?.by_landing ?? {}).filter(k=>/^\d{2}$/.test(k));
  const days = data ? Object.entries(data.by_day).sort(([a],[b])=>a.localeCompare(b)) : [];
  const maxDaily = Math.max(1,...days.map(([,v])=>v));
  const delta = data ? data.total - data.previous_total : 0;
  const boxStyle: React.CSSProperties = {background:"white",border:"1px solid #e2e8f0",borderRadius:14,padding:20,marginTop:20};
  if(status==="loading")return <main style={{padding:24}}>로그인 확인 중...</main>;
  if(status==="unauthenticated")return <main style={{padding:24}}>로그인이 필요합니다. <a href={`/${pageLK}/admin/login`}>로그인</a></main>;
  return <main className="admin-light-page" style={{maxWidth:1100,margin:"0 auto",padding:"24px 16px 80px",color:"#0f172a"}}>
    <a href={`/${pageLK}/admin/leads`} style={{color:"#2563eb",textDecoration:"none"}}>← 리드 관리로 돌아가기</a>
    <h1 style={{fontSize:28,margin:"20px 0 6px"}}>월별 리드 통계</h1>
    <p style={{color:"#64748b",margin:"0 0 20px"}}>선택한 월의 전체 및 랜딩별 상담 실적 · 한국 시간 기준</p>
    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
      <label>조회 월 <input type="month" max={thisMonth()} value={month} onChange={e=>setMonth(e.target.value)} style={{display:"block",padding:10,marginTop:5}} /></label>
      <label>랜딩 페이지 <select value={landing} onChange={e=>setLanding(e.target.value)} style={{display:"block",padding:10,marginTop:5,minWidth:220}}>
        <option value="all">전체 랜딩</option>
        {landingKeys.sort().map(k=><option key={k} value={k}>{LABELS[k] ?? `${k} 랜딩`}</option>)}
      </select></label>
    </div>
    {loading && <p>통계를 불러오는 중...</p>}
    {error && <p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
    {data && <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))",gap:12,marginTop:20}}>
        <StatCard label="총 리드" value={`${fmt(data.total)}건`}/>
        <StatCard label="예약 완료" value={`${fmt(data.booked)}건`}/>
        <StatCard label="예약률" value={`${data.booking_rate}%`}/>
        <StatCard label="전월 대비 리드" value={`${delta>0?"+":""}${fmt(delta)}건`}/>
      </div>

      {/* manager-monthly-stats-v2 */}
      <section style={boxStyle}>
        <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 10px"}}>
          {"\uB2F4\uB2F9\uC790\uBCC4 \uC6D4\uBCC4 \uC2E4\uC801"}
        </h2>

        <p style={{color:"#64748b",fontSize:13,marginBottom:14}}>
          {"\uC120\uD0DD\uD55C \uC6D4\uC758 \uB9AC\uB4DC\uB97C \uD604\uC7AC \uBC30\uC815\uB41C \uB2F4\uB2F9\uC790 \uAE30\uC900\uC73C\uB85C \uC9D1\uACC4\uD569\uB2C8\uB2E4."}
        </p>

        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{
            width:"100%",
            minWidth:340,
            borderCollapse:"collapse",
            textAlign:"left",
            fontSize:14,
            color:"#111827"
          }}>
            <thead>
              <tr style={{background:"#f8fafc"}}>
                <th style={{padding:10,whiteSpace:"nowrap"}}>
                  {"\uB2F4\uB2F9\uC790"}
                </th>
                <th style={{padding:10,whiteSpace:"nowrap"}}>
                  {"\uC804\uCCB4 \uB9AC\uB4DC"}
                </th>
                <th style={{padding:10,whiteSpace:"nowrap"}}>
                  {"\uC608\uC57D"}
                </th>
                <th style={{padding:10,whiteSpace:"nowrap"}}>
                  {"\uC608\uC57D\uB960"}
                </th>
              </tr>
            </thead>

            <tbody>
              {[...(data.by_manager ?? [])]
                .sort((a,b)=>b.total-a.total)
                .map((m)=>(
                  <tr
                    key={m.id}
                    style={{borderTop:"1px solid #e2e8f0"}}
                  >
                    <td style={{padding:10,fontWeight:700}}>
                      {m.name}
                      {m.active === false && (
                        <span style={{
                          marginLeft: 6,
                          fontSize: 12,
                          color: "#64748b"
                        }}>
                          {"(\uBE44\uD65C\uC131)"}
                        </span>
                      )}
                    </td>
                    <td style={{padding:10}}>
                      {fmt(m.total)}
                    </td>
                    <td style={{padding:10}}>
                      {fmt(m.booked)}
                    </td>
                    <td style={{padding:10}}>
                      {m.total
                        ? (m.booked / m.total * 100).toFixed(1)
                        : "0.0"}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {(data.by_manager ?? []).length === 0 && (
          <p style={{fontSize:13,color:"#64748b"}}>
            {"\uD574\uB2F9 \uAE30\uAC04\uC758 \uB9AC\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}
          </p>
        )}
      </section>

      <section style={boxStyle}><h2>랜딩별 실적</h2><div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}><thead><tr><th>랜딩</th><th>리드</th><th>예약</th><th>예약률</th></tr></thead><tbody>
          {Object.entries(data.by_landing).sort(([a],[b])=>a.localeCompare(b)).map(([key,row])=><tr key={key} onClick={()=>setLanding(key)} style={{cursor:"pointer",borderTop:"1px solid #e2e8f0"}}>
            <td style={{padding:"12px 6px"}}>{LABELS[key] ?? key}</td><td>{fmt(row.total)}</td><td>{fmt(row.status.BOOKED ?? 0)}</td><td>{row.total ? ((row.status.BOOKED ?? 0)/row.total*100).toFixed(1):"0.0"}%</td>
          </tr>)}
        </tbody></table></div></section>
      <section style={boxStyle}><h2>일별 리드 유입</h2>
        {days.length===0?<p>데이터가 없습니다.</p>:<div style={{display:"flex",alignItems:"end",gap:5,height:190,overflowX:"auto",paddingBottom:10}}>
          {days.map(([day,count])=><div key={day} title={`${day}: ${count}건`} style={{display:"flex",flexDirection:"column",justifyContent:"end",alignItems:"center",minWidth:28,height:"100%"}}>
            <small style={{fontSize:10}}>{count}</small><div style={{width:20,height:`${Math.max(5,count/maxDaily*140)}px`,background:"#2563eb",borderRadius:"4px 4px 0 0"}}/><small style={{fontSize:10}}>{day.slice(-2)}</small>
          </div>)}
        </div>}
      </section>
      <section style={boxStyle}><h2>상담 상태별</h2>{Object.entries(STATUS).map(([key,label])=><p key={key}>{label}: <b>{fmt(data.status_counts[key]??0)}건</b></p>)}</section>
      <section style={boxStyle}><h2>유입 매체별</h2>{Object.entries(data.by_source).sort((a,b)=>b[1]-a[1]).map(([key,value])=><p key={key}>{key}: <b>{fmt(value)}건</b></p>)}{Object.keys(data.by_source).length===0&&<p>데이터가 없습니다.</p>}</section>
    </>}
  </main>;
}
