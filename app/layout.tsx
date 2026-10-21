import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DiwaliBackground from "@/components/DiwaliBackground";
import { EVENT, ORG_NAME } from "@/lib/registration";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const title = `${EVENT.name}: ${EVENT.tagline}`;

export const metadata: Metadata = {
  title: { default: `${title} | ${ORG_NAME}`, template: `%s | ${EVENT.name}` },
  description: `Register for ${title}, an event by ${ORG_NAME} (HUHC). Join as a volunteer, participant, donor or member.`,
  icons: { icon: "/logo.jpg" },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={poppins.className}>
        <DiwaliBackground />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}

