import type { Metadata } from "next";
import Landing09Client from "./Landing09Client";

export const metadata: Metadata = {
  title: "韓国 鼻整形相談 | LINE無料相談",
  description:
    "鼻筋・小鼻・曲がった鼻・横顔のバランスなど、鼻整形のお悩みをLINEでご相談いただけます。",
  openGraph: {
    title: "韓国 鼻整形相談 | LINE無料相談",
    description:
      "あなたのお悩みに合わせた鼻整形について、LINEでお気軽にご相談ください。",
    images: ["/intro/09/01.jpg"],
  },
};

export default function Landing09Page() {
  return <Landing09Client />;
}