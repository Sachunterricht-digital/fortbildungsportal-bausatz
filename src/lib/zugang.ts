import "server-only";

/**
 * Die eigentliche Logik steht in src/lib/zugangKern.ts, absichtlich ohne
 * diese Markierung — siehe die Erklärung dort (scripts/zugangslink.ts
 * braucht ungeschützten Zugriff, weil es ohne Next.js-Bundler läuft). Diese
 * Datei bleibt der reguläre Importweg für Server Actions und Server
 * Components und bewahrt die Warnung vor versehentlicher Client-Nutzung.
 */
export * from "@/lib/zugangKern";
