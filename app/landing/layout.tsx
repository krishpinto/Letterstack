import { Bricolage_Grotesque } from "next/font/google";
import type { Metadata } from "next";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "LetterStack — Email that actually delivers",
  description:
    "Send transactional and marketing emails at scale. Built for developers, loved by marketers.",
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${bricolage.variable} min-h-screen bg-white text-[#0A0A0A] antialiased`}
    >
      {children}
    </div>
  );
}
