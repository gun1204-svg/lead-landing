"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

const LINE_ADD_FRIEND_URL = "https://line.me/ti/p/Dtxp_6EXKQ";

const SELF_CHECK_OPTIONS = [
  {
    id: "low_bridge",
    title: "低い鼻・鼻筋",
    description: "鼻が低い、または鼻筋を整えたい",
  },
  {
    id: "wide_nose",
    title: "鼻の横幅・小鼻",
    description: "小鼻の広がりや鼻の横幅が気になる",
  },
  {
    id: "crooked_nose",
    title: "曲がった鼻",
    description: "鼻筋の曲がりや左右差が気になる",
  },
  {
    id: "side_profile",
    title: "横顔のライン",
    description: "鼻からあごにかけてのバランスを整えたい",
  },
  {
    id: "consultation",
    title: "施術について相談したい",
    description: "自分に合った施術がわからない",
  },
];

export default function Landing09Client() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [lineId, setLineId] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const selectedOptions = useMemo(() => {
    return SELF_CHECK_OPTIONS.filter((option) =>
      selectedIds.includes(option.id)
    );
  }, [selectedIds]);

  const selectedText = selectedOptions
    .map((option) => option.title)
    .join("、");

  function toggleOption(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((value) => value !== id);
      }

      return [...current, id];
    });

    setErrorMessage("");
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (selectedIds.length === 0) {
    setErrorMessage("気になる項目を1つ以上選択してください。");
    return;
  }

  if (!name.trim()) {
    setErrorMessage("お名前を入力してください。");
    return;
  }

  const cleanLineId = lineId.trim().toLowerCase();

  if (!cleanLineId) {
    setErrorMessage("LINE IDを入力してください。");
    return;
  }

  if (!/^[a-z0-9._-]+$/.test(cleanLineId)) {
    setErrorMessage(
    "LINE IDは半角英小文字・数字・「.」「-」「_」で入力してください。"
    );
    return;
  }

  if (!agreed) {
    setErrorMessage("個人情報の取り扱いに同意してください。");
    return;
  }

  setErrorMessage("");
  setIsSubmitting(true);

  try {
    const params = new URLSearchParams(window.location.search);

    const response = await fetch("/api/leads/09", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        line_id: cleanLineId,
        line_name: cleanLineId,
        selected_labels: selectedOptions.map(
          (option) => option.title
        ),
        utm_source: params.get("utm_source") || "",
        utm_campaign: params.get("utm_campaign") || "",
        utm_term: params.get("utm_term") || "",
        utm_content: params.get("utm_content") || "",
      }),
    });

    const result = await response.json();

    if (!response.ok || result.ok === false) {
      if (result.error === "INSUFFICIENT_BALANCE") {
        setErrorMessage(
          "現在、オンライン受付を一時停止しています。"
        );
        return;
      }

      throw new Error(result.error || "LEAD_CREATE_FAILED");
    }

    alert(
      [
        "お申し込みありがとうございます。",
        "",
        "続けてLINE公式アカウントから",
        "メッセージをお送りください。",
      ].join("\n")
    );

    setName("");
    setLineId("");
    setSelectedIds([]);
    setAgreed(false);

    window.location.href = LINE_ADD_FRIEND_URL;
  } catch (error) {
    console.error("09 lead submit error:", error);

    setErrorMessage(
      "送信できませんでした。時間をおいて再度お試しください。"
    );
  } finally {
    setIsSubmitting(false);
  }
}

  return (
    <main
      lang="ja"
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#f3f5f4",
        paddingBottom: "88px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "860px",
          margin: "0 auto",
          background: "#ffffff",
        }}
      >
        <img
          src="/intro/09/01.jpg"
          alt="韓国 鼻整形相談"
          style={{
            display: "block",
            width: "100%",
            height: "auto",
          }}
        />

        <section
          style={{
            padding: "50px 20px",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: "28px",
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                color: "#06c755",
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "0.15em",
              }}
            >
              SELF CHECK
            </p>

            <h1
              style={{
                margin: 0,
                color: "#17201b",
                fontSize: "28px",
                lineHeight: 1.4,
              }}
            >
              あなたの鼻のお悩みは？
            </h1>

            <p
              style={{
                margin: "12px 0 0",
                color: "#667168",
                fontSize: "15px",
              }}
            >
              気になる項目を選択してください。
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "12px",
            }}
          >
            {SELF_CHECK_OPTIONS.map((option) => {
              const selected = selectedIds.includes(option.id);

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleOption(option.id)}
                  aria-pressed={selected}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "flex-start",
                    gap: "13px",
                    padding: "17px",
                    borderRadius: "15px",
                    border: selected
                      ? "2px solid #06c755"
                      : "1px solid #dfe8e2",
                    background: selected ? "#effff5" : "#ffffff",
                    color: "#17201b",
                    textAlign: "left",
                    cursor: "pointer",
                    boxShadow: selected
                      ? "0 8px 22px rgba(6, 199, 85, 0.12)"
                      : "none",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      flexShrink: 0,
                      width: "25px",
                      height: "25px",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "7px",
                      border: selected
                        ? "2px solid #06c755"
                        : "2px solid #cbd6cf",
                      background: selected ? "#06c755" : "#ffffff",
                      color: "#ffffff",
                      fontSize: "15px",
                      fontWeight: 900,
                    }}
                  >
                    {selected ? "✓" : ""}
                  </span>

                  <span
                    style={{
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "16px",
                        lineHeight: 1.4,
                      }}
                    >
                      {option.title}
                    </strong>

                    <small
                      style={{
                        color: "#667168",
                        fontSize: "12px",
                        lineHeight: 1.6,
                      }}
                    >
                      {option.description}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "grid",
              gap: "7px",
              marginTop: "16px",
              padding: "16px",
              borderRadius: "14px",
              background: "#17201b",
              color: "#ffffff",
            }}
          >
            <span
              style={{
                color: "#bac6be",
                fontSize: "12px",
              }}
            >
              現在選択中のお悩み
            </span>

            <strong
              style={{
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              {selectedText || "気になる項目を選択してください"}
            </strong>
          </div>

          <div
            style={{
              marginTop: "22px",
              padding: "18px",
              borderRadius: "15px",
              border: "1px solid #eadfce",
              background: "#fffaf3",
              color: "#554635",
            }}
          >
            <strong
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "15px",
                color: "#33291f",
              }}
            >
              ご相談をご希望の方へ
            </strong>

            <p
              style={{
                margin: "0 0 5px",
                fontSize: "12px",
                lineHeight: 1.8,
              }}
            >
              お申し込み後、2週間以内にご来院・ご相談が可能な方のみ
              お申し込みください。
            </p>

            <p
              style={{
                margin: 0,
                fontSize: "12px",
                lineHeight: 1.8,
              }}
            >
              スムーズなご案内のため、ご来院可能な日程をご確認のうえ、
              お申し込みをお願いいたします。
            </p>
          </div>

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            style={{
              display: "grid",
              gap: "16px",
              marginTop: "22px",
              padding: "20px",
              borderRadius: "18px",
              border: "1px solid #dfe8e2",
              background: "#f5faf7",
            }}
          >
            <label
              style={{
                display: "grid",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#17201b",
                }}
              >
                お名前
              </span>

              <input
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="例：山田 花子"
                maxLength={50}
                style={{
                  width: "100%",
                  height: "52px",
                  boxSizing: "border-box",
                  padding: "0 15px",
                  borderRadius: "13px",
                  border: "1px solid #cad7cf",
                  background: "#ffffff",
                  fontSize: "16px",
                  color: "#17201b",
                  outline: "none",
                }}
              />
            </label>

            <label
              style={{
                display: "grid",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#17201b",
                }}
              >
                LINE ID
              </span>

              <input
                type="text"
                value={lineId}
                onChange={(event) => {
                  setLineId(event.target.value.toLowerCase());
                  setErrorMessage("");
                }}
                placeholder="例：yamada_123"
                maxLength={50}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                style={{
                  width: "100%",
                  height: "52px",
                  boxSizing: "border-box",
                  padding: "0 15px",
                  borderRadius: "13px",
                  border: "1px solid #cad7cf",
                  background: "#ffffff",
                  fontSize: "16px",
                  color: "#17201b",
                  outline: "none",
                }}
              />

              <small
                style={{
                  color: "#667168",
                  fontSize: "11px",
                  lineHeight: 1.7,
                }}
              >
                LINEの「設定 → プロフィール」からIDをご確認ください。
                ID検索による友だち追加を許可した状態でお申し込みください。
              </small>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "9px",
                color: "#4c5850",
                fontSize: "12px",
                lineHeight: 1.6,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => {
                  setAgreed(event.target.checked);
                  setErrorMessage("");
                }}
                style={{
                  width: "20px",
                  height: "20px",
                  flexShrink: 0,
                  margin: 0,
                  accentColor: "#06c755",
                }}
              />

              <span>個人情報の収集および利用に同意します。</span>
            </label>

            {errorMessage && (
              <p
                style={{
                  margin: 0,
                  padding: "11px 13px",
                  borderRadius: "11px",
                  border: "1px solid #fecaca",
                  background: "#fff1f2",
                  color: "#b42318",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%",
                minHeight: "56px",
                border: 0,
                borderRadius: "14px",
                background: "#06c755",
                color: "#ffffff",
                fontSize: "17px",
                fontWeight: 900,
                cursor: isSubmitting ? "wait" : "pointer",
                opacity: isSubmitting ? 0.65 : 1,
                boxShadow: "0 10px 24px rgba(6, 199, 85, 0.23)",
              }}
            >
             {isSubmitting ? "送信中..." : "LINEで無料相談する"}
            </button>

            <p
              style={{
                margin: "-5px 0 0",
                textAlign: "center",
                color: "#667168",
                fontSize: "11px",
              }}
            >
              お申し込み内容を確認後、LINEでご案内いたします。
            </p>
          </form>
        </section>

        <img
          src="/intro/09/02.jpg"
          alt="鼻整形のご案内"
          style={{
            display: "block",
            width: "100%",
            height: "auto",
          }}
        />

        <img
          src="/intro/09/03.jpg"
          alt="鼻整形の詳細案内"
          style={{
            display: "block",
            width: "100%",
            height: "auto",
          }}
        />
      </div>

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
          padding: "10px 14px",
          paddingBottom:
            "calc(10px + env(safe-area-inset-bottom))",
          background: "rgba(255, 255, 255, 0.95)",
          borderTop: "1px solid rgba(0, 0, 0, 0.08)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <button
          type="button"
          onClick={scrollToForm}
          style={{
            display: "block",
            width: "100%",
            maxWidth: "600px",
            minHeight: "54px",
            margin: "0 auto",
            border: 0,
            borderRadius: "14px",
            background: "#06c755",
            color: "#ffffff",
            fontSize: "17px",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow:
              "0 10px 24px rgba(6, 199, 85, 0.25)",
          }}
        >
          LINEで無料相談する
        </button>
      </div>
    </main>
  );
}