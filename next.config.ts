import type { NextConfig } from "next";

// 'unsafe-eval' braucht React/Next nur im Dev-Modus (Rekonstruktion von
// Server-Error-Stacks im Browser). In Production ist es abgeschaltet.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = `'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next begrenzt Server-Action-Anfragen standardmäßig auf 1 MB. Das
      // Profilfoto ist mit bis zu 5 MB beworben (siehe MAX_FOTO_BYTES). Das
      // Limit liegt bewusst deutlich darüber: Größere Dateien erreichen die
      // Action und werden dort mit der Feldmeldung abgelehnt, statt schon
      // vorher auf einer Fehlerseite zu enden.
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            // default-src 'self' ist hier auch eine Datenschutz-Zusage: Die
            // Seite kann gar nichts an Dritte übertragen. Schriften kommen
            // über next/font vom eigenen Server, es gibt keine CDNs, kein
            // Analytics und keine eingebetteten Fremdinhalte. Deshalb braucht
            // die Seite auch keinen Cookie-Banner.
            value: [
              "default-src 'self'",
              `script-src ${scriptSrc}`,
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              "img-src 'self' data: blob:",
              "connect-src 'self'",
              "form-action 'self'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
            ].join("; "),
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
