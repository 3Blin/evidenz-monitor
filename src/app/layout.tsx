import type { Metadata } from "next";
import "./global.css";

export const metadata: Metadata = {
  title: "Evidenz-Monitor",
  description: "Beobachtungsaufträge, Quellenbewertung und Evidenzverlauf",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
