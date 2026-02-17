"use client";
import { useEffect, useState } from "react";

type Settings = {
  sms_enabled: boolean;
  admin_notify_phone: string;
  customer_sms_template: string;
  admin_sms_template: string;
};

export default function AdminSettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/settings");
    if (!res.ok) {
      alert("로그인이 필요합니다.");
      window.location.href = "/admin/login";
      return;
    }
    const json = await res.json();
    setS(json.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(patch: Partial<Settings>) {
    if (!s) return;
    setSaving(true);
    setS({ ...s, ...patch });

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    setSaving(false);
    if (!res.ok) alert("저장 실패");
  }

  if (!s) return <main style={{ padding: 24 }}>불러오는 중...</main>;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <h1>설정</h1>
      <p><a href="/admin/leads">← 리드로 돌아가기</a></p>

      <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, display: "flex", gap: 12, alignItems: "center" }}>
        <strong>자동문자 발송</strong>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={s.sms_enabled}
            onChange={(e) => save({ sms_enabled: e.target.checked })}
          />
          {s.sms_enabled ? "ON" : "OFF"}
        </label>

        {saving ? <span>저장중…</span> : null}
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <label>
          내부 알림 받을 번호
          <input
            value={s.admin_notify_phone || ""}
            onChange={(e) => setS({ ...s, admin_notify_phone: e.target.value })}
            onBlur={() => save({ admin_notify_phone: s.admin_notify_phone })}
            placeholder="01037634323"
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          고객 문자 템플릿 (변수: {"{name}"})
          <textarea
            value={s.customer_sms_template || ""}
            onChange={(e) => setS({ ...s, customer_sms_template: e.target.value })}
            onBlur={() => save({ customer_sms_template: s.customer_sms_template })}
            rows={3}
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          내부 알림 문자 템플릿 (변수: {"{name}"}, {"{phone}"})
          <textarea
            value={s.admin_sms_template || ""}
            onChange={(e) => setS({ ...s, admin_sms_template: e.target.value })}
            onBlur={() => save({ admin_sms_template: s.admin_sms_template })}
            rows={3}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
      </div>
    </main>
  );
}
