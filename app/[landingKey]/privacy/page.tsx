import { getLandingConfig, normalizeLK } from "@/lib/landing";

type Props = {
  params: Promise<{ landingKey: string }>;
};

export default async function PrivacyPage({ params }: Props) {
  const { landingKey } = await params;
  const lk = normalizeLK(landingKey);
  const config = getLandingConfig(lk);

  return (
    <main className="mx-auto max-w-[900px] px-5 py-10 text-sm leading-7 text-neutral-800">
      <h1 className="mb-6 text-2xl font-bold">개인정보처리방침</h1>

      <div className="space-y-6">
        <section>
          <p>
            {config.hospitalName}(이하 &quot;병원&quot;)은 상담 신청 서비스 제공을 위해
            아래와 같이 개인정보를 수집 및 이용합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">1. 수집하는 개인정보 항목</h2>
          <p>이름, 연락처, 유입경로(UTM 등), 상담 신청 시 입력한 기타 정보</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">2. 개인정보의 수집 및 이용 목적</h2>
          <p>상담 신청 접수, 본인 확인, 상담 진행, 문의 응대, 서비스 개선 및 광고 성과 측정</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">3. 개인정보의 보유 및 이용 기간</h2>
          <p>
            수집 및 이용 목적 달성 후 지체 없이 파기하는 것을 원칙으로 합니다. 다만,
            관계 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">4. 개인정보의 제3자 제공</h2>
          <p>
            병원은 원칙적으로 정보주체의 개인정보를 외부에 제공하지 않습니다. 다만,
            정보주체의 동의가 있거나 법령에 특별한 규정이 있는 경우에는 예외로 합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">5. 개인정보 처리 위탁</h2>
          <p>
            병원은 원활한 상담 신청 접수 및 서비스 운영을 위해 필요한 경우 관련 법령에 따라
            개인정보 처리 업무의 일부를 외부에 위탁할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">6. 정보주체의 권리</h2>
          <p>
            정보주체는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">7. 개인정보 보호책임자 및 문의처</h2>
          <p>병원명 : {config.hospitalName}</p>
          {config.address ? <p>주소 : {config.address}</p> : null}
          {config.businessNumber ? <p>사업자등록번호 : {config.businessNumber}</p> : null}
          {config.representativeName ? <p>대표자 : {config.representativeName}</p> : null}
          <p>개인정보 관리책임자 : {config.privacyManager || config.hospitalName}</p>
          <p>연락처 : {config.privacyContact || config.phone || "-"}</p>
          {config.privacyEmail ? <p>이메일 : {config.privacyEmail}</p> : null}
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">8. 시행일</h2>
          <p>본 방침은 게시일로부터 시행됩니다.</p>
        </section>
      </div>
    </main>
  );
}