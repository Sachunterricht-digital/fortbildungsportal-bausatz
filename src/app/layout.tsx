import { ladeSchulamt } from "@/lib/schulamt";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { T } from "@/texte/de";

// next/font lädt die Schriften zur Bauzeit herunter und liefert sie vom
// eigenen Server aus. Es gibt damit keine Verbindung des Browsers zu Google —
// das ist die datenschutzrechtlich entscheidende Eigenschaft, nicht bloß eine
// Frage der Ladezeit.
//
// Poppins für Überschriften, Lexend für den Lesetext: das Schriftpaar F9 aus
// dem Designkatalog (Bestellung PP-Z2-M1-GD-T63-L10-F9-H2-N0-Y2-W0-K3-X2).
// Die Dateien liegen im Projekt, es geht keine Anfrage nach außen.
const poppins = localFont({
  variable: "--font-poppins",
  display: "swap",
  src: [
    { path: "../fonts/Poppins-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Poppins-Bold.woff2", weight: "700", style: "normal" },
  ],
});

const lexend = localFont({
  variable: "--font-lexend",
  display: "swap",
  src: [{ path: "../fonts/Lexend-Variable.woff2", weight: "100 900", style: "normal" }],
});

// Für alles Zählbare. Dieselbe Zeichenbreite lässt Uhrzeiten und Platzzahlen
// in Listen untereinander stehen.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const schulamt = await ladeSchulamt();
  return {
    title: {
      default: T.aussen.rootLayout.titelStandard(schulamt.kurzname),
      template: T.aussen.rootLayout.titelTemplate(schulamt.kurzname),
    },
    description: schulamt.startText,
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="de"
      className={`${poppins.variable} ${lexend.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
