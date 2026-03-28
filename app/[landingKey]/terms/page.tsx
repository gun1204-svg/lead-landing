import { getLandingConfig, normalizeLK } from "@/lib/landing";

type Props = {
  params: Promise<{ landingKey: string }>;
};

export default async function TermsPage({ params }: Props) {
  const { landingKey } = await params;
  const lk = normalizeLK(landingKey);
  const config = getLandingConfig(lk);

  return (
    <main className="mx-auto max-w-[900px] px-5 py-10 text-sm leading-7 text-neutral-800">
      <h1 className="mb-6 text-2xl font-bold">이용약관</h1>

      <div className="space-y-6">
        <section>
          <h2 className="mb-2 text-lg font-semibold">1. 목적</h2>
          <p>
            본 약관은 {config.businessName || config.hospitalName}(이하 &quot;병원&quot;)이
            제공하는 상담 신청 서비스의 이용과 관련하여 병원과 이용자 간의 권리,
            의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">2. 서비스 내용</h2>
          <p>
            병원은 랜딩페이지를 통해 상담 신청 접수 서비스를 제공하며, 이용자는 이름 및 연락처 등
            필요한 정보를 입력하여 상담을 신청할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">3. 이용자의 의무</h2>
          <p>
            이용자는 사실에 근거한 정확한 정보를 입력해야 하며, 타인의 정보를 무단으로 도용하거나
            허위 정보를 기재해서는 안 됩니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">4. 서비스 이용 제한</h2>
          <p>
            병원은 다음의 경우 서비스 제공을 제한하거나 상담 신청을 거부할 수 있습니다.
          </p>
          <p>허위 정보 입력, 타인 명의 도용, 서비스 운영 방해, 관련 법령 위반 등의 경우</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">5. 면책사항</h2>
          <p>
            병원은 천재지변, 시스템 장애, 통신망 장애 등 불가항력적 사유로 인한 서비스 중단에 대해
            책임을 지지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">6. 개인정보 보호</h2>
          <p>
            병원은 관련 법령에 따라 이용자의 개인정보를 보호하며, 자세한 사항은
            개인정보처리방침을 따릅니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">7. 사업자 정보</h2>
          <p>병원명 : {config.businessName || config.hospitalName}</p>
          {config.address ? <p>주소 : {config.address}</p> : null}
          {config.businessNumber ? <p>사업자등록번호 : {config.businessNumber}</p> : null}
          {config.representativeName ? <p>대표자 : {config.representativeName}</p> : null}
          {config.phone ? <p>상담전화 : {config.phone}</p> : null}
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">8. 시행일</h2>
          <p>본 약관은 게시일로부터 시행됩니다.</p>
        </section>
      </div>
    </main>
  );
}