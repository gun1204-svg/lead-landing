import Link from "next/link";
import { getLandingConfig } from "@/lib/landing";

type Props = {
  landingKey: string;
};

export default function LandingFooter({ landingKey }: Props) {
  const config = getLandingConfig(landingKey);

  return (
    <footer className="w-full border-t border-neutral-200 bg-white px-5 py-6 text-center text-sm text-neutral-600">
      <div className="mx-auto max-w-[1200px] space-y-2">
        <p className="font-semibold text-neutral-800">{config.hospitalName}</p>

        {config.address ? (
          <p className="text-xs leading-5 text-neutral-500">{config.address}</p>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          {config.businessNumber ? <span>사업자등록번호 : {config.businessNumber}</span> : null}
          {config.representativeName ? <span>대표자 : {config.representativeName}</span> : null}
          {config.phone ? <span>상담전화 : {config.phone}</span> : null}
        </div>

        <div className="pt-1 text-sm">
          <Link
            href={`/${config.key}/privacy`}
            className="underline underline-offset-2 hover:text-neutral-900"
          >
            개인정보처리방침
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/${config.key}/terms`}
            className="underline underline-offset-2 hover:text-neutral-900"
          >
            이용약관
          </Link>
        </div>

        <p className="text-xs text-neutral-400">
          © {config.businessName || config.hospitalName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}